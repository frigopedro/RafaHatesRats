// Tiny pixel-art kit for the props atlas: a canvas of RGBA pixels, shape fills whose paint can be a colour or a
// function of the pixel (for shading), per-part layers with their own outline, a 3×5 font. 32 art px = 1 block.
import fs from 'node:fs';

const pal = JSON.parse(fs.readFileSync(new URL('../palette.json', import.meta.url)));
export const OUT = pal.outline;
export const P = { ...pal.sheet, ...pal.accent };
// Ramps the palette lacks, kept here per the palette owner's rule (reported upstream).
P.wood = ['#5a3418', '#8a5a2c', '#b8823e', '#e0b060'];
P.rubber = ['#16151b', '#24232b', '#34333d', '#4d4c58'];
P.glass = ['#2a6aa8', '#4a9ae0', '#8cd0ff', '#e8f8ff'];

const cache = new Map();
export function rgba(c) {
  let v = cache.get(c);
  if (!v) {
    const n = c.length === 9 ? c.slice(1) : c.slice(1) + 'ff';
    v = [0, 2, 4, 6].map((i) => parseInt(n.slice(i, i + 2), 16));
    cache.set(c, v);
  }
  return v;
}

/** Ramp tone for t ∈ 0..1, with a narrow checkerboard dither band at each step (d = band half-width). */
export function tone(ramp, t, x, y, d = 0.12) {
  const q = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  let i = Math.floor(q);
  const f = q - i;
  if (f > 0.5 + d || (f > 0.5 - d && (x + y) % 2)) i++;
  return ramp[Math.min(i, ramp.length - 1)];
}

// Light from upper-left-front. Returns brightness 0..1 for a surface normal.
const L = (() => { const v = [-0.45, -0.6, 0.66]; const m = Math.hypot(...v); return v.map((k) => k / m); })();
export const lit = (nx, ny, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))) =>
  Math.max(0, Math.min(1, 0.2 + 0.85 * (nx * L[0] + ny * L[1] + nz * L[2])));

// Paint makers: (x, y, o) => colour, where o = { u, v } (0..1 in the shape's box) and { nx, ny } (−1..1 from centre).
export const sphere = (r, d) => (x, y, o) => tone(r, lit(o.nx, o.ny), x, y, d);
export const cylV = (r, d, k = 0) => (x, y, o) => tone(r, lit(o.nx, 0) - k * o.v, x, y, d); // vertical axis
export const cylH = (r, d) => (x, y, o) => tone(r, lit(0, o.ny), x, y, d); // horizontal axis
export const vgrad = (r, d, a = 1, b = 0) => (x, y, o) => tone(r, a + (b - a) * o.v, x, y, d);
export const hgrad = (r, d, a = 1, b = 0) => (x, y, o) => tone(r, a + (b - a) * o.u, x, y, d);

