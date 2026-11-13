import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildOutagesWidget,
  readOutageSettings,
  messageContent,
  MAX_ITEMS,
} from '../src/widgets.js';
import { readAnswer } from '../src/read.js';
import { LANGUAGES } from '../src/i18n.js';
import { rawAnswer, rawOutage, NOW } from './helpers/fixtures.js';

const PLACE = { id: '71270-ursulines', insee: '71270', city: 'Mâcon', street: 'Rue des Ursulines' };
const snap = (outages, crises = [], place = PLACE) => ({
  place,
  fetchedAt: NOW - 5 * 60000,
  ...readAnswer(rawAnswer(outages, crises), place),
});
const widget = (snapshot, language = 'fr', settings) =>
  buildOutagesWidget({ snapshot, language, now: NOW, pollMinutes: 15, settings });

test('every content is valid for the core, in every language', () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    rawOutage({ id: `O${i}`, addresses: [`RUE ${i} , MACON (71000)`] }),
  );
  const cases = [
    snap([]),
    snap([rawOutage()]),
    snap(many),
    snap([], [{ titreCrise: 'Tempête', messageLong: 'x'.repeat(500) }]),
    snap([rawOutage({ end: '', addresses: [] })], [], { ...PLACE, street: null }),
  ];
  for (const language of LANGUAGES) {
    for (const snapshot of cases) {
      assert.deepEqual(validateWidgetContent(widget(snapshot, language)), [], language);
    }
  }
  assert.deepEqual(validateWidgetContent(messageContent('x'.repeat(400))), []);
});

test('no outage: the street and the commune are green', () => {
  const content = widget(snap([]));
  assert.equal(content.ttl_seconds, 900);
  assert.equal(content.components[0].text, 'Rue des Ursulines, Mâcon · lu il y a 5 min');
  const { items } = content.components.find((c) => c.type === 'status');
  assert.deepEqual(
    items.map((item) => [item.label, item.value, item.color]),
    [
      ['Votre rue', 'Non concernée', 'success'],
      ['Commune', 'Aucune coupure', 'success'],
    ],
  );
});

test('outages: the street first, a card each, at most eight', () => {
  const content = widget(
    snap([
      rawOutage({ id: 'A', label: 'Travaux BT', addresses: ['RUE GAMBETTA , MACON (71000)'] }),
      rawOutage({ id: 'B' }),
    ]),
  );
  const { items } = content.components.find((c) => c.type === 'status');
  assert.equal(items[0].color, 'danger');
  assert.deepEqual(items[2], {
    label: 'Rétablissement prévu',
    value: '14/11 01:30',
    color: 'info',
  });
  const cards = content.components.find((c) => c.type === 'card-list').items;
  assert.deepEqual(
    cards.map((card) => [card.title, card.badge.text]),
    [
      ['RUE DES URSULINES, RUE GAMBETTA', 'Votre rue'],
      ['RUE GAMBETTA', 'Travaux'],
    ],
  );
  assert.equal(cards[0].subtitle, 'Incident (basse tension) · jusqu’à 14/11 01:30');
  assert.equal(cards[0].date, undefined, 'a date would hide the subtitle');
  const late = widget(snap([rawOutage({ end: '13/11/2026 22:30' })]));
  assert.equal(
    late.components.find((c) => c.type === 'card-list').items[0].subtitle,
    'Incident (basse tension) · prévue 22:30, dépassée',
  );
  assert.match(cards[0].description, /^Type : Incident BT\nDepuis : 13\/11 21:40/);

  const many = Array.from({ length: 10 }, (_, i) => rawOutage({ id: `O${i}` }));
  const crowded = widget(snap(many));
  assert.equal(crowded.components.find((c) => c.type === 'card-list').items.length, MAX_ITEMS);
  assert.match(crowded.components.at(-1).text, /Et 2 autre/);
});

test('"my street only" hides the other outages', () => {
  const content = widget(snap([rawOutage({ addresses: ['RUE GAMBETTA , MACON (71000)'] })]), 'en', {
    show: 'street',
  });
  assert.ok(!content.components.some((c) => c.type === 'card-list'));
  assert.deepEqual(readOutageSettings({ show: 'nope' }), { show: 'all' });
});
