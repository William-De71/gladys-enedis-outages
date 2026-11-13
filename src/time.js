// -----------------------------------------------------------------------------
// Dates of the Enedis answers (pure logic, no I/O).
//
// Enedis writes its dates "13/11/2026 23:21": day, month, year, hour and
// minute in the legal time of mainland France (Europe/Paris), with no offset.
// Enedis only serves mainland France, so Europe/Paris is always right.
// -----------------------------------------------------------------------------

const ZONE = 'Europe/Paris';
const MINUTE = 60000;

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * @description The offset of Paris at an instant, in minutes (60 in winter,
 * 120 in summer).
 * @param {number} instant - The instant, in ms.
 * @returns {number} The offset.
 */
function parisOffset(instant) {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  return Math.round((asUtc - Math.floor(instant / MINUTE) * MINUTE) / MINUTE);
}

/**
 * @description Read an Enedis date.
 * @param {unknown} value - "dd/mm/yyyy HH:MM" (Paris time).
 * @returns {number|null} The instant in ms, null when it cannot be read.
 * @example
 * parseEnedisDate('14/11/2026 01:00'); // -> Date.parse('2026-11-14T00:00:00Z')
 */
function parseEnedisDate(value) {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?\s*$/.exec(
    String(value ?? ''),
  );
  if (!match) {
    return null;
  }
  const [, day, month, year, hour = '0', minute = '0'] = match;
  const local = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  if (!Number.isFinite(local) || Number(month) > 12 || Number(day) > 31 || Number(hour) > 23) {
    return null;
  }
  // Two passes: the offset of the guessed instant settles the DST changes.
  let instant = local - parisOffset(local) * MINUTE;
  instant = local - parisOffset(instant) * MINUTE;
  return instant;
}

const shortFormats = new Map();

/**
 * @description "14/11 01:00" in the language's way, Paris time.
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {number} [now] - Now, in ms: the day is left out when it is today.
 * @returns {string} The text.
 * @example
 * formatParis(Date.parse('2026-11-14T00:00:00Z'), 'fr'); // -> '14/11 01:00'
 */
function formatParis(instant, language, now) {
  if (!Number.isFinite(instant)) {
    return '?';
  }
  const sameDay = Number.isFinite(now) && dayKey(instant) === dayKey(now) ? 'time' : 'dateTime';
  const key = `${language}:${sameDay}`;
  if (!shortFormats.has(key)) {
    shortFormats.set(
      key,
      new Intl.DateTimeFormat(language, {
        timeZone: ZONE,
        hourCycle: 'h23',
        ...(sameDay === 'time' ? {} : { day: '2-digit', month: '2-digit' }),
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }
  return shortFormats.get(key).format(new Date(instant));
}

/**
 * @description The Paris day of an instant, "2026-11-14".
 * @param {number} instant - The instant, in ms.
 * @returns {string} The day.
 */
function dayKey(instant) {
  const offset = parisOffset(instant);
  return new Date(instant + offset * MINUTE).toISOString().slice(0, 10);
}

export { ZONE, parisOffset, parseEnedisDate, formatParis, dayKey };
