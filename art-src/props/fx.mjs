// Effects, centre pivot. White/neutral ones (dust, smash, sparkle, shield, speedline) are meant to be tinted at runtime.
import { OUT, P, Cv, spr, tone, lit, rng, mix } from './px.mjs';

const WH = ['#8a8994', '#b4b3bd', '#dedde4', '#ffffff'];
const puff = (x, y, o) => tone(WH, lit(o.nx, o.ny) + 0.1, x, y, 0.1);
const FIRE = [P.red[1], P.orange[2], P.gold[2], P.gold[3], '#ffffff'];

function star(l, cx, cy, r, ri, n, paint, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, rr = i % 2 ? ri : r; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  return l.poly(pts, paint);
}
const fireDrop = (l, cx, cy, s, k, F = FIRE) => {
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
    const dx = (x + 0.5 - cx) / s, dy = (y + 0.5 - cy) / s; // teardrop: round bottom, flickering tip
    const tip = dy < 0 ? Math.abs(dx + 0.25 * Math.sin(dy * 3 + k * 1.6) * dy) * (1.2 / (1 + dy * 0.55)) : Math.hypot(dx, dy);
    if (tip > 1 || dy < -1.6) continue;
    l.set(x, y, tone(F, 1.1 - tip * 0.9 - Math.max(0, -dy) * 0.25 + (dy > 0 ? 0 : 0.1), x, y, 0.1));
  }
};

