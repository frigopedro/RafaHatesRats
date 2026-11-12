// Every UI screen at iPhone landscape sizes (844×390 @3x and SE 667×375 @2x), a notch variant, and the rotate prompt
// in portrait. Uses the dev-only ?screen= hook in src/main.ts, on the dev server at :5190 when it is running (else its
// own). Output: shots/ui/ (git-ignored).
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const OUT = 'shots/ui';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const DEV = 'http://localhost:5190/';
const server = (await fetch(DEV).then((r) => r.ok, () => false)) ? null
  : await createServer({ server: { port: 5185, strictPort: true, hmr: false, watch: null }, logLevel: 'warn' }); // no reloads mid-run
await server?.listen();
const base = server ? server.resolvedUrls.local[0] : DEV;
const browser = await chromium.launch();
const errors = [];
const missing = new Set();

// name, query, state to wait for, optional extra selector, settle ms
const SCREENS = [
  ['menu', '?screen=menu', 'menu'],
  ['fases', '?screen=fases', 'fases'],
  ['ajustes', '?screen=ajustes', 'ajustes'],
  ['hud', '?bot=1&t=40', 'run', null, 1800], // the bot plays Difícil: no hearts
  ['hud-hearts', '?screen=hud', 'run', null, 700], // Fácil: hearts and checkpoint ticks
  ['hud-hard', '?screen=hud&hard=1', 'run', null, 700],
  ['hud-overdrive', '?screen=hud&od=8.4', 'run', '.t-gelol', 200], // frozen run, timers set by the dev hook
  ['hud-overdrive-last', '?screen=hud&od=2.4', 'run', '.t-gelol.warn', 200], // last 3 beats: red
  ['hud-pre', '?screen=hud&pre=5.4', 'run', '.t-pre', 200],
  ['hud-both', '?screen=hud&od=6.5&pre=1.4', 'run', '.t-pre.warn', 200], // pré in its last 2 beats
  ['pausa', '?screen=pause', 'paused'],
  ['gameover', '?screen=over&cause=bench', 'over'],
  ['gameover-gym-fabinho', '?screen=over&cause=medBall', 'over'],
  ['gameover-church', '?screen=over&level=church&cause=flowerGirl', 'over'],
  ['gameover-church-giovanni', '?screen=over&level=church&cause=pewEnd', 'over', null, 250, false, 'Giovanni'], // reload until that line
  ['hud-church', '?screen=hud&level=church&od=5.4', 'run', '.t-gelol', 200],
  ['pausa-church', '?screen=pause&level=church', 'paused'],
  ['gameover-party-aranha', '?screen=over&level=party&cause=webBlob', 'over'],
  ['vitoria-gym-before', '?screen=victory', 'won', null, 120, true], // "1º LUGAR!" with arms-up gym Rafa (animations rewound)
  ['vitoria-gym', '?screen=victory', 'won', null, 900], // after the beat: "…e um LCA a menos." + knee-hugging Rafa
  ['vitoria-church', '?screen=victory&level=church', 'won', null, 450],
  ['vitoria-party', '?screen=victory&level=party', 'won', null, 450],
  ['vitoria-hard', '?screen=victory&level=party&hard=1', 'won', null, 450],
  ['gameover-continue', '?level=gym&t=86', 'over', '.btn.cont', 400], // a real Fácil run, no input: three hits after the checkpoint at 88
];
const SIZES = [
  { tag: '844', viewport: { width: 844, height: 390 }, dpr: 3 },
  { tag: '667', viewport: { width: 667, height: 375 }, dpr: 2 },
];

// Saved progress for the title/Fases variants (src/save.ts format), and a stand-in for iPhone Safari (no Fullscreen API).
const save = (...done) => ({ levels: Object.fromEntries(['gym', 'church', 'party'].map((id, i) =>
  [id, i < done.length ? { best: 100, coins: done[i], attempts: 4 + i * 3, done: true } : { best: i === done.length ? 46 : 0, coins: 0, attempts: i === done.length ? 3 : 0, done: false }])) });
const withSave = (s) => [(v) => localStorage.setItem('rhr.save.v1', v), JSON.stringify(s)];
const IPHONE = [() => Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false })];
const EXTRA = [ // name, query, state, init script
  ['menu-gymdone', '?screen=menu', 'menu', withSave(save(31))],
  ['fases-gymdone', '?screen=fases', 'fases', withSave(save(31))],
  ['menu-party', '?screen=menu', 'menu', withSave(save(48, 40))],
  ['menu-hard', '?screen=menu', 'menu', withSave({ ...save(31), settings: { hard: true } })],
  ['fases-hard', '?screen=fases', 'fases', withSave((({ levels }) => ({ levels: { ...levels, gym: { ...levels.gym, hard: true } } }))(save(31, 40)))],
  ['menu-iphone', '?screen=menu', 'menu', IPHONE],
  ['ajustes-iphone', '?screen=ajustes', 'ajustes', IPHONE],
];

async function capture(name, query, viewport, dpr, waitState, sel, settle = 250, rewind = false, untilText = '', init = null) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(...init);
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  // Vite answers missing files with index.html (200), so watch for images that fail to decode instead.
  await page.addInitScript(() => addEventListener('error', (e) => e.target.src && (window.__miss ??= []).push(e.target.src), true));
  for (let i = 0; i < 30; i++) { // the joke is random: reload until it is the one this shot is about
    await page.goto(base + query, { timeout: 120000 });
    if (waitState) await page.waitForSelector(`body[data-state="${waitState}"]`, { timeout: 120000 });
    if (!untilText || (await page.textContent('.layer')).includes(untilText)) break;
  }
  if (sel) await page.waitForSelector(sel, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
  if (rewind) await page.evaluate(() => document.getAnimations().forEach((a) => (a.pause(), (a.currentTime = 0)))); // show the state before the beat
  await page.screenshot({ path: `${OUT}/${name}.png` });
  for (const src of await page.evaluate(() => window.__miss ?? [])) missing.add(new URL(src).pathname);
  await ctx.close();
}

try {
  for (const { tag, viewport, dpr } of SIZES) {
    for (const [name, query, state, sel, settle, rewind, until] of SCREENS) await capture(`${tag}-${name}`, query, viewport, dpr, state, sel, settle, rewind, until);
    for (const [name, query, state, init] of EXTRA) await capture(`${tag}-${name}`, query, viewport, dpr, state, null, 250, false, '', init);
  }
  // Simulated notch (iPhone landscape safe-area insets) on the screens with edge-hugging controls.
  for (const [name, query, state, sel, settle] of SCREENS.filter(([n]) => ['menu', 'fases', 'hud-overdrive', 'gameover'].includes(n))) {
    await capture(`notch-${name}`, query + '&notch=1', SIZES[0].viewport, 3, state, sel, settle);
  }
  await capture('notch-menu-gymdone', '?screen=menu&notch=1', SIZES[0].viewport, 3, 'menu', null, 250, false, '', withSave(save(31)));
  await capture('portrait-rotate', '', { width: 390, height: 844 }, 3, null, '.rotate p', 600);
} finally {
  await browser.close();
  await server?.close();
}
if (missing.size) console.warn('missing images (shown via fallback or hidden):\n  ' + [...missing].join('\n  '));
if (errors.length) {
  console.error('page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`screenshots in ${OUT}/`);
