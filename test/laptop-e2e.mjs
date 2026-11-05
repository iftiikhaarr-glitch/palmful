// End-to-end: plays one complete session in laptop mode against the
// PRODUCTION build, using only the keyboard controls a person would use.
// Usage: npm run build && npx vite preview --port 4173 &  then
//        node test/laptop-e2e.mjs [baseUrl] [screenshotDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173/';
const shots = process.argv[3] ?? '.';
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const t0 = Date.now();

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const state = () => page.evaluate(() => {
  const p = window.__palmful;
  return p ? { tracked: p.tracked, phase: p.phase, trail: p.trailVisible, hint: p.hint, coach: p.coach, ...p.state, m: { ...p.metrics } } : null;
});
async function waitFor(desc, pred, timeoutS) {
  const end = Date.now() + timeoutS * 1000;
  let s;
  while (Date.now() < end) {
    s = await state();
    if (s && pred(s)) { log('OK  ', desc, `place=${s.place} a=${s.a.toFixed(3)} b=${s.b.toFixed(3)} s=${s.s.toFixed(3)} blooms=${s.blooms} mood=${s.mood} phase=${s.phase} hint="${s.hint}"`); return s; }
    await page.waitForTimeout(500);
  }
  log('FAIL', desc, JSON.stringify(s));
  throw new Error('timeout: ' + desc);
}
const keys = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(60); } };

let ok = false;
try {
  await page.goto(base + '?emulate=1');
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.click('#laptop-start');
  await waitFor('before any hand: seed waits; coach step 1 "Hold out your hand" (raise pictogram)', (s) => s.phase === 'await' && s.coach === 'b-raise' && /Hold out your hand/.test(s.hint), 90);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/laptop-1-await.png` });

  await keys(' '); // raise hand, palm up
  await waitFor('seed lands and hatches -> play', (s) => s.phase === 'play' && s.tracked, 60);
  await waitFor('first session: coach step 2 teaches the tilt while the light trail shows the way', (s) => s.trail && s.coach === 'b-tilt', 30);
  await page.screenshot({ path: `${shots}/laptop-2-trail.png` });
  await keys('F'); // a fist before the end: the coach goes back to step 1
  await waitFor('fist during play: coach says "Open your hand" (step 1 again, not ticked)', (s) => s.coach === 'b-open' && /Open your hand/.test(s.hint) && s.blooms === 0, 10);
  await page.screenshot({ path: `${shots}/laptop-2b-fist-open-hand.png` });
  await keys('F'); // open again
  await waitFor('hand open again: back to "Tilt gently toward the light"', (s) => s.coach === 'b-tilt', 10);

  await keys('ArrowUp', 7); // 35 deg fingertips down
  await waitFor('bloom 1 (middle)', (s) => s.blooms >= 1, 240);
  await waitFor('after the first bloom: "1 of 3 in bloom" (the goal)', (s) => s.coach === 'b-goal1', 3);
  await page.screenshot({ path: `${shots}/laptop-3-bloom1.png` });
  await waitFor('then the tilt lesson is done: no card while playing', (s) => s.coach === '' && s.hint === '', 6);

  await keys(' '); await keys('ArrowDown', 6);
  await waitFor('slid back to palm', (s) => s.place === 'palm', 180);
  await keys(' '); await keys('ArrowRight', 6);
  await waitFor('rolled toward index side', (s) => s.place === 'palm' && s.a > 0.012, 180);
  await keys('ArrowUp', 7); await keys('ArrowLeft', 4);
  await waitFor('bloom 2 (index)', (s) => s.blooms >= 2, 240);

  await keys(' '); await keys('ArrowDown', 6);
  await waitFor('slid back to palm', (s) => s.place === 'palm', 180);
  await keys(' '); await keys('ArrowLeft', 6);
  await waitFor('rolled toward pinky side', (s) => s.place === 'palm' && s.a < -0.012, 180);
  await keys('ArrowUp', 7); await keys('ArrowRight', 4);
  await waitFor('bloom 3 (ring) = session complete; the card shows the fist restart', (s) => s.blooms >= 3 && s.m.sessionsCompleted >= 1 && s.phase === 'done' && s.coach === 'b-done', 240);
  await page.waitForTimeout(1500);
  const layout = await page.evaluate(() => window.__palmful.layout());
  log(layout.panelVisible && layout.overlaps === 0 ? 'OK  ' : 'FAIL', 'completion panel clear of hand, Mote and flowers', JSON.stringify(layout));
  await page.screenshot({ path: `${shots}/laptop-4-complete.png` });
  if (!layout.panelVisible || layout.overlaps !== 0) throw new Error('completion panel overlaps');

  await keys('H');
  await waitFor('hand hidden -> waiting', (s) => !s.tracked && s.mood === 'waiting' && /Bring your hand back/.test(s.hint), 60);
  await keys('H');
  await waitFor('hand back -> tracked, blooms kept', (s) => s.tracked && s.blooms === 3, 60);

  await keys(' '); await keys('F');
  await waitFor('fist restarts the session (re-hatch)', (s) => s.m.restarts >= 1 && s.blooms === 0, 120);
  await keys('F');
  await waitFor('back to play after re-hatch', (s) => s.phase === 'play', 60);
  await waitFor('second session: no tutorial, the light trail alone shows the way', (s) => s.trail && s.coach === '', 10);
  await page.screenshot({ path: `${shots}/laptop-5-restarted.png` });

  // Inspection camera: the game pauses, the hand keys are ignored, frames keep
  // running, and R resumes. (Bloom mode has no progress card; this once threw.)
  await keys(']');
  const i0 = await state();
  await keys('ArrowUp', 7); // ignored while inspecting: Mote must not slide
  await keys(']', 35);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${shots}/laptop-6-inspect-back.png` });
  const i1 = await state();
  const inspecting = await page.evaluate(() => window.__palmful.inspecting);
  const still = i1.place === i0.place && Math.abs(i1.a - i0.a) < 1e-6 && Math.abs(i1.b - i0.b) < 1e-6 && i1.blooms === i0.blooms;
  if (!inspecting || !still || i1.m.frames <= i0.m.frames + 30) throw new Error('inspection: game not paused or frames stopped ' + JSON.stringify({ inspecting, i0: [i0.place, i0.a, i0.b, i0.m.frames], i1: [i1.place, i1.a, i1.b, i1.m.frames] }));
  log('OK  ', 'inspection pauses the game, frames keep running', `frames +${i1.m.frames - i0.m.frames}`);
  await keys('R');
  await page.waitForTimeout(800);
  const i2 = await state();
  if (await page.evaluate(() => window.__palmful.inspecting) || i2.m.sessionS <= i1.m.sessionS) throw new Error('inspection: R did not resume');
  log('OK  ', 'R ends inspection and the game runs on');
  const thrown = errors.filter((e) => /TypeError|ReferenceError|RangeError/.test(e));
  if (thrown.length) throw new Error('script errors: ' + thrown.slice(0, 3).join(' | '));
  ok = true;
} catch (e) {
  log(String(e));
  await page.screenshot({ path: `${shots}/laptop-failure.png` }).catch(() => {});
} finally {
  const s = await state().catch(() => null);
  log('final metrics', JSON.stringify(s?.m));
  log('page errors:', errors.length ? errors.slice(0, 8) : 'none');
  await browser.close();
  process.exit(ok ? 0 : 1);
}
