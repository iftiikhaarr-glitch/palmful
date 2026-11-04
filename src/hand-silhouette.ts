// Laptop emulator only (?emulate): a soft, stylised 3D hand drawn from the
// emulated hand's joints, so the hand reads as one continuous hand (palm,
// thumb, fingers, wrist) with visible volume. Never built on a real headset,
// where the player sees their own hand (and IWSDK's own outline).
//
// Shape: procedural, rebuilt from the tracked joints every frame, so it can
// never drift from the positions the game uses for catching.
//   - each finger and the thumb is ONE smooth tapered tube through its joints
//     (Catmull-Rom), with a rounded fingertip; its root is capped and starts
//     inside the palm, so no gaps or holes
//   - the palm is a closed, rounded "pillow" with a shallow hollow on the palm
//     side; the same surface carries on past the wrist into the forearm (no
//     separate wrist piece), and the forearm end fades into the floor colour
// Rendering: one opaque mesh, one draw call, ordinary depth test. (An earlier
// depth pre-pass + translucent colour pass relied on two shader programs
// giving identical depth, which not every GPU driver guarantees.) Shading is a
// soft view-relative key light plus a restrained cool edge light.
// IWSDK's own hand visual (white outline + an invisible depth "occluder" hand,
// meant for passthrough) is hidden in laptop mode by the system: it hid this
// mesh in real browsers. Positions come straight from the tracked joints; the
// display size only changes thickness.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  GreaterDepth,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  ShaderMaterial,
  Vector3,
} from '@iwsdk/core';
import type { Vec3 } from './palm/math.js';

/** Joint indices (the system's key order): 0 wrist, 1 pinky knuckle,
 *  2-5 index, 6-9 middle, 10-13 ring, 14-16 pinky, 17-20 thumb. */
const FINGERS: Array<{ chain: number[]; r: number[] }> = [
  // knuckle (proximal), intermediate, distal, tip; radius at each (m)
  { chain: [2, 3, 4, 5], r: [0.0086, 0.0077, 0.0069, 0.0064] },
  { chain: [6, 7, 8, 9], r: [0.0089, 0.008, 0.0071, 0.0066] },
  { chain: [10, 11, 12, 13], r: [0.0084, 0.0075, 0.0068, 0.0063] },
  { chain: [1, 14, 15, 16], r: [0.0077, 0.0068, 0.0062, 0.0057] },
];
/** Thumb: metacarpal (thumb base, near the wrist), proximal, distal, tip. */
const THUMB = { chain: [17, 18, 19, 20], r: [0.0132, 0.0104, 0.0089, 0.008] };

export const SKIN_COLOR = '#b9a6a8'; // muted warm grey-rose: reads on the dark room, lets seeds pop
const SHADOW_COLOR = '#3f3446';
const RIM_COLOR = '#b8c8ff';
const FADE_TO = '#221e2b'; // the floor colour: the forearm fades toward it
const DEBUG_OPACITY = 0.3; // &debug=1: see the skeleton through the hand

// Tessellation (per hand ~1.4k vertices, ~2.6k triangles).
const SIDES = 12; // around each finger
const PER_SEG = 4; // samples per joint-to-joint segment
const CAP = 4; // rings in a fingertip cap
const PALM_AROUND = 20; // around the palm cross-section
const PALM_ROWS = 9; // wrist -> knuckles
/** Rows of the same surface continued past the wrist into the forearm (no separate cuff). */
const FOREARM_V = [-0.62, -0.5, -0.38, -0.27, -0.17, -0.08];
const ROWS = FOREARM_V.length + PALM_ROWS;
/** Where along the hand each row sits: <0 forearm, 0 wrist, 1 knuckles (x wrist-to-knuckle length). */
const ROW_V = [...FOREARM_V, ...Array.from({ length: PALM_ROWS }, (_, r) => r / (PALM_ROWS - 1))];

// Palm proportions (m).
const PALM_FRONT = 0.0108; // palm-side half thickness (skin sits ~1 cm out, where the seed rests)
const PALM_BACK = 0.0092; // back-of-hand half thickness
const PALM_HOLLOW = 0.0018; // shallow dip in the middle of the palm
const KNUCKLE_EDGE = 0.45; // palm edge reaches this far past the outer knuckles (x knuckle spacing)
const WRIST_HALF_W = 0.022; // half width of the wrist where it meets the palm
const WRIST_T = 0.0118; // wrist / forearm half thickness

