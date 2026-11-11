// Level 2 church objects. Floor is a red carpet and walls are pale stone, so whites carry grey shadow tones and a
// firm outline, and nothing low is red.
import { OUT, P, spr, tone, lit, cylV, cylH, vgrad, rng } from './px.mjs';
import { chain } from './gym.mjs';

export const WH = ['#7a7986', '#b4b3bd', '#dedde4', '#ffffff'];
export const IVORY = ['#8a7e70', '#c8bca8', '#f0e8d8', '#fffaf0'];
export const BLUSH = ['#8a3a52', '#d86a8a', '#f5a0b8', '#ffd8e4'];
const PEW = ['#3a2010', '#5a3418', '#8a5a2c', '#b8823e'];
const IRON = ['#16151b', '#2b2a33', '#4a4956', '#7a7986'];
const VELVET = P.blue, Au = P.gold, Gn = P.green;

/** A posy: leaves round the edge, then roses (back to front) with a darker rim and a swirl; outline the layer after. */
export function roses(l, cx, cy, rx, ry, n, seed, ramps = [IVORY, BLUSH], r0 = 2.6) {
  const r = rng(seed);
  for (let i = 0; i < n + 3; i++) {
    const a = r() * Math.PI * 2;
    l.ell(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * 0.9 + 1, 2.2, 1.4, (x, y, o) => tone(Gn, 0.8 - 0.5 * o.v, x, y, 0));
  }
  const fl = Array.from({ length: n }, (_, i) => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8;
    return [cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, ramps[i % ramps.length], r0 * (0.85 + r() * 0.3)];
  }).sort((p, q) => p[1] - q[1]);
  for (const [x0, y0, ramp, s] of fl)
    l.ell(x0, y0, s, s, (x, y, o) => {
      const d = Math.hypot(o.nx, o.ny);
      if (d > 0.78) return ramp[1];
      if (d < 0.3) return ramp[1];
      return tone(ramp, lit(o.nx, o.ny) + 0.2, x, y, 0);
    });
}

