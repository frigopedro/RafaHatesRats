// Cut art-src/characters/rafa-sheet.png into named sprites → public/art/rafa.png + rafa.json (Phaser JSON-hash atlas).
// Sprites = 8-connected components of alpha >= 200 (specks < 150 px dropped); each crop keeps the original RGBA of the
// component plus a 2 px soft-edge ring, everything else in the crop (background haze, neighbours) is made transparent.
// Also writes shots/slice-contact.png (every crop, in name order) and shots/slice-push.png (anchor/jitter check).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = 'art-src/characters/rafa-sheet.png';
const OUT = 'public/art';
const CHECK = 'shots';
const ALPHA = 200, MIN_PX = 150, RING = 2, PAD = 2;

// [name, expected bbox] in sheet order (row by row, left to right). null = not measured; only the count is checked.
const NAMES = [
  ['turn_front', [53, 24, 166, 282]], ['turn_34', [242, 24, 187, 280]], ['turn_side', [443, 24, 184, 280]],
  ['turn_back34', [641, 24, 175, 279]], ['turn_back', [832, 24, 169, 282]], ['turn_side_l', [1020, 24, 175, 282]],
  ['turn_34_l', [1226, 27, 188, 279]],
  ['pose_idle', [29, 332, 180, 268]], ['pose_wave', [229, 334, 184, 262]], ['pose_phone', [434, 330, 182, 265]],
  ['pose_neutral', [640, 332, 173, 270]], ['pose_armscrossed', [834, 330, 173, 266]], ['pose_armsup', [1024, 326, 161, 274]],
  ['pose_chin', [1196, 355, 158, 247]], ['pose_point', [1363, 337, 168, 263]],
  ['push_0', [29, 620, 131, 182]], ['push_1', [165, 618, 121, 183]], ['push_2', [298, 622, 131, 186]],
  ['push_3', [434, 622, 134, 187]], ['push_4', [572, 632, 139, 177]],
  ['back_0', [750, 624, 100, 182]], ['back_1', [866, 626, 92, 180]], ['back_2', [970, 624, 83, 185]],
  ['side_0', [1133, 632, 104, 186]], ['side_1', [1245, 634, 87, 180]], ['side_2', [1337, 632, 85, 182]],
  ['side_3', [1423, 632, 96, 182]],
  ['face_smile', [36, 829, 128, 175]], ['face_laugh', null], ['face_grin', null], ['face_smile2', null],
  ['face_smile3', null], ['face_shocked', null], ['face_sad', null], ['face_angry', [1032, 833, 129, 175]],
  ['part_chair_side', [1187, 885, 82, 91]], ['part_chair_front', [1279, 878, 65, 88]],
  ['part_chair_back', [1370, 879, 68, 87]], ['part_brake', [1479, 887, 14, 28]], ['part_bracket', [1479, 932, 29, 28]],
];

// Ground anchor [x, y] in crop pixels for the in-game frames: x = rear-wheel hub, y = rear-wheel ground contact.
// Measured by registering the tyre ring of each frame against push_0 (±1 px); checked by eye on shots/slice-push.png.
// Phaser uses it as the frame origin, so frames with different bounding boxes do not jitter. Casters/feet hang 3–5 px
// below the rear wheel (3/4 perspective), which reads as standing on the ground line.
const ANCHOR = {
  push_0: [36, 178], push_1: [36, 180], push_2: [36, 185], push_3: [39, 185], push_4: [46, 178],
  side_0: [36, 188], side_1: [35, 182], side_2: [36, 184], side_3: [44, 184],
};

const sheet = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H, data } = sheet;

function components() {
  const label = new Int32Array(W * H).fill(-1);
  const out = [];
  const stack = [];
  for (let start = 0; start < W * H; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < ALPHA) continue;
    const id = out.length;
    const px = [];
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      px.push(i);
      const x = i % W, y = (i - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (label[j] === -1 && data[j * 4 + 3] >= ALPHA) { label[j] = id; stack.push(j); }
      }
    }
    out.push({ id, px, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return { label, comps: out.filter((c) => c.px.length >= MIN_PX) };
}

const { label, comps } = components();
if (comps.length !== NAMES.length) throw new Error(`expected ${NAMES.length} sprites, found ${comps.length}`);

// Rows: a component starts a new row when its top is below the previous row's bottom.
comps.sort((a, b) => a.y - b.y);
const rows = [];
for (const c of comps) {
  const row = rows.find((r) => c.y < r.bottom);
  if (row) { row.items.push(c); row.bottom = Math.max(row.bottom, c.y + c.h); }
  else rows.push({ bottom: c.y + c.h, items: [c] });
}
const ordered = rows.flatMap((r) => r.items.sort((a, b) => a.x - b.x || a.y - b.y));

const sprites = ordered.map((c, i) => {
  const [name, want] = NAMES[i];
  if (want && (want[0] !== c.x || want[1] !== c.y || want[2] !== c.w || want[3] !== c.h)) {
    throw new Error(`${name}: bbox ${[c.x, c.y, c.w, c.h]} != expected ${want}`);
  }
  // Crop = bbox grown by RING; keep a pixel if it is within RING of this component (soft edge), else transparent.
  const x = Math.max(0, c.x - RING), y = Math.max(0, c.y - RING);
  const w = Math.min(W, c.x + c.w + RING) - x, h = Math.min(H, c.y + c.h + RING) - y;
  const png = new PNG({ width: w, height: h });
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    const sx = x + cx, sy = y + cy;
    let keep = false;
    for (let dy = -RING; dy <= RING && !keep; dy++) for (let dx = -RING; dx <= RING && !keep; dx++) {
      const nx = sx + dx, ny = sy + dy;
      keep = nx >= 0 && ny >= 0 && nx < W && ny < H && label[ny * W + nx] === c.id;
    }
    if (keep) data.copy(png.data, (cy * w + cx) * 4, (sy * W + sx) * 4, (sy * W + sx) * 4 + 4);
  }
  return { name, png, w, h, sheet: [x, y] };
});

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    src.data.copy(dst.data, ((dy + y) * dst.width + dx) * 4, y * src.width * 4, (y + 1) * src.width * 4);
  }
}

