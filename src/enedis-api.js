// -----------------------------------------------------------------------------
// Client of the outage map of enedis.fr ("Panne et interruption").
//
// Enedis publishes no open API for its outages in progress. The public page
// https://www.enedis.fr/resultat-panne-interruption reads them, for a commune,
// from a JSON answer of the site itself, with no account and no key:
//
//   GET https://www.enedis.fr/panne-interruption-ajax
//       ?insee=71270&type=municipality&adresse=Mâcon&CPVille=Mâcon 71000
//       &name=Mâcon&district=&city=Mâcon
//
// `name` and `city` are required (400 without them). It answers
//   - 200 with `resultMegacache.listeCoupuresInfoReseau` (the outages of the
//     commune, see read.js), `listeCrises` (an exceptional event: storm…),
//     and `noCoupure: "true"` when there is none;
//   - 200 with `errorMegacache: "true"` when the outage service of Enedis is
//     down;
//   - 400 with `errorServices: "true"` for a commune Enedis does not serve
//     (a local distribution company: Strasbourg, Grenoble, Metz…) or does not
//     know.
//
// It is the site's own endpoint, not a documented API: it may change without
// notice. The integration asks once per place and per reading (every 15
// minutes by default), names itself in the User-Agent and keeps its answers.
//
// Every failure becomes an EnedisError with a `kind` the app turns into a
// user message: not_covered, unavailable, blocked, unreachable, unexpected.
// -----------------------------------------------------------------------------

const BASE_URL = 'https://www.enedis.fr';
const PATH = '/panne-interruption-ajax';
const TIMEOUT_MS = 30000;

class EnedisError extends Error {
  /**
   * @description An error of the Enedis outage service.
   * @param {string} kind - not_covered, unavailable, blocked, unreachable or unexpected.
   * @param {string} message - What failed.
   * @param {number} [status] - The HTTP status, when there was an answer.
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'EnedisError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description The query of a place, the way the Enedis page sends it.
 * @param {object} place - `{ insee, city, postcode, district }`.
 * @returns {URLSearchParams} The query.
 * @example
 * outageQuery({ insee: '71270', city: 'Mâcon', postcode: '71000' }).toString();
 */
function outageQuery(place) {
  const city = place.city ?? place.insee;
  return new URLSearchParams({
    insee: place.insee,
    type: 'municipality',
    adresse: city,
    CPVille: place.postcode ? `${city} ${place.postcode}` : city,
    name: city,
    district: place.district ?? '',
    city,
  });
}

/**
 * @description Create an Enedis client.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - fetch implementation (tests).
 * @param {string} [options.userAgent] - User-Agent header.
 * @param {string} [options.baseUrl] - Site root (tests).
 * @returns {{ getOutages: Function }} The client.
 * @example
 * const enedis = createEnedisClient({ userAgent: 'gladys-enedis-outages/0.1.0' });
 * const raw = await enedis.getOutages({ insee: '71270', city: 'Mâcon', postcode: '71000' });
 */
function createEnedisClient({
  fetch = globalThis.fetch,
  userAgent = 'gladys-enedis-outages',
  baseUrl = BASE_URL,
} = {}) {
  /**
   * @description The raw answer of the outage service for a commune.
   * @param {object} place - The place (`insee`, `city`, `postcode`, `district`).
   * @returns {Promise<object>} The JSON answer.
   */
  async function getOutages(place) {
    const label = `Enedis ${place.insee}`;
    let response;
    try {
      response = await fetch(`${baseUrl}${PATH}?${outageQuery(place)}`, {
        headers: { Accept: 'application/json', 'User-Agent': userAgent },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new EnedisError(
        'unreachable',
        `${label}: ${err.name === 'TimeoutError' ? 'timeout' : err.message}`,
      );
    }
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (response.status === 403 || response.status === 429) {
      throw new EnedisError('blocked', `${label}: HTTP ${response.status}`, response.status);
    }
    if (response.status === 400 && body?.errorServices === 'true') {
      throw new EnedisError('not_covered', `${label}: commune not served`, 400);
    }
    if (!response.ok) {
      throw new EnedisError(
        response.status >= 500 ? 'unreachable' : 'unexpected',
        `${label}: HTTP ${response.status}`,
        response.status,
      );
    }
    if (!body || typeof body !== 'object') {
      // An HTML page in place of JSON: an anti-robot challenge most of the time.
      throw new EnedisError('blocked', `${label}: the answer is not JSON`, response.status);
    }
    if (body.errorMegacache === 'true' || body.errorServices === 'true') {
      throw new EnedisError('unavailable', `${label}: the outage service is down`, response.status);
    }
    if (!body.resultMegacache || typeof body.resultMegacache !== 'object') {
      throw new EnedisError('unexpected', `${label}: no outage list`, response.status);
    }
    return body;
  }

  return { getOutages };
}

export { BASE_URL, PATH, EnedisError, outageQuery, createEnedisClient };
