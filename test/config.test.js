import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, readLanguage, readInterval, DEFAULT_INTERVAL } from '../src/config.js';

test('places: a house, an address, or both; empty slots left out', () => {
  const config = normalizeConfig({
    house_1: 'maison',
    address_2: '  12 rue   des Ursulines\n71000 Mâcon ',
    house_3: '',
    address_3: ' ',
  });
  assert.deepEqual(config.places, [
    { slot: 1, house: 'maison', address: null },
    { slot: 2, house: null, address: '12 rue des Ursulines 71000 Mâcon' },
  ]);
  assert.equal(config.interval, DEFAULT_INTERVAL);
  assert.equal(config.language, 'auto');
  assert.deepEqual(normalizeConfig(null).places, []);
});

test('interval: one of the offered values, from a string or a number', () => {
  assert.equal(readInterval('30'), 30);
  assert.equal(readInterval(5), 5);
  assert.equal(readInterval('7'), DEFAULT_INTERVAL);
  assert.equal(readInterval(undefined), DEFAULT_INTERVAL);
});

test('language: a supported one, or automatic; the stored one is read back', () => {
  assert.equal(normalizeConfig({ language: 'de' }).language, 'de');
  assert.equal(normalizeConfig({ language: 'it' }).language, 'auto');
  assert.equal(readLanguage({ last_language: 'fr' }, 'en'), 'fr');
  assert.equal(readLanguage({ last_language: 'french' }, 'en'), 'en');
});
