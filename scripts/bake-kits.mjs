// Standing Rafas (level 1 on her feet, level 2 on crutches) → public/art/kits.png + kits.json (Phaser JSON-hash atlas, 1:1).
// Upper bodies are cut from wheelchair frames of art-src/characters/rafa-sheet.png (chair pixels removed); skirt,
// shoes, bandaged foot and crutch are rasterised here in the sheet's style (see art-src/kits/style.json).
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const SHEET = 'art-src/characters/rafa-sheet.png';
const STYLE = JSON.parse(fs.readFileSync('art-src/kits/style.json', 'utf8'));
const sheet = PNG.sync.read(fs.readFileSync(SHEET));
const DBG = 'shots/kits';

// ---------- tiny RGBA float image ----------
const img = (w, h) => ({ w, h, d: new Float32Array(w * h * 4) }); // straight alpha, 0..255 colour, 0..1 alpha
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function get(im, x, y) { const i = (y * im.w + x) * 4; return [im.d[i], im.d[i + 1], im.d[i + 2], im.d[i + 3]]; }
function put(im, x, y, c, a) { const i = (y * im.w + x) * 4; im.d[i] = c[0]; im.d[i + 1] = c[1]; im.d[i + 2] = c[2]; im.d[i + 3] = a; }
/** Source-over composite of src onto dst at (dx, dy). */
function over(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const tx = x + dx, ty = y + dy;
    if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
    const s = get(src, x, y); if (s[3] <= 0) continue;
    const d = get(dst, tx, ty), a = s[3] + d[3] * (1 - s[3]);
    put(dst, tx, ty, [0, 1, 2].map((k) => (s[k] * s[3] + d[k] * d[3] * (1 - s[3])) / a), a);
  }
}
function fromSheet(x0, y0, w, h) {
  const im = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y0 + y) * sheet.width + x0 + x) * 4;
    put(im, x, y, [sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]], sheet.data[i + 3] / 255);
  }
  return im;
}
function inPoly(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ---------- upper body from a wheelchair frame ----------
const isSkin = ([r, g, b]) => r > 120 && r > g + 22 && g > b;
// Wheelchair paint: near-neutral darks/greys (her outlines are warmer or darker, the dress is green).
const isChair = ([r, g, b, a]) => a > 0.3 && Math.max(r, g, b) > 20 && Math.abs(r - b) <= 10 && Math.abs(g - (r + b) / 2) <= 6;

function cutUpper(src) {
  const [sx, sy, w, h] = src.crop;
  const im = fromSheet(sx, sy, w, h);
  const N = w * h, gone = new Uint8Array(N), chair = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!inPoly(src.keep, x + 0.5, y + 0.5)) gone[y * w + x] = 1;
  const erased = (x, y) => src.erase && inPoly(src.erase, x + 0.5, y + 0.5);
  // Flood the chair from every chair pixel outside the keep polygon, through chair-coloured pixels.
  const st = [];
  for (let i = 0; i < N; i++) if (gone[i] && isChair(get(im, i % w, (i / w) | 0))) { chair[i] = 1; st.push(i); }
  while (st.length) {
    const i = st.pop(), x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || chair[j] || !isChair(get(im, nx, ny))) continue;
      chair[j] = 1; st.push(j);
    }
  }
  for (let i = 0; i < N; i++) if (chair[i] || erased(i % w, (i / w) | 0)) gone[i] = 1;
  // Below the waist cut only skin and its outline survive (forearm, hands); the drawn skirt behind continues the dress.
  const skin = new Uint8Array(N);
  for (let i = 0; i < N; i++) skin[i] = !gone[i] && isSkin(get(im, i % w, (i / w) | 0)) ? 1 : 0;
  const nearSkin = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && skin[ny * w + nx]) return true;
    }
    return false;
  };
  for (let y = src.waist; y < h; y++) for (let x = 0; x < w; x++) if (!skin[y * w + x] && !nearSkin(x, y)) gone[y * w + x] = 1;
  // The bodice fades out over the last rows above the cut, so the sheet's dark armrest/underbust line there
  // dissolves into the skirt drawn behind instead of reading as a seam.
  const out = img(w, h);
  for (let i = 0; i < N; i++) if (!gone[i]) {
    const x = i % w, y = (i / w) | 0, c = get(im, x, y);
    put(out, x, y, c, skin[i] || nearSkin(x, y) ? c[3] : c[3] * (1 - smooth(src.waist - 7, src.waist, y)));
  }
  return out;
}