const VERTEX = /* glsl */ `
  attribute float alpha;
  varying vec3 vN;
  varying vec3 vV;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    vA = alpha;
    gl_Position = projectionMatrix * mv;
  }`;

interface Tube {
  start: number; // first vertex
  rings: number;
  sides: number;
}

const WHITE = new Color('#ffffff');
const tmpA = new Vector3();
const tmpB = new Vector3();

/** Smooth hand, see file header. One per tracked hand. */
export class HandSilhouette {
  readonly group = new Group();
  private geo = new BufferGeometry();
  private pos: Float32Array;
  private nrmArr: Float32Array;
  private idx: Uint32Array;
  private colorMat: ShaderMaterial;
  private fingerTubes: Tube[] = [];
  private thumbTube!: Tube;
  private palmStart = 0;
  private palmCapStart = 0;
  // hand frame
  private fwd = new Vector3();
  private side = new Vector3();
  private nrm = new Vector3();
  // scratch, allocated once
  private ctrl: Vector3[] = Array.from({ length: 7 }, () => new Vector3());
  private ctrlR = new Float32Array(7);
  private samp: Vector3[] = Array.from({ length: 6 * PER_SEG + 2 }, () => new Vector3());
  private sampR = new Float32Array(6 * PER_SEG + 2);
  private tan = new Vector3();
  private bvec = new Vector3();
  private uvec = new Vector3();
  private v = new Vector3();
  private row: Vector3[] = Array.from({ length: 6 }, () => new Vector3());

  private left = false;

