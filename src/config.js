// -----------------------------------------------------------------------------
// Configuration of the Enedis outages integration (no account, no key).
//
// Fields of the config_schema, per place (`<n>` from 1 to 3):
//   - `house_<n>`     a house of Gladys (`source: "houses"`): the nearest
//                     address to its coordinates gives the commune and the
//                     street;
//   - `address_<n>`   or an address typed by hand ("12 rue des Ursulines
//                     71000 Mâcon"), or only a commune ("Mâcon 71000"): it
//                     wins over the house. Without a street, only the outages
//                     of the commune are known, never "on my street".
// And:
//   - `interval`      minutes between two readings of Enedis;
//   - `language`      language of the texts Gladys does not ask for in a
//                     language (feature names, scene summaries): `auto`
//                     follows the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language` language of the last widget request, kept for the
//                     texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const MAX_PLACES = 3;
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
// One request per place and per reading: every 15 minutes is 96 a day for a
// place, a light load for a page the public reads by hand.
const INTERVALS = [5, 10, 15, 30, 60];
const DEFAULT_INTERVAL = 15;

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Read the reading interval.
 * @param {unknown} raw - The raw value ("15", 15).
 * @returns {number} Minutes, one of INTERVALS.
 * @example
 * readInterval('30'); // -> 30
 */
function readInterval(raw) {
  const value = Number(raw);
  return INTERVALS.includes(value) ? value : DEFAULT_INTERVAL;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ places: [{ slot, house, address }], interval, language }`;
 * a slot without a house nor an address is left out.
 * @example
 * normalizeConfig({ address_1: 'Mâcon 71000' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const places = [];
  for (let slot = 1; slot <= MAX_PLACES; slot += 1) {
    const house = readString(config[`house_${slot}`]) || null;
    const address = readString(config[`address_${slot}`]).replace(/\s+/g, ' ') || null;
    if (house || address) {
      places.push({ slot, house, address });
    }
  }
  return {
    places,
    interval: readInterval(config.interval),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_PLACES,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  INTERVALS,
  DEFAULT_INTERVAL,
  normalizeConfig,
  readLanguage,
  readInterval,
};
