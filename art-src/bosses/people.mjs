// People who are hazards (church: photographer, flower girl, ring bearer; party: waiter) and the stand-in couple and
// priest for the altar. Generic, original characters drawn with the same capsule renderer as the Aranha. Coordinates
// are art px from the ground-contact pivot (ground y = 0); runners face left, the photographer backs in facing right.
import { Sprite, OUT, defineRamp, add, sub, mul, unit, lerp } from './raster.mjs';

defineRamp('gown', [['grey', 1], ['grey', 2], ['white', 0], ['white', 1], ['white', 2]]); // white with firm shadows
const SK = 'skin', W = 'white', K = 'black';

// Two-bone IK: knee/elbow for a limb from a to c with segment lengths l1, l2, bending toward side s (x sign).
function ik(a, c, l1, l2, s) {
  const d = Math.min(Math.hypot(c[0] - a[0], c[1] - a[1]), l1 + l2 - 0.01), dir = unit(sub(c, a));
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let n = [-dir[1], dir[0]];
  if (Math.sign(n[0] || 1) !== s) n = mul(n, -1);
  return add(add(a, mul(dir, x)), mul(n, h));
}

// Head: an oval in skin with a hair cap (top, plus the back when turned). Returns a painter for the face.
// L: { face: -1 left / 1 right, turn 0 front … 1 profile, hair, z, eye: 'kid'|'adult'|'lash'|'shut'|'wide', mouth }
function head(s, c, rx, ry, L) {
  const f = L.face ?? -1, t = L.turn ?? 0.5, fu = f * t * 0.45;
  const side = L.side ?? 0.2; // how far down the sides of the face the hair reaches (v, −1 top … 1 chin)
  const isHair = (u, v) => v < (L.hairline ?? -0.38)
    || (L.bangs && v < -0.1 && Math.abs(u - fu) < 0.55)
    || (t > 0.2 ? ((u - fu) * -f > 0.45 && v < side + 0.15) || ((u - fu) * f > 0.8 && v < side - 0.2) : Math.abs(u) > 0.74 && v < side);
  s.ell(c, rx, ry, { m: SK, mf: (u, v) => (isHair(u, v) ? L.hair : SK), z: L.z, g: L.g ?? 'head' });
  return () => {
    const ex = c[0] + fu * rx, ey = c[1] + ry * (L.eyeY ?? 0.08), sp = rx * (t > 0.2 ? 0.34 : 0.38);
    const xs = t > 0.8 ? [ex + f * rx * 0.25] : [ex - sp + f * 0.5, ex + sp + f * 0.5];
    for (const x of xs) {
      if (L.eye === 'shut') { s.set(x - 1, ey + 1, OUT).set(x, ey + 1, OUT); continue; }
      s.set(x, ey, OUT).set(x, ey + 1, OUT);
      if (L.eye === 'kid' || L.eye === 'wide') s.set(x + 1, ey, OUT).set(x + 1, ey + 1, OUT).set(x + (f < 0 ? 0 : 1), ey, W, 2);
      if (L.eye === 'wide') s.set(x, ey - 1, OUT).set(x + 1, ey - 1, OUT).set(x, ey, W, 2).set(x + 1, ey, W, 2);
      if (L.eye === 'lash') s.set(x + (x < ex ? -1 : 1), ey - 1, OUT);
      if (L.eye !== 'kid') s.set(x, ey - 2, L.hair, 0).set(x + (x < ex ? -1 : 1), ey - 2 + (L.eye === 'wide' ? -1 : 0), L.hair, 0); // brows
      s.set(x - 0.5, ey + 2.5, 'pink', 1); // blush
    }
    s.shade(ex + f * (t > 0.2 ? 1.5 : 0), ey + 2.5, -1); // nose
    const mx = ex + f * 0.3, my = c[1] + ry * 0.55;
    if (L.mouth === 'o') s.set(mx, my, OUT).set(mx + 1, my, OUT).set(mx, my + 1, OUT).set(mx + 1, my + 1, OUT);
    else if (L.mouth === 'open') s.set(mx - 1, my, 'red', 0).set(mx, my, 'red', 0).set(mx + 1, my, 'red', 0).set(mx, my + 1, 'red', 1);
    else if (L.mouth !== 'none') s.set(mx - 1, my - 1, 'red', 0).set(mx, my, 'red', 0).set(mx + 1, my, 'red', 0).set(mx + 2, my - 1, 'red', 0);
  };
}

