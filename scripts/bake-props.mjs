// Props atlas: every hazard, item, platform and effect sprite, drawn in code (art-src/props/*.mjs) at 32 art px per
// block → public/art/props.png + props.json (Phaser JSON-hash, 1×, meta.scale 3, per-frame pivot).
// Also writes review sheets to shots/props/: each frame ×3 on its level's colours, 1-block grid, hitbox, Rafa for scale.
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const GROUPS = ['gym', 'gym-moving', 'spider', 'church', 'party', 'items', 'fx', 'platforms'];
const OUT = 'public/art', SHOTS = 'shots/props', PAD = 2, ATLAS_W = 512, SCALE = 3, BLOCK = 32;

const frames = [];
for (const g of GROUPS) for (const f of (await import(`../art-src/props/${g}.mjs`)).default) frames.push({ ...f, group: g });

// HAZARDS hitboxes, read from the TS source (the contract) so the sheet shows what collides.
const cfg = fs.readFileSync('src/config.ts', 'utf8');
const HIT = Object.fromEntries([...cfg.matchAll(/^\s+(\w+): \{ w: ([\d.]+), h: ([\d.]+),[^}]*art: '(\w+)'/gm)].map((m) => [m[4], { w: +m[2], h: +m[3] }]));
// Kinds from DESIGN §3 not yet in config.ts (config wins once they land there).
const NEW = { medBall: [0.55, 0.55], kneeler: [0.7, 0.4], flowerBasket: [0.6, 0.5], hymnBooks: [0.6, 0.4], rice: [0.6, 0.4],
  pewEnd: [1.0, 1.2], candleStand: [0.6, 1.2], flowerStand: [0.9, 1.2], dove: [0.7, 0.4], lantern: [0.6, 0.8],
  giftBox: [0.6, 0.55], chair: [0.7, 0.5], champagne: [0.35, 0.6], table: [1.4, 1.0], cakeTable: [1.2, 1.2],
  champagneTower: [0.9, 1.2], balloons: [0.8, 0.9], sparkler: [0.6, 1.0] };
for (const [k, [w, h]] of Object.entries(NEW)) HIT[k] ??= { w, h };
// Hazard art this lane owns (DESIGN §3); people, rats and the spider dive live in the bosses atlas.
const EXPECTED = ['dumbbell', 'kettlebell', 'bottle', 'plate', 'ropeWave', 'treadmill', 'bench', 'plateRack', 'barbellRack', 'plyo',
  'bag', 'frisbee', 'shockwave', 'webBlob', 'webLine', ...Object.keys(NEW)];
const ITEM = +cfg.match(/ITEM_SIZE = ([\d.]+)/)[1];
const ITEMS = ['gelol', 'whey', 'pre', 'coin'];

// Checks: unique names, nothing empty, every hazard art key present (rat/spiderDive belong to the bosses atlas).
const names = new Set();
for (const f of frames) {
  if (names.has(f.name)) throw new Error(`duplicate frame ${f.name}`);
  names.add(f.name);
  if (!f.cv.d.some((v, i) => i % 4 === 3 && v)) throw new Error(`empty frame ${f.name}`);
}
// Animated art keeps a bare name too (= frame 0), as an alias of the same rect.
for (const f of [...frames]) {
  const base = f.name.replace(/_0$/, '');
  if (base !== f.name && !names.has(base)) { frames.push({ ...f, name: base, alias: true }); names.add(base); }
}
const missing = EXPECTED.filter((k) => !names.has(k));
if (missing.length) console.warn('missing hazard art:', missing.join(', '));

