// "RafaHatesRats" logo: chunky crooked letters (gold→orange, "Hates" hotter), 2-ring outline, drop shadow, and a
// grey rat in a red "no" sign. Drawn at 1 art px, baked ×4 (logo.png).
import { OUTLINE, R, bayer, blit, canvas, crop, ellipse, line, outline, px, rect, scale } from './lib.mjs';

// 13 rows each; lowercase use rows 4–12.
const GL = {
  R: ['#######...', '########..', '###...###.', '###...###.', '###...###.', '########..', '#######...', '###.###...', '###..###..', '###..###..', '###...###.', '###...###.', '###....###'],
  H: ['###....###', '###....###', '###....###', '###....###', '###....###', '##########', '##########', '###....###', '###....###', '###....###', '###....###', '###....###', '###....###'],
  a: ['', '', '', '', '.######..', '########.', '......###', '.########', '#########', '###...###', '###...###', '#########', '.#####.##'],
  f: ['..####.', '.######', '.###...', '.###...', '######.', '######.', '.###...', '.###...', '.###...', '.###...', '.###...', '.###...', '.###...'],
  t: ['', '.###...', '.###...', '.###...', '#######', '#######', '.###...', '.###...', '.###...', '.###...', '.###..#', '.######', '..####.'],
  e: ['', '', '', '', '.#######.', '#########', '###...###', '#########', '#########', '###......', '###....##', '#########', '.#######.'],
  s: ['', '', '', '', '.#######', '########', '###.....', '#######.', '.#######', '.....###', '.....###', '########', '#######.'],
};
const WORD = 'RafaHatesRats';
const JIT = [0, -1, 1, -1, -2, 0, 1, -1, 1, 1, -1, 0, 2]; // crooked baseline, per letter
const GOLD = [R.gold[3], R.gold[2], R.gold[2], R.orange[2], R.orange[2], R.orange[1]];
const HOT = [R.orange[3], R.orange[2], R.orange[2], R.red[3], R.red[2], R.red[1]];

function rat() {
  // side-view rat facing right, own outline so it survives the slash at phone size
  const c = canvas(24, 14), F = R.ratFur;
  line(c, 5, 9, 1, 6, R.pink[0]); line(c, 1, 6, 1, 3, R.pink[0]); // tail
  ellipse(c, 10, 8, 6, 4, F[1]); ellipse(c, 10, 7, 5, 2, F[2]); // body
  ellipse(c, 17, 7, 3, 3, F[2]); line(c, 18, 9, 21, 8, F[2]); px(c, 21, 8, R.pink[1]); // head + snout + nose
  ellipse(c, 15, 4, 2, 2, F[2]); px(c, 15, 4, R.pink[1]); // ear
  px(c, 18, 6, OUTLINE); // eye
  rect(c, 7, 12, 2, 1, F[0]); rect(c, 13, 12, 2, 1, F[0]); // feet
  px(c, 8, 5, F[3]); px(c, 9, 5, F[3]); px(c, 16, 5, F[3]);
  return outline(c);
}

function noSign(c, cx, cy) {
  const r = 14;
  ellipse(c, cx, cy, r + 1, r + 1, OUTLINE);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { // ring, lit top-left
    const d = Math.hypot(i, j);
    if (d <= r + 0.3) px(c, cx + i, cy + j, d < r - 3 ? R.white[2] : i + j < -8 ? R.red[3] : i + j > 8 ? R.red[1] : R.red[2]);
  }
  blit(c, rat(), cx - 12, cy - 7);
  for (let k = -10; k <= 9; k++) { px(c, cx + k, cy + k, R.red[2]); px(c, cx + k + 1, cy + k, R.red[2]); px(c, cx + k - 1, cy + k, R.red[3]); } // slash
}

export default function logo() {
  const W = 176, H = 40, c = canvas(W, H), body = canvas(W, H);
  const at = new Map();
  let x = 3;
  [...WORD].forEach((ch, i) => {
    const g = GL[ch], hot = i >= 4 && i < 9, y0 = 6 + JIT[i];
    g.forEach((row, j) => [...row].forEach((v, k) => {
      if (v !== '#') return;
      const f = (j / 12) * (GOLD.length - 1), lo = Math.floor(f);
      const ramp = hot ? HOT : GOLD;
      px(body, x + k, y0 + j, bayer(x + k, y0 + j) < f - lo ? ramp[Math.min(ramp.length - 1, lo + 1)] : ramp[lo]);
      at.set(`${x + k},${y0 + j}`, 1);
    }));
    x += g.reduce((m, r) => Math.max(m, r.length), 0) + 1;
  });
  const on = (i, j) => at.has(`${i},${j}`);
  // letter shading: bright top edge, dark bottom edge
  for (const key of at.keys()) {
    const [i, j] = key.split(',').map(Number);
    if (!on(i, j - 1)) px(body, i, j, '#fff6d0');
    else if (!on(i, j + 1)) px(body, i, j, R.orange[0]);
  }
  // drop shadow, then outer black ring, inner brown ring, then letters
  const ring = (d) => { const s = new Set(); for (const key of at.keys()) { const [i, j] = key.split(',').map(Number); for (let v = -d; v <= d; v++) for (let u = -d; u <= d; u++) if (Math.abs(u) + Math.abs(v) <= d + (d > 1 ? 1 : 0)) s.add(`${i + u},${j + v}`); } return s; };
  const r2 = ring(2), r1 = ring(1);
  for (const key of r2) { const [i, j] = key.split(',').map(Number); px(c, i + 2, j + 3, OUTLINE); }
  for (const key of r2) { const [i, j] = key.split(',').map(Number); px(c, i, j, OUTLINE); }
  for (const key of r1) { const [i, j] = key.split(',').map(Number); px(c, i, j, R.red[0]); }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j * W + i) * 4; if (body.d[k + 3]) px(c, i, j, [body.d[k], body.d[k + 1], body.d[k + 2], 255]); }
  // the no-rat sign, stuck over the end of the word like a sticker
  noSign(c, x + 13, 18);
  let x0 = W, y0 = H, x1 = 0, y1 = 0; // trim to content + 1 px
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (c.d[(j * W + i) * 4 + 3]) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
  const t = crop(c, x0 - 1, y0 - 1, x1 - x0 + 3, y1 - y0 + 3);
  return { big: scale(t, 4) };
}