// ---------------------------------------------------------------- children (0.6 × 0.6 hitbox, ~1 block tall)
// Run cycle: near/far ankle positions and body bob.
const KRUN = [
  { n: [-6, -1.2], f: [5, -3.5], b: 0 }, { n: [-1.5, -1.2], f: [2, -5], b: -1 },
  { n: [5, -3.5], f: [-6, -1.2], b: 0 }, { n: [2, -5], f: [-1.5, -1.2], b: -1 },
];

function kid(i, girl) {
  const R = KRUN[i], b = R.b, s = new Sprite({ w: 80, h: 70, ox: 40, oy: 60 }), y = (p) => [p[0], p[1] + b];
  for (const [foot, near] of [[R.f, false], [R.n, true]]) {
    const H = y([near ? -0.5 : 1.5, -8]), Kn = ik(H, foot, 4.3, 4.3, -1);
    const o = { z: near ? 1 : 0.5, g: near ? 'legN' : 'legF', dim: near ? 0 : 0.7 };
    if (girl) { s.cap(H, Kn, [1.6, 1.4], { ...o, m: SK }); s.cap(Kn, foot, [1.4, 1.2], { ...o, m: W }); }
    else s.chain([H, Kn, foot], [2, 1.8, 1.6], { ...o, m: 'grey' });
    s.cap(add(foot, [1, -0.1]), add(foot, [girl ? -2 : -2.5, -0.1]), girl ? 1.3 : 1.4, { ...o, m: K, g: o.g + 's', z: o.z + 0.4 });
  }
  const sw = i % 2 ? -1 : 1; // arm pump
  if (girl) {
    s.cap(y([1.5, -17]), y([4.5 + sw, -13.5]), [1.3, 1.1], { m: SK, z: 1.5, g: 'armF', dim: 0.7 });
    s.ell(y([1, -10.8]), 7.4, 5.2, { m: 'pink', z: 2, g: 'dress', mf: (u, v) => (v > 0.62 ? W : undefined) }, -0.15);
    s.cap(y([0.5, -13]), y([-0.5, -18]), [3.1, 3.4], { m: 'pink', z: 2.1, g: 'dress' });
    s.ell(y([-1.6, -17.5]), 1.9, 1.8, { m: 'pink', z: 2.2, g: 'dress' }); // puff sleeve
    s.ell(y([5, -24 + sw * 0.5]), 2.4, 3.2, { m: 'hair', z: 2.5, g: 'tail' }); // ponytail
  } else {
    s.cap(y([1.5, -17]), y([0.5, -14]), 1.8, { m: 'grey', z: 1.5, g: 'armF', dim: 0.7 });
    s.cap(y([0.5, -14]), y([-5, -15]), 1.6, { m: 'grey', z: 1.5, g: 'armF', dim: 0.7 });
    s.cap(y([0.5, -9]), y([-0.5, -18]), [3.8, 3.6, 3.9], { m: 'grey', z: 2, g: 'suit', lift: 0.15 });
    s.ell(y([0.6, -9.5]), 4.3, 2.4, { m: 'grey', z: 2, g: 'suit', lift: 0.15 }); // jacket hangs low: it's too big
  }
  const face = head(s, y([-1.5, -24]), 5.8, 5.6, { hair: girl ? 'hair' : 'orange', z: 4, eye: 'kid', mouth: 'open', hairline: -0.3, side: girl ? 0.45 : 0.05, bangs: true });
  if (girl) {
    s.cap(y([-1.5, -17.5]), y([-4, -14.5]), 1.3, { m: SK, z: 5, g: 'armN' }).cap(y([-4, -14.5]), y([-6.5, -13.5]), 1.2, { m: SK, z: 5, g: 'armN' });
    s.ell(y([-7.5, -11.5]), 3.3, 2.5, { m: 'hair', z: 5.5, g: 'basket', lift: 0.35, tex: (u, v, x, yy) => ((x + yy) % 2 < 1 && v > -0.2 ? -1 : 0) });
  } else {
    s.cap(y([-1.5, -17]), y([-3.5, -13.5]), 1.8, { m: 'grey', z: 5, g: 'armN', lift: 0.15 }).cap(y([-3.5, -13.5]), y([-6, -14]), 1.6, { m: 'grey', z: 5, g: 'armN', lift: 0.15 });
    s.ell(y([-8, -15]), 3.8, 2.3, { m: 'gown', z: 5.5, g: 'pillow', lift: 0.2 });
    s.cap(y([-3, -29]), y([-4.5, -31]), 1, { m: 'orange', z: 4.1, g: 'head' }); // cowlick
  }
  s.resolve();
  face();
  if (girl) {
    for (const [k, x] of [[0, -6], [1, -4], [2, -2], [0, 0], [1, 2]]) s.set(x, -29.4 + b + Math.abs(x + 2) * 0.25, ['magenta', W, 'gold'][k], k === 1 ? 2 : 3); // flower crown
    s.stroke([y([-10.5, -12]), y([-9, -15.5]), y([-6, -15.5]), y([-4.8, -12])], 'hair', 1); // basket handle
    for (const [x, m] of [[-9.5, 'magenta'], [-8, 'pink'], [-6.5, W], [-7.2, 'magenta']]) s.set(x, -14 + b + (x === -7.2 ? -1 : 0), m, 2);
    s.stroke([y([-3, -13]), y([4, -13])], W, 2); // sash
  } else {
    s.set(-1.5, -18.5 + b, W, 2).set(-2.5, -18.5 + b, 'blue', 0).set(-0.5, -18.5 + b, 'blue', 0).set(-1.5, -18.5 + b, 'blue', 1); // bow tie
    s.dot(y([-8, -17.4]), 1.3, 1.1, 'gold', 3).set(-8, -17.4 + b, 'gold', 1); // ring
    s.set(-10.8, -13.5 + b, 'gold', 2).set(-5.2, -13.5 + b, 'gold', 2); // pillow tassels
  }
  return s.finish();
}

