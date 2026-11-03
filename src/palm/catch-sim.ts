// Catch mode (?catch=1) as a pure simulation. Three seeds (gold, blue, pink)
// drift down one at a time, each in its own fixed lane. The player moves an
// open, palm-up hand beneath the seed, it settles in the palm, and a gentle
// cup catches it. Catch one of each to finish. No rendering, no WebXR;
// unit-tested in test/catch-sim.test.ts.
//
// Fair and forgiving by design:
// - slow, straight, predictable falls; each colour always uses the same lane
// - the catch area scales with the measured palm width (CATCH_TOLERANCE),
//   so it matches the real hand, not a fixed number
// - the seed only lands on a palm that faces up (normal.y >= PALM_UP_MIN)
//   and is OPEN (cup below CUP_ON); a cup must then be held briefly
//   (CUP_HOLD). Together these stop a passing curled hand or fist catching
// - once landed it waits in the palm as long as you like; no timing snap
// - tracking loss pauses everything; it never causes a miss
// - a miss returns the SAME seed; earlier catches are kept

import { type Vec3, copy, v3 } from './math.js';

export const SEED_KINDS = ['gold', 'blue', 'pink'] as const;
export type SeedKind = (typeof SEED_KINDS)[number];

export const CATCHES_TO_WIN = SEED_KINDS.length;
export const FALL_SPEED = 0.06; // m/s, slow drift
export const TELEGRAPH_S = 1.0; // seed glows in place before it starts to fall
/**
 * Catch tolerance: catch radius = this x measured palm width (knuckle line).
 * About 0.9 palm widths: a seed counts if it comes down anywhere over the
 * palm or just beside it. This is game logic on the real hand; it has
 * nothing to do with how big the laptop emulator draws the hand.
 */
export const CATCH_TOLERANCE = 0.9;
export const CATCH_RADIUS_MIN = 0.055;
export const CATCH_RADIUS_MAX = 0.095;
/** Default radius when no palm has been measured (typical adult palm ~8 cm). */
export const CATCH_RADIUS = 0.072;
export const LAND_ABOVE = 0.05; // seed may land from up to 5 cm above the palm
export const LAND_BELOW = 0.03; // ...or up to 3 cm below it (hand rose past it)
export const PALM_UP_MIN = 0.55; // palm normal.y; ~57 degrees of tilt allowed
export const ROLL_OFF = 0.3; // tilting past ~72 degrees spills a resting seed
export const CUP_ON = 0.42; // cupAmount needed to close on the seed
export const CUP_HOLD = 0.2; // seconds the cup must be held
export const SETTLE_S = 0.15; // seed must rest this long before a cup counts
export const FALL_DEPTH = 0.55; // a seed this far below its spawn point is missed
export const CAUGHT_S = 0.9; // celebration before the next seed
export const MISSED_S = 1.2; // pause before the same seed returns

/** Lateral lane per seed (m, + = to the player's right), and lane geometry. */
export const LANES: Record<SeedKind, number> = { gold: -0.12, blue: 0.12, pink: 0 };
export const LANE_DISTANCE = 0.36; // in front of the eyes
export const LANE_DROP = 0.12; // spawn this far below eye level

export type SeedState = 'waiting' | 'falling' | 'resting' | 'caught' | 'missed' | 'done';
export type CatchEvent = 'none' | 'land' | 'catch' | 'miss' | 'spill' | 'spawn' | 'complete';

/** Where a seed of this kind appears now (the system derives it from the head pose). */
export type SpawnFor = (kind: SeedKind, out: Vec3) => Vec3;

export interface CatchState {
  seed: SeedState;
  kind: SeedKind;
  caught: Record<SeedKind, boolean>;
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
  /** catch radius in metres; use catchRadiusForPalm(); defaults to CATCH_RADIUS */
  radius?: number;
  spawnFor: SpawnFor;
}

/** Catch radius from the measured palm width (index-to-pinky knuckle distance). */
export function catchRadiusForPalm(palmWidth: number): number {
  const r = palmWidth * CATCH_TOLERANCE;
  return r < CATCH_RADIUS_MIN ? CATCH_RADIUS_MIN : r > CATCH_RADIUS_MAX ? CATCH_RADIUS_MAX : r;
}

