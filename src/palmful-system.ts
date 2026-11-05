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
  AdditiveBlending,
  ConeGeometry,
  OctahedronGeometry,
  BackSide,
  RingGeometry,
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
  DRAW_JOINT_NAMES,
  makeHandJoints,
  makePalmFrame,
  OneEuro3,
  cupAmount,
  FIST_REACH,
  fingertipReach,
  type PalmFrame,
} from './palm/hand-frame.js';
import {
  CATCH_RADIUS,
  CATCHES_TO_WIN,
  type CatchState,
  catchRadiusForPalm,
  CAUGHT_S,
  CUP_HOLD,
  CUP_ON,
  laneSpawn,
  nextKind,
  MISSED_S,
  makeCatch,
  PALM_UP_MIN,
  resetCatch,
  SEED_KINDS,
  type SeedKind,
  selectKind,
  type SpawnFor,
  stepCatch,
} from './palm/catch-sim.js';
import { type Vec3, v3 } from './palm/math.js';
import { addSeeThrough, HandSilhouette } from './hand-silhouette.js';
import { COACH_H, COACH_W, type CoachMsg, drawCoachCard, drawCoachIcon, ICON_BOX, ICON_PX } from './coach.js';
import { chooseHand, type Engagement, type HandView, makeEngagement, type Side } from './palm/two-hand.js';

const PARAMS = new URLSearchParams(location.search);
const DEBUG = PARAMS.has('debug');
/** Draw tracked joints as dots (the emulator does not render hands in AR). */
const SKELETON = PARAMS.has('skeleton') || PARAMS.has('emulate');
/**
 * Bright joints + bone lines. Laptop play shows a soft hand silhouette with
 * subtle joints instead; add &debug=1 (or ?skeleton=1) for the full skeleton.
 */
const FULL_SKELETON = DEBUG || PARAMS.has('skeleton');
/** Experimental catch mode (?catch=1); the three-bloom game is the default. */
export const MODE: 'bloom' | 'catch' = PARAMS.has('catch') ? 'catch' : 'bloom';
/** Optional two-hand catching (?catch=1&hands=2): either open palm may catch. */
export const TWO_HANDS = MODE === 'catch' && PARAMS.get('hands') === '2';
/** One tracked hand in two-hand mode: its joints, palm frame, filters and drawing. */
interface HandTrack {
  side: Side;
  joints: HandJoints;
  frame: PalmFrame;
  filters: OneEuro3[];
  tracked: boolean;
  dots: Mesh[];
  bones: Mesh[];
  silhouette: HandSilhouette | null;
}
/** Laptop emulator only: draw a dark room into the XR view (never on a Quest). */
const EMULATED_VIEW = PARAMS.has('emulate');
/** Laptop diagnosis only: keep IWSDK's own hand outline/occluder visible (&iwsdkhand=1). */
const KEEP_IWSDK_HAND = PARAMS.has('iwsdkhand');
/** Cue colours, chosen to stay distinct on dark backgrounds and in passthrough. */
const CUE = { ready: '#2bff6e', waiting: '#ffb020', miss: '#ff3b3b' };
const FLASH_S = 1.5;
/**
 * Laptop emulator display size for the drawn hand (Small / Medium / Large).
 * Purely visual: dot and bone thickness. It never changes joint positions,
 * the catch area, or anything on a Quest. Saved in this browser only.
 */
