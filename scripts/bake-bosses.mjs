// Bake the code-drawn characters (art-src/bosses/*.mjs: the Aranha, his train, rats, people) → public/art/bosses.png + bosses.json (Phaser JSON-hash atlas,
// stored at 1×, meta.scale 3, per-frame anchor = ground-contact pivot), the Aranha alone → public/art/aranha.png + .json
// (stored at D×, meta.scale 3/D), his menu stills in public/art/ui/, and review sheets in shots/bosses/ (every frame at
// world scale next to wheelchair Rafa's push_0 and a Fabinho-height bar, on a block grid).
import fs from 'node:fs';
import { PNG } from 'pngjs';
import aranha, { D } from '../art-src/bosses/aranha.mjs';
import train, { ROOF, STAGE, WHEELS } from '../art-src/bosses/train.mjs';
import rat from '../art-src/bosses/rat.mjs';
import { church, party } from '../art-src/bosses/people.mjs';
import { glyphs } from '../art-src/bosses/raster.mjs';

const GROUPS = { aranha, train, rat, church, party };
const frames = Object.values(GROUPS).flat();
const names = new Set();
for (const f of frames) {
  if (names.has(f.name) || !f.w || !f.h) throw new Error(`duplicate or empty frame ${f.name}`);
  names.add(f.name);
}

const img = (w, h) => ({ w, h, data: new Uint8Array(w * h * 4) });
const blit = (dst, src, dx, dy, s = 1) => { // s may be fractional (nearest)
  dx = Math.round(dx); dy = Math.round(dy);
  for (let y = 0; y < src.h * s; y++) for (let x = 0; x < src.w * s; x++) {
    const X = dx + x, Y = dy + y;
    if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
    const si = (Math.floor(y / s) * src.w + Math.floor(x / s)) * 4;
    if (src.data[si + 3] < 128) continue;
    dst.data.set(src.data.subarray(si, si + 4), (Y * dst.w + X) * 4);
  }
};
const save = (file, im) => {
  const png = new PNG({ width: im.w, height: im.h });
  png.data = Buffer.from(im.data.buffer, im.data.byteOffset, im.data.length);
  fs.writeFileSync(file, PNG.sync.write(png));
};

// ---- atlases: shelf pack, 2 px gutter so filtered sampling never bleeds. The Aranha (drawn at D× density, smooth
// filtering like the sheet characters) gets his own atlas; meta.scale keeps 1 art px = 3 world px for both. ----
const PAD = 2, AW = 1024;
function pack(list, name, scale) {
  let x = PAD, y = PAD, shelf = 0;
  const placed = [...list].sort((a, b) => b.h - a.h).map((f) => {
    if (x + f.w + PAD > AW) { x = PAD; y += shelf + PAD; shelf = 0; }
    const p = { f, x, y };
    x += f.w + PAD; shelf = Math.max(shelf, f.h);
    return p;
  });
  const atlas = img(AW, y + shelf + PAD);
  const json = { frames: {}, meta: { image: `${name}.png`, format: 'RGBA8888', size: { w: atlas.w, h: atlas.h }, scale,
    source: 'scripts/bake-bosses.mjs' } };
  for (const { f, x, y } of placed) {
    blit(atlas, f, x, y);
    const rect = { x, y, w: f.w, h: f.h };
    json.frames[f.name] = { frame: rect, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h }, anchor: { x: f.ax / f.w, y: f.ay / f.h } };
  }
  return { atlas, json };
}
const write = (name, { atlas, json }) => {
  save(`public/art/${name}.png`, atlas);
  fs.writeFileSync(`public/art/${name}.json`, JSON.stringify(json, null, 1));
  console.log(`${name}: ${Object.keys(json.frames).length} frames, atlas ${atlas.w}×${atlas.h}`);
};
const spider = pack(aranha, 'aranha', 3 / D);
// The dive hazard reuses the tuck, pivoted at its centre so it can spin in place.
spider.json.frames.spiderDive = { ...spider.json.frames.aranha_flip_1, anchor: { x: 0.5, y: 0.5 } };
write('aranha', spider);
const rest = pack(frames.filter((f) => !aranha.includes(f)), 'bosses', 3);
// People hazards are also reachable by their HAZARDS[kind].art name (first frame of the cycle).
for (const n of ['photographer', 'flowerGirl', 'ringBearer', 'waiter']) rest.json.frames[n] = rest.json.frames[`${n}_0`];
write('bosses', rest);

// ---- DOM stills: the frames 1:1 (smooth-scaled in CSS like the sheet stills) ----
fs.mkdirSync('public/art/ui', { recursive: true });
for (const name of ['aranha_pose1', 'aranha_pose2']) save(`public/art/ui/${name}.png`, aranha.find((q) => q.name === name));

// ---- review sheets ----

const px = (im, X, Y, c) => { if (X >= 0 && Y >= 0 && X < im.w && Y < im.h) im.data.set(c, (Y * im.w + X) * 4); };
const rectF = (im, X, Y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(im, X + i, Y + j, c); };
const text = (im, X, Y, s, c, k = 2) => glyphs(s.toUpperCase(), 0, 0, (x, y) => rectF(im, X + x * k, Y + y * k, k, k, c));
const BG = [74, 73, 86, 255], GRID = [92, 91, 106, 255], GROUND = [40, 38, 48, 255], PIV = [255, 64, 200, 255];
const INK = [228, 227, 234, 255], FAB = [196, 40, 58, 255];
const BLOCK = 96, S = 3;

