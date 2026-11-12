// Boss actors: cosmetic, driven only by the chart's boss cues and the beat; they never touch the sim.
// The mechanism (BossActor) turns the cues into "moves": bossEnter → 'enter', bossAttack → its `attack` name,
// bossExit → 'exit'. Each frame the latest move and the beats since its cue go to the boss's pose() — a pure function,
// so pause, restart and Gelol tempo come free. An attack's `release` is when its hazard leaves the boss's hands (the
// hazard is BOSS_AHEAD blocks ahead of Rafa then; releaseBeat()), so the wind-up ends exactly as the hazard appears.
// Adding a boss = a BossDef (atlas + attack kinds + pose) in BOSS_DEFS and `boss: '<id>'` in the level. A boss may ride
// a vehicle (the Aranha's party train): its pose then also says where the train is.
import Phaser from 'phaser';
import { animFrame, FABINHOGYM, FABINHOGYM_ATLAS, type SheetAnim } from '../art/sheets';
import { ARANHA_AHEAD, BOSS_AHEAD, VIEW } from '../config';
import { releaseBeat } from '../sim/behaviors';
import { BAR_HALF, createFabinhoGymRun, drawFabinhoGymRun, exercise, idleWindows, type BossCue, type FabinhoGymRun, type Idle } from './fabinhoGym';
import type { BossId, HazardKind, Level } from '../types';
import { ARANHA, ARANHA_SCALE, ART_SCALE, BOSSES, CEILING } from './hazardViews';

const B = VIEW.block;

/** A move in progress: `t` = beats since its cue; `release` = beats from the cue to its hazard's release (NaN if none);
 *  `idle` = the idle window the beat is in (gym Fabinho's exercises), if any. */
export interface BossMove { name: string; t: number; release: number; idle?: Idle }
/** Where and how to draw the boss: `ahead`/`lift` in blocks from Rafa's feet; `flip` = mirror the frame (Fabinho's art
 *  faces right, the Aranha's left); frame '' = boss hidden (e.g. he is the hazard in flight). */
