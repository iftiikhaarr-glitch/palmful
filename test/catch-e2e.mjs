// End-to-end for catch mode (?catch=1) against the PRODUCTION build, played
// only with the laptop controls. Covers: opening, progress display, hand
// display sizes (alignment + saved preference), seed selection keys 1/2/3,
// every seed colour (gold, blue, pink), no catch without a cup, a miss that
// returns the same seed and keeps progress, tracking loss pausing the seed,
// catch/miss cue pixels, the completion card layout, and a fist restart that
// resets all counts.
// Usage: node test/catch-e2e.mjs https://localhost:4173/ [screenshotDir]
//        WIDE_FONT=1 draws the in-scene cards in a wide font (DejaVu Sans, wider
//        than Windows' Segoe UI) to check the completion text still fits its card.
//        SIZE=WxH sets the window size; HEADED=1 opens a normal browser window.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

/** Count strongly green / strongly red pixels in a screenshot (cue check). */
function cuePixels(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  let green = 0, red = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    // cue green #2bff6e and cue red #ff3b3b only; not gold, blue, pink or UI orange
    if (g > 150 && r < 120 && b < 170 && g - Math.max(r, b) > 60) green++;
    if (r > 150 && g < 110 && b < 110) red++;
  }
  return { green, red };
}

// SIZE=WxH (default 1280x800); HEADED=1 opens a normal browser window (e.g. under xvfb-run)
const [VW, VH] = (process.env.SIZE ?? '1280x800').split('x').map(Number);
const browser = await chromium.launch({ headless: !process.env.HEADED, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${VW},${VH + 87}`] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: VW, height: VH } });
const page = await context.newPage();
if (process.env.WIDE_FONT) {
  await page.addInitScript(() => {
    const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
      get() { return d.get.call(this); },
      set(v) { d.set.call(this, String(v).replace('system-ui', '"DejaVu Sans"')); },
    });
  });
}
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const state = () =>
  page.evaluate(() => {
    const p = window.__palmful;
    if (!p) return null;
    const c = p.catch;
    return {
      tracked: p.tracked, phase: p.phase, hint: p.hint, coach: p.coach, cup: p.cup, mode: p.mode, size: p.handSize(),
      palm: { ...p.palmCenter },
      seed: c ? { state: c.seed, kind: c.kind, caught: { ...c.caught }, x: c.pos.x, y: c.pos.y, z: c.pos.z, catches: c.catches, misses: c.misses, round: c.round } : null,
      m: { ...p.metrics },
    };
  });
const prog = (s) => `gold ${s.seed.caught.gold ? 1 : 0}/1 blue ${s.seed.caught.blue ? 1 : 0}/1 pink ${s.seed.caught.pink ? 1 : 0}/1`;
const fmt = (s) => (s?.seed ? `${s.seed.kind}:${s.seed.state} [${prog(s)}] missed=${s.seed.misses} phase=${s.phase} coach=${s.coach} hint="${s.hint}"` : JSON.stringify(s));
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

/** Move the hand (2 cm per key press) until the palm is under the seed. */
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
/** Catch the current seed: move under it, let it land, cup, open again. */
async function catchCurrent(label) {
  const before = await waitFor(`${label}: seed falling`, (s) => s.seed.state === 'falling', 30);
  await moveUnderSeed();
  await waitFor(`${label}: lands in the open palm`, (s) => s.seed.state === 'resting', 30);
  await press('C');
  const after = await waitFor(`${label}: cup catches it`, (s) => s.seed.caught[before.seed.kind] && s.seed.catches === before.seed.catches + 1, 15);
  return after;
}
const clickSize = async (z) => {
  await page.click(`.laptop-size[data-size="${z}"]`);
  await page.waitForTimeout(250);
};

let ok = false;
try {
  await page.goto(base + '?emulate=1&catch=1');
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.click('#laptop-start');
  // Start finishes when the emulator has accepted the session and placed the headset
  await page.waitForFunction(() => document.querySelector('#laptop-start')?.style.display === 'none', null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await waitFor('opening: gold seed waits, progress display shows 0/1 x3, asks for a palm', (s) =>
    s.mode === 'catch' && s.phase === 'await' && s.seed?.state === 'waiting' && s.seed.kind === 'gold' && s.seed.catches === 0 && /Hold out your hand/.test(s.hint) && s.coach === 'c-raise' && /catch 3 seeds/.test(s.hint), 60);
  const pts0 = await page.evaluate(() => window.__palmful.screenPoints());
  check('progress display and seed are on screen at the opening', !!pts0.hud && !!pts0.seed, JSON.stringify({ hud: pts0.hud, seed: pts0.seed }));
  check('status says the hand is lowered', /HAND HIDDEN/.test(await page.textContent('#laptop-status')));
  await page.screenshot({ path: `${shots}/v2-1-opening.png` });

  // Keys 1/2/3 choose an uncaught seed (testing aid)
  await press('2');
  await waitFor('key 2 selects the blue seed', (s) => s.seed.kind === 'blue' && s.seed.state === 'waiting', 5);
  await press('3');
  await waitFor('key 3 selects the pink seed', (s) => s.seed.kind === 'pink', 5);
  await press('1');
  await waitFor('key 1 selects gold again', (s) => s.seed.kind === 'gold', 5);

  // Gold: no catch without a cup, then catch
  await press(' ');
  await waitFor('gold: palm offered, seed falls', (s) => s.seed.state === 'falling', 30);
  await waitFor('coach step 1: "Move your open palm under the seed"', (s) => s.coach === 'c-under' && s.seed.state === 'falling', 5);
  // record every coach change with the seed state at that frame
  await page.evaluate(() => {
    const seq = (window.__coachSeq = []);
    const tick = () => {
      const p = window.__palmful;
      const last = seq[seq.length - 1];
      if (!last || last.id !== p.coach) seq.push({ id: p.coach, seed: p.catch.seed, ring: p.catch.seed === 'falling' });
      if (seq.length < 50) requestAnimationFrame(tick);
    };
    tick();
  });
  await page.screenshot({ path: `${shots}/v2-coach-1-under.png` });
  await press('s', 4); // hold the hand 8 cm lower, so the seed visibly falls onto the open palm
  await moveUnderSeed();
  await waitFor('gold: lands in the open palm', (s) => s.seed.state === 'resting', 30);
  await waitFor('coach step 3 only after it lands: "Now gently cup your hand"', (s) => s.coach === 'c-cup' && s.seed.state === 'resting', 3);
  await page.screenshot({ path: `${shots}/v2-coach-3-cup.png` });
  const seq = await page.evaluate(() => window.__coachSeq);
  const ids = seq.map((e) => e.id).join(' > ');
  const iLand = seq.findIndex((e) => e.id === 'c-land');
  const iCup = seq.findIndex((e) => e.id === 'c-cup');
  check('coach steps in order: under > land (while falling, palm under) > cup (only once resting)',
    ids.startsWith('c-under > c-land') && iLand >= 0 && seq[iLand].seed === 'falling' && iCup > iLand && seq[iCup].seed === 'resting' && !seq.slice(0, iCup).some((e) => e.id === 'c-cup'), ids);
  await page.waitForTimeout(2500);
  await waitFor('no false catch: open palm holds it 2.5 s without catching', (s) => s.seed.state === 'resting' && s.seed.catches === 0, 5);

  // Hand display size: positions must not move when the size changes
  const sizes = {};
  for (const z of ['S', 'M', 'L']) {
    await clickSize(z);
    const st = await state();
    sizes[z] = { size: st.size, pts: await page.evaluate(() => window.__palmful.screenPoints()) };
  }
  check('Small / Medium / Large all apply', sizes.S.size === 'S' && sizes.M.size === 'M' && sizes.L.size === 'L');
  let maxShift = 0;
  for (const name of ['joint', 'seed', 'ring']) {
    const a = sizes.S.pts[name] ?? [], b = sizes.L.pts[name] ?? [];
    a.forEach(([x, y], i) => { if (b[i]) maxShift = Math.max(maxShift, Math.hypot((x - b[i][0]) * VW, (y - b[i][1]) * VH)); });
  }
  check('hand joints, seed and ring stay aligned across sizes (max shift < 2 px)', maxShift < 2, `max shift ${maxShift.toFixed(2)} px`);
  await page.screenshot({ path: `${shots}/v2-size-L.png` });
  await clickSize('S');
  await page.screenshot({ path: `${shots}/v2-size-S.png` });
  await clickSize('L');
  check('the size buttons do not steal keyboard focus', (await page.evaluate(() => document.activeElement?.tagName)) !== 'BUTTON');

  // Headless screenshots take ~3 s, longer than the 1.5 s cue, so the test
  // freezes the game at the cue (laptop-only test aid) while it captures.
  await page.evaluate(() => window.__palmful.holdCue(true));
  await press('C');
  const g = await waitFor('gold caught: progress gold 1/1', (s) => s.seed.caught.gold && s.seed.catches === 1, 15);
  check('the coach names the goal after the first catch: "1 of 3 caught"', g.coach === 'c-goal1' && /1 of 3 caught/.test(g.hint), g.hint);
  await page.waitForFunction(() => window.__palmful.holdCue(true) === 'frozen' || false, null, { timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: `${shots}/v2-catch-cue.png` });
  await page.evaluate(() => window.__palmful.holdCue(false));
  const cueCatch = cuePixels(`${shots}/v2-catch-cue.png`);
  check('catch cue visible (green, no red)', cueCatch.green > 200 && cueCatch.red === 0, JSON.stringify(cueCatch));
  await press('C');
  await waitFor('next seed is blue', (s) => s.seed.kind === 'blue', 15);
  await page.screenshot({ path: `${shots}/v2-2-progress-1.png` });

  // Blue: a deliberate miss returns blue and keeps gold
  await waitFor('blue falling', (s) => s.seed.state === 'falling', 30);
  await page.evaluate(() => window.__palmful.holdCue(true));
  const missed = await waitFor('hand left where it was: blue is missed', (s) => s.seed.state === 'missed', 30);
  await page.waitForFunction(() => window.__palmful.holdCue(true) === 'frozen' || false, null, { timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: `${shots}/v2-miss-cue.png` });
  await page.evaluate(() => window.__palmful.holdCue(false));
  const cueMiss = cuePixels(`${shots}/v2-miss-cue.png`);
  check('miss cue visible (red, no green)', cueMiss.red > 200 && cueMiss.green === 0, JSON.stringify(cueMiss));
  check('miss keeps earlier catches', missed.seed.caught.gold && missed.seed.misses === 1);
  await waitFor('the SAME blue seed comes back; gold still caught', (s) => s.seed.kind === 'blue' && s.seed.round > missed.seed.round && s.seed.caught.gold, 30);

  // Tracking loss mid-fall pauses the seed
  await waitFor('blue falling again', (s) => s.seed.state === 'falling', 30);
  await press('H');
  const lost = await waitFor('hand lowered: tracking lost', (s) => !s.tracked, 10);
  await page.waitForTimeout(2500);
  const still = await state();
  check('seed paused 2.5 s while the hand was lost; no miss; hint shown',
    Math.abs(still.seed.y - lost.seed.y) < 0.002 && still.seed.state === 'falling' && still.seed.misses === 1 && /Bring your hand back/.test(still.hint),
    fmt(still));
  await press('H');
  await waitFor('hand back', (s) => s.tracked, 10);
  await moveUnderSeed();
  await waitFor('blue lands', (s) => s.seed.state === 'resting', 30);
  await press('C');
  await waitFor('blue caught: progress gold 1/1 blue 1/1', (s) => s.seed.caught.blue && s.seed.catches === 2, 15);
  await press('C');
  await waitFor('next seed is pink', (s) => s.seed.kind === 'pink' && s.seed.state !== 'caught', 15);
  await page.screenshot({ path: `${shots}/v2-3-progress-2.png` });
  await press('1');
  await waitFor('key 1 refuses gold (already caught); pink stays', (s) => s.seed.kind === 'pink', 3);
  check('status explains the refusal', /already caught/.test(await page.textContent('#laptop-status')));

  // Pink completes the set
  await catchCurrent('pink');
  await waitFor('3/3: session complete', (s) => s.phase === 'done' && s.seed.state === 'done' && s.seed.catches === 3, 20);
  await page.waitForTimeout(1500);
  await waitFor('coach at 3/3, hand still cupped: "Open your hand" (step 1 of the restart)', (s) => s.coach === 'c-open', 3);
  const layout = await page.evaluate(() => window.__palmful.layout());
  check('completion card is shown and clear of the hand and flowers', layout.panelVisible && layout.overlaps === 0, JSON.stringify(layout));
  await page.screenshot({ path: `${shots}/v2-4-complete.png` });
  const fits = (t) => t && t.widths.every((w) => w <= t.maxW);
  const card1 = await page.evaluate(() => window.__palmful.cardText);
  check('completion card: every line fits inside the card', fits(card1), JSON.stringify(card1));

  // The catching cup must not flow straight into a replay: going from the
  // cup directly to a fist (without opening) does nothing...
  const before = await state();
  await press('F'); // cupped -> fist, never opened
  await page.waitForTimeout(2500);
  const held = await state();
  const armed = await page.evaluate(() => window.__palmful.restartArmed());
  check('after 3/3, closing from the cup into a fist does NOT restart (hand never opened)',
    held.phase === 'done' && held.m.restarts === before.m.restarts && !armed, `restarts ${held.m.restarts}, armed ${armed}`);
  // ...open the hand (arms the replay), then a held fist restarts
  await press('F'); // fist off -> open hand
  await page.waitForFunction(() => window.__palmful.restartArmed(), null, { timeout: 5000 });
  log('OK  ', 'opening the hand arms the replay');
  await waitFor('coach then shows step 2: "Now make a fist"', (s) => s.coach === 'c-fist', 3);
  await page.waitForTimeout(300);
  const card2 = await page.evaluate(() => window.__palmful.cardText);
  check('completion card after opening: every line fits inside the card', fits(card2) && /^make a fist/.test(card2.lines[1]), JSON.stringify(card2));
  await page.screenshot({ path: `${shots}/v2-4b-complete-open.png` });
  await press('F');
  await waitFor('fist restart: all counts reset, gold first', (s) => s.m.restarts >= 1 && s.seed.catches === 0 && s.seed.misses === 0 && !s.seed.caught.gold && !s.seed.caught.blue && !s.seed.caught.pink && s.seed.kind === 'gold' && s.phase === 'play', 20);
  await press('F');
  await waitFor('hand opened: the gold seed falls again', (s) => s.seed.state === 'falling', 15);
  await moveUnderSeed();
  await waitFor('second session: no step-by-step lesson (no card while the open palm waits under the seed)', (s) => s.seed.state === 'falling' && s.coach === '', 10);

  // Saved display size survives a reload
  await page.reload();
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForTimeout(2000);
  const pressed = await page.getAttribute('.laptop-size[data-size="L"]', 'aria-pressed');
  const savedSize = await page.evaluate(() => window.__palmful?.handSize());
  check('hand display size saved locally: Large after reload', pressed === 'true' && savedSize === 'L', `button=${pressed} system=${savedSize}`);
  check('no page errors', errors.length === 0, errors.join(' | '));
  ok = true;
} catch (e) {
  log(String(e));
  await page.screenshot({ path: `${shots}/v2-failure.png` }).catch(() => {});
} finally {
  await browser.close();
  process.exit(ok ? 0 : 1);
}
