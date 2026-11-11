// Level 2 — "A Madrinha": a warm Brazilian church seen from the aisle. Nave wall (stained glass, pilasters, plaques,
// light shafts) → pews of guests pushed back into the wall tones → beamed ceiling with the choir gallery (hymn books
// fall from it) → red carpet runner over stone. Plus the altar set piece at the end of the level.
import { OUTLINE, R, canvas, dith, ellipse, glow, grad, haze, line, mix, px, rect, rng, text, textW } from './lib.mjs';

const P = R.plaster, Wd = R.wood;
const GLASS = [R.blue[1], R.red[1], R.gold[1], R.green[1], R.purple[1]];
const GLASS_LIT = [R.blue[2], R.red[2], R.gold[2], R.green[2], R.purple[2]].map((g) => mix(g, '#fff6d0', 0.2));
const WIN = { w: 48, top: 76, h: 92 }; // lancet windows, one per bay
const BAYS = [120, 360, 600, 840];
const DOVE = ['....##.........', '...###.........', '..####.........', '.#####......##.', '.#####.....####', '..#####...#####',
  '...###########.', '.############..', '############...', '#....####......', '.....##........'];

/** Inside test for a pointed (lancet) window whose arch is the top w/2 rows. */
function inLancet(dx, dy) {
  const hw = WIN.w / 2;
  if (dy >= hw) return Math.abs(dx) < hw;
  const t = (hw - dy) / hw; // 1 at the tip
  return Math.abs(dx) < hw * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.35 * t);
}

function glassPane(c, cx, motif, lit) {
  const x0 = cx - WIN.w / 2, pal = lit ? GLASS_LIT : GLASS.map((g) => mix(g, '#2a2030', 0.35));
  for (let y = 0; y < WIN.h; y++) for (let x = 0; x < WIN.w; x++) {
    const dx = x - WIN.w / 2 + 0.5;
    if (!inLancet(dx, y)) continue;
    const lead = x % 7 === 0 || y % 8 === 0 || Math.abs(dx) < 0.6;
    const cell = ((x / 7) | 0) * 13 + ((y / 8) | 0) * 7 + motif * 5;
    px(c, x0 + x, WIN.top + y, lead ? '#2a1c1c' : pal[(cell * 2654435761 >>> 28) % pal.length]);
  }
  // central motif, outlined in lead: cross, dove, wedding rings, flower
  const my = WIN.top + 46, col = lit ? '#fff6d0' : '#c4ad86', ol = '#2a1c1c';
  const shape = (fn) => { fn(ol, 1); fn(col, 0); };
  if (motif === 0) shape((k, g) => { rect(c, cx - 2 - g, my - 14 - g, 4 + 2 * g, 26 + 2 * g, k); rect(c, cx - 9 - g, my - 7 - g, 18 + 2 * g, 4 + 2 * g, k); });
  if (motif === 1) shape((k, g) => DOVE.forEach((row, j) => [...row].forEach((v, i) => v === '#' && rect(c, cx - 8 + i - g, my - 6 + j - g, 1 + 2 * g, 1 + 2 * g, k))));

  if (motif === 2) for (const [ox, k] of [[-4, R.gold[lit ? 3 : 1]], [4, R.gold[lit ? 2 : 0]]]) { ellipse(c, cx + ox, my, 7, 7, ol); ellipse(c, cx + ox, my, 6, 6, k); ellipse(c, cx + ox, my, 4, 4, lit ? GLASS_LIT[0] : pal[0]); }
  if (motif === 3) shape((k, g) => { for (let a = 0; a < 6; a++) ellipse(c, cx + Math.round(5 * Math.cos(a)), my + Math.round(5 * Math.sin(a)), 3 + g, 3 + g, k); ellipse(c, cx, my, 2 + g, 2 + g, k === ol ? ol : R.gold[lit ? 2 : 1]); });
}