// Shelf-pack into a fixed-width atlas, tallest first.
const ATLAS_W = 2048;
const byHeight = [...sprites].sort((a, b) => b.h - a.h);
let sx = PAD, sy = PAD, shelf = 0;
for (const s of byHeight) {
  if (sx + s.w + PAD > ATLAS_W) { sx = PAD; sy += shelf + PAD; shelf = 0; }
  s.ax = sx; s.ay = sy; sx += s.w + PAD; shelf = Math.max(shelf, s.h);
}
const atlas = new PNG({ width: ATLAS_W, height: sy + shelf + PAD });
const frames = {};
for (const s of sprites) {
  blit(atlas, s.png, s.ax, s.ay);
  const f = {
    frame: { x: s.ax, y: s.ay, w: s.w, h: s.h }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: s.w, h: s.h }, sourceSize: { w: s.w, h: s.h },
  };
  const a = ANCHOR[s.name];
  if (a) f.anchor = { x: a[0] / s.w, y: a[1] / s.h }; // Phaser reads this as the frame's origin
  frames[s.name] = f;
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'rafa.png'), PNG.sync.write(atlas));
fs.writeFileSync(path.join(OUT, 'rafa.json'), JSON.stringify({
  frames, meta: { image: 'rafa.png', size: { w: atlas.width, h: atlas.height }, scale: '1', source: SRC },
}, null, 1));

// --- visual checks (git-ignored) ---
fs.mkdirSync(CHECK, { recursive: true });
function fill(png, rgba) { for (let i = 0; i < png.data.length; i += 4) png.data.set(rgba, i); }
function over(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const tx = dx + x, ty = dy + y;
    if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
    const si = (y * src.width + x) * 4, di = (ty * dst.width + tx) * 4;
    const a = src.data[si + 3] / 255;
    for (let k = 0; k < 3; k++) {
      dst.data[di + k] = Math.round(src.data[si + k] * a + dst.data[di + k] * (1 - a));
    }
  }
}
// Contact sheet: 8 per row on light grey, in NAMES order.
const CELL = 300;
const contact = new PNG({ width: CELL * 8, height: CELL * Math.ceil(sprites.length / 8) });
fill(contact, [205, 215, 210, 255]);
sprites.forEach((s, i) => over(contact, s.png, (i % 8) * CELL + ((CELL - s.w) >> 1), Math.floor(i / 8) * CELL + ((CELL - s.h) >> 1)));
fs.writeFileSync(path.join(CHECK, 'slice-contact.png'), PNG.sync.write(contact));

// Anchor check, 2x: the push frames then the idle frames, each placed by its anchor on a shared baseline (black) and
// hub line (red), each group followed by the plain average of its frames — a sharp wheel there means no jitter.
const groups = [sprites.filter((s) => s.name.startsWith('push_')), sprites.filter((s) => s.name.startsWith('side_'))];
const CW = 160, BASE_Y = 200, AX = 50;
const cells = groups.flatMap((g) => [...g.map((s) => [s]), g]);
const strip = new PNG({ width: CW * cells.length, height: 220 });
cells.forEach((list, i) => {
  const acc = new Float64Array(CW * strip.height * 3);
  for (const s of list) {
    const one = new PNG({ width: CW, height: strip.height });
    fill(one, [235, 235, 235, 255]);
    over(one, s.png, AX - ANCHOR[s.name][0], BASE_Y - ANCHOR[s.name][1]);
    for (let p = 0; p < CW * strip.height; p++) for (let k = 0; k < 3; k++) acc[p * 3 + k] += one.data[p * 4 + k] / list.length;
  }
  for (let y = 0; y < strip.height; y++) for (let x = 0; x < CW; x++) {
    const p = y * CW + x, d = (y * strip.width + i * CW + x) * 4;
    strip.data.set([acc[p * 3], acc[p * 3 + 1], acc[p * 3 + 2], 255], d);
    if (y === BASE_Y) strip.data.set([0, 0, 0, 255], d);
    if (x === AX) strip.data.set([255, 0, 0, 255], d);
  }
});
const big = new PNG({ width: strip.width * 2, height: strip.height * 2 });
for (let y = 0; y < big.height; y++) for (let x = 0; x < big.width; x++) {
  strip.data.copy(big.data, (y * big.width + x) * 4, ((y >> 1) * strip.width + (x >> 1)) * 4, ((y >> 1) * strip.width + (x >> 1)) * 4 + 4);
}
fs.writeFileSync(path.join(CHECK, 'slice-push.png'), PNG.sync.write(big));

console.log(`${sprites.length} sprites → ${OUT}/rafa.png (${atlas.width}x${atlas.height}) + rafa.json; checks in ${CHECK}/`);
