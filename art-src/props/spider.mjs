// Spider-boss web attacks: floor glob, the glob in flight, a taut strand at head height.
import { OUT, Cv, spr, tone, lit } from './px.mjs';

export const WEB = ['#7a7986', '#b4b3bd', '#dedbd8', '#f9f8f8'];
const goo = (x, y, o) => tone(WEB.slice(1), lit(o.nx, o.ny) + 0.1, x, y, 0.05);
// Web threads drawn only over the glob's own pixels.
const on = (l, c) => (x, y) => (l.a(x, y) ? c : null);

export default [
  // A splatted dome of web: radial + ring threads say "web", goo puddle and drips say "sticky".
  spr('webBlob', 30, 16, 'b', (c) => {
    c.part((l) => {
      l.ell(15, 13, 14, 2.5, (x, y, o) => tone(WEB, 0.6 - 0.3 * o.ny, x, y));
      l.ell(15, 12, 10.5, 9, goo).ell(5, 13, 2, 2, goo).ell(25, 13, 2.2, 2, goo);
      for (let y = 13; y < 16; y++) for (let x = 0; x < 30; x++) if (y > 14 && l.a(x, y) && l.get(x, y) !== WEB[0]) l.set(x, y, WEB[1]);
      for (const ax of [-1.2, -0.75, -0.3, 0.15, 0.6, 1.05]) l.line(15, 4, 15 + 11 * Math.sin(ax), 4 + 10 * Math.cos(ax), on(l, WEB[0]));
      for (const r of [3.5, 6.5]) for (let a = -1.5; a <= 1.5; a += 0.08) l.set(15 + r * 1.15 * Math.sin(a), 4 + r * Math.cos(a), l.a(Math.round(15 + r * 1.15 * Math.sin(a)), Math.round(4 + r * Math.cos(a))) ? WEB[0] : null);
      l.set(11, 6, '#ffffff').set(10, 7, '#ffffff').set(11, 7, '#ffffff').set(9, 9, '#ffffff');
    });
    c.part((l) => l.set(1, 14, WEB[2]).set(28, 14, WEB[2]).set(27, 12, WEB[3]).set(2, 11, WEB[3]));
  }),

  // Flying left (toward Rafa); strands trail to the right.
  spr('webBlob_air', 26, 20, 'c', (c) => {
    c.part((l) => l.path([[14, 7], [19, 5], [25, 4]], WEB[2]).path([[16, 10], [21, 10], [25, 11]], WEB[2]).path([[14, 14], [19, 16], [24, 18]], WEB[2]));
    c.part((l) => {
      l.ell(10, 10, 8, 8, goo);
      for (let a = 0; a < 6; a++) l.line(10, 10, 10 + 8 * Math.cos(a * Math.PI / 3 + 0.3), 10 + 8 * Math.sin(a * Math.PI / 3 + 0.3), on(l, WEB[0]));
      for (let a = 0; a < 24; a++) l.set(10 + 4.6 * Math.cos(a * Math.PI / 12), 10 + 4.6 * Math.sin(a * Math.PI / 12), WEB[0]);
      l.rect(6, 6, 2, 1, '#ffffff').set(6, 7, '#ffffff');
    });
  }),

  // Tileable horizontally (period 13 divides 52); draw three periods wide, outline, keep the middle.
  spr('webLine', 52, 12, 'c', () => {
    const w = new Cv(156, 12);
    // side threads stay un-outlined so the strand reads light, not like a rope
    for (let x = 0; x < 156; x++) { w.set(x, 2 + Math.round(Math.sin(x / 13 * Math.PI * 2) * 0.6), WEB[1]); w.set(x, 9 + Math.round(Math.sin(x / 13 * Math.PI * 2 + 2) * 0.6), WEB[1]); }
    for (let x = 0; x < 156; x += 13) w.line(x, 2, x + 6, 4, WEB[2]).line(x + 6, 7, x + 12, 9, WEB[2]);
    w.part((l) => {
      l.rect(0, 5, 156, 1, WEB[3]).rect(0, 6, 156, 1, WEB[2]);
      for (let x = 4; x < 156; x += 26) l.set(x, 5, '#ffffff').set(x + 1, 5, '#ffffff').set(x, 6, WEB[3]);
    });
    return w.crop(52, 0, 52, 12);
  }),

  // Left anchor (flip for the right one): a knotted wad with frayed strands; the strand leaves it at the centre right.
  spr('webLine_end', 14, 22, 'c', (c) => {
    c.part((l) => {
      for (const [x, y] of [[1, 2], [0, 8], [0, 14], [1, 20], [5, 0], [5, 21]]) l.line(8, 11, x, y, WEB[2]);
      l.rect(9, 10, 5, 1, WEB[3]).rect(9, 11, 5, 1, WEB[2]);
    });
    c.part((l) => {
      l.ell(8, 11, 4.5, 5.5, goo);
      l.line(5, 8, 11, 14, on(l, WEB[0])).line(11, 8, 5, 14, on(l, WEB[0])).set(6, 8, '#ffffff').set(7, 7, '#ffffff');
    });
  }),
];
