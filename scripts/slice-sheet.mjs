// Cut the character sheets into named sprites → public/art/<who>.png + <who>.json (Phaser JSON-hash atlases) and the
// DOM images in public/art/ui/. Sprites = 8-connected components of alpha >= 200 (specks < 150 px dropped); each crop
// keeps the original RGBA of the component plus a 2 px soft-edge ring, everything else in the crop (background haze,
// neighbours) is made transparent. Visual checks go to shots/ (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const OUT = 'public/art';
const UI = 'public/art/ui';
const CHECK = 'shots';
const ALPHA = 200, MIN_PX = 150, RING = 2, PAD = 2;

// [name, expected bbox] in sheet order (row by row, left to right). null = not measured; only the count is checked.
const RAFA = [
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

const FABINHO = [
  ['turn_front', [58, 6, 97, 238]], ['turn_front2', [226, 6, 100, 238]], ['turn_34', [392, 6, 94, 239]],
  ['turn_side', [567, 7, 79, 238]], ['turn_back', [722, 8, 92, 236]], ['turn_back2', [872, 8, 102, 237]],
  ['walk_0', [1042, 14, 115, 231]], ['walk_1', [1187, 11, 124, 234]], ['walk_2', [1336, 14, 120, 229]],
  ['run_0', [36, 278, 148, 201]], ['run_1', [196, 272, 161, 187]], ['run_2', [359, 274, 183, 200]],
  ['run_3', [552, 274, 172, 196]], ['run_4', [719, 277, 169, 197]],
  ['leap_0', [903, 270, 146, 215]], ['leap_1', [1065, 265, 129, 209]], ['crouch', [1235, 325, 133, 155]],
  ['halfsquat', [1412, 268, 108, 211]],
  ['pushup_0', [23, 542, 197, 127]], ['pushup_1', [241, 534, 213, 137]], ['squat', [490, 507, 128, 162]],
  ['lunge', [624, 511, 177, 162]], ['situp_0', [869, 566, 154, 107]], ['situp_1', [1035, 571, 186, 102]],
  ['stretch_side', [1238, 497, 107, 176]], ['stretch_leg', [1364, 532, 157, 153]],
  ['wave', [32, 687, 114, 168]], ['thumb_up', [193, 689, 111, 166]], ['thumb_side', [338, 691, 112, 165]],
  ['armscrossed', [490, 693, 85, 165]], ['thinking', [624, 691, 81, 167]], ['drinking', [756, 701, 106, 157]],
  ['phone', [897, 710, 97, 148]], ['point', [1032, 701, 127, 157]], ['kneel_0', [1186, 725, 106, 141]],
  ['kneel_1', [1357, 728, 134, 141]],
  ['face_laugh', [27, 868, 102, 127]], ['face_laugh2', [162, 871, 104, 124]], ['face_laugh3', [299, 870, 101, 125]],
  ['face_laugh4', [429, 870, 104, 125]], ['face_smile', [561, 870, 103, 125]], ['face_shocked', [693, 871, 100, 124]],
  ['face_shocked2', [817, 869, 104, 126]], ['face_angry', [945, 871, 103, 124]], ['face_angry2', [1073, 871, 102, 124]],
  ['defeated', [1207, 933, 162, 68]], ['sulk', [1392, 888, 125, 117]],
];

// Gym Rafa (level 1). Names starting with '_' are cut but left out of the atlas (the asleep pose's little "Z").
const RAFAGYM = [
  ['turn_front', [25, 16, 108, 257]], ['turn_34', [176, 18, 111, 255]], ['turn_side', [325, 14, 108, 257]],
  ['turn_back34', [486, 17, 106, 254]], ['turn_back', [643, 17, 98, 254]], ['turn_side_l', [776, 15, 111, 256]],
  ['turn_34_l', [921, 17, 112, 256]],
  ['face_smile', [1068, 15, 201, 230]], ['face_laugh', [1271, 15, 184, 230]], ['face_grin', [1454, 17, 186, 228]],
  ['face_shocked', [1640, 16, 178, 228]], ['face_sad', [1818, 18, 177, 226]], ['face_angry', [1996, 21, 173, 223]],
  ['stand_0', [26, 297, 96, 200]], ['stand_1', [152, 298, 92, 199]],
  ['walk_0', [289, 301, 97, 193]], ['walk_1', [406, 304, 114, 185]], ['walk_2', [539, 302, 94, 191]],
  ['walk_3', [652, 306, 100, 187]], ['walk_4', [770, 307, 122, 187]],
  ['run_0', [939, 308, 124, 181]], ['run_1', [1068, 308, 126, 187]], ['run_2', [1190, 308, 130, 185]],
  ['run_3', [1327, 317, 127, 176]], ['run_4', [1463, 317, 119, 176]],
  ['crouch', [1646, 310, 99, 168]], ['leap', [1773, 266, 96, 166]], ['leap_up', [1895, 270, 133, 166]],
  ['land', [2053, 333, 100, 159]],
  ['squat_0', [16, 571, 94, 139]], ['squat_1', [120, 547, 92, 163]], ['squat_2', [226, 524, 84, 186]],
  ['pushup_0', [338, 590, 162, 120]], ['pushup_1', [499, 616, 158, 94]], ['lunge', [679, 544, 131, 166]],
  ['stretch_0', [829, 537, 136, 173]], ['stretch_1', [997, 529, 109, 181]], ['guard', [1125, 529, 103, 181]],
  ['cheer_0', [1247, 528, 136, 182]], ['cheer_1', [1393, 528, 130, 182]],
  ['phone_0', [1544, 536, 94, 174]], ['phone_1', [1683, 545, 91, 165]],
  ['knees', [1818, 565, 149, 146]], ['asleep', [1998, 567, 156, 146]], ['_z', [2106, 564, 17, 22]],
];

// Ground anchor [x, y] in crop pixels for the in-game frames: x = rear-wheel hub, y = rear-wheel ground contact.
// Measured by registering the tyre ring of each frame against push_0 (±1 px); checked by eye on shots/slice-push.png.
// Phaser uses it as the frame origin, so frames with different bounding boxes do not jitter. Casters/feet hang 3–5 px
// below the rear wheel (3/4 perspective), which reads as standing on the ground line.
const RAFA_ANCHOR = {
  push_0: [36, 178], push_1: [36, 180], push_2: [36, 185], push_3: [39, 185], push_4: [46, 178],
  side_0: [36, 188], side_1: [35, 182], side_2: [36, 184], side_3: [44, 184],
};
const FABINHO_ANCHOR = {};

// DOM images: atlas frame → public/art/ui/<file>.png, copied 1:1.
const RAFA_UI = ['face_smile', 'face_laugh', 'face_grin', 'face_shocked', 'face_sad', 'face_angry', 'pose_wave',
  'pose_phone', 'pose_armscrossed', 'pose_armsup', 'pose_chin', 'pose_point', 'turn_front', 'turn_34']
  .map((n) => [n, `rafa_${n}`]);
const FABINHO_UI = [['face_laugh', 'face_laugh'], ['face_shocked', 'face_shocked'], ['face_angry', 'face_angry'],
  ['armscrossed', 'armscrossed'], ['thumb_up', 'thumb_up'], ['point', 'point'], ['defeated', 'defeated'],
  ['sulk', 'sulk']].map(([n, f]) => [n, `fabinho_${f}`]);
const RAFAGYM_UI = [['face_smile', 'face_smile'], ['face_laugh', 'face_laugh'], ['face_grin', 'face_grin'],
  ['face_shocked', 'face_shocked'], ['face_sad', 'face_sad'], ['face_angry', 'face_angry'], ['turn_34', 'turn_34'],
  ['cheer_0', 'armsup'], ['knees', 'knee'], ['phone_0', 'phone']].map(([n, f]) => [n, `rafagym_${f}`]);

function slice(src, names) {
  const { width: W, height: H, data } = PNG.sync.read(fs.readFileSync(src));
  const label = new Int32Array(W * H).fill(-1);
  const comps = [];
  const stack = [];
  for (let start = 0; start < W * H; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < ALPHA) continue;
    const id = comps.length;
    let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      n++;
      const x = i % W, y = (i - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (label[j] === -1 && data[j * 4 + 3] >= ALPHA) { label[j] = id; stack.push(j); }
      }
    }
    comps.push({ id, n, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  const kept = comps.filter((c) => c.n >= MIN_PX);
  if (kept.length !== names.length) throw new Error(`${src}: expected ${names.length} sprites, found ${kept.length}`);

  // Rows: a component joins a row when its vertical centre is above that row's bottom (neighbouring rows can touch).
  kept.sort((a, b) => a.y - b.y);
  const rows = [];
  for (const c of kept) {
    const row = rows.find((r) => c.y + c.h / 2 < r.bottom);
    if (row) { row.items.push(c); row.bottom = Math.max(row.bottom, c.y + c.h); }
    else rows.push({ bottom: c.y + c.h, items: [c] });
  }
  return rows.flatMap((r) => r.items.sort((a, b) => a.x - b.x || a.y - b.y)).map((c, i) => {
    const [name, want] = names[i];
    if (want && (want[0] !== c.x || want[1] !== c.y || want[2] !== c.w || want[3] !== c.h)) {
      throw new Error(`${src} ${name}: bbox ${[c.x, c.y, c.w, c.h]} != expected ${want}`);
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
    return { name, png, w, h };
  });
}

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    src.data.copy(dst.data, ((dy + y) * dst.width + dx) * 4, y * src.width * 4, (y + 1) * src.width * 4);
  }
}

// Shelf-pack into a fixed-width atlas, tallest first. anchors[name] = [x, y] crop px → frame origin (Phaser `anchor`).
function writeAtlas(who, src, sprites, anchors) {
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
    const a = anchors[s.name];
    if (a) f.anchor = { x: a[0] / s.w, y: a[1] / s.h };
    if (s.hub) f.hub = { x: s.hub[0], y: s.hub[1] }; // spokes overlay pivot, crop px (Phaser keeps it in frame.customData)
    frames[s.name] = f;
  }
  fs.writeFileSync(path.join(OUT, `${who}.png`), PNG.sync.write(atlas));
  fs.writeFileSync(path.join(OUT, `${who}.json`), JSON.stringify({
    frames, meta: { image: `${who}.png`, size: { w: atlas.width, h: atlas.height }, scale: '1', source: src },
  }, null, 1));
  console.log(`${sprites.length} sprites → ${OUT}/${who}.png (${atlas.width}x${atlas.height}) + ${who}.json`);
}

