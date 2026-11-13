// -----------------------------------------------------------------------------
// Entry point of the Enedis outages external integration.
//
// Brings the power outages Enedis publishes on enedis.fr into Gladys, for up
// to three places (a house of Gladys or a typed address):
//   - a device per place (outage on the street or in the commune, number of
//     outages, the situation as a sentence), offered on the Discovery screen
//     (see src/device.js);
//   - scene triggers: outage started, power back, restoration time moved,
//     exceptional event;
//   - a scene action: read the outages of a place;
//   - a dashboard widget: the outages of a place at a glance.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Enedis outages integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
