// Visibility check for the laptop emulator (?emulate=1): opens a mode,
// raises the hand, captures screenshots and measures the WCAG contrast ratio
// between key objects (hand joints, seed, Mote, landing ring) and the
// background, by sampling the rendered pixels at their projected positions.
// Usage: node test/contrast-check.mjs https://localhost:4173/ [shotsDir]
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
    const later = after[name] ?? list;
    const ratios = list.map(([x, y], i) => {
      const [x2, y2] = later[i] ?? [x, y];
      return ratio(s.peakBox(Math.round(x * W), Math.round(y * H), Math.round(x2 * W), Math.round(y2 * H)), bg);
    });
    const worst = Math.min(...ratios);
    const ok = worst >= MIN_RATIO;
    if (!ok) failures++;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(6)} n=${String(list.length).padStart(2)}  worst contrast ${worst.toFixed(1)}:1  median ${ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)].toFixed(1)}:1`);
  }
  await page.close();
  return pts;
}

// 1. bloom opening: hand still lowered (seed waiting, "HAND HIDDEN")
await check('bloom / opening (hand lowered)', '?emulate=1', [], 800, 'vis-bloom-opening.png', () => window.__palmful?.phase === 'await');
// 2. bloom after Space: hand + Mote + trail
await check('bloom / playing', '?emulate=1', [' '], 800, 'vis-bloom-playing.png', () => window.__palmful?.phase === 'play');
// 3. catch opening
await check('catch / opening (hand lowered)', '?emulate=1&catch=1', [], 800, 'vis-catch-opening.png', () => window.__palmful?.catch?.seed === 'waiting');
// 4. catch falling: seed + ring + hand
await check('catch / seed falling', '?emulate=1&catch=1', [' '], 400, 'vis-catch-falling.png', () => window.__palmful?.catch?.seed === 'falling');
await browser.close();
console.log(failures ? `${failures} contrast failure(s)` : 'all objects meet 3:1 contrast against the background');
process.exit(failures ? 1 : 0);
