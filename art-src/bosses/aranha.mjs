// O Aranha da Carreta: a parametric figure. A pose is joint positions in art px (ground at y = 0, x right, he faces
// left); figure() draws shaded capsules for limbs, the off-model costume, eyes, emblem and sneakers over them.
// To add a pose: copy one below, move joints, `npm run bake:bosses`, look at shots/bosses/aranha.png.
import { Sprite, OUT } from './raster.mjs';

// Drawn at D canvas px per art px (the sheet characters' density); the atlas meta.scale 3/D keeps his world size.
export const D = 4;

const R = 'red', B = 'blue', K = 'black', W = 'white';
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const rot = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
const segDist = (p, a, b) => {
  const d = sub(b, a), t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1] || 1)));
  return len(sub(p, add(a, mul(d, t))));
};
// Calls fn(x, y) once for every canvas pixel within w/2 art px of the polyline (painted details at any density).
function brush(s, pts, w, fn) {
  const k = s.k, r = w / 2, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  for (let y = Math.floor((Math.min(...ys) - r) * k); y <= Math.ceil((Math.max(...ys) + r) * k); y++)
    for (let x = Math.floor((Math.min(...xs) - r) * k); x <= Math.ceil((Math.max(...xs) + r) * k); x++) {
      const p = [(x + 0.5) / k, (y + 0.5) / k];
      if (pts.some((a, i) => i && segDist(p, pts[i - 1], a) <= r)) fn(p[0], p[1]);
    }
}
// Painted over the body only (or only over part g, when given).
const on = (s, x, y, g) => s.get(x, y) !== null && (!g || s.grp[s.at(x, y)] === g);
const ink = (s, pts, w, m, tone = 0, g) => brush(s, pts, w, (x, y) => on(s, x, y, g) && s.set(x, y, m, tone));
const crease = (s, pts, w = 0.4, g) => brush(s, pts, w, (x, y) => on(s, x, y, g) && s.shade(x, y, -1));
// Costume seams: a pixel next to another material of the same part takes its ramp's darkest tone (crisp pattern lines).
function seams(s) {
  const hit = [];
  for (let i = 0; i < s.mat.length - s.w; i++) {
    const m = s.mat[i];
    if (m && m !== OUT) for (const j of [i + 1, i + s.w]) if (s.mat[j] && s.mat[j] !== OUT && s.mat[j] !== m && s.grp[j] === s.grp[i]) { hit.push(i); break; }
  }
  for (const i of hit) s.idx[i] = 0;
}

// Own web pattern: slightly curved thin rings around the limbs, one tone darker (never a faithful grid).
const rings = (u, v) => (((u + v * v * 1.8) % 4) + 4) % 4 < 0.4 ? -1 : 0;

// A gloved hand: mitten with a thumb on the `thumb` side (±1) of wrist→tip, or a fist with the thumb wrapped over it.
function arm(s, a, o) {
  const [sh, el, wr, tip] = a.p, d = unit(sub(tip, wr)), n = mul([-d[1], d[0]], a.thumb ?? 1);
  s.ell(sh, 3.7, 3.7, { ...o, m: R, tex: rings }); // deltoid
  s.cap(sh, el, [3.5, 3.3, 2.5], { ...o, m: R, tex: rings });
  const fo = { ...o, g: o.g + 'fore', z: o.z + 0.4 }; // the forearm's own contour breaks the line at the elbow
  s.cap(el, wr, [2.6, 2.4, 1.7], { ...fo, m: R, tex: rings });
  const ho = { ...fo, g: o.g + 'hand', z: fo.z + 0.35, m: R }, to = { ...ho, g: o.g + 'thumb', z: ho.z + 0.1 };
  if (a.fist) {
    const c = add(wr, mul(d, 1.6));
    s.ell(c, 2.5, 2.3, ho, Math.atan2(d[1], d[0]));
    s.cap(add(c, add(mul(n, 1.4), mul(d, -0.9))), add(c, add(mul(n, 0.7), mul(d, 1.1))), [1.0, 0.85], to);
  } else {
    s.cap(add(wr, mul(d, 0.6)), tip, a.hand ?? [2.0, 2.2, 1.4], ho);
    s.cap(add(add(wr, mul(d, 1.2)), mul(n, 1.2)), add(add(wr, mul(d, 2.6)), mul(n, 2.5)), [1.0, 0.8], to);
  }
}

