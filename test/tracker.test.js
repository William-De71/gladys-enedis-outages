import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diffPlace, SCENE_TRIGGERS } from '../src/tracker.js';
import { readAnswer } from '../src/read.js';
import { rawAnswer, rawOutage } from './helpers/fixtures.js';

const PLACE = { insee: '71270', street: 'Rue des Ursulines' };
const snap = (outages, crises = []) => readAnswer(rawAnswer(outages, crises), PLACE);
const keys = (events) => events.map((event) => event.key);

test('the first snapshot of a place is a baseline', () => {
  assert.deepEqual(diffPlace(undefined, snap([rawOutage()])), []);
});

test('a new outage starts, a closed or vanished one ends', () => {
  const started = diffPlace(snap([]), snap([rawOutage({ id: 'A' })]));
  assert.deepEqual(keys(started), [SCENE_TRIGGERS.OUTAGE_STARTED]);
  assert.equal(started[0].outage.id, 'A');

  const closed = diffPlace(
    snap([rawOutage({ id: 'A' })]),
    snap([rawOutage({ id: 'A', closed: true })]),
  );
  assert.deepEqual(keys(closed), [SCENE_TRIGGERS.OUTAGE_ENDED]);

  const vanished = diffPlace(snap([rawOutage({ id: 'A' })]), snap([]));
  assert.deepEqual(keys(vanished), [SCENE_TRIGGERS.OUTAGE_ENDED]);
  assert.equal(vanished[0].vanished, true);

  assert.deepEqual(
    diffPlace(snap([rawOutage({ id: 'A', closed: true })]), snap([])),
    [],
    'a closed outage that disappears ends nothing',
  );
  assert.deepEqual(
    diffPlace(snap([]), snap([rawOutage({ id: 'A', closed: true })])),
    [],
    'an outage already closed when first seen starts nothing',
  );
});

test('a moved restoration fires once, a same one never', () => {
  const before = snap([rawOutage({ end: '14/11/2026 01:30' })]);
  assert.deepEqual(diffPlace(before, snap([rawOutage({ end: '14/11/2026 01:30' })])), []);
  const moved = diffPlace(before, snap([rawOutage({ end: '14/11/2026 03:00' })]));
  assert.deepEqual(keys(moved), [SCENE_TRIGGERS.RESTORATION_CHANGED]);
  assert.equal(moved[0].previous, Date.parse('2026-11-14T00:30:00Z'));
  assert.deepEqual(diffPlace(before, snap([rawOutage({ end: '' })])), [], 'no new estimate');
});

test('an exceptional event starts and ends', () => {
  const crisis = [{ titreCrise: 'Tempête', messageLong: 'Mobilisés' }];
  const started = diffPlace(snap([]), snap([], crisis));
  assert.deepEqual(
    started.map((event) => [event.key, event.state, event.crisis.title]),
    [[SCENE_TRIGGERS.CRISIS_CHANGED, 'started', 'Tempête']],
  );
  const ended = diffPlace(snap([], crisis), snap([]));
  assert.equal(ended[0].state, 'ended');
});
