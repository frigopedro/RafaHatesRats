// Level 1 — "Campeonato Gym Rats": bright teal gym. Back wall (windows, mirrors, posters, banner, neon) →
// equipment silhouettes → ceiling truss with lamps (moves with the ground; punching bags hang from it).
import { OUTLINE, R, bayer, canvas, haze, neonText, dith, ellipse, glow, grad, line, px, rect, rng, text, textFx, textW } from './lib.mjs';

const W = R.gymWall; // 0 darkest … 7 lightest


function windowPane(c, x, y, w, h, r) {
  // Frame, outdoor sky + hazy city, mullions, reflections, sill, and the light it throws on the wall below.
  for (let j = 0; j < 150; j++) { // light spill, skewed to the right and fading downward
    const k = 0.22 * (1 - j / 150);
    dith(c, x + 6 + j * 0.35, y + h + 4 + j, w - 12, 1, W[5], k);
  }
  rect(c, x - 3, y - 3, w + 6, h + 6, W[1]);
  rect(c, x - 2, y - 2, w + 4, h + 4, R.grey[2]);
  rect(c, x - 2, y - 2, w + 4, 1, R.grey[3]);
  grad(c, x, y, w, h, ['#7fd0d0', ...R.gymSky]);
  // distant city, hazy
  let bx = x;
  while (bx < x + w) {
    const bw = 10 + ((r() * 18) | 0), bh = 14 + ((r() * 30) | 0);
    rect(c, bx, y + h - bh, Math.min(bw, x + w - bx), bh, '#8ccfc9');
    for (let wy = y + h - bh + 3; wy < y + h - 3; wy += 4) for (let wx = bx + 2; wx < Math.min(bx + bw - 1, x + w); wx += 3) px(c, wx, wy, '#a8ddd6');
    bx += bw + 1;
  }
  for (let i = 0; i < 4; i++) glow(c, x + 8 + ((r() * (w - 16)) | 0), y + h - 6, 10, 6, '#6cbfae', 1, 1); // treetops
  rect(c, x, y + h - 3, w, 3, '#6cbfae');
  // reflections: two soft diagonal streaks per pane
  const panes = 4, pw = w / panes;
  for (let p = 0; p < panes; p++) for (let j = 0; j < h; j++) {
    const sx = x + p * pw + pw * 0.7 - j * 0.45;
    dith(c, sx, y + j, 5, 1, '#ffffff', 0.45);
    dith(c, sx + 8, y + j, 2, 1, '#ffffff', 0.3);
  }
  for (let p = 1; p < panes; p++) { rect(c, x + p * pw - 1, y, 2, h, R.grey[2]); px(c, x + p * pw - 1, y, R.grey[3]); }
  rect(c, x, y + Math.round(h * 0.32), w, 2, R.grey[2]);
  rect(c, x - 5, y + h + 2, w + 10, 3, R.grey[3]);
  rect(c, x - 5, y + h + 5, w + 10, 1, W[1]);
}

