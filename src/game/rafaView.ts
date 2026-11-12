// Wheelchair Rafa from the sheet, drawn 1:1. Every in-game frame's origin is its rear-wheel ground contact (atlas
// anchors set by scripts/slice-sheet.mjs), so frames swap without jitter. The pose is a pure function of the render
// beat, the sim state and the death time: pause, restart and overdrive need no extra code. Before the run starts the
// beat is frozen, so idle breathing (and the victory bounce) run on wall-clock time instead.
import type Phaser from 'phaser';
import { PHYS, TICKS_PER_BEAT as TPB } from '../config';
import type { SimState } from '../types';

export const RAFA_ATLAS = 'rafa';
/** Rear hub sits this many px left of the hitbox centre, so her 0.7-block hitbox covers chair and body. */
export const HUB_DX = -28;
const PUSH_FRAMES = 5;
const PUSH_PHASE = 0.3; // roll_1 (the stroke) lands on the beat
const WHEEL_R = 35.5; // rear tyre radius, px
// Spokes turn at half the rolling rate: the true rate (~21°/frame at 60 fps) is close to the spoke spacing and strobes.
const SPIN_GEAR = 0.5;
const LAND_BEATS = 0.15;
const APEX_VY = 2.5; // blocks/beat: below this a big (uncut) jump shows the arms-up pose until landing

export interface RafaFx {
  jumpTick: number; // last takeoff, -1e9 if none
  landTick: number; // last landing
  deadTick: number; // tick of death, -1 if alive
}

export interface RafaSprite {
  root: Phaser.GameObjects.Container; // body + spokes; carries position, tilt and squash
  body: Phaser.GameObjects.Image;
  spokes: Phaser.GameObjects.Image; // rotating wheel interior, laid over the hollow roll_* frames at their hub
  wheel: Phaser.GameObjects.Image; // loose wheel for the crash
  glow: Phaser.FX.Glow | undefined; // Gelol outline (WebGL only)
}

export type RafaState = Pick<SimState, 'tick' | 'y' | 'vy' | 'support' | 'won' | 'overdriveFrom' | 'overdriveUntil'>;

export function createRafa(scene: Phaser.Scene): RafaSprite {
  const body = scene.add.image(0, 0, RAFA_ATLAS, 'roll_0');
  const spokes = scene.add.image(0, 0, RAFA_ATLAS, 'spokes');
  const root = scene.add.container(0, 0, [body, spokes]);
  const wheel = scene.add.image(0, 0, RAFA_ATLAS, 'part_wheel').setVisible(false);
  body.preFX?.setPadding(14);
  const glow = body.preFX?.addGlow(0xffa23a, 4, 0, false, 0.1, 10);
  if (glow) glow.active = false;
  return { root, body, spokes, wheel, glow };
}

/** Poses Rafa. `beat` = render beat; (x, y) = world px of her hitbox bottom-centre (x also measures distance rolled).
 *  `started` = false before the run begins (idle). Death plays from `deadMs` on the `nowMs` clock. */
