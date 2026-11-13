<!--
The TITLE of this pull request becomes the squash commit, then the line users
read in CHANGELOG.md and in the GitHub Release. Write it in English, as a
Conventional Commit describing the change for the user:

  feat(widgets): show the salt level in the pool widget
  fix(hub): keep the filtration mode after a manual start
  perf: read the Hub only when it is used
  docs: explain the passive wintering mode

feat -> minor version, fix / perf -> patch, `!` or a "BREAKING CHANGE:" footer
-> breaking (a minor while the version is below 1.0.0). docs, chore, ci, test,
style, refactor and build alone publish no release. Never edit CHANGELOG.md.
-->

## What changes for the user

## How it was tested

- [ ] `npm run format:check`, `npm run lint` and `npm test` pass
- [ ] Tried in Gladys against the real enedis.fr (Gladys version: …)
- [ ] The four docs (`docs/en.md`, `fr`, `de`, `es`) and READMEs are up to date
