// Optional two-hand catching (?catch=1&hands=2), as a pure rule set.
// Each frame it decides WHICH tracked hand feeds the catch simulation:
//
// - Either open, palm-up hand may receive a falling seed: the one nearest the
//   seed (horizontally) is "engaged". A switch to the other hand needs it to
//   be clearly nearer (SWITCH_MARGIN), so nothing flickers between hands.
// - Once a seed RESTS in a palm, only that hand ("holder") can catch it.
// - If the engaged or holding hand loses tracking, the seed PAUSES (the
//   simulation is told "not tracked"): it never moves to the other hand and
//   never counts as a miss. A falling seed is released to the other hand only
//   after GRACE_S seconds without the engaged hand; a resting seed waits for
//   its holder indefinitely.
// - With one hand tracked, play is exactly the one-hand game.

import type { CatchState } from './catch-sim.js';
import { CUP_ON, PALM_UP_MIN } from './catch-sim.js';
import type { Vec3 } from './math.js';

export type Side = 'left' | 'right';
export const GRACE_S = 3;
export const SWITCH_MARGIN = 0.03; // m

export interface HandView {
  side: Side;
  tracked: boolean;
  center: Vec3;
  normal: Vec3;
  cup: number;
}

export interface Engagement {
  side: Side | null; // hand under the falling seed, or holding the resting one
  lostT: number; // how long that hand has been untracked
}

export const makeEngagement = (): Engagement => ({ side: null, lostT: 0 });

const ready = (h: HandView) => h.tracked && h.normal.y >= PALM_UP_MIN && h.cup < CUP_ON;

/**
 * Pick the hand that feeds stepCatch this frame, or null to pause the seed.
 * Call after a 'land' event with the same hand to make it the holder (the
 * engagement already points at it).
 */
export function chooseHand(hands: HandView[], st: CatchState, eng: Engagement, dt: number): HandView | null {
  const bySide = (s: Side | null) => hands.find((h) => h.side === s) ?? null;
  const dist = (h: HandView) => Math.hypot(st.pos.x - h.center.x, st.pos.z - h.center.z);
  const engaged = bySide(eng.side);

  // A seed in a palm (or just caught from it) belongs to that hand.
  if (st.seed === 'resting' || st.seed === 'caught') {
    if (engaged?.tracked) {
      eng.lostT = 0;
      return engaged;
    }
    eng.lostT += dt;
    return null; // pause; wait for the holder
  }

  // Falling or waiting: engaged hand lost? Pause during the grace period.
  if (engaged && !engaged.tracked) {
    eng.lostT += dt;
    if (eng.lostT < GRACE_S) return null;
    eng.side = null; // released after the grace period
  }
  eng.lostT = 0;

  const tracked = hands.filter((h) => h.tracked);
  if (tracked.length === 0) {
    return null;
  }
  // Prefer hands ready to receive (open, palm up); otherwise any tracked hand
  // (so the ring and hints still follow the nearest hand).
  const pool = tracked.some(ready) ? tracked.filter(ready) : tracked;
  let best = pool[0];
  for (const h of pool) if (dist(h) < dist(best)) best = h;
  const current = bySide(eng.side);
  if (current && current.tracked && pool.includes(current) && dist(current) <= dist(best) + SWITCH_MARGIN) {
    return current; // hysteresis: keep the engaged hand unless the other is clearly nearer
  }
  eng.side = best.side;
  return best;
}
