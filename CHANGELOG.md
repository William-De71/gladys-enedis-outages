# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-11-13

### Added

- One device per place (a house of Gladys or a typed address, up to three), from the public outage map of enedis.fr: whether a power outage is in progress on the street of the place or elsewhere in the commune (0 to 2), the number of outages in the commune, and the situation as a sentence with the expected restoration. No account, no key.
- Addresses found with the geocoder of the Géoplateforme (IGN): the nearest address to a house, or the typed one; Paris, Lyon and Marseille by arrondissement; a commune Enedis does not serve is reported as such.
- Scene triggers: power outage (filters: on my street or elsewhere in the commune, kind: breakdown, works, load shedding), power back with the duration, restoration time postponed or brought forward, exceptional event (storm…) started or ended.
- A "read the outages" scene action, for messages and conditions.
- A "Power outages" dashboard widget: the street, the outages of the commune with their places, kind, network and expected restoration, and the message of an exceptional event.
- A "Check the places" button showing the commune and the street found for each place; Enedis read every 5 to 60 minutes (15 by default), one request per place.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-enedis-outages/releases/tag/v0.1.0
