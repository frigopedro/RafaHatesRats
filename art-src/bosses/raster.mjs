// Tiny pixel-art renderer for the drawn bosses. Shapes go into a G-buffer (material, light, depth, group), then
// resolve() turns light into palette-ramp tones (sparse 2×2 dither at the band edges), draws a dark contour wherever a
// part passes in front of another group, and finish() adds the outer outline and trims. Coordinates are art pixels
// relative to the sprite's ground-contact point (x right, y down, ground at y = 0).
import fs from 'node:fs';

const pal = JSON.parse(fs.readFileSync(new URL('../palette.json', import.meta.url), 'utf8'));
export const RAMPS = { ...pal.sheet, ...pal.accent };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const RGB = Object.fromEntries(Object.entries(RAMPS).map(([k, r]) => [k, r.map(rgb)]));
export const OUT = 'outline';
RGB[OUT] = [rgb(pal.outline)];
// A ramp stitched from existing palette entries (e.g. white with grey shadows so a white gown keeps firm darks on
// pale stone). Still palette colours only.
export const defineRamp = (name, refs) => { RGB[name] = refs.map(([r, i]) => RGB[r][i]); };

export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1]) || 1));
export const lerp = (a, b, t) => add(a, mul(sub(b, a), t));


// 3×5 pixel font, rows top→bottom as bit masks, 3 wide unless the glyph has .w (review labels and in-art lettering).
export const FONT = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: Object.assign([17, 27, 21, 17, 17], { w: 5 }), N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 1, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
  _: [0, 0, 0, 0, 7], ' ': [0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 2], ':': [0, 2, 0, 2, 0], '×': [0, 5, 2, 5, 0],
};

// Calls px(x, y) for every lit pixel of str set at (x, y), one column of space between glyphs.
export function glyphs(str, x, y, px) {
  for (const ch of str) {
    const g = FONT[ch] ?? FONT[' '], w = g.w ?? 3;
    g.forEach((row, r) => { for (let b = 0; b < w; b++) if (row & (1 << (w - 1 - b))) px(x + b, y + r); });
    x += w + 1;
  }
}

const nrm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const LIGHT = nrm([-0.55, -0.7, 0.55]); // upper-left-front: the side facing Rafa is lit
const BAYER = [0, 2, 3, 1];
// Band edges per ramp length: most of a lit surface sits on the second-brightest tone, the top tone is a highlight.
const BANDS = { 1: [], 2: [0.45], 3: [0.36, 0.84], 4: [0.2, 0.5, 0.86], 5: [0.16, 0.38, 0.62, 0.88],
  6: [0.12, 0.3, 0.48, 0.68, 0.9], 7: [0.1, 0.25, 0.4, 0.56, 0.72, 0.9] };

const lerpArr = (r, t) => {
  if (typeof r === 'number') return r;
  const f = t * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f));
  return r[i] + (r[i + 1] - r[i]) * (f - i);
};

export class Sprite {
  // k scales every shape and painted detail (pose coords stay the same); clipY hides anything at or below that y.
  constructor({ w = 240, h = 220, ox = 120, oy = 200, k = 1, clipY = Infinity } = {}) {
    Object.assign(this, { w, h, ox, oy, k, clipY });
    const n = w * h;
    this.mat = new Array(n).fill(null);
    this.grp = new Array(n).fill(null);
    this.z = new Float32Array(n).fill(-1e9);
    this.lit = new Float32Array(n);
    this.dim = new Float32Array(n);
    this.tex = new Int8Array(n);
    this.flat = new Int8Array(n).fill(-1);
    this.idx = new Int8Array(n);
  }

  at(x, y) { return this.atc(Math.floor(x * this.k), Math.floor(y * this.k)); }
  atc(x, y) {
    if (y >= this.clipY) return -1;
    const cx = x + this.ox, cy = y + this.oy;
    return cx < 0 || cy < 0 || cx >= this.w || cy >= this.h ? -1 : cy * this.w + cx;
  }

