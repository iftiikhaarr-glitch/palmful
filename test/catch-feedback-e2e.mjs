// Catch landing feedback (laptop emulator, production build). From the first
// Quest recording: the ring was green while a hand reading cup >= 0.42 was
// refused, and one-hand Catch silently follows only the selected hand.
// Checks, using the game's own landing check (window.__palmful.landing()):
//  1. palm under the falling seed, open: ring green, reason "ok";
//  2. same place, hand cupped (cup >= 0.42): ring NOT green, reason
//     cup-too-high, and the seed does not land; opening again: green, it lands;
//  3. the OTHER (left) hand under the seed, the selected right hand away:
//     ring not green, reported as the wrong hand, and the seed is never caught.
// Usage: node test/catch-feedback-e2e.mjs https://localhost:4173/ [shotsDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const GREEN = '#2bff6e';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
let failures = 0;
const check = (desc, ok, detail = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${desc} ${detail}`); if (!ok) failures++; };
const L = () => page.evaluate(() => ({ ...window.__palmful.landing(), palm: { ...window.__palmful.palmCenter }, seed: { ...window.__palmful.catch.pos }, catches: window.__palmful.catch.catches, misses: window.__palmful.catch.misses }));
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(50); } };
const until = async (pred, s = 20) => { const end = Date.now() + s * 1000; let v; while (Date.now() < end) { v = await L(); if (pred(v)) return v; await page.waitForTimeout(80); } return v; };
async function moveUnder() {
  for (let i = 0; i < 60; i++) {
    const s = await L();
    const dx = s.seed.x - s.palm.x, dz = s.seed.z - s.palm.z;
    if (Math.hypot(dx, dz) < 0.015 || s.seedState !== 'falling') return;
    await press(Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dz < 0 ? 'ArrowUp' : 'ArrowDown'));
  }
}

try {
  await page.goto(base + '?emulate=1&catch=1&debug=1');
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.click('#laptop-start');
  await page.waitForFunction(() => document.querySelector('#laptop-start')?.style.display === 'none', null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await press(' ');
  let s = await until((v) => v.seedState === 'falling');
  check('selected hand is reported (one-hand Catch follows the right hand)', s.hand === 'right', JSON.stringify({ hand: s.hand }));
  await press('s', 6); // palm well below the seed, so it has to fall onto it
  await moveUnder();
  s = await until((v) => v.block === 'seed-above' && v.ready);
  check('1. open palm under the falling seed: ring green, reason ok (seed above)', s.ready && s.ringColor === GREEN && s.block === 'seed-above', JSON.stringify({ block: s.block, ring: s.ringColor, cup: +s.cup.toFixed(2) }));
  await page.screenshot({ path: `${shots}/feedback-1-open-green.png` });
  await press('c'); // cup BEFORE it lands
  s = await until((v) => v.cup >= 0.42 && v.block === 'cup-too-high');
  check('2. same place, hand cupped: ring NOT green, reason cup-too-high', !s.ready && s.ringColor !== GREEN && s.block === 'cup-too-high', JSON.stringify({ block: s.block, ring: s.ringColor, cup: +s.cup.toFixed(2) }));
  await page.screenshot({ path: `${shots}/feedback-2-cup-not-green.png` });
  // the seed reaches palm height but cannot land while the hand reads cupped
  const atPalm = await until((v) => v.dyCm < 2 || v.seedState !== 'falling', 10);
  await page.waitForTimeout(500);
  const still = await L();
  check('   ...and the seed does not land while the cup reading is high', still.seedState !== 'resting' && !still.ready, JSON.stringify({ state: still.seedState, dyCm: +atPalm.dyCm.toFixed(1), block: still.block }));
  // let this seed go (miss), then the same seed comes back: open hand -> green -> lands
  await press('c'); // open
  s = await until((v) => v.seedState === 'missed' || v.seedState === 'resting', 20);
  if (s.seedState === 'missed') {
    s = await until((v) => v.seedState === 'falling', 20);
    await press('s', 6);
    await moveUnder();
  }
  s = await until((v) => v.seedState === 'resting', 20);
  check('   opening the hand again: the seed lands (resting)', s.seedState === 'resting', JSON.stringify({ state: s.seedState, block: s.block }));
  await press('c');
  s = await until((v) => v.catches >= 1, 10);
  await press('c');
  check('   ...and is caught with a cup after landing', s.catches >= 1);

  // 3. wrong hand: the left hand under the next seed, the selected right hand away
  s = await until((v) => v.seedState === 'falling', 30);
  await press(s.seed.x > s.palm.x ? 'ArrowLeft' : 'ArrowRight', 12); // the selected right hand 24 cm away from the seed
  const emu = async (m, p) => page.evaluate(([m, p]) => window.__palmfulEmu.dispatch(m, p), [m, p]);
  await emu('set_connected', { device: 'hand-left', connected: true });
  await emu('set_hand_pose', { device: 'hand-left', poseId: 'flat' });
  let w = { x: s.seed.x - 0.02, y: s.palm.y - 0.12, z: s.seed.z + 0.07 };
  for (let i = 0; i < 6; i++) {
    await emu('set_transform', { device: 'hand-left', anchor: 'wrist', position: w, orientation: { fingers: [0, 0, -1], palm: [0, 1, 0] } });
    await page.waitForTimeout(250);
    const v = await L();
    if (!v.other) continue;
    w = { x: w.x + (v.seed.x - v.other.x), y: w.y, z: w.z + (v.seed.z - v.other.z) }; // centre the left palm under the seed
  }
  s = await until((v) => v.wrongHand, 8);
  check('3. left (unselected) hand under the seed: reported as the wrong hand, ring NOT green', s.wrongHand && !s.ready && s.ringColor !== GREEN && s.hand === 'right', JSON.stringify({ hand: s.hand, block: s.block, wrongHand: s.wrongHand, ring: s.ringColor, other: s.other && { x: +s.other.x.toFixed(3), z: +s.other.z.toFixed(3) }, seed: { x: +s.seed.x.toFixed(3), z: +s.seed.z.toFixed(3) } }));
  await page.screenshot({ path: `${shots}/feedback-3-wrong-hand.png` });
  const before = s.catches;
  s = await until((v) => v.seedState !== 'falling', 20);
  check('   ...and the seed is not caught by the unselected hand (missed)', s.seedState === 'missed' && s.catches === before, JSON.stringify({ state: s.seedState, catches: s.catches }));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  console.log('FAIL', String(e));
  failures++;
} finally {
  await browser.close();
  console.log(failures ? `${failures} failure(s)` : 'landing feedback agrees with the landing rule');
  process.exit(failures ? 1 : 0);
}
