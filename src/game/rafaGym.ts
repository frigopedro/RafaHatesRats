// Level-1 Rafa on her feet, from the gym sheet, drawn 1:1. Same call shape as rafaView.ts (createRafa/drawRafa), so
// the scene switches with one line. Single-frame poses have their origin at her glasses (x) and feet (y). The run is a
// cut-out leg rig (parts cut from her own sheet by scripts/slice-sheet.mjs): the sheet's five run frames are
// near-copies of one mid-stride pose and cannot make a cycle. Everything is a pure function of the render beat, the
// sim state and the death time; before the run starts (and after it is won) the beat is frozen, so idle breathing and
// the cheer run on wall-clock time instead.
import type Phaser from 'phaser';
import { animFrame, RAFAGYM, RAFAGYM_ATLAS } from '../art/sheets';
import { PHYS, TICKS_PER_BEAT as TPB, VIEW } from '../config';
import { createGelolGlow, drawGelolGlow, type RafaFx, type RafaState } from './rafaView';

/** Her head sits this many px right of the hitbox centre (she leans into the run), so the hitbox covers her body. */
export const HEAD_DX = 16;
const LAND_BEATS = 0.15;
const APEX_VY = 2.5; // blocks/beat: below this a big (uncut) jump shows the arms-up leap until landing
const GELOL_RUN = 1.5; // cadence under Gelol: ×2 would be ~52 frames/s on top of the ×1.3 clock, faster than 60 Hz shows
const PIVOT = 95; // death spin is about her middle, this far above the feet
const FAR_TINT = 0xdadada; // far leg ~15% darker
// Air frames are lifted so her head stays at running height at take-off (glasses: run ≈ 137 px up, leap ≈ 118);
// the lift fades out over the last 48 px of the fall so the feet meet the floor.
const AIR_LIFT: Record<string, number> = { leap: 19, leap_up: 16 };

// --- run rig (reused by fabinhoGym.ts): one full cycle (two foot strikes, on the beat and the half-beat) per beat ---
const GROUND = 4 * VIEW.block; // px the floor moves per beat (blocks per beat × block)
/** Per-character proportions of the run, px: hip height range above the floor (lowest mid-stance, highest mid-flight —
 *  two rises per cycle), how far the planted foot lands ahead of the hip (and leaves behind it), ankle above the sole. */
export interface Gait { hip: [number, number]; reach: number; ankleY: number }
export const RAFA_GAIT: Gait = { hip: [72, 80], reach: 28, ankleY: 26 };
// Swing path of the ankle (x ahead of the hip, y above the floor) between toe-off (u = 0) and the next strike (u = 1):
// heel snaps up behind toward the glutes, knee drives forward, lower leg extends, foot comes down slightly ahead.
const swingKeys = ({ reach: r, ankleY: a }: Gait): [number, number, number][] => [
  [0, -r, a], [0.22, -r - 2, a + 22], [0.45, -6, a + 40], [0.68, 18, a + 30], [0.86, r + 8, a + 12], [1, r, a],
];

export interface LegPose {
  knee: [number, number]; // x ahead of the hip, y above the floor
  ankle: [number, number];
  shoe: number; // shoe angle, rad, atan2(dx, dy) convention of the shin (0 = flat)
  planted: boolean;
}

const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Hermite spline through the swing keys; end tangents continue the stance (foot moving back) and ease into the strike. */
function swing(u: number, back: number, SWING: [number, number, number][]): [number, number] {
  const tan = (i: number): [number, number] => {
    if (i === 0) return [-back * 0.5, 70];
    if (i === SWING.length - 1) return [-back * 0.3, -90];
    const [u0, x0, y0] = SWING[i - 1], [u1, x1, y1] = SWING[i + 1];
    return [(x1 - x0) / (u1 - u0), (y1 - y0) / (u1 - u0)];
  };
  let i = 0;
  while (i < SWING.length - 2 && u > SWING[i + 1][0]) i++;
  const [ua, xa, ya] = SWING[i], [ub, xb, yb] = SWING[i + 1], h = ub - ua, t = (u - ua) / h;
  const [mxa, mya] = tan(i), [mxb, myb] = tan(i + 1);
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
  return [h00 * xa + h10 * h * mxa + h01 * xb + h11 * h * mxb, h00 * ya + h10 * h * mya + h01 * yb + h11 * h * myb];
}

