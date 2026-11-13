// Shapes of the answers of the Enedis outage map (recorded on
// www.enedis.fr/panne-interruption-ajax in November 2026) and of the
// Géoplateforme geocoder, a fake of both behind one fetch, and a stand-in for
// the SDK external ids.

export const NOW = Date.parse('2026-11-13T22:00:00Z'); // 23:00 in Paris
export const HOUR = 3600000;

/**
 * @description An outage of listeCoupuresInfoReseau.
 * @param {object} [options] - Overrides.
 * @returns {object} The outage.
 */
export function rawOutage({
  id = 'PESIT20261113171355.63113',
  label = 'Incident BT',
  state = 'En cours',
  closed = false,
  start = '13/11/2026 21:40',
  end = '14/11/2026 01:30',
  insee = '71270',
  addresses = ['RUE DES URSULINES , MACON (71000)', 'RUE GAMBETTA , MACON (71000)'],
  households = 0,
} = {}) {
  return {
    coupureClose: closed,
    listeAdresses: addresses.map((localisation) => ({ localisation, nbFoyersCoupes: 0 })),
    idCoupure: id,
    etatCoupure: state,
    dateRealimentation: end,
    dateCoupure: start,
    incidentCoupure: label,
    nbFoyersCoupes: households,
    etatElectrique: 7,
    codeInsee: insee,
  };
}

/**
 * @description An answer of the outage service for a commune.
 * @param {object[]} outages - Raw outages.
 * @param {object[]} [crises] - Raw crises.
 * @returns {object} The answer.
 */
export function rawAnswer(outages = [], crises = []) {
  return {
    ...(outages.length === 0 ? { noCoupure: 'true', errorMegacache: 'false' } : {}),
    resultMegacache: {
      listeCoupuresInfoReseau: outages,
      codeRetour: 0,
      compteurIncidentHTA: 0,
      listeCrises: crises,
      compteurBT: 0,
      compteurTravauxHTA: 0,
      recap: { coupures: [], crises: [] },
    },
    streetNotFound: 'false',
    polygon: { type: 'FeatureCollection', features: [] },
  };
}

// Places the fake geocoder knows: by query, and by coordinates.
export const MACON_STREET = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [4.8325, 46.3069] },
  properties: {
    type: 'housenumber',
    label: '20 Rue des Ursulines 71000 Mâcon',
    name: '20 Rue des Ursulines',
    street: 'Rue des Ursulines',
    postcode: '71000',
    citycode: '71270',
    city: 'Mâcon',
  },
};
export const MACON = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [4.83, 46.31] },
  properties: {
    type: 'municipality',
    label: 'Mâcon',
    name: 'Mâcon',
    postcode: '71000',
    citycode: '71270',
    city: 'Mâcon',
  },
};
export const PARIS_9 = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [2.335, 48.873] },
  properties: {
    type: 'housenumber',
    label: '40 Boulevard Haussmann 75009 Paris',
    name: '40 Boulevard Haussmann',
    street: 'Boulevard Haussmann',
    postcode: '75009',
    citycode: '75109',
    city: 'Paris',
    district: 'Paris 9e Arrondissement',
  },
};
export const STRASBOURG = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [7.75, 48.58] },
  properties: {
    type: 'municipality',
    label: 'Strasbourg',
    name: 'Strasbourg',
    postcode: '67000',
    citycode: '67482',
    city: 'Strasbourg',
  },
};

export const HOUSE = {
  id: 'h1',
  name: 'Maison',
  selector: 'maison',
  latitude: 46.3069,
  longitude: 4.8325,
};

/**
 * @description A fake of enedis.fr and of the Géoplateforme geocoder, from an
 * editable state. Records every call in `fetch.calls`.
 * @param {object} [state] - `{ answers: { insee: answer }, failure, geoFailure,
 * search: { query: feature }, reverse: feature }`.
 * @returns {Function} The fetch, with `.state` and `.calls`.
 */
export function fakeWeb(state = {}) {
  const web = {
    answers: { 71270: rawAnswer(), 75109: rawAnswer() },
    failure: null,
    geoFailure: null,
    search: {
      'mâcon 71000': MACON,
      mâcon: MACON,
      '20 rue des ursulines 71000 mâcon': MACON_STREET,
      '40 boulevard haussmann paris': PARIS_9,
      strasbourg: STRASBOURG,
    },
    reverse: MACON_STREET,
    ...state,
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const fetch = async (url, init = {}) => {
    const { hostname, pathname, searchParams } = new URL(url);
    fetch.calls.push({
      host: hostname,
      path: pathname,
      query: searchParams,
      headers: init.headers,
    });
    if (hostname === 'data.geopf.fr') {
      if (web.geoFailure === 'network') {
        throw new TypeError('fetch failed');
      }
      if (web.geoFailure) {
        return json({ message: 'failure' }, web.geoFailure);
      }
      if (pathname === '/geocodage/search') {
        const found = web.search[searchParams.get('q').toLowerCase()];
        return json({ type: 'FeatureCollection', features: found ? [found] : [] });
      }
      if (pathname === '/geocodage/reverse') {
        return json({ type: 'FeatureCollection', features: web.reverse ? [web.reverse] : [] });
      }
      return json({ message: 'not found' }, 404);
    }
    if (hostname === 'www.enedis.fr' && pathname === '/panne-interruption-ajax') {
      if (web.failure === 'network') {
        throw new TypeError('fetch failed');
      }
      if (web.failure === 'html') {
        return new Response('<html>challenge</html>', { status: 200 });
      }
      if (typeof web.failure === 'number') {
        return json({ message: 'failure' }, web.failure);
      }
      if (web.failure === 'down') {
        return json({ errorMegacache: 'true', errorServices: 'false', errorEsri: 'false' });
      }
      if (!searchParams.get('name') || !searchParams.get('city')) {
        return json({ errorServices: 'true' }, 400);
      }
      const answer = web.answers[searchParams.get('insee')];
      if (!answer) {
        return json(
          { errorMegacache: 'false', errorServices: 'true', errorEsri: 'false', env: 'prod' },
          400,
        );
      }
      return json(answer);
    }
    return json({ message: 'not found' }, 404);
  };
  fetch.calls = [];
  fetch.state = web;
  return fetch;
}

// The SDK external ids, without a client (selector `enedis-outages`).
export const fakeGladys = {
  externalIds: (type, id) => {
    const device = `ext:enedis-outages:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

export const silent = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
export const noSleep = async () => {};
