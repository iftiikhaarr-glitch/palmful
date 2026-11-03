import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CATCH_RADIUS_MAX,
  CATCH_RADIUS_MIN,
  CUP_ON,
  type CatchEvent,
  type CatchState,
  catchRadiusForPalm,
  LANES,
  laneSpawn,
  makeCatch,
  nextKind,
  resetCatch,
  SEED_KINDS,
  type SeedKind,
  selectKind,
  type SpawnFor,
  stepCatch,
} from '../src/palm/catch-sim.ts';
import { computePalmFrame, cupAmount, makePalmFrame } from '../src/palm/hand-frame.ts';
import { copy, v3 } from '../src/palm/math.ts';
import { synthHand, type SynthOptions } from './synthetic-hand.ts';

const DT = 1 / 72;
// Palm centre of the synthetic hand is about (0.001, 1.012, -0.052).
const ABOVE_PALM = v3(0.001, 1.25, -0.052);
/** Every seed appears straight above the synthetic palm (unless a test says otherwise). */
const above: SpawnFor = (_k, out) => copy(out, ABOVE_PALM);

interface HandAt {
  tracked?: boolean;
  opts?: SynthOptions;
}

/** Run for `seconds`, asking `handAt(t)` for the hand each frame; collect events. */
function run(st: CatchState, seconds: number, handAt: (t: number) => HandAt, spawnFor: SpawnFor = above) {
  const frame = makePalmFrame();
  const events: CatchEvent[] = [];
  for (let t = 0; t < seconds; t += DT) {
    const h = handAt(t);
    const j = synthHand(h.opts ?? {});
    computePalmFrame(j, 'right', frame);
    const ev = stepCatch(
      st,
      {
        tracked: h.tracked ?? true,
        center: frame.center,
        normal: frame.normal,
        cup: cupAmount(j, frame),
        radius: catchRadiusForPalm(frame.halfWidth * 2),
        spawnFor,
      },
      DT,
    );
    if (ev !== 'none') events.push(ev);
  }
  return events;
}

const flat = (): HandAt => ({});
const cupped = (): HandAt => ({ opts: { curlDeg: 30 } });
/** Land the current seed in the open palm, then cup to catch it. */
const catchOne = (st: CatchState) => [...run(st, 6, flat), ...run(st, 1.5, cupped)];

test('cup measure: flat and relaxed hands are below the catch threshold, a gentle cup is above it', () => {
  const f = makePalmFrame();
  const cup = (curlDeg: number) => {
    const j = synthHand({ curlDeg });
    computePalmFrame(j, 'right', f);
    return cupAmount(j, f);
  };
  assert.ok(cup(0) < 0.05, `flat ${cup(0)}`);
  assert.ok(cup(12) < CUP_ON, `relaxed ${cup(12)}`);
  assert.ok(cup(30) >= CUP_ON, `gentle cup ${cup(30)}`);
  assert.ok(cup(75) > 0.9, `fist ${cup(75)}`);
});

test('catch radius follows the measured palm width, within sane limits', () => {
  const f = makePalmFrame();
  computePalmFrame(synthHand({}), 'right', f);
  const r = catchRadiusForPalm(f.halfWidth * 2);
  assert.ok(r > 0.055 && r < 0.08, `synthetic palm radius ${r}`);
  assert.ok(catchRadiusForPalm(0.065) < catchRadiusForPalm(0.09), 'smaller palm, smaller area');
  assert.equal(catchRadiusForPalm(0.01), CATCH_RADIUS_MIN);
  assert.equal(catchRadiusForPalm(0.5), CATCH_RADIUS_MAX);
});

test('seeds come in order gold, blue, pink; one of each finishes; progress per colour', () => {
  const st = makeCatch(above);
  assert.equal(st.kind, 'gold');
  const order: SeedKind[] = [];
  const all: CatchEvent[] = [];
  for (let i = 0; i < 3; i++) {
    order.push(st.kind);
    all.push(...catchOne(st));
  }
  all.push(...run(st, 10, cupped));
  assert.deepEqual(order, ['gold', 'blue', 'pink']);
  assert.deepEqual(st.caught, { gold: true, blue: true, pink: true });
  assert.equal(st.catches, 3);
  assert.equal(st.seed, 'done');
  assert.equal(all.filter((e) => e === 'complete').length, 1);
  assert.equal(nextKind(st), null);
});

test('no false catch: an open palm holding the seed never catches it without a cup', () => {
  const st = makeCatch(above);
  const ev = run(st, 15, flat);
  assert.deepEqual(ev, ['land']);
  assert.equal(st.seed, 'resting');
  assert.equal(st.catches, 0);
});

test('no false catch: a relaxed, slightly curled hand does not count as a cup', () => {
  const st = makeCatch(above);
  run(st, 15, () => ({ opts: { curlDeg: 12 } }));
  assert.equal(st.catches, 0);
});

test('no false catch: a hand already cupped or a fist does not receive the seed', () => {
  const st = makeCatch(above);
  run(st, 3, () => ({ opts: { curlDeg: 75 } }));
  assert.equal(st.seed, 'waiting', 'a fist does not start the fall');
  run(st, 2, flat);
  assert.equal(st.seed, 'falling');
  const ev = run(st, 12, cupped);
  assert.ok(!ev.includes('catch') && ev.includes('miss'), `events ${ev}`);
});

test('a quick flick of the fingers (shorter than the hold time) does not catch', () => {
  const st = makeCatch(above);
  run(st, 6, flat);
  assert.equal(st.seed, 'resting');
  run(st, 0.1, cupped);
  run(st, 2, flat);
  assert.equal(st.catches, 0);
});