// ---------- drawing new parts in the sheet's manner ----------
// Measured on the sheet: the art behaves like ~2.5 px "pixels" resampled smoothly — stair-stepped silhouettes, a
// near-black outline one art pixel (2–3 px) thick with a soft 1–2 px fringe, soft low-contrast shading in 4–6 tones.
const CELL = 2.5;
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function ramp(stops, t) {
  const cs = stops.map(hex), f = clamp(t) * (cs.length - 1), i = Math.min(cs.length - 2, Math.floor(f));
  return mix(cs[i], cs[i + 1], f - i);
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
/** Signed distance to a closed polygon, negative inside. */
function polySd(pts, x, y) {
  let d = 1e9;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) d = Math.min(d, segDist(x, y, ...pts[j], ...pts[i]));
  return inPoly(pts, x, y) ? -d : d;
}
/** Rasterise one outlined shape: sd(x, y) signed distance, shade(x, y, sd) → rgb. Evaluated per art cell (stair-steps),
 *  outline = the outermost cell, plus a soft fringe outside. (ox, oy) = where local (0, 0) sits in the image. */
function shape(im, ox, oy, sd, shade, outline, { line = CELL, cell = CELL, fringe = true } = {}) {
  const lay = img(im.w, im.h);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const qx = (Math.floor((x - ox) / cell) + 0.5) * cell, qy = (Math.floor((y - oy) / cell) + 0.5) * cell;
    const d = sd(qx, qy);
    if (d > (fringe ? cell : 0)) continue;
    if (d > 0) { put(lay, x, y, hex(outline), 0.45); continue; }
    const c = d > -line ? hex(outline) : shade(qx, qy, d);
    put(lay, x, y, c, 1);
  }
  over(im, lay, 0, 0);
}
/** Softens like the sheet's resampling: 3×3 [1 2 1] on premultiplied colour. */
function soften(im) {
  const o = img(im.w, im.h), K = [1, 2, 1];
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const k = K[i + 1] * K[j + 1]; n += k;
      const nx = x + i, ny = y + j; if (nx < 0 || ny < 0 || nx >= im.w || ny >= im.h) continue;
      const c = get(im, nx, ny); r += c[0] * c[3] * k; g += c[1] * c[3] * k; b += c[2] * c[3] * k; a += c[3] * k;
    }
    if (a > 0) put(o, x, y, [r / a, g / a, b / a], a / n);
  }
  return o;
}

// ---------- skirt ----------
// Local frame: origin = hip pivot (centre of the waist cut), y down, facing right. hf/hb push the hem's front/back
// edges forward (+) or back (−) — legs moving under the dress; lift raises the hem (jumps).
const isDress = ([r, g, b, a]) => a > 0.9 && g >= r - 2 && g > 60 && r <= g + 10;
/** The drawn skirt continues the bodice: each stop of the sampled lap ramp is pulled 60% toward the matching
 *  luminance quantile of the dress pixels just above the waist cuts. */
