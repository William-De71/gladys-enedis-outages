import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  placeId,
  placeIdFromExternalId,
  buildPlaceDevice,
  buildPlaceStates,
  situationText,
} from '../src/device.js';
import { readAnswer } from '../src/read.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, rawAnswer, rawOutage, NOW } from './helpers/fixtures.js';

const PLACE = {
  id: '71270-ursulines',
  insee: '71270',
  city: 'Mâcon',
  postcode: '71000',
  district: null,
  street: 'Rue des Ursulines',
};
const snapshot = (outages, crises) => ({
  place: PLACE,
  fetchedAt: NOW,
  ...readAnswer(rawAnswer(outages, crises), PLACE),
});

test('place ids: the INSEE code and the words of the street', () => {
  assert.equal(placeId(PLACE), '71270-ursulines');
  assert.equal(placeId({ insee: '75109', street: 'Boulevard Haussmann' }), '75109-haussmann');
  assert.equal(placeId({ insee: '2A004', street: null }), '2a004');
  assert.equal(placeId({ insee: '71270', street: '14 Rue de la Paix' }), '71270-paix');
  assert.equal(
    placeIdFromExternalId('ext:enedis-outages:place:71270-ursulines:status'),
    '71270-ursulines',
  );
  assert.equal(placeIdFromExternalId('ext:enedis-outages:place:2a004'), '2a004');
  assert.equal(placeIdFromExternalId(undefined), null);
});

test('one device per place, in every language (host API checks: app.test.js)', () => {
  for (const language of LANGUAGES) {
    const device = buildPlaceDevice(fakeGladys, PLACE, language);
    assert.equal(device.external_id, 'ext:enedis-outages:place:71270-ursulines');
    assert.equal(device.should_poll, false);
    assert.equal(device.features.length, 3);
  }
  assert.equal(buildPlaceDevice(fakeGladys, PLACE, 'fr').name, 'Enedis Rue des Ursulines, Mâcon');
  assert.equal(buildPlaceDevice(fakeGladys, { ...PLACE, street: null }, 'fr').name, 'Enedis Mâcon');
});

test('states: level, count and situation', () => {
  const states = (s) =>
    Object.fromEntries(
      buildPlaceStates(fakeGladys, s, 'fr', NOW).map((state) => [
        state.device_feature_external_id.split(':').pop(),
        state.state ?? state.text,
      ]),
    );
  assert.deepEqual(states(snapshot([])), {
    status: 0,
    outages: 0,
    situation: 'Aucune coupure en cours.',
  });
  assert.deepEqual(states(snapshot([rawOutage()])), {
    status: 2,
    outages: 1,
    situation: 'Coupure dans votre rue (1 dans la commune). Rétablissement prévu vers 14/11 01:30.',
  });
  assert.match(situationText(snapshot([], [{ titreCrise: 'Tempête' }]), 'en'), /Exceptional event/);
});