/** Spawn point for a seed kind: its lane, 36 cm ahead, 12 cm below eye level. */
export function laneSpawn(kind: SeedKind, head: Vec3, fwdX: number, fwdZ: number, out: Vec3): Vec3 {
  const len = Math.hypot(fwdX, fwdZ) || 1;
  const fx = fwdX / len;
  const fz = fwdZ / len;
  const s = LANES[kind];
  out.x = head.x + fx * LANE_DISTANCE - fz * s;
  out.y = head.y - LANE_DROP;
  out.z = head.z + fz * LANE_DISTANCE + fx * s;
  return out;
}

const noneCaught = (): Record<SeedKind, boolean> => ({ gold: false, blue: false, pink: false });

/** The next seed still to catch, in the fixed order gold, blue, pink. */
export function nextKind(st: CatchState): SeedKind | null {
  for (const k of SEED_KINDS) if (!st.caught[k]) return k;
  return null;
}

export function makeCatch(spawnFor: SpawnFor): CatchState {
  const st: CatchState = {
    seed: 'waiting',
    kind: 'gold',
    caught: noneCaught(),
    pos: v3(),
    spawn: v3(),
    t: 0,
    catches: 0,
    misses: 0,
    spills: 0,
    restT: 0,
    cupT: 0,
    round: 0,
  };
  spawnFor('gold', st.spawn);
  copy(st.pos, st.spawn);
  return st;
}

/** Fist restart: every count back to zero, gold first again. */
export function resetCatch(st: CatchState, spawnFor: SpawnFor): void {
  Object.assign(st, makeCatch(spawnFor));
}

function newRound(st: CatchState, kind: SeedKind, spawnFor: SpawnFor): void {
  st.kind = kind;
  spawnFor(kind, st.spawn);
  copy(st.pos, st.spawn);
  st.seed = 'waiting';
  st.t = 0;
  st.restT = 0;
  st.cupT = 0;
  st.round++;
}

/**
 * Testing aid (laptop keys 1/2/3): make `kind` the current seed. Allowed only
 * for a seed not yet caught, and not while one rests in the palm or is being
 * celebrated. Returns true if the seed changed.
 */
export function selectKind(st: CatchState, kind: SeedKind, spawnFor: SpawnFor): boolean {
  if (st.caught[kind]) return false;
  if (st.seed === 'resting' || st.seed === 'caught' || st.seed === 'done') return false;
  newRound(st, kind, spawnFor);
  return true;
}

/** Advance the catch game by dt seconds and report what happened. */
export function stepCatch(st: CatchState, inp: CatchInput, dt: number): CatchEvent {
  dt = Math.min(dt, 0.05);
  const palmUp = inp.tracked && inp.normal.y >= PALM_UP_MIN;
  const open = inp.cup < CUP_ON;
  const radius = inp.radius ?? CATCH_RADIUS;

  switch (st.seed) {
    case 'done':
      return 'none';

    case 'caught': {
      st.t += dt;
      if (st.t < CAUGHT_S) return 'none';
      const k = nextKind(st);
      if (!k) {
        st.seed = 'done';
        return 'complete';
      }
      newRound(st, k, inp.spawnFor);
      return 'spawn';
    }

    case 'missed':
      st.t += dt;
      if (st.t < MISSED_S) return 'none';
      newRound(st, st.kind, inp.spawnFor); // the same seed comes back
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
      st.pos.y -= FALL_SPEED * dt; // straight down: predictable
      const near = Math.hypot(st.pos.x - inp.center.x, st.pos.z - inp.center.z) <= radius;
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
        st.t = 0;
        st.spills++;
        return 'spill';
      }
      // settle toward the palm centre (no need to centre exactly)
      const k = Math.min(1, dt * 8);
      st.pos.x += (inp.center.x + inp.normal.x * 0.008 - st.pos.x) * k;
      st.pos.y += (inp.center.y + inp.normal.y * 0.008 - st.pos.y) * k;
      st.pos.z += (inp.center.z + inp.normal.z * 0.008 - st.pos.z) * k;
      st.restT += dt;
      st.cupT = inp.cup >= CUP_ON ? st.cupT + dt : 0;
      if (st.restT >= SETTLE_S && st.cupT >= CUP_HOLD) {
        st.seed = 'caught';
        st.t = 0;
        st.caught[st.kind] = true;
        st.catches++;
        return 'catch';
      }
      return 'none';
    }
  }
}
