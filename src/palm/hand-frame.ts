// Turns raw WebXR hand-joint positions into a "palm frame": a small surface
// coordinate system the creature lives on, plus a polyline along each finger.
//
// Axis convention (verified against the emulator in test/emulator-run.mjs):
//   side   (S): pinky knuckle -> index knuckle
//   fwd    (F): wrist -> middle knuckle
//   normal (N): out of the palm (the side the creature stands on)

import {
  type Vec3,
  addScaled,
  copy,
  cross,
  distance,
  dot,
  lerp,
  normalize,
  sub,
  v3,
} from './math.js';

export const FINGERS = ['index', 'middle', 'ring'] as const;
export type FingerName = (typeof FINGERS)[number];

/** Joint positions needed by Palmful, in tracking (XR origin) space. */
export interface HandJoints {
  wrist: Vec3;
  pinkyProx: Vec3;
  /** proximal, intermediate, distal, tip for each finger */
  finger: Record<FingerName, [Vec3, Vec3, Vec3, Vec3]>;
}

export const makeHandJoints = (): HandJoints => ({
  wrist: v3(),
  pinkyProx: v3(),
  finger: {
    index: [v3(), v3(), v3(), v3()],
    middle: [v3(), v3(), v3(), v3()],
    ring: [v3(), v3(), v3(), v3()],
  },
});

/** WebXR joint names, per field, so the system can fill HandJoints. */
export const JOINT_NAMES = {
  wrist: 'wrist',
  pinkyProx: 'pinky-finger-phalanx-proximal',
  finger: {
    index: [
      'index-finger-phalanx-proximal',
      'index-finger-phalanx-intermediate',
      'index-finger-phalanx-distal',
      'index-finger-tip',
    ],
    middle: [
      'middle-finger-phalanx-proximal',
      'middle-finger-phalanx-intermediate',
      'middle-finger-phalanx-distal',
      'middle-finger-tip',
    ],
    ring: [
      'ring-finger-phalanx-proximal',
      'ring-finger-phalanx-intermediate',
      'ring-finger-phalanx-distal',
      'ring-finger-tip',
    ],
  },
} as const;

export interface PalmFrame {
  center: Vec3;
  side: Vec3;
  fwd: Vec3;
  normal: Vec3;
  /** half the palm width (metres), across S */
  halfWidth: number;
  /** distance from center back toward the wrist the creature may walk */
  backLen: number;
  /** distance from center forward to the knuckle line */
  frontLen: number;
  /** knuckle positions along S, per finger, in palm coordinates */
  knuckleA: Record<FingerName, number>;
  /** finger polylines (knuckle..tip), already lifted onto the skin */
  path: Record<FingerName, [Vec3, Vec3, Vec3, Vec3]>;
  pathLen: Record<FingerName, number>;
}

export const makePalmFrame = (): PalmFrame => ({
  center: v3(),
  side: v3(),
  fwd: v3(),
  normal: v3(),
  halfWidth: 0.04,
  backLen: 0.03,
  frontLen: 0.04,
  knuckleA: { index: 0.02, middle: 0, ring: -0.02 },
  path: {
    index: [v3(), v3(), v3(), v3()],
    middle: [v3(), v3(), v3(), v3()],
    ring: [v3(), v3(), v3(), v3()],
  },
  pathLen: { index: 0, middle: 0, ring: 0 },
});

/** Height of the skin surface above joint centres (joints sit inside the hand). */
export const PALM_SKIN = 0.012;
export const FINGER_SKIN = 0.008;

const tmpA = v3();
const tmpB = v3();

/**
 * Fill `out` from joints. Returns false if the geometry is degenerate
 * (which happens briefly when tracking is lost or a hand is edge-on).
 */
export function computePalmFrame(
  j: HandJoints,
  handedness: 'left' | 'right',
  out: PalmFrame,
): boolean {
  const indexK = j.finger.index[0];
  const middleK = j.finger.middle[0];
  const ringK = j.finger.ring[0];

  sub(tmpA, middleK, j.wrist);
  const palmLen = distance(middleK, j.wrist);
  if (palmLen < 0.03) return false;
  normalize(out.fwd, tmpA);

  sub(tmpB, indexK, j.pinkyProx);
  const width = distance(indexK, j.pinkyProx);
  if (width < 0.02) return false;
  // Gram-Schmidt: make side perpendicular to fwd.
  addScaled(tmpB, tmpB, out.fwd, -dot(tmpB, out.fwd));
  normalize(out.side, tmpB);

  if (handedness === 'right') cross(out.normal, out.side, out.fwd);
  else cross(out.normal, out.fwd, out.side);
  normalize(out.normal, out.normal);

  lerp(out.center, j.wrist, middleK, 0.55);
  addScaled(out.center, out.center, out.normal, PALM_SKIN);

  out.halfWidth = width * 0.5;
  out.frontLen = palmLen * 0.45;
  out.backLen = palmLen * 0.35;

  // Knuckle positions across the palm (a coordinate).
  for (const f of [
    ['index', indexK],
    ['middle', middleK],
    ['ring', ringK],
  ] as const) {
    sub(tmpA, f[1], out.center);
    out.knuckleA[f[0]] = dot(tmpA, out.side);
  }

  // Finger polylines lifted onto the palm-side skin. The first point is the
  // knuckle projected onto the palm surface so the path joins the palm edge.
  for (const name of ['index', 'middle', 'ring'] as const) {
    const src = j.finger[name];
    const dst = out.path[name];
    for (let i = 0; i < 4; i++) {
      addScaled(dst[i], src[i], out.normal, i === 0 ? PALM_SKIN : FINGER_SKIN);
    }
    out.pathLen[name] =
      distance(dst[0], dst[1]) + distance(dst[1], dst[2]) + distance(dst[2], dst[3]);
  }
  return true;
}

