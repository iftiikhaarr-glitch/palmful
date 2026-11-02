// The creature ("Mote") as a pure simulation over a PalmFrame. No rendering,
// no WebXR: this file is unit-tested in Node (see test/creature-sim.test.ts).
//
// Design choice that matters for hand tracking: the creature uses static
// friction. Small tilts (and small tracking jitter) do not move it at all;
// only a deliberate tilt beyond ~FRICTION_ANGLE makes it slide. Friction is
// therefore both the game feel ("it sits until you tip it") and a jitter
// dead-zone.

import {
  type FingerName,
  FINGERS,
  type PalmFrame,
  palmPoint,
  pointOnPath,
} from './hand-frame.js';
import { type Vec3, addScaled, clamp, copy, dot, v3 } from './math.js';

export type Place = 'palm' | FingerName;
export type Mood = 'calm' | 'sliding' | 'cling' | 'joy' | 'waiting';

/** Gravity scale: Mote is light, so real gravity is scaled down. */
export const GRAVITY_SCALE = 0.09;
/** Static friction coefficient (tan of the tilt needed to start sliding). */
export const MU_STATIC = 0.32; // ~18 degrees
export const MU_KINETIC = 0.22;
export const MAX_SPEED = 0.14; // m/s
/** If gravity presses into the palm less than this (m/s^2), Mote clings. */
export const CLING_NORMAL = 2.0; // ~78 degrees of tilt
export const BODY_RADIUS = 0.009;
/** How long Mote must rest on the glowing fingertip to make it bloom. */
export const DWELL_TO_BLOOM = 0.6;
/** One complete session is three blooms; after that nothing more blooms. */
export const MAX_BLOOMS = 3;
const KNUCKLE_CATCH = 0.011; // how close to a knuckle counts as "entering" a finger
const TIP_ZONE = 0.008;

export interface CreatureState {
  place: Place;
  a: number; // across palm (m), along side axis
  b: number; // along palm (m), along fwd axis
  s: number; // along finger (m)
  va: number;
  vb: number;
  vs: number;
  mood: Mood;
  moodT: number;
  dwellT: number;
  target: FingerName;
  blooms: number;
  edgeHits: number;
  slideTime: number;
}

export const makeCreature = (): CreatureState => ({
  place: 'palm',
  a: 0,
  b: 0,
  s: 0,
  va: 0,
  vb: 0,
  vs: 0,
  mood: 'calm',
  moodT: 0,
  dwellT: 0,
  target: 'middle',
  blooms: 0,
  edgeHits: 0,
  slideTime: 0,
});

export interface StepResult {
  bloomed: boolean;
  bloomFinger: FingerName | null;
}

const g = v3();
const tan = v3();
const pt = v3();