function bodiceRamp(stops) {
  const cs = [];
  for (const src of Object.values(STYLE.uppers)) {
    const im = fromSheet(...src.crop);
    for (let y = src.waist - 16; y < src.waist; y++) for (let x = 0; x < im.w; x++) {
      const c = get(im, x, y);
      if (inPoly(src.keep, x + 0.5, y + 0.5) && isDress(c)) cs.push(c);
    }
  }
  cs.sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]);
  return stops.map((h, i) => {
    if (i === 0) return h; // keep the near-outline dark
    const q = cs[Math.min(cs.length - 1, Math.floor((cs.length * (i - 0.5)) / (stops.length - 1)))];
    return '#' + mix(hex(h), q, 0.6).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  });
}
const SAGE = bodiceRamp(STYLE.ramps.sage);
const SKIRT = { top: -26, hem: 104, w: 96, h: 132, ox: 46, oy: 12 };
function skirtEdges(hf, hb, lift) {
  const H = SKIRT.hem - lift, front = [], back = [];
  const sway = (y, k) => k * Math.pow(smooth(0.15, 1, y / H), 1.5);
  for (let y = SKIRT.top; y <= H; y += 3) {
    const v = clamp(y / H);
    // above the waist it only fills her side behind the arm (where the chair was), tucked inside the torso outline
    const belly = y < 0 ? -4 * smooth(0, -20, y) : 3 * Math.sin(Math.PI * clamp((y + 4) / 44));
    const seat = 6 * smooth(-26, 2, y) + 6 * Math.sin(Math.PI * clamp((y + 2) / 56)); // her seat, then it falls straight
    front.push([16 + belly + 13 * v * v + sway(y, hf), y]);
    back.push([-(15 + seat + 12 * v * v) + sway(y, hb), y]);
  }
  // the front hem corner rises when kicked forward
  const rise = Math.max(0, hf) * 0.35, fH = front.at(-1), bH = back.at(-1);
  fH[1] -= rise;
  while (front.length > 2 && front.at(-2)[1] >= fH[1]) front.splice(-2, 1);
  const hem = [];
  for (let k = 1; k < 6; k++) hem.push([fH[0] + (bH[0] - fH[0]) * k / 6, fH[1] + (bH[1] - fH[1]) * k / 6 + 2.5 * Math.sin(Math.PI * k / 6)]);
  return { front, back, poly: [...front, ...hem, ...[...back].reverse()], H };
}
function skirt(hf, hb, lift = 0) {
  const im = img(SKIRT.w, SKIRT.h), { poly, front, back, H } = skirtEdges(hf, hb, lift);
  const at = (edge, y) => edge[clamp(Math.round((y - SKIRT.top) / 3), 0, edge.length - 1)][0];
  shape(im, SKIRT.ox, SKIRT.oy, (x, y) => polySd(poly, x, y), (x, y, d) => {
    const v = clamp(y / H), u = clamp((x - at(back, y)) / (at(front, y) - at(back, y)));
    let t = 0.18 + 0.72 * smooth(0.05, 0.72, u) - 0.15 * smooth(0.86, 1, u); // lit from the front, back in shade
    // soft vertical folds fanning out toward the hem (no centre crease: that reads as trousers)
    const fold = (c, w) => Math.exp(-(((u - c - 0.08 * (v - 0.5)) / w) ** 2));
    t += (0.12 * fold(0.78, 0.07) - 0.1 * fold(0.6, 0.05) + 0.08 * fold(0.42, 0.08) - 0.1 * fold(0.25, 0.05)) * smooth(0.15, 0.6, v);
    t -= 0.4 * (1 - smooth(-0.08, 0.22, v)); // shadow under the bust and arm
    t -= 0.15 * smooth(-6, -2.5, d) * (1 - u); // darker band inside the back outline
    t += (hash(Math.floor(x / CELL), Math.floor(y / CELL)) - 0.5) * 0.1;
    if (y > H - 4) t += 0.1; // light hem rim, as on the seated frames
    return ramp(SAGE, t);
  }, STYLE.ramps.outlineDress);
  return soften(im);
}

