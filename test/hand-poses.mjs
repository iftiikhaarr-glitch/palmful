// Laptop emulator: screenshots of the hand model in each pose (open, receive,
// cup with a seed resting in it, fist), front, side and back, taken with the
// laptop inspection camera keys, plus checks that the hand reads as a solid
// hand, stays aligned with the game's palm centre, and that inspecting
// pauses the game without moving the hand. PRODUCTION build.
//   open    - palm up, flat, before the seed reaches it
//   receive - palm under the falling seed (ring green), seed just above
//   cup     - the seed resting in the palm, hand cupped (game paused with
//             the laptop-only __palmful.freeze() aid so the cup does not
//             immediately turn the seed into a flower)
//   fist    - after the catch, a closed fist with the flower
// Usage: node test/hand-poses.mjs https://localhost:4173/ [shotsDir] [WxH] [extraQuery]
//        HAND_SIZE=S|M|L picks the laptop hand display size first.
//        HEADED=1 opens a normal (non-headless) browser window, e.g. under
//        xvfb-run on a machine without a display.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const [W, H] = (process.argv[4] ?? '1280x800').split('x').map(Number);
const extra = process.argv[5] ?? '';
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
let failures = 0;
const check = (desc, ok, detail = '') => {
  log(ok ? 'OK  ' : 'FAIL', desc, detail);
  if (!ok) failures++;
};

