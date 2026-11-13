// -----------------------------------------------------------------------------
// The reading loop: every `interval` minutes, one request to Enedis per place
// returns the outages of its commune.
//
// It keeps the snapshots the devices, widgets, scene actions and triggers
// read, and hands each round to the app with its transitions (tracker.js).
// The places are asked one after the other, a short pause between two, never
// in parallel. A round never overlaps another one; a failing place keeps its
// last snapshot and is reported with its error.
// -----------------------------------------------------------------------------

import { readAnswer } from './read.js';
import { diffPlace } from './tracker.js';

// Pause between the requests of two places of the same round.
const PAUSE_MS = 1500;

/**
 * @description Create the watcher.
 * @param {object} options - Options.
 * @param {object} options.enedis - The Enedis client.
 * @param {Function} options.getPlaces - `async () => places`: the resolved
 * places (`{ id, insee, city, postcode, district, street }`), those that
 * could not be resolved left out.
 * @param {Function} options.getIntervalMs - `() => number`.
 * @param {Function} options.onRound - `async ({ places, errors }) => void`:
 * each place read as `{ snapshot, events, changed }`, each failure as
 * `{ place, error }`.
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {Function} [options.sleep] - `(ms) => Promise` (tests).
 * @param {object} options.logger - Logger.
 * @returns {object} The watcher.
 * @example
 * const watcher = createWatcher({ enedis, getPlaces, getIntervalMs, onRound, logger });
 * watcher.start();
 */
function createWatcher({
  enedis,
  getPlaces,
  getIntervalMs,
  onRound,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  logger,
}) {
  // place id -> snapshot
  let snapshots = new Map();
  let fetchedAt = null;
  let timer = null;
  let running = null;
  let started = false;

  /**
   * @description Read one place.
   * @param {object} place - The resolved place.
   * @returns {Promise<object>} The snapshot.
   */
  async function readPlace(place) {
    const answer = readAnswer(await enedis.getOutages(place), place);
    return { place, ...answer, fetchedAt: now() };
  }

  /**
   * @description One reading of every place.
   * @returns {Promise<void>}
   */
  async function readAll() {
    const places = await getPlaces();
    const round = { places: [], errors: [] };
    const next = new Map();
    for (const [index, place] of places.entries()) {
      if (index > 0) {
        await sleep(PAUSE_MS);
      }
      const previous = snapshots.get(place.id);
      try {
        const snapshot = await readPlace(place);
        next.set(place.id, snapshot);
        round.places.push({
          snapshot,
          events: diffPlace(previous, snapshot),
          changed:
            !previous ||
            JSON.stringify([previous.place, previous.outages, previous.crises]) !==
              JSON.stringify([snapshot.place, snapshot.outages, snapshot.crises]),
        });
      } catch (err) {
        logger.warn(`Enedis reading failed for ${place.label ?? place.insee}: ${err.message}`);
        if (previous) {
          next.set(place.id, previous);
        }
        round.errors.push({ place, error: err });
      }
    }
    snapshots = next;
    fetchedAt = now();
    await onRound(round);
  }

  /**
   * @description Plan the next round.
   */
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (started) {
      timer = setTimeout(() => {
        round().finally(schedule);
      }, getIntervalMs());
      timer.unref?.();
    }
  }

  /**
   * @description Read every place now; joins a round already running.
   * @returns {Promise<void>} Never rejects: failures are logged.
   */
  function round() {
    if (running) {
      return running;
    }
    running = readAll()
      .catch((err) => logger.error('Enedis reading round failed', err))
      .finally(() => {
        running = null;
      });
    return running;
  }

  return {
    round,
    readPlace,
    start: () => {
      started = true;
      schedule();
    },
    stop: () => {
      started = false;
      clearTimeout(timer);
      timer = null;
    },
    reschedule: schedule,
    /** @description Forget everything: the next round is a new baseline. */
    reset: () => {
      snapshots = new Map();
      fetchedAt = null;
    },
    snapshots: () => [...snapshots.values()],
    snapshot: (id) => snapshots.get(id) ?? null,
    fetchedAt: () => fetchedAt,
  };
}

export { PAUSE_MS, createWatcher };