function poster(c, x, y, w, h, bg, edge) {
  rect(c, x + 2, y + 2, w, h, W[2]); // shadow on the wall
  rect(c, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(c, x, y, w, h, bg);
  rect(c, x, y, w, 1, edge);
  dith(c, x + w - 4, y, 4, 4, '#ffffff', 0.3); // curled corner catching light
  px(c, x + 1, y + 1, R.grey[3]); px(c, x + w - 2, y + 1, R.grey[3]); // pins
}

function flexer(c, x, y) {
  // "DIA DE PERNA É OPCIONAL": huge torso, toothpick legs.
  const skin = R.skin;
  ellipse(c, x + 10, y + 3, 3, 3, skin[2]);
  rect(c, x + 2, y + 6, 17, 10, skin[2]);
  rect(c, x + 2, y + 6, 17, 2, skin[3]);
  rect(c, x - 3, y + 2, 5, 9, skin[1]); rect(c, x + 19, y + 2, 5, 9, skin[1]); // biceps up
  ellipse(c, x - 1, y + 2, 3, 2, skin[2]); ellipse(c, x + 22, y + 2, 3, 2, skin[2]);
  rect(c, x + 6, y + 16, 9, 4, R.blue[2]); // shorts
  line(c, x + 8, y + 20, x + 8, y + 30, skin[1]); line(c, x + 12, y + 20, x + 12, y + 30, skin[1]);
  rect(c, x + 6, y + 30, 3, 1, OUTLINE); rect(c, x + 12, y + 30, 3, 1, OUTLINE);
  px(c, x + 9, y + 2, OUTLINE); px(c, x + 11, y + 2, OUTLINE);
}

function rat(c, x, y, body = R.ratFur) {
  // A small rat curling a dumbbell (poster mascot), facing right.
  ellipse(c, x + 8, y + 8, 7, 5, body[1]);
  ellipse(c, x + 8, y + 7, 6, 3, body[2]);
  ellipse(c, x + 16, y + 5, 4, 3, body[2]);
  px(c, x + 20, y + 5, R.pink[1]); px(c, x + 17, y + 4, OUTLINE);
  ellipse(c, x + 14, y + 1, 2, 2, R.pink[1]);
  line(c, x + 1, y + 9, x - 5, y + 4, R.pink[0]);
  rect(c, x + 12, y - 4, 2, 9, body[2]); // arm up
  rect(c, x + 9, y - 6, 8, 2, R.grey[1]); rect(c, x + 8, y - 8, 2, 6, R.grey[0]); rect(c, x + 16, y - 8, 2, 6, R.grey[0]);
  rect(c, x + 5, y + 12, 2, 2, body[0]); rect(c, x + 11, y + 12, 2, 2, body[0]);
}

function wallLayer() {
  const c = canvas(960, 296, true), r = rng(11);
  grad(c, 0, 0, 960, 40, [W[2], W[4], W[5]]);
  grad(c, 0, 40, 960, 150, [W[5], W[5], W[4]]);
  grad(c, 0, 190, 960, 72, [W[4], W[3]]);
  // painted stripe band along the wall (classic gym livery)
  rect(c, 0, 160, 960, 3, W[6]); rect(c, 0, 163, 960, 1, W[3]);
  for (let x = 0; x < 960; x += 4) px(c, x, 158, W[6]);
  windowPane(c, 30, 40, 176, 96, r);
  windowPane(c, 560, 40, 176, 96, r);
  // mirror wall: framed panels with soft diagonal sheens
  for (let x = 0; x < 960; x += 64) {
    rect(c, x, 176, 64, 86, W[3]);
    grad(c, x + 2, 178, 60, 82, ['#2a8484', '#237474', W[4]]);
    for (let j = 0; j < 82; j++) {
      dith(c, x + 40 - j * 0.6, 178 + j, 7, 1, '#3d9c96', 0.25);
      dith(c, x + 52 - j * 0.6, 178 + j, 2, 1, '#3d9c96', 0.2);
    }
    rect(c, x + 2, 178, 60, 1, '#3d9c96');
  }
  // wainscot + rail + baseboard
  rect(c, 0, 262, 960, 34, W[1]);
  dith(c, 0, 262, 960, 34, W[2], 0.25);
  rect(c, 0, 262, 960, 2, W[5]); rect(c, 0, 264, 960, 1, W[0]);
  for (let x = 16; x < 960; x += 48) rect(c, x, 268, 1, 22, W[0]);
  rect(c, 0, 290, 960, 6, W[0]);

  // Banner: CAMPEONATO GYM RATS, hanging between the windows, slight sag via grommet ropes.
  const bt = 'CAMPEONATO GYM RATS', bw = textW(bt, 2) + 20, bx = 232 + ((320 - bw) >> 1), by = 40;
  line(c, bx + 3, by, bx - 10, by - 40, R.grey[0]); line(c, bx + bw - 4, by, bx + bw + 10, by - 40, R.grey[0]);
  rect(c, bx - 1, by - 1, bw + 2, 28, OUTLINE);
  grad(c, bx, by, bw, 26, [R.red[2], R.red[1], R.red[1], R.red[0]]);
  rect(c, bx, by, bw, 2, R.gold[1]); rect(c, bx, by + 24, bw, 2, R.gold[1]);
  for (let x = bx + 6; x < bx + bw - 4; x += 22) px(c, x, by + 1, R.gold[3]);
  for (const fx of [bx + bw * 0.33, bx + bw * 0.66]) dith(c, fx | 0, by + 2, 3, 22, R.red[0], 0.35); // fabric folds
  textFx(c, bt, bx + 10, by + 6, { k: 2, col: R.gold[2], hi: R.gold[3], lo: R.gold[1], sh: R.red[0] });

  // Poster: SEM DOR, SEM GELOL (with a tube of Gelol)
  poster(c, 248, 84, 78, 50, R.orange[2], R.orange[3]);
  text(c, 'SEM DOR,', 253, 89, R.red[0]);
  text(c, 'SEM GELOL', 253, 100, OUTLINE);
  rect(c, 256, 116, 34, 9, '#f4f4f0'); rect(c, 256, 116, 34, 1, '#ffffff'); rect(c, 256, 124, 34, 1, R.grey[3]);
  rect(c, 290, 118, 5, 5, R.red[2]); rect(c, 252, 115, 4, 11, R.grey[3]);
  text(c, 'GELOL', 259, 117, R.red[1]);
  for (let i = 0; i < 3; i++) line(c, 300 + i * 6, 126, 304 + i * 6, 114, R.red[2]); // heat lines

  // Neon board backing (the tubes are the neon overlay)
  rect(c, 341, 80, 106, 34, OUTLINE);
  rect(c, 342, 81, 104, 32, '#101b22');
  dith(c, 342, 81, 104, 32, '#16252e', 0.3);
  for (const [sx, sy] of [[344, 83], [443, 83], [344, 110], [443, 110]]) px(c, sx, sy, R.grey[2]);

  // Poster: DIA DE PERNA É OPCIONAL, with the flexer
  poster(c, 760, 54, 86, 82, R.cyan[3], '#ffffff');
  text(c, 'DIA DE', 766, 62, R.blue[0]);
  text(c, 'PERNA É', 766, 73, R.blue[0]);
  text(c, 'OPCIONAL', 766, 84, R.red[1], { bold: false });
  rect(c, 766, 93, 47, 1, R.red[1]);
  flexer(c, 805, 98);
  // Poster: GYM RATS with the mascot
  poster(c, 862, 66, 66, 56, R.gold[2], R.gold[3]);
  text(c, 'GYM RATS', 866, 71, OUTLINE);
  rat(c, 880, 98);
  rect(c, 866, 116, 58, 1, R.gold[1]);
  // Wall clock between window 1 and the banner area
  ellipse(c, 218, 150, 7, 7, OUTLINE); ellipse(c, 218, 150, 6, 6, '#f4f4f0'); ellipse(c, 218, 150, 6, 6, R.grey[3], 0.4);
  line(c, 218, 150, 218, 146, OUTLINE); line(c, 218, 150, 221, 151, R.red[2]);
  // Whiteboard: today's WOD, hand-written dots
  rect(c, 470, 140, 50, 30, OUTLINE); rect(c, 471, 141, 48, 28, '#d6e8e4'); rect(c, 471, 141, 48, 1, '#ffffff');
  text(c, 'WOD', 474, 144, R.red[1]);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 9 + j * 3; i++) if (r() > 0.3) px(c, 474 + i * 3, 154 + j * 4, R.blue[1]);
  return c;
}

