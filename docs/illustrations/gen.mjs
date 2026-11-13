// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// Two "Power outages" cards on a November evening, from answers shaped like
// those of enedis.fr, through the real code (src/read.js) and the real widget
// builder (src/widgets.js): a quiet commune, and a street of Mâcon cut by
// low-voltage works, with a medium-voltage breakdown elsewhere in the
// commune.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildOutagesWidget } = await load('src/widgets.js');
const { readAnswer } = await load('src/read.js');
const { LANGUAGES } = await load('src/i18n.js');
const { NOW, rawAnswer, rawOutage } = await load('test/helpers/fixtures.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const quietPlace = {
  id: '71105-pasteur',
  insee: '71105',
  city: 'Charnay-lès-Mâcon',
  street: 'Rue Pasteur',
};
const streetPlace = {
  id: '71270-ursulines',
  insee: '71270',
  city: 'Mâcon',
  street: 'Rue des Ursulines',
};
const quiet = {
  place: quietPlace,
  fetchedAt: NOW - 4 * 60000,
  ...readAnswer(rawAnswer(), quietPlace),
};
const street = {
  place: streetPlace,
  fetchedAt: NOW - 6 * 60000,
  ...readAnswer(
    rawAnswer([
      rawOutage({
        id: 'PEBFC20261113203000.11201',
        label: 'Travaux BT',
        start: '13/11/2026 20:30',
        end: '14/11/2026 01:30',
        addresses: [
          'R DES URSULINES , MACON (71000)',
          'RUE GAMBETTA , MACON (71000)',
          'PL DE LA BARRE , MACON (71000)',
        ],
      }),
      rawOutage({
        id: 'PEBFC20261113215200.11233',
        label: 'Incident HTA',
        start: '13/11/2026 21:52',
        end: '13/11/2026 23:45',
        addresses: ['FLACE GARE / 712700154 , MACON (71000)'],
      }),
    ]),
    streetPlace,
  ),
};

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    quiet: buildOutagesWidget({ snapshot: quiet, language, now: NOW, pollMinutes: 15 }),
    street: buildOutagesWidget({ snapshot: street, language, now: NOW, pollMinutes: 15 }),
  };
}
const outages = manifest.widgets.find((w) => w.key === 'outages');
const widgets = {
  quiet: { icon: outages.icon, label: outages.label },
  street: { icon: outages.icon, label: outages.label },
};
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
