// End-to-end for catch mode (?catch=1) against the PRODUCTION build, played
// only with the laptop keys: move under the seed, let it land, cup (C).
// Covers: no catch without a cup, catch, a deliberate miss with progress
// kept, tracking loss pausing the seed, three-catch completion, the
// completion panel layout, and a fist replay.
// Usage: node test/catch-e2e.mjs https://localhost:4173/ [screenshotDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 640 } });

const state = () =>
  page.evaluate(() => {
    const p = window.__palmful;
    if (!p) return null;
    const c = p.catch;
    return {
      tracked: p.tracked, phase: p.phase, hint: p.hint, cup: p.cup, mode: p.mode,
      palm: { ...p.palmCenter },
      seed: c ? { state: c.seed, x: c.pos.x, y: c.pos.y, z: c.pos.z, catches: c.catches, misses: c.misses, round: c.round } : null,
      m: { ...p.metrics },
    };
  });
const fmt = (s) => s?.seed ? `seed=${s.seed.state} caught=${s.seed.catches} missed=${s.seed.misses} round=${s.seed.round} phase=${s.phase} cup=${s.cup.toFixed(2)} hint="${s.hint}"` : JSON.stringify(s);
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
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(40); } };

/** Move the hand (2 cm per key press) until the palm is under the seed. */
async function moveUnderSeed() {
  for (let i = 0; i < 40; i++) {
    const s = await state();
    const dx = s.seed.x - s.palm.x;
    const dz = s.seed.z - s.palm.z;
    if (Math.hypot(dx, dz) < 0.015) return;
    if (Math.abs(dx) >= Math.abs(dz)) await press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    else await press(dz < 0 ? 'ArrowUp' : 'ArrowDown');
    await page.waitForTimeout(60);
  }
}

let ok = false;
try {
  await page.goto(base + '?emulate=1&catch=1');
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.click('#laptop-start');
  await waitFor('catch mode: before any hand the seed waits and asks for a palm', (s) => s.mode === 'catch' && s.phase === 'await' && /Hold out your hand/.test(s.hint) && s.seed?.state === 'waiting', 60);
  await page.screenshot({ path: `${shots}/catch-1-await.png` });

  await press(' ');
  await waitFor('palm offered: the seed starts to fall', (s) => s.seed.state === 'falling', 30);
  await page.screenshot({ path: `${shots}/catch-2-falling.png` });
  await moveUnderSeed();
  await waitFor('hand moved under it: the seed lands in the open palm', (s) => s.seed.state === 'resting', 30);
  await page.waitForTimeout(2500);
  await waitFor('no false catch: open palm holds it but does not catch (2.5 s)', (s) => s.seed.state === 'resting' && s.seed.catches === 0, 5);
  await page.screenshot({ path: `${shots}/catch-3-resting.png` });
  await press('C');
  const caught1 = await waitFor('gentle cup catches it: flower 1', (s) => s.seed.catches === 1, 15);
  const r1 = caught1.seed.round + 1; // the next seed's round
  await page.screenshot({ path: `${shots}/catch-4-caught.png` });
  await press('C'); // open again

  // Next seed: stay put (it spawns at least 10 cm away), so it is missed.
  await waitFor('next seed falling', (s) => s.seed.state === 'falling' && s.seed.round === r1, 30);
  const missed = await waitFor('hand left where it was: the seed is missed', (s) => s.seed.state === 'missed', 30);
  await page.screenshot({ path: `${shots}/catch-5-missed.png` });
  if (missed.seed.catches !== 1 || missed.seed.misses !== 1) throw new Error('miss should keep progress');
  await waitFor('the seed comes back for another try; progress kept', (s) => s.seed.round === r1 + 1 && s.seed.catches === 1 && s.seed.misses === 1, 30);

  // Tracking loss mid-fall pauses the seed.
  await waitFor('falling again', (s) => s.seed.state === 'falling', 30);
  await press('H');
  const lost = await waitFor('hand hidden: tracking lost', (s) => !s.tracked, 10);
  await page.waitForTimeout(2500);
  const still = await state();
  if (Math.abs(still.seed.y - lost.seed.y) > 0.002 || still.seed.state !== 'falling' || still.seed.misses !== 1)
    throw new Error(`seed did not pause: ${lost.seed.y} -> ${still.seed.y} ${still.seed.state}`);
  log('OK  ', 'seed paused while the hand was lost (2.5 s, no miss)', fmt(still), /Bring your hand back/.test(still.hint) ? '' : '(hint missing!)');
  if (!/Bring your hand back/.test(still.hint)) throw new Error('no hand-loss hint');
  await press('H');
  await waitFor('hand back: tracked again', (s) => s.tracked, 10);
  await moveUnderSeed();
  await waitFor('lands', (s) => s.seed.state === 'resting', 30);
  await press('C');
  await waitFor('catch 2', (s) => s.seed.catches === 2, 15);
  await press('C');

  await waitFor('third seed falling', (s) => s.seed.state === 'falling' && s.seed.catches === 2, 30);
  await moveUnderSeed();
  await waitFor('lands', (s) => s.seed.state === 'resting', 30);
  await press('C');
  await waitFor('catch 3 completes the session', (s) => s.seed.catches === 3 && s.phase === 'done' && s.seed.state === 'done', 20);
  await page.waitForTimeout(1200);
  const layout = await page.evaluate(() => window.__palmful.layout());
  log(layout.panelVisible && layout.overlaps === 0 ? 'OK  ' : 'FAIL', 'completion panel clear of hand and flowers', JSON.stringify(layout));
  if (!layout.panelVisible || layout.overlaps !== 0) throw new Error('completion panel overlaps');
  await page.screenshot({ path: `${shots}/catch-6-complete.png` });

  await press('C'); // open
  await press('F');
  await waitFor('fist replays: fresh session', (s) => s.m.restarts >= 1 && s.seed.catches === 0 && s.phase === 'play', 20);
  await page.waitForTimeout(2000);
  await waitFor('new seed waits while the hand is still a fist, asks to open it', (s) => s.seed.state === 'waiting' && /Open your hand/.test(s.hint), 5);
  await press('F'); // open
  await waitFor('hand opened: the new seed falls', (s) => s.seed.state === 'falling', 15);
  ok = true;
} catch (e) {
  log(String(e));
  await page.screenshot({ path: `${shots}/catch-failure.png` }).catch(() => {});
} finally {
  await browser.close();
  process.exit(ok ? 0 : 1);
}
