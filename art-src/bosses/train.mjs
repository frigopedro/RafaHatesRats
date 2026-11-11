// The party train ("carreta da alegria"): a sound-wall trailer with a flat roof stage, pulled by a little cab.
// Every overlay (speakers, bulbs) shares the body's origin, so the game draws them at the same x/y as train_body.
// Wheels and debris pivot on their centre.
import { Sprite, glyphs } from './raster.mjs';

export const ROOF = -90; // roof top, px above the ground at the body's pivot (art px; ×3 on screen)
export const STAGE = [-94, 24]; // flat roof span in x, relative to the body's pivot
export const WHEELS = [[-72, -11], [-46, -11], [46, -11], [78, -11]]; // wheel centres relative to the body's pivot
const SPEAKERS = [[-66, -48], [-14, -48]];
const TWEETERS = [[-40, -57], [-40, -40]];

const rect = (s, x, y, w, h, m, i, z = 0, g = 'body') => s.rect(x, y, w, h, { m, i, z, g });
// Bevelled panel: base tone with a lighter top/left edge and a darker bottom/right edge.
function panel(s, x, y, w, h, m, i, z = 0, g = 'body') {
  rect(s, x, y, w, h, m, i, z, g);
  rect(s, x, y, w, 1, m, i + 1, z, g); rect(s, x, y, 1, h, m, i + 1, z, g);
  rect(s, x, y + h - 1, w, 1, m, Math.max(0, i - 1), z, g); rect(s, x + w - 1, y, 1, h, m, Math.max(0, i - 1), z, g);
}
const text = (s, x, y, str, m, i, z) => glyphs(str, x, y, (px, py) => rect(s, px, py, 1, 1, m, i, z, 'text'));
const star = (s, c, m = 'gold') => {
  rect(s, c[0], c[1] - 2, 1, 5, m, 3, 3, 'star'); rect(s, c[0] - 2, c[1], 5, 1, m, 3, 3, 'star');
  rect(s, c[0], c[1], 1, 1, 'white', 2, 3.1, 'star');
};