const winA = [], winB = [];
function naveLayer() {
  const c = canvas(960, 296, true);
  grad(c, 0, 0, 960, 70, [P[0], P[1], P[3]]);
  grad(c, 0, 70, 960, 100, [P[4], P[4], P[3]]);
  grad(c, 0, 170, 960, 40, [P[3], P[2]]);
  // light shafts from each window, falling down-right across the nave (static, soft)
  for (const cx of BAYS) for (let j = 0; j < 200; j++) {
    const k = 0.2 * (1 - j / 200);
    dith(c, cx - 14 + j * 0.55, WIN.top + WIN.h + j - 60, 26, 1, P[5], k);
  }
  // arches between pilasters, pilasters with capitals and bases
  for (let b = 0; b < 4; b++) {
    const x0 = b * 240, cx = x0 + 120;
    for (let i = -110; i <= 110; i++) { const y = 66 - Math.round(44 * Math.sqrt(1 - (i / 110) ** 2)); rect(c, cx + i, y, 1, 3, P[2]); px(c, cx + i, y + 3, P[5]); }
    rect(c, x0 - 10, 20, 20, 190, P[3]); rect(c, x0 - 10, 20, 2, 190, P[5]); rect(c, x0 + 8, 20, 2, 190, P[2]);
    rect(c, x0 - 13, 64, 26, 5, P[4]); rect(c, x0 - 13, 69, 26, 1, P[1]); // capital
    rect(c, x0 - 13, 200, 26, 6, P[4]); rect(c, x0 - 13, 206, 26, 1, P[1]); // base
    // station plaque on every pilaster
    rect(c, x0 - 8, 150, 16, 20, Wd[1]); rect(c, x0 - 7, 151, 14, 18, P[5]);
    const st = ['I', 'II', 'IV', 'VI'][b];
    text(c, st, x0 - (textW(st) >> 1), 152, Wd[2]);
    ellipse(c, x0, 164, 3, 2, P[2]);
  }
  // windows: deep reveal, sill, dim glass (the lit sets are overlays)
  BAYS.forEach((cx, i) => {
    for (let y = -3; y < WIN.h + 3; y++) for (let x = -3; x < WIN.w + 3; x++) if (inLancet(x - WIN.w / 2 + 0.5, y + 3) || (y >= 0 && Math.abs(x - WIN.w / 2 + 0.5) < WIN.w / 2 + 3)) px(c, cx - WIN.w / 2 + x, WIN.top + y, P[1]);
    glassPane(c, cx, i, false);
    rect(c, cx - 24, WIN.top + WIN.h, 48, 3, P[5]); rect(c, cx - 24, WIN.top + WIN.h + 3, 48, 1, P[1]);
    (i % 2 ? winB : winA).push([cx, i]);
  });
  // wall crosses high on two pilasters
  for (const x0 of [240, 720]) { rect(c, x0 - 2, 100, 5, 30, Wd[0]); rect(c, x0 - 8, 107, 17, 5, Wd[0]); rect(c, x0 - 1, 101, 3, 28, Wd[3]); rect(c, x0 - 7, 108, 15, 3, Wd[3]); }
  // wainscot: carved wood panels behind the pews
  rect(c, 0, 210, 960, 86, Wd[1]);
  rect(c, 0, 210, 960, 3, Wd[3]); rect(c, 0, 213, 960, 1, Wd[0]);
  for (let x = 0; x < 960; x += 40) { rect(c, x + 4, 220, 32, 60, Wd[2]); rect(c, x + 4, 220, 32, 1, Wd[0]); rect(c, x + 4, 279, 32, 1, Wd[3]); }
  rect(c, 0, 288, 960, 8, Wd[0]);
  return c;
}

function litWindows(list) {
  const c = canvas(960, 296, true);
  for (const [cx, i] of list) {
    glow(c, cx, WIN.top + WIN.h / 2, 36, 62, R.warm[3], 0.3, 2);
    glassPane(c, cx, i, true);
  }
  return c;
}

