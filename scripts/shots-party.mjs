// Level 3 look check: the bot plays "A Festa" in headless Chromium (844×390 @3x) and the scene is paused at chosen
// beats for screenshots (?debug=1 exposes the scene; its hitbox overlay is hidden unless SHOW_HITBOXES=1). Then a death,
// and the boss at 4:3 and on a small phone. Saves to shots/party/.
// Usage: [T=<start beat>] [EXTRAS_ONLY=1] node scripts/shots-party.mjs [beat …]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const OUT = 'shots/party';
const AT = process.argv.slice(2).length ? process.argv.slice(2).map((b) => [Number(b), `b${b}`]) : [
  [10, 'warmup'], [20.6, 'first-big'], [32.8, 'spark-off'], [35.8, 'spark-on'], [43.6, 'balloons'], [46.2, 'waiter'],
  [57.7, 'spark-row'], [71.6, 'pre'], [93.6, 'gelol'], [104.8, 'gelol-2'], [111.6, 'train-enters'], [112.25, 'train-crash'],
  [117.1, 'pose1-b'], [117.6, 'pose1'], [120.3, 'blob-windup'], [121.5, 'blob-flight'], [122.4, 'blob-landed'],
  [144.0, 'line-windup'], [145.25, 'line-flight'], [145.8, 'line-pass'], [168.1, 'pose2-b'], [168.6, 'pose2'],
  [169.7, 'dive-takeoff'], [170.2, 'dive-flight'], [170.8, 'dive-jump'], [171.9, 'dive-climb'], [178.3, 'boss3-line'],
  [190.6, 'ram-brake'], [191.05, 'ram-hit'], [191.4, 'defeat-web'], [192.0, 'defeat-speaker'], [192.6, 'train-off'],
  [198, 'finale'], [205, 'finish-approach'],
];

const T = Number(process.env.T ?? 0);
fs.mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 5192, strictPort: true, hmr: false, watch: null }, logLevel: 'warn' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const errors = [];

async function open(query, waitState, viewport = { width: 844, height: 390 }, dpr = 3) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()));
  await page.goto(base + query);
  if (waitState) await page.waitForSelector(`body[data-state="${waitState}"]`, { timeout: 120000 });
  if (query.includes('debug=1')) await page.waitForFunction(() => window.rhrScene);
  if (query.includes('debug=1') && !process.env.SHOW_HITBOXES) await page.evaluate(() => window.rhrScene.dbg.setVisible(false));
  return page;
}
/** Runs until the render beat reaches `beat`, then pauses there; false if the run ended first. */
const pauseAt = (page, beat) => page.evaluate((b) => new Promise((res) => {
  const f = () => {
    const s = window.rhrScene, st = document.body.dataset.state;
    if (st !== 'run') return res(false);
    if (s.renderTick / 120 >= b) return s.setPaused(true), res(true);
    requestAnimationFrame(f);
  };
  f();
}), beat);
const resume = (page) => page.evaluate(() => window.rhrScene.setPaused(false));
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });

try {
  if (!process.env.EXTRAS_ONLY) {
  const page = await open(`?bot=1&level=party&debug=1&t=${T}`, 'run');
  let n = 0;
  for (const [beat, name] of AT) {
    if (beat < T) {
      n++;
      continue;
    }
    if (!(await pauseAt(page, beat))) break;
    await page.waitForTimeout(120);
    await shot(page, `${String(n++).padStart(2, '0')}-${beat}-${name}`);
    await resume(page);
  }
  await page.waitForFunction(() => ['won', 'over'].includes(document.body.dataset.state), null, { timeout: 120000 });
  const end = await page.evaluate(() => document.body.dataset.state);
  await page.waitForTimeout(1500);
  await shot(page, '99-end');
  console.log(`bot run: ${end}`);
  if (end !== 'won') throw new Error('bot did not finish level 3');
  }

  if (process.argv.length <= 2) {
    const dead = await open('?bot=1&level=party&debug=1&t=118', 'run');
    await dead.evaluate(() => (window.rhrScene.o.bot.length = 0)); // the bot lets go: she rolls into the first web blob
    await dead.waitForSelector('body[data-state="over"]', { timeout: 120000 });
    await shot(dead, 'death-over');
    for (const [label, vp, dpr] of [['4x3', { width: 1024, height: 768 }, 1], ['667', { width: 667, height: 375 }, 2]]) {
      const p = await open('?bot=1&level=party&debug=1&t=166', 'run', vp, dpr);
      for (const [beat, name] of [[168.6, 'pose2'], [170.2, 'dive'], [171.9, 'climb'], [178.3, 'line']]) {
        await pauseAt(p, beat);
        await p.waitForTimeout(120);
        await shot(p, `${label}-${name}`);
        await resume(p);
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) console.error('page errors/warnings:\n' + [...new Set(errors)].join('\n'));
console.log(`screenshots in ${OUT}/`);
