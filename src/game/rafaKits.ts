// Standing Rafa for level 1 (on her feet, gym race) and level 2 (on crutches): a cut-out rig of parts from public/art/kits.json
// (scripts/bake-kits.mjs). Every pose is a pure function of (beat, sim state), like drawRafa in rafaView.ts, so pause,
// restart and the Gelol tempo need nothing extra. Rig space: origin = hitbox bottom-centre on the ground, y down.
import type Phaser from 'phaser';
import { TICKS_PER_BEAT as TPB, VIEW } from '../config';
import type { SimState } from '../types';
import type { RafaFx } from './rafaView';

export const KITS_ATLAS = 'kits';
export type StandingKit = 'crutches' | 'standing';

const V = 4 * VIEW.block; // world px per beat (x = beat × 4 blocks, DESIGN §1)
const HIP = 120; // hip height when standing; the skirt hem hangs 104 below it
const HIP_X = -4;
const CRUTCH = 112; // grip → tip (bake CRUTCH_LEN)
const SKIRT_STEP = 8; // bake SKIRT_STEPS
const KIT = { crutches: { upper: 'c_upper', lean: -0.04 }, standing: { upper: 's_upper', lean: 0 } } as const;
const GRIP = [-9, 19]; // c_upper's fist, from the hip
const HAND_H = HIP - GRIP[1]; // grip height when standing
const PLANT = Math.acos(HAND_H / CRUTCH); // crutch angle when tip and feet both touch the ground

interface Foot { x: number; y: number; r: number } // ankle ground point rel. to hip x / ground (y up), rotation
interface Pose {
  hip: number; // hip height
  lean: number; // upper-body rotation, + = forward
  crutch: number; // crutch angle from vertical, + = tip forward
  crutchLift: number; // extra px the crutches are raised (swinging through the air)
  near: Foot;
  far: Foot;
  hf: number; hb: number; up: boolean; // skirt hem front/back shift, lifted hem
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const frac = (v: number) => v - Math.floor(v);
function mixPose(a: Pose, b: Pose, t: number): Pose {
  const f = (p: Foot, q: Foot): Foot => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), r: lerp(p.r, q.r, t) });
  return {
    hip: lerp(a.hip, b.hip, t), lean: lerp(a.lean, b.lean, t), crutch: lerp(a.crutch, b.crutch, t),
    crutchLift: lerp(a.crutchLift, b.crutchLift, t), near: f(a.near, b.near), far: f(a.far, b.far),
    hf: lerp(a.hf, b.hf, t), hb: lerp(a.hb, b.hb, t), up: t < 0.5 ? a.up : b.up,
  };
}
const pose = (o: Partial<Pose>): Pose => ({
  hip: HIP, lean: 0, crutch: PLANT, crutchLift: 0, near: { x: 4, y: 0, r: 0 }, far: { x: -4, y: 0, r: 0 },
  hf: 0, hb: 0, up: false, ...o,
});

/** Swing-through crutch gait, one cycle per `rate`-th of a beat; p = 0 is the crutches planting (on the beat).
 *  Tips stay fixed on the ground while she vaults, she lands on her good foot, then rocks forward while the crutches
 *  swing through (lifted at the elbow so the tips clear the floor). */
function crutchGait(p: number, rate: number): Pose {
  const speed = V / rate; // px per cycle
  const reach = CRUTCH * Math.sin(PLANT);
  const vault = (2 * reach) / speed, stance = 56 / speed; // tip contact, then good-foot contact
  const legs = (x: number, lift: number): Pick<Pose, 'near' | 'far'> => ({
    far: { x, y: lift, r: 0 }, near: { x: x + 9, y: lift + 7, r: -0.25 }, // the bandaged foot never touches down
  });
  if (p < vault) {
    const d = reach - speed * p; // tip ahead of the grip, fixed to the ground
    // Riding the full pendulum (+11 px) makes a jerky double bounce at 132 BPM; she rises a third of it and the
    // crutch slides up in her grip (elbow bend) for the rest.
    const rise = Math.sqrt(CRUTCH * CRUTCH - d * d) - HAND_H, hip = HIP + rise * 0.35;
    const sw = lerp(-26, 28, ease(p / vault));
    return pose({ hip, lean: 0.05 - 0.07 * (p / vault), crutch: Math.asin(d / CRUTCH), crutchLift: rise * 0.65, ...legs(sw, hip - HIP), hf: sw * 0.5, hb: sw * 0.55 });
  }
  if (p < vault + stance) {
    const q = (p - vault) / stance, x = 28 - speed * (p - vault);
    return pose({
      hip: HIP - 4 * Math.sin(Math.PI * q), lean: -0.02 + 0.05 * q, crutch: -PLANT + 0.25 * q,
      crutchLift: 10 * q, ...legs(x, 0), hf: 10 - 6 * q, hb: lerp(10, -12, q),
    });
  }
  const q = (p - vault - stance) / (1 - vault - stance); // crutches swing through to the next plant
  const h = 4 * Math.sin(Math.PI * q);
  return pose({
    hip: HIP + h, lean: 0.03 + 0.02 * q, crutch: lerp(-PLANT + 0.25, PLANT, ease(q)), crutchLift: 10 * (1 - q) + 14 * Math.sin(Math.PI * q),
    ...legs(lerp(-28, -26, q), h), hf: lerp(4, -13, q), hb: lerp(-12, -14, q),
  });
}