// ---------- small parts ----------
const R = STYLE.ramps;
const capsule = (ax, ay, bx, by, r) => (x, y) => segDist(x, y, ax, ay, bx, by) - r;
const union = (...f) => (x, y) => Math.min(...f.map((g) => g(x, y)));
const rect = (cx, cy, w, h, r = 0) => (x, y) => {
  const qx = Math.abs(x - cx) - w / 2 + r, qy = Math.abs(y - cy) - h / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
/** Shading for small parts: a mid tone, lit rim on the edges facing up-front (the sheet's light), noise. */
function lit(stops, base, rim = 0.35, extra = () => 0) {
  return (sd) => (x, y, d) => {
    const nx = sd(x + 0.7, y) - sd(x - 0.7, y), ny = sd(x, y + 0.7) - sd(x, y - 0.7), n = Math.hypot(nx, ny) || 1;
    const facing = (nx * 0.55 - ny * 0.83) / n; // light from up and slightly front (+x)
    let t = base + rim * facing * (1 - smooth(-6, -3, d)) - 0.12 * smooth(-5, -1, d) * (facing < 0 ? 1 : 0);
    t += extra(x, y, d) + (hash(Math.floor(x / 2), Math.floor(y / 2)) - 0.5) * 0.06;
    return ramp(stops, t);
  };
}
/** A part: list of [sd, shader-factory, outline, opts]; (ox, oy) = where local (0, 0) lands. */
function part(w, h, ox, oy, layers, doSoften = true) {
  const im = img(w, h);
  for (const [sd, sh, outline, opts] of layers) shape(im, ox, oy, sd, sh(sd), outline, { cell: 1, line: 1.5, ...opts });
  return { im: doSoften ? soften(im) : im, ox, oy };
}

// Shoe: black flat facing right, with ankle; origin = ground under the ankle.
function shoe() {
  return part(36, 40, 12, 36, [
    [capsule(0, -30, 1, -8, 4.2), lit(R.skin, 0.5, 0.35), R.outlineSkin],
    [capsule(1, -10, 9, -7, 3), lit(R.skin, 0.6, 0.35), R.outlineSkin],
    [(x, y) => polySd([[-7, -1], [-7.5, -7], [-3.5, -9], [5, -7.5], [12, -6], [17, -3.5], [17.5, -0.5], [15, 1], [-5, 1]], x, y) - 0.6,
      lit(R.black, 0.3, 0.7, (x, y) => (y > -1.5 ? -0.15 : 0)), R.outlineChair],
  ]);
}
// Bandaged foot (the injured one): bulky cream wrap with diagonal turns, toes peeking.
function footWrap() {
  const turns = (x, y) => (((x * 0.45 + y + 40) % 5) < 1.4 ? -0.28 : 0);
  return part(38, 42, 13, 37, [
    [capsule(19, -4, 20, -3, 2.4), lit(R.skin, 0.62, 0.3), R.outlineSkin],
    [capsule(0, -31, 1, -9, 5.4), lit(R.bandage, 0.55, 0.35, turns), R.outlineDress],
    [(x, y) => polySd([[-7, -1], [-8, -9], [-3, -12], [6, -10], [13, -8], [18, -5], [18.5, -1], [15, 1], [-5, 1]], x, y) - 1,
      lit(R.bandage, 0.6, 0.35, turns), R.outlineDress],
  ]);
}
// Forearm crutch, like the wheelchair's tubes: origin = handle grip; shaft hangs straight down CRUTCH_LEN to the tip.
const CRUTCH_LEN = 112;
function crutch() {
  const L = CRUTCH_LEN, holes = (x, y) => (Math.abs(x - 0.5) < 1.2 && y > L - 46 && y < L - 16 && ((y - L) % 7 + 7) % 7 < 1.8 ? 0.5 : 0);
  return part(44, L + 44, 20, 36, [
    [capsule(0, 1, 0, L - 7, 3.1), lit(R.black, 0.4, 0.75, holes), R.outlineChair],
    [capsule(0, L - 10, 0, L - 3.5, 4.2), lit(R.black, 0.16, 0.35), R.outlineChair],
    [capsule(-2, 0, 11, 0.6, 3), lit(R.black, 0.26, 0.5), R.outlineChair],
  ]);
}
// The crutch's forearm cuff, drawn over her forearm (c_upper) so it hugs the arm whatever angle the shaft swings to:
// rod along the underside of the forearm from the grip, band round it below the elbow. Origin = grip.
function cuff() {
  return part(40, 40, 30, 30, [
    [capsule(-2.4, 1.8, -12, -11, 1.9), lit(R.black, 0.4, 0.6), R.outlineChair],
    [capsule(-15.5, -8.7, -5, -17.5, 3.2), lit(R.black, 0.35, 0.7), R.outlineChair],
  ]);
}
// ---------- atlas ----------
const SKIRT_STEPS = [-16, -8, 0, 8, 16];
const parts = {};
for (const [name, src] of Object.entries(STYLE.uppers)) parts[name] = { im: cutUpper(src), ox: src.hip[0], oy: src.hip[1] };
for (const hf of SKIRT_STEPS) for (const hb of SKIRT_STEPS) {
  parts[`skirt_${hf}_${hb}`] = { im: skirt(hf, hb), ox: SKIRT.ox, oy: SKIRT.oy };
  parts[`skirtup_${hf}_${hb}`] = { im: skirt(hf, hb, 26), ox: SKIRT.ox, oy: SKIRT.oy };
}
Object.assign(parts, { shoe: shoe(), foot_wrap: footWrap(), crutch: crutch(), cuff: cuff() });

/** Crop to the opaque bounds (keeps the origin) so the atlas stays small. */
function trim(p) {
  let x0 = p.im.w, y0 = p.im.h, x1 = -1, y1 = -1;
  for (let y = 0; y < p.im.h; y++) for (let x = 0; x < p.im.w; x++) if (get(p.im, x, y)[3] > 0.004) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const im = img(x1 - x0 + 1, y1 - y0 + 1);
  over(im, p.im, -x0, -y0);
  return { im, ox: p.ox - x0, oy: p.oy - y0 };
}
const ATLAS_W = 2048, PAD = 2;
const list = Object.entries(parts).map(([name, p]) => ({ name, ...trim(p) })).sort((a, b) => b.im.h - a.im.h);
let px = PAD, py = PAD, shelf = 0;
for (const s of list) {
  if (px + s.im.w + PAD > ATLAS_W) { px = PAD; py += shelf + PAD; shelf = 0; }
  s.x = px; s.y = py; px += s.im.w + PAD; shelf = Math.max(shelf, s.im.h);
}
const atlas = img(ATLAS_W, py + shelf + PAD), frames = {};
for (const s of list) {
  over(atlas, s.im, s.x, s.y);
  frames[s.name] = {
    frame: { x: s.x, y: s.y, w: s.im.w, h: s.im.h }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: s.im.w, h: s.im.h }, sourceSize: { w: s.im.w, h: s.im.h },
    anchor: { x: s.ox / s.im.w, y: s.oy / s.im.h }, // Phaser reads this as the frame origin
  };
}
const toPng = (im) => {
  const png = new PNG({ width: im.w, height: im.h });
  for (let i = 0; i < im.w * im.h; i++) png.data.set([0, 1, 2].map((k) => Math.round(im.d[i * 4 + k])).concat(Math.round(im.d[i * 4 + 3] * 255)), i * 4);
  return png;
};
fs.writeFileSync('public/art/kits.png', PNG.sync.write(toPng(atlas)));
fs.writeFileSync('public/art/kits.json', JSON.stringify({
  frames, meta: { image: 'kits.png', size: { w: atlas.w, h: atlas.h }, scale: '1', source: `${SHEET} + scripts/bake-kits.mjs` },
}, null, 1));
console.log(`${list.length} frames → public/art/kits.png (${atlas.w}x${atlas.h}) + kits.json`);