// Guests in pews, seen side-on from the aisle: pew ends with bows, heads and shoulders behind. Then hazed back.
function pewsLayer() {
  const c = canvas(720, 110, true), r = rng(7), B = 109, k = OUTLINE;
  const flames = [];
  const guest = (x, y, kind) => {
    if (kind === 'kid') { rect(c, x - 3, y - 26, 7, 18, k); ellipse(c, x, y - 30, 4, 4, k); rect(c, x - 2, y - 8, 2, 8, k); rect(c, x + 1, y - 8, 2, 8, k); line(c, x - 3, y - 24, x - 7, y - 32, k); line(c, x + 4, y - 24, x + 8, y - 32, k); return; }
    rect(c, x - 7, y - 13, 15, 15, k); ellipse(c, x, y - 19, 5, 6, k);
    if (kind === 'hat') { rect(c, x - 11, y - 24, 23, 2, k); ellipse(c, x, y - 27, 6, 4, k); rect(c, x + 5, y - 32, 2, 6, k); }
    if (kind === 'bun') ellipse(c, x - 4, y - 25, 3, 3, k);
    if (kind === 'phone') { line(c, x + 6, y - 11, x + 10, y - 28, k); line(c, x + 7, y - 11, x + 11, y - 28, k); rect(c, x + 8, y - 36, 6, 9, k); }
    if (kind === 'sleep') { ellipse(c, x + 5, y - 15, 5, 6, k); }
    if (kind === 'fan') { line(c, x - 5, y - 10, x - 9, y - 18, k); for (let a = 0; a < 5; a++) line(c, x - 9, y - 18, x - 15 + a * 3, y - 25, k); }
  };
  const kinds = ['', 'hat', 'bun', 'phone', '', 'sleep', 'kid', 'fan', 'hat', '', 'bun', 'phone'];
  const zzz = [], screens = [];
  for (let p = 0; p < 12; p++) {
    const x = p * 60 + 8;
    // guests behind the pew back (pew back top at B - 40)
    for (let g = 0; g < 3; g++) {
      const kind = g === 1 ? kinds[p] : r() > 0.6 ? 'bun' : '';
      const gx = x + 15 + g * 15, gy = B - 36;
      guest(gx, gy, kind);
      if (kind === 'sleep') zzz.push([gx + 9, gy - 34]);
      if (kind === 'phone') screens.push([gx + 10, gy - 34]);
    }
    // pew back and seat line, then the pew end panel with a rounded top
    rect(c, x + 4, B - 40, 52, 6, k); rect(c, x + 4, B - 22, 52, 4, k);
    rect(c, x, B - 44, 16, 44, k); ellipse(c, x + 8, B - 44, 8, 5, k);
    if (p % 4 === 1) { rect(c, x + 57, B - 64, 2, 64, k); rect(c, x + 53, B - 3, 10, 3, k); rect(c, x + 55, B - 70, 6, 6, k); flames.push([x + 58, B - 70]); } // candle stand
  }
  haze(c, ['#56423a', '#614b40', '#76604f']);
  // details that must survive the haze, kept muted: ribbon bows and garlands on pew ends, phone screens, snoring
  for (let p = 0; p < 12; p++) {
    const x = p * 60 + 8;
    for (let i = 0; i < 14; i++) px(c, x + 1 + i, B - 46 + Math.round(2 * Math.sin(i / 2.2)), i % 3 ? '#7a8a6a' : '#b49a90');
    for (let i = 0; i < 4; i++) { rect(c, x + 3 + i, B - 37 + (i >> 1), 1, 5 - 2 * (i >> 1), '#a8807a'); rect(c, x + 12 - i, B - 37 + (i >> 1), 1, 5 - 2 * (i >> 1), '#a8807a'); } // ribbon bow
    rect(c, x + 7, B - 36, 2, 3, '#c8a098'); px(c, x + 6, B - 31, '#a8807a'); px(c, x + 9, B - 31, '#a8807a');
  }
  for (const [x, y] of screens) rect(c, x - 1, y, 4, 6, '#8ab4c0');
  for (const [x, y] of zzz) { text(c, 'Z', x, y, '#9a8470'); px(c, x + 7, y - 4, '#9a8470'); px(c, x + 8, y - 4, '#9a8470'); px(c, x + 7, y - 2, '#9a8470'); }
  return { c, flames };
}

function flame(frame) {
  const c = canvas(9, 13);
  glow(c, 4, 7, 5, 6, R.warm[1], 0.5, 1.2);
  const lean = frame ? 1 : 0;
  ellipse(c, 4, 9, 2, 3, R.orange[2]); ellipse(c, 4 + lean, 7, 1, 3, R.gold[2]); px(c, 4 + lean, 5 - frame, '#fff6d0'); px(c, 4, 9, '#fff6d0');
  return c;
}

