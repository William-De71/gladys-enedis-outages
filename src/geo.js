// -----------------------------------------------------------------------------
// Addresses, from the geocoding service of the Géoplateforme (IGN, the French
// national mapping agency): https://data.geopf.fr/geocodage, the Base Adresse
// Nationale, open, no key, no account.
//
// A place of the configuration becomes a commune (its INSEE code is what
// Enedis is asked about) and, when known, a street (to tell an outage on the
// user's street from one elsewhere in the commune), in one of these ways:
//   - an address typed by hand ("12 rue des Ursulines 71000 Mâcon"), or only
//     a commune ("Mâcon", "71000"): GET /search;
//   - the coordinates of a house of Gladys: GET /reverse, the nearest address.
//
// Paris, Lyon and Marseille: the service gives the code of the arrondissement
// (75109 for Paris 9e), Enedis files its outages under it.
// -----------------------------------------------------------------------------

const GEO_URL = 'https://data.geopf.fr/geocodage';
const TIMEOUT_MS = 15000;

class GeoError extends Error {
  /**
   * @description An address that could not be found.
   * @param {string} kind - `not_found` or `unreachable`.
   * @param {string} message - The detail.
   */
  constructor(kind, message) {
    super(message);
    this.name = 'GeoError';
    this.kind = kind;
  }
}

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * @description A feature of the geocoder as the integration keeps it.
 * @param {object} feature - A GeoJSON feature of /search or /reverse.
 * @returns {object|null} `{ insee, city, postcode, district, street, label,
 * kind, latitude, longitude }`, null without an INSEE code.
 * @example
 * toPlace({ properties: { citycode: '71270', city: 'Mâcon', type: 'municipality' } });
 */
function toPlace(feature) {
  const properties = feature?.properties ?? {};
  const insee = text(properties.citycode);
  if (!insee || !/^(\d{5}|2[AB]\d{3})$/i.test(insee)) {
    return null;
  }
  const kind = text(properties.type) ?? 'municipality';
  // A street of a housenumber, or the street (or lieu-dit) itself.
  const street =
    text(properties.street) ??
    (['street', 'locality'].includes(kind) ? text(properties.name) : null);
  const [longitude, latitude] = Array.isArray(feature?.geometry?.coordinates)
    ? feature.geometry.coordinates.map(Number)
    : [NaN, NaN];
  const city = text(properties.city) ?? text(properties.municipality) ?? insee;
  return {
    insee: insee.toUpperCase(),
    city,
    postcode: text(properties.postcode),
    district: text(properties.district),
    street: kind === 'municipality' ? null : street,
    label: text(properties.label) ?? city,
    kind,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

/**
 * @description A client of the Géoplateforme geocoder.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {string} [options.userAgent] - User-Agent header.
 * @returns {{ search: Function, reverse: Function }} The client.
 */
function createGeoClient({ fetch: fetchFn = globalThis.fetch, userAgent } = {}) {
  /**
   * @description GET a path of the service.
   * @param {string} path - The path and query.
   * @returns {Promise<object[]>} The features.
   */
  async function features(path) {
    let response;
    try {
      response = await fetchFn(`${GEO_URL}${path}`, {
        headers: { Accept: 'application/json', ...(userAgent ? { 'User-Agent': userAgent } : {}) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new GeoError('unreachable', `Géoplateforme: ${err.message}`);
    }
    if (response.status === 400) {
      return [];
    }
    if (!response.ok) {
      throw new GeoError('unreachable', `Géoplateforme: HTTP ${response.status}`);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new GeoError('unreachable', 'Géoplateforme: the answer is not JSON');
    }
    return Array.isArray(body?.features) ? body.features : [];
  }

  /**
   * @description The place an address (or a commune) names.
   * @param {string} query - What the user typed.
   * @returns {Promise<object>} The place.
   */
  async function search(query) {
    const q = String(query ?? '').trim();
    // The service wants at least 3 characters, and a letter or a digit first.
    if (q.length < 3) {
      throw new GeoError('not_found', q);
    }
    const found = await features(`/search?q=${encodeURIComponent(q.slice(0, 200))}&limit=1`);
    const place = toPlace(found[0]);
    if (!place) {
      throw new GeoError('not_found', q);
    }
    return place;
  }

  /**
   * @description The nearest address to a point.
   * @param {number} latitude - Latitude.
   * @param {number} longitude - Longitude.
   * @returns {Promise<object>} The place (the coordinates of the house kept).
   */
  async function reverse(latitude, longitude) {
    const found = await features(
      `/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&limit=1`,
    );
    const place = toPlace(found[0]);
    if (!place) {
      throw new GeoError('not_found', `${latitude}, ${longitude}`);
    }
    return { ...place, latitude, longitude };
  }

  return { search, reverse };
}

export { GEO_URL, GeoError, toPlace, createGeoClient };