/** Healthy gym-race run: one stride pair per beat, near foot strikes on the beat, a bounce per step. */
function runGait(p: number): Pose {
  // Stance feet slide a little slower than the ground: a full-speed stride would stick out of the long dress.
  const foot = (q0: number): Foot => {
    const q = frac(p - q0), dur = 0.22;
    if (q < dur) return { x: lerp(30, -30, q / dur), y: 0, r: 0 };
    const s = (q - dur) / (1 - dur), arc = Math.sin(Math.PI * Math.pow(s, 0.7)); // heel kicks up early in the swing
    return { x: lerp(-30, 30, ease(s)), y: 18 * arc, r: -0.45 * arc };
  };
  const near = foot(0), far = foot(0.5);
  const step = frac(p * 2); // 0 = a foot strikes
  const front = Math.max(near.x, far.x), back = Math.min(near.x, far.x);
  return pose({
    hip: HIP + 2 - 7 * Math.sin(Math.PI * Math.min(1, step / 0.22)) * (step < 0.22 ? 1 : 0) + 6 * Math.sin(Math.PI * Math.max(0, (step - 0.22) / 0.78)),
    lean: 0.07 + 0.025 * Math.sin(2 * Math.PI * p), // a little shoulder roll with the arm pump
    near, far, hf: (front - 8) * 0.7, hb: (back + 8) * 0.7 - Math.max(near.y, far.y) * 0.3,
  });
}

export interface RafaKitRig {
  readonly kit: StandingKit;
  readonly root: Phaser.GameObjects.Container;
  /** Gelol overdrive is on (the effects lane draws glow/fire around `root`). */
  overdrive: boolean;
  /** World px of the crutch tips (crutches kit), for landing sparks. */
  readonly tips: { x: number; y: number }[];
  readonly body: Phaser.GameObjects.Container;
  readonly parts: Record<'upper' | 'skirt' | 'near' | 'far' | 'crutchN' | 'crutchF' | 'cuff', Phaser.GameObjects.Image>;
}

