# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the power outages Enedis
publishes in mainland France: a Node.js service (Node 22+, ESM, no build step)
that runs in its own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency.

Enedis has **no open API** for its outages. The integration reads the JSON
answer the public page https://www.enedis.fr/resultat-panne-interruption
reads itself: `GET https://www.enedis.fr/panne-interruption-ajax?insee=…&type=municipality&adresse=…&CPVille=…&name=…&district=&city=…`
(`name` and `city` required, 400 without them), no account, no key, once per
place and per reading (15 minutes by default). It is not a documented API: it
may change without notice. Places (a house of Gladys, or a typed address)
become a commune (INSEE code) and a street through the Géoplateforme geocoder
(`https://data.geopf.fr/geocodage/search` and `/reverse`, IGN, no key).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, places resolution, status messages
src/enedis-api.js       the enedis.fr outage endpoint, error kinds
src/geo.js              Géoplateforme geocoder: address / house -> commune + street
src/read.js             answers -> outages, arrondissements, street matching (pure)
src/time.js             Enedis dates ("dd/mm/yyyy HH:MM", Paris time)
src/watcher.js          the timer loop, one place after the other, snapshots
src/tracker.js          snapshots -> scene trigger transitions (pure logic)
src/events.js           scene trigger payloads and scene action outputs
src/device.js           one device per place, its states
src/widgets.js          the "outages" dashboard widget
src/config.js           configuration (places, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## What Enedis answers (recorded November 2026)

- `resultMegacache.listeCoupuresInfoReseau[]`: `idCoupure` (stable),
  `etatCoupure` ("En cours"), `coupureClose`, `incidentCoupure` (Incident BT /
  HTA, Travaux BT / HTA, Délestage, Coupure clôturée), `dateCoupure` and
  `dateRealimentation` ("13/11/2026 23:21", Paris time), `nbFoyersCoupes`
  (often 0: never shown), `codeInsee`, `listeAdresses[].localisation`
  ("BD HAUSSMANN , PARIS (75009)"; HTA outages often list substation names).
- `resultMegacache.listeCrises[]`: `titreCrise`, `messageLong` during a storm.
- `noCoupure: "true"` when there is none; `errorMegacache: "true"` (200) when
  the service is down; 400 `errorServices: "true"` for a commune Enedis does
  not serve (Strasbourg…) or does not know.
- Paris, Lyon, Marseille: whatever arrondissement is asked, the answer covers
  the whole city; `read.js` keeps the arrondissement of the place.
- The street query of the site (`type=street`) gave `noCoupure: "true"` for
  a street listed as cut: the integration always asks for the commune and
  matches the streets itself (`streetWords` / `onStreet`).

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (built on the INSEE code and the words of the street,
  `71270-ursulines`, never on a display name), feature `category` / `type` /
  `min` / `max`, the option values of the trigger filters (`scope`, `kind`,
  `change`, `state`), the keys of `config_schema`, `actions`, the widget and
  its settings, scene triggers (fields, options, variables) and scene actions
  (fields, outputs). `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Status is `risk` / `integer`, 0 to 2** (0 none, 1 commune, 2 street),
  outages `counter-sensor` / `integer`, situation `text` / `text`. Do not
  change them without a migration.
- **"On my street" is likely, not certain**: Enedis lists streets or
  substations, not homes. Say so in every user text.
- **Be polite with enedis.fr**: one request per place and per reading, a
  pause between two places, never in parallel, the integration named in the
  User-Agent, at least every 5 minutes. A widget never costs a request; a
  scene action reuses a reading younger than one minute.
- **`should_poll` stays false**; every feature is read-only.
- **The first round of a place is a baseline**: no scene event replays an
  outage in progress after a restart or an address change. A failed reading
  changes nothing (it is not an end of outage). A scene action never fires a
  scene trigger.
- **The container rootfs is read-only.** Nothing is written, not even under
  `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it.
- **Widget images.** After any change to the content of the widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. `location: true` (house selector and coordinates), Gladys `>=5.3.0`,
  `countries: ["FR"]`, transport `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
