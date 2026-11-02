// Palmful feasibility prototype: one creature ("Mote") that lives on your
// tracked palm. Tip your hand to slide it; rest it on the glowing fingertip
// to make that fingertip bloom. Three blooms completes the session.
//
// Everything is procedural (no downloaded assets). The simulation lives in
// src/palm/*.ts and is unit-tested in Node; this file only reads WebXR hand
// joints, renders, and records metrics for device testing.

import {
  CanvasTexture,
  CircleGeometry,
  Color,
  createSystem,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import {
  BODY_RADIUS,
  type CreatureState,
  creatureWorld,
  guidePath,
  makeCreature,
  stepCreature,
} from './palm/creature-sim.js';
import {
  computePalmFrame,
  FINGERS,
  type FingerName,
  type HandJoints,
  JOINT_NAMES,
  makeHandJoints,
  makePalmFrame,
  OneEuro3,
  FIST_REACH,
  fingertipReach,
  type PalmFrame,
} from './palm/hand-frame.js';
import { type Vec3, v3 } from './palm/math.js';

const PARAMS = new URLSearchParams(location.search);
const DEBUG = PARAMS.has('debug');
/** Draw tracked joints as dots (the emulator does not render hands in AR). */
const SKELETON = PARAMS.has('skeleton') || PARAMS.has('emulate');
const GRAVITY = v3(0, -9.81, 0);
const COLORS = {
  calm: new Color('#ffb35c'),
  sliding: new Color('#ffd27a'),
  cling: new Color('#ff6f6f'),
  joy: new Color('#fff3b0'),
  waiting: new Color('#9aa7b8'),
};
const PETAL_COLORS: Record<FingerName, string> = {
  middle: '#ff8fb1',
  index: '#9ad7ff',
  ring: '#c6a2ff',
};

export interface PalmfulMetrics {
  frames: number;
  xrFrames: number;
  trackedFrames: number;
  palmUpFrames: number;
  lossEvents: number;
  lastLossMs: number;
  longestLossMs: number;
  fps: number;
  jitterRmsMm: number;
  firstSlideS: number | null;
  firstBloomS: number | null;
  sessionS: number;
  handedness: string | null;
  handSwitches: number;
  sessionsCompleted: number;
  restarts: number;
}

/**
 * await  - no Mote yet; a seed floats in front of you until you offer a palm
 * arrive - the seed flies down onto your palm
 * hatch  - the seed cracks and Mote appears
 * play   - guide Mote to glowing fingertips
 * done   - three blooms; a fist replays (hatch again)
 */
export type Phase = 'await' | 'arrive' | 'hatch' | 'play' | 'done';

export interface LayoutReport {
  panelVisible: boolean;
  /** hand/Mote/flower points whose screen position falls inside the panel */
  overlaps: number;
  checked: number;
}

declare global {
  interface Window {
    __palmful?: {
      state: CreatureState;
      metrics: PalmfulMetrics;
      tracked: boolean;
      phase: Phase;
      trailVisible: boolean;
      hint: string;
      layout: () => LayoutReport;
    };
  }
}

const TRAIL_DOTS = 7;
const ARRIVE_S = 0.9;
const HATCH_S = 0.9;

type JointKey = { get: (j: HandJoints) => Vec3; name: string };

export class PalmfulSystem extends createSystem({}) {
  private root!: Group;
  private mote!: Group;
  private body!: Mesh;
  private bodyMat!: MeshStandardMaterial;
  private shadow!: Mesh;
  private beacon!: Mesh;
  private hint!: Mesh;
  private hintCanvas!: HTMLCanvasElement;
  private hintTex!: CanvasTexture;
  private hintText = '';
  private flowers: Partial<Record<FingerName, Group>> = {};
  private jointDots: Mesh[] = [];
  private seed!: Mesh;
  private seedFrom = new Vector3();
  private trail: Mesh[] = [];
  private trailPts: Vec3[] = [];
  private phase: Phase = 'await';
  private phaseT = 0;
  private upT = 0;
  private idleT = 0;
  private hintVisible = false;
  private hintTitle = '';
  private flowerAge: Partial<Record<FingerName, number>> = {};

  private st: CreatureState = makeCreature();
  private joints: HandJoints = makeHandJoints();
  private frame: PalmFrame = makePalmFrame();
  private spare: PalmFrame = makePalmFrame();
  private primary: 'left' | 'right' | null = null;
  private absentS = 0;
  private tracked = false;
  private lostAt = 0;
  private filters: OneEuro3[] = [];
  private keys: JointKey[] = [];
  private pos = v3();
  private ema = v3();
  private jitterAcc = 0;
  private jitterN = 0;
  private tmp = new Vector3();
  private head = new Vector3();
  private audio: AudioContext | null = null;
  private hintTimer = 0;
  private fistT = 0;
  private metrics: PalmfulMetrics = {
    frames: 0,
    xrFrames: 0,
    trackedFrames: 0,
    palmUpFrames: 0,
    lossEvents: 0,
    lastLossMs: 0,
    longestLossMs: 0,
    fps: 0,
    jitterRmsMm: 0,
    firstSlideS: null,
    firstBloomS: null,
    sessionS: 0,
    handedness: null,
    handSwitches: 0,
    sessionsCompleted: 0,
    restarts: 0,
  };

  init(): void {
    // Joint lookup table so the per-frame loop has no string building.
    this.keys.push({ name: JOINT_NAMES.wrist, get: (j) => j.wrist });
    this.keys.push({ name: JOINT_NAMES.pinkyProx, get: (j) => j.pinkyProx });
    for (const f of FINGERS) {
      for (let i = 0; i < 4; i++) {
        const idx = i;
        this.keys.push({ name: JOINT_NAMES.finger[f][i], get: (j) => j.finger[f][idx] });
      }
    }
    this.filters = this.keys.map(() => new OneEuro3(1.2, 6, 1));

    this.root = new Group();
    this.root.name = 'palmful-root';
    // Parent under the XR origin so joint poses (reference-space coordinates)
    // can be used directly as local positions.
    this.world.createTransformEntity(this.root, {
      parent: this.world.playerEntity,
      persistent: true,
    });

    this.buildMote();
    this.buildBeacon();
    this.buildHint();
    if (SKELETON) {
      const geo = new SphereGeometry(0.004, 8, 6);
      const mat = new MeshBasicMaterial({
        color: PARAMS.has('emulate') ? '#7a6a5e' : '#e8d6c8',
        transparent: true,
        opacity: 0.6,
      });
      for (let i = 0; i < this.keys.length; i++) {
        const m = new Mesh(geo, mat);
        this.jointDots.push(m);
        this.root.add(m);
      }
    }
    this.root.visible = false;

    // The seed waits in front of you before Mote exists.
    this.seed = new Mesh(
      new SphereGeometry(0.0075, 20, 14),
      new MeshStandardMaterial({ color: '#c98b4a', emissive: '#7a4a1c', emissiveIntensity: 0.4, roughness: 0.6 }),
    );
    this.seed.scale.set(1, 1.25, 1);
    this.root.add(this.seed);
    const dotGeo = new SphereGeometry(0.0024, 10, 8);
    for (let i = 0; i < TRAIL_DOTS; i++) {
      const d = new Mesh(dotGeo, new MeshBasicMaterial({ color: '#ffc83d', transparent: true, opacity: 0.85, depthWrite: false }));
      this.trail.push(d);
      this.trailPts.push(v3());
      this.root.add(d);
    }

    window.__palmful = {
      state: this.st,
      metrics: this.metrics,
      tracked: false,
      phase: this.phase,
      trailVisible: false,
      hint: '',
      layout: () => this.layoutCheck(),
    };
  }

  // ---------- construction ----------

  private buildMote(): void {
    this.mote = new Group();
    this.bodyMat = new MeshStandardMaterial({
      color: COLORS.calm,
      emissive: COLORS.calm,
      emissiveIntensity: 0.35,
      roughness: 0.55,
      transparent: true,
    });
    this.body = new Mesh(new SphereGeometry(BODY_RADIUS, 24, 16), this.bodyMat);
    this.mote.add(this.body);
    const eyeGeo = new SphereGeometry(BODY_RADIUS * 0.18, 10, 8);
    const eyeMat = new MeshBasicMaterial({ color: '#2a1d16' });
    for (const sx of [-1, 1]) {
      const eye = new Mesh(eyeGeo, eyeMat);
      eye.position.set(sx * BODY_RADIUS * 0.38, BODY_RADIUS * 0.25, BODY_RADIUS * 0.85);
      this.body.add(eye);
    }
    // Contact shadow: sells "sitting on the skin" in passthrough.
    this.shadow = new Mesh(
      new CircleGeometry(BODY_RADIUS * 1.1, 24),
      new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.root.add(this.mote, this.shadow);
  }

  private buildBeacon(): void {
    this.beacon = new Mesh(
      new SphereGeometry(0.0045, 16, 12),
      new MeshBasicMaterial({ color: '#fff6c2', transparent: true, opacity: 0.9 }),
    );
    this.root.add(this.beacon);
  }

  private buildHint(): void {
    this.hintCanvas = document.createElement('canvas');
    this.hintCanvas.width = 1024;
    this.hintCanvas.height = DEBUG ? 420 : 240;
    this.hintTex = new CanvasTexture(this.hintCanvas);
    const aspect = this.hintCanvas.height / this.hintCanvas.width;
    this.hint = new Mesh(
      new PlaneGeometry(0.16, 0.16 * aspect),
      new MeshBasicMaterial({ map: this.hintTex, transparent: true, depthTest: false, side: DoubleSide }),
    );
    this.hint.renderOrder = 10;
    this.root.add(this.hint);
  }

  private makeFlower(finger: FingerName): Group {
    const g = new Group();
    const stem = new Mesh(
      new CylinderGeometry(0.0008, 0.0011, 0.012, 6),
      new MeshStandardMaterial({ color: '#6fbf73' }),
    );
    stem.position.y = 0.006;
    g.add(stem);
    const petalGeo = new SphereGeometry(0.0042, 12, 8);
    const petalMat = new MeshStandardMaterial({
      color: PETAL_COLORS[finger],
      emissive: PETAL_COLORS[finger],
      emissiveIntensity: 0.25,
    });
    for (let i = 0; i < 5; i++) {
      const p = new Mesh(petalGeo, petalMat);
      const a = (i / 5) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.0045, 0.0125, Math.sin(a) * 0.0045);
      p.scale.set(1, 0.35, 0.6);
      p.rotation.y = -a;
      g.add(p);
    }
    const center = new Mesh(
      new SphereGeometry(0.0022, 10, 8),
      new MeshBasicMaterial({ color: '#ffe066' }),
    );
    center.position.y = 0.0135;
    g.add(center);
    g.scale.setScalar(0.001);
    this.root.add(g);
    return g;
  }

  // ---------- per-frame ----------

  update(delta: number, time: number): void {
    this.metrics.frames++;
    const frame = this.world.xrFrame;
    const ref = this.world.xrReferenceSpace;
    const session = this.world.xrSession;
    if (!frame || !ref || !session) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.metrics.xrFrames++;
    if (delta > 0) this.metrics.fps += (1 / delta - this.metrics.fps) * 0.05;
    this.metrics.sessionS += delta;

    // Clean pause: when the system UI covers the app, freeze everything.
    if (session.visibilityState !== 'visible') {
      for (const f of this.filters) f.reset();
      return;
    }

    const wasTracked = this.tracked;
    this.tracked = this.trackHand(frame, ref, session, delta);
    if (this.tracked) this.metrics.trackedFrames++;
    if (wasTracked && !this.tracked) {
      this.metrics.lossEvents++;
      this.lostAt = time;
    }
    if (!wasTracked && this.tracked && this.lostAt > 0) {
      const ms = (time - this.lostAt) * 1000;
      this.metrics.lastLossMs = ms;
      this.metrics.longestLossMs = Math.max(this.metrics.longestLossMs, ms);
    }

    if (this.tracked && this.frame.normal.y > 0.5) this.metrics.palmUpFrames++;
    this.advancePhase(delta);
    const playing = this.phase === 'play' || this.phase === 'done';

    if (this.tracked && !playing) {
      creatureWorld(this.st, this.frame, this.pos);
    } else if (this.tracked) {
      const before = this.st.slideTime;
      // Session end: after three blooms, a closed fist (held briefly) restarts.
      if (this.phase === 'done' && fingertipReach(this.joints) < FIST_REACH) {
        this.fistT += delta;
        if (this.fistT > 0.8) this.restart();
      } else {
        this.fistT = 0;
      }
      const res = stepCreature(this.st, this.frame, GRAVITY, delta);
      if (this.metrics.firstSlideS === null && this.st.slideTime > before)
        this.metrics.firstSlideS = this.metrics.sessionS;
      if (res.bloomed && res.bloomFinger) this.onBloom(res.bloomFinger);
      creatureWorld(this.st, this.frame, this.pos);
      this.measureJitter();
    } else {
      this.st.mood = 'waiting';
    }

    if (SKELETON) {
      for (let i = 0; i < this.jointDots.length; i++) {
        const p = this.keys[i].get(this.joints);
        this.jointDots[i].position.set(p.x, p.y, p.z);
        this.jointDots[i].visible = this.tracked;
      }
    }
    this.renderMote(time);
    this.renderSeed(time);
    this.renderTrail(time, delta);
    this.renderBeaconAndFlowers(time, delta);
    this.renderHint(delta);
    const dbg = window.__palmful!;
    dbg.tracked = this.tracked;
    dbg.phase = this.phase;
  }

  /**
   * Mote stays on the hand it started on. If that hand disappears, Mote waits
   * (frozen, dimmed) where it was. Only after SWITCH_AFTER_S of absence, and
   * only if the other hand is held palm-up, does Mote hop to the other hand.
   */
  private trackHand(frame: XRFrame, ref: XRReferenceSpace, session: XRSession, dt: number): boolean {
    const SWITCH_AFTER_S = 3;
    const hands: Partial<Record<'left' | 'right', XRHand>> = {};
    for (const src of session.inputSources) {
      if (src.hand && (src.handedness === 'left' || src.handedness === 'right')) hands[src.handedness] = src.hand;
    }
    // Before Mote arrives, the seed goes to whichever hand is offered palm-up
    // (right preferred if both), so a resting hand never claims it.
    if (this.phase === 'await') {
      for (const side of ['right', 'left'] as const) {
        const h = hands[side];
        if (h && this.readJoints(h, frame, ref, 0) && computePalmFrame(this.joints, side, this.spare) && this.spare.normal.y > 0.6) {
          if (this.primary !== side) for (const f of this.filters) f.reset();
          this.primary = side;
          break;
        }
      }
      if (!this.primary) this.primary = hands.right ? 'right' : hands.left ? 'left' : null;
    }
    if (!this.primary) return false;
    const mine = hands[this.primary];
    const otherSide = this.primary === 'right' ? 'left' : 'right';
    const other = hands[otherSide];

    if (mine && this.readJoints(mine, frame, ref, dt) && computePalmFrame(this.joints, this.primary, this.frame)) {
      this.absentS = 0;
      this.metrics.handedness = this.primary;
      return true;
    }

    this.absentS += dt;
    if (this.absentS > SWITCH_AFTER_S && other &&
        this.readJoints(other, frame, ref, 0) &&
        computePalmFrame(this.joints, otherSide, this.spare) && this.spare.normal.y > 0.5) {
      // Hop to the other hand, keeping progress (blooms) but restarting on the palm.
      this.primary = otherSide;
      for (const f of this.filters) f.reset();
      Object.assign(this.st, { place: 'palm', a: 0, b: 0, s: 0, va: 0, vb: 0, vs: 0 });
      this.metrics.handSwitches++;
      return this.readJoints(other, frame, ref, 0) && computePalmFrame(this.joints, otherSide, this.frame);
    }
    return false;
  }

  private readJoints(hand: XRHand, frame: XRFrame, ref: XRReferenceSpace, dt: number): boolean {
    for (let i = 0; i < this.keys.length; i++) {
      const space = hand.get(this.keys[i].name as XRHandJoint);
      const pose = space ? frame.getJointPose?.(space, ref) : undefined;
      if (!pose) return false;
      const p = pose.transform.position;
      const out = this.keys[i].get(this.joints);
      out.x = p.x;
      out.y = p.y;
      out.z = p.z;
      if (dt > 0) this.filters[i].filter(out, dt, out);
    }
    return true;
  }

  private measureJitter(): void {
    // High-pass of the creature's rendered position: what the eye reads as shake.
    const k = 0.15;
    this.ema.x += (this.pos.x - this.ema.x) * k;
    this.ema.y += (this.pos.y - this.ema.y) * k;
    this.ema.z += (this.pos.z - this.ema.z) * k;
    const dx = this.pos.x - this.ema.x;
    const dy = this.pos.y - this.ema.y;
    const dz = this.pos.z - this.ema.z;
    this.jitterAcc += dx * dx + dy * dy + dz * dz;
    this.jitterN++;
    if (this.jitterN >= 72) {
      this.metrics.jitterRmsMm = Math.sqrt(this.jitterAcc / this.jitterN) * 1000;
      this.jitterAcc = 0;
      this.jitterN = 0;
    }
  }

  private renderMote(time: number): void {
    const st = this.st;
    const n = this.frame.normal;
    const hatching = this.phase === 'hatch';
    const shown = this.phase === 'play' || this.phase === 'done' || (hatching && this.phaseT > HATCH_S * 0.45);
    this.mote.visible = shown;
    this.shadow.visible = shown && this.tracked;
    if (!shown) return;
    if (hatching) {
      // pop out of the seed with a small overshoot
      const k = (this.phaseT - HATCH_S * 0.45) / (HATCH_S * 0.55);
      this.mote.scale.setScalar(Math.max(0.01, Math.sin(Math.min(1, k) * Math.PI * 0.75) / Math.sin(Math.PI * 0.75)));
    } else {
      this.mote.scale.setScalar(1);
    }
    this.mote.position.set(this.pos.x, this.pos.y, this.pos.z);
    // Stand upright on the skin; face the next trail dot (where it wants to go).
    const look = this.trailPts[1];
    if (this.phase === 'play' && st.blooms < 3) this.tmp.set(look.x, look.y, look.z);
    else this.tmp.set(this.pos.x + this.frame.fwd.x, this.pos.y + this.frame.fwd.y, this.pos.z + this.frame.fwd.z);
    this.mote.up.set(n.x, n.y, n.z);
    this.mote.lookAt(this.tmp);

    const speed = Math.abs(st.va) + Math.abs(st.vb) + Math.abs(st.vs);
    let squash = 1 + Math.min(0.25, speed * 3);
    let hop = 0;
    if (st.mood === 'joy') hop = Math.abs(Math.sin(time * 14)) * 0.006;
    if (st.mood === 'cling') squash = 0.8 + Math.sin(time * 40) * 0.03; // trembling grip
    if (st.mood === 'calm') hop = Math.max(0, Math.sin(time * 2.2)) * 0.0012; // breathing
    this.body.position.y = hop;
    this.body.scale.set(squash, 1 / squash, squash);

    const target = COLORS[st.mood];
    this.bodyMat.color.lerp(target, 0.15);
    this.bodyMat.emissive.lerp(target, 0.15);
    this.bodyMat.opacity = this.tracked ? 1 : 0.35;

    this.shadow.position.set(
      this.pos.x - n.x * (BODY_RADIUS - 0.0005),
      this.pos.y - n.y * (BODY_RADIUS - 0.0005),
      this.pos.z - n.z * (BODY_RADIUS - 0.0005),
    );
    this.tmp.set(this.shadow.position.x + n.x, this.shadow.position.y + n.y, this.shadow.position.z + n.z);
    this.shadow.lookAt(this.tmp);
  }

  private tipPos(f: FingerName, lift: number, out: Vector3): Vector3 {
    const p = this.frame.path[f][3];
    const n = this.frame.normal;
    return out.set(p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift);
  }

  private renderBeaconAndFlowers(time: number, delta: number): void {
    const done = this.st.blooms >= 3;
    this.beacon.visible = this.tracked && this.phase === 'play' && !done && !this.flowers[this.st.target];
    if (this.beacon.visible) {
      this.tipPos(this.st.target, 0.004, this.beacon.position);
      const pulse = 1 + Math.sin(time * 5) * 0.25 + (this.st.dwellT > 0 ? this.st.dwellT * 1.5 : 0);
      this.beacon.scale.setScalar(pulse);
    }
    const n = this.frame.normal;
    for (const f of FINGERS) {
      const g = this.flowers[f];
      if (!g) continue;
      g.visible = this.tracked;
      this.flowerAge[f] = (this.flowerAge[f] ?? 0) + delta;
      const age = this.flowerAge[f]!;
      // grow with a little overshoot, then keep a gentle sway
      const grow = age < 0.7 ? 1.25 * Math.sin((age / 0.7) * (Math.PI / 2)) : 1 + Math.sin(age * 2) * 0.03;
      const celebrate = done ? 1 + Math.max(0, Math.sin(time * 6)) * 0.15 : 1;
      g.scale.setScalar(Math.max(0.001, grow * celebrate));
      this.tipPos(f, 0, g.position);
      g.up.set(n.x, n.y, n.z);
      this.tmp.set(g.position.x + this.frame.fwd.x, g.position.y + this.frame.fwd.y, g.position.z + this.frame.fwd.z);
      g.lookAt(this.tmp);
    }
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  private advancePhase(dt: number): void {
    this.phaseT += dt;
    const palmUp = this.tracked && this.frame.normal.y > 0.6;
    switch (this.phase) {
      case 'await':
        this.upT = palmUp ? this.upT + dt : 0;
        if (this.upT > 0.4) {
          this.seedFrom.copy(this.seed.position);
          this.setPhase('arrive');
        }
        break;
      case 'arrive':
        if (!this.tracked) this.phaseT -= dt; // wait for the hand
        if (this.phaseT >= ARRIVE_S) {
          this.setPhase('hatch');
          this.chime('hatch');
        }
        break;
      case 'hatch':
        if (!this.tracked) this.phaseT -= dt;
        if (this.phaseT >= HATCH_S) this.setPhase('play');
        break;
      default:
        break;
    }
  }

  private renderSeed(time: number): void {
    const s = this.seed;
    if (this.phase === 'await') {
      // float 42 cm in front of the eyes, a little low, bobbing
      this.player.head.getWorldPosition(this.head);
      this.root.worldToLocal(this.head);
      this.player.head.getWorldDirection(this.tmp);
      s.visible = true;
      s.position.set(
        this.head.x - this.tmp.x * 0.42,
        this.head.y - this.tmp.y * 0.42 - 0.03 + Math.sin(time * 2) * 0.006,
        this.head.z - this.tmp.z * 0.42,
      );
      s.rotation.y = time * 0.8;
      s.scale.set(1, 1.25, 1);
      return;
    }
    if (this.phase === 'arrive') {
      s.visible = true;
      const k = Math.min(1, this.phaseT / ARRIVE_S);
      const e = k * k * (3 - 2 * k);
      const c = this.frame.center;
      const n = this.frame.normal;
      const tx = c.x + n.x * 0.0075;
      const ty = c.y + n.y * 0.0075;
      const tz = c.z + n.z * 0.0075;
      s.position.set(
        this.seedFrom.x + (tx - this.seedFrom.x) * e,
        this.seedFrom.y + (ty - this.seedFrom.y) * e + Math.sin(k * Math.PI) * 0.05,
        this.seedFrom.z + (tz - this.seedFrom.z) * e,
      );
      s.rotation.y = time * 3;
      return;
    }
    if (this.phase === 'hatch' && this.phaseT < HATCH_S * 0.55) {
      s.visible = true;
      const c = this.frame.center;
      const n = this.frame.normal;
      s.position.set(c.x + n.x * 0.0075, c.y + n.y * 0.0075, c.z + n.z * 0.0075);
      // wobble, then swell and vanish as Mote pops out
      const k = this.phaseT / (HATCH_S * 0.55);
      s.rotation.z = Math.sin(time * 30) * 0.25 * (1 - k);
      const sw = 1 + k * 0.4;
      s.scale.set(sw * (1 - k * k), 1.25 * sw * (1 - k * k), sw * (1 - k * k));
      return;
    }
    s.visible = false;
  }

  private renderTrail(time: number, dt: number): void {
    const st = this.st;
    const moving = Math.abs(st.va) + Math.abs(st.vb) + Math.abs(st.vs) > 0.004;
    this.idleT = moving || st.mood === 'cling' ? 0 : this.idleT + dt;
    const show = this.tracked && this.phase === 'play' && st.blooms < 3 && this.idleT > 1.2;
    window.__palmful!.trailVisible = show;
    if (this.tracked && this.phase === 'play') guidePath(st, this.frame, this.trailPts);
    const n = this.frame.normal;
    for (let i = 0; i < this.trail.length; i++) {
      const d = this.trail[i];
      d.visible = show && i > 0;
      if (!d.visible) continue;
      const p = this.trailPts[i];
      d.position.set(p.x + n.x * 0.003, p.y + n.y * 0.003, p.z + n.z * 0.003);
      // a pulse of light travels from Mote toward the fingertip
      const wave = Math.max(0, Math.sin(time * 4 - i * 0.9));
      d.scale.setScalar(0.6 + wave * 0.8);
      (d.material as MeshBasicMaterial).opacity = 0.35 + wave * 0.6;
    }
  }

  /** Project panel corners and hand/Mote/flower points to the screen; count overlaps. */
  private layoutCheck(): LayoutReport {
    const xrCam = this.world.renderer.xr.getCamera() as unknown as { cameras?: PerspectiveCamera[] };
    const cam = xrCam.cameras?.[0] ?? this.world.camera;
    cam.updateMatrixWorld();
    const proj = (v: Vector3) => v.applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
    const report: LayoutReport = { panelVisible: this.hint.visible, overlaps: 0, checked: 0 };
    if (!this.hint.visible) return report;
    this.hint.updateMatrixWorld();
    const geo = this.hint.geometry as PlaneGeometry;
    const w = geo.parameters.width / 2;
    const h = geo.parameters.height / 2;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [cx, cy] of [[-w, -h], [w, -h], [w, h], [-w, h]]) {
      const v = proj(this.hint.localToWorld(new Vector3(cx, cy, 0)));
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const pts: Vector3[] = [];
    for (const k of this.keys) {
      const p = k.get(this.joints);
      pts.push(this.root.localToWorld(new Vector3(p.x, p.y, p.z)));
    }
    if (this.mote.visible) pts.push(this.mote.getWorldPosition(new Vector3()));
    for (const f of FINGERS) {
      const g = this.flowers[f];
      if (g) pts.push(g.localToWorld(new Vector3(0, 0.0125, 0)));
    }
    for (const p of pts) {
      const v = proj(p);
      report.checked++;
      if (v.x >= x0 && v.x <= x1 && v.y >= y0 && v.y <= y1) report.overlaps++;
    }
    return report;
  }

  private restart(): void {
    for (const f of FINGERS) {
      const g = this.flowers[f];
      if (g) {
        this.root.remove(g);
        delete this.flowers[f];
        delete this.flowerAge[f];
      }
    }
    Object.assign(this.st, makeCreature());
    this.fistT = 0;
    this.setPhase('hatch');
    this.metrics.restarts++;
    this.metrics.firstSlideS = null;
  }

  private onBloom(f: FingerName): void {
    if (!this.flowers[f]) this.flowers[f] = this.makeFlower(f);
    this.flowerAge[f] = 0;
    if (this.metrics.firstBloomS === null) this.metrics.firstBloomS = this.metrics.sessionS;
    if (this.st.blooms >= 3) {
      this.metrics.sessionsCompleted++;
      this.setPhase('done');
    }
    this.chime(this.st.blooms >= 3 ? 'final' : 'bloom');
  }

  private chime(kind: 'hatch' | 'bloom' | 'final'): void {
    const final = kind === 'final';
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      void ctx.resume();
      const notes =
        kind === 'hatch' ? [392, 523.25] : final ? [523.25, 659.25, 783.99, 1046.5] : [659.25 + this.st.blooms * 98, 987.77];
      notes.forEach((hz, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = hz;
        const t0 = ctx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
        o.connect(g).connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 1.2);
      });
    } catch {
      /* audio is optional */
    }
  }

  /** The few words the game ever shows; null = no panel (most of play). */
  private hintFor(): { title: string; sub: string } | null {
    const st = this.st;
    if (this.phase === 'await') {
      return this.tracked
        ? { title: 'Turn your palm up', sub: '' }
        : { title: 'Hold out your hand', sub: 'palm up' };
    }
    if (!this.tracked) return { title: 'Bring your hand back', sub: '' };
    if (this.phase === 'arrive' || this.phase === 'hatch') return null;
    if (this.phase === 'done') {
      return this.fistT > 0
        ? { title: 'Hold it…', sub: '' }
        : { title: 'All three in bloom', sub: 'make a fist to play again' };
    }
    if (st.mood === 'cling') return { title: 'Turn your palm up', sub: '' };
    // Wordless by default: the light trail shows where to go. Only if the
    // player has not tipped their hand after a while do we say so.
    if (st.blooms === 0 && this.metrics.firstSlideS === null && this.phaseT > 8 && this.idleT > 4)
      return { title: 'Tip your hand', sub: 'toward the light' };
    return null;
  }

  private placePanel(): void {
    // Above and slightly beyond the hand (away from the eyes), so from the
    // player's view it sits above the hand rather than across it.
    this.player.head.getWorldPosition(this.head);
    this.root.worldToLocal(this.head);
    if (this.tracked && this.phase !== 'await') {
      const c = this.frame.center;
      let ax = c.x - this.head.x;
      let az = c.z - this.head.z;
      const len = Math.hypot(ax, az) || 1;
      ax /= len;
      az /= len;
      this.hint.position.set(c.x + ax * 0.06, c.y + 0.1, c.z + az * 0.06);
    } else if (this.phase === 'await') {
      // just under the floating seed
      this.hint.position.set(this.seed.position.x, this.seed.position.y - 0.045, this.seed.position.z);
    } else {
      this.player.head.getWorldDirection(this.tmp);
      this.hint.position.set(
        this.head.x - this.tmp.x * 0.45,
        this.head.y - this.tmp.y * 0.45 - 0.08,
        this.head.z - this.tmp.z * 0.45,
      );
    }
    this.hint.lookAt(this.head);
  }

  private renderHint(delta: number): void {
    const msg = this.hintFor();
    this.hintVisible = DEBUG || msg !== null;
    this.hint.visible = this.hintVisible;
    window.__palmful!.hint = msg ? `${msg.title}${msg.sub ? ' / ' + msg.sub : ''}` : '';
    if (!this.hintVisible) return;
    this.placePanel();

    this.hintTimer -= delta;
    if (this.hintTimer > 0) return;
    this.hintTimer = 0.25;
    const title = msg?.title ?? '';
    const sub = msg?.sub ?? '';
    const m = this.metrics;
    const dbg = DEBUG
      ? [
          `fps ${m.fps.toFixed(0)}  tracked ${((100 * m.trackedFrames) / Math.max(1, m.xrFrames)).toFixed(0)}%  palm-up ${((100 * m.palmUpFrames) / Math.max(1, m.trackedFrames)).toFixed(0)}%`,
          `jitter ${m.jitterRmsMm.toFixed(1)} mm  losses ${m.lossEvents}  longest ${m.longestLossMs.toFixed(0)} ms`,
          `${this.phase}  ${this.st.place}  ${this.st.mood}  blooms ${this.st.blooms}  1st bloom ${m.firstBloomS?.toFixed(1) ?? '-'} s`,
        ].join('\n')
      : '';
    const key = title + sub + dbg + this.st.blooms;
    if (key === this.hintTitle) return;
    this.hintTitle = key;

    const cv = this.hintCanvas;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = 'rgba(20,16,28,0.78)';
    c.beginPath();
    c.roundRect(8, 8, cv.width - 16, cv.height - 16, 48);
    c.fill();
    c.textAlign = 'center';
    c.fillStyle = '#fff4e0';
    let size = 72;
    do {
      c.font = `600 ${size}px system-ui, sans-serif`;
      size -= 4;
    } while (size > 28 && c.measureText(title).width > cv.width - 96);
    const done = this.phase === 'done';
    c.fillText(title, cv.width / 2, sub || done ? 92 : 112);
    if (done) {
      // three dots in the petal colours: the visible result, no words needed
      FINGERS.forEach((f, i) => {
        c.fillStyle = PETAL_COLORS[f];
        c.beginPath();
        c.arc(cv.width / 2 + (i - 1) * 56, 136, 16, 0, Math.PI * 2);
        c.fill();
      });
    }
    if (sub) {
      c.fillStyle = '#d8cbb8';
      c.font = '54px system-ui, sans-serif';
      c.fillText(sub, cv.width / 2, done ? 206 : 160);
    }
    if (DEBUG) {
      c.font = '32px ui-monospace, monospace';
      c.fillStyle = '#b8f0c8';
      dbg.split('\n').forEach((line, i) => c.fillText(line, cv.width / 2, 270 + i * 52));
    }
    this.hintTex.needsUpdate = true;
  }
}
