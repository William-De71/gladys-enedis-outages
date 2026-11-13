// -----------------------------------------------------------------------------
// Dashboard widget of the Enedis outages integration.
//
//   - `outages`  the outages of a place at a glance: whether the street of the
//                place is hit, the outages in progress in the commune (streets,
//                kind, estimated restoration), and the message of an
//                exceptional event (storm…) when Enedis publishes one.
//
// The contents come from the snapshots of the last reading: a widget never
// costs a request to Enedis. Every text exists in the four languages (the
// content is cached per language).
// -----------------------------------------------------------------------------

import { t, ago } from './i18n.js';
import { placeName } from './device.js';
import { openOutages, levelOf, restorationOf } from './read.js';
import { kindText, streetsText } from './events.js';
import { formatParis } from './time.js';

const WIDGETS = { OUTAGES: 'outages' };
const SHOW = ['all', 'street'];
const DEFAULT_SHOW = 'all';
const TTL = { min: 60, max: 3600, message: 300 };
const MAX_ITEMS = 8;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 * @example
 * clip('A very long street name', 10); // -> 'A very lo…'
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The settings of the widget, unknown values replaced by the defaults.
 * @param {object} [settings] - The raw settings.
 * @returns {{ show: string }} The settings.
 * @example
 * readOutageSettings({ show: 'street' }); // -> { show: 'street' }
 */
function readOutageSettings(settings = {}) {
  return { show: SHOW.includes(settings.show) ? settings.show : DEFAULT_SHOW };
}

/**
 * @description The card of an outage.
 * @param {object} outage - The outage.
 * @param {string} language - The language.
 * @param {number} now - Now, in ms.
 * @returns {object} The card-list item.
 */
function outageItem(outage, language, now) {
  let until = t('untilUnknown', language);
  if (Number.isFinite(outage.restorationAt)) {
    // Enedis keeps an outage open past its expected end: say so, not "until".
    until = t(outage.restorationAt < now ? 'untilOverdue' : 'untilTime', language, {
      time: formatParis(outage.restorationAt, language, now),
    });
  }
  const details = [
    t('detailKind', language, { value: outage.label ?? kindText(outage, language) }),
    Number.isFinite(outage.startedAt)
      ? t('detailStart', language, { value: formatParis(outage.startedAt, language) })
      : null,
    Number.isFinite(outage.restorationAt)
      ? t('detailRestoration', language, { value: formatParis(outage.restorationAt, language) })
      : null,
    t('detailStreets', language, {
      value: outage.addresses.map((entry) => entry.text).join(', ') || '?',
    }),
  ].filter(Boolean);
  return {
    title: clip(streetsText(outage) || t('unknownStreets', language), 60),
    // No `date`: in a card-list the core shows it in place of the subtitle,
    // and the start is in the details.
    subtitle: clip(`${kindText(outage, language)} · ${until}`, 60),
    badge: outage.onStreet
      ? { text: clip(t('badgeStreet', language), 16), color: 'danger' }
      : { text: clip(t(`badge_${outage.kind}`, language), 16), color: 'warning' },
    description: clip(details.join('\n'), 2000),
  };
}

/**
 * @description The `outages` widget.
 * @param {object} options - Options.
 * @param {object} options.snapshot - The place snapshot.
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now, in ms.
 * @param {number} options.pollMinutes - The reading interval.
 * @param {object} [options.settings] - The widget settings (readOutageSettings).
 * @returns {object} The content.
 * @example
 * buildOutagesWidget({ snapshot, language: 'fr', now: Date.now(), pollMinutes: 15 });
 */
function buildOutagesWidget({
  snapshot,
  language,
  now,
  pollMinutes,
  settings = readOutageSettings(),
}) {
  const ttl = Math.min(TTL.max, Math.max(TTL.min, Math.round(pollMinutes * 60)));
  const { place } = snapshot;
  const open = openOutages(snapshot);
  const level = levelOf(snapshot);
  const shown = settings.show === 'street' ? open.filter((outage) => outage.onStreet) : open;
  // Those of the street first, then by start.
  shown.sort((a, b) => Number(b.onStreet) - Number(a.onStreet));

  const components = [
    {
      type: 'text',
      variant: 'caption',
      text: clip(
        t('readAgo', language, {
          place: placeName(place),
          ago: ago(snapshot.fetchedAt, now, language),
        }),
        80,
      ),
    },
  ];

  for (const crisis of snapshot.crises.slice(0, 1)) {
    components.push({
      type: 'text',
      variant: 'body',
      text: clip([crisis.title, crisis.message].filter(Boolean).join(' — '), 300),
    });
  }

  const restoration = restorationOf(snapshot);
  const items = [];
  if (place.street) {
    items.push({
      label: clip(t('rowStreet', language), 40),
      value: clip(t(level === 2 ? 'valueStreetHit' : 'valueStreetOk', language), 40),
      color: level === 2 ? 'danger' : 'success',
    });
  }
  items.push({
    label: clip(t('rowCommune', language), 40),
    value:
      open.length === 0
        ? clip(t('valueNone', language), 40)
        : clip(t('valueCount', language, { count: open.length }), 40),
    color: open.length === 0 ? 'success' : 'warning',
  });
  if (open.length > 0 && Number.isFinite(restoration)) {
    items.push({
      label: clip(t('rowRestoration', language), 40),
      value: clip(formatParis(restoration, language, now), 40),
      color: 'info',
    });
  }
  components.push({ type: 'status', items });

  if (shown.length > 0) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: shown.slice(0, MAX_ITEMS).map((outage) => outageItem(outage, language, now)),
    });
    if (shown.length > MAX_ITEMS) {
      components.push({
        type: 'text',
        variant: 'caption',
        text: clip(t('moreOutages', language, { count: shown.length - MAX_ITEMS }), 80),
      });
    }
  } else if (open.length === 0 && snapshot.crises.length === 0) {
    components.push({
      type: 'text',
      variant: 'body',
      text: clip(t('noOutageBody', language), 300),
    });
  }

  return { ttl_seconds: ttl, components };
}

export {
  WIDGETS,
  SHOW,
  DEFAULT_SHOW,
  MAX_ITEMS,
  clip,
  messageContent,
  readOutageSettings,
  outageItem,
  buildOutagesWidget,
};