// Equipment, muted and dark against the wall so the play band stays calm. Each piece stands on y = 199 (layer bottom).
function machinesLayer() {
  const c = canvas(720, 200, true), r = rng(23), B = 199;
  const D = '#0d3438', M = '#124246', L = '#1b5a5c', H = '#2a7472'; // dark / mid / lit / rim
  const steel = ['#16303a', '#2a4a54', '#4a6a70'];
  // Lockers
  for (let i = 0; i < 6; i++) {
    const x = 8 + i * 15;
    rect(c, x, B - 92, 15, 92, OUTLINE);
    rect(c, x + 1, B - 91, 13, 90, M);
    rect(c, x + 1, B - 91, 1, 90, L);
    for (let v = 0; v < 5; v++) rect(c, x + 4, B - 86 + v * 3, 7, 1, D);
    rect(c, x + 1, B - 48, 13, 1, D);
    for (let v = 0; v < 5; v++) rect(c, x + 4, B - 43 + v * 3, 7, 1, D);
    rect(c, x + 11, B - 62, 1, 4, H); rect(c, x + 11, B - 20, 1, 4, H);
  }
  rect(c, 7, B - 96, 92, 4, D); rect(c, 7, B - 96, 92, 1, L);
  // Gym bag on top of the lockers
  ellipse(c, 30, B - 101, 12, 5, R.purple[0]); ellipse(c, 30, B - 102, 11, 3, R.purple[1]); line(c, 22, B - 105, 38, B - 105, R.purple[0]);
  // Water cooler
  rect(c, 110, B - 40, 16, 40, OUTLINE); rect(c, 111, B - 39, 14, 39, '#3c5a60'); rect(c, 111, B - 39, 2, 39, '#56787c');
  rect(c, 114, B - 28, 4, 3, R.blue[1]); rect(c, 119, B - 28, 4, 3, R.red[1]);
  ellipse(c, 118, B - 52, 8, 11, OUTLINE); ellipse(c, 118, B - 52, 7, 10, '#3e8aa6'); ellipse(c, 116, B - 55, 3, 6, '#6cb4c8');
  rect(c, 115, B - 64, 6, 3, '#2c6a86'); dith(c, 112, B - 50, 13, 8, '#2c6a86', 0.5);
  // Squat rack with loaded bar
  for (const ux of [146, 196]) { rect(c, ux, B - 112, 6, 112, OUTLINE); rect(c, ux + 1, B - 111, 4, 111, steel[1]); rect(c, ux + 1, B - 111, 1, 111, steel[2]); for (let h = 8; h < 104; h += 8) px(c, ux + 3, B - 111 + h, D); }
  rect(c, 144, B - 114, 60, 4, OUTLINE); rect(c, 145, B - 113, 58, 2, steel[1]);
  rect(c, 132, B - 66, 86, 3, OUTLINE); rect(c, 133, B - 65, 84, 1, steel[2]);
  for (const px0 of [134, 140, 205, 211]) { rect(c, px0, B - 80, 5, 30, OUTLINE); rect(c, px0 + 1, B - 79, 3, 28, '#20262c'); px(c, px0 + 1, B - 79, '#3a464e'); }
  rect(c, 140, B - 4, 72, 4, D);
  // Lat pulldown / cable tower
  rect(c, 250, B - 128, 8, 128, OUTLINE); rect(c, 251, B - 127, 6, 127, M); rect(c, 251, B - 127, 1, 127, H);
  rect(c, 250, B - 128, 54, 6, OUTLINE); rect(c, 251, B - 127, 52, 4, M);
  ellipse(c, 300, B - 120, 4, 4, OUTLINE); ellipse(c, 300, B - 120, 3, 3, steel[2]);
  line(c, 300, B - 116, 300, B - 90, '#7a9a9c'); rect(c, 284, B - 91, 33, 3, OUTLINE); rect(c, 285, B - 90, 31, 1, steel[2]);
  rect(c, 258, B - 100, 18, 60, OUTLINE); for (let k = 0; k < 14; k++) rect(c, 259, B - 99 + k * 4, 16, 3, k % 2 ? '#20282e' : '#2b353c');
  rect(c, 270, B - 36, 30, 6, OUTLINE); rect(c, 271, B - 35, 28, 4, R.red[0]); rect(c, 284, B - 30, 4, 30, OUTLINE);
  rect(c, 266, B - 54, 4, 18, OUTLINE);
  // Dumbbell rack, two tiers
  rect(c, 330, B - 40, 104, 40, OUTLINE);
  for (const ty of [B - 38, B - 18]) {
    rect(c, 331, ty + 12, 102, 4, M); rect(c, 331, ty + 12, 102, 1, H);
    for (let k = 0; k < 8; k++) {
      const x = 334 + k * 12, s = 3 + (k >> 1);
      rect(c, x, ty + 12 - s * 2, 3, s * 2, '#20282e'); rect(c, x + 7, ty + 12 - s * 2, 3, s * 2, '#20282e');
      rect(c, x + 3, ty + 12 - s - 1, 4, 2, steel[2]); px(c, x, ty + 12 - s * 2, '#3a464e'); px(c, x + 7, ty + 12 - s * 2, '#3a464e');
    }
  }
  rect(c, 332, B - 18, 3, 18, D); rect(c, 429, B - 18, 3, 18, D);
  // Treadmills
  for (const tx of [460, 516]) {
    rect(c, tx, B - 10, 48, 10, OUTLINE); rect(c, tx + 1, B - 9, 46, 6, '#20282e'); rect(c, tx + 1, B - 9, 46, 1, '#3a464e');
    line(c, tx + 40, B - 10, tx + 44, B - 52, OUTLINE); line(c, tx + 41, B - 10, tx + 45, B - 52, M);
    rect(c, tx + 34, B - 58, 16, 8, OUTLINE); rect(c, tx + 35, B - 57, 14, 6, M); rect(c, tx + 37, B - 56, 8, 3, '#1e8a7c');
    line(c, tx + 30, B - 40, tx + 44, B - 44, steel[1]);
  }
  // Bench + plate tree
  rect(c, 590, B - 24, 50, 6, OUTLINE); rect(c, 591, B - 23, 48, 4, R.red[0]); rect(c, 591, B - 23, 48, 1, R.red[1]);
  rect(c, 596, B - 18, 4, 18, OUTLINE); rect(c, 630, B - 18, 4, 18, OUTLINE);
  rect(c, 664, B - 70, 4, 70, OUTLINE); rect(c, 665, B - 69, 2, 69, steel[1]); rect(c, 652, B - 4, 28, 4, OUTLINE);
  for (const [py, pr] of [[B - 56, 11], [B - 32, 13], [B - 12, 10]]) { ellipse(c, 666, py, pr, pr, OUTLINE); ellipse(c, 666, py, pr - 1, pr - 1, '#20282e'); ellipse(c, 664, py - 2, pr - 4, pr - 5, '#2b353c'); ellipse(c, 666, py, 2, 2, steel[2]); }
  // Exercise balls
  ellipse(c, 700, B - 10, 10, 10, OUTLINE); ellipse(c, 700, B - 10, 9, 9, '#5a2a52'); ellipse(c, 697, B - 13, 4, 3, '#7a3a6a');
  return haze(c, ['#165a62', '#1b646b', '#237078']);
}


