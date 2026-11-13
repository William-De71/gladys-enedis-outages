import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEnedisClient, outageQuery, EnedisError } from '../src/enedis-api.js';
import { createGeoClient, toPlace } from '../src/geo.js';
import { fakeWeb, rawAnswer, rawOutage, MACON_STREET, PARIS_9 } from './helpers/fixtures.js';

const MACON = { insee: '71270', city: 'Mâcon', postcode: '71000', district: null };

test('the query of a place mirrors the one of the Enedis page', () => {
  assert.deepEqual(Object.fromEntries(outageQuery(MACON)), {
    insee: '71270',
    type: 'municipality',
    adresse: 'Mâcon',
    CPVille: 'Mâcon 71000',
    name: 'Mâcon',
    district: '',
    city: 'Mâcon',
  });
});

test('an answer is returned with the User-Agent of the integration', async () => {
  const fetch = fakeWeb({ answers: { 71270: rawAnswer([rawOutage()]) } });
  const enedis = createEnedisClient({ fetch, userAgent: 'gladys-enedis-outages/test' });
  const body = await enedis.getOutages(MACON);
  assert.equal(body.resultMegacache.listeCoupuresInfoReseau.length, 1);
  assert.equal(fetch.calls[0].headers['User-Agent'], 'gladys-enedis-outages/test');
});

test('failures have a kind', async () => {
  const cases = [
    [{ answers: {} }, 'not_covered'],
    [{ failure: 'down' }, 'unavailable'],
    [{ failure: 403 }, 'blocked'],
    [{ failure: 429 }, 'blocked'],
    [{ failure: 'html' }, 'blocked'],
    [{ failure: 502 }, 'unreachable'],
    [{ failure: 'network' }, 'unreachable'],
    [{ failure: 404 }, 'unexpected'],
  ];
  for (const [state, kind] of cases) {
    const enedis = createEnedisClient({ fetch: fakeWeb(state) });
    await assert.rejects(enedis.getOutages(MACON), (err) => {
      assert.ok(err instanceof EnedisError);
      assert.equal(err.kind, kind, JSON.stringify(state));
      return true;
    });
  }
});

test('the geocoder gives the commune and the street', async () => {
  const geo = createGeoClient({ fetch: fakeWeb() });
  const found = await geo.search('20 rue des Ursulines 71000 Mâcon');
  assert.equal(found.insee, '71270');
  assert.equal(found.street, 'Rue des Ursulines');
  const commune = await geo.search('Mâcon');
  assert.equal(commune.street, null);
  const house = await geo.reverse(46.3, 4.83);
  assert.equal(house.street, 'Rue des Ursulines');
  assert.equal(house.latitude, 46.3, 'the coordinates of the house are kept');
  await assert.rejects(geo.search('Nowhere at all'), { name: 'GeoError', kind: 'not_found' });
  await assert.rejects(geo.search('ab'), { kind: 'not_found' });
  const down = createGeoClient({ fetch: fakeWeb({ geoFailure: 503 }) });
  await assert.rejects(down.search('Mâcon'), { kind: 'unreachable' });
});

test('geocoder features: arrondissement, street, lieu-dit', () => {
  assert.equal(toPlace(PARIS_9).insee, '75109');
  assert.equal(toPlace(PARIS_9).district, 'Paris 9e Arrondissement');
  assert.equal(toPlace(MACON_STREET).kind, 'housenumber');
  assert.equal(
    toPlace({ properties: { type: 'locality', name: 'Les Chaumes', citycode: '71001' } }).street,
    'Les Chaumes',
  );
  assert.equal(toPlace({ properties: { type: 'municipality', citycode: 'x' } }), null);
  assert.equal(toPlace(undefined), null);
});
