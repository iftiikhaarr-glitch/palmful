// Window-size check for the laptop emulator, both game modes, on the
// PRODUCTION build. For each window size it plays the opening, one catch /
// bloom, and completion, and checks at each step that:
//   - the progress display (catch), hint/completion panel, seed, ring and
//     hand are fully inside the window (not clipped at the browser edge),
//   - the 3D panels do not sit under the help panel,
//   - the help panel itself fits inside the window,
//   - the hand silhouette is drawn (and the full skeleton is not).
// Screenshots: size-<mode>-<w>x<h>-<step>.png
// Usage: node test/layout-sizes.mjs https://localhost:4173/ [shotsDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const SIZES = [
  [1920, 1080], // large monitor
  [1366, 768], // common laptop
  [1024, 640], // small laptop window
  [820, 1100], // tall, narrow (split screen)
  [700, 560], // small window
];
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
let failures = 0;
const check = (desc, ok, detail = '') => {
  log(ok ? 'OK  ' : 'FAIL', desc, detail);
  if (!ok) failures++;
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function session(mode, W, H) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const tag = `${mode} ${W}x${H}`;
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(40); } };
  const st = () => page.evaluate(() => {
    const p = window.__palmful;
    const c = p.catch;
    return { phase: p.phase, tracked: p.tracked, blooms: p.state.blooms, place: p.state.place, palm: { ...p.palmCenter },
      seed: c ? { state: c.seed, x: c.pos.x, z: c.pos.z, catches: c.catches } : null };
  });
  const waitFor = async (desc, pred, s) => {
    const end = Date.now() + s * 1000;
    while (Date.now() < end) { const v = await st(); if (pred(v)) return v; await page.waitForTimeout(150); }
    throw new Error(`${tag}: timeout ${desc}`);
  };
  /** Everything inside the window and clear of the help panel? */
  async function inspect(step) {
    await page.waitForTimeout(2200); // let the fit settle
    const pts = await page.evaluate(() => window.__palmful.screenPoints());
    const panel = await page.evaluate(() => {
      const r = document.getElementById('laptop-panel').getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    });
    const m = 0.005; // tolerance: half a percent of the window
    const out = [];
    for (const [name, list] of Object.entries(pts)) {
      for (const [x, y] of list) if (x < -m || x > 1 + m || y < -m || y > 1 + m) out.push(`${name}@${x.toFixed(2)},${y.toFixed(2)}`);
    }
    check(`${tag} ${step}: progress/hint panels, seed, ring and hand fully inside the window`, out.length === 0, out.slice(0, 4).join(' '));
    const under = [];
    for (const name of ['hudBox', 'hintBox']) {
      const list = pts[name];
      if (!list) continue;
      const xs = list.map(([x]) => x * W), ys = list.map(([, y]) => y * H);
      const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      const overlap = box.left < panel.right && box.right > panel.left && box.top < panel.bottom && box.bottom > panel.top;
      if (overlap) under.push(name);
    }
    check(`${tag} ${step}: 3D panels not under the help panel`, under.length === 0, under.join(' '));
    check(`${tag} ${step}: help panel inside the window`, panel.left >= 0 && panel.top >= 0 && panel.right <= W && panel.bottom <= H, JSON.stringify(panel));
    await page.screenshot({ path: `${shots}/size-${mode}-${W}x${H}-${step}.png` });
  }
  async function moveUnderSeed() {
    for (let i = 0; i < 50; i++) {
      const s = await st();
      const dx = s.seed.x - s.palm.x, dz = s.seed.z - s.palm.z;
      if (Math.hypot(dx, dz) < 0.015) return;
      if (Math.abs(dx) >= Math.abs(dz)) await press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      else await press(dz < 0 ? 'ArrowUp' : 'ArrowDown');
      await page.waitForTimeout(60);
    }
  }
  try {
    await page.goto(base + (mode === 'catch' ? '?emulate=1&catch=1' : '?emulate=1'));
    await page.waitForSelector('#laptop-start', { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.click('#laptop-start');
    await page.waitForFunction(() => document.querySelector('#laptop-start')?.style.display === 'none', null, { timeout: 30000 });
    await inspect('1-opening');
    await press(' ');
    const look = await page.evaluate(() => window.__palmful.silhouette());
    check(`${tag}: soft hand silhouette drawn, full skeleton hidden`, look.silhouette && !look.bones, JSON.stringify(look));
    if (mode === 'catch') {
      for (let k = 0; k < 3; k++) {
        await waitFor('falling', (s) => s.seed.state === 'falling', 30);
        await moveUnderSeed();
        await waitFor('resting', (s) => s.seed.state === 'resting', 30);
        await press('C');
        await waitFor('caught', (s) => s.seed.catches === k + 1, 15);
        if (k === 0) await inspect('2-catch');
        await press('C');
      }
      await waitFor('done', (s) => s.phase === 'done', 20);
    } else {
      await waitFor('play', (s) => s.phase === 'play', 30);
      await press('ArrowUp', 7);
      await waitFor('bloom 1', (s) => s.blooms >= 1, 120);
      await inspect('2-bloom');
      await press(' '); await press('ArrowDown', 6);
      await waitFor('palm', (s) => s.place === 'palm', 120);
      await press(' '); await press('ArrowRight', 6);
      await page.waitForTimeout(1500);
      await press('ArrowUp', 7); await press('ArrowLeft', 4);
      await waitFor('bloom 2', (s) => s.blooms >= 2, 120);
      await press(' '); await press('ArrowDown', 6);
      await waitFor('palm', (s) => s.place === 'palm', 120);
      await press(' '); await press('ArrowLeft', 6);
      await page.waitForTimeout(1500);
      await press('ArrowUp', 7); await press('ArrowRight', 4);
      await waitFor('done', (s) => s.phase === 'done', 120);
    }
    await inspect('3-complete');
    const layout = await page.evaluate(() => window.__palmful.layout());
    check(`${tag}: completion message clear of hand and flowers`, layout.panelVisible && layout.overlaps === 0, JSON.stringify(layout));
    check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '));
  } catch (e) {
    check(`${tag}: session completed`, false, String(e));
    await page.screenshot({ path: `${shots}/size-${mode}-${W}x${H}-failure.png` }).catch(() => {});
  }
  await page.close();
}

for (const [W, H] of SIZES) {
  await session('catch', W, H);
  await session('bloom', W, H);
}
await browser.close();
console.log(failures ? `${failures} failure(s)` : 'all window sizes pass');
process.exit(failures ? 1 : 0);
