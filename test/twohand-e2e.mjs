// End-to-end for optional two-hand catching (?catch=1&hands=2) against the
// PRODUCTION build, with laptop controls (L switches which hand the keys move).
// Covers: both hands tracked; the left hand catches gold; the right hand
// catches blue; a resting seed stays with its hand while that hand is lost
// (even with the other hand ready); a falling seed pauses when its engaged
// hand is lost; flowers stay on the hand that caught them; completion.
// Usage: node test/twohand-e2e.mjs https://localhost:4173/ [screenshotDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const state = () =>
  page.evaluate(() => {
    const p = window.__palmful;
    if (!p?.catch) return null;
    const c = p.catch;
    return { phase: p.phase, hint: p.hint, two: p.twoHands(), seed: { state: c.seed, kind: c.kind, caught: { ...c.caught }, x: c.pos.x, y: c.pos.y, z: c.pos.z, catches: c.catches, misses: c.misses } };
  });
const fmt = (s) => s ? `${s.seed.kind}:${s.seed.state} caught=${s.seed.catches} engaged=${s.two.engaged} R=${s.two.right} L=${s.two.left} flowers=${JSON.stringify(s.two.flowers)} hint="${s.hint}"` : 'null';
async function waitFor(desc, pred, timeoutS) {
  const end = Date.now() + timeoutS * 1000;
  let s;
  while (Date.now() < end) {
    s = await state();
    if (s && pred(s)) { log('OK  ', desc, fmt(s)); return s; }
    await page.waitForTimeout(150);
  }
  log('FAIL', desc, fmt(s));
  throw new Error('timeout: ' + desc);
}
function check(desc, ok, detail = '') {
  log(ok ? 'OK  ' : 'FAIL', desc, detail);
  if (!ok) throw new Error(desc);
}
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(40); } };
let ctrl = 'right';
async function control(side) {
  if (ctrl !== side) { await press('L'); ctrl = side; }
}
/** Move the controlled hand under the seed. */
async function moveUnderSeed(side) {
  await control(side);
  for (let i = 0; i < 60; i++) {
    const s = await state();
    const c = s.two.centers[side];
    if (!c) throw new Error(`${side} hand not tracked`);
    const dx = s.seed.x - c.x, dz = s.seed.z - c.z;
    if (Math.hypot(dx, dz) < 0.015) return;
    if (Math.abs(dx) >= Math.abs(dz)) await press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    else await press(dz < 0 ? 'ArrowUp' : 'ArrowDown');
    await page.waitForTimeout(60);
  }
}

let ok = false;
try {
  await page.goto(base + '?emulate=1&catch=1&hands=2');
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.click('#laptop-start');
  await page.waitForFunction(() => document.querySelector('#laptop-start')?.style.display === 'none', null, { timeout: 30000 });
  await waitFor('two-hand mode on; no hand raised yet', (s) => s.two.enabled && !s.two.right && !s.two.left && s.phase === 'await', 30);

  await press(' '); // raise right
  await control('left');
  await press(' '); // raise left
  await waitFor('both hands tracked', (s) => s.two.right && s.two.left, 15);
  await page.screenshot({ path: `${shots}/two-1-both-hands.png` });

  // Gold falls in the LEFT lane: the left hand catches it
  await waitFor('gold falling', (s) => s.seed.kind === 'gold' && s.seed.state === 'falling', 30);
  await moveUnderSeed('left');
  await waitFor('gold lands in the LEFT palm', (s) => s.seed.state === 'resting' && s.two.engaged === 'left', 30);
  await press('C');
  await waitFor('left hand catches gold; flower on the left hand', (s) => s.seed.caught.gold && s.two.flowers.middle === 'left', 15);
  await press('C');

  // Blue (right lane) rests in the RIGHT palm; right hand lost -> seed stays with right
  await waitFor('blue falling', (s) => s.seed.kind === 'blue' && s.seed.state === 'falling', 30);
  await moveUnderSeed('right');
  await waitFor('blue lands in the RIGHT palm', (s) => s.seed.state === 'resting' && s.two.engaged === 'right', 30);
  await control('right');
  await press('H'); // right hand lost
  await control('left');
  await press('C'); // left hand cups (must not catch)
  await page.waitForTimeout(2500);
  await waitFor('right lost: blue stays resting with the right hand; left cup does not catch; hint names the right hand',
    (s) => s.seed.state === 'resting' && s.two.engaged === 'right' && !s.seed.caught.blue && /right hand back/.test(s.hint), 5);
  await press('C'); // left opens
  await control('right');
  await press('H'); // right back
  await press('C'); // right cups
  await waitFor('right hand returns and catches blue; flower on the right hand', (s) => s.seed.caught.blue && s.two.flowers.index === 'right', 15);
  await press('C');
  await page.screenshot({ path: `${shots}/two-2-progress.png` });

  // Pink (centre): engaged right hand lost mid-fall -> seed pauses (left ready)
  await waitFor('pink falling', (s) => s.seed.kind === 'pink' && s.seed.state === 'falling', 30);
  await moveUnderSeed('right');
  const before = await waitFor('pink above the right palm, right engaged', (s) => s.two.engaged === 'right' && s.seed.state === 'falling', 10);
  await press('H');
  await page.waitForTimeout(2000);
  const paused = await state();
  check('right lost mid-fall: pink paused, not handed to the left hand, no miss',
    paused.seed.state === 'falling' && Math.abs(paused.seed.y - before.seed.y) < 0.012 && paused.two.engaged === 'right' && paused.seed.misses === 0, fmt(paused));
  await press('H');
  await waitFor('pink lands in the right palm', (s) => s.seed.state === 'resting' && s.two.engaged === 'right', 30);
  await press('C');
  await waitFor('3/3 complete with both hands', (s) => s.phase === 'done' && s.seed.catches === 3, 20);
  const fin = await state();
  check('flowers stay with the hand that caught them', fin.two.flowers.middle === 'left' && fin.two.flowers.index === 'right' && fin.two.flowers.ring === 'right', JSON.stringify(fin.two.flowers));
  await page.waitForTimeout(1200);
  const layout = await page.evaluate(() => window.__palmful.layout());
  check('completion card clear of the hand and flowers', layout.panelVisible && layout.overlaps === 0, JSON.stringify(layout));
  await page.screenshot({ path: `${shots}/two-3-complete.png` });
  check('no page errors', errors.length === 0, errors.join(' | '));
  ok = true;
} catch (e) {
  log(String(e));
  await page.screenshot({ path: `${shots}/two-failure.png` }).catch(() => {});
} finally {
  await browser.close();
  process.exit(ok ? 0 : 1);
}