function ceilingLayer() {
  const c = canvas(192, 40, true);
  rect(c, 0, 0, 192, 8, W[0]); rect(c, 0, 8, 192, 1, OUTLINE);
  for (let x = 0; x < 192; x += 24) rect(c, x, 0, 1, 8, OUTLINE);
  // box truss: chords + zigzag lacing
  const g = R.grey;
  for (const x of [0, 96]) { rect(c, x + 46, 8, 2, 5, g[1]); }
  rect(c, 0, 12, 192, 3, OUTLINE); rect(c, 0, 13, 192, 1, g[2]);
  rect(c, 0, 22, 192, 3, OUTLINE); rect(c, 0, 23, 192, 1, g[2]);
  for (let x = 0; x < 192; x += 12) { line(c, x, 14, x + 6, 22, g[1]); line(c, x + 6, 22, x + 12, 14, g[1]); }
  for (let x = 0; x < 192; x += 4) px(c, x, 13, g[3]);
  // lamp housings hang under the truss at x = 48, 144 (the light overlay sits on them)
  for (const lx of [48, 144]) {
    line(c, lx, 25, lx, 29, OUTLINE);
    rect(c, lx - 7, 30, 15, 5, OUTLINE); rect(c, lx - 6, 30, 13, 3, g[2]); rect(c, lx - 6, 30, 13, 1, g[3]);
  }
  return c;
}

