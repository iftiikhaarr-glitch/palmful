// Coach card layout: plays the first session of both modes in laptop mode at
// several window sizes and, at every coach step, checks that the card is
// fully inside the window and clear of the seed, the landing ring, Mote, the
// hand and the progress display (screen space, with a margin).
// Usage: node test/coach-layout.mjs https://localhost:4173/ [shotsDir] [WxH,...]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const SIZES = (process.argv[4] ?? '1920x1080,1366x768,1024x640,820x1100,700x560').split(',').map((s) => s.split('x').map(Number));
const MARGIN = 0.012; // of the window size: the card must not come this close to an object
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failures = 0;
const log = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };

const box = (c) => {
  const xs = c.map(([x]) => x), ys = c.map(([, y]) => y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

async function checkStep(page, tag, seen) {
  const r = await page.evaluate(() => ({ id: window.__palmful.coach, pts: window.__palmful.screenPoints() }));
  if (!r.id || seen.has(r.id)) return;
  // let the card settle (eased in bloom play) and the laptop camera's
  // auto-framing catch up with it (it moves in small, damped steps)
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => ({ id: window.__palmful.coach, pts: window.__palmful.screenPoints() }));
  if (s.id !== r.id || !s.pts.hintBox) return;
  seen.add(s.id);
  const b = box(s.pts.hintBox);
  const inside = b.x0 >= 0 && b.x1 <= 1 && b.y0 >= 0 && b.y1 <= 1;
  const hits = [];
  for (const name of ['seed', 'ring', 'mote', 'joint']) {
    for (const [x, y] of s.pts[name] ?? []) {
      if (x > b.x0 - MARGIN && x < b.x1 + MARGIN && y > b.y0 - MARGIN && y < b.y1 + MARGIN) hits.push(`${name}@${x.toFixed(2)},${y.toFixed(2)}`);
    }
  }
  if (s.pts.hudBox) {
    const h = box(s.pts.hudBox);
    if (h.x1 > b.x0 && h.x0 < b.x1 && h.y1 > b.y0 && h.y0 < b.y1) hits.push('progress display');
  }
  log(inside && hits.length === 0, `${tag} ${s.id.padEnd(10)} card ${(b.x0 * 100).toFixed(0)}-${(b.x1 * 100).toFixed(0)}% x ${(b.y0 * 100).toFixed(0)}-${(b.y1 * 100).toFixed(0)}% ${inside ? 'inside' : 'CLIPPED'}${hits.length ? '  touches ' + hits.slice(0, 4).join(' ') : '  clear of seed, ring, Mote, hand'}`);
  if (process.env.SHOTS) await page.screenshot({ path: `${shots}/coach-${tag}-${s.id}.png` });
}

async function open(w, h, query) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: w, height: h } });
  await page.goto(base + query);
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.click('#laptop-start');
  await page.waitForFunction(() => document.querySelector('#laptop-start')?.style.display === 'none', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  return page;
}
const press = async (page, k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(60); } };
async function until(page, pred, tag, seen, timeoutS) {
  const end = Date.now() + timeoutS * 1000;
  while (Date.now() < end) {
    await checkStep(page, tag, seen);
    if (await page.evaluate(pred)) return true;
    await page.waitForTimeout(120);
  }
  log(false, `${tag} timed out waiting for ${pred}`);
  return false;
}

for (const [w, h] of SIZES) {
  // ---- bloom ----
  {
    const tag = `bloom ${w}x${h}`;
    const seen = new Set();
    const page = await open(w, h, '?emulate=1');
    await until(page, () => window.__palmful.coach === 'b-raise', tag, seen, 20);
    await press(page, ' ');
    await until(page, () => window.__palmful.coach === 'b-tilt', tag, seen, 20);
    await press(page, 'ArrowUp', 7);
    await until(page, () => window.__palmful.state.blooms >= 1, tag, seen, 60);
    await until(page, () => window.__palmful.coach === '', tag, seen, 6);
    for (const [roll, back] of [['ArrowRight', 'ArrowLeft'], ['ArrowLeft', 'ArrowRight']]) {
      await press(page, ' '); await press(page, 'ArrowDown', 6);
      await until(page, () => window.__palmful.state.place === 'palm', tag, seen, 30);
      await press(page, ' '); await press(page, roll, 6);
      await page.waitForTimeout(1500);
      await press(page, 'ArrowUp', 7); await press(page, back, 4);
      const n = (await page.evaluate(() => window.__palmful.state.blooms)) + 1;
      await until(page, new Function(`return window.__palmful.state.blooms >= ${n}`), tag, seen, 60);
    }
    await until(page, () => window.__palmful.coach === 'b-done', tag, seen, 10);
    await page.waitForTimeout(600);
    seen.delete('b-done');
    await checkStep(page, tag, seen);
    log(['b-raise', 'b-tilt', 'b-goal1', 'b-done'].every((id) => seen.has(id)), `${tag} saw raise, tilt, 1 of 3 and the fist restart (${[...seen].join(' > ')})`);
    await page.close();
  }
  // ---- catch ----
  {
    const tag = `catch ${w}x${h}`;
    const seen = new Set();
    const page = await open(w, h, '?emulate=1&catch=1');
    await until(page, () => window.__palmful.coach === 'c-raise', tag, seen, 20);
    await press(page, ' ');
    for (let n = 1; n <= 3; n++) {
      await until(page, () => window.__palmful.catch.seed === 'falling', tag, seen, 30);
      if (n === 1) await press(page, 's', 4); // a gap, so the seed can fall onto the open palm (step 2)
      for (let i = 0; i < 60; i++) {
        await checkStep(page, tag, seen);
        const s = await page.evaluate(() => ({ st: window.__palmful.catch.seed, sx: window.__palmful.catch.pos.x, sz: window.__palmful.catch.pos.z, px: window.__palmful.palmCenter.x, pz: window.__palmful.palmCenter.z }));
        if (s.st !== 'falling') break;
        const dx = s.sx - s.px, dz = s.sz - s.pz;
        if (Math.hypot(dx, dz) > 0.015) await press(page, Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dz < 0 ? 'ArrowUp' : 'ArrowDown'));
        else await page.waitForTimeout(120);
      }
      await until(page, () => window.__palmful.catch.seed === 'resting', tag, seen, 30);
      if (n === 1) await until(page, () => window.__palmful.coach === 'c-cup', tag, seen, 3);
      await press(page, 'c');
      await until(page, new Function(`return window.__palmful.catch.catches >= ${n}`), tag, seen, 10);
      if (n < 3) await until(page, () => window.__palmful.catch.seed === 'waiting', tag, seen, 10);
      await press(page, 'c');
    }
    await until(page, () => window.__palmful.coach === 'c-fist', tag, seen, 10);
    await checkStep(page, tag, seen);
    // 'c-land' (palm under, seed still falling) uses the same card position as
    // every catch step; it is often too short here for the 1.2 s settle, and
    // test/catch-e2e.mjs checks its order frame by frame.
    log(['c-raise', 'c-under', 'c-cup', 'c-goal1', 'c-goal2', 'c-fist'].every((id) => seen.has(id)), `${tag} saw raise, under, cup, 1 and 2 of 3 and the fist restart (${[...seen].join(' > ')})`);
    await page.close();
  }
}
await browser.close();
console.log(failures ? `${failures} coach layout failure(s)` : 'coach card: inside the window and clear of seed, ring, Mote, hand and progress at every step and size');
process.exit(failures ? 1 : 0);