export type HandSize = 'S' | 'M' | 'L';
const HAND_SIZES: Record<HandSize, { joint: number; bone: number; silhouette: number }> = {
  S: { joint: 0.0035, bone: 0.0012, silhouette: 0.86 },
  M: { joint: 0.005, bone: 0.002, silhouette: 1 },
  L: { joint: 0.0072, bone: 0.0032, silhouette: 1.16 },
};
export const HAND_SIZE_KEY = 'palmful.laptopHandSize';
function readHandSize(): HandSize {
  try {
    const v = localStorage.getItem(HAND_SIZE_KEY);
    return v === 'S' || v === 'M' || v === 'L' ? v : 'M';
  } catch {
    return 'M';
  }
}
const UP = new Vector3(0, 1, 0);
const SIDES = ['right', 'left'] as const;
/** Joint pairs drawn as bones in the laptop view (indices into this.keys). */
// keys: 0 wrist, 1 pinky knuckle, 2-5 index, 6-9 middle, 10-13 ring
const BONES: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 6], [0, 10],
  [2, 3], [3, 4], [4, 5],
  [6, 7], [7, 8], [8, 9],
  [10, 11], [11, 12], [12, 13],
  [2, 6], [6, 10], [10, 1],
];
/** Catch mode: seed colours, labels, and which fingertip each one blooms. */
const SEED_COLOR: Record<SeedKind, string> = { gold: '#ffc83d', blue: '#4fb4ff', pink: '#ff6fc2' };
const SEED_LABEL: Record<SeedKind, string> = { gold: 'Gold', blue: 'Blue', pink: 'Pink' };
const SEED_SIDE: Record<SeedKind, string> = { gold: 'on your left', blue: 'on your right', pink: 'in the middle' };
/** Coach card width (m). */
const CARD_W = 0.18;
const FLOWER_FOR_SEED: Record<SeedKind, FingerName> = { gold: 'middle', blue: 'index', pink: 'ring' };
/** Extra bones for the laptop's full skeleton: pinky and thumb (indices 14-20). */
const EXTRA_BONES: Array<[number, number]> = [
  [1, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
];
/** Fingertips that grow a flower, in order (both modes). */
const FLOWER_ORDER: FingerName[] = ['middle', 'index', 'ring'];
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
      mode: 'bloom' | 'catch';
      catch: CatchState | null;
      cup: number;
      palmCenter: Vec3;
      trailVisible: boolean;
      hint: string;
      /** id of the coach step on screen ('' = none) */
      coach: string;
      layout: () => LayoutReport;
      /** true only in the laptop emulator: a dark room is drawn into the XR view */
      hasBackdrop: boolean;
      handSize: () => string;
      restartArmed: () => boolean;
      /** laptop test aid: freeze at the next catch/miss cue (true), resume (false) */
      holdCue: (on: boolean) => string;
      /** laptop test aid: pause the game now (true) or resume (false); the hand still moves */
      freeze: (on: boolean) => string;
      /** laptop inspection camera: pause the game while the camera orbits the hand (the hand is not moved) */
      inspect: (on: boolean) => boolean;
      inspecting: boolean;
      /** laptop test aid: completion card lines and their drawn widths (canvas px) */
      cardText?: { maxW: number; lines: string[]; widths: number[] };
      /** laptop view: is the hand silhouette drawn, and the bright bones? */
      silhouette: () => { silhouette: boolean; bones: boolean };
      /** laptop view: IWSDK's own hand visual per side (loaded from the input-profiles CDN; hidden in laptop mode) */
      iwsdkHands: () => Record<string, { loaded: boolean; visible: boolean; meshes: number; at: number[]; inScene: boolean }>;
      twoHands: () => {
        enabled: boolean;
        engaged: string | null;
        right: boolean;
        left: boolean;
        flowers: Record<string, string>;
        centers: Record<string, Vec3 | null>;
      };
      /** screen positions (0..1, top-left origin) of key objects, for contrast tests */
      screenPoints: () => Record<string, Array<[number, number]>>;
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
  private boneMeshes: Mesh[] = [];
  private bonePairs: Array<[number, number]> = [...BONES];
  private silhouette: HandSilhouette | null = null;
  private tracks: Record<Side, HandTrack> | null = null;
  private eng: Engagement = makeEngagement();
  private flowerSide: Partial<Record<FingerName, Side>> = {};
  private restartArmed = false;
  /** One-hand mode uses `right` for its single hand. */
  private armed: Record<Side, boolean> = { right: false, left: false };
  /** Reused every frame in two-hand mode (no per-frame allocation). */
  private views: HandView[] = [];
  private handSize: HandSize = 'S';
  private boneDir = new Vector3();
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
  // catch mode
  private cst: CatchState | null = null;
  private ring!: Mesh;
  /** laptop view: faint copy of the ring drawn where the hand model hides it */
  private ringXray: Mesh | null = null;
  private ringMat!: MeshBasicMaterial;
  private halo!: Mesh;
  private headV = v3();
  private fwdX = 0;
  private fwdZ = -1;
  private radius = CATCH_RADIUS;
  private catchSeed!: Group;
  private seedShapes!: Record<SeedKind, Mesh>;
  private hud!: Mesh;
  private hudCanvas!: HTMLCanvasElement;
  private hudTex!: CanvasTexture;
  private hudKey = '';
  private hudAnchor = v3();
  private hudPos = v3();
  private cup = 0;
  /** catch: green ring bursts outward; miss: red ring shrinks and sinks */
  private flash: { color: string; t: number; x: number; y: number; z: number; grow: boolean } | null = null;
  /** laptop test aid: freeze the game at the next catch/miss cue (screenshots take ~3 s headless) */
  private cueHold: 'off' | 'armed' | 'frozen' = 'off';
  /** laptop inspection camera: game paused (hand tracking and drawing continue) */
  private inspecting = false;
  private ringY = 0;

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
  // coach (the hint card's pictogram and step state)
  private coachIcon!: Mesh;
  private iconCanvas!: HTMLCanvasElement;
  private iconTex!: CanvasTexture;
  private coachId = '';
  private coachFlash = 0;
  private iconTimer = 0;
  private iconT = 0;
  private coachPlaced = false;
  private coachTarget = new Vector3();
  private ringReady = false; // catch: an open palm is under the seed (the ring is green)
  private goalT = 0; // seconds left to show "1 of 3" after a catch or bloom
  private lastCount = 0;
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
    if (EMULATED_VIEW) {
      // Extra joints for the laptop hand silhouette only (indices 14-20);
      // the headset reads exactly the same joints as before.
      DRAW_JOINT_NAMES.pinky.forEach((name, i) => this.keys.push({ name, get: (j) => j.pinky[i] }));
      DRAW_JOINT_NAMES.thumb.forEach((name, i) => this.keys.push({ name, get: (j) => j.thumb[i] }));
      this.bonePairs.push(...EXTRA_BONES);
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
      // Joints (unit spheres) and bones (unit cylinders) are scaled per frame:
      // their POSITIONS always come from the tracked joints, so changing the
      // laptop display size never moves them relative to the ring or seed.
      const geo = new SphereGeometry(1, 12, 10);
      const mat = new MeshBasicMaterial({
        color: '#f2e6d8',
        transparent: true,
        // full skeleton: bright; normal laptop play: subtle dots on the silhouette
        opacity: FULL_SKELETON ? 1 : EMULATED_VIEW ? 0.45 : 0.6,
      });
      for (let i = 0; i < this.keys.length; i++) {
        const m = new Mesh(geo, mat);
        this.jointDots.push(m);
        this.root.add(m);
      }
      const boneGeo = new CylinderGeometry(1, 1, 1, 8);
      const boneMat = new MeshBasicMaterial({ color: '#b9a99a' });
      for (let i = 0; i < this.bonePairs.length; i++) {
        const b = new Mesh(boneGeo, boneMat);
        this.boneMeshes.push(b);
        this.root.add(b);
      }
      if (EMULATED_VIEW) {
        this.silhouette = new HandSilhouette(FULL_SKELETON);
        this.root.add(this.silhouette.group);
      }
      if (EMULATED_VIEW) {
        this.handSize = readHandSize();
        const onSize = (e: Event) => {
          this.handSize = (e as CustomEvent<HandSize>).detail;
        };
        window.addEventListener('palmful-handsize', onSize);
        this.cleanupFuncs.push(() => window.removeEventListener('palmful-handsize', onSize));
      }
    }
    if (EMULATED_VIEW) this.buildEmulatorBackdrop();
    if (TWO_HANDS) this.buildTracks();
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

    if (MODE === 'catch') this.buildCatch();

    window.__palmful = {
      state: this.st,
      metrics: this.metrics,
      tracked: false,
      phase: this.phase,
      mode: MODE,
      catch: null,
      cup: 0,
      palmCenter: this.frame.center,
      trailVisible: false,
      hint: '',
      coach: '',
      layout: () => this.layoutCheck(),
      hasBackdrop: this.root.getObjectByName('emulator-backdrop') !== undefined,
      handSize: () => this.handSize,
      restartArmed: () => this.restartArmed,
      holdCue: (on: boolean) => {
        if (EMULATED_VIEW) this.cueHold = !on ? 'off' : this.cueHold === 'frozen' ? 'frozen' : 'armed';
        return this.cueHold;
      },
      freeze: (on: boolean) => {
        if (EMULATED_VIEW) this.cueHold = on ? 'frozen' : 'off';
        return this.cueHold;
      },
      inspect: (on: boolean) => {
        if (EMULATED_VIEW) this.inspecting = on;
        window.__palmful!.inspecting = this.inspecting;
        return this.inspecting;
      },
      inspecting: false,
      iwsdkHands: () =>
        Object.fromEntries(
          SIDES.map((side) => {
            const v = this.world.input.xr.visualAdapters.hand[side].visual;
            let meshes = 0;
            const at = new Vector3();
            v?.model.traverse((o) => {
              if ((o as Mesh).isMesh) meshes++;
            });
            v?.model.getWorldPosition(at);
            return [side, { loaded: !!v, visible: !!v?.model.visible, meshes, at: [+at.x.toFixed(3), +at.y.toFixed(3), +at.z.toFixed(3)], inScene: !!v?.model.parent }];
          }),
        ),
      silhouette: () => ({
        silhouette: !!(this.silhouette?.group.visible || this.tracks?.left.silhouette?.group.visible),
        bones: this.boneMeshes.some((b) => b.visible),
      }),
      twoHands: () => ({
        enabled: TWO_HANDS,
        engaged: this.eng.side,
        right: this.tracks?.right.tracked ?? false,
        left: this.tracks?.left.tracked ?? false,
        flowers: { ...this.flowerSide } as Record<string, string>,
        centers: {
          right: this.tracks?.right.tracked ? { ...this.tracks.right.frame.center } : null,
          left: this.tracks?.left.tracked ? { ...this.tracks.left.frame.center } : null,
        },
      }),
      screenPoints: () => this.screenPoints(),
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
    // The coach card: one action at a time, words on the right, an animated
    // pictogram on the left (its own small canvas, so only it is redrawn
    // while it animates). With &debug=1 the metrics are drawn below.
    this.hintCanvas = document.createElement('canvas');
    this.hintCanvas.width = COACH_W;
    this.hintCanvas.height = DEBUG ? COACH_H + 190 : COACH_H;
    this.hintTex = new CanvasTexture(this.hintCanvas);
    const w = CARD_W;
    const h = w * (this.hintCanvas.height / this.hintCanvas.width);
    this.hint = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ map: this.hintTex, transparent: true, depthTest: false, side: DoubleSide }),
    );
    this.hint.renderOrder = 30; // above the laptop hand silhouette (20-21)
    this.root.add(this.hint);
    this.iconCanvas = document.createElement('canvas');
    this.iconCanvas.width = this.iconCanvas.height = ICON_PX;
    this.iconTex = new CanvasTexture(this.iconCanvas);
    const px = w / COACH_W; // metres per card pixel
    const side = (COACH_H - 70) * px;
    this.coachIcon = new Mesh(
      new PlaneGeometry(side, side),
      new MeshBasicMaterial({ map: this.iconTex, transparent: true, depthTest: false, side: DoubleSide }),
    );
    this.coachIcon.renderOrder = 31;
    // centred in the card's left square, which sits in the card's top COACH_H rows
    this.coachIcon.position.set(-w / 2 + ((ICON_BOX + 30) / 2) * px, h / 2 - (COACH_H / 2) * px, 0.0005);
    this.hint.add(this.coachIcon);
  }

  private petalColor(f: FingerName): string {
    if (MODE === 'catch') for (const k of SEED_KINDS) if (FLOWER_FOR_SEED[k] === f) return SEED_COLOR[k];
    return PETAL_COLORS[f];
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
      color: this.petalColor(finger),
      emissive: this.petalColor(finger),
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
    // laptop view: a flower inside a closed fist still shows, faintly
    if (EMULATED_VIEW && !FULL_SKELETON) addSeeThrough(g, 0.5, 0.4);
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
    this.tracked = TWO_HANDS ? this.trackBoth(frame, ref, session, delta) : this.trackHand(frame, ref, session, delta);
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
    if (MODE === 'catch') {
      const dt = this.cueHold === 'frozen' || this.inspecting ? 0 : delta;
      this.updateCatch(dt, time);
      this.renderJointDots();
      this.renderBeaconAndFlowers(time, dt);
      this.renderHint(dt);
      if (this.cueHold === 'armed' && this.flash && this.flash.t > FLASH_S * 0.15) this.cueHold = 'frozen';
      const d = window.__palmful!;
      d.tracked = this.tracked;
      d.phase = this.phase;
      d.catch = this.cst;
      d.cup = this.cup;
      d.palmCenter = this.frame.center; // two-hand mode switches frames
      this.hideCardsWhileInspecting();
      this.reportFit(delta);
      return;
    }
    // laptop inspection camera: the bloom game holds still (dt 0); the hand is still tracked and drawn
    const g = this.inspecting ? 0 : delta;
    this.advancePhase(g);
    const playing = this.phase === 'play' || this.phase === 'done';

    if (this.tracked && !playing) {
      creatureWorld(this.st, this.frame, this.pos);
    } else if (this.tracked) {
      const before = this.st.slideTime;
      // Session end: after three blooms, a closed fist (held briefly) restarts.
      if (this.phase === 'done' && fingertipReach(this.joints) < FIST_REACH) {
        this.fistT += g;
        if (this.fistT > 0.8) this.restart();
      } else {
        this.fistT = 0;
      }
      const res = stepCreature(this.st, this.frame, GRAVITY, g);
      if (this.metrics.firstSlideS === null && this.st.slideTime > before)
        this.metrics.firstSlideS = this.metrics.sessionS;
      if (res.bloomed && res.bloomFinger) this.onBloom(res.bloomFinger);
      creatureWorld(this.st, this.frame, this.pos);
      this.measureJitter();
    } else {
      this.st.mood = 'waiting';
    }

    this.renderJointDots();
    this.renderMote(time);
    this.renderSeed(time);
    this.renderTrail(time, g);
    this.renderBeaconAndFlowers(time, g);
    this.renderHint(g);
    const dbg = window.__palmful!;
    dbg.tracked = this.tracked;
    dbg.phase = this.phase;
    this.hideCardsWhileInspecting();
    this.reportFit(delta);
  }

  /**
   * Laptop inspection camera: the floating cards are drawn over everything
   * (no depth test), so they would cover the hand when the camera looks at it
   * from the side or from below. Hidden while inspecting; back on reset.
   */
  private hideCardsWhileInspecting(): void {
    if (!this.inspecting) return;
    this.hint.visible = false;
    if (this.hud) this.hud.visible = false; // the progress card exists in catch mode only
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

  private readJoints(
    hand: XRHand,
    frame: XRFrame,
    ref: XRReferenceSpace,
    dt: number,
    joints: HandJoints = this.joints,
    filters: OneEuro3[] = this.filters,
  ): boolean {
    for (let i = 0; i < this.keys.length; i++) {
      const space = hand.get(this.keys[i].name as XRHandJoint);
      const pose = space ? frame.getJointPose?.(space, ref) : undefined;
      if (!pose) return false;
      const p = pose.transform.position;
      const out = this.keys[i].get(joints);
      out.x = p.x;
      out.y = p.y;
      out.z = p.z;
      if (dt > 0) filters[i].filter(out, dt, out);
    }
    return true;
  }

  // ---------- two-hand mode (?catch=1&hands=2) ----------

  private buildTracks(): void {
    // The right track reuses the one-hand objects; the left gets its own.
    const mk = (side: Side, reuse: boolean): HandTrack => {
      const t: HandTrack = {
        side,
        joints: reuse ? this.joints : makeHandJoints(),
        frame: reuse ? this.frame : makePalmFrame(),
        filters: reuse ? this.filters : this.keys.map(() => new OneEuro3(1.2, 6, 1)),
        tracked: false,
        dots: reuse ? this.jointDots : [],
        bones: reuse ? this.boneMeshes : [],
        silhouette: reuse ? this.silhouette : null,
      };
      if (!reuse && SKELETON) {
        const d0 = this.jointDots[0];
        const b0 = this.boneMeshes[0];
        for (let i = 0; i < this.keys.length; i++) {
          const m = new Mesh(d0.geometry, d0.material);
          t.dots.push(m);
          this.root.add(m);
        }
        for (let i = 0; i < this.bonePairs.length; i++) {
          const m = new Mesh(b0.geometry, b0.material);
          t.bones.push(m);
          this.root.add(m);
        }
        if (EMULATED_VIEW) {
          t.silhouette = new HandSilhouette(FULL_SKELETON);
          this.root.add(t.silhouette.group);
        }
      }
      return t;
    };
    this.tracks = { right: mk('right', true), left: mk('left', false) };
  }

  /** Read both hands into their own tracks. Returns true if either is tracked. */
  private trackBoth(frame: XRFrame, ref: XRReferenceSpace, session: XRSession, dt: number): boolean {
    const tracks = this.tracks!;
    const seen: Partial<Record<Side, XRHand>> = {};
    for (const src of session.inputSources) {
      if (src.hand && (src.handedness === 'left' || src.handedness === 'right')) seen[src.handedness] = src.hand;
    }
    for (const side of ['right', 'left'] as const) {
      const t = tracks[side];
      const h = seen[side];
      t.tracked = !!h && this.readJoints(h, frame, ref, dt, t.joints, t.filters) && computePalmFrame(t.joints, side, t.frame);
      if (!t.tracked) for (const f of t.filters) f.reset();
    }
    return tracks.right.tracked || tracks.left.tracked;
  }

  /** Two-hand mode: choose the hand that feeds the catch; point this.joints/frame at it. */
  private pickCatchHand(dt: number): void {
    const tracks = this.tracks!;
    if (this.views.length === 0) {
      for (const side of SIDES) {
        const t = tracks[side];
        this.views.push({ side, tracked: false, center: t.frame.center, normal: t.frame.normal, cup: 0 });
      }
    }
    for (const v of this.views) {
      const t = tracks[v.side];
      v.tracked = t.tracked;
      v.cup = t.tracked ? cupAmount(t.joints, t.frame) : 0;
    }
    const chosen = chooseHand(this.views, this.cst!, this.eng, dt);
    if (chosen) {
      this.joints = tracks[chosen.side].joints;
      this.frame = tracks[chosen.side].frame;
      this.metrics.handedness = chosen.side;
    }
    this.tracked = chosen !== null;
  }

  /**
   * Laptop emulator only: hide IWSDK's own hand visual (a white outline plus an
   * invisible, depth-writing "occluder" hand meant for passthrough). Over the
   * laptop hand model it hid most of the palm (black, with detached fingertips
   * and a floating wrist) in real browsers. IWSDK re-shows it every frame in
   * its input update (priority -4, before this system), so it is hidden here
   * every frame, before rendering. Never runs on a headset. &iwsdkhand=1 keeps
   * it, to compare.
   */
  private hideIwsdkHandVisuals(): void {
    if (!EMULATED_VIEW || KEEP_IWSDK_HAND) return;
    const hands = this.world.input.xr.visualAdapters.hand;
    for (const side of SIDES) {
      const visual = hands[side].visual;
      if (visual) visual.model.visible = false;
    }
  }

  private renderJointDots(): void {
    this.hideIwsdkHandVisuals();
    if (!SKELETON) return;
    if (this.tracks) {
      for (const t of [this.tracks.right, this.tracks.left]) this.drawSkeleton(t.joints, t.tracked, t.dots, t.bones, t.silhouette, t.side === 'left');
    } else {
      this.drawSkeleton(this.joints, this.tracked, this.jointDots, this.boneMeshes, this.silhouette, this.primary === 'left');
    }
  }

  /** Joint lookup for the laptop hand model, without a per-frame closure. */
  private atJoints: HandJoints | null = null;
  private readonly atFn = (i: number): Vec3 => this.keys[i].get(this.atJoints!);
  private jointAt(joints: HandJoints): (i: number) => Vec3 {
    this.atJoints = joints;
    return this.atFn;
  }

  private drawSkeleton(joints: HandJoints, tracked: boolean, dots: Mesh[], bones: Mesh[], sil: HandSilhouette | null, left: boolean): void {
    const size = HAND_SIZES[this.handSize];
    sil?.update(this.jointAt(joints), size.silhouette, tracked, left);
    // with the laptop hand model, joint dots and bones are hidden in normal
    // play; &debug=1 (or ?skeleton=1) shows the full skeleton through a faint hand
    const subtle = sil !== null && !FULL_SKELETON;
    for (let i = 0; i < dots.length; i++) {
      const p = this.keys[i].get(joints);
      dots[i].position.set(p.x, p.y, p.z);
      dots[i].visible = tracked && !subtle;
      dots[i].scale.setScalar(size.joint);
    }
    for (let n = 0; n < bones.length; n++) {
      const b = bones[n];
      b.visible = tracked && !subtle;
      if (!b.visible) continue;
      const p = this.keys[this.bonePairs[n][0]].get(joints);
      const q = this.keys[this.bonePairs[n][1]].get(joints);
      this.boneDir.set(q.x - p.x, q.y - p.y, q.z - p.z);
      const len = this.boneDir.length();
      b.position.set((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
      if (len > 1e-6) b.quaternion.setFromUnitVectors(UP, this.boneDir.multiplyScalar(1 / len));
      b.scale.set(size.bone, Math.max(len, 1e-4), size.bone);
    }
  }

  /**
   * Laptop emulator only (?emulate): a dark room drawn INTO the rendered XR
   * view, so light objects are visible. The emulator otherwise composites the
   * AR view over white. Never built on a real headset, so passthrough is
   * never covered.
   */
  private buildEmulatorBackdrop(): void {
    const room = new Mesh(
      new SphereGeometry(8, 32, 16),
      new MeshBasicMaterial({ color: '#15131c', side: BackSide, depthWrite: false }),
    );
    room.renderOrder = -10;
    room.name = 'emulator-backdrop';
    this.root.add(room);
    const floor = new Mesh(
      new CircleGeometry(2.5, 48),
      new MeshBasicMaterial({ color: '#221e2b', depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.renderOrder = -9;
    this.root.add(floor);
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

  private tipPos(f: FingerName, lift: number, out: Vector3, fr: PalmFrame = this.frame): Vector3 {
    const p = fr.path[f][3];
    const n = fr.normal;
    return out.set(p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift);
  }

  private renderBeaconAndFlowers(time: number, delta: number): void {
    const done = this.phase === 'done';
    this.beacon.visible = this.tracked && this.phase === 'play' && !done && !this.flowers[this.st.target];
    if (this.beacon.visible) {
      this.tipPos(this.st.target, 0.004, this.beacon.position);
      const pulse = 1 + Math.sin(time * 5) * 0.25 + (this.st.dwellT > 0 ? this.st.dwellT * 1.5 : 0);
      this.beacon.scale.setScalar(pulse);
    }
    for (const f of FINGERS) {
      const g = this.flowers[f];
      if (!g) continue;
      // two-hand mode: each flower stays on the hand that caught its seed
      const side = this.flowerSide[f];
      const track = side && this.tracks ? this.tracks[side] : null;
      const fr = track ? track.frame : this.frame;
      const n = fr.normal;
      g.visible = track ? track.tracked : this.tracked;
      this.flowerAge[f] = (this.flowerAge[f] ?? 0) + delta;
      const age = this.flowerAge[f]!;
      // grow with a little overshoot, then keep a gentle sway
      const grow = age < 0.7 ? 1.25 * Math.sin((age / 0.7) * (Math.PI / 2)) : 1 + Math.sin(age * 2) * 0.03;
      const celebrate = done ? 1 + Math.max(0, Math.sin(time * 6)) * 0.15 : 1;
      g.scale.setScalar(Math.max(0.001, grow * celebrate));
      this.tipPos(f, 0, g.position, fr);
      g.up.set(n.x, n.y, n.z);
      this.tmp.set(g.position.x + fr.fwd.x, g.position.y + fr.fwd.y, g.position.z + fr.fwd.z);
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
    // In catch mode the completion message lives on the progress display.
    const panel = MODE === 'catch' && this.phase === 'done' ? this.hud : this.hint;
    const xrCam = this.world.renderer.xr.getCamera() as unknown as { cameras?: PerspectiveCamera[] };
    const cam = xrCam.cameras?.[0] ?? this.world.camera;
    cam.updateMatrixWorld();
    const proj = (v: Vector3) => v.applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
    const report: LayoutReport = { panelVisible: panel.visible, overlaps: 0, checked: 0 };
    if (!panel.visible) return report;
    panel.updateMatrixWorld();
    const geo = panel.geometry as PlaneGeometry;
    const w = geo.parameters.width / 2;
    const h = geo.parameters.height / 2;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [cx, cy] of [[-w, -h], [w, -h], [w, h], [-w, h]]) {
      const v = proj(panel.localToWorld(new Vector3(cx, cy, 0)));
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

  private screenPoints(): Record<string, Array<[number, number]>> {
    const xrCam = this.world.renderer.xr.getCamera() as unknown as { cameras?: PerspectiveCamera[] };
    const cam = xrCam.cameras?.[0] ?? this.world.camera;
    cam.updateMatrixWorld();
    const out: Record<string, Array<[number, number]>> = {};
    const add = (name: string, p: Vector3) => {
      p.applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return;
      (out[name] ??= []).push([(p.x + 1) / 2, (1 - p.y) / 2]);
    };
    const jointSets = this.tracks
      ? [this.tracks.right, this.tracks.left].filter((t) => t.tracked).map((t) => t.joints)
      : this.tracked ? [this.joints] : [];
    for (const js of jointSets) {
      for (const k of this.keys) {
        const j = k.get(js);
        add('joint', this.root.localToWorld(new Vector3(j.x, j.y, j.z)));
      }
    }
    if (this.seed.visible) add('seed', this.seed.getWorldPosition(new Vector3()));
    if (this.catchSeed?.visible) add('seed', this.catchSeed.getWorldPosition(new Vector3()));
    if (this.hud?.visible) add('hud', this.hud.getWorldPosition(new Vector3()));
    // panel corners, for "is anything clipped at the window edge?" tests
    for (const [name, m] of [['hudBox', this.hud], ['hintBox', this.hint]] as const) {
      if (!m?.visible) continue;
      const g = m.geometry as PlaneGeometry;
      const hw = g.parameters.width / 2, hh = g.parameters.height / 2;
      m.updateMatrixWorld();
      for (const [cx, cy] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
        const p = m.localToWorld(new Vector3(cx, cy, 0));
        p.applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
        (out[name] ??= []).push([(p.x + 1) / 2, (1 - p.y) / 2]); // may be outside 0..1: that is the point
      }
    }
    if (this.mote.visible) add('mote', this.mote.getWorldPosition(new Vector3()));
    if (this.ring?.visible) {
      // a point on the ring itself (its right-hand edge)
      this.ring.updateMatrixWorld();
      add('ring', this.ring.localToWorld(new Vector3(1 - 0.065, 0, 0))); // unit ring, mid-band
    }
    return out;
  }

  /**
   * Laptop emulator only: about 4 times a second, measure how far the key
   * objects (progress display, hint, seed, ring, hand, flowers) reach toward
   * the edges of the view, and tell the laptop camera ('palmful-fit') so it
   * can tilt to centre them and zoom just enough that nothing is clipped,
   * whatever the window size. (Normalised screen box, -1..1 per axis.)
   */
  private fitT = 0;
  private reportFit(dt: number): void {
    if (!EMULATED_VIEW) return;
    // Bloom opening: the waiting seed and its hint follow the head, so tilting
    // toward them can never centre them; the camera used to run down to its
    // -70° limit, where the hint's top edge covered the seed (issue #7). The
    // laptop camera keeps its starting view until the hand rises; framing then
    // resumes from there in the usual small, damped steps.
    if (MODE === 'bloom' && this.phase === 'await') return;
    this.fitT -= dt;
    if (this.fitT > 0) return;
    this.fitT = 0.25;
    const xrCam = this.world.renderer.xr.getCamera() as unknown as { cameras?: PerspectiveCamera[] };
    const cam = xrCam.cameras?.[0] ?? this.world.camera;
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    let n = 0;
    const v = this.tmp;
    const add = (wx: number, wy: number, wz: number) => {
      v.set(wx, wy, wz).applyMatrix4(cam.matrixWorldInverse);
      if (v.z > -0.05) return; // behind the camera
      v.applyMatrix4(cam.projectionMatrix);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      n++;
    };
    const w = new Vector3();
    const corners = (m: Mesh) => {
      if (!m?.visible) return;
      const g = m.geometry as PlaneGeometry;
      const hw = g.parameters.width / 2;
      const hh = g.parameters.height / 2;
      m.updateMatrixWorld();
      for (const [cx, cy] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
        m.localToWorld(w.set(cx, cy, 0));
        add(w.x, w.y, w.z);
      }
    };
    corners(this.hud);
    corners(this.hint);
    if (this.catchSeed?.visible) { this.catchSeed.getWorldPosition(w); add(w.x, w.y, w.z); }
    if (this.seed.visible) { this.seed.getWorldPosition(w); add(w.x, w.y, w.z); }
    if (this.ring?.visible) {
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        this.ring.localToWorld(w.set(x, z, 0));
        add(w.x, w.y, w.z);
      }
    }
    const sets = this.tracks ? [this.tracks.right, this.tracks.left] : [{ joints: this.joints, tracked: this.tracked }];
    for (const t of sets) {
      if (!t.tracked) continue;
      for (const k of this.keys) {
        const p = k.get(t.joints);
        this.root.localToWorld(w.set(p.x, p.y, p.z));
        add(w.x, w.y, w.z);
      }
    }
    for (const f of FINGERS) {
      const g = this.flowers[f];
      if (g?.visible) { g.getWorldPosition(w); add(w.x, w.y, w.z); }
    }
    if (n > 0) window.dispatchEvent(new CustomEvent('palmful-fit', { detail: { x0, x1, y0, y1 } }));
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

  // ---------- catch mode (?catch=1) ----------

  private buildCatch(): void {
    // Bloom-mode pieces stay hidden in catch mode.
    this.mote.visible = false;
    this.shadow.visible = false;
    this.beacon.visible = false;
    this.seed.visible = false;
    for (const d of this.trail) d.visible = false;

    // Three seeds: different colour AND shape (sphere, diamond, cone/triangle),
    // so they read without colour vision. One group, one visible shape.
    this.catchSeed = new Group();
    const shapes: Record<SeedKind, Mesh> = {
      gold: new Mesh(new SphereGeometry(0.0085, 24, 16)),
      blue: new Mesh(new OctahedronGeometry(0.011)),
      pink: new Mesh(new ConeGeometry(0.0095, 0.018, 3)),
    };
    for (const k of SEED_KINDS) {
      shapes[k].material = new MeshStandardMaterial({
        color: SEED_COLOR[k],
        emissive: SEED_COLOR[k],
        emissiveIntensity: 0.85,
        roughness: 0.4,
        flatShading: k !== 'gold',
      });
      this.catchSeed.add(shapes[k]);
    }
    this.seedShapes = shapes;
    this.halo = new Mesh(
      new SphereGeometry(0.018, 20, 14),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false, blending: AdditiveBlending }),
    );
    this.catchSeed.add(this.halo);
    this.root.add(this.catchSeed);

    // Landing ring: where the seed will come down, at palm height, exactly the
    // size of the catch area (scaled per frame to the measured palm).
    this.ringMat = new MeshBasicMaterial({
      color: CUE.waiting,
      transparent: true,
      opacity: 0.9,
      toneMapped: false, // keep cue colours saturated (amber / green / red)
      side: DoubleSide,
      depthWrite: false,
    });
    this.ring = new Mesh(new RingGeometry(1 - 0.13, 1, 64), this.ringMat); // unit ring, scaled to the radius
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.root.add(this.ring);
    if (EMULATED_VIEW && !FULL_SKELETON) {
      // laptop view: the ring stays readable where the hand model covers it
      this.ringXray = addSeeThrough(this.ring, 0.4)[0];
      for (const k of SEED_KINDS) addSeeThrough(this.seedShapes[k], 0.55, 0.3);
    }

    // Progress display (and, at the end, the completion card).
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 1024;
    this.hudCanvas.height = 300;
    this.hudTex = new CanvasTexture(this.hudCanvas);
    this.hud = new Mesh(
      new PlaneGeometry(0.22, 0.22 * (300 / 1024)),
      new MeshBasicMaterial({ map: this.hudTex, transparent: true, depthTest: false, side: DoubleSide }),
    );
    this.hud.renderOrder = 31;
    this.hud.visible = false;
    this.root.add(this.hud);

    if (EMULATED_VIEW) {
      // Laptop testing aid only (keys 1/2/3); never reachable on a headset.
      (window as unknown as { __palmfulSelectSeed?: (k: SeedKind) => boolean }).__palmfulSelectSeed = (k) =>
        this.cst ? selectKind(this.cst, k, this.spawnFor) : false;
    }
  }

  /** Head pose in root space and its horizontal forward direction. */
  private updateHeadPose(): void {
    this.player.head.getWorldPosition(this.head);
    this.root.worldToLocal(this.head);
    this.player.head.getWorldDirection(this.tmp); // points backwards (camera -Z)
    this.headV.x = this.head.x;
    this.headV.y = this.head.y;
    this.headV.z = this.head.z;
    this.fwdX = -this.tmp.x;
    this.fwdZ = -this.tmp.z;
  }

  private spawnFor: SpawnFor = (kind, out) => laneSpawn(kind, this.headV, this.fwdX, this.fwdZ, out);

  private updateCatch(dt: number, time: number): void {
    this.updateHeadPose();
    if (!this.cst) {
      this.cst = makeCatch(this.spawnFor);
      window.__palmful!.catch = this.cst;
    }
    const cst = this.cst;
    if (TWO_HANDS) this.pickCatchHand(dt);
    // Until a palm is first offered, keep the waiting seed (and the progress
    // display) in front of the current view; the first head poses are unsettled.
    if (this.phase === 'await' && cst.seed === 'waiting') {
      this.spawnFor(cst.kind, cst.spawn);
      cst.pos.x = cst.spawn.x;
      cst.pos.y = cst.spawn.y;
      cst.pos.z = cst.spawn.z;
    }
    this.cup = this.tracked ? cupAmount(this.joints, this.frame) : 0;
    // Catch area from the measured palm (smoothed); see CATCH_TOLERANCE.
    if (this.tracked) this.radius += (catchRadiusForPalm(this.frame.halfWidth * 2) - this.radius) * Math.min(1, dt * 4);

    if (this.phase === 'await' && this.tracked && this.frame.normal.y >= PALM_UP_MIN) this.setPhase('play');
    else this.phaseT += dt;

    // Session over: a fist held briefly replays, resetting every count.
    // Replay: the hand that just cupped the last seed is still closing, and a
    // firm cup is within millimetres of the fist threshold. So the restart
    // only ARMS once a hand has opened after 3/3; then a held fist replays.
    // Arming is per hand: a fist counts only from a hand that has itself
    // opened since 3/3 (another open hand must not arm the catching hand).
    let fist = false;
    if (this.tracks) {
      for (const sd of SIDES) {
        const t = this.tracks[sd];
        if (!t.tracked) continue;
        if (this.phase === 'done' && cupAmount(t.joints, t.frame) < CUP_ON) this.armed[sd] = true;
        if (this.armed[sd] && fingertipReach(t.joints) < FIST_REACH) fist = true;
      }
    } else if (this.tracked) {
      if (this.phase === 'done' && this.cup < CUP_ON) this.armed.right = true;
      fist = this.armed.right && fingertipReach(this.joints) < FIST_REACH;
    }
    this.restartArmed = this.armed.right || this.armed.left;
    if (this.phase === 'done' && fist) {
      this.fistT += dt;
      if (this.fistT > 0.8) {
        this.clearFlowers();
        resetCatch(cst, this.spawnFor);
        this.eng = makeEngagement();
        this.fistT = 0;
        this.metrics.restarts++;
        this.setPhase('play');
      }
    } else {
      this.fistT = 0;
    }

    const kindBefore = cst.kind;
    const ev = stepCatch(
      cst,
      { tracked: this.tracked, center: this.frame.center, normal: this.frame.normal, cup: this.cup, radius: this.radius, spawnFor: this.spawnFor },
      dt,
    );
    switch (ev) {
      case 'land':
        this.chime('land');
        break;
      case 'catch':
        this.growFlower(FLOWER_FOR_SEED[kindBefore]);
        if (this.tracks && this.eng.side) this.flowerSide[FLOWER_FOR_SEED[kindBefore]] = this.eng.side; // stays on the hand that caught it
        this.chime(cst.catches >= CATCHES_TO_WIN ? 'final' : 'bloom');
        this.flash = { color: CUE.ready, t: 0, x: cst.pos.x, y: cst.pos.y, z: cst.pos.z, grow: true };
        if (this.metrics.firstBloomS === null) this.metrics.firstBloomS = this.metrics.sessionS;
        break;
      case 'miss':
        this.chime('miss');
        // show it where the player is looking (the landing ring), not where
        // the seed finally drops out of view
        this.flash = { color: CUE.miss, t: 0, x: cst.pos.x, y: this.ringY, z: cst.pos.z, grow: false };
        break;
      case 'spill':
        this.chime('spill');
        break;
      case 'complete':
        this.metrics.sessionsCompleted++;
        this.armed.right = this.armed.left = false; // a hand must open before its fist replays
        this.restartArmed = false;
        this.setPhase('done');
        break;
      default:
        break;
    }
    this.renderCatchSeed(time, dt);
    this.renderHud();
  }

  private renderCatchSeed(time: number, dt: number): void {
    const cst = this.cst!;
    const g = this.catchSeed;
    g.position.set(cst.pos.x, cst.pos.y, cst.pos.z);
    g.rotation.y = time * 1.2;
    g.visible = cst.seed !== 'done';
    for (const k of SEED_KINDS) this.seedShapes[k].visible = k === cst.kind;
    const mat = this.seedShapes[cst.kind].material as MeshStandardMaterial;
    mat.emissive.set(SEED_COLOR[cst.kind]);
    let scale = 1;
    let haloOpacity = 0.22 + Math.sin(time * 4) * 0.06;
    if (cst.seed === 'waiting') {
      // telegraph: pulses brighter before it starts to fall
      scale = 1 + Math.max(0, Math.sin(time * 6)) * 0.25;
      haloOpacity = 0.4;
    } else if (cst.seed === 'resting') {
      // ready to be cupped: slow pulse; tighter as the cup closes
      scale = 1 + Math.sin(time * 3) * 0.08 - Math.min(1, cst.cupT / CUP_HOLD) * 0.2;
    } else if (cst.seed === 'caught') {
      scale = Math.max(0.001, 1 - cst.t / (CAUGHT_S * 0.5)); // shrinks into the hand
    } else if (cst.seed === 'missed') {
      const k = Math.min(1, cst.t / MISSED_S); // fades out red, then the same seed returns
      mat.emissive.set(CUE.miss);
      scale = Math.max(0.001, 1 - k);
      haloOpacity = 0.3 * (1 - k);
    }
    g.scale.setScalar(scale);
    const haloMat = this.halo.material as MeshBasicMaterial;
    haloMat.color.set(SEED_COLOR[cst.kind]);
    haloMat.opacity = Math.max(0, haloOpacity);

    // Landing ring under the seed at palm height; green when the palm is in place.
    const r = this.ring;
    const showRing = this.phase !== 'done' && (cst.seed === 'falling' || cst.seed === 'waiting');
    r.visible = showRing || this.flash !== null;
    this.ringReady = false;
    if (showRing) {
      const y = this.tracked ? this.frame.center.y : cst.pos.y - 0.25;
      this.ringY = y;
      r.position.set(cst.pos.x, y, cst.pos.z);
      r.scale.setScalar(this.radius);
      const ready = (this.ringReady =
        this.tracked &&
        this.frame.normal.y >= PALM_UP_MIN &&
        Math.hypot(cst.pos.x - this.frame.center.x, cst.pos.z - this.frame.center.z) <= this.radius);
      this.ringMat.color.set(ready ? CUE.ready : CUE.waiting);
      this.ringMat.opacity = ready ? 1 : 0.85;
    }
    if (this.flash) {
      // catch (green) bursts outward; miss (red) shrinks and sinks
      const f = this.flash;
      f.t += dt;
      const k = f.t / FLASH_S;
      if (k >= 1) {
        this.flash = null;
      } else if (!showRing) {
        // a miss holds full size for the first 40 % so it is easy to see, then shrinks and sinks
        const km = f.grow ? 0 : Math.max(0, (k - 0.4) / 0.6);
        r.position.set(f.x, f.y - 0.004 - km * 0.06, f.z);
        r.scale.setScalar(this.radius * (f.grow ? 1 + k * 1.5 : Math.max(0.05, 1 - km * 0.8)));
        this.ringMat.color.set(f.color);
        this.ringMat.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
      }
    }
    if (this.ringXray) {
      const xm = this.ringXray.material as MeshBasicMaterial;
      xm.color.copy(this.ringMat.color);
      xm.opacity = this.ringMat.opacity * 0.45;
    }
  }

  /**
   * Progress display: "Gold 0/1 · Blue 0/1 · Pink 0/1", centred above the seed
   * lanes (about 10 cm above where seeds appear, slightly below eye level), so
   * seeds, progress and hand share one comfortable view. At the end it becomes
   * the completion card.
   */
  private renderHud(): void {
    const cst = this.cst!;
    const done = this.phase === 'done';
    this.hud.visible = true;
    // anchor: the centre lane, updated with each new seed (not head-locked)
    laneSpawn('pink', this.headV, this.fwdX, this.fwdZ, this.hudAnchor);
    if (this.phase === 'await' || cst.seed === 'waiting' || done) {
      this.hudPos.x = this.hudAnchor.x;
      this.hudPos.y = this.hudAnchor.y + 0.1;
      this.hudPos.z = this.hudAnchor.z;
    }
    this.hud.position.set(this.hudPos.x, this.hudPos.y, this.hudPos.z);
    this.hud.lookAt(this.head);
    const key = `${done}|${this.fistT > 0}|${this.restartArmed}|${cst.kind}|${SEED_KINDS.map((k) => (cst.caught[k] ? 1 : 0)).join('')}`;
    if (key === this.hudKey) return;
    this.hudKey = key;

    const cv = this.hudCanvas;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = 'rgba(16,13,24,0.86)';
    c.beginPath();
    c.roundRect(6, 6, cv.width - 12, cv.height - 12, 44);
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (done) {
      c.fillStyle = '#fff4e0';
      const maxW = cv.width - 120; // stay inside the rounded panel whatever the system font
      const title = this.fistT > 0 ? 'Hold it…' : '3/3  All three caught';
      fitFont(c, title, maxW, '700', 78, 40);
      c.fillText(title, cv.width / 2, 78);
      SEED_KINDS.forEach((k, i) => this.drawSeedIcon(c, k, cv.width / 2 + (i - 1) * 110, 165, 34, true, false));
      c.fillStyle = '#d8cbb8';
      const again = this.restartArmed ? 'make a fist to play again' : 'open your hand, then make a fist to play again';
      fitFont(c, again, maxW, '400', 50, 28);
      c.fillText(again, cv.width / 2, 245);
      // laptop test aid: the line widths as drawn, to check they fit the card
      if (EMULATED_VIEW) {
        const againW = c.measureText(again).width;
        fitFont(c, title, maxW, '700', 78, 40);
        window.__palmful!.cardText = { maxW, lines: [title, again], widths: [c.measureText(title).width, againW] };
      }
    } else {
      const w = cv.width / 3;
      SEED_KINDS.forEach((k, i) => {
        const cx = w * i + w / 2;
        const got = cst.caught[k];
        const current = !got && k === cst.kind;
        if (current) {
          c.strokeStyle = SEED_COLOR[k];
          c.lineWidth = 8;
          c.beginPath();
          c.roundRect(w * i + 22, 30, w - 44, cv.height - 60, 30);
          c.stroke();
        }
        this.drawSeedIcon(c, k, cx, 105, 38, got, current);
        c.fillStyle = got ? '#fff4e0' : current ? '#f2e6d8' : '#9d93a6';
        const label = `${SEED_LABEL[k]} ${got ? 1 : 0}/1`;
        fitFont(c, label, w - 60, got || current ? '700' : '500', 56, 32);
        c.fillText(label, cx, 205);
      });
    }
    this.hudTex.needsUpdate = true;
  }

  /** Seed symbol for the progress display: circle, diamond, triangle. */
  private drawSeedIcon(c: CanvasRenderingContext2D, k: SeedKind, x: number, y: number, r: number, filled: boolean, current: boolean): void {
    c.beginPath();
    if (k === 'gold') c.arc(x, y, r, 0, Math.PI * 2);
    else if (k === 'blue') {
      c.moveTo(x, y - r * 1.15);
      c.lineTo(x + r, y);
      c.lineTo(x, y + r * 1.15);
      c.lineTo(x - r, y);
      c.closePath();
    } else {
      c.moveTo(x, y - r * 1.1);
      c.lineTo(x + r * 1.05, y + r * 0.8);
      c.lineTo(x - r * 1.05, y + r * 0.8);
      c.closePath();
    }
    if (filled) {
      c.fillStyle = SEED_COLOR[k];
      c.fill();
      // check mark: caught
      c.strokeStyle = '#1a1424';
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(x - r * 0.45, y + r * 0.05);
      c.lineTo(x - r * 0.1, y + r * 0.4);
      c.lineTo(x + r * 0.5, y - r * 0.35);
      c.stroke();
    } else {
      c.strokeStyle = current ? SEED_COLOR[k] : '#6f6779';
      c.lineWidth = 7;
      c.stroke();
    }
  }

  private growFlower(f: FingerName): void {
    if (!this.flowers[f]) this.flowers[f] = this.makeFlower(f);
    this.flowerAge[f] = 0;
  }

  private clearFlowers(): void {
    this.flowerSide = {};
    for (const f of FINGERS) {
      const g = this.flowers[f];
      if (g) {
        this.root.remove(g);
        delete this.flowers[f];
        delete this.flowerAge[f];
      }
    }
  }

  private onBloom(f: FingerName): void {
    this.growFlower(f);
    if (this.metrics.firstBloomS === null) this.metrics.firstBloomS = this.metrics.sessionS;
    if (this.st.blooms >= 3) {
      this.metrics.sessionsCompleted++;
      this.setPhase('done');
    }
    this.chime(this.st.blooms >= 3 ? 'final' : 'bloom');
  }

  private chime(kind: 'hatch' | 'bloom' | 'final' | 'land' | 'miss' | 'spill'): void {
    const final = kind === 'final';
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      void ctx.resume();
      const step = MODE === 'catch' ? (this.cst?.catches ?? 0) : this.st.blooms;
      const notes =
        kind === 'hatch' ? [392, 523.25]
        : kind === 'land' ? [587.33]
        : kind === 'miss' ? [220, 174.61] // falling minor second: clearly "no"
        : kind === 'spill' ? [329.63, 261.63]
        : final ? [523.25, 659.25, 783.99, 1046.5]
        : [659.25 + step * 98, 987.77];
      notes.forEach((hz, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = kind === 'miss' ? 'triangle' : 'sine';
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

  /**
   * The coach: what the player should do next, one action at a time, with an
   * animated pictogram. The first session teaches every step; after a
   * restart only the reminders remain (the player has done it once).
   * null = no card (most of play).
   */
  private hintFor(): CoachMsg | null {
    if (MODE === 'catch') return this.catchHint();
    const st = this.st;
    const first = this.metrics.restarts === 0;
    const steps = (at: number) => (first ? { labels: ['Open palm', 'Tilt'], at } : undefined);
    if (this.phase === 'await') {
      return this.tracked
        ? { id: 'b-palmup', title: 'Turn your palm up', sub: '', icon: 'palmUp', tone: 'go', steps: steps(0), seed: '#c98b4a' }
        : { id: 'b-raise', title: 'Hold out your hand', sub: 'open, palm up, under the seed', icon: 'raise', tone: 'go', steps: steps(0), seed: '#c98b4a' };
    }
    if (!this.tracked) return { id: 'back', title: 'Bring your hand back', sub: '', icon: 'back', tone: 'warn' };
    if (this.phase === 'arrive' || this.phase === 'hatch')
      return first ? { id: 'b-land', title: 'Keep your palm open', sub: 'the seed is landing', icon: 'land', tone: 'wait', steps: steps(0), seed: '#c98b4a' } : null;
    const petals = FINGERS.map((f) => PETAL_COLORS[f]);
    if (this.phase === 'done') {
      return this.fistT > 0
        ? { id: 'b-hold', title: 'Hold it…', sub: '', icon: 'fist', tone: 'now', dots: { colors: petals, filled: 3 } }
        : { id: 'b-done', title: 'All three in bloom', sub: 'make a fist to play again', icon: 'fist', tone: 'done', dots: { colors: petals, filled: 3 } };
    }
    if (st.mood === 'cling') return { id: 'b-palmup2', title: 'Turn your palm up', sub: '', icon: 'palmUp', tone: 'warn' };
    if (this.goalT > 0 && st.blooms < 3)
      return { id: `b-goal${st.blooms}`, title: `${st.blooms} of 3 in bloom`, sub: 'follow the light to the next fingertip', icon: 'tilt', tone: 'done', dots: { colors: petals, filled: st.blooms } };
    // First session: teach the tilt until the first bloom. Later sessions:
    // wordless (the light trail shows the way) unless the player has not
    // tipped their hand for a while.
    if (first && st.blooms === 0)
      return { id: 'b-tilt', title: 'Tilt gently toward the light', sub: 'Mote slides to the glowing fingertip', icon: 'tilt', tone: 'go', steps: steps(1) };
    if (st.blooms === 0 && this.metrics.firstSlideS === null && this.phaseT > 8 && this.idleT > 4)
      return { id: 'b-tilt2', title: 'Tilt gently toward the light', sub: '', icon: 'tilt', tone: 'go' };
    return null;
  }

  private catchHint(): CoachMsg | null {
    const cst = this.cst;
    const first = this.metrics.restarts === 0;
    const labels = ['Under', 'Land', 'Cup'] as const;
    const color = cst ? SEED_COLOR[cst.kind] : SEED_COLOR.gold;
    const seeds = SEED_KINDS.map((k) => SEED_COLOR[k]);
    if (this.phase === 'await' || !cst) {
      return this.tracked
        ? { id: 'c-palmup', title: 'Turn your palm up', sub: '', icon: 'palmUp', tone: 'go', seed: color }
        : { id: 'c-raise', title: 'Hold out your hand, palm up', sub: 'catch 3 seeds: gold, blue and pink', icon: 'raise', tone: 'go', seed: color, dots: first ? { colors: seeds, filled: 0 } : undefined };
    }
    if (this.phase === 'done') {
      if (this.fistT > 0) return { id: 'c-hold', title: 'Hold it…', sub: '', icon: 'fist', tone: 'now' };
      return this.restartArmed
        ? { id: 'c-fist', title: 'Now make a fist', sub: 'to play again', icon: 'fist', tone: 'now', steps: { labels: ['Open', 'Fist'], at: 1 } }
        : { id: 'c-open', title: 'Open your hand', sub: 'then make a fist to play again', icon: 'open', tone: 'go', steps: { labels: ['Open', 'Fist'], at: 0 } };
    }
    if (!this.tracked)
      return { id: 'back', title: TWO_HANDS && this.eng.side ? `Bring your ${this.eng.side} hand back` : 'Bring your hand back', sub: '', icon: 'back', tone: 'warn' };
    // the first seed is taught step by step; later seeds only get reminders
    const teach = first && cst.catches === 0;
    const steps = (at: number) => (teach ? { labels, at } : undefined);
    switch (cst.seed) {
      case 'caught':
      case 'done':
        if (cst.catches > 0 && cst.catches < CATCHES_TO_WIN && (first || this.goalT > 0)) {
          const next = nextKind(cst);
          return { id: `c-goal${cst.catches}`, title: `${cst.catches} of 3 caught`, sub: next ? `next: ${SEED_LABEL[next].toLowerCase()}, ${SEED_SIDE[next]}` : '', icon: 'none', tone: 'done', dots: { colors: seeds, filled: cst.catches } };
        }
        return null;
      case 'missed':
        return { id: 'c-missed', title: 'Missed', sub: `the ${SEED_LABEL[cst.kind].toLowerCase()} seed will come back`, icon: 'none', tone: 'warn' };
      case 'resting':
        if (teach || (cst.restT > 1.5 && cst.cupT === 0))
          return { id: 'c-cup', title: 'Now cup gently', sub: 'to catch it', icon: 'cup', tone: 'now', steps: steps(2), seed: color };
        return null;
      default: {
        if (this.goalT > 0 && cst.seed === 'waiting' && cst.catches > 0) {
          const k = cst.kind;
          return { id: `c-goal${cst.catches}`, title: `${cst.catches} of 3 caught`, sub: `next: ${SEED_LABEL[k].toLowerCase()}, ${SEED_SIDE[k]}`, icon: 'none', tone: 'done', dots: { colors: seeds, filled: cst.catches } };
        }
        if (this.frame.normal.y < PALM_UP_MIN && this.phaseT > 1)
          return { id: 'c-palmup2', title: 'Turn your palm up', sub: '', icon: 'palmUp', tone: 'warn', steps: steps(0), seed: color };
        if (this.cup >= CUP_ON)
          return { id: 'c-reopen', title: 'Open your hand', sub: 'cup only after it lands', icon: 'open', tone: 'warn', steps: steps(this.ringReady ? 1 : 0) };
        if (this.ringReady)
          return teach ? { id: 'c-land', title: 'Keep it open. Let it land.', sub: 'don’t cup yet', icon: 'land', tone: 'wait', steps: steps(1), seed: color } : null;
        const fallen = cst.spawn.y - cst.pos.y;
        if (teach || fallen > 0.1)
          return { id: 'c-under', title: 'Open palm under the seed', sub: '', icon: 'under', tone: 'go', steps: steps(0), seed: color };
        return null;
      }
    }
  }

  /**
   * Where the coach card goes, always clear of the seed and the hand:
   * - catch: stacked above the progress display (words, progress, seeds,
   *   hand, top to bottom), so it never covers a seed lane or the palm;
   * - bloom, before the hand: just above the floating seed;
   * - bloom, during play: ahead at a comfortable height (about 8° below the
   *   horizon at 45 cm), lifted above the hand if the hand is held higher,
   *   eased so it never jumps.
   */
  private placePanel(dt: number): void {
    this.player.head.getWorldPosition(this.head);
    this.root.worldToLocal(this.head);
    const hh = (this.hint.geometry as PlaneGeometry).parameters.height / 2;
    let snap = !this.coachPlaced;
    if (MODE === 'catch' && this.hud) {
      const hudH = (this.hud.geometry as PlaneGeometry).parameters.height / 2;
      this.coachTarget.set(this.hudPos.x, this.hudPos.y + hudH + 0.012 + hh, this.hudPos.z);
      snap = true; // the progress display only moves with a new seed
    } else if (this.phase === 'await') {
      this.player.head.updateMatrixWorld();
      const e = this.player.head.matrixWorld.elements;
      const ul = Math.hypot(e[4], e[5], e[6]) || 1;
      const sp = this.seed.position;
      const lift = 0.03 + hh; // seed top (with its bob) is ~1.6 cm above its centre
      this.coachTarget.set(sp.x + (e[4] / ul) * lift, sp.y + (e[5] / ul) * lift, sp.z + (e[6] / ul) * lift);
      snap = true; // the seed follows the view; so does the card above it
    } else {
      this.player.head.getWorldDirection(this.tmp); // backwards
      let fx = -this.tmp.x, fz = -this.tmp.z;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl; fz /= fl;
      const slotX = this.head.x + fx * 0.45, slotY = this.head.y - 0.06, slotZ = this.head.z + fz * 0.45;
      let best = false;
      if (this.tracked) {
        this.placeAboveHandInView(); // writes coachTarget
        const t = this.coachTarget;
        const dh = Math.hypot(t.x - this.head.x, t.z - this.head.z) || 1;
        best = (t.y - this.head.y) / dh > (slotY - this.head.y) / 0.45;
      }
      if (!best) this.coachTarget.set(slotX, slotY, slotZ);
    }
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    this.hint.position.lerp(this.coachTarget, k);
    this.coachPlaced = true;
    this.hint.lookAt(this.head);
  }

  /**
   * Put the panel just above the hand *as the player sees it*: find the hand
   * joint, flower or Mote that sits highest in the view, then place the
   * panel's bottom edge a little above it, at the same distance. Works for
   * any head angle, hand distance or finger curl.
   */
  private placeAboveHandInView(): void {
    const head = this.head; // root-local head position (set by placePanel)
    this.player.head.getWorldDirection(this.tmp); // +Z of the head = backwards
    const fx = -this.tmp.x, fy = -this.tmp.y, fz = -this.tmp.z;
    // camera up in world space
    this.player.head.updateMatrixWorld();
    const e = this.player.head.matrixWorld.elements;
    let ux = e[4], uy = e[5], uz = e[6];
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;

    let best = -Infinity;
    let ax = this.frame.center.x, ay = this.frame.center.y, az = this.frame.center.z;
    const consider = (x: number, y: number, z: number) => {
      const vx = x - head.x, vy = y - head.y, vz = z - head.z;
      const depth = vx * fx + vy * fy + vz * fz;
      if (depth <= 0.05) return;
      const elev = (vx * ux + vy * uy + vz * uz) / depth;
      if (elev > best) {
        best = elev;
        ax = x; ay = y; az = z;
      }
    };
    for (const k of this.keys) {
      const p = k.get(this.joints);
      consider(p.x, p.y, p.z);
    }
    for (const f of FINGERS) {
      const g = this.flowers[f];
      if (g) consider(g.position.x + this.frame.normal.x * 0.016, g.position.y + this.frame.normal.y * 0.016, g.position.z + this.frame.normal.z * 0.016);
    }
    if (this.mote.visible) consider(this.mote.position.x, this.mote.position.y + 0.012, this.mote.position.z);

    // "up" perpendicular to the line of sight to that point
    let dx = ax - head.x, dy = ay - head.y, dz = az - head.z;
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;
    const d = ux * dx + uy * dy + uz * dz;
    let px = ux - dx * d, py = uy - dy * d, pz = uz - dz * d;
    const pl = Math.hypot(px, py, pz) || 1;
    px /= pl; py /= pl; pz /= pl;
    const half = (this.hint.geometry as PlaneGeometry).parameters.height / 2;
    const lift = half + 0.02;
    this.coachTarget.set(ax + px * lift, ay + py * lift, az + pz * lift);
  }

  private renderHint(delta: number): void {
    // "1 of 3" after each catch or bloom, for a moment
    const count = MODE === 'catch' ? (this.cst?.catches ?? 0) : this.st.blooms;
    if (count > this.lastCount) this.goalT = 2.5;
    this.lastCount = count;
    this.goalT = Math.max(0, this.goalT - delta);

    const msg = this.hintFor();
    this.hintVisible = DEBUG || msg !== null;
    this.hint.visible = this.hintVisible;
    this.coachIcon.visible = !!msg && msg.icon !== 'none';
    window.__palmful!.hint = msg ? `${msg.title}${msg.sub ? ' / ' + msg.sub : ''}` : '';
    window.__palmful!.coach = msg?.id ?? '';
    if (!this.hintVisible) {
      this.coachId = '';
      this.coachPlaced = false;
      return;
    }
    this.placePanel(delta);

    const id = msg?.id ?? '';
    const changed = id !== this.coachId;
    if (changed) {
      this.coachId = id;
      this.coachFlash = id ? 1 : 0; // a new step flashes the card's border
      this.iconT = 0;
      this.iconTimer = 0;
    }
    // pictogram: its own small canvas, redrawn about 20 times a second
    this.iconT += delta;
    this.iconTimer -= delta;
    if (msg && msg.icon !== 'none' && this.iconTimer <= 0) {
      this.iconTimer = 0.05;
      drawCoachIcon(this.iconCanvas.getContext('2d')!, msg.icon, this.iconT, msg.seed);
      this.iconTex.needsUpdate = true;
    }
    // card: on a change, while its border flash fades, and debug numbers 4x a second
    const fading = this.coachFlash > 0;
    this.coachFlash = Math.max(0, this.coachFlash - delta * 1.6);
    this.hintTimer -= delta;
    if (!changed && !fading && !(DEBUG && this.hintTimer <= 0)) return;
    this.hintTimer = 0.25;
    const m = this.metrics;
    const cv = this.hintCanvas;
    const c = cv.getContext('2d')!;
    if (msg) {
      drawCoachCard(c, msg, this.coachFlash, fitFont);
    } else {
      c.clearRect(0, 0, cv.width, cv.height);
    }
    if (DEBUG) {
      const dbg = [
        `fps ${m.fps.toFixed(0)}  tracked ${((100 * m.trackedFrames) / Math.max(1, m.xrFrames)).toFixed(0)}%  palm-up ${((100 * m.palmUpFrames) / Math.max(1, m.trackedFrames)).toFixed(0)}%`,
        `jitter ${m.jitterRmsMm.toFixed(1)} mm  losses ${m.lossEvents}  longest ${m.longestLossMs.toFixed(0)} ms`,
        MODE === 'catch' && this.cst
          ? `${this.cst.seed}  caught ${this.cst.catches}  missed ${this.cst.misses}  spilled ${this.cst.spills}  cup ${this.cup.toFixed(2)}`
          : `${this.phase}  ${this.st.place}  ${this.st.mood}  blooms ${this.st.blooms}  1st bloom ${m.firstBloomS?.toFixed(1) ?? '-'} s`,
      ];
      c.clearRect(0, COACH_H, cv.width, cv.height - COACH_H);
      c.fillStyle = 'rgba(20,16,28,0.85)';
      c.beginPath();
      c.roundRect(8, COACH_H + 4, cv.width - 16, cv.height - COACH_H - 12, 32);
      c.fill();
      c.font = '32px ui-monospace, monospace';
      c.fillStyle = '#b8f0c8';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      dbg.forEach((line, i) => c.fillText(line, cv.width / 2, COACH_H + 48 + i * 52));
    }
    this.hintTex.needsUpdate = true;
  }
}

/**
 * Set the largest font (from `size` down to `min`) at which `text` fits in
 * `maxW` canvas pixels. Canvas text is drawn in the viewer's system font, so a
 * fixed size that fits on Linux can overflow its panel on Windows or macOS.
 */
function fitFont(c: CanvasRenderingContext2D, text: string, maxW: number, weight: string, size: number, min: number): void {
  for (let s = size; ; s -= 2) {
    c.font = `${weight} ${s}px system-ui, sans-serif`;
    if (s <= min || c.measureText(text).width <= maxW) return;
  }
}