function body() {
  const s = new Sprite({ w: 230, h: 130, ox: 115, oy: 120 });
  rect(s, -92, -19, 184, 9, 'black', 1, -1, 'chassis');
  // Trailer: teal box, gold roof rail, magenta lettering band and skirt.
  panel(s, -94, -88, 118, 70, 'teal', 2);
  rect(s, -93, -42, 116, 13, 'teal', 1, 0.1); // lower panel in shade
  for (let x = -93; x < 23; x += 2) rect(s, x, -43, 1, 1, 'teal', 1, 0.1);
  rect(s, -93, -73, 116, 1, 'teal', 3, 0.1); // sheen under the band
  for (const x of [-88, 18]) { rect(s, x, -73, 1, 44, 'teal', 0, 0.2); rect(s, x + 1, -73, 1, 44, 'teal', 3, 0.2); }
  for (let x = -91; x < 23; x += 8) rect(s, x, -31, 1, 1, 'teal', 3, 0.3);
  // Rear ladder up to the roof (how he gets on stage) and a tail light.
  for (const x of [-99, -96]) rect(s, x, -88, 1, 66, 'grey', 2, 1.5, 'ladder');
  for (let y = -84; y < -24; y += 6) rect(s, -99, y, 4, 1, 'grey', 3, 1.5, 'ladder');
  panel(s, -96, -27, 3, 6, 'red', 2, 1.6, 'tail');
  panel(s, -96, -91, 122, 5, 'gold', 2, 1, 'rail');
  panel(s, -92, -85, 114, 11, 'magenta', 2, 0.5, 'band');
  text(s, -71, -82, 'CARRETA DA ALEGRIA', 'gold', 3, 0.6);
  panel(s, -94, -29, 118, 11, 'magenta', 2, 0.5, 'skirt');
  for (let x = -92; x < 22; x += 6) s.poly([[x, -22], [x + 3, -26], [x + 6, -22], [x + 6, -21], [x + 3, -25], [x, -21]], { m: 'gold', i: 2, z: 0.6, g: 'skirt' });
  // Sound wall: two speaker cabinets with grey rims and dark holes (the cones are the train_speaker overlay) and a tweeter column.
  for (const [cx, cy] of SPEAKERS) {
    panel(s, cx - 19, cy - 21, 38, 42, 'black', 2, 1, 'cab' + cx);
    s.ell([cx, cy], 16, 16, { m: 'grey', z: 1.2, g: 'cab' + cx });
    s.ell([cx, cy], 13.5, 13.5, { m: 'black', i: 0, z: 1.3, g: 'cab' + cx });
    for (const [bx, by] of [[-16, -18], [15, -18], [-16, 17], [15, 17]]) rect(s, cx + bx, cy + by, 1, 1, 'grey', 3, 1.4, 'cab' + cx);
  }
  for (const [cx, cy] of TWEETERS) {
    s.ell([cx, cy], 5.5, 5.5, { m: 'grey', z: 1.2, g: 'tw' + cy });
    s.ell([cx, cy], 3.8, 3.8, { m: 'black', i: 0, z: 1.3, g: 'tw' + cy });
  }
  star(s, [-40, -68]); star(s, [-40, -29 + 0]); star(s, [18, -68], 'cyan');
  // Cab: magenta with a gold stripe, side window, slanted windshield, headlight, bumper and a cheeky smokestack.
  const cab = [[24, -66], [57, -66], [71, -46], [91, -44], [94, -38], [94, -19], [24, -19]];
  s.poly(cab, { m: 'magenta', i: 2, z: 0, g: 'cabin' });
  s.poly([[24, -66], [57, -66], [58, -64], [24, -64]], { m: 'magenta', i: 3, z: 0.1, g: 'cabin' });
  s.poly([[71, -46], [91, -44], [92, -42], [71, -44]], { m: 'magenta', i: 3, z: 0.1, g: 'cabin' });
  rect(s, 24, -24, 70, 5, 'magenta', 1, 0.1, 'cabin');
  rect(s, 24, -36, 70, 3, 'gold', 2, 0.2, 'cabin'); rect(s, 24, -36, 70, 1, 'gold', 3, 0.2, 'cabin');
  panel(s, 29, -61, 22, 16, 'cyan', 1, 0.5, 'glass');
  s.poly([[31, -47], [40, -60], [43, -60], [34, -47]], { m: 'cyan', i: 3, z: 0.6, g: 'glass' });
  s.poly([[57, -62], [60, -62], [70, -47], [66, -47]], { m: 'cyan', i: 2, z: 0.5, g: 'glass' });
  rect(s, 54, -44, 1, 22, 'magenta', 0, 0.3, 'cabin'); rect(s, 47, -41, 4, 2, 'grey', 3, 0.3, 'cabin');
  s.ell([90, -39], 3.2, 3.2, { m: 'gold', z: 1, g: 'lamp', lift: 0.3 });
  panel(s, 78, -23, 18, 6, 'grey', 3, 1, 'bumper');
  panel(s, 77, -58, 6, 13, 'gold', 2, 0.8, 'stack'); panel(s, 75, -61, 10, 4, 'gold', 1, 0.9, 'stack');
  star(s, [64, -30], 'cyan');
  // Wheel wells (the wheels are a separate rotating sprite drawn on top).
  for (const [wx, wy] of WHEELS) {
    const arch = Array.from({ length: 13 }, (_, k) => [wx + 13.5 * Math.cos(Math.PI + (k * Math.PI) / 12), wy - 13.5 * Math.sin((k * Math.PI) / 12)]);
    s.poly([...arch, [wx + 13.5, -10], [wx - 13.5, -10]], { m: 'black', i: 0, z: 2, g: 'well' });
  }
  return { name: 'train_body', ...s.resolve().finish() };
}

function wheel() {
  const s = new Sprite({ w: 40, h: 40, ox: 20, oy: 20 });
  s.ell([0, 0], 11.5, 11.5, { m: 'black', z: 0, g: 'tyre', lift: -0.15 });
  s.ell([0, 0], 6.5, 6.5, { m: 'gold', z: 1, g: 'rim' });
  s.ell([0, 0], 2.2, 2.2, { m: 'grey', z: 2, g: 'hub' });
  s.resolve();
  // Tread blocks and five bolts; asymmetric enough that the spin reads.
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; s.set(Math.cos(a) * 10.3, Math.sin(a) * 10.3, 'black', 0); }
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - 0.3; s.set(Math.cos(a) * 4.3, Math.sin(a) * 4.3, 'gold', 0); }
  s.stroke([[-1, -5], [-4, -3]], 'gold', 3);
  return { name: 'train_wheel', ...s.finish() };
}