function ceilingLayer() {
  const c = canvas(384, 72, true), r = rng(12);
  // timber ceiling with corbel brackets every 96 px
  rect(c, 0, 0, 384, 14, Wd[1]); rect(c, 0, 14, 384, 2, Wd[0]);
  for (let x = 0; x < 384; x += 24) rect(c, x, 0, 1, 14, Wd[0]);
  for (let x = 0; x < 384; x += 96) { rect(c, x - 3, 0, 7, 20, Wd[2]); rect(c, x - 3, 0, 1, 20, Wd[3]); rect(c, x - 5, 16, 11, 4, Wd[2]); rect(c, x - 5, 20, 11, 1, Wd[0]); }
  // choir gallery: robed singers behind a stone parapet, hymn books on the rail (one tipping over the edge)
  for (let x = 12; x < 384; x += 24 + ((r() * 3) | 0) * 4) {
    if (r() < 0.2) continue;
    const sk = ['#8a5a44', '#a96647', '#6a4434', '#c87856'][(r() * 4) | 0], hair = R.hair[(r() * 5) | 0];
    rect(c, x - 8, 36, 17, 12, OUTLINE); rect(c, x - 7, 37, 15, 11, '#ece4d4'); rect(c, x - 7, 37, 1, 11, '#ffffff'); // robe
    rect(c, x - 3, 37, 2, 11, R.red[1]); rect(c, x + 2, 37, 2, 11, R.red[1]); // stole
    ellipse(c, x, 30, 5, 5, OUTLINE); ellipse(c, x, 30, 4, 4, sk); rect(c, x - 4, 25, 9, 3, hair); px(c, x + 2, 30, OUTLINE);
    if (r() > 0.45) { rect(c, x - 5, 40, 10, 6, OUTLINE); rect(c, x - 4, 41, 4, 4, '#f4ecd8'); rect(c, x + 1, 41, 3, 4, '#f4ecd8'); } // open hymn book
  }
  rect(c, 0, 48, 384, 3, OUTLINE); rect(c, 0, 48, 384, 2, P[5]); // rail
  rect(c, 0, 51, 384, 10, P[2]);
  for (let x = 0; x < 384; x += 8) { rect(c, x + 2, 51, 4, 10, P[4]); px(c, x + 2, 51, P[5]); rect(c, x + 5, 52, 1, 9, P[3]); }
  rect(c, 0, 61, 384, 5, P[4]); rect(c, 0, 61, 384, 1, P[5]); rect(c, 0, 66, 384, 1, P[1]);
  dith(c, 0, 67, 384, 5, P[1], 0.5);
  for (const bx of [70, 262]) { rect(c, bx - 1, 42, 12, 7, OUTLINE); rect(c, bx, 43, 10, 5, R.red[0]); rect(c, bx, 43, 10, 1, R.red[1]); rect(c, bx + 9, 44, 1, 3, '#f4ecd8'); } // closed books on the rail
  rect(c, 179, 43, 10, 6, OUTLINE); rect(c, 180, 44, 8, 4, R.blue[0]); rect(c, 180, 44, 8, 1, R.blue[1]); // one hanging over the edge
  return c;
}

function groundTop() {
  // red runner with a gold-patterned border (rows 0–9), stone floor tiles in front of it
  const c = canvas(128, 32, true);
  rect(c, 0, 0, 128, 10, R.tie[1]);
  rect(c, 0, 0, 128, 1, R.tie[2]); rect(c, 0, 1, 128, 1, R.gold[1]);
  for (let x = 0; x < 128; x += 8) { px(c, x + 2, 3, R.gold[1]); px(c, x + 6, 3, R.tie[2]); }
  for (let x = 0; x < 128; x += 8) { px(c, x + 3, 6, R.gold[1]); px(c, x + 4, 5, R.gold[1]); px(c, x + 5, 6, R.gold[1]); px(c, x + 4, 7, R.gold[1]); }
  rect(c, 0, 8, 128, 1, R.gold[1]); rect(c, 0, 9, 128, 1, R.tie[0]);
  for (let x = 0; x < 128; x += 2) px(c, x, 10, R.tie[0]); // fringe
  const tile = (x, y, w, h, light) => { rect(c, x, y, w, h, light ? P[3] : mix(P[3], P[2], 0.5)); rect(c, x, y, w, 1, P[4]); rect(c, x, y, 1, h, P[2]); };
  for (let x = 0; x < 128; x += 32) { tile(x, 11, 32, 9, (x / 32) % 2); tile(x, 20, 32, 12, (x / 32 + 1) % 2); }
  dith(c, 0, 11, 128, 3, R.tie[0], 0.3); // the runner's shadow on the stone
  dith(c, 0, 24, 128, 8, P[1], 0.2);
  return c;
}
function groundFill() {
  const c = canvas(128, 32, true);
  for (let x = 0; x < 128; x += 32) for (const [y, h, odd] of [[0, 16, 0], [16, 16, 1]]) {
    rect(c, x, y, 32, h, ((x / 32 + odd) % 2) ? P[2] : mix(P[2], P[1], 0.5)); rect(c, x, y, 32, 1, P[3]); rect(c, x, y, 1, h, P[1]);
  }
  dith(c, 0, 0, 128, 32, P[0], 0.35);
  return c;
}

