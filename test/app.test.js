// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices and the states like the host API does, and a fake of enedis.fr and
// of the Géoplateforme geocoder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { fakeWeb, rawAnswer, rawOutage, silent, noSleep, NOW, HOUSE } from './helpers/fixtures.js';

const STREET = 'ext:test-integration:place:71270-ursulines';
const PARIS = 'ext:test-integration:place:75109-haussmann';

/**
 * @description The integration, connected to a fake Gladys and a fake web.
 * @param {object} [options] - `{ config, web, houses }`.
 * @returns {Promise<object>} `{ gladys, app, fetch, clock }`.
 */
async function startApp({ config = { house_1: 'maison' }, web = {}, houses = [HOUSE] } = {}) {
  const fetch = fakeWeb(web);
  const clock = { now: NOW };
  const gladys = createFakeGladys({ config, houses });
  const app = createApp(gladys, {
    fetchImpl: fetch,
    now: () => clock.now,
    sleep: noSleep,
    logger: silent,
  });
  await gladys.connect();
  return { gladys, app, fetch, clock };
}

const enedisCalls = (fetch) => fetch.calls.filter((call) => call.host === 'www.enedis.fr');
const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  await gladys.fake.deviceCreated(device);
  return device;
};
const widget = async (gladys, options) =>
  (await gladys.fake.widgetGet(WIDGETS.OUTAGES, options)).data.content;
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);

test('a house becomes a place with its street, offered after one request', async (t) => {
  const { gladys, fetch, app } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(enedisCalls(fetch).length, 1);
  assert.equal(enedisCalls(fetch)[0].query.get('insee'), '71270');
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [[STREET, 'Enedis Rue des Ursulines, Mâcon']],
  );
  assert.equal(app.places()[0].street, 'Rue des Ursulines');
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.fr, /1 lieu/);
});

test('three places: typed addresses win, duplicates count once, pauses between them', async (t) => {
  const fetch = fakeWeb();
  const pauses = [];
  const gladys = createFakeGladys({
    config: {
      house_1: 'maison',
      address_1: '40 Boulevard Haussmann Paris',
      address_2: '20 rue des Ursulines 71000 Mâcon',
      house_3: 'maison',
    },
    houses: [HOUSE],
  });
  const app = createApp(gladys, {
    fetchImpl: fetch,
    now: () => NOW,
    sleep: async (ms) => pauses.push(ms),
    logger: silent,
  });
  await gladys.connect();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    app.places().map((place) => place.id),
    ['75109-haussmann', '71270-ursulines'],
  );
  assert.equal(enedisCalls(fetch).length, 2);
  assert.deepEqual(pauses, [1500]);
});

test('creating a device publishes its states, then only what changed', async (t) => {
  const { gladys, app, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, STREET);
  assert.equal(gladys.fake.lastState(`${STREET}:status`), 0);
  assert.equal(gladys.fake.lastState(`${STREET}:outages`), 0);
  assert.equal(gladys.fake.lastState(`${STREET}:situation`), 'No outage in progress.');
  const sent = gladys.fake.states.length;

  await app.watcher.round();
  assert.equal(gladys.fake.states.length, sent, 'same answer, nothing sent again');

  fetch.state.answers[71270] = rawAnswer([rawOutage()]);
  await app.watcher.round();
  assert.equal(gladys.fake.lastState(`${STREET}:status`), 2);
  assert.equal(gladys.fake.lastState(`${STREET}:outages`), 1);
  assert.match(gladys.fake.lastState(`${STREET}:situation`), /^Outage on your street/);
});

test('an outage starts, its restoration moves, the power comes back: one event each', async (t) => {
  const { gladys, app, fetch } = await startApp({
    web: { answers: { 71270: rawAnswer([rawOutage({ id: 'OLD' })]) } },
  });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first reading is a baseline');

  fetch.state.answers[71270] = rawAnswer([rawOutage({ id: 'OLD' }), rawOutage({ id: 'NEW' })]);
  await app.watcher.round();
  const [started] = eventsOf(gladys, 'outage_started');
  assert.equal(started.data.device, STREET);
  assert.equal(started.data.outage_id, 'NEW');
  assert.equal(started.data.scope, 'street');

  fetch.state.answers[71270] = rawAnswer([
    rawOutage({ id: 'OLD' }),
    rawOutage({ id: 'NEW', end: '14/11/2026 04:00' }),
  ]);
  await app.watcher.round();
  assert.equal(eventsOf(gladys, 'restoration_changed')[0].data.change, 'postponed');

  fetch.state.answers[71270] = rawAnswer([rawOutage({ id: 'OLD' })]);
  await app.watcher.round();
  assert.equal(eventsOf(gladys, 'outage_ended')[0].data.outage_id, 'NEW');
  await app.watcher.round();
  assert.equal(gladys.fake.sceneEvents.length, 3, 'nothing new, nothing fired');
});

