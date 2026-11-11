// Pickups (centre pivot, drawn ~0.8 block over the 0.6-block pickup box), each with a 4-frame idle shine.
import { OUT, P, Cv, spr, tone, lit, cylV, cylH, vgrad, mix, textW } from './px.mjs';
import { IVORY, BLUSH, roses } from './church.mjs';

const W = ['#9a99a6', '#c9c8d0', '#ecebf0', '#ffffff'], Gn = P.green, Au = P.gold, K = P.rubber;

// Shine: frame 0 plain; 1–3 a diagonal glint sweeps across (inside the outline only); a twinkle on frame 2.
function shine(c, k, tw) {
  if (!k) return c;
  const p = -4 + k * (c.w + 4) / 3;
  c.map((col, x, y) => {
    const d = x + y * 0.7 - p;
    return col !== OUT && d >= 0 && d < 3 ? mix(col, '#ffffff', d < 1.5 ? 0.75 : 0.45) : col;
  });
  if (k === 2) { const [x, y] = tw; c.set(x, y, '#ffffff').set(x - 1, y, '#ffffff').set(x + 1, y, '#ffffff').set(x, y - 1, '#ffffff').set(x, y + 1, '#ffffff'); }
  return c;
}
const frames4 = (name, w, h, draw, tw) => [0, 1, 2, 3].map((k) => spr(`${name}_${k}`, w, h, 'c', (c) => { draw(c); shine(c, k, tw); }));