function lampFrame(lit) {
  const c = canvas(48, 40);
  if (lit) {
    glow(c, 24, 6, 20, 22, W[6], 0.4, 2);
    glow(c, 24, 6, 12, 12, W[7], 0.4, 2);
    glow(c, 24, 4, 9, 6, '#fff6d0', 0.9, 1);
  }
  rect(c, 18, 2, 13, 3, lit ? '#ffffff' : '#6a7070');
  rect(c, 20, 4, 9, 1, lit ? R.warm[3] : '#4a5050');
  return c;
}

function neonFrame(on) {
  const c = canvas(104, 32);
  const str = 'GYM RATS', w = (textW(str) + 2) * 2, x = (104 - w) >> 1;
  if (on) {
    const tmp = canvas(104, 32);
    neonText(tmp, str, x + 1, 4, '#ffffff', null);
    for (let j = 0; j < 32; j++) for (let i = 0; i < 104; i++) { // halo: board pixels near a tube
      let near = 9;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const u = i + di, v = j + dj;
        if (u >= 0 && v >= 0 && u < 104 && v < 32 && tmp.d[(v * 104 + u) * 4 + 3]) near = Math.min(near, Math.abs(di) + Math.abs(dj));
      }
      if (near <= 2) px(c, i, j, R.magenta[0]);
      else if (near <= 4 && bayer(i, j) < 0.5) px(c, i, j, R.magenta[0]);
    }
  }
  neonText(c, str, x + 1, 4, on ? R.magenta[2] : R.magenta[0], on ? R.magenta[3] : null);
  return c;
}