export interface BossPose {
  frame: string; ahead: number; lift: number; flip: boolean; rot?: number; skid?: boolean; hit?: boolean; train?: TrainPose;
  run?: number; // run phase in cycles: gym Fabinho draws his run cycle (fabinhoGym.ts) instead of `frame`
  bar?: boolean; // the frame hangs from a pull-up bar (its origin): chains run from the bar ends up to the ceiling
}
/** The train's body pivot `ahead` blocks of Rafa; `crash` = beats since it slammed to a stop (debris), if it did. */
export interface TrainPose { ahead: number; crash?: number }
export interface BossDef {
  atlas: string; png: string; json: string;
  scale: number; // 1: sliced from a user sheet (1:1, smooth); 3: code-drawn (×3, nearest); < 1: code-drawn at sheet density (smooth)
  ahead: number; // blocks ahead of Rafa where his attacks leave his hands (dsl attack()'s `ahead`)
  train?: boolean; // rides the party train
  cheer?: [atlas: string, dx: number][]; // sheet characters (art/<atlas>, g_pose_*) cheering dx blocks from the finish line
  attacks: Record<string, HazardKind>; // bossAttack name → the hazard kind it releases
  pose(m: BossMove, beat: number): BossPose | null; // null = off stage
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const frac = (v: number) => v - Math.floor(v);

// --- Fabinho (level 1): runs ahead of Rafa, turns to throw plates / bowl med balls, leaps into shockwaves, ---
// --- shows off with exercises between them (fabinhoGym.ts), and ends knocked flat when she overtakes him. ---
const FAB = { atlas: FABINHOGYM_ATLAS, file: 'art/fabinhogym', anim: FABINHOGYM };
const A = FAB.anim;
const first = (a: SheetAnim) => a.frames[0], last = (a: SheetAnim) => a.frames[a.frames.length - 1];
const D = BOSS_AHEAD + 0.5; // his head (frame origin) half a block past the release point, so his hands are on it
// Taunt (~4 beats with nothing thrown): dash a little further ahead, stop and taunt on the spot (laughing, then
// checking his phone) while Rafa closes in, then sprint back.
const TAUNTS = { taunt: A.taunt_laugh, taunt2: A.taunt_phone };
const DASH = 0.5, UP = 2.5, BACK_T = 4, LEAD = 2; // beats since the cue; LEAD = extra blocks of the dash
const run = (beat: number, rate = 1): BossPose => ({ frame: animFrame(A.run, beat * rate), run: beat * rate, ahead: D, lift: 0, flip: false });

export const fabinho: BossDef = {
  atlas: FAB.atlas, png: `${FAB.file}.png`, json: `${FAB.file}.json`, scale: 1, ahead: BOSS_AHEAD,
  attacks: { frisbeeLow: 'frisbee', frisbeeHigh: 'frisbee', shockwave: 'shockwave', medBallLow: 'medBall', medBallHigh: 'medBall' },
  pose({ name, t, release: r, idle }, beat) {
    const ex = idle && exercise(idle, beat); // facing away from her, gliding along with the scroll like his wind-ups
    if (ex) return { ...ex, ahead: D, flip: false };
    switch (name) {
      case 'enter': // overtakes her from behind
        if (t < 3) return { ...run(beat, 1.6), ahead: lerp(-10, D, easeOut(t / 3)) };
        break;
      case 'taunt':
      case 'taunt2': {
        const spot = D + LEAD + 4 * DASH; // world-fixed while he taunts: ahead = spot − 4·t
        if (t < DASH) return { ...run(beat, 2), ahead: lerp(D, spot - 4 * DASH, easeOut(t / DASH)) };
        if (t < UP) return { frame: animFrame(TAUNTS[name], t - DASH), ahead: spot - 4 * t, lift: 0, flip: true };
        if (t < BACK_T) return { ...run(beat, 1.6), ahead: lerp(spot - 4 * UP, D, easeOut((t - UP) / (BACK_T - UP))) };
        break;
      }
      case 'frisbeeLow':
      case 'frisbeeHigh':
      case 'medBallLow':
      case 'medBallHigh': // wind-up facing her, skidding along; release pose as the hazard leaves his hands
        if (t < r) return { frame: first(A.throw), ahead: D, lift: 0, flip: true, skid: true };
        if (t < r + 0.6) {
          if (name === 'frisbeeHigh') return { frame: last(A.leap), ahead: D, lift: 0.3 * Math.sin((Math.PI * (t - r)) / 0.6), flip: true };
          return { frame: first(A.land), ahead: D, lift: 0, flip: true, skid: true }; // low throw / bowl: hands near the floor
        }
        break;
      case 'shockwave': // crouch, leap on an arc, land on the release beat: the wave starts at his feet
        if (t < r - 1) return { frame: first(A.throw), ahead: D, lift: 0, flip: true, skid: true };
        if (t < r) {
          const u = t - (r - 1);
          return { frame: u < 0.5 ? first(A.leap) : last(A.leap), ahead: D, lift: 6 * u * (1 - u), flip: true };
        }
        if (t < r + 0.5) return { frame: animFrame(A.land, t - r), ahead: D, lift: 0, flip: true, skid: true };
        break;
      case 'exit': { // stops, she reaches him, he's bowled over and left behind face-down, then sulks
        const hitT = (D - 0.5) / 4;
        if (t < hitT) return { frame: animFrame(A.idle, t), ahead: D - 4 * t, lift: 0, flip: true };
        const u = t - hitT, k = Math.min(1, u / 0.6);
        const ahead = D - 4 * t + 2.5 * easeOut(k);
        if (ahead < -16) return null;
        const down = u < 2.5;
        return { frame: down ? first(A.defeated) : first(A.sulk), ahead, lift: 4 * 1.2 * k * (1 - k), flip: false, rot: down ? -0.5 * (1 - k) : 0, hit: u < 0.15 };
      }
    }
    return run(beat);
  },
};

// --- O Aranha da Carreta (level 3): dances funk on the roof of the party train, which rolls a constant distance ---
// --- ahead of Rafa. Train geometry: art-src/bosses/train.mjs, art px from the body's ground pivot (×3 on screen). ---
// --- His own frames are in art/aranha (drawn at the sheet characters' density). ---
const PX = 1 / 32; // art px → blocks
const ROOF = 90 * PX; // roof top
const TRAIN = ARANHA_AHEAD + 2; // body pivot: the cab's nose (+97 px) stays inside a 4:3 view (10.8 blocks ahead of Rafa)
const SPOT = TRAIN - 1.25; // where he dances, on the flat roof stage (−94…+24 px); his hands reach ARANHA_AHEAD
const LADDER = TRAIN - 3; // the ladder up the back of the box
const SPEAKER = { x: -66 * PX, y: 46 * PX }; // the rear speaker cone: his defeat ends head-first in it
const ENTER = 0.75; // beats from bossEnter to the train slamming to a stop (chart it so that lands on the boom)
const BACK = 100 * PX + 0.45; // train pivot ahead of Rafa when she touches the back of the train (−100 px)

const onRoof = (frame: string, dx = 0): BossPose => ({ frame, ahead: SPOT + dx, lift: ROOF, flip: false, train: { ahead: TRAIN } });
const dance = (beat: number) => onRoof(`aranha_step_${Math.floor(beat) & 3}`); // the funk two-step, a step per beat
const squat = (beat: number) => onRoof(frac(beat) < 0.35 ? 'aranha_pose1_b' : 'aranha_pose1'); // the taunt: bounces down on every beat

export const aranha: BossDef = {
  atlas: ARANHA, png: 'art/aranha.png', json: 'art/aranha.json', scale: ARANHA_SCALE, ahead: ARANHA_AHEAD, train: true,
  cheer: [['giovanni', -2.4], ['nathalia', 2.3], ['murilo', 3.9]], // the win: the couple and Giovanni around her on the floor
  attacks: { web: 'webBlob', line: 'webLine', dive: 'spiderDive' },
  pose({ name, t, release: r }, beat) {
    switch (name) {
      case 'enter': { // bursts in from the right and slams to a stop; he rides it crouched, then taunts through the honks
        if (t < ENTER) {
          const ahead = TRAIN + 12 * (1 - t / ENTER) ** 2;
          return { frame: 'aranha_pose1_b', ahead: ahead - (TRAIN - SPOT), lift: ROOF, flip: false, skid: t > 0.3, train: { ahead } };
        }
        return { ...squat(beat), hit: t < ENTER + 0.15, train: { ahead: TRAIN, crash: t - ENTER } };
      }
      case 'taunt':
        if (t < 3.5) return squat(beat);
        break;
      case 'web': // blob: arm cocked back, flung on the release
        if (t < r) return onRoof('aranha_web_0');
        if (t < r + 0.5) return onRoof('aranha_web_1');
        break;
      case 'line': // line: arm out, aimed straight at her, until the strand leaves his hand
        if (t < r + 0.5) return onRoof('aranha_web_1');
        break;
      case 'dive': // wound up from pose 2, takes off, IS the spiderDive while it's out, then climbs back up the ladder
        if (t < r - 0.3) return onRoof(frac(beat) < 0.35 ? 'aranha_pose2_b' : 'aranha_pose2');
        if (t < r) return { ...onRoof('aranha_flip_0', -1.5 * (t - r + 0.3)), lift: ROOF + 2 * (t - r + 0.3) };
        if (t < r + 1.6) return onRoof('');
        if (t < r + 2.4) return { ...onRoof('aranha_flip_2', LADDER - SPOT), lift: ROOF * Math.min(1, (t - r - 1.6) / 0.6) };
        if (t < r + 2.9) return onRoof(`aranha_step_${Math.floor(t * 4) & 3}`, (LADDER - SPOT) * (1 - (t - r - 2.4) / 0.5));
        break;
      case 'exit': { // the train brakes, she rams it: he's tangled in his own web, lands head-first in the speaker,
        const hitT = (TRAIN - BACK) / 4; // and the train rolls off with him in it
        const stopped = TRAIN - 4 * Math.min(t, hitT);
        if (t < hitT) return { ...squat(beat), ahead: stopped - (TRAIN - SPOT), train: { ahead: stopped } };
        const u = t - hitT, ahead = stopped + 5 * u + 6 * u * u;
        if (ahead > 40) return null;
        if (u < 0.7) {
          const k = u / 0.7;
          return {
            frame: 'aranha_defeat_0', ahead: ahead + lerp(SPOT - TRAIN, SPEAKER.x, k), lift: lerp(ROOF, SPEAKER.y, k) + 6 * k * (1 - k),
            flip: false, rot: 7 * k, hit: u < 0.15, train: { ahead },
          };
        }
        return { frame: 'aranha_defeat_1', ahead: ahead + SPEAKER.x, lift: SPEAKER.y, flip: false, train: { ahead } };
      }
    }
    return dance(beat);
  },
};

export const BOSS_DEFS: Record<BossId, BossDef> = { fabinho, aranha };

// The party train: body at ground level, wheels turning with the distance it covers, speaker cones pumping on the beat,
// bulbs alternating on the half beat, and crash debris thrown off the roof as it slams to a stop. Pure in (pose, beat).
const WHEELS = [[-72, -11], [-46, -11], [46, -11], [78, -11]], WHEEL_R = 11.5;
const DEBRIS = [[-2.6, 2.9, -4, 9], [-1, 3, -1.5, 11], [0.5, 2.8, 2, 10], [2.2, 2, 4, 8], [-2, 2.6, -2.5, 6], [1.4, 2.2, 1, 7]];

class Train {
  private readonly body: Phaser.GameObjects.Image;
  private readonly speaker: Phaser.GameObjects.Image;
  private readonly bulbs: Phaser.GameObjects.Image;
  private readonly wheels: Phaser.GameObjects.Image[];
  private readonly debris: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene, key: string, private readonly bpb: number) {
    const img = (frame: string, depth: number) => scene.add.image(0, 0, key, frame).setScale(ART_SCALE).setDepth(depth).setVisible(false);
    this.body = img('train_body', 6);
    this.speaker = img('train_speaker_0', 6.1);
    this.bulbs = img('train_bulbs_0', 6.1);
    this.wheels = WHEELS.map(() => img('train_wheel', 6.2));
    this.debris = DEBRIS.map((_, i) => img(`train_crash_debris_${i % 3}`, 9));
  }