const rafaPng = PNG.sync.read(fs.readFileSync('public/art/rafa.png'));
const rj = JSON.parse(fs.readFileSync('public/art/rafa.json', 'utf8')).frames.push_0;
const rafa = img(rj.frame.w, rj.frame.h);
for (let j = 0; j < rafa.h; j++) for (let i = 0; i < rafa.w; i++) {
  const si = ((rj.frame.y + j) * rafaPng.width + rj.frame.x + i) * 4;
  rafa.data.set(rafaPng.data.subarray(si, si + 4), (j * rafa.w + i) * 4);
}
const rafaAy = Math.round(rj.anchor.y * rafa.h);

// Level backdrops behind a cell, ground line at gy (review only, approximate colours): warm stone + red carpet for
// the church, dark hall + lit chequered floor for the party.
const THEME = { aranha: 'party', train: 'party', church: 'church', party: 'party' };
function backdrop(im, theme, X, Y0, w, gy, Y1) {
  for (let y = Y0; y < Y1; y++) for (let x = X; x < X + w; x++) {
    let c;
    if (theme === 'church') {
      if (y < gy) { const row = Math.floor((gy - y) / 24), mortar = (gy - y) % 24 === 0 || (x + (row % 2) * 24) % 48 === 0; c = mortar ? [196, 178, 146] : [222, 206, 172]; }
      else c = y < gy + 4 ? [201, 162, 74] : [142, 36, 48];
    } else if (y < gy) c = x % 64 < 2 ? [40, 34, 62] : [28, 24, 46];
    else { const lit = (Math.floor(x / 48) + Math.floor((y - gy) / 24)) % 2; c = lit ? [184, 150, 236] : [58, 47, 94]; }
    px(im, x, y, [...c, 255]);
  }
}

function sheet(list, file, s = S, withRefs = true, theme) {
  const cells = list.map((f) => {
    const k = s / (f.d ?? 1), fw = Math.ceil(f.w * k), refW = withRefs ? 16 + 10 + rafa.w + 14 : 0;
    const above = Math.round(Math.max(f.ay * k, withRefs ? 2.5 * BLOCK : 0)), below = Math.ceil(Math.max(theme ? 36 : 0, (f.h - f.ay) * k));
    return { f, k, w: refW + fw + 40, h: 24 + above + below + 16, above, refW };
  });
  const W = 1900, rows = [];
  let row = [], rw = 0;
  for (const c of cells) { if (rw + c.w > W && row.length) { rows.push(row); row = []; rw = 0; } row.push(c); rw += c.w; }
  rows.push(row);
  const H = rows.reduce((a, r) => a + Math.max(...r.map((c) => c.h)), 0);
  const im = img(W, H);
  rectF(im, 0, 0, W, H, BG);
  let Y = 0;
  for (const r of rows) {
    const rh = Math.max(...r.map((c) => c.h));
    let X = 0;
    for (const c of r) {
      const gy = Y + 24 + c.above, f = c.f, fx = X + c.refW + 20, pxX = Math.round(fx + f.ax * c.k);
      if (theme) backdrop(im, theme, X, Y + 20, c.w - 6, gy, Y + rh - 4);
      for (let g = gy; g > Y + 20; g -= BLOCK) rectF(im, X, g, c.w - 6, 1, GRID); // 1-block grid from the ground up
      for (let g = pxX % BLOCK; g < c.w; g += BLOCK) if (X + g >= X && X + g < X + c.w - 6) rectF(im, X + g, Y + 20, 1, rh - 24, GRID);
      rectF(im, X, gy, c.w - 6, 2, GROUND);
      if (c.refW) {
        rectF(im, X + 4, gy - 2.5 * BLOCK, 16, 2.5 * BLOCK, FAB); // Fabinho standing height
        blit(im, rafa, X + 30, gy - rafaAy);
      }
      blit(im, f, fx, gy - f.ay * c.k, c.k);
      rectF(im, pxX - 4, gy, 9, 1, PIV); rectF(im, pxX, gy - 4, 1, 9, PIV);
      text(im, X + 4, Y + 4, `${f.name} ${f.w}×${f.h}`, INK);
      X += c.w;
    }
    Y += rh;
  }
  save(file, im);
}

// Assembled train (all overlays at the body's origin, wheels at WHEELS) with pose 1 on the roof: checks the offsets.
const get = (n) => frames.find((f) => f.name === n);
const compose = (name, parts) => {
  const im = img(240, 210), ox = 120, oy = 200;
  for (const [f, x, y] of parts) blit(im, f, ox + x - f.ax / (f.d ?? 1), oy + y - f.ay / (f.d ?? 1), 1 / (f.d ?? 1));
  return { name, ...im, ax: ox, ay: oy };
};
const trainPreview = compose('preview_train', [[get('train_body'), 0, 0], [get('train_speaker_1'), 0, 0], [get('train_bulbs_0'), 0, 0],
  ...WHEELS.map(([x, y]) => [get('train_wheel'), x, y]), [get('aranha_pose1'), (STAGE[0] + STAGE[1]) / 2, ROOF]]);

fs.mkdirSync('shots/bosses', { recursive: true });
const only = process.argv[2]; // optional: bake sheets for one group while iterating
const extra = { train: [trainPreview] };
for (const [g, list] of Object.entries(GROUPS)) if (list.length && (!only || only === g)) sheet([...list, ...(extra[g] ?? [])], `shots/bosses/${g}.png`, S, true, THEME[g]);
const sig = ['aranha_pose1', 'aranha_pose1_b', 'aranha_pose2', 'aranha_pose2_b'].map((n) => frames.find((f) => f.name === n));
sheet(sig, 'shots/bosses/aranha-signature-x8.png', 8, false, 'party');