// ignoreDefaultArgs: show classic scrollbars, as desktop browsers do (headless hides them)
const browser = await chromium.launch({ headless: !process.env.HEADED, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${W},${H + 87}`] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: W, height: H } });
// IWSDK draws its own hand (outline + an invisible depth "occluder") from the
// WebXR input-profiles CDN. Sandboxed CI often cannot reach that CDN, so the
// bug it caused (the laptop hand hidden behind the occluder) never showed.
// PROFILES_DIR=<unpacked @webxr-input-profiles/assets>/dist/profiles serves
// those files locally so the run matches a real browser.
const PROFILES = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/';
let profileHits = 0;
if (process.env.PROFILES_DIR) {
  const path = await import('node:path');
  await page.route((u) => u.href.startsWith(PROFILES), (route) => {
    const rel = decodeURIComponent(route.request().url().slice(PROFILES.length).split('?')[0]);
    const file = path.resolve(process.env.PROFILES_DIR, rel);
    if (!file.startsWith(path.resolve(process.env.PROFILES_DIR)) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
    profileHits++;
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: file.endsWith('.json') ? 'application/json' : 'model/gltf-binary' });
  });
}
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(40); } };
const state = () => page.evaluate(() => {
  const p = window.__palmful;
  const c = p.catch;
  return { tracked: p.tracked, phase: p.phase, cup: p.cup, palm: { ...p.palmCenter }, seed: c ? { state: c.seed, kind: c.kind, x: c.pos.x, y: c.pos.y, z: c.pos.z, catches: c.catches } : null };
});
async function waitFor(desc, pred, timeoutS) {
  const end = Date.now() + timeoutS * 1000;
  let s;
  while (Date.now() < end) {
    s = await state();
    if (s && pred(s)) return s;
    await page.waitForTimeout(40);
  }
  throw new Error('timeout: ' + desc + ' ' + JSON.stringify(s));
}
async function moveUnderSeed() {
  for (let i = 0; i < 50; i++) {
    const s = await state();
    const dx = s.seed.x - s.palm.x;
    const dz = s.seed.z - s.palm.z;
    if (Math.hypot(dx, dz) < 0.015) return;
    if (Math.abs(dx) >= Math.abs(dz)) await press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    else await press(dz < 0 ? 'ArrowUp' : 'ArrowDown');
    await page.waitForTimeout(60);
  }
}

/** Hand pixels: how much of the screen near the palm the hand covers, and how bright it is. */
async function handPixels(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const pts = await page.evaluate(() => window.__palmful.screenPoints());
  const js = pts.joint ?? [];
  if (!js.length) return null;
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
  for (const [x, y] of js) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  // palm centre on screen: mean of all joints (rough), sample a small box there
  let n = 0, lit = 0, dark = 0, sum = 0;
  for (let y = Math.floor(y0 * png.height); y < y1 * png.height; y++) {
    for (let x = Math.floor(x0 * png.width); x < x1 * png.width; x++) {
      const i = (y * png.width + x) * 4;
      const l = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
      sum += l;
      if (l > 70) lit++;
      if (l < 35) dark++;
    }
  }
  return { box: [x0, y0, x1, y1].map((v) => +v.toFixed(3)), litFrac: +(lit / n).toFixed(2), darkFrac: +(dark / n).toFixed(2), mean: +(sum / n).toFixed(0) };
}

/**
 * Side and back views through the laptop inspection camera (keys, as a person
 * would): = x18 turns the camera 90° around the hand (side), [ ] orbit around
 * the hand's length, 180° looks at its back. Checks that inspecting pauses the
 * game, never moves the hand, and that R puts the camera back.
 */
async function inspectViews(name) {
  const head0 = await page.evaluate(() => window.__palmfulEmu.dispatch('get_transform', { device: 'headset' }));
  const s0 = await state();
  await press('=', 18);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/hand-${name}-side.png` });
  await press('-', 18);
  await press(']', 36);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/hand-${name}-back.png` });
  const s1 = await state();
  const insp = await page.evaluate(() => ({ on: window.__palmful.inspecting, status: document.querySelector('#laptop-status').textContent }));
  const moved = Math.hypot(s1.palm.x - s0.palm.x, s1.palm.y - s0.palm.y, s1.palm.z - s0.palm.z);
  const seedMoved = s0.seed && s1.seed ? Math.hypot(s1.seed.x - s0.seed.x, s1.seed.y - s0.seed.y, s1.seed.z - s0.seed.z) : 0;
  check(`${name}: inspecting pauses the game and leaves the hand where it is`, insp.on && /INSPECT\s+around 180°/.test(insp.status) && moved < 1e-4 && seedMoved < 1e-4 && s1.seed?.state === s0.seed?.state,
    `palm moved ${(moved * 1000).toFixed(2)} mm, seed moved ${(seedMoved * 1000).toFixed(2)} mm, ${insp.status}`);
  await press('R');
  await page.waitForTimeout(600);
  const head1 = await page.evaluate(() => window.__palmfulEmu.dispatch('get_transform', { device: 'headset' }));
  const back = Math.hypot(head1.position.x - head0.position.x, head1.position.y - head0.position.y, head1.position.z - head0.position.z);
  const on = await page.evaluate(() => window.__palmful.inspecting);
  check(`${name}: R puts the camera back and resumes`, back < 1e-3 && !on, `camera ${(back * 1000).toFixed(1)} mm from where it was`);
}
async function front(name) {
  const f = `${shots}/hand-${name}-front.png`;
  // enter the inspection camera at 0° (] then [): the game pauses, the view is unchanged
  await press(']');
  await press('[');
  await page.waitForTimeout(400);
  await page.screenshot({ path: f });
  const px = await handPixels(f);
  log('     ', name, 'hand pixels', JSON.stringify(px));
  return px;
}

let ok = false;
try {
  await page.goto(base + '?emulate=1&catch=1' + extra);
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.click('#laptop-start');
  await page.waitForFunction(() => document.querySelector('#laptop-start')?.style.display === 'none', null, { timeout: 30000 });
  await page.waitForTimeout(800);
  if (process.env.HAND_SIZE) {
    // Small / Medium / Large display size (laptop only)
    await page.click(`.laptop-size[data-size="${process.env.HAND_SIZE}"]`);
    await page.waitForTimeout(200);
  }
  await press(' ');
  await waitFor('hand tracked', (s) => s.tracked, 20);
  await page.waitForTimeout(1500);

  // OPEN
  await page.evaluate(() => window.__palmful.freeze(true));
  await page.waitForTimeout(400);
  const open = await front('open');
  check('open: hand model drawn (silhouette on, bones hidden)', (await page.evaluate(() => window.__palmful.silhouette())).silhouette);
  if (!extra.includes('debug')) check('open: palm reads as a lit surface, not a hollow dark shape', open && open.litFrac > 0.3, JSON.stringify(open));
  await inspectViews('open');
  await page.evaluate(() => window.__palmful.freeze(false));

  // RECEIVE: under the falling seed, seed a few cm above the palm
  await waitFor('seed falling', (s) => s.seed.state === 'falling', 30);
  // the seed spawns only ~13 cm above the palm: pause it while the hand moves under
  await page.evaluate(() => window.__palmful.freeze(true));
  await moveUnderSeed();
  await page.waitForTimeout(600);
  const sr = await state();
  log('     ', 'receive: seed above palm', `${((sr.seed.y - sr.palm.y) * 100).toFixed(1)} cm`, sr.seed.state);
  check('receive: seed still falling, above the palm', sr.seed.state === 'falling' && sr.seed.y > sr.palm.y);
  await front('receive');
  await inspectViews('receive');
  await page.evaluate(() => window.__palmful.freeze(false));
  await moveUnderSeed();

  // CUP with the seed resting in it
  await waitFor('seed resting in the palm', (s) => s.seed.state === 'resting', 30);
  await page.evaluate(() => window.__palmful.freeze(true));
  await press('C');
  await page.waitForTimeout(900);
  const sc = await state();
  const pts = await page.evaluate(() => window.__palmful.screenPoints());
  check('cup: the seed is on screen while resting in the cupped palm', !!pts.seed, JSON.stringify(pts.seed));
  const d = Math.hypot(sc.seed.x - sc.palm.x, sc.seed.z - sc.palm.z);
  check('cup: seed sits over the palm centre the game uses (< 1.5 cm)', d < 0.015, `${(d * 100).toFixed(1)} cm`);
  await front('cup');
  await inspectViews('cup');
  await page.evaluate(() => window.__palmful.freeze(false));
  await waitFor('cup catches it', (s) => s.seed.catches === 1, 15);

  // FIST (with the new flower)
  await press('F');
  await page.waitForTimeout(900);
  await front('fist');
  await inspectViews('fist');
  await press('F');
  await page.waitForTimeout(600);
  if (process.env.PROFILES_DIR) {
    // IWSDK's own hand (outline + depth occluder) loaded, but hidden in laptop mode
    const ih = await page.evaluate(() => window.__palmful.iwsdkHands());
    const keep = extra.includes('iwsdkhand');
    check(`IWSDK hand visual loaded and ${keep ? 'kept (diagnosis)' : 'hidden'} in laptop mode`, ih.right.loaded && ih.right.visible === keep, JSON.stringify(ih));
  }
  // the help panel stays fully inside the window
  const panel = await page.evaluate(() => {
    const r = document.querySelector('#laptop-panel').getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight, sx: scrollX, sy: scrollY };
  });
  check('help panel fully inside the window, page not scrolled', panel.l >= 8 && panel.t >= 0 && panel.r <= panel.w && panel.b <= panel.h && !panel.sx && !panel.sy, JSON.stringify(panel));
  check('no page errors', errors.length === 0, errors.join(' | '));
  ok = failures === 0;
} catch (e) {
  log('ERROR', e.message);
  await page.screenshot({ path: `${shots}/hand-error.png` }).catch(() => {});
} finally {
  await browser.close();
}
if (process.env.PROFILES_DIR) log('     ', 'IWSDK hand-profile files served locally:', profileHits);
log(ok ? 'ALL HAND-POSE CHECKS PASSED' : `HAND-POSE CHECKS FAILED (${failures})`);
process.exit(ok ? 0 : 1);
