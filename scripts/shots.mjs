// End-to-end check: headless Chromium at iPhone landscape size plays each level with ?bot=1 (the solver's trace
// replayed inside the real game) and must reach 100%. Saves screenshots to shots/run/<level>/ (git-ignored).
// Usage: node scripts/shots.mjs [gym|church|party …]   (default: all three)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = 'shots/run';
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ['gym', 'church', 'party'];
const AT = [8, 22, 32, 41, 52, 62, 72, 82, 89, 96]; // % of the level
// Generous timeouts: software WebGL at 3× on a busy machine renders slowly (the run slows, never stalls).
const WAIT = 90000, RUN_MS = 600000;
let OUT = ROOT;

fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
const server = await createServer({ server: { port: 5199, strictPort: false, hmr: false, watch: null }, logLevel: 'warn' }); // no reloads mid-run when other files change
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const errors = [];

// Landscape pages wait for `waitState`: ?bot=1 / ?level= start straight into 'run', a plain URL opens the 'menu'.
async function open(query, waitState, viewport = { width: 844, height: 390 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(WAIT);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + query);
  if (waitState) await page.waitForSelector(`body[data-state="${waitState}"]`, { state: 'attached', timeout: WAIT });
  return page;
}
const state = (page) => page.evaluate(() => document.body.dataset.state);
const pct = (page) => page.evaluate(() => parseInt(document.querySelector('.pct').textContent, 10));
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

try {
  for (const id of IDS) {
    OUT = `${ROOT}/${id}`;
    fs.mkdirSync(OUT, { recursive: true });
    // 1. Bot run, start to finish.
    const page = await open(`?level=${id}&bot=1`, 'run');
    await shot(page, '00-start');
    let next = 0;
    const t0 = Date.now();
    for (;;) {
      const s = await state(page);
      if (s === 'won' || s === 'over') break;
      if (Date.now() - t0 > RUN_MS) throw new Error(`${id}: bot run timed out`);
      const p = await pct(page);
      if (next < AT.length && p >= AT[next]) await shot(page, `${String(++next).padStart(2, '0')}-${p}pct`);
      await page.waitForTimeout(50);
    }
    await shot(page, '99-end');
    const end = await state(page);
    console.log(`${id} bot run: ${end} at ${await pct(page)}% in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (end !== 'won') throw new Error(`bot did not finish ${id}`);
    await page.context().close();

    // 2. Death: no input, Rafa runs into the first hazard.
    const dead = await open(`?level=${id}`, 'run');
    await dead.waitForSelector('body[data-state="over"]', { state: 'attached', timeout: WAIT });
    await shot(dead, 'death');
    await dead.context().close();
  }
  OUT = ROOT;

  // 3. Hitbox overlay around level 1's first big jumps.
  const dbg = await open('?bot=1&debug=1&t=28', 'run');
  await dbg.waitForTimeout(1100);
  await shot(dbg, 'debug');

  // 4. Portrait phone: the rotate overlay.
  const tall = await open('', null, { width: 390, height: 844 });
  await tall.getByText('Vire o celular').waitFor({ timeout: WAIT });
  await shot(tall, 'portrait');
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  console.error('page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`screenshots in ${OUT}/`);
