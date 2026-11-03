import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CATCHES_TO_WIN,
  CUP_ON,
  type CatchEvent,
  type CatchState,
  chooseSpawn,
  makeCatch,
  stepCatch,
} from '../src/palm/catch-sim.ts';
import { computePalmFrame, cupAmount, makePalmFrame } from '../src/palm/hand-frame.ts';
import { v3 } from '../src/palm/math.ts';
import { synthHand, type SynthOptions } from './synthetic-hand.ts';

const DT = 1 / 72;
// Palm centre of the synthetic hand is about (0.001, 1.012, -0.052).
const ABOVE_PALM = v3(0.001, 1.25, -0.052);

interface HandAt {
  tracked?: boolean;
  opts?: SynthOptions;
}

/** Run for `seconds`, asking `handAt(t)` for the hand each frame; collect events. */
function run(st: CatchState, seconds: number, handAt: (t: number) => HandAt, spawn = ABOVE_PALM) {
  const frame = makePalmFrame();
  const events: CatchEvent[] = [];
  for (let t = 0; t < seconds; t += DT) {
    const h = handAt(t);
    const tracked = h.tracked ?? true;
    const j = synthHand(h.opts ?? {});
    computePalmFrame(j, 'right', frame);
    const ev = stepCatch(st, { tracked, center: frame.center, normal: frame.normal, cup: cupAmount(j, frame), nextSpawn: spawn }, DT);
    if (ev !== 'none') events.push(ev);
  }
  return events;
}

const flat = (): HandAt => ({});
const cupped = (): HandAt => ({ opts: { curlDeg: 30 } });

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

test('catch: open palm under the seed, it lands, a gentle cup catches it', () => {
  const st = makeCatch(ABOVE_PALM);
  const ev = run(st, 8, (t) => (t < 6 ? flat() : cupped()));
  assert.deepEqual(ev.slice(0, 2), ['land', 'catch']);
  assert.equal(st.catches, 1);
  assert.equal(st.misses, 0);
});

test('no false catch: an open palm holding the seed never catches it without a cup', () => {
  const st = makeCatch(ABOVE_PALM);
  const ev = run(st, 15, flat);
  assert.deepEqual(ev, ['land']);
  assert.equal(st.seed, 'resting');
  assert.equal(st.catches, 0);
});

test('no false catch: a relaxed, slightly curled hand does not count as a cup', () => {
  const st = makeCatch(ABOVE_PALM);
  const ev = run(st, 15, () => ({ opts: { curlDeg: 12 } }));
  assert.equal(st.catches, 0, `events ${ev}`);
});

test('a quick flick of the fingers (shorter than the hold time) does not catch', () => {
  const st = makeCatch(ABOVE_PALM);
  run(st, 6, flat); // landed and resting
  assert.equal(st.seed, 'resting');
  run(st, 0.1, cupped);
  run(st, 2, flat);
  assert.equal(st.catches, 0);
});

test('no snap needed: a slow, gentle cup over one second still catches', () => {
  const st = makeCatch(ABOVE_PALM);
  run(st, 6, flat);
  const ev = run(st, 1.5, (t) => ({ opts: { curlDeg: Math.min(30, t * 30) } }));
  assert.ok(ev.includes('catch'), `events ${ev}`);
});

test('generous area: a palm 6 cm off to the side still receives the seed', () => {
  const st = makeCatch(ABOVE_PALM);
  const ev = run(st, 8, (t) => ({ opts: { offset: { x: 0.06, y: 0, z: 0 }, curlDeg: t > 6 ? 30 : 0 } }));
  assert.ok(ev.includes('land') && ev.includes('catch'), `events ${ev}`);
});

test('miss: hand too far away, seed falls past; it returns and progress is kept', () => {
  const st = makeCatch(ABOVE_PALM);
  st.catches = 1;
  const away = (): HandAt => ({ opts: { offset: { x: 0.2, y: 0, z: 0 } } });
  const ev = run(st, 14, away);
  assert.ok(ev.includes('miss'), `events ${ev}`);
  assert.ok(ev.includes('spawn'), 'seed should come back');
  assert.equal(st.catches, 1, 'progress kept');
  assert.ok(st.misses >= 1);
  // and the returned seed can still be caught
  const ev2 = run(st, 10, (t) => (t < 7 ? flat() : cupped()));
  assert.ok(ev2.includes('catch'), `events ${ev2}`);
  assert.equal(st.catches, 2);
});