export function createRafaKit(scene: Phaser.Scene, kit: StandingKit): RafaKitRig {
  const img = (frame: string) => scene.add.image(0, 0, KITS_ATLAS, frame);
  const parts = {
    crutchF: img('crutch').setTint(0x9a9a9a), far: img('shoe'), near: img(kit === 'crutches' ? 'foot_wrap' : 'shoe'),
    skirt: img('skirt_0_0'), crutchN: img('crutch'), upper: img(KIT[kit].upper), cuff: img('cuff'),
  };
  for (const o of [parts.crutchF, parts.crutchN, parts.cuff]) o.setVisible(kit === 'crutches');
  const body = scene.add.container(0, 0, [parts.crutchF, parts.far, parts.near, parts.skirt, parts.crutchN, parts.upper, parts.cuff]);
  const root = scene.add.container(0, 0, [body]);
  return { kit, root, body, parts, overdrive: false, tips: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
}

const snap = (v: number) => clamp(Math.round(v / SKIRT_STEP) * SKIRT_STEP, -16, 16);

/** Same contract as drawRafa: `beat` is the render beat, (x, y) = world px of her hitbox bottom-centre.
 *  `idle` = standing still (menus, count-in); the sim never asks for it. */
export function drawRafaKit(rig: RafaKitRig, s: SimState, fx: RafaFx, beat: number, x: number, y: number, overdrive: boolean, nowMs: number, deadMs: number, idle = false): void {
  const { kit, parts } = rig;
  const grounded = s.support >= 0;
  const rate = overdrive ? 2 : 1;
  const sinceJump = (s.tick - fx.jumpTick) / TPB;
  const sinceLand = (s.tick - fx.landTick) / TPB;
  const gait = kit === 'crutches' ? crutchGait : runGait;
  let p: Pose;
  let sx = 1, sy = 1;
  if (idle) {
    const b = Math.sin(2 * Math.PI * beat * 0.5);
    p = pose({ hip: HIP + 1.5 * b, lean: 0.02 * b, hf: 5 * b, hb: 5 * b, near: { x: kit === 'crutches' ? 12 : 6, y: kit === 'crutches' ? 6 : 0, r: -0.2 }, far: { x: -6, y: 0, r: 0 } });
  } else if (!grounded) {
    const up = clamp(s.vy / 12, -1, 1); // +1 takeoff … −1 falling fast
    const air = kit === 'crutches'
      ? pose({ hip: HIP + 4, lean: -0.06 * up, crutch: up > 0 ? lerp(PLANT * 0.6, -PLANT * 1.2, up) : lerp(PLANT * 0.6, PLANT * 1.1, -up), crutchLift: 0, near: { x: 22, y: 14, r: -0.3 }, far: { x: 12, y: 6, r: 0.1 }, hf: 12, hb: 4, up: true })
      : pose({ hip: HIP + 4, lean: -0.05 * up + 0.03, near: { x: 16, y: lerp(24, 32, Math.max(0, up)), r: -0.25 }, far: { x: -4, y: lerp(20, 28, Math.max(0, up)), r: 0.3 }, hf: 10, hb: 0, up: true });
    const k = clamp(sinceJump / 0.12, 0, 1); // blend out of the run over the takeoff
    p = k < 1 ? mixPose(gait(frac(beat * rate), rate), air, ease(k)) : air;
    const st = Math.max(0, 1 - sinceJump / 0.2);
    sy = 1 + 0.1 * st; sx = 1 - 0.06 * st;
  } else {
    p = gait(frac(beat * rate), rate);
    if (sinceLand < 0.15) {
      const k = 1 - sinceLand / 0.15;
      sy = 1 - 0.12 * k; sx = 1 + 0.08 * k;
      if (kit === 'crutches') p = mixPose(p, pose({ ...p, crutch: PLANT, crutchLift: 0 }), k); // crutches plant
    }
  }

  // --- place the parts (rig space, y down) ---
  const cfg = KIT[kit];
  const hipY = -p.hip, lean = cfg.lean + p.lean;
  parts.upper.setPosition(HIP_X, hipY).setRotation(lean);
  parts.skirt.setFrame(`${p.up ? 'skirtup' : 'skirt'}_${snap(p.hf)}_${snap(p.hb)}`).setPosition(HIP_X, hipY).setRotation(lean * 0.25);
  parts.near.setPosition(HIP_X + p.near.x, -p.near.y).setRotation(p.near.r);
  parts.far.setPosition(HIP_X + p.far.x, -p.far.y).setRotation(p.far.r);
  if (kit === 'crutches') {
    const [hx, hy] = GRIP, c = Math.cos(lean), sn = Math.sin(lean);
    const gx = HIP_X + hx * c - hy * sn, gy = hipY + hx * sn + hy * c; // grip, turning with the upper body
    const lx = -Math.sin(p.crutch) * p.crutchLift, ly = -Math.cos(p.crutch) * p.crutchLift;
    parts.crutchN.setPosition(gx + lx, gy + ly).setRotation(-p.crutch);
    parts.crutchF.setPosition(gx + lx + 7, gy + ly - 2).setRotation(-p.crutch);
    parts.cuff.setPosition(gx, gy).setRotation(lean);
  }

  // --- death: crutches fly off, she tumbles ---
  let rot = 0;
  const dead = fx.deadTick >= 0;
  if (dead) {
    const k = clamp((nowMs - deadMs) / 250, 0, 1);
    rot = 1.5 * k;
    // gear flies in rig space; undo the body's tumble so it doesn't swing along with her
    const fly = (o: Phaser.GameObjects.Image, vx: number, vy: number, spin: number) => {
      const wx = o.x + vx * k, wy = o.y + vy * k + 260 * k * k;
      o.setPosition(wx * Math.cos(rot) + wy * Math.sin(rot), -wx * Math.sin(rot) + wy * Math.cos(rot)).setRotation(o.rotation + spin * k - rot);
    };
    if (kit === 'crutches') { fly(parts.crutchN, -90, -240, -6); fly(parts.crutchF, -40, -200, 5); fly(parts.cuff, -90, -240, -6); }
  }
  for (const o of Object.values(parts)) {
    if (dead) o.setTint(0xff9090);
    else if (o === parts.crutchF) o.setTint(0x9a9a9a);
    else if (o === parts.far && kit === 'standing') o.setTint(0xb8b8b8); // far leg in shade
    else o.clearTint();
  }
  rig.body.setRotation(rot).setScale(sx, sy);
  rig.root.setPosition(x, y);
  rig.overdrive = overdrive;
  if (kit === 'crutches') for (const [i, o] of [parts.crutchN, parts.crutchF].entries()) {
    rig.tips[i].x = x + (o.x - Math.sin(o.rotation) * CRUTCH) * sx;
    rig.tips[i].y = y + (o.y + Math.cos(o.rotation) * CRUTCH) * sy;
  }
}
