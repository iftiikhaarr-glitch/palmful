// Opens the production build in a browser WITHOUT WebXR (plain headless
// Chromium) and checks that the landing page explains where to play and links
// to the laptop demo, rather than showing a blank page.
// Usage: node test/landing-e2e.mjs https://localhost:4173/ [screenshotDir]
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'https://localhost:4173/';
const shots = process.argv[3] ?? '.';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 640 } });
let ok = false;
try {
  await page.goto(base);
  await page.waitForSelector('#landing #laptop-link', { timeout: 60000 });
  const text = await page.textContent('#landing');
  const href = await page.getAttribute('#laptop-link', 'href');
  if (!/Meta Quest 3 \/ 3S Browser/.test(text) || !href.includes('emulate=1')) throw new Error('landing content wrong: ' + text + ' ' + href);
  await page.screenshot({ path: `${shots}/landing-desktop.png` });
  await page.waitForFunction(() => window.__palmful !== undefined, null, { timeout: 30000 });
  if (await page.evaluate(() => window.__palmful.hasBackdrop)) throw new Error('backdrop present without ?emulate');
  console.log('OK   without ?emulate there is no backdrop in the scene (real AR stays see-through)');
  await page.click('#laptop-link');
  await page.waitForSelector('#laptop-start', { timeout: 60000 });
  await page.waitForFunction(() => window.__palmful !== undefined, null, { timeout: 30000 });
  if (!(await page.evaluate(() => window.__palmful.hasBackdrop))) throw new Error('laptop mode is missing its backdrop');
  console.log('OK   with ?emulate the dark backdrop is in the scene');
  console.log('OK   landing explains Quest Browser and links to laptop demo; link opens laptop mode');
  ok = true;
} catch (e) {
  console.log('FAIL', String(e));
} finally {
  await browser.close();
  process.exit(ok ? 0 : 1);
}