test('failures are reported, the last snapshot is kept, then the recovery', async (t) => {
  const { gladys, app, fetch } = await startApp({
    web: { answers: { 71270: rawAnswer([rawOutage()]) } },
  });
  t.after(() => gladys.fake.shutdown());
  await created(gladys, STREET);
  fetch.state.failure = 'down';
  await app.watcher.round();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /indisponible/);
  assert.equal(app.watcher.snapshots().length, 1, 'the last snapshot is kept');
  assert.equal(gladys.fake.sceneEvents.length, 0, 'a failure is not an end of outage');
  fetch.state.failure = 403;
  await app.watcher.round();
  assert.match(gladys.fake.connectionStatus.message.en, /protection against robots/);
  fetch.state.failure = null;
  await app.watcher.round();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('a commune Enedis does not serve, an unknown address, a house without a position', async (t) => {
  const { gladys } = await startApp({
    config: { address_1: 'Strasbourg', address_2: 'Nowhere at all', house_3: 'chalet' },
    houses: [{ ...HOUSE, selector: 'chalet', name: 'Chalet', latitude: null, longitude: null }],
  });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /« Nowhere at all »/);
  assert.equal(gladys.fake.discoveredDevices.length, 0, 'Strasbourg is found, not offered');
  const ack = await gladys.fake.action(ACTIONS.CHECK_PLACES);
  const text = JSON.stringify(ack.data);
  assert.match(text, /"Strasbourg \(INSEE 67482\) : Enedis ne dessert pas cette commune/);
  assert.match(text, /La maison « Chalet » n’a pas de position/);
});

test('a geocoder that does not answer is asked again at the next round', async (t) => {
  const { gladys, app, fetch } = await startApp({ web: { geoFailure: 'network' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(app.places().length, 0);
  assert.match(gladys.fake.connectionStatus.message.en, /Géoplateforme/);
  fetch.state.geoFailure = null;
  await app.watcher.round();
  assert.equal(app.places().length, 1);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('without a place: nothing is read and the user is told what to do', async (t) => {
  const { gladys, fetch } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  assert.equal(fetch.calls.length, 0);
  assert.match(gladys.fake.connectionStatus.message.fr, /Choisissez une maison/);
  const content = await widget(gladys, { language: 'en' });
  assert.match(content.components[0].text, /Choose a house/);
});

test('the widget reads the snapshots, never Enedis', async (t) => {
  const { gladys, fetch } = await startApp({
    config: { house_1: 'maison', address_2: '40 Boulevard Haussmann Paris' },
    web: {
      answers: {
        71270: rawAnswer(),
        75109: rawAnswer([
          rawOutage({ insee: '75109', addresses: ['BD HAUSSMANN , PARIS (75009)'] }),
          rawOutage({ id: 'OTHER', insee: '75111' }),
        ]),
      },
    },
  });
  t.after(() => gladys.fake.shutdown());
  const calls = fetch.calls.length;
  const first = await widget(gladys, { language: 'fr', settings: {} });
  assert.deepEqual(validateWidgetContent(first), []);
  assert.match(first.components[0].text, /^Rue des Ursulines, Mâcon/);
  const paris = await widget(gladys, { language: 'fr', settings: { device: PARIS } });
  assert.deepEqual(validateWidgetContent(paris), []);
  const cards = paris.components.find((c) => c.type === 'card-list').items;
  assert.deepEqual(
    cards.map((card) => card.title),
    ['BD HAUSSMANN'],
    'only the outages of the 9th arrondissement',
  );
  assert.equal(fetch.calls.length, calls, 'a widget never costs a request');
});

test('get_outages answers from a fresh reading, or reads Enedis when it is old', async (t) => {
  const { gladys, fetch, clock } = await startApp({
    web: { answers: { 71270: rawAnswer([rawOutage()]) } },
  });
  t.after(() => gladys.fake.shutdown());
  const calls = enedisCalls(fetch).length;
  const first = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_OUTAGES, {})).data.outputs;
  assert.equal(first.on_my_street, true);
  assert.equal(enedisCalls(fetch).length, calls, 'fresh snapshot reused');

  clock.now = NOW + 10 * 60000;
  fetch.state.answers[71270] = rawAnswer();
  const later = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_OUTAGES, { device: STREET })).data
    .outputs;
  assert.equal(later.has_outage, false);
  assert.equal(enedisCalls(fetch).length, calls + 1);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'a scene action never fires a trigger');
});

test('a new address is a new baseline and the new interval applies', async (t) => {
  const { gladys, app, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  fetch.state.answers[75109] = rawAnswer([rawOutage({ insee: '75109' })]);
  await gladys.fake.configUpdated({ address_1: '40 Boulevard Haussmann Paris', interval: '30' });
  assert.equal(app.getConfig().interval, 30);
  assert.deepEqual(
    app.places().map((place) => place.id),
    ['75109-haussmann'],
  );
  assert.equal(gladys.fake.sceneEvents.length, 0, 'another place replays nothing');
});
