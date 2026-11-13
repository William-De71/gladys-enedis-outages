// -----------------------------------------------------------------------------
// The Enedis outages integration: every handler, registered on a Gladys client.
//
// Brings the power outages Enedis publishes on enedis.fr into Gladys, for up
// to three places (a house of Gladys or a typed address):
//   - a device per place (outage on the street or in the commune, number of
//     outages, the situation as a sentence), offered on the Discovery screen
//     (see device.js);
//   - scene triggers: outage started, power back, restoration time moved,
//     exceptional event (see tracker.js, events.js);
//   - a scene action: read the outages of a place;
//   - a dashboard widget: the outages of a place at a glance (see widgets.js).
//
// Enedis has no open API and no push: the integration reads the outage map of
// enedis.fr on its own timer (see enedis-api.js). The addresses become a
// commune and a street through the Géoplateforme geocoder (see geo.js).
// Transport: cloud only. Nothing is ever written anywhere.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, readLanguage, INTERNAL_KEYS, AUTO_LANGUAGE } from './config.js';
import { createEnedisClient } from './enedis-api.js';
import { createGeoClient } from './geo.js';
import { createWatcher } from './watcher.js';
import {
  placeId,
  idsOf,
  placeIdFromExternalId,
  placeName,
  situationText,
  buildPlaceDevice,
  buildPlaceStates,
} from './device.js';
import { buildPlaceEvent, buildPlaceOutputs } from './events.js';
import { WIDGETS, messageContent, readOutageSettings, buildOutagesWidget } from './widgets.js';
import { LANGUAGES, t, all } from './i18n.js';

const { name, version, homepage } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const ACTIONS = { CHECK_PLACES: 'check_places' };
const SCENE_ACTIONS = { GET_OUTAGES: 'get_outages' };
// A scene action reuses the last reading while it is this fresh.
const SNAPSHOT_MAX_AGE_MS = 60000;

/**
 * @description The message key and values of a failure.
 * @param {Error} err - An EnedisError, a GeoError or a placement problem.
 * @param {string} label - The place, as the user knows it.
 * @returns {{ key: string, values: object }} The message.
 */