// ---------------------------------------------------------------- photographer (1.2 × 1.2 hitbox, big)
// Kneeling behind a camera on a tripod, backing up the aisle toward Rafa while shooting the altar: he faces RIGHT.
function photographer(step, flash) {
  const s = new Sprite({ w: 120, h: 90, ox: 60, oy: 80 }), d = step ? -2 : 0, b = step ? -1 : 0;
  const y = (p) => [p[0] + d * 0.5, p[1] + b];
  // Tripod: three splayed legs under the camera head (it skids along with him).
  for (const [x, z, dim] of [[16, 0, 0.6], [6 + d, 6, 0], [24, 6, 0]]) s.cap([15, -27], [x, -0.6], [1.1, 0.8], { m: 'grey', z, g: 'pod' + x, dim, lift: -0.1 });
  // Far leg kneeling (knee on the floor, shin flat behind), near leg in a squat with the foot planted.
  s.chain([y([-8, -14]), [-2 + d, -3], [-13 + d, -2.5]], [4.4, 3.6, 2.8], { m: K, z: 1, g: 'legF', lift: 0.25, dim: 0.5 });
  s.cap([-12.5 + d, -2.2], [-18.5 + d, -1.6], [2.4, 2], { m: 'hair', z: 1.4, g: 'shoeF', dim: 0.5 });
  const hip = y([-6, -14]), foot = [2 + d * 1.5, -3.5];
  s.chain([hip, ik(hip, foot, 11, 10, 1), foot], [4.6, 3.8, 2.8], { m: K, z: 3, g: 'legN', lift: 0.3 });
  s.cap(add(foot, [-2, 1.4]), add(foot, [5, 1.6]), [2.5, 2.1], { m: 'hair', z: 3.4, g: 'shoeN' });
  // Torso leaning in: blue shirt under a khaki vest; camera bag on the hip.
  s.cap(y([-7, -15]), y([1, -27]), [6.5, 7, 7.5], { m: 'hair', z: 4, g: 'torso', lift: 0.45 });
  s.rect(...y([-17, -19]), 7, 8, { m: K, z: 4.5, g: 'bag', lift: 0.2 }, [0, -0.3, 0.95]);
  s.cap(y([1, -29]), y([6, -24]), [2.6, 2.3], { m: 'blue', z: 2, g: 'armF', dim: 0.6, lift: -0.1 });
  s.cap(y([6, -24]), y([11, -33]), [2.3, 2], { m: 'blue', z: 2, g: 'armF', dim: 0.6, lift: -0.1 });
  const face = head(s, y([5.5, -34]), 5.4, 5.6, { face: 1, turn: 0.9, hair: 'hair', z: 5, eye: 'shut', mouth: 'flat', hairline: -0.25 });
  // Camera: body, lens, flash shoe on top.
  s.rect(...y([9, -38]), 8, 7, { m: K, z: 6, g: 'cam' }, [0, -0.3, 0.95]);
  s.cap(y([16, -34]), y([22, -34]), [2.8, 2.5], { m: K, z: 6.2, g: 'lens', lift: 0.35 });
  s.rect(...y([11, -42]), 4, 4, { m: K, z: 6, g: 'cam', lift: 0.2 }, [0, -0.3, 0.95]);
  s.cap(y([2, -27]), y([8, -22]), [2.7, 2.4], { m: 'blue', z: 7, g: 'armN', lift: -0.05 });
  s.cap(y([8, -22]), y([16, -31]), [2.4, 2], { m: 'blue', z: 7, g: 'armN', lift: -0.05 });
  s.ell(y([17, -31.5]), 1.8, 1.7, { m: SK, z: 7.3, g: 'handN' });
  if (flash) {
    const c = y([13, -45]), rays = [];
    for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, r = k % 2 ? 3 : 8; rays.push(add(c, [Math.cos(a) * r, Math.sin(a) * r * 0.85])); }
    s.poly(rays, { m: W, z: 9, g: 'flash', i: 2 });
    s.ell(c, 2.4, 2.2, { m: 'gold', z: 9.2, g: 'flash', i: 3 });
  }
  s.resolve();
  face();
  // Vest pockets and seam, lanyard, lens glass glint, flash window.
  for (const p of [[-6, -20], [-1, -24]]) { const q = y(p); s.stroke([q, add(q, [3, -1])], 'hair', 1).stroke([add(q, [0, 1]), add(q, [0, 3]), add(q, [3, 2])], 'hair', 2); }
  s.stroke([y([-3, -15]), y([4, -29])], 'hair', 2);
  s.stroke([y([6, -29]), y([9, -26]), y([12, -28])], 'red', 2);
  s.set(...y([22, -35]), 'cyan', 3).set(...y([22, -34]), 'cyan', 1);
  if (!flash) s.set(...y([14, -40]), W, 1);
  return s.finish();
}

