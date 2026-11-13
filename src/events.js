// -----------------------------------------------------------------------------
// Scene events and scene action outputs of the integration.
//
// The tracker says what happened; this module writes the flat `data` of the
// event the core matches against the scene triggers. Every event carries:
//   - `device`       the device external id: the value of the "Device"
//                    filter (a `source: "devices"` select);
//   - `device_name`  "Enedis Mâcon", readable by the actions;
//   - `summary`      a sentence ready to put in a message;
// plus the fields of its kind. Outage events carry `scope` ("street" or
// "commune": the filter "on my street only") and `kind` (incident, works,
// shedding, other). Values are scalars (null when Enedis did not say), texts
// cut at 1,000 characters.
// -----------------------------------------------------------------------------

import { SCENE_TRIGGERS } from './tracker.js';
import { idsOf, deviceName, situationText } from './device.js';
import { openOutages, levelOf, restorationOf } from './read.js';
import { formatParis } from './time.js';
import { t } from './i18n.js';

const MAX_TEXT = 1000;
const MAX_LISTED = 5;
const clip = (value) => String(value ?? '').slice(0, MAX_TEXT);
const iso = (instant) => (Number.isFinite(instant) ? new Date(instant).toISOString() : null);

/**
 * @description The label of an outage kind ("Incident HTA" stays as Enedis
 * says it, with its translation around it).
 * @param {object} outage - The outage.
 * @param {string} language - The language.
 * @returns {string} "breakdown (medium voltage)".
 */
function kindText(outage, language) {
  const kind = t(`kind_${outage.kind}`, language);
  return outage.network ? `${kind} (${t(`network_${outage.network}`, language)})` : kind;
}

/**
 * @description The streets of an outage, those of the place first: "BD
 * HAUSSMANN, RUE GLUCK…".
 * @param {object} outage - The outage.
 * @returns {string} The streets.
 */
function streetsText(outage) {
  const sorted = [...outage.addresses].sort((a, b) => Number(b.onStreet) - Number(a.onStreet));
  const shown = sorted.slice(0, MAX_LISTED).map((entry) => entry.text);
  return sorted.length > MAX_LISTED ? `${shown.join(', ')}…` : shown.join(', ');
}

/**
 * @description The values of an outage, shared by the outage events.
 * @param {object} outage - The outage.
 * @returns {object} Flat values.
 */
function outageValues(outage) {
  return {
    outage_id: outage.id,
    kind: outage.kind,
    network: outage.network,
    label: outage.label,
    scope: outage.onStreet ? 'street' : 'commune',
    on_my_street: outage.onStreet,
    streets: clip(streetsText(outage)),
    started_at: iso(outage.startedAt),
    restoration_at: iso(outage.restorationAt),
  };
}

/**
 * @description The event of a place transition.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The place snapshot.
 * @param {object} event - From diffPlace.
 * @param {string} language - Language of the summary.
 * @param {number} now - Now, in ms.
 * @returns {{ key: string, data: object }} The event.
 * @example
 * const { key, data } = buildPlaceEvent(gladys, snapshot, event, 'fr', Date.now());
 * await gladys.publishSceneEvent(key, data);
 */
function buildPlaceEvent(gladys, snapshot, event, language, now) {
  const name = deviceName(snapshot.place, language);
  const data = { device: idsOf(gladys, snapshot.place.id).device, device_name: clip(name) };
  const { outage } = event;
  const where = (value) =>
    t(value.onStreet ? 'whereStreet' : 'whereCommune', language, { streets: streetsText(value) });
  switch (event.key) {
    case SCENE_TRIGGERS.OUTAGE_STARTED:
      Object.assign(data, outageValues(outage), {
        summary: clip(
          [
            t('summaryStarted', language, { name, kind: kindText(outage, language) }),
            where(outage),
            Number.isFinite(outage.restorationAt)
              ? t('situationRestoration', language, {
                  time: formatParis(outage.restorationAt, language, now),
                })
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        ),
      });
      break;
    case SCENE_TRIGGERS.OUTAGE_ENDED: {
      const minutes = Number.isFinite(outage.startedAt)
        ? Math.max(0, Math.round((now - outage.startedAt) / 60000))
        : null;
      Object.assign(data, outageValues(outage), {
        duration_minutes: minutes,
        summary: clip(
          [
            t('summaryEnded', language, { name, kind: kindText(outage, language) }),
            where(outage),
          ].join(' '),
        ),
      });
      break;
    }
    case SCENE_TRIGGERS.RESTORATION_CHANGED: {
      const shift = Math.round((outage.restorationAt - event.previous) / 60000);
      Object.assign(data, outageValues(outage), {
        previous_restoration_at: iso(event.previous),
        change: shift > 0 ? 'postponed' : 'advanced',
        shift_minutes: shift,
        summary: clip(
          t(shift > 0 ? 'summaryPostponed' : 'summaryAdvanced', language, {
            name,
            kind: kindText(outage, language),
            time: formatParis(outage.restorationAt, language, now),
            previous: formatParis(event.previous, language, now),
          }),
        ),
      });
      break;
    }
    case SCENE_TRIGGERS.CRISIS_CHANGED:
      Object.assign(data, {
        state: event.state,
        title: clip(event.crisis?.title ?? ''),
        message: clip(event.crisis?.message ?? ''),
        summary: clip(
          t(event.state === 'started' ? 'summaryCrisisStarted' : 'summaryCrisisEnded', language, {
            name,
            title: event.crisis?.title ?? '',
          }),
        ),
      });
      break;
    default:
      throw new Error(`Unknown place event: ${event.key}`);
  }
  return { key: event.key, data };
}

/**
 * @description The outputs of the get_outages scene action. Texts Enedis did
 * not give are empty (outputs are typed).
 * @param {object} snapshot - The place snapshot.
 * @param {string} language - Language of the summary.
 * @param {number} now - Now, in ms.
 * @returns {object} The outputs.
 */
function buildPlaceOutputs(snapshot, language, now) {
  const open = openOutages(snapshot);
  const level = levelOf(snapshot);
  const restoration = restorationOf(snapshot);
  return {
    has_outage: open.length > 0,
    on_my_street: level === 2,
    level,
    outages: open.length,
    restoration_at: iso(restoration) ?? '',
    restoration: Number.isFinite(restoration) ? formatParis(restoration, language, now) : '',
    streets: clip(
      open
        .filter((outage) => level < 2 || outage.onStreet)
        .map(streetsText)
        .join(' · '),
    ),
    crisis: snapshot.crises.length > 0,
    summary: clip(
      t('summaryPlace', language, {
        name: deviceName(snapshot.place, language),
        situation: situationText(snapshot, language, now),
      }),
    ),
  };
}

export { kindText, streetsText, outageValues, buildPlaceEvent, buildPlaceOutputs };