// ---------- altar set piece ----------
const ALTAR = { w: 256, h: 232, ground: 222 }; // ground line row; rows below are the floor surface (spot markers)
function altar() {
  const c = canvas(ALTAR.w, ALTAR.h), r = rng(31), G = ALTAR.ground, D0 = 136, D1 = 252; // dais spans D0..D1
  // carved wooden reredos behind the dais (hides the pews there), arched niche framing the cross
  rect(c, D0 + 4, 60, D1 - D0 - 8, G - 60, OUTLINE); grad(c, D0 + 5, 61, D1 - D0 - 10, G - 61, [Wd[3], Wd[2], Wd[1]]);
  rect(c, D0 + 5, 61, D1 - D0 - 10, 2, R.gold[1]);
  for (let x = D0 + 10; x < D1 - 8; x += 14) { rect(c, x, 70, 10, 50, Wd[1]); rect(c, x, 70, 10, 1, Wd[4]); ellipse(c, x + 5, 70, 5, 3, Wd[1]); }
  for (let i = -26; i <= 26; i++) { const y = 92 - Math.round(26 * Math.sqrt(1 - (i / 26) ** 2)); rect(c, 194 + i, y, 1, 128 - y, '#2a1a20'); px(c, 194 + i, y, R.gold[2]); }
  rect(c, 191, 50, 7, 120, OUTLINE); rect(c, 192, 51, 5, 118, Wd[4]); rect(c, 192, 51, 1, 118, '#a8784e'); // cross
  rect(c, 177, 74, 36, 7, OUTLINE); rect(c, 178, 75, 34, 5, Wd[4]); rect(c, 178, 75, 34, 1, '#a8784e');
  // carpeted dais: three steps up on the left, one down on the right
  const step = (x0, x1, top) => { rect(c, x0 - 1, top - 1, x1 - x0 + 2, G - top + 1, OUTLINE); rect(c, x0, top, x1 - x0, G - top, R.tie[0]); rect(c, x0, top, x1 - x0, 3, R.tie[2]); rect(c, x0, top + 3, x1 - x0, 1, R.gold[2]); };
  step(D0, D1, G - 8); step(D0 + 14, D1, G - 16); step(D0 + 28, D1 - 12, G - 24);
  // altar table on the dais: white cloth, gold frontal with a cross, flowers
  const ty = G - 24;
  rect(c, 169, ty - 34, 58, 35, OUTLINE); rect(c, 170, ty - 33, 56, 33, '#f4ecd8'); rect(c, 170, ty - 33, 56, 2, '#ffffff'); rect(c, 224, ty - 33, 2, 33, '#c8bca8');
  rect(c, 184, ty - 29, 28, 26, R.gold[1]); rect(c, 185, ty - 28, 26, 24, R.gold[2]); rect(c, 196, ty - 26, 4, 18, '#fff6d0'); rect(c, 190, ty - 21, 16, 4, '#fff6d0');
  for (const vx of [176, 220]) { rect(c, vx - 3, ty - 44, 6, 10, R.gold[1]); ellipse(c, vx, ty - 50, 7, 6, '#3a6a3a'); for (let k = 0; k < 7; k++) ellipse(c, vx - 5 + ((r() * 10) | 0), ty - 54 + ((r() * 8) | 0), 1, 1, r() > 0.5 ? '#f9f8f8' : R.pink[2]); }
  // tall candelabra: one on the floor before the steps, one on the dais
  for (const [x, base] of [[128, G], [238, G - 24]]) {
    rect(c, x - 1, base - 70, 3, 70, R.gold[0]); rect(c, x, base - 70, 1, 70, R.gold[2]); rect(c, x - 5, base - 3, 11, 3, R.gold[1]);
    rect(c, x - 4, base - 74, 9, 3, R.gold[1]); rect(c, x - 1, base - 86, 3, 12, '#f4ecd8');
    glow(c, x, base - 90, 6, 7, R.warm[2], 0.6, 1.2); ellipse(c, x, base - 89, 1, 3, R.gold[2]); px(c, x, base - 91, '#fff6d0');
  }
  // floral arch over the couple's spots (posts at x 34 and 120)
  const leaves = ['#2e5a3a', '#3a7a46', '#237a3f'], blooms = ['#f9f8f8', '#dedbd8', R.pink[2], R.pink[1], '#ffc06a', '#f9f8f8'];
  const clump = (x, y, n) => {
    for (let k = 0; k < n; k++) ellipse(c, x + ((r() * 10 - 5) | 0), y + ((r() * 10 - 5) | 0), 3, 2, leaves[(r() * 3) | 0]);
    for (let k = 0; k < n * 0.8; k++) { const fx = x + ((r() * 12 - 6) | 0), fy = y + ((r() * 12 - 6) | 0), col = blooms[(r() * blooms.length) | 0]; ellipse(c, fx, fy, 2, 2, col); px(c, fx - 1, fy - 1, '#ffffff'); px(c, fx, fy, mix(col, '#7a4a3a', 0.4)); }
  };
  for (const ax of [34, 120]) { rect(c, ax - 2, 70, 5, G - 70, OUTLINE); rect(c, ax - 1, 70, 3, G - 70, Wd[3]); for (let y = G - 6; y > 74; y -= 9) clump(ax, y, y > G - 60 ? 3 : 5); }
  for (let a = 0; a <= 40; a++) { const t = (a / 40) * Math.PI; clump(Math.round(77 - 43 * Math.cos(t)), Math.round(76 - 34 * Math.sin(t)), 6); }
  for (const tx of [42, 58, 96, 112]) for (let y = 0; y < 26; y += 3) ellipse(c, tx + Math.round(2 * Math.sin(y / 4)), 82 + y, 1, 1, leaves[(y / 3) % 3 | 0]); // trailing vines
  clump(34, G - 2, 8); clump(120, G - 2, 8);
  // spot markers on the floor: petal rings (pink/white for the couple, gold for Rafa)
  const spots = { rafa: { x: 12, y: G }, bride: { x: 62, y: G }, groom: { x: 92, y: G } };
  for (const [k, sp] of Object.entries(spots)) for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2, x = sp.x + Math.round(10 * Math.cos(t)), y = G + 5 + Math.round(3.5 * Math.sin(t));
    const col = k === 'rafa' ? (a % 2 ? R.gold[2] : R.gold[3]) : a % 2 ? R.pink[2] : '#ffffff';
    rect(c, x, y, 2, 1, col); px(c, x, y + 1, mix(col, '#000000', 0.4));
  }
  return { c, spots };
}