// ---------------------------------------------------------------- waiter (0.9 × 1.2 hitbox, big; tray not in it)
const WALK = [
  { n: [-7, -2.2], f: [6, -2.2], b: 0, t: 0 }, { n: [-1, -3.5], f: [1, -2.2], b: -1, t: 1 },
  { n: [6, -2.2], f: [-7, -2.2], b: 0, t: 0 }, { n: [1, -2.2], f: [-1, -3.5], b: -1, t: -1 },
];
function flute(s, base, ang, z) {
  const up = [Math.sin(ang), -Math.cos(ang)], p = (k) => add(base, mul(up, k));
  s.cap(p(0), p(3), 0.5, { m: 'grey', z, g: 'gl' + base[0], i: 3 });
  s.cap(p(3.5), p(7.5), [1.1, 1.5], { m: 'cyan', z, g: 'gl' + base[0], i: 3, mf: (u) => (u < 2.5 ? 'gold' : undefined) });
}
function waiter(i, spill) {
  const s = new Sprite({ w: 120, h: 110, ox: 60, oy: 95 });
  const R = spill ? { n: [-5, -2.2], f: [9, -6], b: 0, t: 0 } : WALK[i], b = R.b, lean = spill ? 5 : 0;
  const y = (p, k = 1) => [p[0] + lean * k * (-p[1] / 50), p[1] + b];
  for (const [foot, near] of [[R.f, false], [R.n, true]]) {
    const H = y([near ? -1 : 1.5, -21], 0.4), Kn = ik(H, foot, 10, 10, -1);
    const o = { z: near ? 2 : 0.5, g: near ? 'legN' : 'legF', dim: near ? 0 : 0.6, m: K, lift: 0.45 };
    s.chain([H, Kn, foot], [3.2, 2.8, 2.3], o);
    s.cap(add(foot, [1.5, 0.6]), add(foot, [-4, 0.8]), [2, 1.8], { ...o, g: o.g + 's', z: o.z + 0.4, lift: 0.5 });
  }
  // Far arm: towel over the forearm at the waist (or flung up when he spills).
  const fa = spill ? [y([-3, -36]), y([-10, -42]), y([-13, -50])] : [y([-3, -36]), y([-6, -28]), y([-11, -28])];
  s.chain(fa, [2.6, 2.3, 2], { m: W, z: 1, g: 'armF', dim: 0.5 });
  if (!spill) s.rect(...y([-13, -29]), 4, 7, { m: 'gown', z: 1.2, g: 'towel', i: 3 });
  // Torso: white shirt, wine vest (reads on the dark hall), long white apron from the waist down.
  s.cap(y([0, -21]), y([-0.5, -35]), [5, 5.2, 6.2], { m: 'tie', z: 3, g: 'torso', lift: 0.05, mf: (u, v) => (v < -0.45 && u > 6 ? W : undefined) });
  const ap = R.t;
  s.poly([y([-6.5, -24]), y([5.5, -24]), y([6.5 + ap, -8]), y([-7.5 + ap, -8])], { m: 'gown', z: 3.5, g: 'apron', i: 3 }, [0, 0, 1]);
  const face = head(s, y([-2.5, -46]), 6.6, 7, { hair: K, z: 5, turn: 0.55, eye: spill ? 'wide' : 'adult', mouth: spill ? 'o' : 'none', hairline: -0.3, side: 0 });
  // Near arm up under the tray (it flies off when he spills).
  const na = spill ? [y([2, -36]), y([9, -44]), y([15, -50])] : [y([2, -36]), y([8, -43]), y([5, -52])];
  s.chain(na, [2.8, 2.5, 2.2], { m: W, z: 6, g: 'armN' });
  s.ell(na[2], 1.9, 1.7, { m: SK, z: 6.3, g: 'hand' });
  const tray = spill ? y([18, -62]) : add(na[2], [i % 2 ? 0.5 : -0.5, -3]);
  const tang = spill ? 0.6 : 0;
  s.ell(tray, 11, 1.8, { m: 'grey', z: 7, g: 'tray', lift: 0.2 }, tang);
  if (spill) {
    flute(s, y([8, -68]), -0.8, 8); flute(s, y([22, -74]), 1.4, 8); flute(s, y([27, -60]), 2.6, 8);
    for (const [dx, dy] of [[12, -70], [15, -73], [18, -69], [25, -66], [21, -78]]) s.ell(y([dx, dy]), 1, 1, { m: 'gold', z: 8.5, g: 'drop' + dx, i: 3 });
  } else for (const dx of [-6, -1, 4]) flute(s, add(tray, [dx, -1.6]), dx * 0.01, 8);
  s.resolve();
  face();
  const hc = y([-2.5, -46]);
  s.stroke([add(hc, [-6, 3]), add(hc, [-3, 2.5]), add(hc, [-1, 3.5])], K, 1); // moustache
  s.set(...add(y([-2, -36]), [-3, 0]), K, 1).set(...add(y([-2, -36]), [-1, 0]), K, 1).set(...add(y([-2, -36]), [-2, 0]), K, 3); // bow tie
  s.stroke([y([-6, -24]), y([5, -24])], K, 2); // apron string
  return s.finish();
}

