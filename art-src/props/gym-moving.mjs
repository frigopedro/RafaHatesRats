// Level 1 moving hazards: the battle-rope wave, and Fabinho's attacks (thrown plates, landing shockwave, med ball).
import { OUT, P, spr, tone, lit, vgrad } from './px.mjs';
import { flatPlate } from './gym.mjs';

const G = P.grey, K = P.rubber;
const ROPE = ['#10142a', '#1e2850', '#34478a', '#6f86c8'];
const DUST = ['#6a5a4a', '#9a8670', '#c8b496', '#ecdcc0'];

export default [
  // A sine travelling left (toward Rafa): each frame moves the crests a third of a wavelength (6 px).
  ...[0, 1, 2].map((k) => spr(`ropeWave_${k}`, 38, 22, 'b', (c) => {
    const yc = (x) => 17.5 - 12 * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - 4) / 34))) * (0.5 + 0.5 * Math.sin((2 * Math.PI * x) / 18 + (2 * Math.PI * k) / 3));
    c.part((l) => {
      for (let x = 4; x < 38; x++) {
        const y0 = yc(x), slope = yc(x + 0.5) - yc(x - 0.5), th = 2.6 * Math.hypot(1, slope);
        for (let y = Math.floor(y0 - th); y <= Math.ceil(y0 + th); y++) {
          const v = (y + 0.5 - y0) / th;
          if (Math.abs(v) > 1 || y > 20) continue;
          const twist = ((x + y * (slope > 0 ? -1 : 1) + k * 2) >> 1) % 3 === 0;
          l.set(x, y, tone(ROPE, 0.85 - 0.6 * (v + 1) / 2 - (twist ? 0.3 : 0), x, y, 0));
        }
      }
      l.rrect(0, 15, 6, 6, 1, vgrad(K.concat('#7a7986'), 0, 1, 0)).rect(1, 16, 4, 1, '#7a7986');
    });
    // speed ticks behind each crest
    for (let x = 4.5 - 6 * k + 18; x > 0; x -= 18) if (x > 6 && x < 34) c.line(x + 4, 4, x + 7, 4, '#ffffff99').line(x + 5, 6, x + 7, 6, '#ffffff66');
  })),

  ...[0, 1].map((k) => spr(`frisbee_${k}`, 30, 11, 'c', (c) => flatPlate(c, G.slice(1), k * Math.PI / 2))),

  // Fabinho lands a jump: a low ring of dust spreading over a crack in the floor. Frames grow the ring.
  ...[0, 1, 2].map((k) => spr(`shockwave_${k}`, 44, 18, 'b', (c) => {
    // crack: jagged dark line with a lit lower lip, branching
    const crack = [[22 - 6 - 4 * k, 12], [22 - 3 - 2 * k, 11], [19, 12], [22, 11], [25, 12], [25 + 2 * k, 11], [28 + 4 * k, 12]];
    const rx = 9 + 5 * k, ry = 3.6 + k * 0.7, n = 10 + 3 * k;
    for (const front of [false, true]) {
      // the crack shows on the floor inside the ring, between its back and front halves
      if (front) c.path(crack, OUT).path(crack.map(([x, y]) => [x, y + 1]), DUST[3]).line(19, 12, 18, 13, OUT).line(25, 12, 26, 13, OUT);
      c.part((l) => {
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (front ? i / (n - 1) : 1 + i / (n - 1));
          const x = 22 + rx * Math.cos(a), y = 12 + ry * Math.sin(a), s = (front ? 2.9 : 2.1) * (1 - 0.12 * k) * (0.85 + 0.3 * Math.abs(Math.cos(a)));
          l.ell(x, y - s * 0.4, s, s * 0.8, (px, py, o) => tone(DUST, lit(o.nx, o.ny) + (front ? 0.05 : -0.1), px, py, 0.1));
        }
        for (let x = 0; x < 44; x++) l.clear(x, 17);
        if (k === 2) l.map((col, x, y) => ((x * 5 + y * 3) % 9 === 0 ? null : col));
      });
    }
    for (const [x, y] of [[22 - rx - 2, 6 - k], [22 + rx + 1, 7 - k], [20, 3 - k]]) c.part((l) => l.rect(x, y, 2, 2, G[2]).set(x, y, G[3]));
  })),

  // Medicine ball: heavy charcoal rubber with a red grip band; turns 45° a frame (the band repeats every 180°).
  ...[0, 1, 2, 3].map((k) => spr(`medBall_${k}`, 24, 24, 'c', (c) => {
    const a = -k * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a);
    c.part((l) => l.ell(12, 12, 10.5, 10.5, (x, y, o) => {
      const u = o.nx * ca + o.ny * sa, b = lit(o.nx, o.ny); // u: distance across the band's axis
      if (Math.abs(Math.abs(u) - 0.36) < 0.07) return OUT; // seams
      if (Math.abs(u) < 0.36) return tone(P.red, b + 0.05, x, y, 0.08);
      return (x * 3 + y * 5) % 7 === 0 ? K[0] : tone(K.concat('#6a6976'), b, x, y, 0.08);
    }));
    c.set(7, 6, '#ffffff').set(8, 6, '#e4e3ea').set(7, 7, '#e4e3ea');
  })),
];