export default [
  // Gelol: original muscle-rub tube — white, green band with the name, green ribbed cap.
  ...frames4('gelol', 36, 20, (c) => {
    c.part((l) => {
      l.rect(1, 3, 4, 15, cylH(W, 0));
      for (let y = 4; y < 17; y += 2) l.set(2, y, W[1]).set(3, y, W[1]);
    });
    c.part((l) => {
      l.poly([[5, 4], [25, 5], [28, 6.5], [28, 13.5], [25, 15], [5, 16]], (x, y, o) => tone(W, lit(0, o.ny * 0.9) + 0.15, x, y, 0));
      l.rect(5, 7, 22, 7, (x, y, o) => tone(Gn, lit(0, o.ny * 0.8) + 0.05, x, y, 0));
      l.text('GELOL', 7, 8, '#ffffff');
      l.rect(5, 6, 22, 1, Gn[3]).rect(5, 14, 22, 1, Gn[0]);
      l.rect(7, 5, 14, 1, '#ffffff');
    });
    c.part((l) => {
      l.rect(28, 7, 2, 6, cylH(W, 0));
      l.rrect(29, 4, 6, 12, 1, (x, y, o) => tone(Gn, lit(0, o.ny * 0.9) + (x % 2 ? 0 : -0.25), x, y, 0));
    });
  }, [32, 3]),

  ...frames4('whey', 28, 28, (c) => {
    c.part((l) => {
      l.rrect(3, 8, 22, 19, 3, cylV(W, 0));
      l.rect(3, 12, 22, 10, cylV(P.blue, 0));
      l.text('WHEY', 5 + Math.floor((20 - textW('WHEY')) / 2), 14, '#ffffff');
      l.rect(3, 22, 22, 1, P.red[2]).rect(5, 9, 1, 2, '#ffffff').rect(5, 23, 1, 2, '#ffffff');
    });
    c.part((l) => l.rrect(2, 2, 24, 7, 2, (x, y, o) => tone(P.blue, lit(o.nx, o.ny * 0.5), x, y, 0)).rect(4, 3, 18, 1, P.blue[3]).rect(2, 7, 24, 1, P.blue[0]));
  }, [24, 4]),

  // Pré-treino: neon shaker with a lightning bolt.
  ...frames4('pre', 20, 30, (c) => {
    const N = ['#3fb858', '#8fe07a', '#c8ff8a', '#f0ffd0'];
    c.part((l) => l.rect(7, 1, 4, 3, cylV(K.concat('#7a7986'), 0)));
    c.part((l) => l.rrect(3, 4, 14, 6, 1, cylV(K.concat('#7a7986'), 0)).rect(3, 8, 14, 1, K[0]));
    c.part((l) => {
      l.rrect(3, 9, 14, 19, 3, cylV(N, 0.1));
      l.rect(3, 9, 14, 3, cylV(['#8fe07a', '#c8ff8a', '#f0ffd0', '#ffffff'], 0));
      for (let y = 14; y < 26; y += 3) l.set(15, y, Gn[1]).set(14, y, Gn[1]);
      l.rect(5, 12, 1, 12, '#f0ffd0');
    });
    c.part((l) => l.poly([[11, 12], [6, 20], [9, 20], [7, 26], [13, 17], [10, 17], [12, 12]], (x, y, o) => tone(Au, 1 - o.v * 0.6, x, y, 0)));
  }, [17, 3]),

  // Golden dumbbell spinning on its vertical axis: side, three-quarter, end-on (a disc), three-quarter.
  ...[0, 35, 90, 145].map((deg, k) => spr(`coin_${k}`, 22, 16, 'c', (c) => {
    const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.abs(Math.sin(a)), half = 7 * cs;
    // Each head is a plate: an ellipse that is thin edge-on and round face-on, rim + hub shading.
    const head = (cx) => c.part((l) => l.ell(cx, 8, Math.max(2, 5 * sn + 1.2 * Math.abs(cs)), 6, (x, y, o) => {
      const r = Math.hypot(o.nx, o.ny);
      return sn > 0.3 && r < 0.3 ? Au[0] : r > 0.72 ? tone(Au, 0.7 - 0.5 * o.ny - 0.2 * o.nx, x, y, 0) : tone(Au, 0.9 - 0.4 * o.ny - 0.2 * o.nx, x, y, 0);
    }));
    head(11 + half);
    if (Math.abs(half) > 1) c.part((l) => l.rect(Math.min(11 - half, 11 + half), 6.5, Math.abs(2 * half), 3, cylH(Au, 0)));
    head(11 - half);
    c.set(8, 4, '#ffffff').set(8, 5, Au[3]);
  })),

  // Ending props (no hitbox): the gym's "1º" cup and the bridal bouquet.
  spr('trophy', 32, 36, 'c', (c) => {
    c.part((l) => {
      for (const sx of [-1, 1]) for (let a = 0; a < Math.PI * 2; a += 0.05) for (const r of [4.5, 5.5]) l.set(16 + sx * 10 + Math.cos(a) * r * 0.8, 9 + Math.sin(a) * r, r > 5 ? Au[1] : Au[2]);
    });
    c.part((l) => {
      l.poly([[6, 3], [26, 3], [24, 14], [19, 19], [13, 19], [8, 14]], cylV(Au.concat('#fff6c8'), 0.08));
      l.ell(16, 3, 10, 1.6, (x, y, o) => tone(Au, 0.4 + 0.5 * o.v, x, y, 0));
      l.text('1º', 13, 8, Au[0]).rect(9, 5, 1, 7, '#fff6c8');
    });
    c.part((l) => l.rect(14, 19, 4, 5, cylV(Au, 0)).ell(16, 24, 5, 1.5, Au[2]));
    c.part((l) => l.rect(8, 26, 16, 8, vgrad(P.rubber.concat('#7a7986'), 0, 0.9, 0.1)).rect(11, 28, 10, 3, cylV(Au, 0)));
  }),
  spr('bouquet', 28, 36, 'c', (c) => {
    c.part((l) => {
      l.poly([[10, 18], [18, 18], [16, 34], [12, 34]], (x, y, o) => ((y % 3) ? tone(IVORY, 0.9 - 0.5 * o.u, x, y, 0) : IVORY[1]));
    });
    c.part((l) => roses(l, 14, 11, 10, 7, 18, 7, [IVORY, BLUSH, IVORY], 3));
    c.part((l) => l.ell(10, 22, 3, 2, BLUSH[2]).ell(18, 22, 3, 2, BLUSH[2]).rect(13, 21, 2, 3, BLUSH[1]).line(13, 24, 10, 30, BLUSH[1]).line(14, 24, 17, 31, BLUSH[1]).set(9, 21, BLUSH[3]).set(17, 21, BLUSH[3]));
  }),
];