export default [
  // Low padded kneeler: blue velvet cushion with button tufts on a wooden frame.
  spr('kneeler', 30, 17, 'b', (c) => {
    c.part((l) => {
      l.rect(1, 8, 28, 8, vgrad(PEW, 0, 0.9, 0.1));
      l.rect(4, 10, 22, 4, PEW[1]).rect(4, 10, 22, 1, PEW[0]).rect(4, 13, 22, 1, PEW[2]);
      l.rect(1, 8, 28, 1, PEW[3]);
    });
    c.part((l) => {
      l.rrect(2, 2, 26, 7, 3, (x, y, o) => tone(VELVET, lit(o.nx * 0.4, o.ny), x, y, 0.1));
      for (const x of [8, 15, 22]) l.set(x, 5, VELVET[0]).set(x - 1, 4, VELVET[3]);
    });
  }),

  spr('flowerBasket', 26, 23, 'b', (c) => {
    c.part((l) => {
      for (let a = Math.PI; a <= 2 * Math.PI + 0.01; a += 0.05) for (const k of [0, 1]) l.set(13 + (9 - k) * Math.cos(a), 11 + (9 - k) * Math.sin(a), k ? P.wood[3] : P.wood[1]);
    });
    c.part((l) => {
      const r = rng(4);
      l.ell(13, 10, 9.5, 3.2, (x, y) => [BLUSH[1], BLUSH[2], BLUSH[3], IVORY[3], BLUSH[2]][Math.floor(r() * 5)]);
    });
    c.part((l) => {
      l.poly([[3, 11], [23, 11], [20, 22], [6, 22]], (x, y, o) => {
        const weave = (x + ((y >> 1) % 2) * 2) % 4 < 2;
        return tone(P.wood, (weave ? 0.75 : 0.45) - 0.35 * o.v - 0.2 * Math.abs(o.nx), x, y, 0);
      });
      l.rect(2, 10, 22, 2, (x, y) => (y === 10 ? P.wood[3] : P.wood[2]));
    });
    c.part((l) => l.ell(6, 14, 2.5, 2, BLUSH[2]).ell(11, 14, 2.5, 2, BLUSH[2]).rect(8, 13, 2, 3, BLUSH[1]).line(8, 16, 6, 20, BLUSH[1]).line(9, 16, 11, 20, BLUSH[1]).set(5, 13, BLUSH[3]).set(10, 13, BLUSH[3]));
    c.part((l) => l.rect(24, 21, 2, 1, BLUSH[2]).rect(0, 21, 2, 1, IVORY[3]));
  }),

  // Stack of hymnals (fore-edges toward us: cream page blocks with gold-banded covers).
  spr('hymnBooks', 24, 17, 'b', (c) => {
    const book = (x, y, w, h, ramp, cross) => c.part((l) => {
      l.rect(x, y, w, h, (px, py, o) => tone(ramp, 0.85 - 0.6 * o.v, px, py, 0));
      l.rect(x + w - 6, y + 1, 5, h - 2, (px, py) => (py % 2 ? IVORY[2] : IVORY[1]));
      l.rect(x + 2, y, 1, h, Au[2]).rect(x + 4, y, 1, h, Au[1]);
      if (cross) l.rect(x + 9, y + 1, 1, 3, Au[3]).rect(x + 8, y + 2, 3, 1, Au[3]);
    });
    book(1, 11, 22, 5, P.blue, false);
    book(3, 6, 19, 5, P.green, false);
    book(2, 1, 18, 5, ['#2a1a40', '#44308f', '#7654d8', '#b09af2'], true);
  }),
  // Falling from the choir loft: one hymnal flapping open, pages fanned.
  spr('hymnBooks_air', 28, 22, 'c', (c) => {
    c.part((l) => {
      l.poly([[14, 18], [2, 9], [3, 6], [14, 14]], (x, y, o) => tone(P.blue, 0.8 - 0.5 * o.v, x, y, 0));
      l.poly([[14, 18], [26, 7], [27, 10], [14, 14]], (x, y, o) => tone(P.blue, 0.6 - 0.4 * o.v, x, y, 0));
    });
    c.part((l) => {
      l.poly([[14, 15], [4, 6], [8, 2], [14, 11]], (x, y, o) => tone(IVORY, 0.9 - 0.3 * o.u, x, y, 0));
      l.poly([[14, 15], [24, 6], [20, 2], [14, 11]], (x, y, o) => tone(IVORY, 0.6 + 0.3 * o.u, x, y, 0));
      for (const t of [0.3, 0.55, 0.8]) l.line(14, 13, 14 - 9 * t - 1, 13 - 9 * t, IVORY[1]).line(14, 13, 14 + 9 * t + 1, 13 - 9 * t, IVORY[1]);
    });
    c.part((l) => l.poly([[18, 1], [23, 0], [22, 4], [18, 4]], IVORY[2]).line(19, 2, 21, 2, IVORY[1]));
  }),

  // Rice on the floor: a little heap of grains, a few strays.
  spr('rice', 26, 12, 'b', (c) => {
    c.part((l) => {
      l.ell(13, 9.5, 9.5, 4, (x, y, o) => ((x * 2 + y * 3) % 5 === 0 ? WH[1] : tone(WH, lit(o.nx, o.ny) + 0.15, x, y, 0.1)));
      for (let x = 0; x < 26; x++) l.clear(x, 11);
    });
    for (const [x, y] of [[1, 9], [23, 8], [22, 10], [3, 6]]) c.part((l) => l.rect(x, y, 2, 1, WH[3]));
  }),
  // A thrown handful: loose clumps and single grains fanning out.
  spr('rice_air', 28, 18, 'c', (c) => {
    const r = rng(9);
    for (const [x, y, s] of [[9, 9, 3], [15, 7, 2.4], [20, 11, 2]]) c.part((l) => l.ell(x, y, s + 0.5, s, (px, py, o) => ((px + py * 2) % 3 === 0 ? WH[1] : tone(WH, lit(o.nx, o.ny) + 0.2, px, py, 0))));
    for (let i = 0; i < 9; i++) { const x = 2 + r() * 24, y = 2 + r() * 14; c.part((l) => l.rect(x, y, 2, 1, WH[3])); }
  }),

  // Pew end jutting into the aisle: a carved panel with a pointed-arch top, inset tracery, a satin bow and a posy.
  spr('pewEnd', 40, 48, 'b', (c) => {
    c.part((l) => l.rect(31, 18, 8, 3, vgrad(PEW, 0, 1, 0.3)).rect(31, 30, 8, 3, vgrad(PEW, 0, 1, 0.3))); // seat and rail behind
    c.part((l) => {
      l.poly([[4, 47], [4, 14], [8, 8], [18, 1], [28, 8], [32, 14], [32, 47]], (x, y, o) => tone(PEW, 0.95 - 0.55 * o.u - 0.15 * o.v, x, y, 0.08));
      l.path([[8, 44], [8, 16], [11, 11], [18, 6], [25, 11], [28, 16], [28, 44], [8, 44]], PEW[0]);
      l.path([[9, 43], [9, 17], [12, 12], [18, 7]], PEW[3]);
      for (const [dx, dy] of [[0, -2.5], [0, 2.5], [-2.5, 0], [2.5, 0]]) l.ell(18 + dx, 17 + dy, 2, 2, PEW[0]);
      l.set(18, 17, PEW[0]);
      l.rect(11, 26, 14, 1, PEW[0]).rect(11, 27, 14, 1, PEW[3]).rect(17, 28, 2, 14, PEW[1]).rect(17, 28, 1, 14, PEW[0]);
      l.rect(2, 45, 32, 2, PEW[1]).rect(2, 45, 32, 1, PEW[3]);
    });
    c.part((l) => roses(l, 30, 20, 4, 4, 5, 3, [IVORY, BLUSH], 2.2));
    c.part((l) => {
      l.poly([[25, 9], [24, 19], [26, 19], [27, 10]], WH[2]).poly([[28, 10], [31, 19], [33, 17], [29, 9]], WH[1]);
      l.ell(23, 6, 3.5, 2.5, (x, y, o) => tone(WH, lit(o.nx, o.ny) + 0.2, x, y, 0)).ell(31, 6, 3.5, 2.5, (x, y, o) => tone(WH, lit(o.nx, o.ny), x, y, 0));
      l.rect(26, 5, 3, 4, WH[2]).set(26, 5, WH[3]);
    });
  }),

  // Tall brass floor candlestick, lit; two flicker frames.
  ...[0, 1].map((k) => spr(`candleStand_${k}`, 22, 50, 'b', (c) => {
    c.part((l) => l.line(11, 41, 3, 49, Au[1]).line(11, 41, 4, 49, Au[2]).line(11, 41, 19, 49, Au[1]).line(11, 41, 18, 49, Au[0]).rect(10, 41, 3, 8, Au[1]));
    c.part((l) => {
      l.rect(10, 15, 3, 27, cylV(Au, 0));
      for (const y of [22, 31, 39]) l.ell(11.5, y, 2.6, 1.6, (x, py, o) => tone(Au, lit(o.nx, o.ny) + 0.1, x, py, 0));
    });
    c.part((l) => l.ell(11.5, 15, 6, 1.8, (x, y, o) => tone(Au, 0.9 - 0.6 * o.v, x, y, 0)));
    c.part((l) => l.rect(9, 7, 5, 8, cylV(IVORY, 0)).rect(12, 8, 1, 3, IVORY[3]).set(10, 7, IVORY[3]));
    c.part((l) => {
      const lean = k ? 1 : -0.5;
      l.ell(11.5 + lean * 0.5, 4, 1.8, 2.6, P.orange[2]).poly([[10, 3], [11.5 + lean * 2, -1], [13, 3]], P.orange[2]);
      l.ell(11.5, 4.6, 0.9, 1.5, P.gold[3]).set(11, 5, '#ffffff');
      l.set(11, 6, OUT).set(12, 6, OUT);
    }, P.red[0]);
  })),

  // Wedding arrangement on a marble pedestal: white and blush roses in greenery, trailing leaves.
  spr('flowerStand', 38, 50, 'b', (c) => {
    c.part((l) => l.rect(10, 45, 18, 4, vgrad(WH, 0, 0.9, 0.2)).rect(12, 43, 14, 2, WH[2]));
    c.part((l) => {
      l.rect(14, 22, 10, 21, cylV(WH, 0));
      for (const x of [16, 19, 22]) l.rect(x, 24, 1, 17, WH[1]);
      l.rect(11, 19, 16, 3, vgrad(WH, 0, 1, 0.3)).rect(12, 17, 14, 2, WH[1]);
    });
    c.part((l) => {
      for (const [x0, y0, x1, y1] of [[5, 15, 2, 27], [33, 14, 36, 26], [10, 18, 8, 29], [28, 18, 31, 30]]) {
        l.line(x0, y0, x1, y1, Gn[0]);
        for (let t = 0.25; t <= 1; t += 0.25) l.ell(x0 + (x1 - x0) * t + (t * 4 % 2 ? 1 : -1), y0 + (y1 - y0) * t, 1.6, 1.1, Gn[t > 0.6 ? 1 : 2]);
      }
      l.ell(19, 13, 14, 7, (x, y, o) => tone(Gn, 0.7 - 0.5 * o.v, x, y, 0));
      roses(l, 19, 11, 14, 8, 22, 11, [IVORY, BLUSH, IVORY], 3.6);
    });
  }),

  // Doves fly left at head height. White with a grey shadow tone and a firm outline (pale church wall behind).
  ...[0, 1, 2, 3].map((k) => spr(`dove_${k}`, 30, 22, 'c', (c) => {
    const D = ['#8a8994', '#b4b3bd', '#dedde4', '#ffffff'];
    const wing = [[[13, 9], [17, 0], [21, 1], [19, 9]], [[13, 9], [22, 4], [28, 5], [20, 11]], [[13, 11], [16, 20], [20, 19], [19, 11]], [[13, 9], [21, 6], [27, 8], [20, 11]]][k];
    if (k === 0 || k === 2) c.part((l) => l.poly(wing.map(([x, y]) => [x + 3, y + (k ? -2 : 2)]), D[1]));
    c.part((l) => {
      l.poly([[20, 10], [28, 8], [29, 12], [21, 13]], (x, y, o) => tone(D, 0.8 - 0.5 * o.v, x, y, 0));
      l.ell(14, 11, 8, 4, (x, y, o) => tone(D, lit(o.nx, o.ny) + 0.15, x, y, 0.1));
      l.ell(6, 9, 3.4, 3.2, (x, y, o) => tone(D, lit(o.nx, o.ny) + 0.2, x, y, 0));
      l.rect(1, 9, 2, 1, '#8a6a70').set(2, 10, '#5c3a42');
      l.set(5, 8, OUT);
    });
    c.part((l) => l.poly(wing, (x, y, o) => tone(D, 0.95 - 0.6 * Math.max(o.u, o.v), x, y, 0)).path(wing.slice(1, 3), D[1]));
  })),

  // Hanging church lantern (pivot = bottom of the lantern); hang `lantern_chain` up from the ring.
  spr('lantern', 24, 36, 'b', (c) => {
    c.part((l) => l.rect(11, 0, 2, 3, IRON[3]));
    c.part((l) => {
      l.rect(5, 11, 14, 16, (x, y, o) => {
        const gx = Math.abs(o.nx), gy = Math.abs(o.ny);
        return tone(Au.concat('#fff8d0'), 1.05 - 0.5 * Math.max(gx, gy * 0.8), x, y, 0.1);
      });
      l.rect(5, 11, 1, 16, IRON[2]).rect(18, 11, 1, 16, IRON[0]).rect(11, 11, 2, 16, IRON[1]).rect(5, 18, 14, 1, IRON[1]);
      l.rect(8, 21, 1, 4, IVORY[3]).rect(15, 21, 1, 4, IVORY[3]);
    });
    c.part((l) => l.poly([[12, 3], [21, 11], [3, 11]], (x, y, o) => tone(IRON, 0.9 - 0.7 * o.u, x, y, 0)).line(12, 4, 5, 10, IRON[3]).rect(2, 10, 20, 2, IRON[2]).rect(2, 10, 20, 1, IRON[3]));
    c.part((l) => l.poly([[4, 27], [20, 27], [15, 32], [9, 32]], (x, y, o) => tone(IRON, 0.8 - 0.6 * o.u, x, y, 0)).rect(11, 32, 2, 3, IRON[2]).rect(4, 27, 16, 1, IRON[3]));
  }),
  spr('lantern_chain', 8, 8, [4, 8], (c) => chain(c, IRON[3], IRON[2], IRON[1])),
];