// ---------------------------------------------------------------- altar stand-ins (~2.4 blocks, facing the viewer)
// Idle sway: frame 1 shifts the upper body 1 px and lets it settle 1 px.
const swayY = (p, k, base = -40) => [p[0] + (k && p[1] < base ? 1 : 0), p[1] + (k && p[1] < base ? 1 : 0)];

function bride(k) {
  const s = new Sprite({ w: 100, h: 100, ox: 50, oy: 90, clipY: 0 }), y = (p) => swayY(p, k);
  // Veil behind: falls from the bun to the hips on her right.
  s.poly([y([1, -70]), y([7, -66]), y([13, -38]), y([9, -30]), y([3, -42])], { m: 'gown', z: 0, g: 'veil', i: 3 });
  s.cap([0, -42], [0, -6], [5, 9, 14, 17], { m: 'gown', z: 1, g: 'gown' });
  s.cap(y([0, -43]), y([0, -54]), [5, 6.4], { m: 'gown', z: 1.2, g: 'gown' });
  s.ell(y([0, -56]), 7, 2.8, { m: SK, z: 1.3, g: 'gown' }); // shoulders above the strapless bodice
  for (const sx of [-1, 1]) s.chain([y([sx * 6.5, -56]), y([sx * 7.5, -47]), y([sx * 2.5, -40])], [2, 1.8, 1.5], { m: SK, z: 2, g: 'arm' + sx });
  const face = head(s, y([0, -64]), 6.2, 6.8, { hair: 'hair', z: 3, turn: 0.15, eye: 'lash', mouth: 'smile', hairline: -0.35, side: 0.35 });
  s.ell(y([4.5, -70]), 3, 2.8, { m: 'hair', z: 2.9, g: 'bun' });
  s.ell(y([0, -39]), 4.6, 3.8, { m: 'green', z: 4, g: 'bouquet' });
  s.resolve();
  face();
  for (const [dx, dy, m] of [[-2, -41, W], [0, -42, 'pink'], [2, -41, W], [-3, -39, 'magenta'], [1, -39, W], [3, -38, 'pink'], [-1, -37, W]])
    s.dot(y([dx, dy]), 1, 1, m, 2);
  s.stroke([y([0, -36]), y([-1, -30])], W, 2).stroke([y([1, -36]), y([2, -31])], W, 1); // ribbon
  for (const x of [-9, -4, 4, 9]) s.dstroke([[x * 0.35, -40], [x, -2]]); // skirt folds
  s.set(...y([-3, -70]), 'gold', 3).set(...y([-2, -71]), W, 2).set(...y([-4, -71]), W, 2); // hair flowers
  return s.finish();
}