function groundTop() {
  // Rubber floor, 1 beat (4 blocks) per tile; the yellow lane stripe runs along the top face.
  const c = canvas(128, 32, true), r = rng(5), F = R.rubber;
  rect(c, 0, 0, 128, 10, F[3]);
  rect(c, 0, 0, 128, 1, F[4]);
  rect(c, 0, 4, 128, 2, R.gold[2]); rect(c, 0, 6, 128, 1, R.gold[1]);
  rect(c, 0, 10, 128, 22, F[1]);
  rect(c, 0, 9, 128, 1, F[2]); rect(c, 0, 10, 128, 1, F[0]);
  dith(c, 0, 26, 128, 6, F[0], 0.5);
  for (let i = 0; i < 140; i++) { // EPDM flecks
    const x = (r() * 128) | 0, y = 11 + ((r() * 20) | 0);
    px(c, x, y, [F[3], '#2f4a52', '#3a3a4a', F[2]][(r() * 4) | 0]);
  }
  for (let i = 0; i < 30; i++) { const x = (r() * 128) | 0, y = 1 + ((r() * 8) | 0); if (y < 4 || y > 6) px(c, x, y, F[4]); }
  for (let x = 0; x < 128; x += 32) { // rubber tile seams; the one at x=0 is the beat line
    rect(c, x, 0, 1, 32, F[0]); rect(c, x + 1, 1, 1, 9, F[4]);
  }
  rect(c, 0, 0, 1, 4, R.gold[3]);
  return c;
}
function groundFill() {
  const c = canvas(128, 32, true), r = rng(6), F = R.rubber;
  rect(c, 0, 0, 128, 32, F[1]);
  dith(c, 0, 0, 128, 32, F[0], 0.5);
  for (let i = 0; i < 60; i++) px(c, (r() * 128) | 0, (r() * 32) | 0, F[2]);
  return c;
}

export default function gym() {
  return {
    name: 'gym', title: 'Campeonato Gym Rats', skyColor: W[2],
    layers: [
      { name: 'wall', canvas: wallLayer(), y: 0, parallax: 0.12, tileX: true },
      { name: 'machines', canvas: machinesLayer(), y: 96, parallax: 0.45, tileX: true },
      { name: 'ceiling', canvas: ceilingLayer(), y: 0, parallax: 1, tileX: true,
        note: 'Moves with the ground. Truss bottom chord is at y 22-24: hanging punching-bag ropes should end there.' },
    ],
    ground: { top: groundTop(), fill: groundFill() },
    overlays: [
      { name: 'neon', layer: 'wall', at: [[342, 81]], frames: { on: neonFrame(true), off: neonFrame(false) },
        beat: 'on for the first half of every beat, off for the second (or on every beat, off on rests)' },
      { name: 'lamp', layer: 'ceiling', at: [[24, 28], [120, 28]], frames: { lit: lampFrame(true), dim: lampFrame(false) },
        beat: 'lit for ~0.3 beat after each beat, then dim (both lamps together); under Gelol alternate the two anchors' },
    ],
  };
}