  // fn(px, py) → null | { nx, ny, nz, u, v } at pixel centres. o: { m, z, g, dim, i (flat tone), tex(u,v,x,y), mf(u,v,x,y) }
  fill(x0, y0, x1, y1, o, fn) {
    const k = this.k;
    for (let y = Math.floor(y0 * k) - 1; y <= Math.ceil(y1 * k); y++) for (let x = Math.floor(x0 * k) - 1; x <= Math.ceil(x1 * k); x++) {
      const i = this.atc(x, y);
      if (i < 0) continue;
      const r = fn((x + 0.5) / k, (y + 0.5) / k);
      if (!r) continue;
      const z = (o.z ?? 0) + r.nz * 0.05; // within a group the nearer surface wins, so joints blend
      if (z < this.z[i]) continue;
      const m = o.mf?.(r.u, r.v, x / k, y / k) ?? o.m;
      if (m === undefined) continue;
      this.z[i] = z;
      this.mat[i] = m;
      this.grp[i] = o.g ?? o.m;
      this.lit[i] = r.nx * LIGHT[0] + r.ny * LIGHT[1] + r.nz * LIGHT[2] + (o.lift ?? 0);
      this.dim[i] = o.dim ?? 0;
      this.tex[i] = o.tex?.(r.u, r.v, x / k, y / k) ?? 0;
      this.flat[i] = o.i ?? -1;
    }
    return this;
  }