function writeUi(sprites, list) {
  const by = Object.fromEntries(sprites.map((s) => [s.name, s]));
  for (const [name, file] of list) fs.writeFileSync(path.join(UI, `${file}.png`), PNG.sync.write(by[name].png));
}



const rafa = slice('art-src/characters/rafa-sheet.png', RAFA);
const fab = slice('art-src/characters/fabinho-sheet.png', FABINHO);
const gym = slice('art-src/characters/rafa-sheet-gym.PNG', RAFAGYM).filter((s) => !s.name.startsWith('_'));

// --- Rafa: frames derived at build time (the sheet crops above stay untouched) ---
// Rear-wheel hub [x, y] in crop px: circle fit to the tyre's outer silhouette (rms < 0.7 px), tyre radius 35–36 px.
const HUB = {
  push_0: [36.4, 143.5], push_1: [36.7, 145.3], push_2: [37.9, 150.1], push_3: [40.6, 149.9], push_4: [46.9, 143.3],
};
const R_IN = 22.5; // inside the silver push rim: only spokes, hub and the dark seat / open gaps behind them
const R_TYRE = 36.4; // outer tyre edge incl. its soft rim
// The big-row poses see the wheel more from the front (ellipse fit to the tyre: centre, vertical semi-axis). They are
// scaled so that semi-axis matches the push frames' (36.5 px) and anchored on their own hub / tyre contact.
const POSE_WHEEL = { pose_armsup: [41.2, 215.9, 52.8], pose_point: [43, 207.3, 54.9] };
const PUSH_B = 36.5;