export default function church() {
  const nave = naveLayer(), pews = pewsLayer(), alt = altar();
  return {
    name: 'church', title: 'A Madrinha', skyColor: P[0],
    layers: [
      { name: 'nave', canvas: nave, y: 0, parallax: 0.15, tileX: true },
      { name: 'pews', canvas: pews.c, y: 186, parallax: 0.5, tileX: true },
      { name: 'ceiling', canvas: ceilingLayer(), y: 0, parallax: 1, tileX: true,
        note: 'Moves with the ground. Hanging lanterns: chains start at the ceiling beam bottom, y 16. Hymn books (drop) fall from the choir gallery rail at y 48.' },
    ],
    ground: { top: groundTop(), fill: groundFill() },
    overlays: [
      { name: 'windows_a', layer: 'nave', at: [[0, 0]], frames: { lit: litWindows(winA) }, mock: (p) => (p ? null : 'lit'), beat: 'set A (bays 1 and 3): draw on even beats, hide on odd' },
      { name: 'windows_b', layer: 'nave', at: [[0, 0]], frames: { lit: litWindows(winB) }, mock: (p) => (p ? 'lit' : null), beat: 'set B (bays 2 and 4): draw on odd beats, hide on even' },
      { name: 'flame', layer: 'pews', at: pews.flames.map(([x, y]) => [x - 4, y - 12]), frames: { a: flame(0), b: flame(1) }, beat: 'flicker: swap a/b every half beat' },
    ],
    sprites: [
      { name: 'altar', canvas: alt.c, pivot: { x: 0, y: ALTAR.ground }, blend: 'normal', once: true, spots: alt.spots,
        note: 'Finish-line set piece, placed once with its pivot (left end, ground line) on the ground at the level end; drawn after the ground, before characters. The bottom 10 rows lie on the floor surface. spots = feet positions (sprite px, on the ground line) for Rafa, the bride and the groom; drawn without people.' },
    ],
  };
}
