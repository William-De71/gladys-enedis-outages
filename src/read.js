// -----------------------------------------------------------------------------
// Answers of the Enedis outage service -> plain outages (pure logic, no I/O).
//
// An outage of `resultMegacache.listeCoupuresInfoReseau`:
//   {
//     "idCoupure": "PESIT20261113163115.59947",   stable id of the outage
//     "etatCoupure": "En cours",                  state
//     "coupureClose": false,                      closed (power restored)
//     "incidentCoupure": "Incident HTA",          Incident BT / HTA, Travaux
//                                                 BT / HTA, Délestage,
//                                                 Coupure clôturée
//     "dateCoupure": "13/11/2026 16:30",          start, Paris time
//     "dateRealimentation": "14/11/2026 01:30",   estimated restoration
//     "nbFoyersCoupes": 0,                        households (often 0)
//     "codeInsee": "75111",                       commune (or arrondissement)
//     "listeAdresses": [
//       { "localisation": "14 PASSAGE CHARLES DALLERY , PARIS (75011)",
//         "nbFoyersCoupes": 0 }
//     ]
//   }
// BT is the low-voltage network (a street, a few buildings), HTA the
// medium-voltage one (a district, several streets: its addresses are often
// the names of transformer substations).
//
// `resultMegacache.listeCrises`: `{ titreCrise, messageLong }` during an
// exceptional event (storm…), when Enedis no longer lists every outage.
//
// For Paris, Lyon and Marseille, Enedis answers for the whole city whatever
// arrondissement is asked: the outages are kept for the arrondissement of the
// place only (or all of them when the place is the whole city).
// -----------------------------------------------------------------------------

import { parseEnedisDate } from './time.js';

const KINDS = ['incident', 'works', 'shedding', 'other'];
const NETWORKS = ['BT', 'HTA'];
const MAX_ADDRESSES = 30;

// Cities split into arrondissements: the code of the whole city -> those of
// its arrondissements.
const ARRONDISSEMENTS = {
  75056: /^751(0[1-9]|1\d|20)$/,
  69123: /^6938[1-9]$/,
  13055: /^132(0[1-9]|1[0-6])$/,
};

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

/**
 * @description The kind of an outage, from the label of Enedis.
 * @param {string|null} label - `incidentCoupure`.
 * @returns {string} incident, works, shedding or other.
 * @example
 * kindOf('Travaux BT'); // -> 'works'
 */
function kindOf(label) {
  const value = String(label ?? '').toLowerCase();
  if (value.includes('incident')) {
    return 'incident';
  }
  if (value.includes('travaux')) {
    return 'works';
  }
  if (value.includes('délestage') || value.includes('delestage')) {
    return 'shedding';
  }
  return 'other';
}

/**
 * @description The network of an outage: BT (low voltage) or HTA (medium voltage).
 * @param {string|null} label - `incidentCoupure`.
 * @returns {string|null} BT, HTA or null.
 */
function networkOf(label) {
  const value = String(label ?? '').toUpperCase();
  if (/\bHTA\b/.test(value)) {
    return 'HTA';
  }
  return /\bBT\b/.test(value) ? 'BT' : null;
}

/**
 * @description Whether an outage of a commune code belongs to a place.
 * @param {string|null} code - `codeInsee` of the outage.
 * @param {string} insee - The commune (or arrondissement) of the place.
 * @returns {boolean} True when it belongs.
 * @example
 * inCommune('75109', '75056'); // -> true
 */
function inCommune(code, insee) {
  if (!code) {
    return true;
  }
  const value = code.toUpperCase();
  return value === insee || Boolean(ARRONDISSEMENTS[insee]?.test(value));
}

// --- Streets -------------------------------------------------------------------------