function groom(k) {
  const s = new Sprite({ w: 100, h: 100, ox: 50, oy: 90, clipY: 1 }), y = (p) => swayY(p, k);
  for (const sx of [-1, 1]) {
    s.cap([sx * 3.4, -34], [sx * 3.6, -4], [4, 3.4], { m: K, z: 1, g: 'leg' + sx, lift: 0.1 });
    s.ell([sx * 4, -2], 3.4, 2.1, { m: K, z: 1.5, g: 'shoe' + sx, lift: 0.4 });
  }
  s.cap(y([0, -33]), y([0, -53]), [7.2, 7, 8.4], { m: K, z: 2, g: 'jacket', lift: -0.1 });
  s.poly([y([-3.5, -58]), y([3.5, -58]), y([0, -45])], { m: W, z: 2.5, g: 'shirt', i: 2 });
  for (const sx of [-1, 1]) s.chain([y([sx * 7.5, -52]), y([sx * 8.5, -42]), y([sx * 2, -35])], [2.8, 2.5, 2.2], { m: K, z: 3, g: 'arm' + sx, lift: -0.1 });
  s.ell(y([0, -34]), 2.6, 2, { m: SK, z: 3.4, g: 'hands' });
  const face = head(s, y([0, -63]), 6.2, 6.8, { hair: K, z: 4, turn: 0.15, eye: 'adult', mouth: 'smile', hairline: -0.3, side: -0.05, bangs: true });
  s.resolve();
  face();
  s.stroke([y([0, -55]), y([0, -48])], 'blue', 0).set(...y([0, -55]), 'blue', 1); // tie
  s.stroke([y([-4, -55]), y([-1, -46])], K, 4).stroke([y([4, -55]), y([1, -46])], K, 4); // lapel edges
  s.set(...y([0, -43]), K, 5).set(...y([0, -39]), K, 5); // buttons
  s.dot(y([-4.5, -51]), 1.3, 1.3, W, 2).set(...y([-4.5, -51]), 'red', 2).set(...y([-4, -49.5]), 'green', 2); // boutonnière
  for (const sx of [-1, 1]) s.set(...y([sx * 3, -35]), W, 2); // cuffs
  return s.finish();
}

