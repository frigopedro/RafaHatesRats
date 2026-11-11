// Wheelchair Rafa from the sheet, drawn 1:1. Each push frame's origin is its rear-wheel hub on the ground
// (anchors in public/art/rafa.json, set by scripts/slice-sheet.mjs), so frames swap without jitter.
import type Phaser from 'phaser';
import { TICKS_PER_BEAT as TPB } from '../config';
import type { SimState } from '../types';

export const RAFA_ATLAS = 'rafa';
/** Rear hub sits this many px left of the hitbox centre, so her 0.7-block hitbox covers chair and body. */
export const HUB_DX = -28;
const PUSH_FRAMES = 5;
const PUSH_PHASE = 0.3; // push_1 (the stroke) lands on the beat

export interface RafaFx {
  jumpTick: number; // last takeoff, -1e9 if none
  landTick: number; // last landing
  deadTick: number; // tick of death, -1 if alive
}

/** Places and poses the sprite. `beat` is the render beat; (x, y) = world px of her hitbox bottom-centre. */
export function drawRafa(sprite: Phaser.GameObjects.Image, s: SimState, fx: RafaFx, beat: number, x: number, y: number, overdrive: boolean, nowMs: number, deadMs: number): void {
  const grounded = s.support >= 0;
  // Push cycle phase-locked to the beat (frame = f(beat)); twice as fast under Gelol.
  const cycle = beat * (overdrive ? 2 : 1) + PUSH_PHASE;
  const frame = grounded ? Math.floor((cycle - Math.floor(cycle)) * PUSH_FRAMES) : 0;
  sprite.setFrame(`push_${frame}`);

  const t = s.tick;
  const sinceJump = (t - fx.jumpTick) / TPB;
  const sinceLand = (t - fx.landTick) / TPB;
  let sx = 1, sy = 1, rot = 0;
  if (!grounded) {
    rot = Math.max(-0.3, Math.min(0.25, -s.vy * 0.025)); // wheelie going up, nose down falling
    const k = Math.max(0, 1 - sinceJump / 0.2);
    sy = 1 + 0.12 * k;
    sx = 1 - 0.08 * k;
  } else if (sinceLand < 0.15) {
    const k = 1 - sinceLand / 0.15;
    sy = 1 - 0.14 * k;
    sx = 1 + 0.1 * k;
  }
  if (fx.deadTick >= 0) {
    const k = Math.min(1, (nowMs - deadMs) / 250);
    rot = 1.6 * k;
    sprite.setTint(0xff9090);
  } else sprite.clearTint();
  sprite.setPosition(x + HUB_DX, y).setRotation(rot).setScale(sx, sy);
}