test('no snap needed: a slow, gentle cup over one second still catches', () => {
  const st = makeCatch(above);
  run(st, 6, flat);
  const ev = run(st, 1.5, (t) => ({ opts: { curlDeg: Math.min(30, t * 30) } }));
  assert.ok(ev.includes('catch'), `events ${ev}`);
});

test('generous area: a palm 5 cm off to the side still receives the seed', () => {
  const st = makeCatch(above);
  const ev = run(st, 8, (t) => ({ opts: { offset: { x: 0.05, y: 0, z: 0 }, curlDeg: t > 6 ? 30 : 0 } }));
  assert.ok(ev.includes('land') && ev.includes('catch'), `events ${ev}`);
});

test('miss returns the SAME seed and keeps earlier catches', () => {
  const st = makeCatch(above);
  catchOne(st); // gold
  assert.equal(st.kind, 'blue');
  const away = (): HandAt => ({ opts: { offset: { x: 0.2, y: 0, z: 0 } } });
  const ev = run(st, 14, away);
  assert.ok(ev.includes('miss') && ev.includes('spawn'), `events ${ev}`);
  assert.equal(st.kind, 'blue', 'blue comes back, not pink');
  assert.deepEqual(st.caught, { gold: true, blue: false, pink: false });
  assert.ok(st.misses >= 1);
  catchOne(st);
  assert.deepEqual(st.caught, { gold: true, blue: true, pink: false });
});

test('a fist restart resets every count', () => {
  const st = makeCatch(above);
  catchOne(st);
  run(st, 14, () => ({ opts: { offset: { x: 0.2, y: 0, z: 0 } } })); // a miss
  assert.ok(st.catches === 1 && st.misses >= 1);
  resetCatch(st, above);
  assert.equal(st.catches, 0);
  assert.equal(st.misses, 0);
  assert.equal(st.kind, 'gold');
  assert.deepEqual(st.caught, { gold: false, blue: false, pink: false });
});

test('selecting a colour (laptop keys 1/2/3): only uncaught seeds, never mid-catch', () => {
  const st = makeCatch(above);
  assert.ok(selectKind(st, 'pink', above));
  assert.equal(st.kind, 'pink');
  assert.equal(st.seed, 'waiting');
  catchOne(st); // pink
  assert.equal(st.caught.pink, true);
  assert.equal(st.kind, 'gold', 'next uncaught in order');
  assert.equal(selectKind(st, 'pink', above), false, 'pink already caught');
  run(st, 6, flat); // gold resting in the palm
  assert.equal(st.seed, 'resting');
  assert.equal(selectKind(st, 'blue', above), false, 'not while a seed rests in the palm');
});

test('palm turned sideways under the seed (even cupped) does not catch', () => {
  const st = makeCatch(above);
  const ev = run(st, 14, () => ({ opts: { rollDeg: 80, curlDeg: 30 } }));
  assert.ok(!ev.includes('land') && !ev.includes('catch'), `events ${ev}`);
});

test('the seed waits until a palm is offered, and does not fall while no hand is tracked', () => {
  const st = makeCatch(above);
  run(st, 5, () => ({ tracked: false }));
  assert.equal(st.seed, 'waiting');
  assert.equal(st.pos.y, ABOVE_PALM.y);
});

test('tracking loss mid-fall pauses the seed; no miss; it resumes and can be caught', () => {
  const st = makeCatch(above);
  run(st, 2, flat);
  assert.equal(st.seed, 'falling');
  const y = st.pos.y;
  const ev = run(st, 4, () => ({ tracked: false }));
  assert.deepEqual(ev, []);
  assert.equal(st.pos.y, y, 'paused');
  const ev2 = run(st, 8, (t) => (t < 5 ? flat() : cupped()));
  assert.ok(ev2.includes('catch'), `events ${ev2}`);
});

test('tracking loss while the seed rests in the palm keeps it there', () => {
  const st = makeCatch(above);
  run(st, 6, flat);
  run(st, 3, () => ({ tracked: false }));
  assert.equal(st.seed, 'resting');
});

test('tipping the palm past ~72 degrees spills a resting seed', () => {
  const st = makeCatch(above);
  run(st, 6, flat);
  const ev = run(st, 0.5, () => ({ opts: { rollDeg: 85 } }));
  assert.deepEqual(ev.slice(0, 1), ['spill']);
  assert.equal(st.spills, 1);
});

test('lanes are fixed per colour: predictable, and switching seeds needs a hand move', () => {
  const head = v3(0, 1.4, 0);
  const p = (k: SeedKind) => laneSpawn(k, head, 0, -1, v3());
  assert.ok(p('gold').x < -0.1 && p('blue').x > 0.1 && Math.abs(p('pink').x) < 1e-9);
  for (const k of SEED_KINDS) {
    const a = p(k);
    assert.ok(Math.abs(a.z + 0.36) < 1e-9 && Math.abs(a.y - 1.28) < 1e-9, `${k} lane height/distance`);
    assert.ok(Math.abs(a.x - LANES[k]) < 1e-9, `${k} same lane every time`);
  }
  const [g, b, pk] = SEED_KINDS.map(p);
  assert.ok(Math.hypot(b.x - g.x, b.z - g.z) >= 0.1 && Math.hypot(pk.x - b.x, pk.z - b.z) >= 0.1);
  const turned = laneSpawn('pink', head, 1, 0, v3());
  assert.ok(Math.abs(turned.x - 0.36) < 1e-9 && Math.abs(turned.z) < 1e-9, 'lanes turn with the head');
});
