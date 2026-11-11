// Every UI screen at iPhone landscape sizes (844×390 @3x and SE 667×375 @2x), a notch variant, and the rotate prompt
// in portrait. Uses the dev-only ?screen= hook in src/main.ts. Output: shots/ui/ (git-ignored).
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const OUT = 'shots/ui';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 5185, strictPort: true }, logLevel: 'warn' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const errors = [];
const missing = new Set();

// name, query, state to wait for, optional extra selector, settle ms
const SCREENS = [
  ['menu', '?screen=menu', 'menu'],
  ['fases', '?screen=fases', 'fases'],
  ['ajustes', '?screen=ajustes', 'ajustes'],
  ['hud', '?bot=1&t=40', 'run', null, 1800],
  ['hud-overdrive', '?bot=1&t=70', 'run', '.hud.od', 1500],
  ['pausa', '?screen=pause', 'paused'],
  ['gameover', '?screen=over&cause=bench', 'over'],
  ['gameover-gym-fabinho', '?screen=over&cause=medBall', 'over'],
  ['gameover-church', '?screen=over&as=church&cause=flowerGirl', 'over'],
  ['gameover-party-aranha', '?screen=over&as=party&cause=webBlob', 'over'],
  ['vitoria-gym', '?screen=victory', 'won', null, 900], // after the beat: "…e um LCA a menos." + shocked face
  ['vitoria-church', '?screen=victory&as=church', 'won', null, 450],
  ['vitoria-party', '?screen=victory&as=party', 'won', null, 450],
];
const SIZES = [
  { tag: '844', viewport: { width: 844, height: 390 }, dpr: 3 },
  { tag: '667', viewport: { width: 667, height: 375 }, dpr: 2 },
];

async function capture(name, query, viewport, dpr, waitState, sel, settle = 250) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  // Vite answers missing files with index.html (200), so watch for images that fail to decode instead.
  await page.addInitScript(() => addEventListener('error', (e) => e.target.src && (window.__miss ??= []).push(e.target.src), true));
  await page.goto(base + query);
  if (waitState) await page.waitForSelector(`body[data-state="${waitState}"]`, { timeout: 30000 });
  if (sel) await page.waitForSelector(sel, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  for (const src of await page.evaluate(() => window.__miss ?? [])) missing.add(new URL(src).pathname);
  await ctx.close();
}

try {
  for (const { tag, viewport, dpr } of SIZES) {
    for (const [name, query, state, sel, settle] of SCREENS) await capture(`${tag}-${name}`, query, viewport, dpr, state, sel, settle);
  }
  // Simulated notch (iPhone landscape safe-area insets) on the screens with edge-hugging controls.
  for (const [name, query, state, sel, settle] of SCREENS.filter(([n]) => ['menu', 'fases', 'hud', 'gameover'].includes(n))) {
    await capture(`notch-${name}`, query + '&notch=1', SIZES[0].viewport, 3, state, sel, settle);
  }
  await capture('portrait-rotate', '', { width: 390, height: 844 }, 3, null, '.rotate p', 600);
} finally {
  await browser.close();
  await server.close();
}
if (missing.size) console.warn('missing images (shown via fallback or hidden):\n  ' + [...missing].join('\n  '));
if (errors.length) {
  console.error('page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`screenshots in ${OUT}/`);