  // Tapered capsule a→b; r = radius or list of radii along the axis. u = px along the axis, v = −1..1 across (v < 0 is left of a→b... i.e. screen-left for an upward axis).
  cap(a, b, r, o) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-6, len = Math.sqrt(L2);
    const rm = typeof r === 'number' ? r : Math.max(...r);
    return this.fill(Math.min(a[0], b[0]) - rm, Math.min(a[1], b[1]) - rm, Math.max(a[0], b[0]) + rm, Math.max(a[1], b[1]) + rm, o, (px, py) => {
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2));
      const rr = lerpArr(r, t), ex = px - a[0] - t * dx, ey = py - a[1] - t * dy, d2 = ex * ex + ey * ey;
      if (d2 > rr * rr) return null;
      const nx = ex / rr, ny = ey / rr;
      return { nx, ny, nz: Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), u: t * len, v: (dx * ey - dy * ex) / len / rr };
    });
  }

  // Chain of capsules through points with a radius per point (one smooth limb).
  chain(pts, radii, o) {
    for (let k = 0; k < pts.length - 1; k++) this.cap(pts[k], pts[k + 1], [radii[k], radii[k + 1]], o);
    return this;
  }

  ell(c, rx, ry, o, ang = 0) {
    const cs = Math.cos(ang), sn = Math.sin(ang), rm = Math.max(rx, ry);
    return this.fill(c[0] - rm, c[1] - rm, c[0] + rm, c[1] + rm, o, (px, py) => {
      const ex = px - c[0], ey = py - c[1];
      const qx = (ex * cs + ey * sn) / rx, qy = (-ex * sn + ey * cs) / ry, q2 = qx * qx + qy * qy;
      if (q2 > 1) return null;
      return { nx: qx * cs - qy * sn, ny: qx * sn + qy * cs, nz: Math.sqrt(1 - q2), u: qx, v: qy };
    });
  }

  // Filled polygon with a fixed normal (default facing the viewer).
  poly(pts, o, n = [0, 0, 1]) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return this.fill(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), o, (px, py) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside ? { nx: n[0], ny: n[1], nz: n[2], u: px, v: py } : null;
    });
  }

  rect(x, y, w, h, o, n) { return this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o, n); }

  resolve() {
    const { w, h } = this;
    for (let i = 0; i < w * h; i++) {
      const m = this.mat[i];
      if (m === null || m === OUT) continue;
      const n = RGB[m].length;
      if (this.flat[i] >= 0) { this.idx[i] = Math.min(n - 1, this.flat[i] + this.tex[i]); continue; }
      const x = i % w, y = (i - x) / w;
      let v = (this.lit[i] + 0.35) / 1.3 - 0.24 * this.dim[i] + (BAYER[(y & 1) * 2 + (x & 1)] / 4 - 0.375) * 0.09;
      let k = 0;
      for (const b of BANDS[n]) if (v > b) k++;
      if (this.tex[i] && k > 0) k = Math.max(0, Math.min(n - 1, k + this.tex[i]));
      this.idx[i] = k;
    }
    // Contour: a pixel touching a nearer part of another group becomes outline.
    const out = [];
    for (let i = 0; i < w * h; i++) {
      if (this.mat[i] === null) continue;
      const x = i % w;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || (j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        if (this.mat[j] !== null && this.grp[j] !== this.grp[i] && this.z[j] > this.z[i] + 0.3) { out.push(i); break; }
      }
    }
    for (const i of out) this.mat[i] = OUT;
    return this;
  }

  // ---- detail painting (after resolve) ----
  set(x, y, m, k = 0) { const i = this.at(x, y); if (i >= 0) { this.mat[i] = m; this.idx[i] = k; } return this; }
  // Canvas-pixel variant (for lettering that must not be rescaled by k).
  setc(cx, cy, m, k = 0) { const i = this.atc(cx, cy); if (i >= 0) { this.mat[i] = m; this.idx[i] = k; } return this; }
  get(x, y) { const i = this.at(x, y); return i < 0 ? null : this.mat[i]; }
  // Shift the tone of an already-painted pixel (d < 0 darker).
  shade(x, y, d) {
    const i = this.at(x, y);
    if (i < 0 || this.mat[i] === null || this.mat[i] === OUT) return this;
    this.idx[i] = Math.max(0, Math.min(RGB[this.mat[i]].length - 1, this.idx[i] + d));
    return this;
  }
  // Bresenham in canvas pixels; fn gets pose coords back.
  line(a, b, fn) {
    const k = this.k;
    let x0 = Math.floor(a[0] * k), y0 = Math.floor(a[1] * k);
    const x1 = Math.floor(b[0] * k), y1 = Math.floor(b[1] * k);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      fn((x0 + 0.5) / k, (y0 + 0.5) / k);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  stroke(pts, m, k = 0) { for (let i = 0; i < pts.length - 1; i++) this.line(pts[i], pts[i + 1], (x, y) => this.set(x, y, m, k)); return this; }
  dstroke(pts, d = -1) { for (let i = 0; i < pts.length - 1; i++) this.line(pts[i], pts[i + 1], (x, y) => this.shade(x, y, d)); return this; }
  // Painted disc/ellipse (flat tone), for eyes, bolts, bulbs.
  dot(c, rx, ry, m, tone = 0, onlyOpaque = false) {
    const k = this.k, cx = c[0] * k, cy = c[1] * k, Rx = rx * k, Ry = ry * k;
    for (let y = Math.floor(cy - Ry) - 1; y <= cy + Ry + 1; y++) for (let x = Math.floor(cx - Rx) - 1; x <= cx + Rx + 1; x++) {
      const ex = (x + 0.5 - cx) / Rx, ey = (y + 0.5 - cy) / Ry, i = this.atc(x, y);
      if (i >= 0 && ex * ex + ey * ey <= 1 && (!onlyOpaque || this.mat[i] !== null)) { this.mat[i] = m; this.idx[i] = tone; }
    }
    return this;
  }

  // Pixels painted after the outer outline (thin lines that stand alone, e.g. whiskers).
  late(x, y, m, k = 0) { (this.lateList ??= []).push([this.at(x, y), m, k]); return this; }
  lateLine(a, b, m, k = 0) { return this.line(a, b, (x, y) => this.late(x, y, m, k)); }

  // Outer outline, trim, RGBA. Pivot = the ground-contact origin, or `pivot` [x, y] in sprite coords.
  finish(pivot = [0, 0]) {
    const { w, h } = this;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && this.mat[y * w + x] !== null;
    const edge = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push(y * w + x);
    for (const i of edge) this.mat[i] = OUT;
    for (const [i, m, k] of this.lateList ?? []) if (i >= 0) { this.mat[i] = m; this.idx[i] = k; }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let i = 0; i < w * h; i++) if (this.mat[i] !== null) {
      const x = i % w, y = (i - x) / w;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, data = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y + y0) * w + x + x0, m = this.mat[i];
      if (m === null) continue;
      const c = RGB[m][m === OUT ? 0 : this.idx[i]], o = (y * W + x) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    return { w: W, h: H, data, ax: Math.round(this.ox + pivot[0] * this.k - x0), ay: Math.round(this.oy + pivot[1] * this.k - y0) };
  }
}
