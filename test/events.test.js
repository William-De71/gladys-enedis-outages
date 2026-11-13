import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPlaceEvent, buildPlaceOutputs } from '../src/events.js';
import { diffPlace } from '../src/tracker.js';
import { readAnswer } from '../src/read.js';
import { fakeGladys, rawAnswer, rawOutage, NOW, HOUR } from './helpers/fixtures.js';

const PLACE = { id: '71270-ursulines', insee: '71270', city: 'Mâcon', street: 'Rue des Ursulines' };
const snap = (outages, crises = []) => ({
  place: PLACE,
  fetchedAt: NOW,
  ...readAnswer(rawAnswer(outages, crises), PLACE),
});
const event = (before, after, language = 'fr') =>
  diffPlace(before, after).map((e) => buildPlaceEvent(fakeGladys, after, e, language, NOW));

test('outage_started: flat values, the scope and the kind of the filters', () => {
  const [{ key, data }] = event(snap([]), snap([rawOutage({ label: 'Incident HTA' })]));
  assert.equal(key, 'outage_started');
  assert.equal(data.device, 'ext:enedis-outages:place:71270-ursulines');
  assert.equal(data.device_name, 'Enedis Rue des Ursulines, Mâcon');
  assert.equal(data.scope, 'street');
  assert.equal(data.kind, 'incident');
  assert.equal(data.network, 'HTA');
  assert.equal(data.on_my_street, true);
  assert.equal(data.streets, 'RUE DES URSULINES, RUE GAMBETTA');
  assert.equal(data.started_at, '2026-11-13T20:40:00.000Z');
  assert.equal(data.restoration_at, '2026-11-14T00:30:00.000Z');
  assert.equal(
    data.summary,
    'Enedis Rue des Ursulines, Mâcon : coupure de courant, Incident (moyenne tension). Dans votre rue : RUE DES URSULINES, RUE GAMBETTA. Rétablissement prévu vers 14/11 01:30.',
  );
  for (const value of Object.values(data)) {
    assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
  }
});

test('outage_ended carries the duration; elsewhere in the commune is "commune"', () => {
  const other = rawOutage({ addresses: ['RUE GAMBETTA , MACON (71000)'] });
  const [{ key, data }] = event(snap([other]), snap([]), 'en');
  assert.equal(key, 'outage_ended');
  assert.equal(data.scope, 'commune');
  assert.equal(data.duration_minutes, 80);
  assert.match(data.summary, /power is back/);
});

test('restoration_changed says postponed or advanced, by how much', () => {
  const [{ data }] = event(
    snap([rawOutage({ end: '14/11/2026 01:30' })]),
    snap([rawOutage({ end: '14/11/2026 03:00' })]),
  );
  assert.equal(data.change, 'postponed');
  assert.equal(data.shift_minutes, 90);
  assert.equal(data.previous_restoration_at, '2026-11-14T00:30:00.000Z');
  assert.match(data.summary, /repoussé à 14\/11 03:00 \(au lieu de 14\/11 01:30\)/);
});

test('crisis_changed: started and ended, with the message of Enedis', () => {
  const crisis = [{ titreCrise: 'Tempête Ciarán', messageLong: 'Nos équipes sont mobilisées.' }];
  const [{ data }] = event(snap([]), snap([], crisis));
  assert.equal(data.state, 'started');
  assert.equal(data.title, 'Tempête Ciarán');
  assert.equal(data.message, 'Nos équipes sont mobilisées.');
});

test('get_outages outputs, with and without an outage', () => {
  const none = buildPlaceOutputs(snap([]), 'fr', NOW);
  assert.deepEqual(none, {
    has_outage: false,
    on_my_street: false,
    level: 0,
    outages: 0,
    restoration_at: '',
    restoration: '',
    streets: '',
    crisis: false,
    summary: 'Enedis Rue des Ursulines, Mâcon : Aucune coupure en cours.',
  });
  const cut = buildPlaceOutputs(snap([rawOutage()]), 'en', NOW + 2 * HOUR);
  assert.equal(cut.has_outage, true);
  assert.equal(cut.on_my_street, true);
  assert.equal(cut.level, 2);
  assert.equal(cut.restoration, '01:30', 'today: the time only');
  assert.equal(cut.streets, 'RUE DES URSULINES, RUE GAMBETTA');
});
