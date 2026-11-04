import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CatchEvent,
  type CatchState,
  catchRadiusForPalm,
  makeCatch,
  type SpawnFor,
  stepCatch,
} from '../src/palm/catch-sim.ts';
import { computePalmFrame, cupAmount, makePalmFrame } from '../src/palm/hand-frame.ts';
import { copy, v3 } from '../src/palm/math.ts';
import { chooseHand, type Engagement, GRACE_S, type HandView, makeEngagement, type Side } from '../src/palm/two-hand.ts';
import { synthHand } from './synthetic-hand.ts';

const DT = 1 / 72;
// Right palm centre is about (0.001, 1.012, -0.052); the left hand is placed 20 cm to the left.
const LEFT_X = -0.2;
const aboveRight: SpawnFor = (_k, out) => copy(out, v3(0.001, 1.25, -0.052));
const aboveLeft: SpawnFor = (_k, out) => copy(out, v3(LEFT_X - 0.001, 1.25, -0.052));

interface Pose { tracked?: boolean; curl?: number; dx?: number }
type Script = (t: number) => { right?: Pose; left?: Pose };

function view(side: Side, p: Pose | undefined, frame = makePalmFrame()): HandView {
  const tracked = p?.tracked ?? p !== undefined;
  const j = synthHand({ handedness: side, curlDeg: p?.curl ?? 0, offset: { x: (side === 'left' ? LEFT_X : 0) + (p?.dx ?? 0), y: 0, z: 0 } });
  computePalmFrame(j, side, frame);
  return { side, tracked, center: { ...frame.center }, normal: { ...frame.normal }, cup: cupAmount(j, frame) };
}

/** Drive the catch with two hands; returns events and which hand was used for each 'land' and 'catch'. */
function play(st: CatchState, eng: Engagement, seconds: number, script: Script, spawnFor: SpawnFor) {
  const events: Array<[CatchEvent, Side | null]> = [];
  for (let t = 0; t < seconds; t += DT) {
    const s = script(t);
    const hands = [view('right', s.right), view('left', s.left)];
    const h = chooseHand(hands, st, eng, DT);
    const ev = stepCatch(
      st,
      h
        ? { tracked: true, center: h.center, normal: h.normal, cup: h.cup, radius: catchRadiusForPalm(0.062), spawnFor }
        : { tracked: false, center: v3(), normal: v3(0, 1, 0), cup: 0, spawnFor },
      DT,
    );
    if (ev !== 'none') events.push([ev, h ? h.side : null]);
  }
  return events;
}

test('one hand only: the two-hand rules play exactly like the one-hand game', () => {
  const st = makeCatch(aboveRight);
  const eng = makeEngagement();
  const ev = play(st, eng, 8, (t) => ({ right: { curl: t > 6 ? 30 : 0 } }), aboveRight);
  assert.deepEqual(ev.map((e) => e[0]).slice(0, 2), ['land', 'catch']);
  assert.ok(ev.every((e) => e[1] === 'right'));
});

test('either hand may catch: a seed above the left palm is caught by the left hand', () => {
  const st = makeCatch(aboveLeft);
  const eng = makeEngagement();
  const ev = play(st, eng, 8, (t) => ({ right: {}, left: { curl: t > 6 ? 30 : 0 } }), aboveLeft);
  const land = ev.find((e) => e[0] === 'land');
  const caught = ev.find((e) => e[0] === 'catch');
  assert.equal(land?.[1], 'left');
  assert.equal(caught?.[1], 'left');
  assert.equal(st.catches, 1);
});

test('a resting seed stays with its hand: holder lost -> paused, never moves to the other hand', () => {
  const st = makeCatch(aboveRight);
  const eng = makeEngagement();
  play(st, eng, 6, () => ({ right: {}, left: {} }), aboveRight);
  assert.equal(st.seed, 'resting');
  assert.equal(eng.side, 'right');
  // right hand vanishes for 5 s while the left hand sits ready (and even cups)
  const ev = play(st, eng, 5, () => ({ right: { tracked: false }, left: { curl: 30, dx: 0.2 } }), aboveRight);
  assert.deepEqual(ev, [], 'no events: paused');
  assert.equal(st.seed, 'resting');
  assert.equal(eng.side, 'right');
  // the right hand returns and cups: the catch is the right hand's
  const ev2 = play(st, eng, 1.5, () => ({ right: { curl: 30 }, left: {} }), aboveRight);
  assert.deepEqual(ev2[0], ['catch', 'right']);
});

test('brief loss of the engaged hand pauses a falling seed; it does not drop onto the other hand', () => {
  const st = makeCatch(aboveRight);
  const eng = makeEngagement();
  play(st, eng, 2, () => ({ right: {}, left: {} }), aboveRight); // falling, right engaged
  assert.equal(st.seed, 'falling');
  assert.equal(eng.side, 'right');
  const y = st.pos.y;
  // right lost for 2 s (< grace) while the LEFT palm moves right under the seed
  const ev = play(st, eng, 2, () => ({ right: { tracked: false }, left: { dx: 0.2 } }), aboveRight);
  assert.deepEqual(ev, [], 'paused');
  assert.equal(st.pos.y, y);
  assert.equal(st.misses, 0);
  // right comes back: right lands and catches
  const ev2 = play(st, eng, 8, (t) => ({ right: { curl: t > 5 ? 30 : 0 }, left: {} }), aboveRight);
  assert.deepEqual(ev2.filter((e) => e[0] === 'catch'), [['catch', 'right']]);
});

test('after the grace period the other hand may take over a falling seed', () => {
  const st = makeCatch(aboveRight);
  const eng = makeEngagement();
  play(st, eng, 2, () => ({ right: {}, left: {} }), aboveRight);
  const ev = play(st, eng, GRACE_S + 6, (t) => ({ right: { tracked: false }, left: { dx: 0.2, curl: t > GRACE_S + 4.5 ? 30 : 0 } }), aboveRight);
  assert.equal(eng.side, 'left');
  assert.ok(ev.some((e) => e[0] === 'catch' && e[1] === 'left'), `events ${JSON.stringify(ev)}`);
});

test('no flicker: with both palms near the seed the engaged hand is kept unless the other is clearly nearer', () => {
  const st = makeCatch(aboveRight);
  const eng = makeEngagement();
  // both palms within a few millimetres of the seed
  let switches = 0;
  let last: Side | null = null;
  for (let t = 0; t < 3; t += DT) {
    // right jitters 0-5 mm from the seed; left sits 4 mm away: their distances keep crossing
    const hands = [view('right', { dx: Math.sin(t * 20) * 0.005 }), view('left', { dx: 0.205 })];
    const h = chooseHand(hands, st, eng, DT);
    if (last && h && h.side !== last) switches++;
    last = h?.side ?? last;
  }
  assert.equal(switches, 0);
});

test('both hands lost: paused, no miss', () => {
  const st = makeCatch(aboveRight);
  const eng = makeEngagement();
  play(st, eng, 2, () => ({ right: {}, left: {} }), aboveRight);
  const ev = play(st, eng, 10, () => ({ right: { tracked: false }, left: { tracked: false } }), aboveRight);
  assert.deepEqual(ev, []);
  assert.equal(st.misses, 0);
});
