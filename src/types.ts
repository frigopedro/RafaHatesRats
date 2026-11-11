// Shared contract between sim, levels, renderer, UI and audio.
// Units: time in beats (sim tick = 1/120 beat); horizontal positions in beats (blocks = beat × blocksPerBeat);
// heights and sizes in blocks, y up, ground top = 0. Every chart event is met by Rafa exactly on its `beat`.

export type Theme = 'gym' | 'street' | 'arena';
export type RafaKit = 'wheelchair' | 'crutches' | 'brace';

export type HazardKind =
  // L1 gym
  | 'dumbbell' | 'kettlebell' | 'bottle' | 'rat' | 'treadmill' | 'bench' | 'plateRack' | 'plate' | 'bag'
  // L1 spider boss attacks
  | 'webBlob' | 'webLine' | 'spiderDive'
  // L2 street + Fabinho
  | 'cone' | 'hydrant' | 'trashBag' | 'car' | 'barrier' | 'dumpster' | 'flowerpot'
  | 'waterBalloon' | 'flipflop' | 'soccerBall'
  // L3 arena + Rei Rato
  | 'ropeWave' | 'barbellRack' | 'plyo' | 'flame' | 'shockwave' | 'frisbee' | 'cheese';

export interface HazardDef {
  w: number; // hitbox width, blocks
  h: number; // hitbox height, blocks
  size: 'small' | 'big'; // small ones are smashed by Gelol overdrive
  art: string; // art key the renderer looks up
}

export type ItemKind = 'gelol' | 'whey' | 'pre' | 'coin';

/** How a hazard moves; every behaviour is a pure function of the beat (src/sim/behaviors.ts). */
export type HazardMotion =
  | { b: 'static'; y?: number } // fixed, bottom at height y (default 0)
  | { b: 'drop'; lead?: number; from?: number } // falls from height `from` (12), lands `lead` (1) beats before Rafa arrives; shadow 2 beats before landing
  | { b: 'run'; speed: number } // slides along the ground toward Rafa at `speed` blocks/beat (≥ 0)
  | { b: 'bounce'; speed: number; height: number; period: number; phase?: number } // rolls toward Rafa bouncing; phase 0 = on the ground when met
  | { b: 'lob'; lead?: number; flight?: number; dx?: number; dy?: number } // thrown from (dx, dy) relative to its spot, airborne `flight` beats, lands `lead` beats before Rafa arrives
  | { b: 'fly'; y: number; speed: number } // straight line at height y toward Rafa at `speed` blocks/beat (≥ 0)
  | { b: 'pulse'; period: number; on: number; phase?: number; y?: number }; // solid while (beat − phase) mod period < on

export type HazardEvent = { t: 'hazard'; beat: number; kind: HazardKind } & HazardMotion;

export interface ItemEvent {
  t: 'item';
  beat: number;
  kind: ItemKind;
  y: number; // bottom of the item box (ITEM_SIZE square), blocks
}

export interface PlatformEvent {
  t: 'platform';
  beat: number; // left edge
  len: number; // length in beats
  y: number; // top surface, blocks
  move?: { dx: number; dy: number; period: number; phase?: number }; // offset = (dx, dy) · (1 − cos 2π(beat − phase)/period) / 2
}

/** Cosmetic chart cues; the sim only forwards them as SimEvents at their beat. */
export type CueEvent =
  | { t: 'cue'; beat: number; cue: 'bossEnter' | 'bossExit' }
  | { t: 'cue'; beat: number; cue: 'bossAttack'; attack: string } // telegraph: boss starts the wind-up of `attack`
  | { t: 'cue'; beat: number; cue: 'hint'; text: string } // sign standing in the world at this beat
  | { t: 'cue'; beat: number; cue: 'section'; name: string }; // generated from LevelDef.sections

export type ChartEvent = HazardEvent | ItemEvent | PlatformEvent | CueEvent;

export interface Section {
  beat: number;
  name: string; // shared by chart and song, e.g. 'warmup', 'boss1'
}

