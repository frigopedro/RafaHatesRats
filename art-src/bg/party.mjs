// Level 3 — "A Festa": the wedding reception at night. Hall (draped ceiling, fairy lights, night windows, photo wall
// with the couple's neon) → tables, bar, cake, DJ and dancing guests pushed back into dark-purple silhouettes
// (2 bounce frames) → light rig with spot cones and a disco ball → lit chequered dance floor.
import { OUTLINE, R, bayer, canvas, dith, ellipse, glow, grad, haze, line, mix, neonText, px, rect, rng, textW } from './lib.mjs';

const N = R.night; // 0 darkest … 5

function hallLayer() {
  const c = canvas(960, 296, true), r = rng(201);
  grad(c, 0, 0, 960, 296, [N[1], N[2], N[3], N[2], N[2]]);
  grad(c, 0, 230, 960, 66, [N[2], '#2a2048', '#33285a']); // warm dance-floor glow lifting the play band off black
  // windows with the night garden outside, curtains either side
  for (const wx of [40, 760]) {
    rect(c, wx - 4, 66, 128, 142, mix(N[4], '#000000', 0.2));
    grad(c, wx, 70, 120, 134, ['#0c1438', '#182a5c', '#24306a']);
    for (let k = 0; k < 30; k++) px(c, wx + ((r() * 120) | 0), 72 + ((r() * 70) | 0), r() > 0.7 ? '#ffffff' : '#8a9ad0');
    if (wx === 760) { ellipse(c, wx + 84, 96, 9, 9, '#f4ecd8'); ellipse(c, wx + 88, 93, 7, 7, '#182a5c'); }
    for (let k = 0; k < 12; k++) glow(c, wx + ((r() * 120) | 0), 192 + ((r() * 10) | 0), 14, 12, '#0e1a22', 1, 0.5); // garden trees
    for (let k = 0; k < 10; k++) px(c, wx + ((r() * 120) | 0), 180 + ((r() * 14) | 0), R.gold[2]);
    for (let x = 0; x <= 120; x += 40) rect(c, wx + x - 1, 70, 2, 134, '#c8bcd8');
    rect(c, wx, 120, 120, 2, '#c8bcd8');
    for (const side of [0, 1]) for (let y = 60; y < 212; y++) { // curtains, gathered at the bottom
      const w = 16 + Math.round(6 * Math.sin(y / 9)) - (y > 180 ? (y - 180) / 3 : 0), x = side ? wx + 120 - w + 10 : wx - 10;
      rect(c, x, y, w, 1, '#4a1a3a'); px(c, x + (side ? 2 : w - 3), y, '#6a2a52'); if ((y >> 3) % 2) px(c, x + (w >> 1), y, '#3a1230');
    }
  }
  // photo wall: greenery panel with flowers, balloon garland, the couple's neon
  const px0 = 300, pw = 360;
  rect(c, px0 - 1, 63, pw + 2, 142, OUTLINE); rect(c, px0, 64, pw, 140, '#16301e');
  for (let k = 0; k < 1400; k++) { // leaf clusters: dark under, lit on top
    const x = px0 + 2 + ((r() * (pw - 4)) | 0), y = 66 + ((r() * 136) | 0);
    ellipse(c, x, y + 1, 2, 1, '#1e3a26'); ellipse(c, x, y, 2, 1, ['#2e5a3a', '#3a6a40', '#24482e'][(r() * 3) | 0]); px(c, x - 1, y - 1, '#4a7a4a');
  }
  for (let k = 0; k < 110; k++) { // roses: white, blush, peach
    const x = px0 + 4 + ((r() * (pw - 8)) | 0), y = 68 + ((r() * 132) | 0), col = ['#f4ecd8', R.pink[2], R.pink[1], '#ffc06a'][(r() * 4) | 0];
    ellipse(c, x, y, 2, 2, mix(col, '#000000', 0.3)); ellipse(c, x, y - 1, 1, 1, col); px(c, x - 1, y - 2, '#ffffff');
  }
  for (let a = 0; a <= 60; a++) {
    const t = a / 60, x = Math.round(px0 - 6 + t * (pw + 12)), y = Math.round(64 - 18 * Math.sin(Math.PI * t)) + ((a % 3) - 1) * 3;
    const col = [R.pink[2], '#f4ecd8', R.gold[2], R.pink[1]][a % 4];
    ellipse(c, x, y, 5, 5, mix(col, '#000000', 0.35)); ellipse(c, x, y, 4, 4, col); px(c, x - 2, y - 2, '#ffffff');
  }
  const name = 'NATHALIA & MURILO', nw = (textW(name) + 2) * 2, nx = px0 + ((pw - nw) >> 1);
  rect(c, nx - 9, 93, nw + 18, 30, OUTLINE); rect(c, nx - 8, 94, nw + 16, 28, '#120c1e'); // acrylic backing board
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) neonText(c, name, nx + dx, 100 + dy, R.magenta[0], null); // halo
  neonText(c, name, nx, 100, R.magenta[2], R.magenta[3]);
  // neon heart under the names
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2, hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    rect(c, px0 + pw / 2 + Math.round(hx * 0.8), 154 + Math.round(hy * 0.8), 2, 2, R.pink[2]);
  }
  // wainscot
  rect(c, 0, 212, 960, 84, N[1]); rect(c, 0, 212, 960, 2, N[4]);
  for (let x = 0; x < 960; x += 48) rect(c, x, 216, 1, 80, N[0]);
  grad(c, 0, 240, 960, 56, [N[1], '#241a3e', '#2c2250']);
  // draped ceiling fabric: chiffon swags lit pink and gold
  rect(c, 0, 0, 960, 8, N[0]);
  for (let s = 0; s < 960; s += 80) for (let x = 0; x < 80; x++) {
    const t = x / 80, d = Math.round(26 * Math.sin(Math.PI * t));
    for (let y = 0; y < d + 4; y++) px(c, s + x, y + 4, y > d ? '#d8b8d8' : y > d - 3 ? '#a888c0' : (x + y) % 9 < 2 ? '#6a4a8a' : '#4a3468');
  }
  // fairy lights: swagged strings of warm bulbs
  for (const [y0, sag, off] of [[44, 18, 0], [62, 14, 60]]) for (let s = -off; s < 960; s += 120) for (let x = 0; x < 120; x++) {
    const t = x / 120, y = Math.round(y0 + sag * 4 * t * (1 - t));
    px(c, s + x, y, '#3a2e48');
    if (x % 6 === 3) { px(c, s + x, y + 1, x % 12 === 3 ? '#ffe98a' : '#ffc06a'); if (bayer(s + x, y) < 0.5) px(c, s + x, y + 2, '#c98a1c'); }
  }
  return c;
}

