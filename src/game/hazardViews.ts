// Grey-box views. Swap these functions for sprite-based ones when the art lands; callers pass world pixels of the
// thing's bottom-centre. Boxes are drawn at hitbox size so what you see is what collides.
import type Phaser from 'phaser';
import { HAZARDS, HIGH_Y, ITEM_SIZE, VIEW } from '../config';
import type { HazardEvent, ItemKind } from '../types';

type G = Phaser.GameObjects.Graphics;
const B = VIEW.block;

const SMALL = 0xf2a03a; // jump with a tap
const BIG = 0xd8433f; // hold for the big jump
const HIGH = 0xa25ce8; // stay on the ground
const OUTLINE = 0x1a1420;

export function drawHazard(g: G, h: HazardEvent, x: number, y: number, smashed: boolean): void {
  const d = HAZARDS[h.kind];
  const w = d.w * B, hh = d.h * B;
  const high = (h.b === 'static' || h.b === 'fly' || h.b === 'pulse') && (h.y ?? 0) >= HIGH_Y;
  const color = high ? HIGH : d.size === 'big' ? BIG : SMALL;
  g.fillStyle(OUTLINE, smashed ? 0.3 : 1).fillRoundedRect(x - w / 2 - 4, y - hh - 4, w + 8, hh + 8, 10);
  g.fillStyle(color, smashed ? 0.3 : 1).fillRoundedRect(x - w / 2, y - hh, w, hh, 7);
  // Kind hint: runners get a nose pointing at Rafa, droppers/lobs a stripe, high ones a hanging rope.
  g.fillStyle(0xffffff, smashed ? 0.2 : 0.55);
  if (h.b === 'run' || h.b === 'bounce' || h.b === 'fly') g.fillTriangle(x - w / 2, y - hh / 2, x - w / 2 + 14, y - hh / 2 - 9, x - w / 2 + 14, y - hh / 2 + 9);
  else if (h.b === 'drop' || h.b === 'lob') g.fillRect(x - w / 2 + 6, y - hh / 2 - 3, w - 12, 6);
  if (high && h.b === 'static') g.fillStyle(OUTLINE, 1).fillRect(x - 3, y - hh - 12 * B, 6, 12 * B - hh);
}

/** Landing telegraph for drop/lob hazards; `k` 0 → 1 as the landing approaches. */
export function drawShadow(g: G, x: number, k: number): void {
  g.fillStyle(0x000000, 0.15 + 0.35 * k).fillEllipse(x, 0, (0.5 + 0.6 * k) * B, 0.22 * B);
}

const ITEM_COLOR: Record<ItemKind, number> = { gelol: 0xff4a1c, whey: 0xe8f2ff, pre: 0x5be35b, coin: 0xffd23a };

export function drawItem(g: G, kind: ItemKind, x: number, y: number, beat: number): void {
  const s = ITEM_SIZE * B;
  const bob = Math.sin(beat * Math.PI * 2) * 4; // on the beat
  const cy = y - s / 2 + bob;
  g.fillStyle(OUTLINE, 1);
  if (kind === 'coin') {
    g.fillCircle(x, cy, s * 0.38 + 4).fillStyle(ITEM_COLOR.coin, 1).fillCircle(x, cy, s * 0.38);
    g.fillStyle(0x8a6a10, 1).fillRect(x - s * 0.22, cy - 4, s * 0.44, 8);
    return;
  }
  g.fillRoundedRect(x - s / 2 - 4, cy - s / 2 - 4, s + 8, s + 8, 12);
  g.fillStyle(ITEM_COLOR[kind], 1).fillRoundedRect(x - s / 2, cy - s / 2, s, s, 9);
  g.fillStyle(OUTLINE, 0.8);
  if (kind === 'gelol') g.fillRect(x - 6, cy - s / 2 - 12, 12, 12); // tube cap
  else if (kind === 'whey') g.fillRect(x - s / 2, cy - s / 2, s, 10); // tub lid
  else g.fillRect(x - s / 2, cy - 5, s, 10); // can band
}