// Abbreviations of the Enedis addresses (and of the BAN), to their full word.
const WORDS = {
  ALL: 'ALLEE',
  AV: 'AVENUE',
  AVE: 'AVENUE',
  BD: 'BOULEVARD',
  BLD: 'BOULEVARD',
  BOUL: 'BOULEVARD',
  CHE: 'CHEMIN',
  CHEM: 'CHEMIN',
  CRS: 'COURS',
  FBG: 'FAUBOURG',
  FG: 'FAUBOURG',
  HAM: 'HAMEAU',
  IMP: 'IMPASSE',
  LD: 'LIEUDIT',
  LOT: 'LOTISSEMENT',
  MTE: 'MONTEE',
  PAS: 'PASSAGE',
  PASS: 'PASSAGE',
  PL: 'PLACE',
  PROM: 'PROMENADE',
  QU: 'QUAI',
  R: 'RUE',
  RES: 'RESIDENCE',
  RPT: 'ROND POINT',
  RTE: 'ROUTE',
  SQ: 'SQUARE',
  ST: 'SAINT',
  STE: 'SAINTE',
  TRA: 'TRAVERSE',
  VC: 'VOIE COMMUNALE',
  VLA: 'VILLA',
};
// Kinds of streets and small words: left out of the comparison, which looks
// at the name itself ("Ursulines", "Charles Dallery").
const IGNORED = new Set([
  'ALLEE',
  'AVENUE',
  'BOULEVARD',
  'CHEMIN',
  'COURS',
  'FAUBOURG',
  'HAMEAU',
  'IMPASSE',
  'LIEUDIT',
  'LIEU',
  'DIT',
  'LOTISSEMENT',
  'MONTEE',
  'PASSAGE',
  'PLACE',
  'PROMENADE',
  'QUAI',
  'RUE',
  'RESIDENCE',
  'ROND',
  'POINT',
  'ROUTE',
  'SQUARE',
  'TRAVERSE',
  'VOIE',
  'COMMUNALE',
  'VILLA',
  'ANGLE',
  'DE',
  'DU',
  'DES',
  'LA',
  'LE',
  'LES',
  'L',
  'D',
  'ET',
  'AU',
  'AUX',
]);

/**
 * @description The significant words of a street name: upper case, no
 * accent, abbreviations expanded, numbers, kinds of streets and small words
 * left out.
 * @param {string|null} value - A street or an address.
 * @returns {string[]} The words.
 * @example
 * streetWords('14 PASSAGE CHARLES DALLERY'); // -> ['CHARLES', 'DALLERY']
 */
function streetWords(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .flatMap((word) => (WORDS[word] ?? word).split(' '))
    .filter((word) => word && !/^\d+[A-Z]?$/.test(word) && !IGNORED.has(word));
}

/**
 * @description Whether an Enedis address is on a street: every significant
 * word of the street, in order, among those of the address.
 * @param {string} address - The address, without its commune.
 * @param {string[]} street - streetWords of the street of the place.
 * @returns {boolean} True when it matches.
 * @example
 * onStreet('BD HAUSSMANN', streetWords('Boulevard Haussmann')); // -> true
 */
function onStreet(address, street) {
  if (!street || street.length === 0) {
    return false;
  }
  const words = streetWords(address);
  for (let start = 0; start + street.length <= words.length; start += 1) {
    if (street.every((word, index) => words[start + index] === word)) {
      return true;
    }
  }
  return false;
}

/**
 * @description An address of an outage, without its commune: "BD HAUSSMANN ,
 * PARIS (75009)" -> "BD HAUSSMANN".
 * @param {string} localisation - The `localisation` of Enedis.
 * @returns {string} The address.
 */
function addressText(localisation) {
  const value = String(localisation ?? '').trim();
  const comma = value.lastIndexOf(',');
  const head = comma > 0 && /\(\d{5}\)\s*$/.test(value) ? value.slice(0, comma) : value;
  return head.replace(/\s+/g, ' ').trim();
}

// --- Outages ---------------------------------------------------------------------------

/**
 * @description An outage of the Enedis answer, null when it cannot be used.
 * @param {object} raw - An entry of listeCoupuresInfoReseau.
 * @param {string[]} street - streetWords of the street of the place (empty without one).
 * @returns {object|null} `{ id, label, kind, network, state, closed, startedAt,
 * restorationAt, households, insee, addresses, onStreet }`.
 */