function leg(s, l, o) {
  const [hip, kn, an] = l.p;
  s.cap(hip, kn, [4.4, 4.2, 3.3], { ...o, g: o.thighG ?? o.g, m: B, lift: -0.12 });
  s.cap(kn, an, [3.5, 3.6, 2.4], { ...o, g: o.g + 'shin', z: o.z + 0.4, m: B, lift: -0.12 }); // knee break
  shoe(s, l, { ...o, g: o.g + 'shoe', z: o.z + 0.8 });
}

// Chunky high-top sneaker worn over the suit, built in a foot frame: x toward the toe, y up from the sole. The ankle sits
// at (2.5, 5), so a planted foot has its ankle 5 px above the ground. Black canvas, white rubber sole and toe cap.
function shoe(s, l, o) {
  const an = l.p[2], dir = unit(l.dir ?? [-1, 0]), n = l.flen ?? 10;
  let up = [dir[1], -dir[0]];
  if (up[0] * (l.p[1][0] - an[0]) + up[1] * (l.p[1][1] - an[1]) < 0) up = mul(up, -1);
  const O = sub(sub(an, mul(dir, 2.5)), mul(up, 5)), f = (x, y) => add(O, add(mul(dir, x), mul(up, y)));
  const ang = Math.atan2(dir[1], dir[0]);
  s.ell(f(2.4, 4.6), 2.6, 2.6, { ...o, m: K, lift: -0.3 }); // high-top collar
  s.cap(f(1.8, 3.0), f(n - 2.4, 2.4), [2.8, 2.4], { ...o, m: K, lift: -0.3 });
  s.ell(f(n - 1.9, 1.9), 1.9, 1.4, { ...o, m: W, z: o.z + 0.1, i: 2 }, ang); // toe cap
  s.cap(f(0.4, 1.1), f(n - 0.4, 1.1), 1.1, { ...o, m: W, z: o.z + 0.2, i: 1 });
  l.foot = f; // for the laces, painted after resolve
}

