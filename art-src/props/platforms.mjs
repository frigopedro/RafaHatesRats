// One-way platforms (0.5 block thick) as tileable l/m/r pieces, top-left pivot = the walking surface; and the hint sign.
import { OUT, P, Cv, spr, tone, cylV, vgrad } from './px.mjs';

const G = P.grey, K = P.rubber, CH = ['#4a4956', '#7a7986', '#b4b3bd', '#e4e3ea'];

// Draw l + m + r as one 96-px strip (patterns periodic in 32 px so m tiles with itself), outline it, cut it in three.
function pieces(name, draw) {
  const s = new Cv(96, 16);
  draw(s);
  s.outline();
  return ['l', 'm', 'r'].map((p, i) => spr(`${name}_${p}`, 32, 16, 'tl', () => s.crop(i * 32, 0, 32, 16)));
}

export default [
  ...pieces('plat_gym', (s) => s.part((l) => {
    l.rrect(1, 1, 94, 14, 3, (x, y) => (y < 5 ? K[y === 1 ? 3 : y === 2 ? 2 : 1] : tone(G, 0.95 - (y - 6) / 8, x, y, 0.1)));
    for (let x = 4; x < 92; x += 4) l.set(x, 3, K[0]).set(x + 1, 4, K[0]); // period divides 32: m tiles
    l.rect(1, 5, 94, 1, K[0]).rect(1, 9, 94, 2, (x, y) => (y === 9 ? P.teal[3] : P.teal[2]));
  })),

  // Party stage riser: bright aluminium edge on top (rim light for the dark hall), pleated black skirt, LED dots.
  ...pieces('plat_stage', (s) => s.part((l) => {
    l.rect(1, 1, 94, 14, (x, y) => {
      if (y === 1) return '#ffffff';
      if (y === 2) return CH[2];
      if (y === 3) return CH[0];
      if (y === 11 && x % 8 === 4) return P.gold[3];
      if (y === 14) return K[0];
      return x % 4 === 0 ? K[0] : x % 4 === 1 ? K[3] : K[2];
    });
  })),

  // Hint sign: a chalkboard on an A-frame. Text is drawn at runtime inside the board (see report for the rect).
  spr('sign', 72, 54, 'b', (c) => {
    const Wd = P.wood;
    for (const [x0, x1] of [[10, 5], [62, 67]]) c.part((l) => l.line(x0, 36, x1, 53, Wd[1]).line(x0 + 1, 36, x1 + 1, 53, Wd[2]).line(x0 + 2, 36, x1 + 2, 53, Wd[0]));
    c.part((l) => {
      l.rect(1, 1, 70, 38, (x, y, o) => tone(Wd, 0.85 - o.v * 0.5 + (x % 9 === 0 ? -0.2 : 0), x, y, 0));
      l.rect(1, 1, 70, 1, Wd[3]).rect(1, 38, 70, 1, Wd[0]);
      l.rect(4, 4, 64, 32, (x, y) => ((x * 7 + y * 13) % 29 === 0 ? '#3a3a3a' : (x * 3 + y * 5) % 47 === 0 ? '#353436' : '#272425'));
      l.rect(4, 4, 64, 1, OUT).rect(4, 4, 1, 32, OUT);
      l.rect(55, 33, 5, 1, '#dedbd8').rect(61, 33, 2, 1, '#b9b6b3'); // chalk stick on the ledge
    });
  }),
];