/** Point and unit tangent at arc length `s` along a finger path. */
export function pointOnPath(
  path: [Vec3, Vec3, Vec3, Vec3],
  s: number,
  outPoint: Vec3,
  outTangent: Vec3,
): void {
  let remaining = Math.max(0, s);
  for (let i = 0; i < 3; i++) {
    const a = path[i];
    const b = path[i + 1];
    const seg = distance(a, b);
    if (remaining <= seg || i === 2) {
      const t = seg > 1e-6 ? Math.min(1, remaining / seg) : 0;
      lerp(outPoint, a, b, t);
      sub(outTangent, b, a);
      normalize(outTangent, outTangent);
      return;
    }
    remaining -= seg;
  }
  copy(outPoint, path[3]);
}

/** Palm (a, b) coordinates to a world point on the palm surface. */
export function palmPoint(frame: PalmFrame, a: number, b: number, out: Vec3): Vec3 {
  addScaled(out, frame.center, frame.side, a);
  return addScaled(out, out, frame.fwd, b);
}

/**
 * One Euro filter (Casiez et al. 2012) for a 3D point: smooths slow motion
 * heavily and fast motion lightly, which suits hand-tracking jitter.
 */
export class OneEuro3 {
  private hasPrev = false;
  private prev = v3();
  private dPrev = v3();
  constructor(
    private minCutoff = 1.5,
    private beta = 8,
    private dCutoff = 1,
  ) {}

  reset(): void {
    this.hasPrev = false;
  }

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: Vec3, dt: number, out: Vec3): Vec3 {
    if (!this.hasPrev || dt <= 0) {
      copy(this.prev, x);
      this.dPrev.x = this.dPrev.y = this.dPrev.z = 0;
      this.hasPrev = true;
      return copy(out, x);
    }
    const ad = OneEuro3.alpha(this.dCutoff, dt);
    const dx = (x.x - this.prev.x) / dt;
    const dy = (x.y - this.prev.y) / dt;
    const dz = (x.z - this.prev.z) / dt;
    this.dPrev.x += ad * (dx - this.dPrev.x);
    this.dPrev.y += ad * (dy - this.dPrev.y);
    this.dPrev.z += ad * (dz - this.dPrev.z);
    const speed = Math.sqrt(
      this.dPrev.x ** 2 + this.dPrev.y ** 2 + this.dPrev.z ** 2,
    );
    const a = OneEuro3.alpha(this.minCutoff + this.beta * speed, dt);
    this.prev.x += a * (x.x - this.prev.x);
    this.prev.y += a * (x.y - this.prev.y);
    this.prev.z += a * (x.z - this.prev.z);
    return copy(out, this.prev);
  }
}

/**
 * Mean distance (m) from the index, middle and ring fingertips to the wrist.
 * Open hand is roughly 0.17-0.19 m; a closed fist roughly 0.08-0.10 m.
 */
export function fingertipReach(j: HandJoints): number {
  return (
    (distance(j.finger.index[3], j.wrist) +
      distance(j.finger.middle[3], j.wrist) +
      distance(j.finger.ring[3], j.wrist)) /
    3
  );
}

/** Below this fingertip reach the hand counts as a fist. */
export const FIST_REACH = 0.12;

/**
 * How cupped the hand is, 0 (flat) .. 1 (fingers curled up past 90 degrees).
 * For index, middle and ring: the elevation of the knuckle->tip vector above
 * the palm plane (toward the palm normal), averaged, divided by 90 degrees.
 * Scale-invariant, so it works for any hand size.
 */
export function cupAmount(j: HandJoints, frame: PalmFrame): number {
  let sum = 0;
  for (const f of FINGERS) {
    const k = j.finger[f][0];
    const t = j.finger[f][3];
    const vx = t.x - k.x;
    const vy = t.y - k.y;
    const vz = t.z - k.z;
    const up = vx * frame.normal.x + vy * frame.normal.y + vz * frame.normal.z;
    const along = vx * frame.fwd.x + vy * frame.fwd.y + vz * frame.fwd.z;
    sum += Math.atan2(up, along);
  }
  const deg = (sum / FINGERS.length) * (180 / Math.PI);
  return deg <= 0 ? 0 : deg >= 90 ? 1 : deg / 90;
}
