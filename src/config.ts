import type { HazardDef, HazardKind } from './types';

export const TICKS_PER_BEAT = 120;

/** Jump physics, in blocks and beats. Big jump (held to apex): 1.0 beat airtime, 3.0 blocks apex, 4 blocks long.
 *  Hop (any tap up to the min hold): ~0.78 beat, ~2.2 blocks apex, ~3.1 blocks long. Longer holds land in between. */
export const PHYS = {
  gravity: 24, // blocks/beat²
  jumpVel: 12, // blocks/beat at takeoff
  cut: 0.5, // vy multiplier when the button is released while rising
  minHoldTicks: 24, // 0.2 beat (100 ms at 120 BPM): every natural tap gives the same hop; release cuts the rise after this
  bufferTicks: 30, // 0.25 beat: a press this early before landing still jumps on landing
  coyoteTicks: 18, // 0.15 beat: a ground jump is still allowed this long after leaving the edge
  holeDepth: 0.4, // blocks below ground top: past this Rafa is in the hole (dead); above it she steps back up
};

export const PLAYER = { w: 0.7, h: 1.3 }; // hitbox, blocks
export const ITEM_SIZE = 0.6; // item pickup box, blocks
export const OVERDRIVE = { beats: 12, rate: 1.3 }; // Gelol
export const SHIELD_INVULN_TICKS = TICKS_PER_BEAT; // after the Whey shield breaks
export const PRE_TICKS = 8 * TICKS_PER_BEAT; // pré-treino duration
export const DROP_FALL_BEATS = 1; // a `drop` hazard is visible and falling for this long before landing
export const DROP_SHADOW_BEATS = 2; // ground shadow appears this long before a `drop`/`lob` lands
export const HIGH_Y = 1.7; // hazards whose bottom is at or above this are "high": stay on the ground

/** Hitboxes are forgiving: small ≤ 0.7 × 0.6, big ≤ 1.4 × 1.2 (DESIGN §2–3). `art` = props/bosses atlas frame
 *  (or the `<art>_0..n` animation). High hazards (bag, lantern, dove, balloons, high frisbee/webLine) are 'big' so Gelol
 *  never makes a jump into them safe. */
export const HAZARDS: Record<HazardKind, HazardDef> = {
  // L1 gym
  dumbbell: { w: 0.6, h: 0.45, size: 'small', art: 'dumbbell' },
  kettlebell: { w: 0.55, h: 0.6, size: 'small', art: 'kettlebell' },
  bottle: { w: 0.35, h: 0.6, size: 'small', art: 'bottle' },
  rat: { w: 0.6, h: 0.4, size: 'small', art: 'rat_run' },
  plate: { w: 0.7, h: 0.35, size: 'small', art: 'plate' }, // drawn lying flat (plate_flat) once on the floor
  ropeWave: { w: 0.7, h: 0.5, size: 'small', art: 'ropeWave' },
  treadmill: { w: 1.4, h: 0.9, size: 'big', art: 'treadmill' },
  // Level 1 is the casual on-ramp (±110 ms): its big obstacles get narrow, forgiving hitboxes so a full jump clears them
  // at ±125 ms (a 1.2-wide box tops out at ±95 ms with this jump). Gym kinds are used by level 1 only.
  bench: { w: 0.7, h: 0.75, size: 'big', art: 'bench' },
  plateRack: { w: 0.55, h: 0.95, size: 'big', art: 'plateRack' },
  barbellRack: { w: 1.4, h: 1.2, size: 'big', art: 'barbellRack' },
  plyo: { w: 0.65, h: 0.85, size: 'big', art: 'plyo' },
  bag: { w: 0.6, h: 1.0, size: 'big', art: 'bag' },
  // L1 Fabinho
  frisbee: { w: 0.7, h: 0.3, size: 'small', art: 'frisbee' },
  shockwave: { w: 0.7, h: 0.45, size: 'small', art: 'shockwave' },
  medBall: { w: 0.55, h: 0.55, size: 'small', art: 'medBall' },
  // L2 church
  kneeler: { w: 0.7, h: 0.4, size: 'small', art: 'kneeler' },
  flowerBasket: { w: 0.6, h: 0.5, size: 'small', art: 'flowerBasket' },
  hymnBooks: { w: 0.6, h: 0.4, size: 'small', art: 'hymnBooks' },
  rice: { w: 0.6, h: 0.4, size: 'small', art: 'rice' },
  flowerGirl: { w: 0.6, h: 0.6, size: 'small', art: 'flowerGirl' },
  ringBearer: { w: 0.6, h: 0.6, size: 'small', art: 'ringBearer' },
  pewEnd: { w: 0.9, h: 1.2, size: 'big', art: 'pewEnd' }, // 0.9 (DESIGN said 1.0): a lone 1.0 × 1.2 caps level 2 at ±80 ms
  candleStand: { w: 0.6, h: 1.2, size: 'big', art: 'candleStand' },
  flowerStand: { w: 0.9, h: 1.2, size: 'big', art: 'flowerStand' },
  photographer: { w: 1.2, h: 1.2, size: 'big', art: 'photographer' },
  dove: { w: 0.7, h: 0.4, size: 'big', art: 'dove' },
  lantern: { w: 0.6, h: 0.8, size: 'big', art: 'lantern' },
  // L3 party
  giftBox: { w: 0.6, h: 0.55, size: 'small', art: 'giftBox' },
  chair: { w: 0.7, h: 0.5, size: 'small', art: 'chair' },
  champagne: { w: 0.35, h: 0.6, size: 'small', art: 'champagne' },
  table: { w: 1.4, h: 1.0, size: 'big', art: 'table' },
  cakeTable: { w: 1.2, h: 1.2, size: 'big', art: 'cakeTable' },
  champagneTower: { w: 0.9, h: 1.2, size: 'big', art: 'champagneTower' },
  waiter: { w: 0.9, h: 1.2, size: 'big', art: 'waiter' },
  balloons: { w: 0.8, h: 0.9, size: 'big', art: 'balloons' },
  sparkler: { w: 0.6, h: 1.0, size: 'big', art: 'sparkler' },
  // L3 O Aranha
  webBlob: { w: 0.6, h: 0.5, size: 'small', art: 'webBlob' },
  webLine: { w: 1.6, h: 0.35, size: 'big', art: 'webLine' },
  spiderDive: { w: 1.2, h: 1.1, size: 'big', art: 'spiderDive' },
};

/** Boss actors stand this many blocks ahead of Rafa while fighting; an attack is released (leaves the boss's hands)
 *  when its hazard is here, so charts time attacks with releaseBeat() in src/sim/behaviors.ts. */
export const BOSS_AHEAD = 9;
/** O Aranha (level 3) throws from the roof of his party train, which sits closer than BOSS_AHEAD so the whole train fits
 *  a 4:3 view. */
export const ARANHA_AHEAD = 5.5;

/** Renderer: logical view 1080 px tall, 1 block = 96 px; Rafa pinned 28% from the left. */
export const VIEW = {
  height: 1080,
  block: 96,
  playerX: 0.28,
  groundFromBottom: 2, // blocks of ground visible below Rafa
  minAspect: 4 / 3,
  maxAspect: 21 / 9,
  zoomSnap: 0.12, // camera zoom within this of 1 snaps to exactly 1 (sprites stay 1:1)
  maxDpr: 3,
};

export const CRASH_MS = 250; // death → game-over card
