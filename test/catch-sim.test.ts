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
  landingCheck,
  laneSpawn,
  makeCatch,
  otherHandUnder,
  PALM_UP_MIN,
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

// ---- landing feedback must match the landing rule (Aaron's Quest recording:
// green ring, seed rejected, open-looking hand reading cup 0.42-0.46) ----

/** A falling seed straight above a palm at a chosen offset/height, with chosen cup and tilt. */
function fallingAt(off: number, dy: number) {
  const st = makeCatch(above);
  st.seed = 'falling';
  const center = v3(0, 1, 0);
  st.pos.x = off;
  st.pos.y = 1 + dy;
  st.pos.z = 0;
  return { st, center };
}

test('green ring never lies: "ready" and "ready" block agree with stepCatch on every input (grid)', () => {
  let landed = 0, refused = 0;
  for (const cup of [0, 0.2, 0.41, 0.42, 0.45, 0.6]) {
    for (const ny of [0.3, 0.54, 0.56, 1]) {
      for (const off of [0, 0.05, 0.07, 0.09]) {
        for (const dy of [0.08, 0.04, 0, -0.02, -0.04]) {
          for (const tracked of [true, false]) {
            const { st, center } = fallingAt(off, dy);
            const normal = v3(Math.sqrt(1 - ny * ny), ny, 0);
            const inp = { tracked, center, normal, cup, radius: 0.072, spawnFor: above };
            const c = { ...landingCheck(st, inp) };
            const ev = stepCatch(st, inp, 0); // dt 0: no fall this step, same position as the check
            assert.equal(ev === 'land', c.block === 'ready', `cup ${cup} ny ${ny} off ${off} dy ${dy} tracked ${tracked}: ${c.block}`);
            // the ring is green exactly when the hand itself is acceptable (height aside)
            const handOk = tracked && ny >= PALM_UP_MIN && cup < CUP_ON && off <= 0.072;
            assert.equal(c.ready, handOk, `ring ready mismatch: cup ${cup} ny ${ny} off ${off} tracked ${tracked}`);
            if (ev === 'land') landed++;
            else refused++;
          }
        }
      }
    }
  }
  assert.ok(landed > 0 && refused > 0);
});

test("Aaron's case: palm up and under the seed but cup 0.45 -> ring NOT green, reason cup-too-high, no landing", () => {
  const { st, center } = fallingAt(0, 0.01);
  const inp = { tracked: true, center, normal: v3(0, 1, 0), cup: 0.45, radius: 0.072, spawnFor: above };
  const c = landingCheck(st, inp);
  assert.equal(c.ready, false);
  assert.equal(c.block, 'cup-too-high');
  // the seed falls straight through and is missed, exactly as recorded
  const evs: CatchEvent[] = [];
  for (let i = 0; i < 72 * 12 && st.seed === 'falling'; i++) {
    const e = stepCatch(st, inp, DT);
    if (e !== 'none') evs.push(e);
  }
  assert.deepEqual(evs, ['miss']);
  // the same hand reading 0.30 is green and the seed lands
  const b = fallingAt(0, 0.01);
  const inp2 = { ...inp, center: b.center, cup: 0.3 };
  assert.equal(landingCheck(b.st, inp2).ready, true);
  assert.equal(stepCatch(b.st, inp2, 0), 'land');
});

test('a waiting seed does not start for a hand reading cup >= 0.42 (reason cup-too-high), and starts below it', () => {
  const st = makeCatch(above);
  const inp = { tracked: true, center: v3(0.001, 1.012, -0.052), normal: v3(0, 1, 0), cup: 0.45, radius: 0.072, spawnFor: above };
  assert.equal(landingCheck(st, inp).block, 'cup-too-high');
  for (let i = 0; i < 72 * 5; i++) stepCatch(st, inp, DT);
  assert.equal(st.seed, 'waiting');
  inp.cup = 0.3;
  assert.equal(landingCheck(st, inp).block, 'ready');
  for (let i = 0; i < 72 * 1.2; i++) stepCatch(st, inp, DT);
  assert.equal(st.seed, 'falling');
});

test('landing reasons, in order: no hand, palm not up, cup, not under, seed above, palm above', () => {
  const base = { tracked: true, normal: v3(0, 1, 0), cup: 0.1, radius: 0.072, spawnFor: above };
  const at = (off: number, dy: number, o: Partial<typeof base> = {}) => {
    const { st, center } = fallingAt(off, dy);
    return landingCheck(st, { ...base, center, ...o }).block;
  };
  assert.equal(at(0, 0, { tracked: false, cup: 0.9 }), 'no-hand');
  assert.equal(at(0, 0, { normal: v3(1, 0, 0), cup: 0.9 }), 'palm-not-up');
  assert.equal(at(0.2, 0, { cup: 0.9 }), 'cup-too-high');
  assert.equal(at(0.2, 0), 'not-under');
  assert.equal(at(0, 0.2), 'seed-above');
  assert.equal(at(0, -0.1), 'palm-above-seed');
  assert.equal(at(0, 0), 'ready');
});

test('one-hand Catch follows one hand: the other hand under the seed is reported, and never lands it', () => {
  const { st, center: selectedFarAway } = fallingAt(0, 0);
  selectedFarAway.x = 0.3; // the selected (right) hand is 30 cm away
  const other = { tracked: true, center: v3(0, 1, 0), normal: v3(0, 1, 0) };
  assert.equal(otherHandUnder(st, other, 0.072), true);
  assert.equal(otherHandUnder(st, { ...other, normal: v3(0, -1, 0) }, 0.072), false);
  assert.equal(otherHandUnder(st, { ...other, tracked: false }, 0.072), false);
  const inp = { tracked: true, center: selectedFarAway, normal: v3(0, 1, 0), cup: 0.1, radius: 0.072, spawnFor: above };
  assert.equal(landingCheck(st, inp).block, 'not-under');
  assert.equal(stepCatch(st, inp, 0), 'none'); // only the selected hand counts
});
