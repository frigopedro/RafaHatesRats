// Boss actors: cosmetic, driven only by the chart's boss cues and the beat; they never touch the sim.
// The mechanism (BossActor) turns the cues into "moves": bossEnter → 'enter', bossAttack → its `attack` name,
// bossExit → 'exit'. Each frame the latest move and the beats since its cue go to the boss's pose() — a pure function,
// so pause, restart and Gelol tempo come free. An attack's `release` is when its hazard leaves the boss's hands (the
// hazard is BOSS_AHEAD blocks ahead of Rafa then; releaseBeat()), so the wind-up ends exactly as the hazard appears.
// Adding a boss = a BossDef (atlas + attack kinds + pose) in BOSS_DEFS and `boss: '<id>'` in the level.
import Phaser from 'phaser';
import { animFrame, FABINHO, FABINHO_ATLAS } from '../art/sheets';
import { BOSS_AHEAD, VIEW } from '../config';
import { releaseBeat } from '../sim/behaviors';
import type { BossId, HazardKind, Level } from '../types';

const B = VIEW.block;

/** A move in progress: `t` = beats since its cue; `release` = beats from the cue to its hazard's release (NaN if none). */
export interface BossMove { name: string; t: number; release: number }
/** Where and how to draw the boss: `ahead`/`lift` in blocks from Rafa's feet; `flip` = facing left (toward Rafa). */
export interface BossPose { frame: string; ahead: number; lift: number; flip: boolean; rot?: number; skid?: boolean; hit?: boolean }
export interface BossDef {
  atlas: string; png: string; json: string;
  scale: number; // 1: sliced from a user sheet (1:1, smooth); 3: code-drawn (×3, nearest)
  attacks: Record<string, HazardKind>; // bossAttack name → the hazard kind it releases
  pose(m: BossMove, beat: number): BossPose | null; // null = off stage
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

// --- Fabinho (level 1): runs ahead of Rafa, turns to throw plates / bowl med balls, leaps into shockwaves, ---
// --- does push-ups and sit-ups between phases, and ends face-down when she overtakes him. ---
const D = BOSS_AHEAD + 0.5; // his head (frame origin) half a block past the release point, so his hands are on it
const TAUNT = 1.75; // beats on the floor; he stays put in the world meanwhile, so Rafa closes 7 blocks
const run = (beat: number, rate = 1): BossPose => ({ frame: animFrame(FABINHO.run, beat * rate), ahead: D, lift: 0, flip: false });

export const fabinho: BossDef = {
  atlas: FABINHO_ATLAS, png: 'art/fabinho.png', json: 'art/fabinho.json', scale: 1,
  attacks: { frisbeeLow: 'frisbee', frisbeeHigh: 'frisbee', shockwave: 'shockwave', medBallLow: 'medBall', medBallHigh: 'medBall' },
  pose({ name, t, release: r }, beat) {
    switch (name) {
      case 'enter': // overtakes her from behind
        if (t < 3) return { ...run(beat, 1.6), ahead: lerp(-10, D, easeOut(t / 3)) };
        break;
      case 'pushups':
      case 'situps': {
        const back = D - 4 * TAUNT;
        if (t < 0.25) return { frame: 'crouch', ahead: D - 4 * t, lift: 0, flip: false };
        if (t < TAUNT) return { frame: animFrame(name === 'pushups' ? FABINHO.taunt_pushup : FABINHO.taunt_situp, t - 0.25), ahead: D - 4 * t, lift: 0, flip: false };
        if (t < TAUNT + 1.5) return { ...run(beat, 1.6), ahead: lerp(back, D, easeOut((t - TAUNT) / 1.5)) };
        break;
      }
      case 'frisbeeLow':
      case 'frisbeeHigh':
      case 'medBallLow':
      case 'medBallHigh': // wind-up facing her, skidding along; release pose as the hazard leaves his hands
        if (t < r) return { frame: 'halfsquat', ahead: D, lift: 0, flip: true, skid: true };
        if (t < r + 0.6) {
          if (name === 'frisbeeHigh') return { frame: 'leap_1', ahead: D, lift: 0.3 * Math.sin((Math.PI * (t - r)) / 0.6), flip: true };
          return { frame: name === 'frisbeeLow' ? 'squat' : 'crouch', ahead: D, lift: 0, flip: true, skid: true };
        }
        break;
      case 'shockwave': // crouch, leap on an arc, land on the release beat: the wave starts at his feet
        if (t < r - 1) return { frame: 'halfsquat', ahead: D, lift: 0, flip: true, skid: true };
        if (t < r) {
          const u = t - (r - 1);
          return { frame: u < 0.5 ? 'leap_0' : 'leap_1', ahead: D, lift: 6 * u * (1 - u), flip: true };
        }
        if (t < r + 0.5) return { frame: animFrame(FABINHO.land, t - r), ahead: D, lift: 0, flip: true, skid: true };
        break;
      case 'exit': { // stops, she reaches him, he's bowled over and left behind face-down, then sulks
        const hitT = (D - 0.5) / 4;
        if (t < hitT) return { frame: animFrame(FABINHO.idle, t), ahead: D - 4 * t, lift: 0, flip: true };
        const u = t - hitT, k = Math.min(1, u / 0.6);
        const ahead = D - 4 * t + 2.5 * easeOut(k);
        if (ahead < -16) return null;
        return { frame: u < 2.5 ? 'defeated' : 'sulk', ahead, lift: 4 * 1.2 * k * (1 - k), flip: false, rot: u < 0.6 ? -0.5 * (1 - k) : 0, hit: u < 0.15 };
      }
    }
    return run(beat);
  },
};

export const BOSS_DEFS: Record<BossId, BossDef> = { fabinho };

interface Cue { beat: number; name: string; release: number }

export class BossActor {
  private readonly cues: Cue[] = [];
  private readonly img: Phaser.GameObjects.Image;
  readonly kinds: ReadonlySet<HazardKind>;
  private readonly m: BossMove = { name: '', t: 0, release: NaN };

