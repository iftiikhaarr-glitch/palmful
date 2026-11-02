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
  return p ? { tracked: p.tracked, phase: p.phase, trail: p.trailVisible, hint: p.hint, ...p.state, m: { ...p.metrics } } : null;
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
  await waitFor('before any hand: seed waits, asks for a palm', (s) => s.phase === 'await' && /Hold out your hand/.test(s.hint), 90);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/laptop-1-await.png` });

  await keys(' '); // raise hand, palm up
  await waitFor('seed lands and hatches -> play', (s) => s.phase === 'play' && s.tracked, 60);
  await waitFor('idle Mote shows a light trail, no text', (s) => s.trail && s.hint === '', 30);
  await page.screenshot({ path: `${shots}/laptop-2-trail.png` });

  await keys('ArrowUp', 7); // 35 deg fingertips down
  await waitFor('bloom 1 (middle)', (s) => s.blooms >= 1, 240);
  await page.screenshot({ path: `${shots}/laptop-3-bloom1.png` });

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
  await waitFor('bloom 3 (ring) = session complete', (s) => s.blooms >= 3 && s.m.sessionsCompleted >= 1 && s.phase === 'done', 240);
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
  await page.screenshot({ path: `${shots}/laptop-5-restarted.png` });
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