/** The run at `phase` (cycles; leg 0 strikes at whole cycles, leg 1 at halves) with `cadence` cycles per beat and
 *  thigh/shin lengths L1/L2. While a foot is planted it moves back at exactly the floor's speed, so it sticks. */
export function runPose(phase: number, cadence: number, L1: number, L2: number, squash = 0, gait = RAFA_GAIT): { hipY: number; legs: LegPose[] } {
  const { hip: HIP, reach: REACH, ankleY: ANKLE_Y } = gait, keys = swingKeys(gait);
  const back = GROUND / cadence; // px the floor moves per cycle
  const stance = (2 * REACH) / back; // fraction of a cycle each foot is planted
  const q = phase - Math.floor(phase * 2) / 2; // time since the last strike, cycles
  const mid = (HIP[0] + HIP[1]) / 2, amp = (HIP[1] - HIP[0]) / 2;
  const hipY = mid - amp * Math.cos(2 * Math.PI * (q - stance / 2) * 2) - squash;
  const legs = [0, 0.5].map((offset): LegPose => {
    const f = phase - offset - Math.floor(phase - offset); // this leg's cycle phase, 0 = strike
    const planted = f < stance;
    let [ax, ay] = planted ? [REACH - back * f, ANKLE_Y] : swing((f - stance) / (1 - stance), back, keys);
    // Two-bone IK, knee forward. A target out of reach is pulled in along the leg (counted as slip by the tests).
    let dx = ax, dy = ay - hipY, d = Math.hypot(dx, dy);
    const dmax = L1 + L2 - 0.01;
    if (d > dmax) { ax = (dx / d) * dmax; ay = hipY + (dy / d) * dmax; dx = ax; dy = ay - hipY; d = dmax; }
    const base = Math.atan2(dy, dx), bend = Math.acos(Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
    const k1: [number, number] = [L1 * Math.cos(base + bend), hipY + L1 * Math.sin(base + bend)];
    const k2: [number, number] = [L1 * Math.cos(base - bend), hipY + L1 * Math.sin(base - bend)];
    const knee = k1[0] > k2[0] ? k1 : k2;
    // Flat while planted; in the air the foot follows the shin (toes down at toe-off, up as the leg reaches).
    const u = planted ? 0 : (f - stance) / (1 - stance);
    const follow = smooth(0, 0.15, u) * (1 - smooth(0.85, 1, u));
    const shin = Math.atan2(ax - knee[0], knee[1] - ay);
    // Capped: with the heel kicked up the shin points backward, and a fully following shoe reads as a broken foot.
    return { knee, ankle: [ax, ay], shoe: follow * Math.max(-0.9, Math.min(0.9, shin)), planted };
  });
  return { hipY, legs };
}

/** Run phase in cycles at `beat`: one cycle per beat, ×GELOL_RUN during overdrive, continuous across its edges. */
export function runPhase(s: Pick<RafaState, 'overdriveFrom' | 'overdriveUntil'>, beat: number): number {
  return beat + (GELOL_RUN - 1) * Math.min(Math.max(beat - s.overdriveFrom, 0), s.overdriveUntil - s.overdriveFrom);
}

/** Where a foot strikes, px ahead of her hitbox centre (HEAD_DX + the rig's hip offset −13 + REACH); it then stays put
 *  in world space while she runs over it. */
export const GYM_STRIKE_DX = HEAD_DX - 13 + RAFA_GAIT.reach;

/** True if a foot struck the floor between two render beats (for dust puffs): strikes are on every half cycle. */
export function gymStrike(s: Pick<RafaState, 'overdriveFrom' | 'overdriveUntil'>, prevBeat: number, beat: number): boolean {
  return Math.floor(runPhase(s, beat) * 2) !== Math.floor(runPhase(s, prevBeat) * 2);
}

// Rig parts, back to front: far shoe, shin, thigh · hip filler · near shoe, shin, thigh · upper body. Every rig atlas
// (rafagym, fabinhogym) has these frames; thigh/shin carry their `bone`, run_upper its hip offset from the origin.
const RIG_FRAMES = ['shoe', 'shin_far', 'thigh_far', 'pelvis', 'shoe', 'shin', 'thigh', 'run_upper'];
type Bone = { len: number; angle: number };
const custom = <T>(img: Phaser.GameObjects.Image, key: string) => (img.frame.customData as Record<string, T>)[key];

export function createLegRig(scene: Phaser.Scene, atlas: string, farTint: number): Phaser.GameObjects.Image[] {
  return RIG_FRAMES.map((f, i) => scene.add.image(0, 0, atlas, f).setTint(i < 3 ? farTint : 0xffffff));
}
/** Thigh and shin lengths of a rig, px. */
export const legBones = (parts: Phaser.GameObjects.Image[]): [number, number] =>
  [custom<Bone>(parts[6], 'bone').len, custom<Bone>(parts[5], 'bone').len];

/** Lays the rig out for `pose`; positions are px relative to the character's origin (head x, floor y). */
export function drawLegRig(parts: Phaser.GameObjects.Image[], pose: { hipY: number; legs: LegPose[] }, torso: number): void {
  const [fShoe, fShin, fThigh, pelvis, nShoe, nShin, nThigh, upper] = parts;
  const hip = custom<{ hipDx: number }>(upper, 'rig').hipDx;
  const thigh = custom<Bone>(nThigh, 'bone'), shin = custom<Bone>(nShin, 'bone');
  const at = (p: [number, number]) => [hip + p[0], -p[1]] as const;
  const legs: [LegPose, Phaser.GameObjects.Image[]][] = [[pose.legs[1], [fShoe, fShin, fThigh]], [pose.legs[0], [nShoe, nShin, nThigh]]];
  for (const [leg, [shoe, sh, th]] of legs) {
    const knee = at(leg.knee), ankle = at(leg.ankle);
    // Phaser rotation turns a part's source direction (atan2(dx, dy), y down) into the target direction.
    th.setPosition(hip, -pose.hipY).setRotation(thigh.angle - Math.atan2(knee[0] - hip, knee[1] + pose.hipY));
    sh.setPosition(...knee).setRotation(shin.angle - Math.atan2(ankle[0] - knee[0], ankle[1] - knee[1]));
    shoe.setPosition(...ankle).setRotation(-leg.shoe);
  }
  pelvis.setPosition(hip, -pose.hipY);
  upper.setPosition(hip, -pose.hipY).setRotation(torso);
}

export interface RafaGymSprite {
  root: Phaser.GameObjects.Container; // carries position and the death spin
  body: Phaser.GameObjects.Image; // single-frame poses
  rig: Phaser.GameObjects.Image[]; // the run (createLegRig order)
  glow: Phaser.GameObjects.Image; // Gelol: the atlas's baked soft glow, behind her
}

export function createRafaGym(scene: Phaser.Scene): RafaGymSprite {
  const rig = createLegRig(scene, RAFAGYM_ATLAS, FAR_TINT);
  const body = scene.add.image(0, 0, RAFAGYM_ATLAS, 'stand_0');
  const glow = createGelolGlow(scene, RAFAGYM_ATLAS);
  const root = scene.add.container(0, 0, [glow, ...rig, body]);
  return { root, body, rig, glow };
}

/** Poses Rafa. `beat` = render beat; (x, y) = world px of her hitbox bottom-centre. `started` = false before the run
 *  begins (idle). Death plays from `deadMs` on the `nowMs` clock. `knees`: the level-1 ending — after winning, her
 *  knee goes and she sits hugging it (set it when the story reaches that beat; it overrides the victory cheer). */
export function drawRafaGym(r: RafaGymSprite, s: RafaState, fx: RafaFx, beat: number, x: number, y: number, overdrive: boolean, nowMs: number, deadMs: number, started: boolean, knees = false): void {
  const grounded = s.support >= 0;
  const sinceJump = (s.tick - fx.jumpTick) / TPB;
  const sinceLand = (s.tick - fx.landTick) / TPB;
  const sec = nowMs / 1000;
  const dead = fx.deadTick >= 0;
  let frame = ''; // '' = the run rig
  let sy = 1, rot = 0, dx = 0, dy = 0, alpha = 1, lift = 0, squash = 0;

  if (!dead && !started) {
    frame = Math.floor(sec / 2.2) % 2 ? 'stand_1' : 'stand_0';
    sy = 1 + 0.012 * Math.sin(sec * Math.PI); // breathing, one breath per 2 s
  } else if (!dead && s.won) {
    frame = knees ? 'knees' : animFrame(RAFAGYM.cheer, sec * 2); // cheer at 120 BPM
  } else if (grounded) {
    if (!dead && overdrive && beat < s.overdriveFrom + 1) frame = 'guard'; // Gelol ignition: fists up
    else if (sinceLand < LAND_BEATS) squash = 14 * (1 - sinceLand / LAND_BEATS); // landing: knees give, no frame swap
  } else {
    // A cut hop has less speed than an uncut jump would have now (gravity also acts on the takeoff tick; a cut halves
    // vy); a walk-off fall has more (old jumpTick).
    const hop = s.vy < PHYS.jumpVel - PHYS.gravity * (sinceJump + 1 / TPB) - 0.3;
    frame = !hop && s.vy < APEX_VY ? 'leap_up' : 'leap';
    lift = AIR_LIFT[frame] * (s.vy > 0 ? 1 : Math.min(1, (s.y * VIEW.block) / 48));
  }

  if (dead) {
    // Spins off like the wheelchair crash: launched up and forward, tumbling about her middle, gone before she would
    // come back down to the floor; in a hole she just drops.
    const t = Math.max(0, (nowMs - deadMs) / 1000);
    const inHole = y > PHYS.holeDepth * 48;
    rot = (inHole ? 1 : 8) * t;
    dx = (inHole ? 0 : 300 * t) - PIVOT * Math.sin(rot);
    dy = (inHole ? 0 : -1100 * t) + 1600 * t * t - PIVOT + PIVOT * Math.cos(rot);
    alpha = inHole ? 1 : 1 - Math.min(1, Math.max(0, (t - 0.5) / 0.15));
  }

  const { root, body, rig } = r;
  body.setVisible(frame !== '');
  for (const p of rig) p.setVisible(frame === '');
  if (frame) body.setFrame(frame).setPosition(0, -lift).setScale(1, sy);
  else {
    const phase = runPhase(s, beat);
    drawLegRig(rig, runPose(phase, overdrive ? GELOL_RUN : 1, ...legBones(rig), squash), 0.04 * Math.sin(2 * Math.PI * phase));
  }
  const tint = dead && (nowMs - deadMs) / 1000 < 0.12 ? 0xff8080 : 0xffffff;
  body.setTint(tint);
  rig.forEach((p, i) => p.setTint(tint !== 0xffffff ? tint : i < 3 ? FAR_TINT : 0xffffff));
  drawGelolGlow(r.glow, overdrive && !dead, beat);
  root.setPosition(x + HEAD_DX + dx, y + dy).setRotation(rot).setAlpha(alpha);
}