function figure(P) {
  const s = new Sprite({ w: 240 * D, h: 220 * D, ox: 120 * D, oy: 200 * D, k: D * (P.k ?? 1), clipY: (P.clipY ?? Infinity) * D, ol: 3, il: 2, dither: 0 });
  const Z = { armF: 1, legF: 2, torso: 3, legN: 4, head: 5, armN: 6, ...P.z };
  arm(s, P.armF, { z: Z.armF, g: 'armF', dim: 1 });
  leg(s, P.legF, { z: Z.legF, g: 'legF', dim: 0.6 });

  // Torso: one tapered capsule pelvis→sternum. Costume: red yoke and a red V down the front, blue sides.
  const { pelvis, chest, face = 0 } = P;
  const tl = len(sub(chest, pelvis));
  const torsoMat = (u, v) => { const t = u / tl; return t > (P.yoke ?? 0.6) || Math.abs(v - face) < 0.85 * (t - 0.12) ? R : B; };
  const to = { z: Z.torso, g: 'torso' };
  s.ell(pelvis, P.hipR + 0.6, P.hipR * 0.85, { ...to, m: B });
  s.cap(pelvis, chest, [P.hipR, P.waistR, P.chestR * 0.95, P.chestR], { ...to, mf: torsoMat,
    tex: (u, v) => (torsoMat(u, v) === R && !(P.emblemK && Math.abs(u - tl * 0.78) < 3.5 && Math.abs(v - face * 0.95) < 0.55) ? rings(u, (v - face) * 1.5) : 0) });
  s.cap(P.neck, add(P.head.c, [0, 2]), 2.4, { ...to, m: R });

  leg(s, P.legN, { z: Z.legN, g: 'legN', thighG: 'torso' }); // near thigh grows out of the hips, no contour

  // Head: a big round chibi mask with a little chin (HK× the old head, its crown where it was), thin radial seams
  // from the face centre.
  const H = P.head, tilt = H.tilt ?? 0, HK = 1.35, c0 = add(H.c, rot([0, (HK - 1) * 6.5], tilt));
  const hp = (x, y) => add(c0, rot([x * HK, y * HK], tilt));
  const fc = [H.turn * 2.9, 0.7]; // face centre in head space
  const ho = { z: Z.head, g: 'head', m: R, tex: (u, v, x, y) => {
    const d = rot(sub([x + 0.5 / s.k, y + 0.5 / s.k], hp(...fc)), -tilt), a = Math.atan2(d[1], d[0]), q = ((a / Math.PI) * 3.5 + 8) % 1;
    return Math.min(q, 1 - q) * (2 * Math.PI / 7) * len(d) < 0.22 && len(d) > 3 ? -1 : 0;
  } };
  s.ell(c0, 5.6 * HK, 6.3 * HK, ho, tilt);
  s.ell(hp(H.turn * 2.0, 3.6), 3.6 * HK, 2.8 * HK, ho, tilt);

  arm(s, P.armN, { z: Z.armN, g: 'armN' });
  P.pre?.(s);
  s.resolve();
  seams(s);

  // Lopsided eyes, tilted outward, with thick dark rims; the near one bigger. In profile only the front one shows.
  // Dazed: crossed out.
  const eye = (c, rx, ry, ang) => {
    s.dot(c, rx + 0.8, ry + 0.8, OUT, 0, false, ang).dot(c, rx, ry, W, 1, false, ang).dot(add(c, rot([-0.25, -0.35], ang)), rx * 0.82, ry * 0.8, W, 2, false, ang);
    if (P.dazed) for (const q of [[-1, -1], [1, -1]]) ink(s, [add(c, [q[0] * rx * 0.8, q[1] * ry * 0.8]), add(c, [-q[0] * rx * 0.8, -q[1] * ry * 0.8])], 0.7, OUT);
  };
  if (H.turn > -0.8) eye(hp(fc[0] - 2.5, -1.1), 1.45 * HK, 2.0 * HK, tilt + 0.3);
  eye(hp(fc[0] + (H.turn > -0.8 ? 2.1 : -0.7), -1.8), 1.9 * HK, 2.5 * HK, tilt - 0.35);

  // Muscle form on the torso: pec crease under the chest and a centre line down the abs.
  const up = unit(sub(chest, pelvis)), side = [-up[1], up[0]];
  const TP = (t, v) => add(add(pelvis, mul(up, tl * t)), mul(side, v * (P.waistR + (P.chestR - P.waistR) * t)));
  crease(s, [TP(0.6, face - 0.75), TP(0.55, face - 0.1), TP(0.6, face + 0.55)], 0.4, 'torso');
  crease(s, [TP(0.48, face), TP(0.22, face)], 0.4, 'torso');
  // Emblem: a wonky little spider/asterisk on the sternum, a fat body and six uneven legs.
  const E = TP(0.78, face * 0.95), ek = P.emblemK ?? 1;
  if (!P.noEmblem) {
    for (const [dx, dy] of [[-2, -2], [2, -3], [-3, 0], [3, 1], [-2, 2], [2, 3]]) ink(s, [E, add(E, mul([dx, dy], ek))], 0.45, OUT, 0, 'torso');
    brush(s, [add(E, [0.3, -0.1]), add(E, [0.3, 0.7])], 1.8, (x, y) => on(s, x, y, 'torso') && s.set(x, y, OUT));
  }

  // Baggy suit: two fold creases on the inside of each bent knee and elbow.
  for (const [a, j, c] of P.folds ?? []) {
    const bis = unit(add(unit(sub(a, j)), unit(sub(c, j)))), pp = [-bis[1], bis[0]];
    for (const k of [-1.3, 1.3]) crease(s, [add(j, add(mul(bis, 1.5), mul(pp, k))), add(j, add(mul(bis, 3.2), mul(pp, k * 1.6)))], 0.35);
  }
  // Suit legs bunch up over the sneaker collars.
  for (const l of [P.legN, P.legF]) {
    const [, kn, an] = l.p, d = unit(sub(kn, an)), pp = [-d[1], d[0]];
    for (const k of [4.2, 6.5]) { const c = add(an, mul(d, k)); crease(s, [add(c, mul(pp, -2.2)), add(c, mul(d, 0.7)), add(add(c, mul(pp, 2.2)), mul(d, 0.4))], 0.35); }
  }
  // Glove fingers: creases down the open hand.
  for (const a of [P.armN, P.armF]) if (!a.fist) {
    const d = sub(a.p[3], a.p[2]), n = mul(unit([-d[1], d[0]]), 0.8);
    for (const k of a.grip ? [-1, 0, 1] : [-0.5, 0.5]) crease(s, [add(add(a.p[2], mul(d, 0.55)), mul(n, k)), add(add(a.p[3], mul(d, -0.1)), mul(n, k))], 0.3);
  }
  // Sneaker laces: three short white bars across the instep, just under its top edge.
  for (const l of [P.legN, P.legF]) for (const x of [4.2, 5.5, 6.8]) { const t = 5.6 - (x - 4.2) * 0.3; ink(s, [l.foot(x, t - 0.2), l.foot(x + 0.3, t - 1.0)], 0.45, W, 1); }
  P.post?.(s);
  return s.finish(P.pivot);
}

