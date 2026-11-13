// -----------------------------------------------------------------------------
// The devices of the Enedis outages integration, offered on the Discovery
// screen.
//
// One device per place of the configuration, "Enedis <commune>" (or "Enedis
// <street>, <commune>" when the place has a street):
//   - power outage    risk / integer, 0 to 2: 0 no outage in the commune, 1 an
//                     outage in the commune, 2 an outage on the street of the
//                     place (likely: Enedis lists streets, not homes);
//   - outages         counter-sensor / integer: outages in progress in the
//                     commune (or the arrondissement);
//   - situation       text / text: what is cut and until when, as a sentence.
//
// External ids are built on the INSEE code of the commune and the words of
// the street, never on a display name: the same address keeps its device.
//
// Enedis has no push: the integration reads it on its own timer, so
// `should_poll` is false. Every feature is read-only.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { streetWords, openOutages, levelOf, restorationOf } from './read.js';
import { formatParis } from './time.js';
import { t } from './i18n.js';

const DEVICE_TYPE = 'place';
const MAX_COUNT = 999;

const FEATURE_KEYS = { STATUS: 'status', OUTAGES: 'outages', SITUATION: 'situation' };

const shapes = {
  risk: {
    category: CATEGORIES.RISK,
    type: TYPES.RISK.INTEGER,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    min: 0,
    max: 2,
  },
  counter: {
    category: CATEGORIES.COUNTER_SENSOR,
    type: TYPES.SENSOR.INTEGER,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    min: 0,
    max: MAX_COUNT,
  },
  text: {
    category: CATEGORIES.TEXT,
    type: TYPES.TEXT.TEXT,
    read_only: true,
    has_feedback: false,
    keep_history: false,
    min: 0,
    max: 0,
  },
};

/**
 * @description The id of a place: its INSEE code, and the words of its
 * street when it has one ("71270-ursulines").
 * @param {object} place - `{ insee, street }`.
 * @returns {string} The id (lower case letters, digits, hyphens).
 * @example
 * placeId({ insee: '75109', street: 'Boulevard Haussmann' }); // -> '75109-haussmann'
 */
function placeId(place) {
  const insee = String(place.insee).toLowerCase();
  const words = streetWords(place.street).join('-').toLowerCase().slice(0, 48).replace(/-+$/, '');
  return words ? `${insee}-${words}` : insee;
}

/**
 * @description The external ids of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} id - The place id.
 * @returns {{ device: string, feature: Function }} The ids.
 */
function idsOf(gladys, id) {
  return gladys.externalIds(DEVICE_TYPE, id);
}

/**
 * @description The place id a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {string|null} The place id.
 * @example
 * placeIdFromExternalId('ext:enedis-outages:place:71270:status'); // -> '71270'
 */
function placeIdFromExternalId(externalId) {
  const match = /:place:([a-z0-9-]+)(?::[a-z_]+)?$/i.exec(String(externalId ?? ''));
  return match ? match[1].toLowerCase() : null;
}

/**
 * @description "Mâcon" or "Rue des Ursulines, Mâcon".
 * @param {object} place - The place.
 * @returns {string} The name of the place.
 */
function placeName(place) {
  const city = place.district ?? place.city ?? place.insee;
  return place.street ? `${place.street}, ${city}` : city;
}

/**
 * @description The name of a place device.
 * @param {object} place - The place.
 * @param {string} language - The language.
 * @returns {string} "Enedis Mâcon".
 */
function deviceName(place, language) {
  return t('deviceName', language, { place: placeName(place) });
}

/**
 * @description The situation of a place, as one sentence.
 * @param {object} snapshot - The snapshot.
 * @param {string} language - The language.
 * @param {number} [now] - Now, in ms (the day of a restoration today is left out).
 * @returns {string} The sentence.
 */
function situationText(snapshot, language, now) {
  const open = openOutages(snapshot);
  if (open.length === 0) {
    return t(snapshot.crises.length > 0 ? 'situationCrisis' : 'situationNone', language);
  }
  const restoration = restorationOf(snapshot);
  const parts = [
    t(levelOf(snapshot) === 2 ? 'situationStreet' : 'situationCommune', language, {
      count: open.length,
    }),
  ];
  if (Number.isFinite(restoration)) {
    parts.push(
      t('situationRestoration', language, { time: formatParis(restoration, language, now) }),
    );
  }
  return parts.join(' ');
}

// The features of a place: their Gladys shape and their state.
const PLACE_FEATURES = [
  { key: FEATURE_KEYS.STATUS, name: 'featureStatus', shape: shapes.risk, state: levelOf },
  {
    key: FEATURE_KEYS.OUTAGES,
    name: 'featureOutages',
    shape: shapes.counter,
    state: (snapshot) => Math.min(MAX_COUNT, openOutages(snapshot).length),
  },
  {
    key: FEATURE_KEYS.SITUATION,
    name: 'featureSituation',
    shape: shapes.text,
    state: (snapshot, language, now) => ({ text: situationText(snapshot, language, now) }),
  },
];

/**
 * @description The device of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - The resolved place.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildPlaceDevice(gladys, place, language = 'en') {
  const ids = idsOf(gladys, place.id);
  return {
    name: deviceName(place, language),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'ENEDIS_INSEE', value: place.insee },
      ...(place.street ? [{ name: 'ENEDIS_STREET', value: place.street }] : []),
    ],
    features: PLACE_FEATURES.map((spec) => ({
      name: t(spec.name, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The snapshot.
 * @param {string} language - Language of the texts.
 * @param {number} [now] - Now, in ms.
 * @returns {Array<object>} The states.
 */
function buildPlaceStates(gladys, snapshot, language, now) {
  const ids = idsOf(gladys, snapshot.place.id);
  return PLACE_FEATURES.map((spec) => {
    const value = spec.state(snapshot, language, now);
    const id = ids.feature(spec.key);
    return typeof value === 'object'
      ? { device_feature_external_id: id, text: value.text }
      : { device_feature_external_id: id, state: value };
  });
}

export {
  DEVICE_TYPE,
  FEATURE_KEYS,
  PLACE_FEATURES,
  placeId,
  idsOf,
  placeIdFromExternalId,
  placeName,
  deviceName,
  situationText,
  buildPlaceDevice,
  buildPlaceStates,
};