export default [
  // Landing puff: two clouds rolling outward along the ground, thinning out.
  ...[0, 1, 2, 3].map((k) => spr(`dust_${k}`, 36, 16, 'c', (c) => {
    const s = [3.2, 4, 3.6, 2.6][k], dx = 4 + k * 4.2;
    c.part((l) => {
      for (const side of [-1, 1]) {
        l.ell(18 + side * dx, 11 - k * 0.6, s, s * 0.9, puff).ell(18 + side * (dx - s), 12.5 - k * 0.3, s * 0.7, s * 0.6, puff);
        if (k < 3) l.ell(18 + side * (dx + s * 0.9), 12 - k, s * 0.55, s * 0.5, puff);
      }
      if (k >= 2) l.map((col, x, y) => ((x * 3 + y * 5 + k) % (k === 2 ? 7 : 3) === 0 ? null : col));
    }, k >= 2 ? WH[0] : OUT);
  })),

  // Gelol smash: white star burst, then shards fly out and spin.
  ...[0, 1, 2, 3, 4].map((k) => spr(`smash_${k}`, 44, 44, 'c', (c) => {
    const r = rng(5);
    const shards = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + r() * 0.5; return [a, 0.7 + r() * 0.5, r() * 6]; });
    if (k <= 2) c.part((l) => star(l, 22, 22, [9, 15, 11][k], [4, 5, 3][k], 4, (x, y, o) => (Math.hypot(o.nx, o.ny) < 0.35 ? '#ffffff' : WH[2]), Math.PI / 4 * k));
    if (k <= 1) c.part((l) => star(l, 22, 22, [5, 8][k], [2, 3][k], 4, '#ffffff', 0));
    if (k >= 1) for (const [a, sp, rot] of shards) {
      const d = (4 + k * 4.5) * sp, x = 22 + Math.cos(a) * d, y = 22 + Math.sin(a) * d + k * k * 0.4, z = k === 4 ? 1.5 : 2.4;
      c.part((l) => l.poly([0, 1, 2].map((j) => [x + z * Math.cos(rot + k + j * 2.3), y + z * Math.sin(rot + k + j * 2.3)]), (px, py, o) => (o.v < 0.5 ? '#ffffff' : WH[1])));
    }
  })),

  ...[0, 1, 2, 3].map((k) => spr(`sparkle_${k}`, 24, 24, 'c', (c) => {
    const s = [5, 10, 8, 4][k];
    c.part((l) => {
      star(l, 12, 12, s, s * 0.22, 4, (x, y, o) => (Math.hypot(o.nx, o.ny) < 0.3 ? '#ffffff' : WH[2]), -Math.PI / 2);
      if (k >= 1) for (const [x, y] of [[4, 5], [19, 6], [6, 19], [18, 18]].slice(0, k + 1)) l.set(x, y, '#ffffff').set(x + 1, y, WH[2]).set(x, y + 1, WH[2]);
    }, WH[0]);
  })),

  // Gelol trail flame particle (coloured, not tinted).
  ...[0, 1, 2, 3].map((k) => spr(`fire_${k}`, 16, 22, 'c', (c) => c.part((l) => fireDrop(l, 8, 15, [5.5, 5, 5.8, 5.2][k], k), P.red[0]))),
  spr('ember', 5, 5, 'c', (c) => c.part((l) => l.rect(1, 1, 3, 3, P.orange[2]).set(2, 2, P.gold[3]).set(1, 1, P.gold[2]), P.red[1])),

  // Whey bubble: thin bright ring, faint fill, glossy highlight arcs (white, for tinting).
  spr('shield', 80, 80, 'c', (c) => bubble(c, 0)),
  ...[0, 1, 2].map((k) => spr(`shield_break_${k}`, 88, 88, 'c', (c) => bubble(c, k + 1))),

  // Landing warning shadow: a dark core, dithered rim and a faint target ring, so it reads "something lands here".
  spr('shadow', 34, 12, 'c', (c) => {
    c.ell(17, 6, 16, 5.5, (x, y, o) => {
      const r = Math.hypot(o.nx, o.ny);
      if (r > 0.86) return '#ffffff66';
      if (r > 0.72) return (x + y) % 2 ? '#00000055' : null;
      return r < 0.45 ? '#000000aa' : '#00000088';
    });
  }),

  spr('warn', 10, 20, 'c', (c) => c.part((l) => {
    l.rrect(2, 1, 6, 12, 2, (x, y, o) => tone(P.gold, 1 - o.v * 0.7 - (o.u > 0.6 ? 0.2 : 0), x, y, 0));
    l.rrect(2, 14, 6, 5, 2, (x, y, o) => tone(P.gold, 1 - o.v * 0.7 - (o.u > 0.6 ? 0.2 : 0), x, y, 0));
    l.set(3, 2, '#ffffff').set(3, 3, '#ffffff').set(3, 15, '#ffffff');
  }, P.red[0])),

  spr('speedline', 40, 3, 'c', (c) => {
    for (let x = 0; x < 40; x++) {
      const a = Math.round(255 * Math.min(1, x / 30)).toString(16).padStart(2, '0');
      c.set(x, 1, '#ffffff' + a);
      if (x > 20) c.set(x, 0, '#ffffff' + Math.round(0.35 * parseInt(a, 16)).toString(16).padStart(2, '0')).set(x, 2, '#ffffff' + Math.round(0.35 * parseInt(a, 16)).toString(16).padStart(2, '0'));
    }
  }),

  // Confetti bits (coloured; spin them at runtime).
  ...[P.red, P.gold, P.cyan, P.magenta, P.green, P.blue].map((C, k) => spr(`confetti_${k}`, 10, 10, 'c', (c) => {
    const p = (x, y, o) => tone(C, 1 - o.v * 0.8, x, y, 0);
    [
      (l) => l.rect(2, 3, 6, 4, p),
      (l) => l.poly([[1, 6], [6, 1], [8, 3], [3, 8]], p),
      (l) => l.ell(5, 5, 3, 3, p),
      (l) => l.poly([[5, 1], [9, 8], [1, 8]], p),
      (l) => l.path([[1, 6], [3, 3], [5, 6], [7, 3], [8, 5]], C[2]).path([[1, 7], [3, 4], [5, 7], [7, 4], [8, 6]], C[1]),
      (l) => l.rect(4, 1, 2, 8, p),
    ][k](c);
    c.outline(mix(C[0], '#000000', 0.4));
  })),

  spr('star', 18, 18, 'c', (c) => c.part((l) => star(l, 9, 9.5, 8, 3.6, 5, (x, y, o) => tone(P.gold.concat('#ffffff'), lit(o.nx, o.ny) + 0.2, x, y, 0)))),

  // Pré-treino jitter spark.
  spr('zap', 12, 16, 'c', (c) => c.part((l) => {
    l.poly([[7, 1], [2, 9], [5, 9], [3, 15], [10, 6], [7, 6], [9, 1]], (x, y, o) => tone(['#3fb858', '#8fe07a', '#c8ff8a', '#ffffff'], 1 - Math.abs(o.nx) * 0.8, x, y, 0));
  }, P.green[0])),
];

function bubble(c, brk) {
  const cx = c.w / 2, cy = c.h / 2, R = 38.5 + brk * 2.5;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (r > R) continue;
    if (brk) {
      // ring splits into 7 arcs flying apart and thinning
      const seg = ((a + Math.PI) / (2 * Math.PI)) * 7, f = seg % 1;
      if (f < 0.12 * brk + 0.08 || r < R - 3 + (brk === 3 ? 1 : 0)) continue;
      c.set(x, y, r > R - 1.5 ? (brk === 3 ? '#ffffff88' : '#ffffffdd') : '#ffffff77');
      continue;
    }
    const hl = Math.cos(a + 2.4); // 1 at upper-left
    if (r > R - 1.6) c.set(x, y, '#ffffffee');
    else if (r > R - 3) c.set(x, y, '#ffffff66');
    else if (r > R - 7 && hl > 0.75) c.set(x, y, '#ffffffcc');
    else if (r > R - 6 && hl < -0.9) c.set(x, y, '#ffffff55');
    else c.set(x, y, '#ffffff1a');
  }
  if (!brk) for (const [x, y] of [[22, 16], [20, 18], [23, 15]]) c.set(x, y, '#ffffff');
}