const legFolds = (l) => [[l.p[0], l.p[1], l.p[2]]];
const armFolds = (a) => [[a.p[0], a.p[1], a.p[2]]];
const withFolds = (P) => ({ ...P, folds: [...legFolds(P.legN), ...legFolds(P.legF), ...armFolds(P.armN), ...armFolds(P.armF)] });
// Beat bounce: everything above the ground sinks by k px at the head, proportionally less lower down; feet stay put.
const sink = (P, k) => {
  const top = 50, f = (p) => [p[0], p[1] + (k * -p[1]) / top];
  const limb = (l) => ({ ...l, p: l.p.map(f) });
  return { ...P, pelvis: f(P.pelvis), chest: f(P.chest), neck: f(P.neck), head: { ...P.head, c: f(P.head.c) },
    armN: limb(P.armN), armF: limb(P.armF), legN: { ...P.legN, p: [f(P.legN.p[0]), f(P.legN.p[1]), P.legN.p[2]] },
    legF: { ...P.legF, p: [f(P.legF.p[0]), f(P.legF.p[1]), P.legF.p[2]] } };
};

// Hips (and everything above) drop d px, knees half that; feet stay planted.
const drop = (P, d) => {
  const f = (p) => [p[0], p[1] + d], leg = (l) => ({ ...l, p: [f(l.p[0]), [l.p[1][0], l.p[1][1] + d / 2], l.p[2]] });
  return { ...P, pelvis: f(P.pelvis), chest: f(P.chest), neck: f(P.neck), head: { ...P.head, c: f(P.head.c) },
    armN: { ...P.armN, p: P.armN.p.map(f) }, armF: { ...P.armF, p: P.armF.p.map(f) }, legN: leg(P.legN), legF: leg(P.legF) };
};

// Pose 1 (reference photo 1): deep one-sided funk squat, 3/4 front, chest to us. Hips almost on the heels; the
// viewer-left leg folded flat (knee out at waist height, sneaker in front under the hips), the viewer-right leg
// stretched out right with a half-bent knee; left arm hangs straight down between the knees, right hand rests on the
// right knee; head tilted and turned to the left, looking down at Rafa.
const POSE1 = {
  pelvis: [-2, -8], chest: [-0.5, -23], neck: [-1.5, -26], face: -0.2, chestR: 7.2, waistR: 5.0, hipR: 6.0, yoke: 0.55,
  head: { c: [-3.5, -37], turn: -0.5, tilt: 0.15 },
  legN: { p: [[-6, -8], [-19, -13], [-10, -5]], dir: [-1, 0.12], flen: 10 },
  legF: { p: [[2, -9], [11, -12.5], [19, -5]], dir: [1, 0] },
  armN: { p: [[-7.5, -22], [-7, -13.5], [-5.5, -6], [-5, -1.5]] },
  armF: { p: [[6.5, -22], [10.5, -16.5], [13.5, -13], [15.5, -10.5]] },
  z: { armF: 5, head: 5.5 },
};

// Pose 2 (reference photo 2): side view facing left, a sit-back squat dancing at Rafa. Feet flat a shoulder-width
// apart, shins upright, thighs level back to the hips (the backside is his rightmost point), straight back pitched
// ~55° forward; near arm reaching forward level with a limp wrist, the hand hanging down; far hand low by the knee.
const POSE2 = {
  pelvis: [11, -20], chest: [-1, -31], neck: [-5, -34], face: -0.1, chestR: 6.8, waistR: 5.2, hipR: 6.4, yoke: 0.62,
  emblemK: 1.3, head: { c: [-12, -42.5], turn: -0.75, tilt: 0.3 },
  legN: { p: [[10, -20], [-6, -20.5], [-5, -5]] },
  legF: { p: [[13, -21], [1, -21.5], [3, -5]] },
  armN: { p: [[-4, -29.5], [-13, -28.5], [-21, -27], [-22, -22.5]], grip: true, hand: [2.2, 2.4, 1.6] },
  armF: { p: [[1, -30], [-5, -23], [-10.5, -16], [-12, -12]], grip: true },
  z: { armN: 6.5 },
};