test('palm turned sideways under the seed (even cupped) does not catch; the seed is missed', () => {
  const st = makeCatch(ABOVE_PALM);
  const ev = run(st, 14, () => ({ opts: { rollDeg: 80, curlDeg: 30 } }));
  assert.ok(!ev.includes('land') && !ev.includes('catch'), `events ${ev}`);
});

test('the seed waits until a palm is offered, and does not fall while no hand is tracked', () => {
  const st = makeCatch(ABOVE_PALM);
  run(st, 5, () => ({ tracked: false }));
  assert.equal(st.seed, 'waiting');
  assert.equal(st.pos.y, ABOVE_PALM.y);
});

test('tracking loss mid-fall pauses the seed; no miss; it resumes and can be caught', () => {
  const st = makeCatch(ABOVE_PALM);
  run(st, 2, flat); // telegraph + start falling
  assert.equal(st.seed, 'falling');
  const y = st.pos.y;
  const ev = run(st, 4, () => ({ tracked: false }));
  assert.deepEqual(ev, []);
  assert.equal(st.pos.y, y, 'paused');
  const ev2 = run(st, 8, (t) => (t < 5 ? flat() : cupped()));
  assert.ok(ev2.includes('catch'), `events ${ev2}`);
});

test('tracking loss while the seed rests in the palm keeps it there', () => {
  const st = makeCatch(ABOVE_PALM);
  run(st, 6, flat);
  assert.equal(st.seed, 'resting');
  run(st, 3, () => ({ tracked: false }));
  assert.equal(st.seed, 'resting');
});

test('tipping the palm past ~72 degrees spills a resting seed', () => {
  const st = makeCatch(ABOVE_PALM);
  run(st, 6, flat);
  const ev = run(st, 0.5, () => ({ opts: { rollDeg: 85 } }));
  assert.deepEqual(ev.slice(0, 1), ['spill']);
  assert.equal(st.spills, 1);
});

test('three catches complete the session; no further seeds', () => {
  const st = makeCatch(ABOVE_PALM);
  const all: CatchEvent[] = [];
  for (let i = 0; i < CATCHES_TO_WIN; i++) {
    all.push(...run(st, 6, flat), ...run(st, 1.5, cupped));
  }
  all.push(...run(st, 10, cupped));
  assert.equal(st.catches, 3);
  assert.equal(st.seed, 'done');
  assert.equal(all.filter((e) => e === 'complete').length, 1);
  assert.equal(all.filter((e) => e === 'spawn').length, 2);
});

test('spawn points alternate sides and always need a move of at least 10 cm', () => {
  const head = v3(0, 1.4, 0);
  const out = v3();
  const xs = [0, 1, 2].map((r) => chooseSpawn(head, 0, -1, null, r, out).x);
  assert.ok(xs[0] < -0.1 && xs[1] > 0.1 && Math.abs(xs[2]) < 1e-9, `xs ${xs}`);
  for (let r = 0; r < 6; r++) {
    const palm = v3(0, 1.1, -0.36); // palm parked straight ahead
    chooseSpawn(head, 0, -1, palm, r, out);
    assert.ok(Math.hypot(out.x - palm.x, out.z - palm.z) >= 0.1, `round ${r} too close`);
  }
});

test('a hand that is already cupped or a fist does not receive the seed (it must arrive in an open palm)', () => {
  const st = makeCatch(ABOVE_PALM);
  run(st, 3, () => ({ opts: { curlDeg: 75 } })); // fist: seed keeps waiting
  assert.equal(st.seed, 'waiting');
  run(st, 2, flat); // open the hand: the seed starts to fall
  assert.equal(st.seed, 'falling');
  const ev = run(st, 12, cupped); // cupped before it arrives: it is missed
  assert.ok(!ev.includes('catch') && ev.includes('miss'), `events ${ev}`);
});