  /** `debug`: faint, see-through hand so the full skeleton shows. */
  constructor(debug = false) {
    const index: number[] = [];
    let v = 0;
    const tube = (rings: number, sides: number, closeEnd: boolean, closeStart = false): Tube => {
      const t = { start: v, rings, sides };
      for (let r = 0; r < rings - 1; r++) {
        for (let s = 0; s < sides; s++) {
          const a = v + r * sides + s;
          const b = v + r * sides + ((s + 1) % sides);
          const c = a + sides;
          const d = b + sides;
          index.push(a, c, b, b, c, d);
        }
      }
      v += rings * sides;
      if (closeEnd) {
        // fan the last ring onto a centre vertex
        const last = v - sides;
        for (let s = 0; s < sides; s++) index.push(last + s, v, last + ((s + 1) % sides));
        v += 1;
      }
      if (closeStart) {
        // fan the first ring too, so an open root never shows inside the palm
        for (let s = 0; s < sides; s++) index.push(t.start + ((s + 1) % sides), v, t.start + s);
        v += 1;
      }
      return t;
    };
    const fingerRings = 4 * PER_SEG + 1 + CAP; // 1 lead-in segment + 3 bones
    for (let f = 0; f < FINGERS.length; f++) this.fingerTubes.push(tube(fingerRings, SIDES, true, true));
    this.thumbTube = tube(fingerRings, SIDES, true, true);
    this.palmStart = v;
    tube(ROWS, PALM_AROUND, false); // forearm + wrist + palm: one continuous surface
    // close both palm ends with fans
    this.palmCapStart = v;
    const p0 = this.palmStart;
    const pl = this.palmStart + (ROWS - 1) * PALM_AROUND;
    for (let s = 0; s < PALM_AROUND; s++) {
      index.push(p0 + ((s + 1) % PALM_AROUND), p0 + s, v);
      index.push(pl + s, pl + ((s + 1) % PALM_AROUND), v + 1);
    }
    v += 2;

    this.pos = new Float32Array(v * 3);
    const alpha = new Float32Array(v).fill(1);
    // forearm: full colour up to just below the wrist, then fading into the floor
    for (let r = 0; r < ROWS; r++) {
      const a = Math.min(1, Math.max(0, (ROW_V[r] + 0.62) / 0.4));
      for (let q = 0; q < PALM_AROUND; q++) alpha[this.palmStart + r * PALM_AROUND + q] = a * a * (3 - 2 * a);
    }
    alpha[this.palmCapStart] = 0; // forearm end cap
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.nrmArr = new Float32Array(v * 3);
    this.idx = Uint32Array.from(index);
    this.geo.setAttribute('normal', new BufferAttribute(this.nrmArr, 3));
    this.geo.setAttribute('alpha', new BufferAttribute(alpha, 1));
    this.geo.setIndex(index);

    this.colorMat = new ShaderMaterial({
      uniforms: {
        uBase: { value: new Color(SKIN_COLOR) },
        uShadow: { value: new Color(SHADOW_COLOR) },
        uRim: { value: new Color(RIM_COLOR) },
        uFadeTo: { value: new Color(FADE_TO) },
        uOpacity: { value: debug ? DEBUG_OPACITY : 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: /* glsl */ `
        uniform vec3 uBase;
        uniform vec3 uShadow;
        uniform vec3 uRim;
        uniform vec3 uFadeTo;
        uniform float uOpacity;
        varying vec3 vN;
        varying vec3 vV;
        varying float vA;
        void main() {
          vec3 n = normalize(vN);
          if (!gl_FrontFacing) n = -n;
          vec3 v = normalize(vV);
          if (dot(n, v) < 0.0) n = -n; // always shade the side facing the viewer
          // soft key light from above and slightly left of the viewer, wrapped
          vec3 L = normalize(vec3(-0.35, 0.85, 0.45));
          float key = clamp((dot(n, L) + 0.35) / 1.35, 0.0, 1.0);
          key = key * key * (3.0 - 2.0 * key);
          vec3 col = mix(uShadow, uBase, 0.18 + 0.82 * key);
          // restrained edge light so the curves read against the dark room
          float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.6);
          col += uRim * fres * 0.32;
          // forearm end: a fine screen-door fade (the mesh stays opaque, so it
          // never depends on draw order), softened toward the floor colour
          if (uOpacity >= 1.0) {
            float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            if (vA < n * 0.98 + 0.01) discard;
          }
          col = mix(uFadeTo, col, vA);
          gl_FragColor = vec4(col, uOpacity * (uOpacity >= 1.0 ? 1.0 : vA));
          #include <colorspace_fragment>
        }`,
      // Opaque, one pass, ordinary depth test: nothing here depends on two
      // shader programs producing bit-identical depth (which some GPU drivers
      // do not guarantee). Debug only: faint and see-through.
      transparent: debug,
      depthWrite: !debug,
      side: DoubleSide,
    });
    const color = new Mesh(this.geo, this.colorMat);
    color.frustumCulled = false;
    this.group.add(color);
  }

  /** Update from joint positions (`at(i)`), thickness factor `k`, visibility, handedness. */
  update(at: (i: number) => Vec3, k: number, visible: boolean, left = false): void {
    this.left = left;
    this.group.visible = visible;
    if (!visible) return;
    if (!this.frame(at)) {
      this.group.visible = false;
      return;
    }
    const kp = 1 + (k - 1) * 0.5; // palm thickness changes less than the fingers
    for (let f = 0; f < FINGERS.length; f++) this.finger(at, FINGERS[f].chain, FINGERS[f].r, k, this.fingerTubes[f], false);
    this.finger(at, THUMB.chain, THUMB.r, k, this.thumbTube, true);
    this.palm(at, kp);
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    this.normals();
  }

  /** Area-weighted vertex normals, in place (three's computeVertexNormals allocates per call). */
  private normals(): void {
    const p = this.pos;
    const n = this.nrmArr;
    const idx = this.idx;
    n.fill(0);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
      const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
      n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
      n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
    (this.geo.getAttribute('normal') as BufferAttribute).needsUpdate = true;
  }

  /** Hand frame: fwd (wrist to middle knuckle), side (pinky to index), palm normal. */
  private frame(at: (i: number) => Vec3): boolean {
    const w = at(0);
    const m = at(6);
    const ix = at(2);
    const pk = at(1);
    this.fwd.set(m.x - w.x, m.y - w.y, m.z - w.z);
    if (this.fwd.lengthSq() < 1e-6) return false;
    this.fwd.normalize();
    this.side.set(ix.x - pk.x, ix.y - pk.y, ix.z - pk.z);
    this.side.addScaledVector(this.fwd, -this.side.dot(this.fwd));
    if (this.side.lengthSq() < 1e-8) return false;
    this.side.normalize();
    // same convention as computePalmFrame: the normal points out of the palm
    if (this.left) this.nrm.crossVectors(this.fwd, this.side);
    else this.nrm.crossVectors(this.side, this.fwd);
    return true;
  }

  private put(v: number, p: Vector3): void {
    const o = v * 3;
    this.pos[o] = p.x;
    this.pos[o + 1] = p.y;
    this.pos[o + 2] = p.z;
  }

  /**
   * One finger (or the thumb) as a single smooth tube: a lead-in that starts
   * inside the palm, the three bones through the joints, and a rounded tip.
   */
  private finger(at: (i: number) => Vec3, chain: number[], radii: number[], k: number, t: Tube, thumb: boolean): void {
    const c = this.ctrl;
    const cr = this.ctrlR;
    for (let i = 0; i < 4; i++) {
      const j = at(chain[i]);
      c[i + 1].set(j.x, j.y, j.z);
      cr[i + 1] = radii[i] * k;
    }
    // lead-in point, buried in the palm so the root never shows a seam
    if (thumb) {
      // toward the heel of the hand (thenar mound)
      c[0].copy(c[1]).sub(c[2]).multiplyScalar(0.35).add(c[1]);
      c[0].addScaledVector(this.side, -0.012).addScaledVector(this.nrm, -0.003);
      cr[0] = cr[1] * 1.05;
    } else {
      c[0].copy(c[1]).addScaledVector(this.fwd, -0.016).addScaledVector(this.nrm, -0.001);
      cr[0] = cr[1] * 1.08;
    }
    // phantom end points for Catmull-Rom
    const n = 5; // c[0..4]
    c[5].copy(c[4]).multiplyScalar(2).sub(c[3]);
    c[6].copy(c[0]).multiplyScalar(2).sub(c[1]); // before c[0]
    // samples
    let s = 0;
    for (let seg = 0; seg < n - 1; seg++) {
      const p0 = seg === 0 ? c[6] : c[seg - 1];
      const p1 = c[seg];
      const p2 = c[seg + 1];
      const p3 = c[seg + 2];
      for (let q = 0; q < PER_SEG; q++) {
        const u = q / PER_SEG;
        catmull(this.samp[s], p0, p1, p2, p3, u);
        this.sampR[s] = cr[seg] + (cr[seg + 1] - cr[seg]) * u;
        s++;
      }
    }
    this.samp[s].copy(c[4]);
    this.sampR[s] = cr[4];
    s++;
    // rings along the samples, parallel-transported basis
    const tipDir = this.tan;
    let v = t.start;
    this.bvec.copy(thumb ? this.nrm : this.side);
    for (let i = 0; i < s; i++) {
      const a = this.samp[i > 0 ? i - 1 : 0];
      const b = this.samp[i < s - 1 ? i + 1 : s - 1];
      tipDir.subVectors(b, a).normalize();
      this.bvec.addScaledVector(tipDir, -this.bvec.dot(tipDir));
      if (this.bvec.lengthSq() < 1e-10) this.bvec.copy(this.nrm).addScaledVector(tipDir, -this.nrm.dot(tipDir));
      this.bvec.normalize();
      this.uvec.crossVectors(tipDir, this.bvec);
      v = this.ring(v, this.samp[i], this.sampR[i], this.sampR[i] * (thumb ? 0.92 : 0.9), t.sides);
    }
    // rounded fingertip: a squashed hemisphere past the tip joint
    const tip = this.samp[s - 1];
    const rT = this.sampR[s - 1];
    for (let q = 1; q <= CAP; q++) {
      const ang = (q / (CAP + 0.35)) * (Math.PI / 2);
      this.v.copy(tip).addScaledVector(tipDir, rT * 0.85 * Math.sin(ang));
      const rr = rT * Math.cos(ang);
      v = this.ring(v, this.v, rr, rr * 0.9, t.sides);
    }
    this.v.copy(tip).addScaledVector(tipDir, rT * 0.85);
    this.put(v, this.v);
    // root cap centre: the first sample (inside the palm)
    this.put(v + 1, this.samp[0]);
  }

  /** Write one ring of `sides` vertices around `p` in the current (bvec, uvec) basis. */
  private ring(v: number, p: Vector3, rb: number, ru: number, sides: number): number {
    for (let q = 0; q < sides; q++) {
      const a = (q / sides) * Math.PI * 2;
      const cb = Math.cos(a) * rb;
      const su = Math.sin(a) * ru;
      const o = v * 3;
      this.pos[o] = p.x + this.bvec.x * cb + this.uvec.x * su;
      this.pos[o + 1] = p.y + this.bvec.y * cb + this.uvec.y * su;
      this.pos[o + 2] = p.z + this.bvec.z * cb + this.uvec.z * su;
      v++;
    }
    return v;
  }

  /**
   * Palm: rows from the wrist to just past the knuckle line. Each row is a
   * closed, flattened oval (wide, rounded edges) around a centre line that
   * follows the actual knuckle positions.
   */
  private palm(at: (i: number) => Vec3, kp: number): void {
    const w = at(0);
    // knuckle line: pinky edge, pinky, ring, middle, index, index edge
    const row = this.row;
    const kpk = at(1), kr = at(10), km = at(6), ki = at(2);
    row[1].set(kpk.x, kpk.y, kpk.z);
    row[2].set(kr.x, kr.y, kr.z);
    row[3].set(km.x, km.y, km.z);
    row[4].set(ki.x, ki.y, ki.z);
    row[0].copy(row[1]).sub(row[2]).multiplyScalar(KNUCKLE_EDGE).add(row[1]);
    row[5].copy(row[4]).sub(row[3]).multiplyScalar(KNUCKLE_EDGE).add(row[4]);
    const halfK = row[0].distanceTo(row[5]) / 2;
    const palmLen = Math.hypot(km.x - w.x, km.y - w.y, km.z - w.z);
    const env0 = Math.pow(Math.sin(Math.PI * 0.3), 0.45);
    let v = this.palmStart;
    for (let r = 0; r < ROWS; r++) {
      const vr = ROW_V[r]; // <0 forearm, 0 wrist .. 1 knuckles
      if (vr < 0) {
        v = this.forearmRow(v, w, vr, palmLen, kp, env0);
        continue;
      }
      // end rows are thinner so the pillow rounds off
      const env = Math.pow(Math.sin(Math.PI * (0.3 + 0.62 * vr)), 0.45);
      // width grows quickly from the wrist, widest a little below the knuckles
      const wv = 1 - (1 - vr) * (1 - vr);
      const bulge = 0.0035 * Math.sin(Math.PI * vr);
      for (let q = 0; q < PALM_AROUND; q++) {
        const ang = (q / PALM_AROUND) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const a = Math.sign(ca) * Math.pow(Math.abs(ca), 0.55); // -1 pinky .. +1 index
        // point on the knuckle line at a
        const x = ((a + 1) / 2) * 5;
        const i0 = Math.min(4, Math.floor(x));
        const f = x - i0;
        tmpA.copy(row[i0]).lerp(row[i0 + 1], f);
        // point on the wrist line at a
        tmpB.set(w.x, w.y, w.z).addScaledVector(this.fwd, -0.002).addScaledVector(this.side, a * WRIST_HALF_W);
        // blend: along the hand linearly, across the hand faster (wide palm)
        this.v.copy(tmpB).lerp(tmpA, vr);
        const across = a * (halfK - WRIST_HALF_W) * (wv - vr);
        this.v.addScaledVector(this.side, across + a * bulge);
        // thickness: palm side a little thicker, with a shallow hollow in the middle
        let h: number;
        if (sa >= 0) {
          const dip = PALM_HOLLOW * (1 - a * a) * Math.sin(Math.PI * vr);
          h = (PALM_FRONT * kp * Math.pow(sa, 0.8) - dip * sa) * env;
        } else {
          h = -PALM_BACK * kp * Math.pow(-sa, 0.8) * env;
        }
        this.v.addScaledVector(this.nrm, h);
        this.put(v++, this.v);
      }
    }
    // end caps: the centre of the first and last rows
    for (const [r, cap] of [
      [0, this.palmCapStart],
      [ROWS - 1, this.palmCapStart + 1],
    ] as const) {
      this.v.set(0, 0, 0);
      const base = this.palmStart + r * PALM_AROUND;
      for (let q = 0; q < PALM_AROUND; q++) {
        const o = (base + q) * 3;
        this.v.x += this.pos[o] / PALM_AROUND;
        this.v.y += this.pos[o + 1] / PALM_AROUND;
        this.v.z += this.pos[o + 2] / PALM_AROUND;
      }
      this.put(cap, this.v);
    }
  }

  /**
   * Wrist and forearm: the palm's own surface carried on past the wrist joint
   * (same cross-section loop), easing from the flat palm heel into a rounder,
   * slightly narrower wrist, so palm and wrist are one shape with no seam.
   */
  private forearmRow(v: number, w: Vec3, vr: number, palmLen: number, kp: number, env0: number): number {
    const s = Math.min(1, -vr / 0.2);
    const blend = s * s * (3 - 2 * s); // 0 at the wrist joint, 1 a little way down the arm
    const hw = WRIST_HALF_W * (1 - 0.07 * blend) + 0.0025 * Math.max(0, (-vr - 0.25) / 0.37);
    const tf = PALM_FRONT * env0 * kp + (WRIST_T * kp - PALM_FRONT * env0 * kp) * blend;
    const tb = PALM_BACK * env0 * kp + (WRIST_T * kp - PALM_BACK * env0 * kp) * blend;
    const ex = 0.55 + 0.25 * blend; // flat palm heel -> rounder wrist
    for (let q = 0; q < PALM_AROUND; q++) {
      const ang = (q / PALM_AROUND) * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const a = Math.sign(ca) * Math.pow(Math.abs(ca), ex);
      const h = sa >= 0 ? tf * Math.pow(sa, 0.8) : -tb * Math.pow(-sa, 0.8);
      this.v.set(w.x, w.y, w.z)
        .addScaledVector(this.fwd, vr * palmLen - 0.002)
        .addScaledVector(this.side, a * hw)
        .addScaledVector(this.nrm, h);
      this.put(v++, this.v);
    }
    return v;
  }
}

/** Uniform Catmull-Rom between p1 and p2 at u in [0,1]. */
function catmull(out: Vector3, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, u: number): void {
  const u2 = u * u;
  const u3 = u2 * u;
  const f0 = -0.5 * u3 + u2 - 0.5 * u;
  const f1 = 1.5 * u3 - 2.5 * u2 + 1;
  const f2 = -1.5 * u3 + 2 * u2 + 0.5 * u;
  const f3 = 0.5 * u3 - 0.5 * u2;
  out.set(
    p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
    p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3,
    p0.z * f0 + p1.z * f1 + p2.z * f2 + p3.z * f3,
  );
}

/**
 * Laptop view only: draw the parts of `obj` that the hand hides as a faint
 * see-through copy (depth test reversed), so cues such as the landing ring,
 * a seed or a flower inside a fist are never fully lost behind the hand.
 * Shares geometry; `sync` copies colour/opacity from the source each frame
 * for materials that change (the ring). Returns the copies.
 */
export function addSeeThrough(obj: Object3D, opacity: number, lighten = 0): Mesh[] {
  const made: Mesh[] = [];
  const meshes: Mesh[] = [];
  obj.traverse((o) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh);
  });
  for (const m of meshes) {
    const src = m.material as Material & { color?: Color };
    const mat = new MeshBasicMaterial({
      // `lighten`: soften toward white, so e.g. a green stem never reads as the green catch cue
      color: (src.color ? src.color.clone() : new Color('#ffffff')).lerp(WHITE, lighten),
      transparent: true,
      opacity,
      depthWrite: false,
      depthFunc: GreaterDepth,
      side: DoubleSide,
      toneMapped: false,
    });
    const x = new Mesh(m.geometry, mat);
    x.name = 'see-through';
    x.renderOrder = 22; // after the hand's depth (20) and colour (21) passes
    m.add(x);
    made.push(x);
  }
  return made;
}
