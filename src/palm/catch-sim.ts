// Catch mode (?catch=1) as a pure simulation: a glowing seed drifts down; the
// player moves an open, palm-up hand beneath it, the seed settles in the
// palm, and a gentle cup catches it. No rendering, no WebXR; unit-tested.
//
// Forgiving by design:
// - a wide catch radius around the palm centre, no fingertip contact needed
// - the seed only lands on a palm that faces up (normal.y >= PALM_UP_MIN)
// - once landed it waits in the palm as long as you like; no timing snap
// - the seed only lands in an OPEN palm (cup below CUP_ON), and a cup must
//   then be held briefly (CUP_HOLD) after landing; together these stop a
//   passing, already-curled hand or a fist from catching by accident
// - tracking loss pauses everything; it never causes a miss
// - a miss costs nothing: the seed comes back for another try

import { type Vec3, copy, v3 } from './math.js';

export const CATCHES_TO_WIN = 3;
export const FALL_SPEED = 0.06; // m/s, slow drift
export const TELEGRAPH_S = 1.0; // seed glows in place before it starts to fall
export const CATCH_RADIUS = 0.075; // horizontal distance from palm centre (m)
export const LAND_ABOVE = 0.05; // seed may land from up to 5 cm above the palm
export const LAND_BELOW = 0.03; // ...or up to 3 cm below it (hand rose past it)
export const PALM_UP_MIN = 0.55; // palm normal.y; ~57 degrees of tilt allowed
export const ROLL_OFF = 0.3; // tilting past ~72 degrees spills a resting seed
export const CUP_ON = 0.42; // cupAmount needed to close on the seed
export const CUP_HOLD = 0.2; // seconds the cup must be held
export const SETTLE_S = 0.15; // seed must rest this long before a cup counts
export const FALL_DEPTH = 0.55; // a seed this far below its spawn point is missed
export const CAUGHT_S = 0.9; // celebration before the next seed
export const MISSED_S = 1.2; // pause before the seed returns

export type SeedState = 'waiting' | 'falling' | 'resting' | 'caught' | 'missed' | 'done';
export type CatchEvent = 'none' | 'land' | 'catch' | 'miss' | 'spill' | 'spawn' | 'complete';

export interface CatchState {
  seed: SeedState;
  pos: Vec3;
  spawn: Vec3;
  t: number; // time in the current seed state
  catches: number;
  misses: number;
  spills: number;
  restT: number;
  cupT: number;
  round: number;
}

export interface CatchInput {
  tracked: boolean;
  center: Vec3; // palm centre (on the skin)
  normal: Vec3; // out of the palm
  cup: number; // cupAmount 0..1
  /** where the next seed should appear (system computes it from the head) */
  nextSpawn: Vec3;
}

export const makeCatch = (spawn: Vec3): CatchState => ({
  seed: 'waiting',
  pos: copy(v3(), spawn),
  spawn: copy(v3(), spawn),
  t: 0,
  catches: 0,
  misses: 0,
  spills: 0,
  restT: 0,
  cupT: 0,
  round: 0,
});

function newRound(st: CatchState, spawn: Vec3): void {
  copy(st.spawn, spawn);
  copy(st.pos, spawn);
  st.seed = 'waiting';
  st.t = 0;
  st.restT = 0;
  st.cupT = 0;
  st.round++;
}

/** Advance the catch game by dt seconds and report what happened. */
export function stepCatch(st: CatchState, inp: CatchInput, dt: number): CatchEvent {
  dt = Math.min(dt, 0.05);
  const palmUp = inp.tracked && inp.normal.y >= PALM_UP_MIN;
  const open = inp.cup < CUP_ON;

  switch (st.seed) {
    case 'done':
      return 'none';

    case 'caught':
      st.t += dt;
      if (st.t < CAUGHT_S) return 'none';
      if (st.catches >= CATCHES_TO_WIN) {
        st.seed = 'done';
        return 'complete';
      }
      newRound(st, inp.nextSpawn);
      return 'spawn';

    case 'missed':
      st.t += dt;
      if (st.t < MISSED_S) return 'none';
      newRound(st, inp.nextSpawn);
      return 'spawn';

    case 'waiting':
      // Glows in place; starts its fall once a hand is offered open, palm up.
      if (!palmUp || !open) return 'none';
      st.t += dt;
      if (st.t >= TELEGRAPH_S) {
        st.seed = 'falling';
        st.t = 0;
      }
      return 'none';

    case 'falling': {
      if (!inp.tracked) return 'none'; // pause: tracking loss never costs a seed
      st.t += dt;
      st.pos.y -= FALL_SPEED * dt;
      st.pos.x = st.spawn.x + Math.sin(st.t * 1.3) * 0.012; // gentle drift
      const dx = st.pos.x - inp.center.x;
      const dz = st.pos.z - inp.center.z;
      const near = Math.hypot(dx, dz) <= CATCH_RADIUS;
      const dy = st.pos.y - inp.center.y;
      if (palmUp && open && near && dy <= LAND_ABOVE && dy >= -LAND_BELOW) {
        st.seed = 'resting';
        st.t = 0;
        st.restT = 0;
        st.cupT = 0;
        return 'land';
      }
      if (st.pos.y < st.spawn.y - FALL_DEPTH) {
        st.seed = 'missed';
        st.t = 0;
        st.misses++;
        return 'miss';
      }
      return 'none';
    }

    case 'resting': {
      if (!inp.tracked) return 'none'; // pause in place
      if (inp.normal.y < ROLL_OFF) {
        // tipped too far: the seed spills and keeps falling
        st.seed = 'falling';
        st.spawn.x = st.pos.x;
        st.t = 0;
        st.spills++;
        return 'spill';
      }
      // settle toward the palm centre (forgiving: no need to centre exactly)
      const k = Math.min(1, dt * 8);
      st.pos.x += (inp.center.x + inp.normal.x * 0.008 - st.pos.x) * k;
      st.pos.y += (inp.center.y + inp.normal.y * 0.008 - st.pos.y) * k;
      st.pos.z += (inp.center.z + inp.normal.z * 0.008 - st.pos.z) * k;
      st.restT += dt;
      st.cupT = inp.cup >= CUP_ON ? st.cupT + dt : 0;
      if (st.restT >= SETTLE_S && st.cupT >= CUP_HOLD) {
        st.seed = 'caught';
        st.t = 0;
        st.catches++;
        return 'catch';
      }
      return 'none';
    }
  }
}

/**
 * Where the next seed appears: ~36 cm in front of the eyes, 5 cm below eye
 * level, alternating left / right / centre so the hand has to move. If that
 * point is within 10 cm (horizontally) of where the palm is now, use the
 * other side, so every catch takes a deliberate move.
 */
export function chooseSpawn(
  head: Vec3,
  fwdX: number,
  fwdZ: number,
  palm: Vec3 | null,
  round: number,
  out: Vec3,
): Vec3 {
  const len = Math.hypot(fwdX, fwdZ) || 1;
  const fx = fwdX / len;
  const fz = fwdZ / len;
  const rx = -fz; // right vector on the floor plane
  const rz = fx;
  const sides = [-0.12, 0.12, 0];
  let side = sides[round % 3];
  const place = (s: number) => {
    out.x = head.x + fx * 0.36 + rx * s;
    out.y = head.y - 0.05;
    out.z = head.z + fz * 0.36 + rz * s;
  };
  place(side);
  if (palm && Math.hypot(out.x - palm.x, out.z - palm.z) < 0.1) {
    side = side <= 0 ? 0.13 : -0.13;
    place(side);
  }
  return out;
}