// Standing figure ~2.5 blocks: ankle 5, knee ~23, pelvis ~42, sternum ~59, head centre ~72 px above the ground.
// Passinho: kick-tap forward, bounce, kick back, bounce with knees in; fists pump opposite to the feet.
const STEP = [
  { pelvis: [1, -40], chest: [-1, -57], neck: [-2, -62], face: -0.5, chestR: 7.6, waistR: 5.2, hipR: 6.0,
    head: { c: [-4, -69], turn: -0.7, tilt: -0.05 },
    legF: { p: [[3, -40], [0, -22], [4, -5]] },
    legN: { p: [[-1, -40], [-11, -27], [-16, -13]], dir: [-1, 0.45] },
    armN: { p: [[1, -56], [7, -46], [3, -38], [2, -34]], fist: true },
    armF: { p: [[-3, -57], [-12, -51], [-16, -59], [-17, -62]], fist: true } },
  { pelvis: [0, -36], chest: [-2, -53], neck: [-3, -58], face: -0.5, chestR: 7.6, waistR: 5.2, hipR: 6.0,
    head: { c: [-5, -65], turn: -0.7, tilt: 0.05 },
    legN: { p: [[-2, -36], [-11, -21], [-8, -5]] },
    legF: { p: [[3, -36], [10, -20], [9, -5]], dir: [1, 0] },
    armN: { p: [[0, -52], [-4, -43], [-12, -45], [-15, -46]], fist: true, split: true },
    armF: { p: [[-4, -53], [-9, -44], [-16, -47], [-18, -48]], fist: true } },
  { pelvis: [-1, -40], chest: [-2, -57], neck: [-3, -62], face: -0.5, chestR: 7.6, waistR: 5.2, hipR: 6.0,
    head: { c: [-5, -69], turn: -0.7, tilt: -0.05 },
    legN: { p: [[-2, -40], [-5, -22], [-4, -5]] },
    legF: { p: [[2, -40], [9, -27], [15, -16]], dir: [-0.35, 1] },
    armN: { p: [[0, -56], [-8, -50], [-12, -58], [-13, -61]], fist: true },
    armF: { p: [[-3, -57], [3, -47], [0, -39], [-1, -35]], fist: true } },
  { pelvis: [0, -36], chest: [-2, -53], neck: [-3, -58], face: -0.5, chestR: 7.6, waistR: 5.2, hipR: 6.0,
    head: { c: [-5, -65], turn: -0.7, tilt: 0.05 },
    legN: { p: [[-2, -36], [1, -21], [-6, -5]] },
    legF: { p: [[3, -36], [4, -21], [10, -5]], dir: [1, 0] },
    armN: { p: [[0, -52], [7, -47], [12, -53], [14, -56]], fist: true },
    armF: { p: [[-4, -53], [-12, -49], [-17, -55], [-19, -58]], fist: true } },
];

// Web fling: wind up with the near fist cocked behind the head, then lunge and fling it forward-down, hand open.
const WEB = [
  { pelvis: [3, -38], chest: [4, -55], neck: [3, -60], face: -0.4, chestR: 7.6, waistR: 5.2, hipR: 6.0,
    head: { c: [0, -67], turn: -0.7, tilt: -0.1 },
    legN: { p: [[1, -38], [-10, -25], [-14, -5]] },
    legF: { p: [[5, -38], [10, -21], [11, -5]], dir: [1, 0] },
    armF: { p: [[1, -55], [-9, -53], [-18, -55], [-22, -55]] },
    armN: { p: [[6, -54], [14, -59], [12, -69], [11, -72]], fist: true, split: true } },
  { pelvis: [0, -34], chest: [-8, -50], neck: [-11, -55], face: -0.55, chestR: 7.6, waistR: 5.2, hipR: 6.0,
    head: { c: [-15, -60], turn: -0.85, tilt: 0.15 },
    legN: { p: [[-3, -34], [-16, -22], [-17, -5]] },
    legF: { p: [[3, -34], [12, -20], [20, -5]], dir: [1, 0] },
    armN: { p: [[-6, -49], [-17, -43], [-28, -40], [-33, -40]] },
    armF: { p: [[-8, -51], [1, -46], [7, -51], [9, -54]], fist: true } },
];