function problemOf(err, label) {
  if (err.name === 'GeoError') {
    return err.kind === 'not_found'
      ? { key: 'statusAddressNotFound', values: { address: label } }
      : { key: 'statusGeoUnreachable', values: {} };
  }
  switch (err.kind) {
    case 'house':
      return { key: 'statusHouseNotLocated', values: { house: label } };
    case 'not_covered':
      return { key: 'statusNotCovered', values: { place: label } };
    case 'unavailable':
      return { key: 'statusUnavailable', values: {} };
    case 'blocked':
      return { key: 'statusBlocked', values: {} };
    case 'unreachable':
      return { key: 'statusUnreachable', values: {} };
    default:
      return { key: 'statusUnexpected', values: {} };
  }
}

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetchImpl] - fetch implementation of Enedis and the geocoder (tests).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {Function} [options.sleep] - `(ms) => Promise` between two places (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ watcher: object, getConfig: Function, places: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  { fetchImpl = globalThis.fetch, now = () => Date.now(), sleep, logger = sdkLogger } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`.
  let language = 'en';
  // Device external ids the user created (states are only published for them).
  let createdDevices = new Set();
  // Last connection status sent, to send it again only when it changes.
  let lastStatus = null;
  // The places of the configuration, resolved: `{ id, slot, insee, city,
  // postcode, district, street, label }`, and the problems of the others.
  let places = [];
  let placeProblems = [];
  // Places of a commune Enedis does not serve: never offered as devices.
  const notCovered = new Set();
  let resolving = null;
  // Geocoder answers, by query: an address does not move between two rounds.
  const geoCache = new Map();

  const userAgent = `${name}/${version} (+${homepage})`;
  const enedis = createEnedisClient({ fetch: fetchImpl, userAgent });
  const geo = createGeoClient({ fetch: fetchImpl, userAgent });

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  function textLanguage() {
    return config.language === AUTO_LANGUAGE ? language : config.language;
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  // --- Places ------------------------------------------------------------------------

  /**
   * @description A geocoder answer, from the cache when known.
   * @param {string} key - The cache key.
   * @param {Function} ask - `() => Promise<place>`.
   * @returns {Promise<object>} The place.
   */
  async function cached(key, ask) {
    if (!geoCache.has(key)) {
      geoCache.set(key, await ask());
    }
    return geoCache.get(key);
  }

  /**
   * @description Resolve every place of the configuration into a commune and
   * a street. A place that fails is kept in placeProblems.
   * @returns {Promise<void>}
   */
  async function resolveNow() {
    const resolved = [];
    const problems = [];
    let houses = null;
    for (const entry of config.places) {
      let label = entry.address ?? entry.house;
      try {
        let found;
        if (entry.address) {
          found = await cached(`q:${entry.address.toLowerCase()}`, () => geo.search(entry.address));
        } else {
          if (houses === null) {
            houses = await gladys.getHouses().catch((err) => {
              logger.warn(`Unable to read the houses: ${err.message}`);
              return [];
            });
          }
          const house = houses.find((candidate) => candidate.selector === entry.house);
          label = house?.name ?? entry.house;
          if (!house || typeof house.latitude !== 'number' || typeof house.longitude !== 'number') {
            throw Object.assign(new Error(`House without a position: ${label}`), { kind: 'house' });
          }
          found = await cached(`h:${house.latitude.toFixed(5)},${house.longitude.toFixed(5)}`, () =>
            geo.reverse(house.latitude, house.longitude),
          );
        }
        const place = { ...found, slot: entry.slot, id: placeId(found) };
        if (!resolved.some((other) => other.id === place.id)) {
          resolved.push(place);
        }
      } catch (err) {
        logger.warn(`Place ${entry.slot} not resolved: ${err.message}`);
        problems.push({ slot: entry.slot, label, error: err });
      }
    }
    places = resolved;
    placeProblems = problems;
    logger.info(
      `Places: ${resolved.map((place) => `${place.label} (INSEE ${place.insee})`).join('; ') || 'none'}`,
    );
  }

  /**
   * @description Resolve the places; joins a resolution already running.
   * @returns {Promise<void>}
   */
  function resolvePlaces() {
    if (!resolving) {
      resolving = resolveNow().finally(() => {
        resolving = null;
      });
    }
    return resolving;
  }

  /**
   * @description The places for a round: a geocoder that did not answer is
   * asked again.
   * @returns {Promise<object[]>} The resolved places.
   */
  async function getPlaces() {
    if (placeProblems.some((problem) => problem.error.kind === 'unreachable')) {
      await resolvePlaces();
    }
    return places;
  }

  // --- Devices and states --------------------------------------------------------------

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  const isCreated = (id) => createdDevices.has(idsOf(gladys, id).device);

  /**
   * @description Publish the states of the created devices that changed (the
   * SDK remembers what it sent).
   * @param {object[]} snapshots - Place snapshots.
   * @returns {Promise<void>}
   */
  async function publishStates(snapshots) {
    const states = snapshots
      .filter((snapshot) => isCreated(snapshot.place.id))
      .flatMap((snapshot) => buildPlaceStates(gladys, snapshot, textLanguage(), now()));
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  const publishQuietly = (snapshots) =>
    publishStates(snapshots).catch((err) =>
      logger.warn(`Unable to publish the states: ${err.message}`),
    );

  /**
   * @description Ask the dashboards to read the widget again.
   */
  function refreshWidgets() {
    Object.values(WIDGETS).forEach((key) => gladys.requestWidgetRefresh(key));
  }

  /**
   * @description Publish a scene event; a failure is only logged.
   * @param {{ key: string, data: object }} event - The event.
   * @returns {Promise<void>}
   */
  async function publishEvent({ key, data }) {
    logger.info(`${data.device_name}: ${key}`);
    try {
      await gladys.publishSceneEvent(key, data);
    } catch (err) {
      logger.warn(`Unable to publish the scene event ${key}: ${err.message}`);
    }
  }

  /**
   * @description The connection status after a round.
   * @param {number} read - Places read.
   * @param {object[]} failures - `{ label, error }` of the places not read.
   * @returns {Promise<void>}
   */
  async function reportRound(read, failures) {
    if (config.places.length === 0) {
      await reportStatus(false, all('noPlace'));
      return;
    }
    if (failures.length === 0) {
      await reportStatus(true, all('statusConnected', { places: read }));
      return;
    }
    const { key, values } = problemOf(failures[0].error, failures[0].label);
    if (read === 0) {
      await reportStatus(false, all(key, values));
      return;
    }
    const message = Object.fromEntries(
      LANGUAGES.map((lang) => [
        lang,
        t('statusPartial', lang, {
          places: read,
          failed: failures.length,
          problem: t(key, lang, values),
        }),
      ]),
    );
    await reportStatus(true, message);
  }

  // --- The watcher -----------------------------------------------------------------
  const watcher = createWatcher({
    enedis,
    getPlaces,
    getIntervalMs: () => config.interval * 60000,
    onRound: async ({ places: read, errors }) => {
      read.forEach(({ snapshot }) => notCovered.delete(snapshot.place.id));
      errors
        .filter(({ error }) => error.kind === 'not_covered')
        .forEach(({ place }) => notCovered.add(place.id));
      for (const { snapshot, events } of read) {
        for (const event of events) {
          await publishEvent(buildPlaceEvent(gladys, snapshot, event, textLanguage(), now()));
        }
      }
      const changed = read.filter((entry) => entry.changed).map((entry) => entry.snapshot);
      if (changed.length > 0) {
        await publishQuietly(changed);
      }
      refreshWidgets();
      await reportRound(read.length, [
        ...placeProblems,
        ...errors.map(({ place, error }) => ({ label: placeName(place), error })),
      ]);
    },
    now,
    sleep,
    logger,
  });

  /**
   * @description Offer every resolved place on the Discovery screen.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices() {
    const devices = places
      .filter((place) => !notCovered.has(place.id))
      .map((place) => buildPlaceDevice(gladys, place, textLanguage()));
    await gladys.publishDiscoveredDevices(devices);
    return devices.length;
  }

  /**
   * @description The place a widget or a scene action targets: the chosen
   * device, or the first place.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {object|null} The place, null when none is known.
   */
  function targetPlace(deviceExternalId) {
    const id = placeIdFromExternalId(deviceExternalId);
    return (
      (id && places.find((place) => place.id === id)) ||
      places.find((place) => !notCovered.has(place.id)) ||
      places[0] ||
      null
    );
  }

  // --- Dashboard widget --------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.OUTAGES, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    if (config.places.length === 0) {
      return messageContent(t('noPlace', lang));
    }
    if (watcher.fetchedAt() === null) {
      return messageContent(t('notReadYet', lang), 30);
    }
    const place = targetPlace(settings.device);
    const snapshot = place && watcher.snapshot(place.id);
    if (!snapshot && place && notCovered.has(place.id)) {
      return messageContent(t('statusNotCovered', lang, { place: placeName(place) }));
    }
    if (!snapshot) {
      const problem = placeProblems[0];
      if (!place && problem) {
        const { key, values } = problemOf(problem.error, problem.label);
        return messageContent(t(key, lang, values));
      }
      return messageContent(t('placeNotRead', lang, { place: place ? placeName(place) : '?' }), 60);
    }
    return buildOutagesWidget({
      snapshot,
      language: lang,
      now: now(),
      pollMinutes: config.interval,
      settings: readOutageSettings(settings),
    });
  });

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_OUTAGES, async (fields) => {
    const place = targetPlace(fields.device);
    if (!place) {
      throw new Error('No place is configured, or none could be found');
    }
    let snapshot = watcher.snapshot(place.id);
    if (!snapshot || now() - snapshot.fetchedAt > SNAPSHOT_MAX_AGE_MS) {
      // Read for this answer only when the last reading is old: a scene run
      // every minute must not multiply the requests. No trigger fires here.
      snapshot = await watcher.readPlace(place);
    }
    return buildPlaceOutputs(snapshot, textLanguage(), now());
  });

  // --- Device commands ---------------------------------------------------------------
  gladys.onSetValue(async (device, deviceFeature) => {
    throw new Error(`Read-only feature: ${deviceFeature.external_id}`);
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.CHECK_PLACES, async () => {
    if (config.places.length === 0) {
      return all('noPlace');
    }
    geoCache.clear();
    await resolvePlaces();
    const lines = Object.fromEntries(LANGUAGES.map((lang) => [lang, []]));
    for (const place of places) {
      let line;
      try {
        const snapshot = await watcher.readPlace(place);
        notCovered.delete(place.id);
        line = (lang) =>
          t('testPlace', lang, {
            place: place.label,
            insee: place.insee,
            situation: `${situationText(snapshot, lang, now())}${place.street ? '' : ` (${t('testNoStreet', lang)})`}`,
          });
      } catch (err) {
        if (err.kind === 'not_covered') {
          notCovered.add(place.id);
        }
        // The message names the place already.
        const { key, values } = problemOf(err, `${place.label} (INSEE ${place.insee})`);
        line = (lang) => t(key, lang, values);
      }
      for (const lang of LANGUAGES) {
        lines[lang].push(line(lang));
      }
    }
    for (const problem of placeProblems) {
      const { key, values } = problemOf(problem.error, problem.label);
      for (const lang of LANGUAGES) {
        lines[lang].push(t(key, lang, values));
      }
    }
    await publishDiscoveredDevices().catch(() => {});
    return Object.fromEntries(LANGUAGES.map((lang) => [lang, lines[lang].join('\n')]));
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await resolvePlaces();
    await watcher.round();
    const count = await publishDiscoveredDevices();
    logger.info(`Scan: ${count} place(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishQuietly(watcher.snapshots());
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  /**
   * @description Resolve the places, read Enedis now and offer the devices.
   * @returns {Promise<void>}
   */
  async function refreshAll() {
    await resolvePlaces();
    await watcher.round();
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    await loadConfig(rawConfig);
    logger.info(`Configuration updated: Enedis read every ${config.interval} min`);
    // A moved place is a new baseline for itself only: the snapshots are kept
    // by place id, and a place no longer configured is dropped at the round.
    watcher.reschedule();
    await refreshAll();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  gladys.on('connected', async () => {
    await loadConfig();
    await refreshCreatedDevices();
    lastStatus = null;
    await refreshAll();
    watcher.start();
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    watcher.stop();
  });

  return { watcher, getConfig: () => config, places: () => places };
}

export { createApp, ACTIONS, SCENE_ACTIONS, problemOf };
