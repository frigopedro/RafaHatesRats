// Level-2 Rafa on two crutches (rafa-muleta.PNG), drawn 1:1. Same call shape as rafaView.ts (createRafa/drawRafa).
// Frame origins are her face (x) and feet / crutch tips (y). Her sheet's walk frames are near-copies — crutches and
// front foot never move, only the braced back leg lifts — so the gait is built from them as a swing-through: on the
// beat and the half-beat the tips and foot plant, and while planted the whole sprite slides back at exactly the
// floor's speed (they stick to the floor); then she swings forward through the air past her hitbox. Everything is a
// pure function of the render beat, the sim state and the death time; before the run (and after the win) the beat is
// frozen, so idle breathing and the victory dance run on wall-clock time.
import type Phaser from 'phaser';
import { animFrame, RAFAMULETA, RAFAMULETA_ATLAS } from '../art/sheets';
import { PHYS, TICKS_PER_BEAT as TPB, VIEW } from '../config';
import { createGelolGlow, drawGelolGlow, type RafaFx, type RafaState } from './rafaView';

/** Her face sits this many px right of the hitbox centre, so the hitbox covers her and the crutches. */
export const HEAD_DX = 8;
const GROUND = 4 * VIEW.block; // px the floor moves per beat
const PLANT = 0.24; // fraction of each step the crutch tips and front foot are on the floor
const SWING_LIFT = 9; // px she rises at mid-swing
const GELOL_RATE = 1.5; // steps ×1.5 under Gelol (the overdrive clock adds ×1.3 on top)
const LAND_BEATS = 0.15;
const APEX_VY = 2.5; // blocks/beat: below this a big (uncut) jump shows the arms-up pose until landing
const PIVOT = 90; // death spin is about her middle, this far above the feet
const BPM_HINT = 132; // level 2's tempo: the victory dance (wall-clock, the beat is frozen after the win) keeps it

/** Swing-through gait at `phase` cycles (two steps per cycle, planted on whole and half cycles) and `rate` cycles per
 *  beat: `dx` = sprite offset (px) from its place, `lift` = px off the floor, `lean` = forward tilt (rad). */
export function crutchGait(phase: number, rate: number): { step: number; planted: boolean; dx: number; lift: number; lean: number } {
  const steps = phase * 2, step = Math.floor(steps), u = steps - step;
  const A = (GROUND * PLANT) / (4 * rate); // half the slide: planted for PLANT / (2·rate) beats at GROUND px/beat
  if (u < PLANT) return { step, planted: true, dx: A - (2 * A * u) / PLANT, lift: 0, lean: 0 };
  const v = (u - PLANT) / (1 - PLANT), arc = Math.sin(Math.PI * v);
  return { step, planted: false, dx: -A + 2 * A * (v * v * (3 - 2 * v)), lift: SWING_LIFT * arc, lean: 0.06 * arc };
}

export interface RafaMuletaSprite {
  body: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image; // Gelol: the atlas's baked soft glow, behind her
}

export function createRafaMuleta(scene: Phaser.Scene): RafaMuletaSprite {
  const glow = createGelolGlow(scene, RAFAMULETA_ATLAS); // created first: drawn behind her
  return { body: scene.add.image(0, 0, RAFAMULETA_ATLAS, 'g_pose_idle'), glow };
}

/** Poses Rafa. `beat` = render beat; (x, y) = world px of her hitbox bottom-centre. `started` = false before the run
 *  begins (idle). Death plays from `deadMs` on the `nowMs` clock. */
export function drawRafaMuleta(r: RafaMuletaSprite, s: RafaState, fx: RafaFx, beat: number, x: number, y: number, overdrive: boolean, nowMs: number, deadMs: number, started: boolean): void {
  const grounded = s.support >= 0;
  const sinceJump = (s.tick - fx.jumpTick) / TPB;
  const sinceLand = (s.tick - fx.landTick) / TPB;
  const sec = nowMs / 1000;
  const dead = fx.deadTick >= 0;
  // Steps run ×GELOL_RATE during overdrive, continuously across its edges.
  const phase = beat + (GELOL_RATE - 1) * Math.min(Math.max(beat - s.overdriveFrom, 0), s.overdriveUntil - s.overdriveFrom);
  const g = crutchGait(phase, overdrive ? GELOL_RATE : 1);
  // Upright frames normally, the leaning ones under Gelol; back leg down while planted, lifted in the swing.
  const gaitFrame = `${overdrive ? 'crutch' : 'walk'}_${(g.step & 1) * 2 + (g.planted ? 0 : 1)}`;
  let frame = gaitFrame, sy = 1, rot = g.lean, dx = g.dx, dy = -g.lift, alpha = 1;

  if (!dead && !started) {
    frame = 'g_pose_idle';
    (rot = 0), (dx = 0), (dy = 0);
    sy = 1 + 0.012 * Math.sin(sec * Math.PI); // breathing, one breath per 2 s
  } else if (!dead && s.won) {
    frame = animFrame(RAFAMULETA.dance, (sec * BPM_HINT) / 60); // dancing at the altar, one pose per beat
    (rot = 0), (dx = 0), (dy = 0);
  } else if (!grounded) {
    // A cut hop has less speed than an uncut jump would have now (gravity also acts on the takeoff tick; a cut halves
    // vy); a walk-off fall has more (old jumpTick).
    const hop = s.vy < PHYS.jumpVel - PHYS.gravity * (sinceJump + 1 / TPB) - 0.3;
    frame = !hop && s.vy < APEX_VY ? 'g_pose_armsup' : s.vy > 0 ? 'walk_1' : 'walk_3';
    rot = frame === 'g_pose_armsup' ? 0 : Math.max(-0.12, Math.min(0.12, -s.vy * 0.012)); // tuck back rising, forward falling
    (dx = 0), (dy = 0);
  } else if (overdrive && beat < s.overdriveFrom + 1 && !dead) {
    frame = 'g_pose_point'; // Gelol ignition
    (rot = 0), (dx = 0), (dy = 0);
  } else if (sinceLand < LAND_BEATS) {
    const k = 1 - sinceLand / LAND_BEATS;
    sy = 1 - 0.12 * k;
  }

  if (dead) {
    // Tumbles off like the other Rafas (crutches go with her) and is gone before she would land; in a hole she drops.
    const t = Math.max(0, (nowMs - deadMs) / 1000);
    const inHole = y > PHYS.holeDepth * 48;
    rot = (inHole ? 1 : 8) * t;
    dx = (inHole ? 0 : 300 * t) - PIVOT * Math.sin(rot);
    dy = (inHole ? 0 : -1100 * t) + 1600 * t * t - PIVOT + PIVOT * Math.cos(rot);
    alpha = inHole ? 1 : 1 - Math.min(1, Math.max(0, (t - 0.5) / 0.15));
  }

  const { body } = r;
  body.setFrame(frame).setTint(dead && (nowMs - deadMs) / 1000 < 0.12 ? 0xff8080 : 0xffffff);
  body.setPosition(x + HEAD_DX + dx, y + dy).setRotation(rot).setScale(1, sy).setAlpha(alpha);
  drawGelolGlow(r.glow, overdrive && !dead, beat);
  r.glow.setPosition(body.x, body.y).setRotation(rot);
}