export interface LevelDef {
  id: number;
  name: string; // shown to the player (PT-BR)
  theme: Theme;
  rafa: RafaKit;
  bpm: number;
  blocksPerBeat: number;
  lengthBeats: number; // reaching this beat wins
  songId: string;
  marginMs: number; // timing slack the solver must prove (± ms)
  sections: Section[];
  ground: [number, number][]; // solid ground spans [fromBeat, toBeat]; gaps are holes
  chart: ChartEvent[];
}

/** A LevelDef prepared for the sim (src/sim/sim.ts compileLevel). Arrays are sorted by beat; indices are stable ids. */
export interface Level {
  def: LevelDef;
  hazards: HazardEvent[];
  items: ItemEvent[];
  platforms: PlatformEvent[];
  cues: CueEvent[]; // chart cues + section cues
  ground: [number, number][]; // in blocks
  endTick: number;
  marginMs: number; // hazard inflation this level was compiled with (0 in the game)
  halfW: number[]; // per hazard: hitbox half-width in blocks, including the margin inflation
  reach: number[]; // per hazard: largest |beat − hazard.beat| at which it can touch Rafa
  maxReach: number;
}

/** One sim tick of input. */
export interface InputFrame {
  pressed: boolean; // a press started during this tick
  released: boolean; // a release happened during this tick
  held: boolean; // button state at the end of the tick
}

/** Full sim state; the renderer reads it as the snapshot. Ticks are absolute (beat × 120). */
export interface SimState {
  tick: number;
  y: number; // bottom of Rafa's hitbox, blocks
  prevY: number; // y one tick earlier (render interpolation)
  vy: number; // blocks/beat
  support: number; // -1 airborne, 0 ground, k + 1 = standing on platform k
  held: boolean; // jump input currently held
  jumpTicks: number; // ticks since takeoff while an early release can still cut the rise
  cutDone: boolean; // early-release window over (or not jumping)
  coyote: number; // ticks left in which a ground jump is still allowed after leaving support
  buffer: number; // ticks left on a press buffered in the air
  airJump: boolean; // pré-treino mid-air jump still unused this airtime
  shield: boolean; // Whey held
  invulnUntil: number; // tick
  preUntil: number; // tick; pré-treino active while tick < preUntil
  overdriveFrom: number; // whole beat; Gelol overdrive is active for overdriveFrom ≤ beat < overdriveUntil
  overdriveUntil: number;
  coins: number;
  cueIdx: number; // next cue to emit
  dead: boolean;
  won: boolean;
  taken: Uint8Array; // per item: 1 = picked up
  smashed: Uint8Array; // per hazard: 1 = smashed by overdrive
}

export type SimEvent =
  | { type: 'jump'; tick: number; air: boolean } // air = pré-treino mid-air jump
  | { type: 'land'; tick: number }
  | { type: 'pickup'; tick: number; item: number; kind: ItemKind }
  | { type: 'smash'; tick: number; hazard: number; kind: HazardKind }
  | { type: 'shieldBreak'; tick: number; hazard: number; kind: HazardKind }
  | { type: 'overdriveOn' | 'overdriveOff'; tick: number }
  | { type: 'death'; tick: number; cause: HazardKind | 'hole'; hazard: number } // hazard = -1 for holes
  | { type: 'win'; tick: number }
  | { type: 'cue'; tick: number; cue: CueEvent };

/** What the game reports to the shell/UI (and, later, audio). */
export interface GameHooks {
  onSimEvent(e: SimEvent): void; // every sim event, in tick order
  onFrame(beat: number, progress: number): void; // once per rendered frame, progress 0..1
  onGameOver(death: Extract<SimEvent, { type: 'death' }>, progress: number): void; // after the crash pause
}

/** What the shell/UI can tell the game to do. */
export interface GameControl {
  start(): void; // (re)start the run from the start beat
  setPaused(paused: boolean): void;
  readonly running: boolean; // a run is in progress (not over, not waiting to start)
}