function readOutage(raw, street) {
  const id = text(raw?.idCoupure);
  if (!id) {
    return null;
  }
  const label = text(raw.incidentCoupure);
  const state = text(raw.etatCoupure);
  const addresses = (Array.isArray(raw.listeAdresses) ? raw.listeAdresses : [])
    .map((entry) => ({
      text: addressText(entry?.localisation),
      households: count(entry?.nbFoyersCoupes),
    }))
    .filter((entry) => entry.text)
    .slice(0, MAX_ADDRESSES)
    .map((entry) => ({ ...entry, onStreet: onStreet(entry.text, street) }));
  const closed =
    raw.coupureClose === true || /cl[oô]tur|r[ée]tabli|termin/i.test(`${label} ${state}`);
  return {
    id,
    label,
    kind: kindOf(label),
    network: networkOf(label),
    state,
    closed,
    startedAt: parseEnedisDate(raw.dateCoupure),
    restorationAt: parseEnedisDate(raw.dateRealimentation),
    households: count(raw.nbFoyersCoupes),
    insee: text(raw.codeInsee),
    addresses,
    onStreet: addresses.some((entry) => entry.onStreet),
  };
}

/**
 * @description The outages and crises of a place, from the Enedis answer.
 * @param {object} body - The answer of getOutages.
 * @param {object} place - `{ insee, street }`.
 * @returns {{ outages: object[], crises: object[] }} The outages of the
 * commune (open ones first, by start), and the crises.
 * @example
 * readAnswer(body, { insee: '71270', street: 'Rue des Ursulines' });
 */
function readAnswer(body, place) {
  const result = body?.resultMegacache ?? {};
  const street = streetWords(place.street);
  const seen = new Set();
  const outages = (
    Array.isArray(result.listeCoupuresInfoReseau) ? result.listeCoupuresInfoReseau : []
  )
    .map((raw) => readOutage(raw, street))
    .filter((outage) => {
      if (!outage || seen.has(outage.id) || !inCommune(outage.insee, place.insee)) {
        return false;
      }
      seen.add(outage.id);
      return true;
    })
    .sort(
      (a, b) =>
        Number(a.closed) - Number(b.closed) ||
        (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity) ||
        a.id.localeCompare(b.id),
    );
  const crises = (Array.isArray(result.listeCrises) ? result.listeCrises : [])
    .map((raw) => ({ title: text(raw?.titreCrise), message: text(raw?.messageLong) }))
    .filter((crisis) => crisis.title || crisis.message);
  return { outages, crises };
}

/**
 * @description The outages still in progress.
 * @param {object} snapshot - `{ outages }`.
 * @returns {object[]} The open outages.
 */
const openOutages = (snapshot) => (snapshot?.outages ?? []).filter((outage) => !outage.closed);

/**
 * @description The level of a place: 0 no outage, 1 an outage in the
 * commune, 2 an outage on the street of the place.
 * @param {object} snapshot - `{ outages }`.
 * @returns {number} The level.
 */
function levelOf(snapshot) {
  const open = openOutages(snapshot);
  if (open.some((outage) => outage.onStreet)) {
    return 2;
  }
  return open.length > 0 ? 1 : 0;
}

/**
 * @description The latest estimated restoration of the open outages that
 * matter most (those of the street, or else all of them).
 * @param {object} snapshot - `{ outages }`.
 * @returns {number|null} The instant, in ms.
 */
function restorationOf(snapshot) {
  const open = openOutages(snapshot);
  const street = open.filter((outage) => outage.onStreet);
  const times = (street.length > 0 ? street : open)
    .map((outage) => outage.restorationAt)
    .filter(Number.isFinite);
  return times.length > 0 ? Math.max(...times) : null;
}

export {
  KINDS,
  NETWORKS,
  ARRONDISSEMENTS,
  kindOf,
  networkOf,
  inCommune,
  streetWords,
  onStreet,
  addressText,
  readOutage,
  readAnswer,
  openOutages,
  levelOf,
  restorationOf,
};