// ---------- debug: uppers on a skirt + small parts, ×3 ----------
fs.mkdirSync(DBG, { recursive: true });
const dbg = img(330, 250);
[['c_upper', 60], ['s_upper', 170]].forEach(([n, x]) => {
  const u = parts[n], sk = parts.skirt_0_0;
  over(dbg, sk.im, x - sk.ox, 120 - sk.oy); over(dbg, u.im, x - u.ox, 120 - u.oy);
});
over(dbg, parts.shoe.im, 220, 200); over(dbg, parts.foot_wrap.im, 260, 200); over(dbg, parts.crutch.im, 290, 0);
const big = img(dbg.w * 3, dbg.h * 3);
for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) put(big, x, y, mix([141, 149, 143], get(dbg, (x / 3) | 0, (y / 3) | 0), get(dbg, (x / 3) | 0, (y / 3) | 0)[3]), 1);
fs.writeFileSync(`${DBG}/dbg_parts.png`, PNG.sync.write(toPng(big)));

// ---------- stills for the UI + review strips (kits.html in headless Chromium) ----------
const KITS = ['crutches', 'standing'];
const server = await createServer({ logLevel: 'error', server: { port: 5186, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const open = async (qs) => {
    await page.goto(`http://localhost:5186/kits.html${qs}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 20000 });
    await page.waitForTimeout(200);
  };
  for (const kit of KITS) {
    await open(`?still=${kit}`);
    const shot = PNG.sync.read(await page.locator('canvas').screenshot({ omitBackground: true }));
    if (shot.data[3] !== 0) throw new Error(`rafakit_${kit}: still background is not transparent`);
    fs.writeFileSync(`public/art/ui/rafakit_${kit}.png`, PNG.sync.write(trimPng(shot)));
  }
  await page.setViewportSize({ width: 1700, height: 1000 });
  await open('');
  const all = PNG.sync.read(await page.locator('canvas').screenshot());
  fs.writeFileSync(`${DBG}/all.png`, PNG.sync.write(all));
  const rows = ['idle', 'move', 'jump', 'fall', 'land', 'gelol', 'death'];
  KITS.forEach((kit, k) => rows.forEach((state, r) => {
    const strip = new PNG({ width: all.width, height: 300 });
    PNG.bitblt(all, strip, 0, (k * rows.length + r) * 300, all.width, 300, 0, 0);
    fs.writeFileSync(`${DBG}/${kit}_${state}.png`, PNG.sync.write(strip));
  }));
  // Real-time check: 60 fps frames of one beat at the level's tempo, ground marks moving with the world.
  for (const [kit, bpm] of [['crutches', 132], ['standing', 120]]) {
    await open(`?live=${kit}&bpm=${bpm}`);
    const n = Math.round((60 * 60) / bpm), film = new PNG({ width: 300 * Math.ceil(n / 2), height: 640 });
    for (let i = 0; i < n; i++) {
      await page.evaluate((b) => { window.kitBeat = b; }, 8 + i / n);
      await page.waitForTimeout(40);
      const f = PNG.sync.read(await page.locator('canvas').screenshot({ clip: { x: 80, y: 0, width: 300, height: 320 } }));
      PNG.bitblt(f, film, 0, 0, 300, 320, (i % Math.ceil(n / 2)) * 300, i < n / 2 ? 0 : 320);
    }
    fs.writeFileSync(`${DBG}/film_${kit}_${bpm}bpm.png`, PNG.sync.write(film));
  }
  console.log(`stills → public/art/ui/rafakit_*.png, strips + films → ${DBG}/`);
} finally {
  await browser.close();
  await server.close();
}

function trimPng(p) {
  let x0 = p.width, y0 = p.height, x1 = -1, y1 = -1;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3] > 0) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const o = new PNG({ width: x1 - x0 + 3, height: y1 - y0 + 3 });
  PNG.bitblt(p, o, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 1, 1);
  return o;
}