  draw(tp: TrainPose | undefined, beat: number, rx: number): void {
    const on = !!tp;
    for (const o of [this.body, this.speaker, this.bulbs, ...this.wheels, ...this.debris]) o.setVisible(on);
    if (!tp) return;
    const x = Math.round(rx + tp.ahead * B);
    this.body.setPosition(x, 0);
    this.speaker.setFrame(frac(beat) < 0.25 ? 'train_speaker_1' : 'train_speaker_0').setPosition(x, 0);
    this.bulbs.setFrame(`train_bulbs_${Math.floor(beat * 2) & 1}`).setPosition(x, 0);
    const turn = ((beat * this.bpb + tp.ahead) * B) / (WHEEL_R * ART_SCALE);
    this.wheels.forEach((w, i) => w.setPosition(x + WHEELS[i][0] * ART_SCALE, WHEELS[i][1] * ART_SCALE).setRotation(turn));
    const c = tp.crash ?? -1;
    this.debris.forEach((d, i) => {
      const [x0, y0, vx, vy] = DEBRIS[i], y = y0 + vy * c - 14 * c * c;
      d.setVisible(c >= 0 && y > 0).setPosition(x + (x0 + vx * c) * B, -y * B).setRotation(c * (i % 2 ? 9 : -7));
    });
  }
}

