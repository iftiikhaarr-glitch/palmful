// Builds simple synthetic hand joints (palm up, fingers pointing -Z) and
// rotates them about the wrist, so the simulation can be tested without XR.

import { type FingerName, type HandJoints, makeHandJoints } from '../src/palm/hand-frame.ts';
import { type Vec3, set } from '../src/palm/math.ts';

const SEG = [0.045, 0.026, 0.02]; // proximal, intermediate, distal lengths

export interface SynthOptions {
  handedness?: 'left' | 'right';
  /** degrees; positive tips the fingers DOWN */
  pitchDeg?: number;
  /** degrees; positive rolls the index side DOWN */
  rollDeg?: number;
  /** curl applied to every finger joint, degrees (cup) */
  curlDeg?: number;
  /** random jitter amplitude in metres */
  jitter?: number;
  rand?: () => number;
  /** translate the whole hand (applied after rotation) */
  offset?: { x: number; y: number; z: number };
}

function rot(p: Vec3, wrist: Vec3, pitch: number, roll: number, sideSign: number): void {
  // translate to wrist
  let x = p.x - wrist.x;
  let y = p.y - wrist.y;
  let z = p.z - wrist.z;
  // roll about the fwd (Z) axis: index side down
  const r = roll * sideSign;
  const cr = Math.cos(r);
  const sr = Math.sin(r);
  const x1 = x * cr + y * sr;
  const y1 = -x * sr + y * cr;
  x = x1;
  y = y1;
  // pitch about X: fingertips (at -z) go down
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y2 = y * cp + z * sp;
  const z2 = -y * sp + z * cp;
  p.x = x + wrist.x;
  p.y = y2 + wrist.y;
  p.z = z2 + wrist.z;
}

export function synthHand(opts: SynthOptions = {}, out: HandJoints = makeHandJoints()): HandJoints {
  const hand = opts.handedness ?? 'right';
  const sx = hand === 'right' ? 1 : -1; // index side is +X for right palm-up
  const pitch = ((opts.pitchDeg ?? 0) * Math.PI) / 180;
  const roll = ((opts.rollDeg ?? 0) * Math.PI) / 180;
  const curl = ((opts.curlDeg ?? 0) * Math.PI) / 180;
  const j = opts.jitter ?? 0;
  const rnd = opts.rand ?? Math.random;
  const jit = (p: Vec3) => {
    if (!j) return;
    p.x += (rnd() * 2 - 1) * j;
    p.y += (rnd() * 2 - 1) * j;
    p.z += (rnd() * 2 - 1) * j;
  };

  const wrist = set(out.wrist, 0, 1, 0);
  const knuckles: Record<FingerName, [number, number]> = {
    index: [0.024 * sx, -0.088],
    middle: [0.002 * sx, -0.094],
    ring: [-0.019 * sx, -0.088],
  };
  set(out.pinkyProx, -0.038 * sx, 1, -0.078);

  for (const f of ['index', 'middle', 'ring'] as const) {
    const pts = out.finger[f];
    const [kx, kz] = knuckles[f];
    set(pts[0], kx, 1, kz);
    // walk along -Z, curling upward (toward +Y, i.e. toward the palm normal)
    let y = 1;
    let z = kz;
    let ang = 0;
    for (let i = 0; i < 3; i++) {
      ang += curl;
      z -= SEG[i] * Math.cos(ang);
      y += SEG[i] * Math.sin(ang);
      set(pts[i + 1], kx, y, z);
    }
  }

  const all: Vec3[] = [out.pinkyProx, ...out.finger.index, ...out.finger.middle, ...out.finger.ring];
  for (const p of all) rot(p, wrist, pitch, roll, sx);
  for (const p of [out.wrist, ...all]) jit(p);
  if (opts.offset) {
    for (const p of [out.wrist, ...all]) {
      p.x += opts.offset.x;
      p.y += opts.offset.y;
      p.z += opts.offset.z;
    }
  }
  return out;
}

/** Deterministic PRNG for repeatable jitter tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