export function drawRafa(r: RafaSprite, s: RafaState, fx: RafaFx, beat: number, x: number, y: number, overdrive: boolean, nowMs: number, deadMs: number, started: boolean): void {
  const grounded = s.support >= 0;
  const sinceJump = (s.tick - fx.jumpTick) / TPB;
  const sinceLand = (s.tick - fx.landTick) / TPB;
  const sec = nowMs / 1000;
  const cycle = beat * (overdrive ? 2 : 1) + PUSH_PHASE; // Gelol: push cycle at double speed
  const pushFrame = `roll_${Math.floor((cycle - Math.floor(cycle)) * PUSH_FRAMES)}`;
  let frame = pushFrame, sx = 1, sy = 1, rot = 0, dx = 0, dy = 0;
  const dead = fx.deadTick >= 0;

  if (dead) {
    frame = grounded ? pushFrame : 'roll_0';
  } else if (!started) {
    frame = Math.floor(sec / 2.2) % 2 ? 'side_2' : 'side_1';
    sy = 1 + 0.012 * Math.sin(sec * Math.PI); // breathing, one breath per 2 s
  } else if (s.won) {
    frame = 'armsup_s';
    dy = -10 * Math.abs(Math.sin(sec * Math.PI * 2));
  } else if (grounded) {
    if (overdrive && beat < s.overdriveFrom + 1) frame = 'point_s'; // Gelol ignition
    if (sinceLand < LAND_BEATS) {
      const k = 1 - sinceLand / LAND_BEATS;
      sy = 1 - 0.14 * k;
      sx = 1 + 0.1 * k;
    }
  } else {
    // A cut hop has less speed than an uncut jump would have now (gravity also acts on the takeoff tick; a cut halves
    // vy); a walk-off fall has more (old jumpTick).
    const hop = s.vy < PHYS.jumpVel - PHYS.gravity * (sinceJump + 1 / TPB) - 0.3;
    frame = !hop && s.vy < APEX_VY ? 'armsup_s' : 'roll_0';
    // Wheelie going up; nose down early in the fall, level again by landing speed so the casters never dip into the floor.
    rot = s.vy > 0 ? -Math.min(0.3, s.vy * 0.025) : 0.2 * Math.sin(Math.PI * Math.min(1, -s.vy / 11));
    const k = Math.max(0, 1 - sinceJump / 0.2);
    sy = 1 + 0.12 * k;
    sx = 1 - 0.08 * k;
  }

  const { body, spokes, wheel, root } = r;
  body.setFrame(frame);
  const hub = (body.frame.customData as { hub?: { x: number; y: number } }).hub;
  spokes.setVisible(!!hub);
  if (hub) {
    spokes.setPosition(hub.x - body.displayOriginX, hub.y - body.displayOriginY).setRotation((x / WHEEL_R) * SPIN_GEAR);
  }
  wheel.setVisible(false);
  if (r.glow) {
    r.glow.active = overdrive && !dead;
    r.glow.outerStrength = 3 + 2 * (1 - (beat - Math.floor(beat))); // pulses on the beat
  }

  if (dead) {
    // She spins off: launched up and forward, tumbling, and falls out of view (straight down if she died in a hole).
    // The far wheel pops off at the hub and rolls on along the floor.
    const t = Math.max(0, (nowMs - deadMs) / 1000);
    const inHole = y > PHYS.holeDepth * 48;
    dx = inHole ? 0 : 300 * t;
    dy = (inHole ? 0 : -1100 * t) + 1600 * t * t;
    rot = (inHole ? 1 : 8) * t;
    if (!inHole) drawLooseWheel(wheel, x + HUB_DX, t);
    // Gone before the arc brings her back to the floor (t ≈ 0.69 s), so she never lands sitting in the ground.
    root.setAlpha(inHole ? 1 : 1 - Math.min(1, Math.max(0, (t - 0.5) / 0.15)));
    body.setTint(t < 0.12 ? 0xff8080 : 0xffffff);
  } else {
    root.setAlpha(1);
    body.clearTint();
  }
  root.setPosition(x + HUB_DX + dx, y + dy).setRotation(rot).setScale(sx, sy);
}

/** Rolls two turns forward from the hub (decelerating, 1 s), then falls over flat onto the floor. */
function drawLooseWheel(wheel: Phaser.GameObjects.Image, hubX: number, t: number): void {
  const T = 1, D = 4 * Math.PI * WHEEL_R; // two full turns, so it lies down with the spokes back at 0°
  const k = Math.min(1, t / T);
  const d = D * (1 - (1 - k) * (1 - k));
  const f = Math.min(1, Math.max(0, (t - T) / 0.22));
  const flat = 1 - 0.8 * f * f; // seen from the side, a wheel lying down is a thin ellipse
  wheel.setVisible(true).setPosition(hubX + d, -WHEEL_R * flat).setRotation(d / WHEEL_R).setScale(1, flat);
}