const CEIL_Y = (CEILING.gym - 296) * ART_SCALE; // gym truss (bg manifest groundY 296): the pull-up chains' top

export class BossActor {
  private readonly cues: BossCue[] = [];
  private readonly idle: Idle[]; // gym Fabinho's exercise windows
  private readonly chains: Phaser.GameObjects.Graphics;
  private readonly img: Phaser.GameObjects.Image;
  private readonly legs: FabinhoGymRun | null; // gym Fabinho's run cycle
  readonly kinds: ReadonlySet<HazardKind>;
  private readonly m: BossMove = { name: '', t: 0, release: NaN };
  private readonly train: Train | null;
  private readonly cheer: { atlas: string; x: number; flip: boolean; img: Phaser.GameObjects.Image | null }[];
  readonly ahead: number;

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, L: Level, private readonly def: BossDef) {
    const bpb = L.def.blocksPerBeat;
    for (const c of L.cues) {
      if (c.cue !== 'bossEnter' && c.cue !== 'bossAttack' && c.cue !== 'bossExit') continue;
      const name = c.cue === 'bossAttack' ? c.attack : c.cue === 'bossEnter' ? 'enter' : 'exit';
      const kind = def.attacks[name];
      // The cue's hazard: the first of its kind released at or after the cue.
      let rel = NaN;
      if (kind) for (const h of L.hazards) {
        const r = releaseBeat(h, bpb, def.ahead);
        if (h.kind === kind && r >= c.beat - 1e-6 && !(r >= c.beat + rel)) rel = r - c.beat;
      }
      if (kind && Number.isNaN(rel)) console.warn(`boss: '${name}' at beat ${c.beat} has no ${kind} to release`);
      this.cues.push({ beat: c.beat, name, release: rel });
    }
    this.kinds = new Set(Object.values(def.attacks));
    if (def.scale > 1 && scene.textures.exists(def.atlas)) scene.textures.get(def.atlas).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.img = scene.add.image(0, 0, def.atlas).setScale(def.scale).setDepth(8).setVisible(false);
    this.legs = def.atlas === FABINHOGYM_ATLAS ? createFabinhoGymRun(scene) : null;
    this.legs?.root.setDepth(8).setVisible(false);
    this.idle = this.legs ? idleWindows(this.cues, L.def.sections.find((s) => s.name === 'finale')?.beat) : [];
    this.chains = scene.add.graphics().setDepth(7.9);
    this.train = def.train ? new Train(scene, BOSSES, bpb) : null; // the train stays in the bosses atlas
    // Optional sheets: loaded after preload; a missing atlas leaves that person out.
    const endX = L.def.lengthBeats * bpb * B;
    this.cheer = (def.cheer ?? []).map(([atlas, dx]) => ({ atlas, x: endX + dx * B, flip: dx > 0, img: null }));
    for (const c of this.cheer) if (!scene.textures.exists(c.atlas)) scene.load.atlas(c.atlas, `art/${c.atlas}.png`, `art/${c.atlas}.json`);
    if (this.cheer.length) scene.load.start();
    this.scene = scene;
    this.ahead = def.ahead;
  }

  /** Poses the boss for render beat `beat` with Rafa's feet at world x `rx`; `fxBeat` keeps running after the win
   *  (the cheering). Returns the pose (null = off stage). */
  draw(beat: number, rx: number, fxBeat = beat): BossPose | null {
    this.cheer.forEach((c, i) => { // facing her (sheets face right), alternating arms-up and laughing, bouncing on the beat
      if (!c.img && this.scene.textures.get(c.atlas).has('g_pose_laugh')) c.img = this.scene.add.image(c.x, 0, c.atlas, 'g_pose_armsup').setDepth(7).setFlipX(c.flip);
      c.img?.setFrame((Math.floor(fxBeat) + i) & 1 ? 'g_pose_laugh' : 'g_pose_armsup').setY(-Math.abs(Math.sin(Math.PI * fxBeat)) * 0.25 * B);
    });
    let c: BossCue | undefined;
    for (const q of this.cues) if (q.beat <= beat) c = q;
    const idle = this.idle.find((w) => beat >= w.from && beat < w.to);
    const p = c ? this.def.pose(Object.assign(this.m, { name: c.name, t: beat - c.beat, release: c.release, idle }), beat) : null;
    this.train?.draw(p?.train, beat, rx);
    this.chains.clear();
    if (p?.bar) {
      const x = Math.round(rx + p.ahead * B), y = Math.round(-p.lift * B);
      this.chains.lineStyle(4, 0x1a1420, 1).lineBetween(x - BAR_HALF, y, x - BAR_HALF, CEIL_Y).lineBetween(x + BAR_HALF, y, x + BAR_HALF, CEIL_Y);
    }
    const legs = !!(this.legs && p?.frame && p.run !== undefined);
    this.legs?.root.setVisible(legs);
    this.img.setVisible(!!p?.frame && !legs);
    if (legs) drawFabinhoGymRun(this.legs!, p!.run!, Math.round(rx + p!.ahead * B), Math.round(-p!.lift * B), p!.flip);
    if (!p?.frame || legs) return p;
    if (this.img.frame.name !== p.frame) this.img.setFrame(p.frame);
    this.img.setFlipX(p.flip).setRotation(p.rot ?? 0).setPosition(Math.round(rx + p.ahead * B), Math.round(-p.lift * B));
    return p;
  }
}