// Mid layer: everything at floor level, hazed into dark-purple silhouettes. Frame 1 = the dancers' bounce.
function guestsLayer(phase) {
  const c = canvas(720, 130, true), r = rng(301), B = 129, k = OUTLINE;
  const person = (x, foot, h, up, bounce) => {
    const y = foot - (bounce ? 3 : 0);
    rect(c, x - 2, y - 14, 2, 14, k); rect(c, x + 1, y - 14, 2, 14, k); // legs
    rect(c, x - 4, y - h + 9, 9, h - 23, k); ellipse(c, x, y - h + 5, 4, 5, k); // torso, head
    if (up) { line(c, x - 4, y - h + 11, x - 8, y - h - 2, k); line(c, x + 4, y - h + 11, x + 8, y - h - 2, k); }
    else { line(c, x - 4, y - h + 11, x - 8, y - h + 22, k); line(c, x + 4, y - h + 11, x + 9, y - h + 18, k); }
  };
  const table = (x) => {
    ellipse(c, x, B - 24, 26, 4, k); rect(c, x - 25, B - 24, 51, 24, k); // cloth to the floor
    rect(c, x - 2, B - 44, 4, 20, k); for (let i = 0; i < 9; i++) ellipse(c, x - 8 + ((r() * 16) | 0), B - 46 + ((r() * 8) | 0), 3, 3, k); // centrepiece
    for (const sx of [-30, 30]) { rect(c, x + sx - 3, B - 30, 2, 30, k); rect(c, x + sx - 3, B - 16, 8, 2, k); } // chairs
  };
  table(40); table(200); table(560);
  // bar with bottle shelf and bartender
  rect(c, 270, B - 34, 80, 34, k); rect(c, 266, B - 36, 88, 3, k);
  rect(c, 276, B - 90, 68, 3, k); rect(c, 276, B - 70, 68, 3, k);
  for (let i = 0; i < 12; i++) { rect(c, 279 + i * 5, B - 100, 3, 10, k); rect(c, 280 + i * 5, B - 103, 1, 3, k); }
  ellipse(c, 312, B - 48, 4, 5, k); rect(c, 307, B - 43, 11, 9, k);
  // cake display: tiered cake on a draped table
  rect(c, 380, B - 26, 44, 26, k); rect(c, 390, B - 38, 24, 12, k); rect(c, 394, B - 48, 16, 10, k); rect(c, 398, B - 56, 8, 8, k); rect(c, 401, B - 60, 2, 4, k);
  // DJ booth between speaker stacks, DJ with headphones
  for (const sx of [440, 518]) rect(c, sx, B - 62, 20, 62, k);
  rect(c, 462, B - 32, 54, 32, k); rect(c, 470, B - 36, 16, 4, k);
  ellipse(c, 490, B - 48, 4, 5, k); rect(c, 485, B - 43, 11, 11, k); ellipse(c, 490, B - 52, 6, 3, k);
  if (phase) line(c, 496, B - 42, 502, B - 54, k); else line(c, 496, B - 42, 502, B - 36, k);
  // dancing guests in two groups, bouncing on alternate frames
  for (let i = 0; i < 6; i++) person(100 + i * 15, B, 52 + ((r() * 10) | 0), (i + phase) % 2 === 0, (i + phase) % 2 === 0);
  for (let i = 0; i < 5; i++) person(618 + i * 16, B, 50 + ((r() * 12) | 0), (i + phase) % 3 === 0, (i + phase) % 2 === 1);
  haze(c, ['#2e2448', '#362b54', '#54467e']);
  return c;
}