  constructor(scene: Phaser.Scene, L: Level, private readonly def: BossDef) {
    const bpb = L.def.blocksPerBeat;
    for (const c of L.cues) {
      if (c.cue !== 'bossEnter' && c.cue !== 'bossAttack' && c.cue !== 'bossExit') continue;
      const name = c.cue === 'bossAttack' ? c.attack : c.cue === 'bossEnter' ? 'enter' : 'exit';
      const kind = def.attacks[name];
      // The cue's hazard: the first of its kind released at or after the cue.
      let rel = NaN;
      if (kind) for (const h of L.hazards) {
        const r = releaseBeat(h, bpb, BOSS_AHEAD);
        if (h.kind === kind && r >= c.beat - 1e-6 && !(r >= c.beat + rel)) rel = r - c.beat;
      }
      if (kind && Number.isNaN(rel)) console.warn(`boss: '${name}' at beat ${c.beat} has no ${kind} to release`);
      this.cues.push({ beat: c.beat, name, release: rel });
    }
    this.kinds = new Set(Object.values(def.attacks));
    if (def.scale !== 1 && scene.textures.exists(def.atlas)) scene.textures.get(def.atlas).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.img = scene.add.image(0, 0, def.atlas).setScale(def.scale).setDepth(8).setVisible(false);
  }

  /** Poses the boss for render beat `beat` with Rafa's feet at world x `rx`. Returns the pose (null = off stage). */
  draw(beat: number, rx: number): BossPose | null {
    let c: Cue | undefined;
    for (const q of this.cues) if (q.beat <= beat) c = q;
    const p = c ? this.def.pose(Object.assign(this.m, { name: c.name, t: beat - c.beat, release: c.release }), beat) : null;
    this.img.setVisible(!!p);
    if (!p) return null;
    if (this.img.frame.name !== p.frame) this.img.setFrame(p.frame);
    this.img.setFlipX(p.flip).setRotation(p.rot ?? 0).setPosition(Math.round(rx + p.ahead * B), Math.round(-p.lift * B));
    return p;
  }
}
