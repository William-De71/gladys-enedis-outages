import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  kindOf,
  networkOf,
  inCommune,
  streetWords,
  onStreet,
  addressText,
  readAnswer,
  levelOf,
  restorationOf,
  openOutages,
} from '../src/read.js';
import { parseEnedisDate, formatParis } from '../src/time.js';
import { rawAnswer, rawOutage } from './helpers/fixtures.js';

const MACON = { insee: '71270', street: 'Rue des Ursulines' };

test('Enedis dates are Paris time, winter and summer', () => {
  assert.equal(parseEnedisDate('14/11/2026 01:00'), Date.parse('2026-11-14T00:00:00Z'));
  assert.equal(parseEnedisDate('14/07/2026 01:00'), Date.parse('2026-07-13T23:00:00Z'));
  // The night of the change to summer time: 03:30 exists, in +02:00.
  assert.equal(parseEnedisDate('29/03/2026 03:30'), Date.parse('2026-03-29T01:30:00Z'));
  assert.equal(parseEnedisDate('2026-11-14'), null);
  assert.equal(parseEnedisDate(''), null);
  assert.equal(parseEnedisDate(null), null);
});

test('Paris times are written in the language, the day left out today', () => {
  const at = Date.parse('2026-11-14T00:30:00Z');
  assert.equal(formatParis(at, 'fr'), '14/11 01:30');
  assert.equal(formatParis(at, 'fr', Date.parse('2026-11-14T08:00:00Z')), '01:30');
  assert.equal(formatParis(NaN, 'fr'), '?');
});

test('kinds and networks come from the label of Enedis', () => {
  assert.equal(kindOf('Incident HTA'), 'incident');
  assert.equal(kindOf('Travaux BT'), 'works');
  assert.equal(kindOf('Délestage'), 'shedding');
  assert.equal(kindOf('Coupure clôturée'), 'other');
  assert.equal(networkOf('Incident HTA'), 'HTA');
  assert.equal(networkOf('Travaux BT'), 'BT');
  assert.equal(networkOf('Délestage'), null);
});

test('Paris, Lyon and Marseille: the arrondissement, or the whole city', () => {
  assert.ok(inCommune('75109', '75109'));
  assert.ok(!inCommune('75111', '75109'));
  assert.ok(inCommune('75111', '75056'));
  assert.ok(inCommune('69383', '69123'));
  assert.ok(inCommune('13201', '13055'));
  assert.ok(!inCommune('71270', '75056'));
  assert.ok(inCommune(null, '71270'), 'an outage without a code is kept');
});

test('streets: abbreviations, accents, numbers and kinds of streets', () => {
  assert.deepEqual(streetWords('14 PASSAGE CHARLES DALLERY'), ['CHARLES', 'DALLERY']);
  assert.deepEqual(streetWords('Rue des Ursulines'), ['URSULINES']);
  assert.deepEqual(streetWords('AV DU MAL DE LATTRE'), ['MAL', 'LATTRE']);
  assert.ok(onStreet('BD HAUSSMANN', streetWords('Boulevard Haussmann')));
  assert.ok(onStreet('ANGLE 2 RU RUE GLUCK', streetWords('Rue Gluck')));
  assert.ok(onStreet('R DES URSULINES', streetWords('Rue des Ursulines')));
  assert.ok(onStreet('RUE ST ANTOINE', streetWords('Rue Saint-Antoine')));
  assert.ok(!onStreet('RUE SAINT MARTIN', streetWords('Rue Saint-Antoine')));
  assert.ok(!onStreet('MEYERBEER-OPERA / 750904', streetWords('Boulevard Haussmann')));
  assert.ok(!onStreet('RUE GAMBETTA', []), 'no street, never on the street');
  assert.equal(addressText('BD HAUSSMANN , PARIS (75009)'), 'BD HAUSSMANN');
  assert.equal(addressText('MEYERBEER-OPERA / 750904 , PARIS (75009)'), 'MEYERBEER-OPERA / 750904');
});

test('an answer becomes the outages of the commune, open ones first', () => {
  const { outages, crises } = readAnswer(
    rawAnswer([
      rawOutage({
        id: 'B',
        start: '13/11/2026 22:00',
        addresses: ['RUE GAMBETTA , MACON (71000)'],
      }),
      rawOutage({ id: 'A', label: 'Travaux HTA', start: '13/11/2026 20:00' }),
      rawOutage({ id: 'C', closed: true, label: 'Coupure clôturée' }),
      rawOutage({ id: 'D', insee: '71105' }),
      rawOutage({ id: 'A' }),
      { idCoupure: '' },
    ]),
    MACON,
  );
  assert.deepEqual(
    outages.map((outage) => outage.id),
    ['A', 'B', 'C'],
  );
  const [a, b, c] = outages;
  assert.equal(a.kind, 'works');
  assert.equal(a.network, 'HTA');
  assert.equal(a.onStreet, true);
  assert.equal(a.startedAt, Date.parse('2026-11-13T19:00:00Z'));
  assert.equal(a.restorationAt, Date.parse('2026-11-14T00:30:00Z'));
  assert.equal(b.onStreet, false);
  assert.equal(c.closed, true);
  assert.deepEqual(crises, []);
  assert.equal(openOutages({ outages }).length, 2);
});

test('levels: none, the commune, the street; the restoration of the street first', () => {
  const street = { insee: '71270', street: 'Rue des Ursulines' };
  const none = readAnswer(rawAnswer(), street);
  assert.equal(levelOf(none), 0);
  assert.equal(restorationOf(none), null);
  const commune = readAnswer(
    rawAnswer([rawOutage({ addresses: ['RUE GAMBETTA , MACON (71000)'] })]),
    street,
  );
  assert.equal(levelOf(commune), 1);
  const both = readAnswer(
    rawAnswer([
      rawOutage({ id: 'X', end: '14/11/2026 05:00', addresses: ['RUE GAMBETTA , MACON (71000)'] }),
      rawOutage({ id: 'Y', end: '14/11/2026 02:00' }),
    ]),
    street,
  );
  assert.equal(levelOf(both), 2);
  assert.equal(restorationOf(both), Date.parse('2026-11-14T01:00:00Z'));
  const noStreet = readAnswer(rawAnswer([rawOutage()]), { insee: '71270', street: null });
  assert.equal(levelOf(noStreet), 1, 'without a street, never level 2');
});

test('crises are read, empty ones left out', () => {
  const { crises } = readAnswer(
    rawAnswer(
      [],
      [{ titreCrise: 'Tempête Ciarán', messageLong: 'Nos équipes sont mobilisées.' }, {}],
    ),
    MACON,
  );
  assert.deepEqual(crises, [{ title: 'Tempête Ciarán', message: 'Nos équipes sont mobilisées.' }]);
});