// Priest at the altar, glancing at his watch (frame 1 taps it).
function priest(k) {
  const s = new Sprite({ w: 100, h: 100, ox: 50, oy: 90, clipY: 0 });
  s.cap([0, -46], [0, -6], [7, 8.5, 10.5, 11], { m: K, z: 1, g: 'robe', lift: 0.3 });
  s.cap([0, -46], [0, -53], [7.4, 8], { m: K, z: 1, g: 'robe', lift: 0.3 });
  s.poly([[-4, -54], [-2, -54], [-2.5, -14], [-5, -14]], { m: 'gold', z: 1.5, g: 'stole', i: 2 });
  s.poly([[2, -54], [4, -54], [5, -14], [2.5, -14]], { m: 'gold', z: 1.5, g: 'stole', i: 1 });
  s.chain([[7.5, -52], [9, -42], [7, -34]], [2.8, 2.6, 2.3], { m: K, z: 2, g: 'armR', lift: 0.3 });
  s.ell([6.5, -32.5], 1.9, 1.8, { m: SK, z: 2.3, g: 'armR' });
  const wrist = k ? [-2, -50] : [-3, -48];
  s.chain([[-7.5, -52], [-9, -44], wrist], [2.8, 2.6, 2.3], { m: K, z: 3, g: 'armL', lift: 0.3 });
  const face = head(s, [0, -62], 6.2, 6.8, { hair: 'grey', z: 2.5, turn: 0.1, eye: 'shut', mouth: 'flat', hairline: -0.1 });
  s.ell([0, -66.5], 4.6, 2.6, { m: SK, z: 2.6, g: 'head' }); // bald crown
  s.resolve();
  face();
  s.set(-1, -56, W, 2).set(0, -56, W, 2); // collar tab
  s.dot(add(wrist, [1, 0]), 1.3, 1.2, 'gold', 2).set(wrist[0] + 1, wrist[1], W, 2); // watch
  if (k) s.set(wrist[0] + 3, wrist[1] - 1, SK, 3).set(wrist[0] + 3, wrist[1], SK, 2); // tapping finger
  return s.finish();
}

const frames = [
  ...[0, 1].map((k) => ({ name: `photographer_${k}`, ...photographer(k, false) })),
  { name: 'photographer_flash', ...photographer(0, true) },
  ...KRUN.map((_, i) => ({ name: `flowerGirl_${i}`, ...kid(i, true) })),
  ...KRUN.map((_, i) => ({ name: `ringBearer_${i}`, ...kid(i, false) })),
  ...WALK.map((_, i) => ({ name: `waiter_${i}`, ...waiter(i, false) })),
  { name: 'waiter_spill', ...waiter(0, true) },
  ...[0, 1].map((k) => ({ name: `bride_${k}`, ...bride(k) })),
  ...[0, 1].map((k) => ({ name: `groom_${k}`, ...groom(k) })),
  ...[0, 1].map((k) => ({ name: `priest_${k}`, ...priest(k) })),
];
export const church = frames.filter((f) => !f.name.startsWith('waiter'));
export const party = frames.filter((f) => f.name.startsWith('waiter'));