// Backflip: take-off stretch on the toes, tight tuck (also the spinning spiderDive hazard), opening out to land.
const FLIP = [
  // Take-off: hips thrust toward Rafa, back arched, arms thrown up and back, one toe pushing off, the other leg kicking up.
  { pelvis: [-4, -42], chest: [1, -58], neck: [4, -63], face: -0.35, chestR: 7.2, waistR: 5, hipR: 5.8,
    head: { c: [7, -68], turn: -0.6, tilt: 0.6 },
    legN: { p: [[-5, -42], [-6, -24], [-3, -12]], dir: [-0.35, 1] },
    legF: { p: [[-2, -43], [-14, -36], [-19, -24]], dir: [-1, 0.2] },
    armN: { p: [[0, -57], [3, -69], [8, -79], [10, -82]], fist: true },
    armF: { p: [[4, -58], [10, -67], [16, -75], [18, -77]], fist: true },
    post: (s) => {
      for (const [x, y, r] of [[-8.5, -1.5, 1.3], [-11, -1, 0.9], [-1.5, -1.5, 1.2], [1, -1, 0.8]]) s.dot([x, y], r, r * 0.8, 'white', 1); // dust puff
      for (const [a, b] of [[[14, -88], [20, -84]], [[20, -84], [23, -78]], [[23, -84], [26, -79]]]) s.lateLine(a, b, 'white', 1); // whoosh
    } },
  { k: 1.3, pelvis: [7, -9], chest: [4, -25], neck: [0, -29], face: -0.8, chestR: 6.8, waistR: 5.6, hipR: 6.2, yoke: 0.45,
    head: { c: [-6, -27], turn: -0.9, tilt: 1.0 },
    legN: { p: [[5, -10], [-9, -16], [-2, -7]], dir: [1, 0.3], flen: 9 },
    legF: { p: [[8, -11], [-6, -19], [1, -10]], dir: [1, 0.2], flen: 9 },
    armN: { p: [[2, -24], [-4, -18], [-9, -11], [-10, -9]], fist: true },
    armF: { p: [[4, -25], [-2, -20], [-7, -14], [-8, -12]], fist: true },
    z: { armF: 0, legF: 1, torso: 2, legN: 4, armN: 6, head: 3 } },
  { pelvis: [2, -34], chest: [-5, -50], neck: [-7, -55], face: -0.5, chestR: 7.6, waistR: 5.2, hipR: 6.0,
    head: { c: [-10, -61], turn: -0.75, tilt: 0.3 },
    legN: { p: [[0, -34], [-11, -24], [-18, -14]], dir: [-0.6, 1] },
    legF: { p: [[4, -34], [-4, -21], [-8, -9]], dir: [-0.5, 1] },
    armN: { p: [[-3, -49], [6, -55], [15, -58], [19, -58]] },
    armF: { p: [[-6, -51], [1, -60], [6, -67], [8, -70]] } },
];

