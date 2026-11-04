// Visibility check for the laptop emulator (?emulate=1): opens a mode,
// raises the hand, captures screenshots and measures the WCAG contrast ratio
// between key objects (hand joints, seed, Mote, landing ring) and the
// background, by sampling the rendered pixels at their projected positions.
// Usage: node test/contrast-check.mjs https://localhost:4173/ [shotsDir]
// The bloom opening (seed floating in front of the eyes, bobbing, while the
// laptop camera is still auto-framing) is measured with checkSettled():
// camera settled first, then the seed sampled along the path it actually took
// on screen during each of several screenshots, every one of which must pass.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const MIN_RATIO = 3; // WCAG minimum for graphical objects

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function sampler(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const at = (x, y) => {
    x = Math.max(0, Math.min(png.width - 1, Math.round(x)));
    y = Math.max(0, Math.min(png.height - 1, Math.round(y)));
    const i = (y * png.width + x) * 4;
    return lum(png.data[i], png.data[i + 1], png.data[i + 2]);
  };
  // brightest pixel in a box (objects are a few pixels wide; a moving object
  // is searched along the path it covered while the screenshot was taken)
  const peakBox = (x0, y0, x1, y1, pad = 3) => {
    let best = 0;
    for (let y = Math.min(y0, y1) - pad; y <= Math.max(y0, y1) + pad; y++)
      for (let x = Math.min(x0, x1) - pad; x <= Math.max(x0, x1) + pad; x++) best = Math.max(best, at(x, y));
    return best;
  };
  return { png, at, peakBox };
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failures = 0;
async function check(mode, query, keys, settleMs, file, ready = () => true) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
  await page.goto(base + query);
  await page.waitForSelector('#laptop-start');
  await page.waitForTimeout(2500);
  await page.click('#laptop-start');
  await page.waitForTimeout(2000);
  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(80); }
  // wait for the intended game state (not a fixed delay), then let it settle
  await page.waitForFunction(ready, null, { timeout: 30000 });
  await page.waitForTimeout(settleMs);
  const hiddenText = await page.textContent('#laptop-status');
  const path = `${shots}/${file}`;
  const pts = await page.evaluate(() => window.__palmful.screenPoints());
  await page.screenshot({ path });
  const after = await page.evaluate(() => window.__palmful.screenPoints());
  const s = sampler(path);
  const W = s.png.width, H = s.png.height;
  // background: median luminance of a ring of sample points away from the centre
  const bgs = [];
  for (let i = 0; i < 24; i++) bgs.push(s.at(W * (0.05 + 0.9 * ((i * 7) % 24) / 24), H * (i % 2 ? 0.08 : 0.92)));
  bgs.sort((a, b) => a - b);
  const bg = bgs[12];
  console.log(`${mode}: background luminance ${bg.toFixed(3)} (0 = black, 1 = white)${hiddenText ? `; status "${hiddenText}"` : ''}`);
  if (bg > 0.05) { console.log('  FAIL background is not dark'); failures++; }
  for (const [name, list] of Object.entries(pts)) {
    if (name.endsWith('Box')) continue; // panel corners: for clipping checks, not contrast
    const later = after[name] ?? list;
    const ratios = list.map(([x, y], i) => {
      const [x2, y2] = later[i] ?? [x, y];
      return ratio(s.peakBox(Math.round(x * W), Math.round(y * H), Math.round(x2 * W), Math.round(y2 * H)), bg);
    });
    const worst = Math.min(...ratios);
    const wi = ratios.indexOf(worst);
    const ok = worst >= MIN_RATIO;
    if (!ok) failures++;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(6)} n=${String(list.length).padStart(2)}  worst contrast ${worst.toFixed(1)}:1  median ${ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)].toFixed(1)}:1${list.length > 1 ? `  (worst: #${wi})` : ''}`);
  }
  await page.close();
  return pts;
}

/** Wait until the emulated camera stops moving (auto-framing tilt and zoom). */
async function cameraSettled(page, stableMs = 1000, timeoutMs = 15000) {
  const start = Date.now();
  let last = null, since = Date.now();
  while (Date.now() - start < timeoutMs) {
    const now = await page.evaluate(async () => {
      const h = await window.__palmfulEmu.dispatch('get_transform', { device: 'headset' });
      const e = h.euler;
      return `${e.pitch.toFixed(2)} ${e.yaw.toFixed(2)} ${e.roll.toFixed(2)} ${(window.__palmfulFovy ?? 0).toFixed(4)}`;
    });
    if (now !== last) { last = now; since = Date.now(); }
    else if (Date.now() - since >= stableMs) return Date.now() - start;
    await page.waitForTimeout(100);
  }
  return null;
}

/**
 * Contrast of objects that keep moving on screen (the bloom-opening seed bobs
 * and follows the camera). After the camera settles, each screenshot is taken
 * while every rendered frame's projected positions are recorded; an object is
 * sampled only inside the box its own recorded path covers (plus the same
 * 3 px pad as check()), so the frame the screenshot captured is always inside
 * it. Every screenshot must meet MIN_RATIO; a box that overlaps a panel fails.
 */
async function checkSettled(mode, query, file, ready, frames = 3) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
  await page.goto(base + query);
  await page.waitForSelector('#laptop-start');
  await page.waitForTimeout(2500);
  await page.click('#laptop-start');
  await page.waitForTimeout(2000);
  await page.waitForFunction(ready, null, { timeout: 30000 });
  const settledMs = await cameraSettled(page);
  const hiddenText = await page.textContent('#laptop-status');
  if (settledMs === null) {
    console.log(`${mode}: FAIL the camera did not settle within 15 s`);
    failures++;
    await page.close();
    return;
  }
  console.log(`${mode}: camera settled after ${(settledMs / 1000).toFixed(1)} s; ${frames} screenshots, each must pass${hiddenText ? `; status "${hiddenText}"` : ''}`);
  const worst = {};
  for (let f = 0; f < frames; f++) {
    if (f) await page.waitForTimeout(600); // spread the screenshots across the seed's bob
    await page.evaluate(() => {
      const rec = [];
      let on = true;
      const tick = () => {
        if (!on) return;
        rec.push(window.__palmful.screenPoints());
        requestAnimationFrame(tick);
      };
      rec.push(window.__palmful.screenPoints());
      requestAnimationFrame(tick);
      window.__contrastRec = { rec, stop: () => { on = false; rec.push(window.__palmful.screenPoints()); return rec; } };
    });
    await page.waitForTimeout(50); // a few frames recorded before the capture
    const path = `${shots}/${file.replace(/\.png$/, `-${f + 1}.png`)}`;
    await page.screenshot({ path });
    const rec = await page.evaluate(() => window.__contrastRec.stop());
    const s = sampler(path);
    const W = s.png.width, H = s.png.height;
    const bgs = [];
    for (let i = 0; i < 24; i++) bgs.push(s.at(W * (0.05 + 0.9 * ((i * 7) % 24) / 24), H * (i % 2 ? 0.08 : 0.92)));
    bgs.sort((a, b) => a - b);
    const bg = bgs[12];
    if (bg > 0.05) { console.log(`  FAIL frame ${f + 1}: background is not dark (${bg.toFixed(3)})`); failures++; }
    // panels that must not fall inside a sampling box
    const panels = Object.entries(rec[rec.length - 1]).filter(([n]) => n.endsWith('Box')).map(([n, c]) => {
      const xs = c.map(([x]) => x * W), ys = c.map(([, y]) => y * H);
      return { n, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    });
    const names = new Set(rec.flatMap((r) => Object.keys(r)).filter((n) => !n.endsWith('Box')));
    for (const name of names) {
      const count = Math.max(...rec.map((r) => r[name]?.length ?? 0));
      for (let i = 0; i < count; i++) {
        const xs = [], ys = [];
        for (const r of rec) if (r[name]?.[i]) { xs.push(r[name][i][0] * W); ys.push(r[name][i][1] * H); }
        const box = { x0: Math.floor(Math.min(...xs)), x1: Math.ceil(Math.max(...xs)), y0: Math.floor(Math.min(...ys)), y1: Math.ceil(Math.max(...ys)) };
        const hit = panels.find((p) => box.x1 + 3 >= p.x0 && box.x0 - 3 <= p.x1 && box.y1 + 3 >= p.y0 && box.y0 - 3 <= p.y1);
        const r = ratio(s.peakBox(box.x0, box.y0, box.x1, box.y1), bg);
        const label = `${name}${count > 1 ? ` #${i}` : ''}`;
        // A panel just below the object (the hint under the waiting seed): in
        // the column through the object's centre, the rendered image must show
        // a run of background pixels between the object and the panel, i.e.
        // the whole object is clear of the panel, not just its centre.
        let gap = '';
        let gapOk = true;
        const cx = Math.round((box.x0 + box.x1) / 2);
        const below = panels.filter((p) => cx >= p.x0 && cx <= p.x1 && p.y0 > box.y1).sort((a, b) => a.y0 - b.y0)[0];
        if (below && !hit) {
          // walk down from the object's centre: past the object's own pixels,
          // then count background rows up to the first panel pixel. The
          // object and the panel may both have moved during the capture, so
          // look as far as the panel's top plus the object's whole path.
          const dark = (y) => s.at(cx, y) <= bg + 0.005;
          const end = Math.min(H - 1, Math.ceil(below.y0) + (box.y1 - box.y0) + 10);
          let y = Math.round((box.y0 + box.y1) / 2);
          while (y <= end && !dark(y)) y++; // the object itself
          let best = 0;
          while (y <= end && dark(y)) { best++; y++; } // background between object and panel
          gapOk = best >= 4 && y <= end; // a panel pixel was reached after the gap
          gap = `  clear of ${below.n} by ${best} px`;
        }
        const ok = !hit && gapOk && r >= MIN_RATIO;
        if (!ok) failures++;
        console.log(`  ${ok ? 'OK  ' : 'FAIL'} frame ${f + 1} ${label.padEnd(6)} contrast ${r.toFixed(1)}:1  path ${box.x1 - box.x0}x${box.y1 - box.y0} px over ${rec.length} frames${hit ? `  overlaps ${hit.n}: cannot tell it apart` : gap}${gapOk ? '' : ' (needs 4)'}`);
        worst[label] = Math.min(worst[label] ?? Infinity, hit ? 0 : r);
      }
    }
  }
  for (const [label, r] of Object.entries(worst)) console.log(`  ${r >= MIN_RATIO ? 'OK  ' : 'FAIL'} ${label.padEnd(6)} worst of ${frames} screenshots ${r.toFixed(1)}:1`);
  await page.close();
}

// 1. bloom opening: hand still lowered (seed waiting, "HAND HIDDEN")
await checkSettled('bloom / opening (hand lowered)', '?emulate=1', 'vis-bloom-opening.png', () => window.__palmful?.phase === 'await');
// 2. bloom after Space: hand + Mote + trail
await check('bloom / playing', '?emulate=1', [' '], 800, 'vis-bloom-playing.png', () => window.__palmful?.phase === 'play');
// 3. catch opening
await check('catch / opening (hand lowered)', '?emulate=1&catch=1', [], 800, 'vis-catch-opening.png', () => window.__palmful?.catch?.seed === 'waiting');
// 4. catch falling: seed + ring + hand
await check('catch / seed falling', '?emulate=1&catch=1', [' '], 400, 'vis-catch-falling.png', () => window.__palmful?.catch?.seed === 'falling');
await browser.close();
console.log(failures ? `${failures} contrast failure(s)` : 'all objects meet 3:1 contrast against the background');
process.exit(failures ? 1 : 0);