const lumOf = (d, i) => (d[i] + d[i + 1] + d[i + 2]) / 3;
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const clonePng = (src) => { const p = new PNG({ width: src.width, height: src.height }); src.data.copy(p.data); return p; };

// Spokes are drawn lighter (lum ≥ ~36) than the seat seen behind them (~10–30) or are surrounded by open gaps.
// Body: inside R_IN everything but clearly-behind pixels (empty, or opaque dark seat) is replaced by its nearest
// clearly-behind pixel (BFS), so the dark seat on top and the open gaps below stay put while spokes and their soft
// edges go. Overlay: the spoke pixels alone, rotated at runtime around the hub.
function isBehind(d, i) { return d[i + 3] < 24 || (d[i + 3] >= 200 && lumOf(d, i) < 30); }
function hollow(src, [hx, hy]) {
  const out = clonePng(src), { width: w, height: h, data: d } = src;
  const inside = (x, y) => Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < R_IN + 1;
  const owner = new Int32Array(w * h).fill(-1);
  let queue = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (inside(x, y) && isBehind(d, p * 4)) { owner[p] = p; queue.push(p); }
  }
  while (queue.length) {
    const next = [];
    for (const p of queue) {
      const x = p % w, y = (p - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const q = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || owner[q] !== -1 || !inside(nx, ny)) continue;
        owner[q] = owner[p];
        next.push(q);
      }
    }
    queue = next;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    const k = 1 - smooth(R_IN - 0.5, R_IN + 0.5, Math.hypot(x + 0.5 - hx, y + 0.5 - hy)); // 1 inside, 0 on the rim
    if (k <= 0 || owner[p] === p || owner[p] < 0) continue;
    for (let c = 0; c < 4; c++) out.data[p * 4 + c] = Math.round(d[owner[p] * 4 + c] * k + d[p * 4 + c] * (1 - k));
  }
  return out;
}
function spokes(src, [hx, hy]) {
  const r = Math.ceil(R_IN) + 1, x0 = Math.floor(hx) - r, y0 = Math.floor(hy) - r, size = 2 * r + 1;
  const out = new PNG({ width: size, height: size }), d = src.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = x0 + x, sy = y0 + y, i = (sy * src.width + sx) * 4, o = (y * size + x) * 4;
    const k = 1 - smooth(R_IN - 0.5, R_IN + 0.5, Math.hypot(sx + 0.5 - hx, sy + 0.5 - hy));
    if (k <= 0 || d[i + 3] < 128) continue;
    d.copy(out.data, o, i, i + 3);
    out.data[o + 3] = Math.round(d[i + 3] * k * smooth(28, 44, lumOf(d, i)));
  }
  return { png: out, anchor: [hx - x0, hy - y0] };
}
// Loose wheel for the crash: the whole tyre disc (push_3's is not touched by hand or dress), soft 1 px edge.
function wheelDisc(src, [hx, hy]) {
  const r = Math.ceil(R_TYRE) + 1, x0 = Math.floor(hx) - r, y0 = Math.floor(hy) - r, size = 2 * r + 1;
  const out = new PNG({ width: size, height: size }), d = src.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = x0 + x, sy = y0 + y, i = (sy * src.width + sx) * 4, o = (y * size + x) * 4;
    const k = 1 - smooth(R_TYRE - 0.5, R_TYRE + 0.5, Math.hypot(sx + 0.5 - hx, sy + 0.5 - hy));
    if (k <= 0 || sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
    d.copy(out.data, o, i, i + 3);
    out.data[o + 3] = Math.round(d[i + 3] * k);
  }
  return { png: out, anchor: [hx - x0, hy - y0] };
}
// Lanczos-3 downscale by k, separable, in premultiplied alpha (no dark/light fringes on soft edges). The output grid
// is shifted by (ox, oy) < 1 px so the given source point (the anchor) lands on a whole output pixel — the sprite then
// sits on exact pixels like the 1:1 frames.
function downscale(src, k, [ax, ay]) {
  const ox = Math.ceil(ax * k) - ax * k, oy = Math.ceil(ay * k) - ay * k;
  const sw = src.width, sh = src.height, w = Math.ceil(sw * k + ox), h = Math.ceil(sh * k + oy);
  const lanczos = (x) => (x === 0 ? 1 : Math.abs(x) >= 3 ? 0 : (3 * Math.sin(Math.PI * x) * Math.sin((Math.PI * x) / 3)) / (Math.PI * Math.PI * x * x));
  // Pixels outside the source count as transparent, so edges fade instead of being renormalised away.
  const pass = (from, n, len, stride, outN, off, get, set) => {
    for (let o = 0; o < outN; o++) {
      const c = (o + 0.5 - off) / k - 0.5, taps = [];
      let sum = 0;
      for (let t = Math.ceil(c - 3 / k); t <= Math.floor(c + 3 / k); t++) {
        const wt = lanczos((t - c) * k);
        sum += wt;
        if (t >= 0 && t < len) taps.push([t, wt]);
      }
      for (let line = 0; line < n; line++) {
        const acc = [0, 0, 0, 0];
        for (const [t, wt] of taps) for (let ch = 0; ch < 4; ch++) acc[ch] += from[get(line, t) + ch] * wt;
        for (let ch = 0; ch < 4; ch++) set(line, o, ch, acc[ch] / sum);
      }
    }
  };
  const pre = new Float64Array(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) {
    const al = src.data[i * 4 + 3] / 255;
    for (let ch = 0; ch < 3; ch++) pre[i * 4 + ch] = src.data[i * 4 + ch] * al;
    pre[i * 4 + 3] = al;
  }
  const tmp = new Float64Array(w * sh * 4), res = new Float64Array(w * h * 4);
  pass(pre, sh, sw, 1, w, ox, (y, x) => (y * sw + x) * 4, (y, x, ch, v) => (tmp[(y * w + x) * 4 + ch] = v));
  pass(tmp, w, sh, 1, h, oy, (x, y) => (y * w + x) * 4, (x, y, ch, v) => (res[(y * w + x) * 4 + ch] = v));
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    const al = Math.min(1, res[i * 4 + 3]);
    if (al < 1 / 255) continue;
    for (let ch = 0; ch < 3; ch++) out.data[i * 4 + ch] = Math.max(0, Math.min(255, Math.round(res[i * 4 + ch] / al)));
    out.data[i * 4 + 3] = Math.round(al * 255);
  }
  return { png: out, anchor: [Math.round(ax * k + ox), Math.round(ay * k + oy)] };
}

