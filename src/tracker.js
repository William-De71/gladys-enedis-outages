// -----------------------------------------------------------------------------
// Place snapshots -> scene trigger transitions (pure logic, no I/O).
//
// One event per transition, never a periodic snapshot:
//   - outage_started        an outage Enedis did not list before appears in
//                           the commune (on the street of the place or not);
//   - outage_ended          an open outage is closed, or no longer listed:
//                           the power is back;
//   - restoration_changed   Enedis moved the estimated restoration of an open
//                           outage (postponed or brought forward);
//   - crisis_changed        Enedis starts (or stops) an exceptional event
//                           (storm…), during which it may no longer list
//                           every outage.
//
// A place seen for the first time (start, restart, new address) is a
// baseline: nothing that happened before is replayed. A reading that failed
// changes nothing (the last snapshot stays).
// -----------------------------------------------------------------------------

const SCENE_TRIGGERS = {
  OUTAGE_STARTED: 'outage_started',
  OUTAGE_ENDED: 'outage_ended',
  RESTORATION_CHANGED: 'restoration_changed',
  CRISIS_CHANGED: 'crisis_changed',
};

// A restoration moved by less than this is not a change (rounding of Enedis).
const MIN_SHIFT_MS = 60000;

/**
 * @description The transitions between two snapshots of a place.
 * @param {object|undefined} previous - The previous snapshot, undefined the first time.
 * @param {object} next - The new snapshot (`{ outages, crises }`).
 * @returns {Array<object>} `{ key, outage?, previous?, state? }` events.
 * @example
 * diffPlace(before, after); // -> [{ key: 'outage_started', outage }]
 */
function diffPlace(previous, next) {
  if (!previous) {
    return [];
  }
  const events = [];
  const before = new Map(previous.outages.map((outage) => [outage.id, outage]));
  const after = new Map(next.outages.map((outage) => [outage.id, outage]));

  for (const outage of next.outages) {
    const old = before.get(outage.id);
    if (outage.closed) {
      if (old && !old.closed) {
        events.push({ key: SCENE_TRIGGERS.OUTAGE_ENDED, outage });
      }
      continue;
    }
    if (!old || old.closed) {
      events.push({ key: SCENE_TRIGGERS.OUTAGE_STARTED, outage });
      continue;
    }
    if (
      Number.isFinite(old.restorationAt) &&
      Number.isFinite(outage.restorationAt) &&
      Math.abs(outage.restorationAt - old.restorationAt) >= MIN_SHIFT_MS
    ) {
      events.push({
        key: SCENE_TRIGGERS.RESTORATION_CHANGED,
        outage,
        previous: old.restorationAt,
      });
    }
  }
  for (const old of previous.outages) {
    if (!old.closed && !after.has(old.id)) {
      events.push({ key: SCENE_TRIGGERS.OUTAGE_ENDED, outage: old, vanished: true });
    }
  }

  const hadCrisis = previous.crises.length > 0;
  const hasCrisis = next.crises.length > 0;
  if (hadCrisis !== hasCrisis) {
    events.push({
      key: SCENE_TRIGGERS.CRISIS_CHANGED,
      state: hasCrisis ? 'started' : 'ended',
      crisis: hasCrisis ? next.crises[0] : previous.crises[0],
    });
  }
  return events;
}

export { SCENE_TRIGGERS, MIN_SHIFT_MS, diffPlace };