export class Cv {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  layer() { return new Cv(this.w, this.h); }
  a(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.d.set(rgba(c), (y * this.w + x) * 4);
    return this;
  }
  get(x, y) {
    if (!this.a(x, y)) return null;
    const i = (y * this.w + x) * 4;
    return '#' + [0, 1, 2].map((k) => this.d[i + k].toString(16).padStart(2, '0')).join('');
  }
  clear(x, y) { if (this.a(x, y)) this.d.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4); return this; }
  // Generic fill over a bbox; `inside(px, py)` gets pixel centres.
  fill(x0, y0, x1, y1, inside, p, info) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++)
        if (inside(x + 0.5, y + 0.5)) this.set(x, y, typeof p === 'function' ? p(x, y, info(x + 0.5, y + 0.5)) : p);
    return this;
  }
  rect(x, y, w, h, p) {
    return this.fill(x, y, x + w - 1, y + h - 1, (px, py) => px > x && px < x + w && py > y && py < y + h, p,
      (px, py) => ({ u: (px - x) / w, v: (py - y) / h, nx: (px - x) / w * 2 - 1, ny: (py - y) / h * 2 - 1 }));
  }
  ell(cx, cy, rx, ry, p) {
    return this.fill(cx - rx - 1, cy - ry - 1, cx + rx, cy + ry, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, p,
      (px, py) => ({ nx: (px - cx) / rx, ny: (py - cy) / ry, u: (px - cx + rx) / (2 * rx), v: (py - cy + ry) / (2 * ry) }));
  }
  // Rounded rect (corner radius r).
  rrect(x, y, w, h, r, p) {
    const inside = (px, py) => {
      const dx = Math.max(x + r - px, 0, px - (x + w - r)), dy = Math.max(y + r - py, 0, py - (y + h - r));
      return px > x && px < x + w && py > y && py < y + h && dx * dx + dy * dy <= r * r + 0.5;
    };
    return this.fill(x, y, x + w - 1, y + h - 1, inside, p,
      (px, py) => ({ u: (px - x) / w, v: (py - y) / h, nx: (px - x) / w * 2 - 1, ny: (py - y) / h * 2 - 1 }));
  }
  poly(pts, p) {
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const inside = (px, py) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    return this.fill(x0, y0, x1, y1, inside, p,
      (px, py) => ({ u: (px - x0) / (x1 - x0), v: (py - y0) / (y1 - y0), nx: ((px - x0) / (x1 - x0)) * 2 - 1, ny: ((py - y0) / (y1 - y0)) * 2 - 1 }));
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.set(x0, y0, typeof c === 'function' ? c(x0, y0) : c);
      if (x0 === x1 && y0 === y1) return this;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // Polyline through points.
  path(pts, c) { for (let i = 1; i < pts.length; i++) this.line(...pts[i - 1], ...pts[i], c); return this; }
  // Outer outline around everything opaque (4-neighbour; diag adds corners).
  outline(c = OUT, diag = false) {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.a(x, y)) continue;
        const n = this.a(x - 1, y) || this.a(x + 1, y) || this.a(x, y - 1) || this.a(x, y + 1) ||
          (diag && (this.a(x - 1, y - 1) || this.a(x + 1, y - 1) || this.a(x - 1, y + 1) || this.a(x + 1, y + 1)));
        if (n) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }
  // Composite another canvas over this one (alpha over).
  put(o, dx = 0, dy = 0) {
    for (let y = 0; y < o.h; y++)
      for (let x = 0; x < o.w; x++) {
        const i = (y * o.w + x) * 4, a = o.d[i + 3] / 255;
        const X = x + dx, Y = y + dy;
        if (!a || X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        const j = (Y * this.w + X) * 4, b = this.d[j + 3] / 255, oa = a + b * (1 - a);
        for (let k = 0; k < 3; k++) this.d[j + k] = (o.d[i + k] * a + this.d[j + k] * b * (1 - a)) / oa;
        this.d[j + 3] = oa * 255;
      }
    return this;
  }
  // Draw a part on its own outlined layer, then composite: gives the cartoon line between overlapping parts.
  part(draw, c = OUT, diag = false) { const l = this.layer(); draw(l); l.outline(c, diag); return this.put(l); }
  // Recolour every pixel by f(colour, x, y) (null erases).
  map(f) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.get(x, y);
      if (!c) continue;
      const n = f(c, x, y);
      if (n === null) this.clear(x, y); else if (n !== c) this.set(x, y, n);
    }
    return this;
  }
  crop(x, y, w, h) { const o = new Cv(w, h); o.put(this, -x, -y); return o; }
  rot90() { const o = new Cv(this.h, this.w); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.d.set(this.d.subarray((y * this.w + x) * 4, (y * this.w + x) * 4 + 4), (x * o.w + (o.w - 1 - y)) * 4); return o; }
  alpha(k) { for (let i = 3; i < this.d.length; i += 4) this.d[i] *= k; return this; }
  flipX() { const o = this.layer(); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.d.set(this.d.subarray((y * this.w + x) * 4, (y * this.w + x) * 4 + 4), (y * this.w + (this.w - 1 - x)) * 4); this.d = o.d; return this; }
  // Hand-placed pixels: rows of chars, `map` char → colour.
  grid(rows, map, x = 0, y = 0) { rows.forEach((r, j) => [...r].forEach((ch, i) => map[ch] && this.set(x + i, y + j, map[ch]))); return this; }
  text(s, x, y, c) {
    for (const ch of s) {
      const g = FONT[ch];
      if (!g) throw new Error(`no glyph ${ch}`);
      g.forEach((row, j) => [...row].forEach((b, i) => b === '1' && this.set(x + i, y + j, c)));
      x += g[0].length + 1;
    }
    return this;
  }
}
export const textW = (s) => [...s].reduce((w, ch) => w + FONT[ch][0].length + 1, -1);

const FONT = {
  G: ['111', '100', '101', '101', '111'], E: ['111', '100', '110', '100', '111'], L: ['100', '100', '100', '100', '111'],
  O: ['111', '101', '101', '101', '111'], W: ['10001', '10001', '10101', '10101', '01010'], H: ['101', '101', '111', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], '!': ['1', '1', '1', '0', '1'],
  1: ['010', '110', '010', '010', '111'], 'º': ['010', '101', '010', '000', '111'],
};

export const mix = (a, b, t) => '#' + [0, 1, 2].map((i) => Math.round(rgba(a)[i] * (1 - t) + rgba(b)[i] * t).toString(16).padStart(2, '0')).join('');

/** A frame: name, size in art px, pivot ('b' bottom-centre, 'c' centre, 'tl' top-left or [x, y] px), draw(cv). */
export function spr(name, w, h, pivot, draw) { const cv = new Cv(w, h), r = draw(cv); return { name, pivot, cv: r instanceof Cv ? r : cv }; }

// Deterministic PRNG for scattered details.
export function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
