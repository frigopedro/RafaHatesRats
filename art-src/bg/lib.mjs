// Tiny raster kit for the code-drawn backgrounds: RGBA canvases at 1 art px, ordered dithering, a 5×7 sign font.
// A canvas made with { wrap: true } wraps x, so anything drawn across its edge continues on the other side and every
// tile is seamless by construction.
import fs from 'node:fs';
import { PNG } from 'pngjs';

const pal = JSON.parse(fs.readFileSync(new URL('../palette.json', import.meta.url)));
const extra = JSON.parse(fs.readFileSync(new URL('./ramps.json', import.meta.url)));
export const OUTLINE = pal.outline;
/** Ramp by name: palette.json sheet/accent ramps first, then this lane's extra ramps (ramps.json). */
export const R = { ...pal.sheet, ...pal.accent, ...extra };

const cache = new Map();
export function rgba(c) {
  if (Array.isArray(c)) return c;
  let v = cache.get(c);
  if (!v) {
    const a = c.length > 7 ? parseInt(c.slice(7, 9), 16) : 255;
    v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), a];
    cache.set(c, v);
  }
  return v;
}

export function canvas(w, h, wrap = false) {
  return { w, h, wrap, d: new Uint8ClampedArray(w * h * 4) };
}

/** Plot one pixel; alpha < 1 (or a #rrggbbaa colour) blends source-over. */
export function px(c, x, y, col, alpha = 1) {
  x |= 0; y |= 0;
  if (y < 0 || y >= c.h) return;
  if (c.wrap) x = ((x % c.w) + c.w) % c.w;
  else if (x < 0 || x >= c.w) return;
  const [r, g, b, a0] = rgba(col);
  const a = (a0 / 255) * alpha, i = (y * c.w + x) * 4, d = c.d;
  if (a >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
  const da = d[i + 3] / 255, oa = a + da * (1 - a);
  if (oa <= 0) return;
  d[i] = (r * a + d[i] * da * (1 - a)) / oa;
  d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa;
  d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa;
  d[i + 3] = oa * 255;
}
export function get(c, x, y) {
  if (c.wrap) x = ((x % c.w) + c.w) % c.w;
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return [0, 0, 0, 0];
  const i = (y * c.w + x) * 4;
  return [c.d[i], c.d[i + 1], c.d[i + 2], c.d[i + 3]];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold in (0,1) for pixel (x, y). */
export const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

export function rect(c, x, y, w, h, col, alpha) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(c, i, j, col, alpha);
}
/** Paint `col` over a fraction `k` (0..1) of the pixels, Bayer-ordered. */
export function dith(c, x, y, w, h, col, k) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (bayer(i, j) < k) px(c, i, j, col);
}
/** Dithered gradient through a list of colours, top→bottom (or left→right with horiz). */
export function grad(c, x, y, w, h, cols, horiz = false) {
  const n = horiz ? w : h;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const f = (n > 1 ? (horiz ? i : j) / (n - 1) : 0) * (cols.length - 1);
    const k = Math.min(cols.length - 2, Math.floor(f));
    px(c, x + i, y + j, bayer(x + i, y + j) < f - k ? cols[k + 1] : cols[k]);
  }
}
export function line(c, x0, y0, x1, y1, col, alpha) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    px(c, x0, y0, col, alpha);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
export function ellipse(c, cx, cy, rx, ry, col, alpha) {
  for (let j = Math.floor(-ry); j <= ry; j++) for (let i = Math.floor(-rx); i <= rx; i++)
    if ((i * i) / (rx * rx + 0.3) + (j * j) / (ry * ry + 0.3) <= 1) px(c, cx + i, cy + j, col, alpha);
}
/** Dithered radial glow: coverage falls off as (1 - d/r)^p. */
export function glow(c, cx, cy, rx, ry, col, k = 1, p = 2) {
  for (let j = Math.floor(-ry); j <= ry; j++) for (let i = Math.floor(-rx); i <= rx; i++) {
    const d = Math.sqrt((i * i) / (rx * rx) + (j * j) / (ry * ry));
    if (d < 1 && bayer(cx + i, cy + j) < k * (1 - d) ** p) px(c, cx + i, cy + j, col);
  }
}
/** 1-px outline around every opaque pixel (for sprites). */
export function outline(c, col = OUTLINE) {
  const a = (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && c.d[(y * c.w + x) * 4 + 3] > 0;
  const add = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++)
    if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) add.push(x, y);
  for (let i = 0; i < add.length; i += 2) px(c, add[i], add[i + 1], col);
  return c;
}
export function blit(dst, src, x, y, alpha = 1) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const k = (j * src.w + i) * 4;
    if (src.d[k + 3]) px(dst, x + i, y + j, [src.d[k], src.d[k + 1], src.d[k + 2], src.d[k + 3]], alpha);
  }
}
export function crop(src, x, y, w, h) {
  const c = canvas(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = get(src, x + i, y + j);
    if (v[3]) px(c, i, j, v);
  }
  return c;
}
export function scale(src, k) {
  const c = canvas(Math.round(src.w * k), Math.round(src.h * k)); // k may be fractional (nearest)
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const s = (((y / k) | 0) * src.w + ((x / k) | 0)) * 4, d = (y * c.w + x) * 4;
    c.d[d] = src.d[s]; c.d[d + 1] = src.d[s + 1]; c.d[d + 2] = src.d[s + 2]; c.d[d + 3] = src.d[s + 3];
  }
  return c;
}
export function save(c, file) {
  const png = new PNG({ width: c.w, height: c.h });
  png.data = Buffer.from(c.d.buffer, c.d.byteOffset, c.d.length);
  fs.writeFileSync(file, PNG.sync.write(png));
}
export function load(file) {
  const p = PNG.sync.read(fs.readFileSync(file));
  return { w: p.width, h: p.height, wrap: false, d: new Uint8ClampedArray(p.data) };
}
/** Deterministic PRNG (mulberry32) so every bake is identical. */
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 5×7 caps font for signs. Accents sit in 2 rows above the cap height, the cedilla below the baseline.
const G = { // 7 rows of 5, space-separated
  A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.', C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.', E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .###.', H: '#...# #...# #...# ##### #...# #...# #...#', I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. #..#. #..#. .##..', K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# ##..# #.#.# #..## #...# #...# #...#', O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....', Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..', U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..', W: '#...# #...# #...# #.#.# #.#.# ##.## #...#', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.', 2: '.###. #...# ....# ...#. ..#.. .#... #####',
  3: '####. ....# ....# .###. ....# ....# ####.', 4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
  6: '.###. #.... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. ..#.. ..#.. ..#..', 8: '.###. #...# #...# .###. #...# #...# .###.',
  9: '.###. #...# #...# .#### ....# ....# .###.', '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  '&': '.##.. #..#. .##.. .#... #.#.# #..#. .##.#', '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
};
const NARROW = { '.': ['.', '.', '.', '.', '.', '.', '#'], ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'], ':': ['.', '#', '.', '.', '.', '#', '.'], '-': ['...', '...', '...', '###', '...', '...', '...'] };
const ACC = { 'É': ['E', ['...#.', '..#..']], 'Í': ['I', ['...#.', '..#..']], 'Á': ['A', ['...#.', '..#..']], 'Ú': ['U', ['...#.', '..#..']], 'Ó': ['O', ['...#.', '..#..']],
  'Ã': ['A', ['.##.#', '#..#.']], 'Õ': ['O', ['.##.#', '#..#.']], 'Ê': ['E', ['..#..', '.#.#.']], 'Ç': ['C', null] };

function glyph(ch) {
  if (NARROW[ch]) return { rows: NARROW[ch], w: NARROW[ch][0].length };
  if (ch === ' ') return { rows: [], w: 3 };
  const [base, acc] = ACC[ch] ?? [ch, null];
  const s = G[base];
  if (s === undefined) throw new Error(`no glyph for ${JSON.stringify(ch)}`);
  const rows = s.split(' ');
  if (rows.length !== 7 || rows.some((r) => r.length !== 5)) throw new Error(`bad glyph ${base}`);
  return { rows, w: 5, acc, ced: ch === 'Ç' };
}
/** Width of a string in art px at pixel size k (bold adds one column per glyph). */
export function textW(str, k = 1, bold = false) {
  let w = 0;
  for (const ch of str) w += (glyph(ch).w + 1 + (bold ? 1 : 0)) * k;
  return w - k;
}
/** Draw text with its cap top at y. Returns the width. */
export function text(c, str, x, y, col, { k = 1, bold = false } = {}) {
  let cx = x;
  const dot = (gx, gy) => { for (let b = 0; b <= (bold ? 1 : 0); b++) rect(c, cx + (gx + b) * k, y + gy * k, k, k, col); };
  for (const ch of str) {
    const g = glyph(ch);
    g.rows.forEach((row, r) => [...row].forEach((v, i) => v === '#' && dot(i, r)));
    g.acc?.forEach((row, r) => [...row].forEach((v, i) => v === '#' && dot(i, r - 2)));
    if (g.ced) { dot(2, 7); dot(1, 8); }
    cx += (g.w + 1 + (bold ? 1 : 0)) * k;
  }
  return cx - x - k;
}
/** Text with per-pixel shading: `hi` on pixels with nothing above, `lo` on pixels with nothing below, `sh` drop shadow (+1,+1). */
export function textFx(c, str, x, y, { k = 1, bold = false, col, hi = col, lo = col, sh = null }) {
  const t = canvas(textW(str, k, bold) + 2, 10 * k + 2);
  text(t, str, 1, 2 * k + 1, '#ffffff', { k, bold });
  const on = (i, j) => i >= 0 && j >= 0 && i < t.w && j < t.h && t.d[(j * t.w + i) * 4 + 3] > 0;
  for (let j = 0; j < t.h; j++) for (let i = 0; i < t.w; i++) {
    if (sh && !on(i, j) && on(i - 1, j - 1)) px(c, x + i - 1, y + j - 2 * k - 1, sh);
    if (on(i, j)) px(c, x + i - 1, y + j - 2 * k - 1, !on(i, j - 1) ? hi : !on(i, j + 1) ? lo : col);
  }
}
/** Blend two colours (t = 0 → a, 1 → b) into a hex string. */
export function mix(a, b, t) {
  const x = rgba(a), y = rgba(b);
  return '#' + [0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0')).join('');
}

/** Neon tube text: the 5×7 font doubled into 2-px tubes, with an optional 1-px bright core. Returns the width. */
export function neonText(c, str, x, y, tube, core) {
  const t = canvas(textW(str) + 2, 9);
  text(t, str, 0, 2, '#ffffff');
  const on = (i, j) => t.d[(j * t.w + i) * 4 + 3] > 0;
  for (let j = 0; j < t.h; j++) for (let i = 0; i < t.w; i++) if (on(i, j)) {
    rect(c, x + i * 2, y + j * 2, 2, 2, tube);
    if (core) {
      px(c, x + i * 2, y + j * 2, core);
      if (on(i + 1, j)) px(c, x + i * 2 + 1, y + j * 2, core);
      if (on(i, j + 1)) px(c, x + i * 2, y + j * 2 + 1, core);
    }
  }
  return t.w * 2;
}

/** Atmospheric perspective so background props never read as hazards: every pixel becomes one of three close tones
 *  by value ([dark, mid, top-light edge]; no black, no outline), and the bottom `fade` px dither away. */
export function haze(c, [t0, t1, t2], fade = 11) {
  const a = (x, y) => y >= 0 && c.d[(y * c.w + (((x % c.w) + c.w) % c.w)) * 4 + 3] > 0, out = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (!a(x, y)) continue;
    const i = (y * c.w + x) * 4, lum = 0.3 * c.d[i] + 0.59 * c.d[i + 1] + 0.11 * c.d[i + 2];
    const f = (y - (c.h - fade)) / fade;
    out.push(x, y, f > 0 && bayer(x, y) < f ? null : !a(x, y - 1) ? t2 : lum < 50 ? t0 : t1);
  }
  c.d.fill(0);
  for (let k = 0; k < out.length; k += 3) if (out[k + 2]) px(c, out[k], out[k + 1], out[k + 2]);
  return c;
}
