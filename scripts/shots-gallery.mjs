// Gallery screenshots: headless Chromium (1400×900 @2x, so one game px = one device px) opens gallery.html with the
// beat clock frozen at several beats and saves the animation canvas, plus one full page with every frame and pivot.
// Output: shots/gallery/ (git-ignored).
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const OUT = 'shots/gallery';
const BEATS = [0, 0.35, 0.75, 1.1, 1.5, 2.5]; // the canvas is big: each shot is slow on a loaded machine

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 5181, strictPort: true }, logLevel: 'warn' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000); // big WebGL canvas; slow when other jobs share the machine
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // Gym Rafa frame by frame (60 fps film strips over world-fixed ground marks).
  for (const film of ['run', 'gelol', 'hop', 'big', 'fabrun', 'both', 'muleta']) {
    await page.goto(`${base}gallery.html?film=${film}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
    await page.waitForTimeout(150);
    await page.locator('#game canvas').screenshot({ path: `${OUT}/${{ fabrun: 'film_fabgym_run', both: 'film_gym_together', muleta: 'film_muleta_walk' }[film] ?? `film_gym_${film}`}.png` });
  }
  for (const beat of BEATS) {
    await page.goto(`${base}gallery.html?beat=${beat}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
    await page.waitForTimeout(150); // a few rendered frames
    await page.locator('#game canvas').screenshot({ path: `${OUT}/beat-${beat.toFixed(2).padStart(5, '0')}.png` });
  }
  await page.waitForSelector('.frames >> nth=1', { timeout: 60000 });
  await page.screenshot({ path: `${OUT}/frames.png`, fullPage: true });
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  console.error('page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`${BEATS.length + 8} screenshots in ${OUT}/`);
