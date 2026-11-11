// Level 3 party objects. Dark hall over a lit chequered floor: dark things get a light rim, whites keep grey shadow.
import { OUT, P, Cv, spr, tone, lit, cylV, cylH, vgrad, rng } from './px.mjs';
import { WH, IVORY, BLUSH, roses } from './church.mjs';

const Au = P.gold, M = P.magenta, K = P.rubber;
const BOTTLE = ['#0c2416', '#16402a', '#237a3f', '#8fe07a'];
const GLASS = ['#6a7a8a', '#b8d0e0', '#e8f8ff', '#ffffff'];

// Floor-length tablecloth: flared, with soft vertical folds and a wavy hem.
const cloth = (l, x0, x1, top, bottom, flare) => l.poly([[x0, top], [x1, top], [x1 + flare, bottom], [x0 - flare, bottom]], (x, y, o) =>
  tone(WH, 0.95 - 0.35 * o.v - 0.25 * Math.max(0, o.nx) + 0.22 * Math.sin(o.u * 19 + o.v * 2), x, y, 0.08));

export default [
  spr('giftBox', 24, 24, 'b', (c) => {
    c.part((l) => {
      l.rect(3, 10, 18, 13, (x, y, o) => tone(M, 0.85 - 0.5 * o.u, x, y, 0));
      l.rect(10, 10, 4, 13, cylV(Au, 0)).rect(3, 10, 18, 1, M[3]).rect(20, 10, 1, 13, M[3]);
    });
    c.part((l) => l.rect(2, 7, 20, 4, (x, y, o) => tone(M, 1 - 0.4 * o.v - 0.3 * o.u, x, y, 0)).rect(10, 7, 4, 4, Au[3]));
    c.part((l) => {
      l.ell(7.5, 4, 4, 2.6, (x, y, o) => tone(Au, lit(o.nx, o.ny) + 0.2, x, y, 0)).ell(16.5, 4, 4, 2.6, (x, y, o) => tone(Au, lit(o.nx, o.ny), x, y, 0));
      l.set(7, 4, Au[0]).set(16, 4, Au[0]).rect(11, 4, 2, 3, Au[2]);
    });
  }),

  // White tiffany chair knocked over onto its back: ladder backrest on the floor, seat upright, legs pointing at Rafa.
  spr('chair', 32, 21, 'b', (c) => {
    const W3 = WH.slice(1);
    // legs in the air (front pair) and resting (back pair), with grey rubber feet
    c.part((l) => {
      l.rect(2, 3, 11, 2, cylH(W3, 0)).rect(1, 3, 2, 2, WH[0]);
      l.rect(4, 7, 9, 2, cylH(WH, 0)).rect(3, 7, 2, 2, WH[0]);
      l.rect(3, 16, 10, 3, cylH(W3, 0)).rect(2, 16, 2, 3, WH[0]);
    });
    // ladder back lying on the floor: rails and three spindles
    c.part((l) => {
      l.rect(13, 13, 18, 2, cylH(W3, 0)).rect(13, 18, 18, 2, cylH(W3, 0)).rect(28, 11, 3, 9, cylV(W3, 0));
      for (const x of [17, 21, 25]) l.rect(x, 15, 2, 3, WH[2]);
    });
    c.part((l) => l.rect(10, 1, 3, 19, cylV(W3, 0)));
    c.part((l) => l.rrect(13, 2, 4, 11, 1, (x, y, o) => tone(BLUSH, 1 - o.u * 0.5, x, y, 0)));
  }),

  spr('champagne', 14, 28, 'b', (c) => {
    c.part((l) => {
      l.rrect(3, 12, 8, 15, 2, cylV(BOTTLE, 0)).poly([[3, 14], [5, 8], [9, 8], [11, 14]], cylV(BOTTLE, 0));
      l.rect(4, 13, 1, 12, BOTTLE[3]).set(5, 10, BOTTLE[3]); // rim light on the dark glass
      l.rect(3, 18, 8, 5, cylV(IVORY, 0)).rect(3, 18, 8, 1, Au[2]).rect(6, 20, 2, 1, Au[1]);
    });
    c.part((l) => l.rect(5, 1, 4, 8, cylV(Au, 0)).rect(5, 6, 4, 1, Au[0]).set(6, 2, Au[3]));
  }),

  // Round guest table: floor-length cloth, blush runner, centrepiece with two candles.
  spr('table', 60, 42, 'b', (c) => {
    for (const x of [20, 40]) c.part((l) => {
      l.rect(x - 1, 5, 3, 9, cylV(IVORY, 0));
      l.ell(x + 0.5, 3, 1.3, 2, P.orange[2]).set(x, 3, Au[3]).set(x + 1, 3, Au[3]);
    });
    c.part((l) => roses(l, 30, 8, 7, 4, 7, 5, [IVORY, BLUSH], 2.4));
    c.part((l) => {
      cloth(l, 8, 52, 14, 40, 5);
      l.ell(30, 14, 22.5, 2.5, (x, y, o) => tone(WH, 1 - 0.3 * o.v, x, y, 0));
      l.poly([[25, 13], [35, 13], [36, 33], [24, 33]], (x, y, o) => tone(BLUSH, 0.85 - 0.4 * o.v - 0.2 * o.u, x, y, 0)).rect(24, 32, 12, 1, BLUSH[0]);
      l.rect(26, 15, 8, 2, IVORY[3]).rect(27, 16, 6, 1, IVORY[1]);
    });
  }),

  // Tiered cake on a little draped table, pearl piping, blush flowers cascading, a tiny couple on top.
  spr('cakeTable', 50, 52, 'b', (c) => {
    const CK = ['#a89a88', '#e0d6c4', '#fff4e4', '#ffffff'];
    c.part((l) => { cloth(l, 6, 44, 36, 51, 3); l.ell(25, 36, 19.5, 1.8, WH[3]); });
    c.part((l) => l.rect(8, 34, 34, 2, vgrad(Au, 0, 1, 0)));
    for (const [x, y, w, h] of [[11, 24, 28, 10], [15, 15, 20, 9], [19, 8, 12, 7]]) c.part((l) => {
      l.rect(x, y, w, h, (px, py, o) => tone(CK, lit(o.nx * 0.8, 0) + 0.2 - 0.2 * o.v, px, py, 0));
      for (let px = x + 1; px < x + w; px += 2) l.set(px, y + h - 1, CK[3]).set(px + 1, y + h - 1, CK[1]);
      l.rect(x, y, w, 1, CK[3]);
    });
    c.part((l) => roses(l, 33, 21, 5, 5, 4, 8, [BLUSH], 2));
    c.part((l) => roses(l, 17, 30, 4, 3, 3, 12, [BLUSH], 1.8));
    c.part((l) => {
      l.rect(22, 3, 3, 5, K[1]).set(23, 1, P.skin[3]).set(23, 2, P.skin[2]).set(22, 1, P.hair[1]);
      l.poly([[26, 3], [29, 3], [30, 8], [25, 8]], WH[3]).set(27, 1, P.skin[3]).set(27, 2, P.skin[2]).set(28, 1, P.hair[3]).set(26, 4, WH[1]);
    });
  }),

  // Pyramid of coupes on a gold stand, fizzing over.
  spr('champagneTower', 38, 50, 'b', (c) => {
    c.part((l) => l.rect(7, 44, 24, 5, vgrad(Au, 0, 1, 0.1)).rect(9, 43, 20, 1, Au[3]));
    const coupe = (cx, y) => c.part((l) => {
      l.ell(cx, y + 1.5, 4.3, 2.6, (x, py, o) => (o.ny < -0.25 ? (o.nx < 0 ? Au[3] : Au[2]) : tone(Au, 0.7 - 0.5 * o.ny, x, py, 0)));
      for (let x = 0; x < 38; x++) l.clear(x, Math.round(y));
      l.rect(cx - 4, y + 0.5, 8.6, 1, GLASS[2]).set(cx - 3, y + 2, '#ffffff');
      l.rect(cx - 0.5, y + 4, 1, 3, GLASS[1]).rect(cx - 2, y + 7, 4, 1, GLASS[2]);
    });
    for (const [row, n] of [[0, 4], [1, 3], [2, 2], [3, 1]]) for (let i = 0; i < n; i++) coupe(19 - (n - 1) * 4.5 + i * 9, 35 - row * 8.5);
    const r = rng(2);
    for (let i = 0; i < 9; i++) c.set(14 + r() * 10, 1 + r() * 7, r() > 0.5 ? '#ffffff' : Au[3]);
    for (const [x, y] of [[10, 30], [28, 30], [14, 22], [24, 22]]) c.set(x, y, Au[3]).set(x, y + 1, Au[2]);
  }),

  // Balloon bunch at head height. Pivot = bottom of the balloon cluster (the hitbox bottom); the thin strings hang
  // below it and are harmless decoration.
  spr('balloons', 32, 48, [16, 29], (c) => {
    c.line(9, 26, 15, 44, '#dedbd8cc').line(22, 25, 16, 44, '#dedbd8cc').line(15, 26, 16, 44, '#dedbd8cc').path([[16, 44], [14, 45], [16, 46], [18, 47]], '#dedbd8cc');
    for (const [x, y, r, C] of [[9, 9, 7, M], [22, 8, 7, Au], [26, 19, 5.5, P.cyan], [6, 20, 5.5, P.purple], [16, 18, 7, P.red]]) c.part((l) => {
      l.ell(x, y, r, r * 1.12, (px, py, o) => tone(C, lit(o.nx, o.ny) + 0.15, px, py, 0.08));
      l.poly([[x - 1, y + r * 1.1], [x + 1, y + r * 1.1], [x, y + r * 1.1 + 2]], C[1]);
      l.rect(x - r * 0.45, y - r * 0.55, 2, 1, '#ffffff').set(x - r * 0.55, y - r * 0.3, '#ffffff');
    });
  }),

  // Stage cold-spark fountain: `sparkler_off` is the bare unit; `sparkler_0..3` a 1-block jet of white-gold sparks.
  spr('sparkler_off', 22, 8, 'b', (c) => unit(c, 0, false)),
  ...[0, 1, 2, 3].map((k) => spr(`sparkler_${k}`, 30, 46, 'b', (c) => {
    const r = rng(17 + k * 13), S = ['#c98a1c', '#f5c23a', '#ffe98a', '#ffffff'];
    c.part((l) => {
      for (let y = 4; y < 39; y++) {
        const t = (39 - y) / 35, hw = 1.2 + 1.8 * t + (r() - 0.5) * 0.8;
        for (let x = 0; x < 30; x++) {
          const d = Math.abs(x + 0.5 - 15) / hw;
          if (d <= 1) l.set(x, y, tone(S, 1.15 - 0.7 * d - 0.3 * t, x, y, 0.1));
        }
      }
    }, '#7a4a12');
    // loose sparks spraying out and falling, denser near the jet
    for (let i = 0; i < 70; i++) {
      const t = r(), side = r() > 0.5 ? 1 : -1, y = 2 + t * 34, spread = (1 - t) * (4 + r() * 9) * (1 + (r() > 0.8 ? 0.6 : 0));
      const x = 15 + side * (2 + spread);
      c.set(x, y + (1 - t) * (1 - t) * 6 * r(), r() > 0.4 ? S[3] : S[2]);
    }
    unit(c, 38, true);
  })),
];

function unit(c, y, on) {
  c.part((l) => {
    l.rrect(2, y + 2, 18 + (c.w - 22), 6, 1, vgrad(K.concat('#7a7986'), 0, 0.9, 0.1));
    l.rect(2, y + 2, c.w - 4, 1, '#b4b3bd');
    const cx = c.w / 2;
    l.rect(cx - 3, y, 6, 3, cylV(['#4a4956', '#7a7986', '#b4b3bd'], 0)).rect(cx - 1, y, 2, 1, on ? '#ffffff' : OUT);
    l.set(4, y + 5, on ? P.green[3] : P.red[1]);
  });
}