function nextTarget(current: FingerName): FingerName {
  // middle -> index -> ring -> middle ... deterministic for testing.
  const order: FingerName[] = ['middle', 'index', 'ring'];
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

/**
 * Friction-limited gravity on one velocity component.
 * @param gT gravity along the surface direction (scaled)
 * @param press how hard gravity pushes into the surface (scaled, >= 0)
 */
function slide1D(v: number, gT: number, press: number, dt: number): number {
  const resting = Math.abs(v) < 1e-4;
  const stuck = Math.abs(gT) <= MU_STATIC * press;
  if (resting && stuck) return 0;
  const fricDir = resting ? -Math.sign(gT) : -Math.sign(v);
  let nv = v + (gT + fricDir * MU_KINETIC * press) * dt;
  // Came to rest this step (friction won): stop instead of reversing.
  if (!resting && Math.sign(nv) !== Math.sign(v) && stuck) nv = 0;
  return clamp(nv, -MAX_SPEED, MAX_SPEED);
}

/**
 * Advance the creature by dt seconds.
 * @param worldGravity gravity in the same space as the frame (usually 0,-9.81,0)
 */
export function stepCreature(
  st: CreatureState,
  frame: PalmFrame,
  worldGravity: Vec3,
  dt: number,
): StepResult {
  const res: StepResult = { bloomed: false, bloomFinger: null };
  dt = Math.min(dt, 0.05); // never integrate a huge step after a pause
  copy(g, worldGravity);
  g.x *= GRAVITY_SCALE;
  g.y *= GRAVITY_SCALE;
  g.z *= GRAVITY_SCALE;
  const gN = dot(g, frame.normal) / GRAVITY_SCALE; // unscaled, for cling test

  if (st.moodT > 0) st.moodT -= dt;

  // Palm facing sideways/down: hold on tight instead of falling off.
  if (gN > -CLING_NORMAL) {
    st.va = st.vb = st.vs = 0;
    st.dwellT = 0;
    if (st.mood !== 'joy' || st.moodT <= 0) st.mood = 'cling';
    return res;
  }

  const press = Math.max(0, -dot(g, frame.normal));

  if (st.place === 'palm') {
    const ga = dot(g, frame.side);
    const gb = dot(g, frame.fwd);
    st.va = slide1D(st.va, ga, press, dt);
    st.vb = slide1D(st.vb, gb, press, dt);
    st.a += st.va * dt;
    st.b += st.vb * dt;

    const aLim = frame.halfWidth * 0.85;
    if (Math.abs(st.a) > aLim) {
      st.a = Math.sign(st.a) * aLim;
      st.va *= -0.25;
      st.edgeHits++;
    }
    if (st.b < -frame.backLen) {
      st.b = -frame.backLen;
      st.vb *= -0.25;
      st.edgeHits++;
    }
    if (st.b > frame.frontLen) {
      // At the knuckle line: walk out onto the nearest finger if close enough.
      let best: FingerName | null = null;
      let bestD = KNUCKLE_CATCH;
      for (const f of FINGERS) {
        const d = Math.abs(st.a - frame.knuckleA[f]);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      if (best && st.vb > 0) {
        st.place = best;
        st.s = 0;
        st.vs = st.vb;
        st.va = st.vb = 0;
      } else {
        st.b = frame.frontLen;
        st.vb *= -0.25;
        st.edgeHits++;
      }
    }
  } else {
    const f = st.place;
    pointOnPath(frame.path[f], st.s, pt, tan);
    const gT = dot(g, tan);
    st.vs = slide1D(st.vs, gT, press, dt);
    st.s += st.vs * dt;
    const len = frame.pathLen[f];
    if (st.s >= len) {
      st.s = len;
      st.vs = 0;
    }
    if (st.s < 0) {
      // slid back off the finger onto the palm at that knuckle
      st.place = 'palm';
      st.a = frame.knuckleA[f];
      st.b = frame.frontLen - 0.002;
      st.vb = st.vs;
      st.vs = 0;
    }
  }

  // Bloom: resting on the target fingertip.
  const atTip = st.place !== 'palm' && st.s >= frame.pathLen[st.place] - TIP_ZONE;
  if (atTip && st.place === st.target && st.blooms < MAX_BLOOMS) {
    st.dwellT += dt;
    if (st.dwellT >= DWELL_TO_BLOOM) {
      st.blooms++;
      res.bloomed = true;
      res.bloomFinger = st.place;
      st.target = nextTarget(st.target);
      st.dwellT = 0;
      st.mood = 'joy';
      st.moodT = 1.4;
    }
  } else {
    st.dwellT = 0;
  }

  const moving =
    Math.abs(st.va) + Math.abs(st.vb) + Math.abs(st.vs) > 0.004;
  if (moving) st.slideTime += dt;
  if (st.moodT <= 0) st.mood = moving ? 'sliding' : 'calm';
  return res;
}

/** World-space position of the creature's body centre, plus surface normal. */
export function creatureWorld(
  st: CreatureState,
  frame: PalmFrame,
  outPos: Vec3,
): Vec3 {
  if (st.place === 'palm') palmPoint(frame, st.a, st.b, outPos);
  else pointOnPath(frame.path[st.place], st.s, outPos, tan);
  return addScaled(outPos, outPos, frame.normal, BODY_RADIUS);
}

// ---------- guide trail ----------

const gp = [v3(), v3(), v3(), v3(), v3(), v3(), v3(), v3(), v3(), v3()];
const gTmp = v3();

/**
 * Evenly spaced points along the route Mote would take to the target
 * fingertip (palm -> knuckle -> finger joints -> tip). Writes `out.length`
 * points into `out`. Used to draw a light trail; no text needed.
 */
export function guidePath(st: CreatureState, frame: PalmFrame, out: Vec3[]): void {
  let n = 0;
  const push = (p: Vec3) => copy(gp[n++], p);
  creatureWorld(st, frame, gTmp);
  addScaled(gTmp, gTmp, frame.normal, -BODY_RADIUS);
  push(gTmp);
  const t = st.target;
  if (st.place !== 'palm' && st.place !== t) {
    // walk back down the current finger to its knuckle first
    const path = frame.path[st.place];
    let acc = 0;
    let seg = 0;
    for (let i = 0; i < 3; i++) {
      const d = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y, path[i + 1].z - path[i].z);
      if (acc + d >= st.s) break;
      acc += d;
      seg = i + 1;
    }
    for (let i = seg; i >= 0; i--) push(path[i]);
  }
  if (st.place !== t) {
    for (let i = 0; i < 4; i++) push(frame.path[t][i]);
  } else {
    // already on the target finger: continue from current position to the tip
    const path = frame.path[t];
    let acc = 0;
    for (let i = 0; i < 3; i++) {
      const d = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y, path[i + 1].z - path[i].z);
      acc += d;
      if (acc > st.s) push(path[i + 1]);
    }
    if (n === 1) push(path[3]);
  }
  // resample the polyline into out.length evenly spaced points
  let total = 0;
  for (let i = 0; i < n - 1; i++) total += Math.hypot(gp[i + 1].x - gp[i].x, gp[i + 1].y - gp[i].y, gp[i + 1].z - gp[i].z);
  for (let k = 0; k < out.length; k++) {
    let want = out.length === 1 ? total : (total * k) / (out.length - 1);
    let i = 0;
    for (; i < n - 1; i++) {
      const d = Math.hypot(gp[i + 1].x - gp[i].x, gp[i + 1].y - gp[i].y, gp[i + 1].z - gp[i].z);
      if (want <= d || i === n - 2) {
        const tt = d > 1e-6 ? Math.min(1, want / d) : 0;
        out[k].x = gp[i].x + (gp[i + 1].x - gp[i].x) * tt;
        out[k].y = gp[i].y + (gp[i + 1].y - gp[i].y) * tt;
        out[k].z = gp[i].z + (gp[i + 1].z - gp[i].z) * tt;
        break;
      }
      want -= d;
    }
    if (n < 2) copy(out[k], gp[0]);
  }
}