function rigLayer() {
  const c = canvas(960, 46, true), g = R.grey;
  rect(c, 0, 8, 960, 3, OUTLINE); rect(c, 0, 9, 960, 1, g[2]);
  rect(c, 0, 20, 960, 3, OUTLINE); rect(c, 0, 21, 960, 1, g[2]);
  for (let x = 0; x < 960; x += 10) { line(c, x, 11, x + 5, 20, g[1]); line(c, x + 5, 20, x + 10, 11, g[1]); }
  for (let x = 0; x < 960; x += 4) px(c, x, 9, g[3]);
  for (const fx of FIXTURES) {
    rect(c, fx - 1, 23, 3, 4, OUTLINE);
    rect(c, fx - 7, 26, 15, 4, OUTLINE); rect(c, fx - 6, 27, 13, 2, g[1]);
    ellipse(c, fx, 34, 6, 6, OUTLINE); ellipse(c, fx, 34, 5, 5, '#1e1e2a'); ellipse(c, fx - 1, 32, 2, 2, g[2]);
    rect(c, fx - 3, 39, 7, 3, OUTLINE); rect(c, fx - 2, 39, 5, 2, '#e4e3ea');
  }
  return c;
}
const FIXTURES = [80, 240, 400, 560, 720, 880];

function spotCone([edge, body, core]) {
  // Additive cone, pivot at the top centre; brightness falls off across and along the beam in dithered steps.
  const W = 120, H = 300, c = canvas(W, H), cx = W / 2;
  for (let y = 0; y < H; y++) {
    const t = y / H, hw = 3 + t * (cx - 4);
    for (let x = 0; x < W; x++) {
      const d = Math.abs(x + 0.5 - cx) / hw;
      if (d >= 1) continue;
      const q = (1 - d * d) * (1 - 0.8 * t) ** 1.5 * 3, k = Math.floor(q), lvl = bayer(x, y) < q - k ? k + 1 : k;
      if (lvl > 0) px(c, x, y, lvl >= 3 ? core : lvl === 2 ? body : edge, [0, 0.14, 0.22, 0.4][Math.min(3, lvl)]);
    }
  }
  return c;
}

function discoBall(frame) {
  // chain + mirror ball; frames move the glints around
  const c = canvas(28, 44);
  rect(c, 13, 0, 2, 14, '#4a4956');
  ellipse(c, 14, 28, 13, 13, OUTLINE);
  for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) {
    if (x * x + y * y > 144) continue;
    const facet = ((x + 13) >> 2) + ((y + 13) >> 2), lit = -x - y;
    px(c, 14 + x, 28 + y, (x & 3) === 0 || (y & 3) === 0 ? '#3a3a4a' : lit > 8 ? '#e4e3ea' : lit > -4 ? (facet % 2 ? '#b4b3bd' : '#8a8a9a') : facet % 2 ? '#5a5a6e' : '#4a4956');
  }
  const glints = [[[8, 22], [17, 30], [11, 34]], [[12, 19], [20, 25], [7, 30]], [[16, 21], [9, 27], [19, 35]]][frame];
  for (const [x, y] of glints) { px(c, x, y, '#ffffff'); px(c, x - 1, y, '#a8ecff'); px(c, x + 1, y, '#a8ecff'); px(c, x, y - 1, '#ff8ae0'); px(c, x, y + 1, '#ff8ae0'); }
  return c;
}