const byName = (list) => Object.fromEntries(list.map((s) => [s.name, s]));
const RB = byName(rafa);
const derived = [];
const add = (name, png, anchor, hub) => {
  derived.push({ name, png, w: png.width, h: png.height, hub });
  RAFA_ANCHOR[name] = anchor;
};
for (const [name, hub] of Object.entries(HUB)) {
  add(name.replace('push_', 'roll_'), hollow(RB[name].png, hub), RAFA_ANCHOR[name], hub);
}
{
  const s = spokes(RB.push_3.png, HUB.push_3);
  add('spokes', s.png, s.anchor);
  const wd = wheelDisc(RB.push_3.png, HUB.push_3);
  add('part_wheel', wd.png, wd.anchor);
}
for (const [name, [cx, cy, b]] of Object.entries(POSE_WHEEL)) {
  const ds = downscale(RB[name].png, PUSH_B / b, [cx, cy + b]);
  add(name.replace('pose_', '') + '_s', ds.png, ds.anchor);
}

// Fabinho: ground = bottom of the sprite (feet, or whatever touches the floor); x = centre of his hair, so the head
// holds still while legs and arms swing (run, walk, leap). Sit-ups pivot on the feet (right edge).
function hairX(png) {
  let n = 0, sx = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b, a] = png.data.subarray(i, i + 4);
    if (a >= 200 && r > 90 && r < 215 && g > 45 && g < 140 && b > 15 && b < 95 && r - g > 30 && g - b > 15 && r - b > 60) {
      n++; sx += (i / 4) % png.width;
    }
  }
  return Math.round(sx / n);
}
// Push-ups pivot on the front hand (rightmost opaque pixel near the floor).
function handX(png) {
  let x1 = 0;
  for (let y = png.height - 12; y < png.height - RING; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] >= 200) x1 = Math.max(x1, x);
  }
  return x1 - 12;
}
for (const s of fab) {
  const x = s.name.startsWith('situp_') ? s.w - 40 : s.name.startsWith('pushup_') ? handX(s.png)
    : s.name.startsWith('face_') ? Math.round(s.w / 2) : hairX(s.png);
  FABINHO_ANCHOR[s.name] = [x, s.h - RING];
}

