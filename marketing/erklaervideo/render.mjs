import { createRequire } from 'module';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const [mode] = process.argv.slice(2);
const FPS = 30, DUR = 15;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + process.cwd() + '/index.html');
await page.evaluate(() => document.fonts.ready);
fs.mkdirSync('frames', { recursive: true });
const times = mode === 'test' ? [1.2, 4.8, 7.9, 10.9, 12.8, 14.8] : [...Array(FPS * DUR).keys()].map(i => i / FPS);
for (const [i, t] of times.entries()) {
  await page.evaluate(t => window.seek(t), t);
  await page.screenshot({ path: mode === 'test' ? `test_${t}.png` : `frames/f${String(i).padStart(4, '0')}.png` });
}
await browser.close();