// Dance floor: 32-px glass tiles, two rows (far rows 0–9, near rows 10–31), chequered into sets A and B.
function floorTile(set) {
  const c = canvas(64, 32, true);
  for (let col = 0; col < 2; col++) for (const [row, y, h] of [[0, 0, 10], [1, 10, 22]]) {
    const x = col * 32, inSet = (col + row) % 2 === (set === 'b' ? 1 : 0);
    if (set === null) {
      rect(c, x, y, 32, h, '#1a1430'); rect(c, x, y, 32, 1, '#3a2c58'); rect(c, x, y, 1, h, '#0c0818'); rect(c, x + 1, y + h - 1, 31, 1, '#120c22');
      dith(c, x + 2, y + 2, 28, h - 3, '#221a3c', 0.3);
    } else if (inSet) {
      const [d, m, l] = set === 'a' ? [R.magenta[0], R.magenta[1], R.magenta[2]] : [R.cyan[0], R.cyan[1], R.cyan[2]];
      rect(c, x + 1, y + 1, 31, h - 1, d);
      for (let j = 1; j < h - 1; j++) for (let i = 2; i < 31; i++) {
        const e = Math.min(i - 1, 31 - i, (j - 0.5) * 3, (h - 1 - j) * 3);
        if (e > 3 || bayer(x + i, y + j) < e / 3) px(c, x + i, y + j, m);
        if (e > 7 && bayer(x + i, y + j) < 0.35) px(c, x + i, y + j, l);
      }
      rect(c, x + 1, y, 31, 1, l);
    }
  }
  return c;
}
function groundFill() {
  const c = canvas(64, 32, true);
  rect(c, 0, 0, 64, 32, N[0]);
  rect(c, 0, 0, 64, 2, '#1a1430');
  for (let x = 0; x < 64; x += 32) rect(c, x, 0, 1, 32, '#140e22');
  dith(c, 0, 2, 64, 6, '#1a1430', 0.3);
  return c;
}

export default function party() {
  return {
    name: 'party', title: 'A Festa', skyColor: N[1],
    layers: [
      { name: 'hall', canvas: hallLayer(), y: 0, parallax: 0.1, tileX: true },
      { name: 'guests', frames: [guestsLayer(0), guestsLayer(1)], y: 166, parallax: 0.45, tileX: true, beat: 'frame 1 (bounce) for ~0.25 beat on every beat, frame 0 otherwise' },
      { name: 'rig', canvas: rigLayer(), y: 0, parallax: 0.7, tileX: true },
    ],
    ground: { top: floorTile(null), fill: groundFill(),
      overlays: [
        { name: 'floor_a', canvas: floorTile('a'), mock: (p) => !p, beat: 'set A tiles (magenta): draw on even beats' },
        { name: 'floor_b', canvas: floorTile('b'), mock: (p) => !!p, beat: 'set B tiles (cyan): draw on odd beats' },
      ] },
    overlays: [],
    sprites: [
      { name: 'disco_ball', frames: [discoBall(0), discoBall(1), discoBall(2)], pivot: { x: 14, y: 0 }, blend: 'normal',
        mount: { layer: 'rig', points: [[480, 22]] }, beat: 'cycle frames 0→1→2 once per beat (sparkle)', note: 'Hangs from the truss bottom chord; drawn right after the rig layer.' },
      ...[['spot_magenta', [R.magenta[1], R.magenta[2], '#ffd8f4'], [[80, 41], [560, 41]]], ['spot_cyan', [R.cyan[1], R.cyan[2], '#e0f8ff'], [[240, 41], [720, 41]]],
        ['spot_gold', [R.orange[2], R.gold[2], '#fff6d0'], [[400, 41], [880, 41]]]].map(([name, col, points]) => ({
        name, canvas: spotCone(col), pivot: { x: 60, y: 0 }, blend: 'add', mount: { layer: 'rig', points },
        beat: 'swing ±25° about the pivot with the beat; neighbouring colours swing opposite', note: 'Draw after all layers and the ground, before hazards and characters.' })),
    ],
  };
}