// Cones at rest (0) and pushed out on the beat (1).
function speakers(k) {
  const s = new Sprite({ w: 230, h: 130, ox: 115, oy: 120 });
  for (const [cx, cy] of SPEAKERS) {
    const r = 12 + k, g = 'sp' + cx;
    s.ell([cx, cy], 13.4, 13.4, { m: 'grey', z: 0, g, lift: -0.4 });
    s.ell([cx, cy], r - 1.5, r - 1.5, { m: 'black', z: 1, g: g + 'c', lift: 0.25 * k });
    s.ell([cx, cy], 4 + k, 4 + k, { m: 'black', z: 2, g: g + 'd', lift: 0.3 + 0.25 * k });
  }
  for (const [cx, cy] of TWEETERS) {
    s.ell([cx, cy], 3.7, 3.7, { m: 'grey', z: 0, g: 'tw' + cy, lift: -0.3 });
    s.ell([cx, cy], 1.5 + k * 0.6, 1.5 + k * 0.6, { m: 'black', z: 1, g: 'twd' + cy, lift: 0.4 });
  }
  s.resolve();
  for (const [cx, cy] of SPEAKERS) s.set(cx - 2, cy - 2 - k, 'white', k ? 2 : 1); // dust-cap glint
  return { name: `train_speaker_${k}`, ...s.finish() };
}

// Strings of bulbs swagging under the band and along the cab roof; frame k lights every other bulb.
const BULB = ['red', 'gold', 'green', 'cyan', 'magenta'];
function bulbs(k) {
  const s = new Sprite({ w: 230, h: 130, ox: 115, oy: 120 });
  const runs = [[-94, -72, 24, -72, 30, 4], [24, -69, 57, -69, 33, 2]]; // x0, y0, x1, y1, hook spacing, sag
  let n = 0;
  for (const [x0, y0, x1, y1, step, sag] of runs) {
    const y = (x) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) + sag * Math.sin((Math.PI * (((x - x0) % step) + step) % step) / step);
    for (let x = x0; x <= x1; x++) rect(s, x, Math.round(y(x)), 1, 1, 'black', 1, 0, 'wire');
    for (let x = x0 + 3; x < x1 - 1; x += 6, n++) {
      const lit = (n + k) % 2 === 0, m = BULB[n % BULB.length], by = Math.round(y(x)) + 1;
      rect(s, x - 1, by, 3, 3, m, lit ? 2 : 0, 1, 'b' + n);
      rect(s, x - 1, by, 1, 1, lit ? 'white' : m, lit ? 2 : 1, 1.1, 'b' + n);
    }
  }
  return { name: `train_bulbs_${k}`, ...s.resolve().finish() };
}

// Chunks of teal-painted gym wall (concrete core, a little brick) flying out when the train crashes in.
const CHUNKS = [
  [[-9, -6], [-2, -9], [8, -7], [10, 1], [4, 7], [-6, 6], [-10, 0]],
  [[-7, -5], [3, -7], [7, -1], [5, 5], [-4, 6], [-8, 1]],
  [[-12, -4], [-4, -8], [6, -8], [12, -3], [9, 4], [1, 7], [-9, 5]],
];
function debris(i) {
  const s = new Sprite({ w: 60, h: 60, ox: 30, oy: 30, k: 1.4 }), P = CHUNKS[i];
  s.poly(P, { m: 'grey', i: 2, z: 0, g: 'core' });
  s.poly(P.map(([x, y]) => [x * 0.8 - 1, y * 0.8 - 1]), { m: 'teal', i: 2, z: 0.2, g: 'core' });
  s.resolve();
  s.stroke([P[1].map((c) => c * 0.5), [0, 0], [P[4][0] * 0.5, P[4][1] * 0.6]], 'teal', 0);
  if (i !== 1) s.stroke([[P[0][0] + 2, P[0][1] + 5], [P[0][0] + 8, P[0][1] + 5]], 'orange', 1);
  s.stroke([[P[1][0] * 0.8, P[1][1] * 0.8], [P[2][0] * 0.8 - 2, P[2][1] * 0.8]], 'teal', 3);
  return { name: `train_crash_debris_${i}`, ...s.finish() };
}

export default [body(), wheel(), speakers(0), speakers(1), bulbs(0), bulbs(1), debris(0), debris(1), debris(2)];