// Shelf-pack, tallest first.
const order = frames.filter((f) => !f.alias).sort((a, b) => b.cv.h - a.cv.h || b.cv.w - a.cv.w);
let x = PAD, y = PAD, rowH = 0;
for (const f of order) {
  if (x + f.cv.w + PAD > ATLAS_W) { x = PAD; y += rowH + PAD; rowH = 0; }
  f.x = x; f.y = y; x += f.cv.w + PAD; rowH = Math.max(rowH, f.cv.h);
}
const H = y + rowH + PAD;
const png = new PNG({ width: ATLAS_W, height: H });
png.data.fill(0);
for (const f of frames) if (f.alias) ({ x: f.x, y: f.y } = frames.find((g) => !g.alias && g.cv === f.cv));
for (const f of order)
  for (let j = 0; j < f.cv.h; j++) png.data.set(f.cv.d.subarray(j * f.cv.w * 4, (j + 1) * f.cv.w * 4), ((f.y + j) * ATLAS_W + f.x) * 4);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/props.png`, PNG.sync.write(png));

const pivotOf = (f) => ({ b: { x: 0.5, y: 1 }, c: { x: 0.5, y: 0.5 }, tl: { x: 0, y: 0 } })[f.pivot] ?? { x: f.pivot[0] / f.cv.w, y: f.pivot[1] / f.cv.h };
const json = { frames: {}, meta: { image: 'props.png', size: { w: ATLAS_W, h: H }, scale: SCALE, source: 'art-src/props (scripts/bake-props.mjs)' } };
for (const f of frames) {
  const r = { x: f.x, y: f.y, w: f.cv.w, h: f.cv.h };
  json.frames[f.name] = { frame: r, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: r.w, h: r.h }, sourceSize: { w: r.w, h: r.h }, pivot: pivotOf(f) };
}
fs.writeFileSync(`${OUT}/props.json`, JSON.stringify(json, null, 1));
console.log(`props: ${frames.length} frames, ${ATLAS_W}×${H}`);

// ---- Review sheets ----
const rafaJson = JSON.parse(fs.readFileSync(`${OUT}/rafa.json`, 'utf8')).frames.push_0;
const b64 = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const atlasUrl = b64(`${OUT}/props.png`), rafaUrl = b64(`${OUT}/rafa.png`);
const S = SCALE, B = BLOCK * S;

function cell(f) {
  const w = f.cv.w * S, h = f.cv.h * S, pv = pivotOf(f);
  const base = f.name.replace(/(_\d+|_air|_flat)$/, '');
  const hit = HIT[f.name] || HIT[base];
  const box = ITEMS.includes(base) ? { w: ITEM, h: ITEM, c: true } : hit ? { ...hit, c: f.pivot === 'c' } : null;
  const CW = Math.max(w, box ? box.w * B : 0, 2 * B) + 24, CH = Math.max(h, box ? box.h * B : 0) + 2 * B;
  const px = CW / 2, py = f.pivot === 'c' ? CH / 2 : f.pivot === 'tl' ? B : CH - B; // pivot point in the cell
  const ix = px - pv.x * w, iy = py - pv.y * h;
  const hb = box && `<div class="hb" style="left:${px - (box.w * B) / 2}px;top:${box.c ? py - (box.h * B) / 2 : py - box.h * B}px;width:${box.w * B}px;height:${box.h * B}px"></div>`;
  return `<div class="cell" style="width:${CW}px;height:${CH}px;background-position:${px % B}px ${py % B}px">
    <div class="spr" style="left:${ix}px;top:${iy}px;width:${w}px;height:${h}px;background-position:${-f.x * S}px ${-f.y * S}px"></div>
    <div class="floor"></div>${hb || ''}<div class="pv" style="left:${px - 2}px;top:${py - 2}px"></div><span>${f.name} ${f.cv.w}×${f.cv.h}</span></div>`;
}
const crutches = fs.existsSync(`${OUT}/ui/rafakit_crutches.png`) && b64(`${OUT}/ui/rafakit_crutches.png`);
const scale = (img, w, h, ay, label, sx = 0, sy = 0) => `<div class="cell" style="width:${w + 20}px;height:${h + B}px;background-position:0 ${h % B}px">
  <div class="floor"></div><div style="position:absolute;left:10px;top:${h - ay}px;width:${w}px;height:${h}px;background:url(${img}) ${-sx}px ${-sy}px"></div><span>${label}</span></div>`;
const rafa = (g) => {
  const r = rafaJson;
  return scale(rafaUrl, r.frame.w, r.frame.h, r.anchor.y * r.frame.h, 'rafa push_0', r.frame.x, r.frame.y) +
    (g === 'church' && crutches ? scale(crutches, 110, 229, 229, 'crutches') : '');
};
// Each level's backdrop: wall above the ground line, floor strip below (props must read on both).
const BG = {
  church: ['#cfc4b0', 'linear-gradient(#c9a36a 0 3px, #9a1c2c 3px, #6a1420)'],
  party: ['#1a1426', 'repeating-conic-gradient(#5a4a9a 0 25%, #241c3a 0 50%) 0 0/48px 48px'],
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2200, height: 400 } });
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
for (const [i, g] of GROUPS.entries()) {
  const list = frames.filter((f) => f.group === g && !f.alias);
  const rows = [[]];
  let wsum = 0;
  for (const f of list) {
    const w = Math.max(f.cv.w * S, 2 * B) + 40;
    if (wsum + w > 1900 && rows.at(-1).length) { rows.push([]); wsum = 0; }
    rows.at(-1).push(f); wsum += w;
  }
  await page.setContent(`<style>
    body{margin:0;background:#16393d;font:13px monospace;color:#cfe}
    h1{font-size:18px;margin:8px}
    .row{display:flex;align-items:flex-end;gap:6px;margin:6px}
    .floor{position:absolute;left:0;right:0;bottom:0;height:${B}px;background:${BG[g]?.[1] ?? 'transparent'}}
    .cell{position:relative;background-color:${BG[g]?.[0] ?? '#1e4d52'};background-image:linear-gradient(#ffffff14 1px,transparent 1px),linear-gradient(90deg,#ffffff14 1px,transparent 1px);background-size:${B}px ${B}px}
    .spr{position:absolute;background:url(${atlasUrl});background-size:${ATLAS_W * S}px ${H * S}px;image-rendering:pixelated}
    .hb{position:absolute;outline:1px dashed #ff6bd0aa}
    .pv{position:absolute;width:4px;height:4px;background:#ff3}
    span{position:absolute;left:3px;top:2px;white-space:nowrap;background:#000a;padding:0 3px}
  </style><h1>${g}</h1>${rows.map((r) => `<div class="row">${rafa(g)}${r.map(cell).join('')}</div>`).join('')}`);
  await page.screenshot({ path: `${SHOTS}/${i + 1}-${g}.png`, fullPage: true });
}
await browser.close();
console.log(`review sheets → ${SHOTS}/`);
