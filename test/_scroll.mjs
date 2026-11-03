import { chromium } from 'playwright';
const b = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1900, height: 893 } });
await p.goto('https://localhost:4173/?emulate=1' + (process.argv[2] ?? '')); await p.waitForSelector('#laptop-start'); await p.waitForTimeout(2500);
const m = () => p.evaluate(() => JSON.stringify({ panelLeft: document.querySelector('#laptop-panel').getBoundingClientRect().left, scrollX, scrollY, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
console.log('before start', await m());
await p.click('#laptop-start'); await p.waitForFunction(() => document.querySelector('#laptop-start')?.style.display === 'none');
console.log('after start', await m());
for (const k of [' ', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'f', 'f']) { await p.keyboard.press(k); await p.waitForTimeout(150); }
console.log('after keys', await m());
await p.screenshot({ path: process.argv[3] });
await b.close();