// Gym Rafa: ground = bottom of the sprite; x = her glasses (dark rim pixels with face skin just above and below), so
// the head holds still while her long hair streams back. Back views have no glasses (centred); push-ups use the hand.
function glassesX(png) {
  const { width: w, height: h, data: d } = png;
  const at = (x, y) => (y * w + x) * 4;
  const skin = (i) => d[i + 3] >= 200 && d[i] > 150 && d[i + 1] > 85 && d[i + 2] > 50 && d[i] - d[i + 2] > 45 && d[i] > d[i + 1];
  let n = 0, sx = 0;
  for (let y = 5; y < h / 2; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y);
    if (d[i + 3] < 200 || Math.max(d[i], d[i + 1], d[i + 2]) > 75) continue;
    let up = false, dn = false;
    for (let k = 1; k <= 5; k++) {
      up ||= y - k >= 0 && skin(at(x, y - k));
      dn ||= y + k < h && skin(at(x, y + k));
    }
    if (up && dn) { n++; sx += x; }
  }
  return n > 60 ? Math.round(sx / n) : Math.round(w / 2);
}
const RAFAGYM_ANCHOR = {};
for (const s of gym) {
  const x = s.name.startsWith('pushup_') ? handX(s.png) : s.name.startsWith('face_') ? Math.round(s.w / 2) : glassesX(s.png);
  RAFAGYM_ANCHOR[s.name] = [x, s.h - RING];
}

