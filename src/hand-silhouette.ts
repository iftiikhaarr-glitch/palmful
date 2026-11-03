// Laptop emulator only (?emulate): a soft, translucent hand silhouette drawn
// over the emulated hand's joints, so the hand reads as a hand (palm, fingers,
// thumb) instead of a bright skeleton. Never built on a real headset, where
// the player sees their own hand (and IWSDK's own outline).
//
// Rendering: every shape is drawn twice. First a depth-only pass, then a
// translucent colour pass that only draws the front-most surface
// (depthFunc LessEqual). Overlapping finger parts therefore do not double up
// into bright blotches, and the whole hand has one even translucency.
// Positions come straight from the tracked joints; the display size only
// changes thickness, so the silhouette stays aligned with the ring and seed.

import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LessEqualDepth,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import type { Vec3 } from './palm/math.js';

/** Joint indices (the system's key order): 0 wrist, 1 pinky knuckle,
 *  2-5 index, 6-9 middle, 10-13 ring, 14-16 pinky, 17-20 thumb. */
const SEGMENTS: Array<[number, number, number]> = [
  // [from, to, radius m]
  [2, 3, 0.0085], [3, 4, 0.0078], [4, 5, 0.007],
  [6, 7, 0.0088], [7, 8, 0.008], [8, 9, 0.0072],
  [10, 11, 0.0083], [11, 12, 0.0076], [12, 13, 0.0068],
  [1, 14, 0.0074], [14, 15, 0.0066], [15, 16, 0.006],
  [0, 17, 0.0115], [17, 18, 0.0098], [18, 19, 0.0088], [19, 20, 0.0078],
];
/** Palm outline: wrist, thumb base, index, middle, ring and pinky knuckles. */
const PALM = [0, 17, 2, 6, 10, 1];
const PALM_INFLATE = 0.011; // the palm reaches past the knuckles, closing the finger webs

export const SILHOUETTE_COLOR = '#e9d3c0';
export const SILHOUETTE_OPACITY = 0.3;

const UP = new Vector3(0, 1, 0);

/**
 * All parts (finger capsules, joint caps, palm) live in ONE geometry that is
 * rebuilt from the joints each frame, so the whole hand costs two draw calls
 * (depth pass + colour pass) instead of one per part.
 */
export class HandSilhouette {
  readonly group = new Group();
  private geo = new BufferGeometry();
  private pos: Float32Array;
  private cyl: Float32Array; // unit cylinder template positions
  private sph: Float32Array; // unit sphere template positions
  private caps: Array<{ i: number; r: number }> = [];
  private palmStart = 0;
  private m = new Matrix4();
  private q = new Quaternion();
  private sc = new Vector3();
  private p = new Vector3();
  private dir = new Vector3();
  private c = new Vector3();

  constructor() {
    const cylGeo = new CylinderGeometry(1, 1, 1, 10, 1, true);
    const sphGeo = new SphereGeometry(1, 10, 7);
    this.cyl = (cylGeo.getAttribute('position').array as Float32Array).slice();
    this.sph = (sphGeo.getAttribute('position').array as Float32Array).slice();
    const cylIdx = cylGeo.getIndex()!.array;
    const sphIdx = sphGeo.getIndex()!.array;
    const capR = new Map<number, number>();
    for (const [a, b, r] of SEGMENTS) {
      capR.set(a, Math.max(capR.get(a) ?? 0, r));
      capR.set(b, Math.max(capR.get(b) ?? 0, r));
    }
    for (const [i, r] of capR) this.caps.push({ i, r });
    const nCyl = this.cyl.length / 3;
    const nSph = this.sph.length / 3;
    const vCount = SEGMENTS.length * nCyl + this.caps.length * nSph + PALM.length * 3;
    this.pos = new Float32Array(vCount * 3);
    const index: number[] = [];
    let base = 0;
    for (let s = 0; s < SEGMENTS.length; s++, base += nCyl) for (const k of cylIdx) index.push(base + k);
    for (let s = 0; s < this.caps.length; s++, base += nSph) for (const k of sphIdx) index.push(base + k);
    this.palmStart = base;
    for (let k = 0; k < PALM.length * 3; k++) index.push(base + k);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setIndex(index);
    cylGeo.dispose();
    sphGeo.dispose();

    const depth = new Mesh(this.geo, new MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: DoubleSide }));
    const color = new Mesh(
      this.geo,
      new MeshBasicMaterial({
        color: SILHOUETTE_COLOR,
        transparent: true,
        opacity: SILHOUETTE_OPACITY,
        depthWrite: false,
        depthFunc: LessEqualDepth,
        side: DoubleSide,
      }),
    );
    depth.renderOrder = 20;
    color.renderOrder = 21;
    depth.frustumCulled = color.frustumCulled = false;
    this.group.add(depth, color);
  }

  /** Write template vertices transformed by this.m starting at vertex `v`. */
  private emit(tpl: Float32Array, v: number): number {
    const e = this.m.elements;
    for (let k = 0; k < tpl.length; k += 3, v++) {
      const x = tpl[k], y = tpl[k + 1], z = tpl[k + 2];
      const o = v * 3;
      this.pos[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
      this.pos[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      this.pos[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
    return v;
  }

  /** Update from joint positions (`at(i)`), thickness factor `k`, visibility. */
  update(at: (i: number) => Vec3, k: number, visible: boolean): void {
    this.group.visible = visible;
    if (!visible) return;
    let v = 0;
    for (const [ia, ib, r] of SEGMENTS) {
      const a = at(ia);
      const b = at(ib);
      this.dir.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const len = Math.max(this.dir.length(), 1e-4);
      this.q.setFromUnitVectors(UP, this.dir.multiplyScalar(1 / len));
      this.m.compose(this.p.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), this.q, this.sc.set(r * k, len, r * k));
      v = this.emit(this.cyl, v);
    }
    this.q.identity();
    for (const c of this.caps) {
      const j = at(c.i);
      this.m.compose(this.p.set(j.x, j.y, j.z), this.q, this.sc.setScalar(c.r * k));
      v = this.emit(this.sph, v);
    }
    // palm: a fan of triangles from the centroid, inflated a little
    this.c.set(0, 0, 0);
    for (const i of PALM) {
      const j = at(i);
      this.c.x += j.x / PALM.length;
      this.c.y += j.y / PALM.length;
      this.c.z += j.z / PALM.length;
    }
    const pt = (i: number, out: number) => {
      const j = at(PALM[i % PALM.length]);
      let dx = j.x - this.c.x, dy = j.y - this.c.y, dz = j.z - this.c.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const s = (l + PALM_INFLATE * k) / l;
      dx *= s; dy *= s; dz *= s;
      this.pos[out] = this.c.x + dx;
      this.pos[out + 1] = this.c.y + dy;
      this.pos[out + 2] = this.c.z + dz;
    };
    for (let t = 0; t < PALM.length; t++) {
      const o = (this.palmStart + t * 3) * 3;
      this.pos[o] = this.c.x;
      this.pos[o + 1] = this.c.y;
      this.pos[o + 2] = this.c.z;
      pt(t, o + 3);
      pt(t + 1, o + 6);
    }
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
  }
}
