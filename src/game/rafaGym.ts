// Level-1 Rafa on her feet, from the gym sheet, drawn 1:1. Same call shape as rafaView.ts (createRafa/drawRafa), so
// the scene switches with one line. Frame origins are her glasses (x) and feet (y), so frames swap without the head
// jumping. The pose is a pure function of the render beat, the sim state and the death time; before the run starts
// (and after it is won) the beat is frozen, so idle breathing and the cheer run on wall-clock time instead.
import type Phaser from 'phaser';
import { animFrame, RAFAGYM, RAFAGYM_ATLAS } from '../art/sheets';
import { PHYS, TICKS_PER_BEAT as TPB } from '../config';
import type { RafaFx, RafaState } from './rafaView';

/** Her head sits this many px right of the hitbox centre (she leans into the run), so the hitbox covers her body. */
export const HEAD_DX = 16;
const LAND_BEATS = 0.15;
const APEX_VY = 2.5; // blocks/beat: below this a big (uncut) jump shows the arms-up leap until landing
const GELOL_RUN = 1.5; // cadence under Gelol: ×2 would be ~52 frames/s on top of the ×1.3 clock, faster than 60 Hz shows
const PIVOT = 95; // death spin is about her middle, this far above the feet

export interface RafaGymSprite {
  body: Phaser.GameObjects.Image;
  glow: Phaser.FX.Glow | undefined; // Gelol outline (WebGL only)
}

export function createRafaGym(scene: Phaser.Scene): RafaGymSprite {
  const body = scene.add.image(0, 0, RAFAGYM_ATLAS, 'stand_0');
  body.preFX?.setPadding(14);
  const glow = body.preFX?.addGlow(0xffa23a, 4, 0, false, 0.1, 10);
  if (glow) glow.active = false;
  return { body, glow };
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
  let frame = animFrame(RAFAGYM.run, beat * (overdrive ? GELOL_RUN : 1));
  let sy = 1, rot = 0, dx = 0, dy = 0, alpha = 1;

  if (dead) {
    // Spins off like the wheelchair crash: launched up and forward, tumbling about her middle, gone before she would
    // come back down to the floor; in a hole she just drops.
    const t = Math.max(0, (nowMs - deadMs) / 1000);
    const inHole = y > PHYS.holeDepth * 48;
    frame = grounded ? frame : 'leap';
    rot = (inHole ? 1 : 8) * t;
    dx = (inHole ? 0 : 300 * t) - PIVOT * Math.sin(rot);
    dy = (inHole ? 0 : -1100 * t) + 1600 * t * t - PIVOT + PIVOT * Math.cos(rot);
    alpha = inHole ? 1 : 1 - Math.min(1, Math.max(0, (t - 0.5) / 0.15));
    r.body.setTint(t < 0.12 ? 0xff8080 : 0xffffff);
  } else {
    r.body.clearTint();
    if (!started) {
      frame = Math.floor(sec / 2.2) % 2 ? 'stand_1' : 'stand_0';
      sy = 1 + 0.012 * Math.sin(sec * Math.PI); // breathing, one breath per 2 s
    } else if (s.won) {
      frame = knees ? 'knees' : animFrame(RAFAGYM.cheer, sec * 2); // cheer at 120 BPM
    } else if (grounded) {
      if (overdrive && beat < s.overdriveFrom + 1) frame = 'guard'; // Gelol ignition: fists up
      else if (sinceLand < LAND_BEATS) frame = 'land';
    } else {
      // A cut hop has less speed than an uncut jump would have now (gravity also acts on the takeoff tick; a cut halves
      // vy); a walk-off fall has more (old jumpTick).
      const hop = s.vy < PHYS.jumpVel - PHYS.gravity * (sinceJump + 1 / TPB) - 0.3;
      frame = !hop && s.vy < APEX_VY ? 'leap_up' : 'leap';
    }
  }

  r.body.setFrame(frame).setAlpha(alpha);
  if (r.glow) {
    r.glow.active = overdrive && !dead;
    r.glow.outerStrength = 3 + 2 * (1 - (beat - Math.floor(beat))); // pulses on the beat
  }
  r.body.setPosition(x + HEAD_DX + dx, y + dy).setRotation(rot).setScale(1, sy);
}