fs.mkdirSync(UI, { recursive: true });
writeAtlas('rafa', 'art-src/characters/rafa-sheet.png', [...rafa, ...derived], RAFA_ANCHOR);
writeAtlas('fabinho', 'art-src/characters/fabinho-sheet.png', fab, FABINHO_ANCHOR);
writeAtlas('rafagym', 'art-src/characters/rafa-sheet-gym.PNG', gym, RAFAGYM_ANCHOR);
writeUi(rafa, RAFA_UI);
writeUi(fab, FABINHO_UI);
writeUi(gym, RAFAGYM_UI);
console.log(`${RAFA_UI.length + FABINHO_UI.length + RAFAGYM_UI.length} DOM images → ${UI}/`);

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
// Contact sheet: 8 per row on light grey, in sheet order.
function contact(file, sprites) {
  const CELL = 300;
  const png = new PNG({ width: CELL * 8, height: CELL * Math.ceil(sprites.length / 8) });
  fill(png, [205, 215, 210, 255]);
  sprites.forEach((s, i) => over(png, s.png, (i % 8) * CELL + ((CELL - s.w) >> 1), Math.floor(i / 8) * CELL + ((CELL - s.h) >> 1)));
  fs.writeFileSync(path.join(CHECK, file), PNG.sync.write(png));
}
contact('slice-contact.png', rafa);
contact('slice-fabinho.png', fab);
contact('slice-gym.png', gym);

// Anchor check, 2x: each group's frames placed by anchor on a shared baseline (black) and anchor line (red), followed
// by the plain average of the group — a sharp wheel / torso there means no jitter.
function onion(file, sprites, anchors, groups, CW = 160, CH = 220) {
  const by = byName(sprites);
  const BASE_Y = CH - 20, AX = Math.round(CW / 2);
  const cells = groups.map((g) => g.map((n) => by[n])).flatMap((g) => [...g.map((s) => [s]), g]);
  const strip = new PNG({ width: CW * cells.length, height: CH });
  cells.forEach((list, i) => {
    const acc = new Float64Array(CW * CH * 3);
    for (const s of list) {
      const one = new PNG({ width: CW, height: CH });
      fill(one, [235, 235, 235, 255]);
      over(one, s.png, AX - anchors[s.name][0], BASE_Y - anchors[s.name][1]);
      for (let p = 0; p < CW * CH; p++) for (let k = 0; k < 3; k++) acc[p * 3 + k] += one.data[p * 4 + k] / list.length;
    }
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
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
  fs.writeFileSync(path.join(CHECK, file), PNG.sync.write(big));
}
const R_ALL = [...rafa, ...derived];
const seq = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i}`);
onion('slice-push.png', R_ALL, RAFA_ANCHOR, [seq('push_', 5), seq('side_', 4)]);
onion('slice-poses.png', R_ALL, RAFA_ANCHOR, [seq('roll_', 5), ['push_0', 'armsup_s'], ['push_0', 'point_s']], 260);
onion('slice-fab-run.png', fab, FABINHO_ANCHOR, [seq('run_', 5), seq('walk_', 3)], 260, 260);
onion('slice-gym-run.png', gym, RAFAGYM_ANCHOR, [seq('run_', 5), seq('walk_', 5), ['stand_0', 'stand_1']], 220, 240);
onion('slice-gym-moves.png', gym, RAFAGYM_ANCHOR, [['crouch', 'leap', 'leap_up', 'land'], ['cheer_0', 'cheer_1'], ['guard', 'stand_0'], seq('pushup_', 2), seq('squat_', 3)], 240, 240);
onion('slice-fab-moves.png', fab, FABINHO_ANCHOR, [['leap_0', 'leap_1', 'crouch', 'halfsquat'], seq('pushup_', 2), seq('situp_', 2), ['halfsquat', 'squat']], 320, 260);
console.log(`checks in ${CHECK}/`);
