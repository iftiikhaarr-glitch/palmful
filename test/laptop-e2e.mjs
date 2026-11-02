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
  return p ? { tracked: p.tracked, ...p.state, m: { ...p.metrics } } : null;
});
async function waitFor(desc, pred, timeoutS) {
  const end = Date.now() + timeoutS * 1000;
  let s;
  while (Date.now() < end) {
    s = await state();
    if (s && pred(s)) { log('OK  ', desc, `place=${s.place} a=${s.a.toFixed(3)} b=${s.b.toFixed(3)} s=${s.s.toFixed(3)} blooms=${s.blooms} mood=${s.mood}`); return s; }
    await page.waitForTimeout(500);
  }
  log('FAIL', desc, JSON.stringify(s));
  throw new Error('timeout: ' + desc);
}
const keys = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(60); } };

let ok = false;
try {
  await page.goto(base + '?emulate=1&debug=1');
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.click('#laptop-start');
  await waitFor('hand tracked after Start', (s) => s.tracked, 90);

  await keys('ArrowUp', 7); // 35 deg fingertips down
  await waitFor('bloom 1 (middle)', (s) => s.blooms >= 1, 240);
  await page.screenshot({ path: `${shots}/laptop-bloom1.png` });

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
  await waitFor('bloom 3 (ring) = session complete', (s) => s.blooms >= 3 && s.m.sessionsCompleted >= 1, 240);
  await page.screenshot({ path: `${shots}/laptop-complete.png` });

  await keys('H');
  await waitFor('hand hidden -> waiting', (s) => !s.tracked && s.mood === 'waiting', 60);
  await keys('H');
  await waitFor('hand back -> tracked, blooms kept', (s) => s.tracked && s.blooms === 3, 60);

  await keys(' '); await keys('F');
  await waitFor('fist restarts the session', (s) => s.m.restarts >= 1 && s.blooms === 0, 120);
  await keys('F');
  await page.screenshot({ path: `${shots}/laptop-restarted.png` });
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
