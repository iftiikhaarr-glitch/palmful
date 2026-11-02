import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeCreature, stepCreature } from '../src/palm/creature-sim.ts';
import { computePalmFrame, makePalmFrame } from '../src/palm/hand-frame.ts';
import { v3 } from '../src/palm/math.ts';
import { mulberry32, synthHand, type SynthOptions } from './synthetic-hand.ts';

const G = v3(0, -9.81, 0);
const DT = 1 / 72;

function run(seconds: number, opts: SynthOptions, st = makeCreature(), hand: 'left' | 'right' = 'right') {
  const frame = makePalmFrame();
  let blooms = 0;
  for (let t = 0; t < seconds; t += DT) {
    const j = synthHand({ handedness: hand, ...opts });
    assert.ok(computePalmFrame(j, hand, frame), 'frame should be valid');
    if (stepCreature(st, frame, G, DT).bloomed) blooms++;
  }
  return { st, frame, blooms };
}

test('palm normal points up for a palm-up right and left hand', () => {
  for (const hand of ['right', 'left'] as const) {
    const f = makePalmFrame();
    assert.ok(computePalmFrame(synthHand({ handedness: hand }), hand, f));
    assert.ok(f.normal.y > 0.99, `${hand} normal.y=${f.normal.y}`);
    assert.ok(f.fwd.z < -0.99, `${hand} fwd should point to fingers`);
  }
});

test('flat palm with 2 mm tracking jitter: creature does not drift (friction dead-zone)', () => {
  const rand = mulberry32(7);
  const { st } = run(5, { jitter: 0.002, rand });
  assert.equal(st.place, 'palm');
  assert.ok(Math.hypot(st.a, st.b) < 0.003, `drifted ${Math.hypot(st.a, st.b)} m`);
});

test('small tilt (10 deg) does not move it; 35 deg tilt slides it to the fingertip and blooms', () => {
  const still = run(3, { pitchDeg: 10 });
  assert.equal(still.st.place, 'palm');
  assert.ok(Math.abs(still.st.b) < 0.001);

  const { st, blooms } = run(8, { pitchDeg: 35 });
  assert.equal(blooms, 1, `expected one bloom, place=${st.place} s=${st.s}`);
  assert.equal(st.target, 'index', 'next target after middle is index');
});

test('second bloom on the index finger: tilt back, roll toward index, then tip down', () => {
  const first = run(8, { pitchDeg: 35 });
  assert.equal(first.blooms, 1);
  // tip toward the wrist so it slides back onto the palm
  const back = run(4, { pitchDeg: -30 }, first.st);
  assert.equal(back.st.place, 'palm');
  // roll toward the index side
  const across = run(3, { rollDeg: 30 }, back.st);
  assert.ok(across.st.a > 0.015, `a=${across.st.a}`);
  // then tip forward
  const fwd = run(8, { pitchDeg: 35, rollDeg: 8 }, across.st);
  assert.equal(fwd.blooms, 1, `place=${fwd.st.place}`);
  assert.equal(fwd.st.blooms, 2);
});

test('left hand works too', () => {
  const { blooms } = run(8, { pitchDeg: 35 }, makeCreature(), 'left');
  assert.equal(blooms, 1);
});

test('palm turned down: creature clings and does not move', () => {
  const { st } = run(3, { rollDeg: 170 });
  assert.equal(st.mood, 'cling');
  assert.equal(st.place, 'palm');
  assert.ok(Math.hypot(st.a, st.b) < 1e-6);
});

test('cupped fingers act as a wall: tilting forward does not reach the tip', () => {
  const { st, blooms } = run(6, { pitchDeg: 25, curlDeg: 45 });
  assert.equal(blooms, 0, `place=${st.place} s=${st.s}`);
});

test('tilting toward the wrist keeps it on the palm (edge clamps, no fall)', () => {
  const { st } = run(4, { pitchDeg: -45 });
  assert.equal(st.place, 'palm');
  assert.ok(st.edgeHits > 0);
});

test('fist detection: open hand is not a fist, curled hand is', async () => {
  const { fingertipReach, FIST_REACH } = await import('../src/palm/hand-frame.ts');
  const open = fingertipReach(synthHand({}));
  const fist = fingertipReach(synthHand({ curlDeg: 75 }));
  assert.ok(open > FIST_REACH, `open reach ${open}`);
  assert.ok(fist < FIST_REACH, `fist reach ${fist}`);
});

test('a session ends at three blooms: resting on a fingertip afterwards blooms nothing', () => {
  const st = makeCreature();
  st.blooms = 3;
  st.target = 'middle';
  const { blooms } = run(8, { pitchDeg: 35 }, st);
  assert.equal(blooms, 0);
  assert.equal(st.blooms, 3);
});

test('guide trail runs from Mote to the target fingertip, getting closer each step', async () => {
  const { guidePath } = await import('../src/palm/creature-sim.ts');
  const { distance } = await import('../src/palm/math.ts');
  const frame = makePalmFrame();
  computePalmFrame(synthHand({}), 'right', frame);
  for (const target of ['middle', 'index', 'ring'] as const) {
    const st = makeCreature();
    st.target = target;
    const pts = Array.from({ length: 7 }, () => v3());
    guidePath(st, frame, pts);
    const tip = frame.path[target][3];
    assert.ok(distance(pts[6], tip) < 0.002, `${target}: last point ${distance(pts[6], tip)} m from tip`);
    for (let i = 1; i < 7; i++)
      assert.ok(distance(pts[i], tip) < distance(pts[i - 1], tip) + 1e-6, `${target}: point ${i} not closer`);
  }
  // From the wrong finger, the trail first goes back toward the palm.
  const st = makeCreature();
  st.place = 'middle';
  st.s = 0.06;
  st.target = 'index';
  const pts = Array.from({ length: 9 }, () => v3());
  guidePath(st, frame, pts);
  assert.ok(pts[2].z > pts[0].z, 'second dots should head back toward the wrist (+z)');
  assert.ok(distance(pts[8], frame.path.index[3]) < 0.002);
});