// Wrapped in his own web: a cocoon from shoulders to shins, only the dazed head, one hand and the sneakers stick out.
const cocoon = (s) => {
  const o = { m: 'white', z: 7, g: 'web', tex: (u, v, x, y) => ((((x * 0.8 + y) % 6) + 6) % 6 < 0.4 ? -1 : 0) };
  s.ell([2, -46], 10.5, 15, o, 0.12).ell([1, -27], 8.5, 13, o, 0.05).ell([0, -14], 6.5, 6, o);
};
const strands = (s) => { s.lateLine([10, -55], [17, -60], 'white', 1); s.lateLine([-8, -38], [-14, -42], 'white', 1); s.lateLine([7, -12], [13, -9], 'white', 1); };
const DEFEAT = [
  { pelvis: [1, -38], chest: [3, -55], neck: [3, -60], face: -0.4, chestR: 6.6, waistR: 5.0, hipR: 6.0, dazed: true,
    head: { c: [3, -67], turn: -0.5, tilt: 0.35 },
    legN: { p: [[-1, -38], [2, -22], [-3, -5]] },
    legF: { p: [[3, -38], [4, -22], [6, -5]], dir: [1, 0] },
    armN: { p: [[0, -54], [-1, -45], [1, -37], [2, -33]], fist: true },
    armF: { p: [[6, -55], [12, -60], [15, -68], [16, -72]] },
    pre: cocoon, post: strands, noEmblem: true, z: { armF: 6.6 } },
  // Head-first in the speaker: only the hips and legs stick out above the rim (pivot = the rim's centre).
  // One leg straight up, one flopped out, soles to the sky, a glove flapping out of the torn cone, paper shreds.
  { pelvis: [0, -7], chest: [0, 10], neck: [0, 14], face: 0, chestR: 6.6, waistR: 5.0, hipR: 6.0, clipY: 0,
    head: { c: [0, 20], turn: 0 },
    legN: { p: [[-3, -7], [-5, -23], [-4, -38]], dir: [-1, -0.25] },
    legF: { p: [[3, -7], [14, -15], [17, -29]], dir: [1, -0.6] },
    armF: { p: [[0, 8], [0, 12], [0, 14], [0, 15]] },
    armN: { p: [[-6, 10], [-11, 3], [-15, -3], [-19, -6]], hand: [2.2, 2.5, 1.6], grip: true },
    z: { armN: 8 },
    pre: (s) => {
      s.ell([0, -2], 15, 4.2, { m: 'black', z: 7, g: 'rim', lift: 0.2 });
      s.ell([0, -2], 12, 2.8, { m: 'black', z: 7.2, g: 'rim', i: 0 });
      for (const [x, h, lean] of [[-11, 6, -2], [-6, 8, -1], [-1, 5, 1], [6, 9, 2], [11, 6, 3]])
        s.poly([[x - 2.2, -3], [x + 2.2, -3], [x + lean, -3 - h]], { m: 'grey', z: 7.4, g: 'cone' + x, i: 2 });
    },
    post: (s) => {
      for (const [x, y] of [[-17, -14], [-21, -9], [19, -11], [23, -17], [-8, -24]]) s.dot([x, y], 1.3, 0.7, 'grey', 3, false, x * 0.7);
      for (const c of [[-10, -42], [7, -44]]) s.lateLine(add(c, [-2.5, 0]), add(c, [2.5, 0]), 'gold', 2).lateLine(add(c, [0, -2.5]), add(c, [0, 2.5]), 'gold', 2).dot(c, 1, 1, 'gold', 3);
    } },
];

// Lengthen the torso by d px: chest, head and arms move up, hips and legs stay.
const tall = (P, d) => { const f = (p) => [p[0], p[1] - d];
  return { ...P, chest: f(P.chest), neck: f(P.neck), head: { ...P.head, c: f(P.head.c) },
    armN: { ...P.armN, p: P.armN.p.map(f) }, armF: { ...P.armF, p: P.armF.p.map(f) } }; };
// Shorter legs for the standing poses: hips drop d px, knees half that; feet stay planted.
const hips = (P, d) => { const leg = (l) => ({ ...l, p: [[l.p[0][0], l.p[0][1] + d], [l.p[1][0], l.p[1][1] + d / 2], l.p[2]] });
  return { ...P, yoke: P.yoke ?? 0.42, pelvis: [P.pelvis[0], P.pelvis[1] + d], legN: leg(P.legN), legF: leg(P.legF) }; };
// Shoulders (chest, neck, arms) down d px, head kept: a short neck shows between the big head and the shoulders.
const shrug = (P, d) => { const f = (p) => [p[0], p[1] + d];
  return { ...P, chest: f(P.chest), neck: f(P.neck), armN: { ...P.armN, p: P.armN.p.map(f) }, armF: { ...P.armF, p: P.armF.p.map(f) } }; };
const stand = (P) => shrug(hips(tall(P, 4), 4), 3);
const frame = (name, P) => ({ name, d: D, ...figure(withFolds(P)) });
export default [
  frame('aranha_pose1', POSE1),
  frame('aranha_pose1_b', sink(POSE1, 3)),
  frame('aranha_pose2', POSE2),
  frame('aranha_pose2_b', drop(POSE2, 3)),
  ...STEP.map((P, i) => frame(`aranha_step_${i}`, stand(P))),
  ...WEB.map((P, i) => frame(`aranha_web_${i}`, stand(P))),
  ...FLIP.map((P, i) => frame(`aranha_flip_${i}`, i === 1 ? P : stand(P))),
  ...DEFEAT.map((P, i) => frame(`aranha_defeat_${i}`, i === 0 ? stand(P) : P)),
];
