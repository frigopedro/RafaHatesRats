// Reads the beat from the clock, steps the sim in whole ticks up to it, and draws. x is analytic from the beat;
// y is interpolated between the last two ticks. Drawing is a function of (beat, sim state); effects run on an
// "fx beat" that keeps going after a crash or a win.
import Phaser from 'phaser';
import { RAFAGYM_ATLAS } from '../art/sheets';
import { BOSS_AHEAD, CRASH_MS, HAZARDS, ITEM_SIZE, PLAYER, TICKS_PER_BEAT as TPB, VIEW } from '../config';
import { hazardPos, type Pos } from '../sim/behaviors';
import { compileLevel, createState, overdriveActive, step } from '../sim/sim';
import type { TraceInput } from '../sim/solver';
import type { GameControl, GameHooks, Level, LevelDef, RafaKit, SimEvent, SimState } from '../types';
import { Background, BG_MANIFEST, themeFiles, type BgManifest } from './background';
import { BOSS_DEFS, BossActor } from './bosses';
import type { BeatClock } from './clock';
import { Fx } from './fx';
import { ART_SCALE, BOSSES, findArt, PROPS, resetArtCache, WorldViews } from './hazardViews';
import type { Input } from './input';
import { createRafaKit, drawRafaKit, KITS_ATLAS, type RafaKitRig } from './rafaKits';
import { createRafaGym, drawRafaGym } from './rafaGym';
import { createRafa, drawRafa, RAFA_ATLAS, type RafaFx } from './rafaView';

export interface SceneOptions {
  level: LevelDef;
  clock: BeatClock;
  input: Input;
  hooks: GameHooks;
  startBeat: number;
  bot: TraceInput[] | null; // ?bot=1: replay these tick-keyed inputs instead of the player's
  debug: boolean; // ?debug=1: hitbox overlay
  onReady(control: GameControl): void;
}

type Phase = 'ready' | 'run' | 'crash' | 'over' | 'won';
const B = VIEW.block;
const MAX_BEHIND = 30; // ticks; further behind than this (hitch, tab switch) we re-anchor instead of fast-forwarding
const HITSTOP_MS = 90; // Rafa freezes this long on a crash before she tumbles
const RAFA_H: Record<RafaKit, number> = { standing: 2.1, crutches: 2.3, wheelchair: 1.9 }; // visual height, blocks (effects centre on her)

const KNEE_MS = 1500; // level 1's ending: the victory cheer, then her knee goes
/** Rafa per LevelDef.rafa: her atlas and view, all with drawRafa's call shape (`started` = the run has begun;
 *  `ending` = the post-win story beat, for views that have one). */
interface RafaView {
  atlas: string; url: string; // atlas key, 'art/<name>' (.png + .json)
  create(scene: Phaser.Scene): unknown;
  draw(rig: unknown, s: SimState, fx: RafaFx, beat: number, x: number, y: number, od: boolean, nowMs: number, deadMs: number, started: boolean, ending: boolean): void;
}
const kitView = (kit: 'standing' | 'crutches'): RafaView => ({ // the derived rig; 'standing' was level 1's stand-in
  atlas: KITS_ATLAS, url: 'art/kits', create: (sc) => createRafaKit(sc, kit),
  draw: (r, s, fx, beat, x, y, od, now, dead, started) => drawRafaKit(r as RafaKitRig, s, fx, beat, x, y, od, now, dead, !started || s.won),
});
const RAFA: Record<RafaKit, RafaView> = {
  wheelchair: { atlas: RAFA_ATLAS, url: 'art/rafa', create: createRafa, draw: drawRafa as RafaView['draw'] },
  standing: { atlas: RAFAGYM_ATLAS, url: 'art/rafagym', create: createRafaGym, draw: drawRafaGym as RafaView['draw'] },
  crutches: kitView('crutches'),
};

export class GameScene extends Phaser.Scene implements GameControl {
  private readonly L: Level;
  private s: SimState;
  private phase: Phase = 'ready';
  private paused = false;
  private held = false;
  private pending: TraceInput[] = [];
  private botIdx = 0;
  private fx: RafaFx = { jumpTick: -1e9, landTick: -1e9, deadTick: -1 };
  private death: Extract<SimEvent, { type: 'death' }> | null = null;
  private deadMs = 0;
  private endMs = 0; // performance.now() of the crash or the win
  private renderTick = 0; // fractional tick being drawn
  private g!: Phaser.GameObjects.Graphics; // grey-box ground when the background manifest is missing
  private dbg: Phaser.GameObjects.Graphics | null = null;
  private rafa: unknown; // RAFA[level.rafa]'s rig
  private bg: Background | null = null;
  private views!: WorldViews;
  private boss: BossActor | null = null;
  private bossHit = false;
  private lastSkid = -1e9;
  private effects!: Fx;
  private view = { w: 1, h: 1 }; // visible logical px
  private readonly pos: Pos = { x: 0, y: 0, on: false };
  private readonly rect = { left: 0, top: 0, w: 1, h: 1 };

  constructor(private readonly o: SceneOptions) {
    super('game');
    this.L = compileLevel(o.level);
    this.s = createState(this.L, o.startBeat);
    this.renderTick = this.s.tick;
  }

  get running(): boolean {
    return this.phase === 'run';
  }

  get coins(): number {
    return this.s.coins;
  }

  get smashed(): number {
    let n = 0;
    for (const v of this.s.smashed) n += v;
    return n;
  }

  preload(): void {
    const d = this.L.def;
    const rv = RAFA[d.rafa];
    this.load.atlas(rv.atlas, `${rv.url}.png`, `${rv.url}.json`);
    this.load.atlas(PROPS, 'art/props.png', 'art/props.json');
    this.load.atlas(BOSSES, 'art/bosses.png', 'art/bosses.json');
    const boss = d.boss && BOSS_DEFS[d.boss];
    if (boss) this.load.atlas(boss.atlas, boss.png, boss.json);
    this.load.json(BG_MANIFEST, 'art/bg/manifest.json');
    this.load.once(`filecomplete-json-${BG_MANIFEST}`, (_key: string, _type: string, m: BgManifest) => {
      for (const f of themeFiles(m, d.theme)) this.load.image(f, `art/${f}`);
    });
  }

  create(): void {
    const d = this.L.def;
    resetArtCache();
    const man = this.cache.json.get(BG_MANIFEST) as BgManifest | undefined;
    const endX = d.lengthBeats * d.blocksPerBeat * B;
    if (man?.themes[d.theme]) this.bg = new Background(this, man, d.theme, endX, this.L.ground.map(([a, b]) => [a * B, b * B]));
    else {
      console.warn(`background: no theme '${d.theme}' in the manifest, drawing a grey box`);
      this.cameras.main.setBackgroundColor('#1d4b52');
    }
    this.g = this.add.graphics().setDepth(-1);
    if (d.theme === 'gym') this.makeFinish(endX);
    this.views = new WorldViews(this, this.L, d.theme, man?.view.groundY ?? 296);
    if (d.boss) this.boss = new BossActor(this, this.L, BOSS_DEFS[d.boss]);
    const n = this.children.list.length;
    this.rafa = RAFA[d.rafa].create(this);
    for (const o of this.children.list.slice(n)) (o as Phaser.GameObjects.Image).setDepth?.(20); // in front of the world
    this.effects = new Fx(this);
    if (this.o.debug) {
      this.dbg = this.add.graphics().setDepth(40);
      Object.assign(window, { rhrScene: this }); // ?debug=1: lets scripts read renderer/display-list stats
    }
    this.scale.on('resize', this.layout, this);
    this.layout();
    this.o.onReady(this);
  }

  /** Level 1's finish: a chequered line on the floor, an arch with a banner, and a podium with the cup. Churches and
   *  parties end on their manifest set piece instead. */
  private makeFinish(endX: number): void {
    const x = endX - 0.5 * B; // she stops just past the line
    const g = this.add.graphics().setDepth(2);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) g.fillStyle((i + j) % 2 ? 0x15131a : 0xf2efe8, 1).fillRect(x - 16 + j * 16, i * 16, 16, 16);
    const arch = this.add.graphics().setDepth(3);
    const post = (px: number) => arch.fillStyle(0x15131a, 1).fillRect(px - 10, -3.9 * B, 20, 3.9 * B).fillStyle(0x9aa3ad, 1).fillRect(px - 6, -3.9 * B, 12, 3.9 * B);
    post(x - 1.6 * B);
    post(x + 1.6 * B);
    arch.fillStyle(0x15131a, 1).fillRect(x - 2.1 * B, -4.6 * B, 4.2 * B, 0.95 * B).fillStyle(0xc8302c, 1).fillRect(x - 2.1 * B + 6, -4.6 * B + 6, 4.2 * B - 12, 0.95 * B - 12);
    this.add.text(x, -4.13 * B, 'CHEGADA', { fontFamily: '"Jersey 15", system-ui, sans-serif', fontSize: '64px', color: '#ffd23a' }).setOrigin(0.5).setDepth(3);
    const px = endX + 2.6 * B;
    arch.fillStyle(0x15131a, 1).fillRect(px - 0.75 * B, -0.85 * B, 1.5 * B, 0.85 * B).fillStyle(0xd9a62a, 1).fillRect(px - 0.75 * B + 6, -0.85 * B + 6, 1.5 * B - 12, 0.85 * B - 6);
    this.add.text(px, -0.42 * B, '1', { fontFamily: '"Jersey 15", system-ui, sans-serif', fontSize: '64px', color: '#15131a' }).setOrigin(0.5).setDepth(3);
    const cup = findArt(this, 'trophy');
    if (cup) this.add.image(px, -0.85 * B, cup.key, cup.frames[0]).setScale(ART_SCALE).setOrigin(0.5, 1).setDepth(3);
  }

  start(): void {
    this.s = createState(this.L, this.o.startBeat);
    this.renderTick = this.s.tick;
    this.o.clock.start(this.s.tick / TPB);
    this.phase = 'run';
    this.paused = false;
    this.held = false;
    this.pending = [];
    this.o.input.clear();
    this.botIdx = this.o.bot ? this.o.bot.findIndex((e) => e.tick > this.s.tick) : 0;
    if (this.botIdx < 0) this.botIdx = this.o.bot!.length;
    this.fx = { jumpTick: -1e9, landTick: -1e9, deadTick: -1 };
    this.death = null;
    this.bossHit = false;
    this.effects.clear();
  }

  setPaused(paused: boolean): void {
    if (this.phase !== 'run' || paused === this.paused) return;
    this.paused = paused;
    if (paused) this.o.clock.pause();
    else {
      this.o.input.clear();
      this.o.clock.resume();
    }
  }

  private layout(): void {
    const W = this.scale.width, H = this.scale.height;
    let zoom = H / VIEW.height;
    if (W / H < VIEW.minAspect) zoom = W / (VIEW.height * VIEW.minAspect);
    if (Math.abs(zoom - 1) < VIEW.zoomSnap) zoom = 1; // keeps the 1:1 sheet art pixel-exact on phones
    const vpW = Math.min(W, Math.round(H * VIEW.maxAspect)); // wider than 21:9 → pillarbox
    this.cameras.main.setViewport(Math.round((W - vpW) / 2), 0, vpW, H).setZoom(zoom);
    this.view = { w: vpW / zoom, h: H / zoom };
  }

  update(): void {
    const now = performance.now();
    const edges = this.o.input.take();
    if (this.phase === 'run' && !this.paused) {
      const clock = this.o.clock;
      if (!this.o.bot) for (const e of edges) this.pending.push({ tick: Math.ceil(clock.beat(e.time) * TPB), down: e.down });
      let exact = clock.beat(now) * TPB;
      if (exact - this.s.tick > MAX_BEHIND) {
        clock.reanchor(this.s.tick / TPB);
        exact = this.s.tick;
      }
      const target = Math.floor(exact) + 1;
      while (this.s.tick < target && this.phase === 'run') this.tick(now);
      clock.setOverdrive(this.s.overdriveFrom, this.s.overdriveUntil);
      this.renderTick = this.phase === 'run' ? Math.min(this.s.tick, Math.max(this.s.tick - 1, exact)) : this.s.tick;
    }
    if (this.phase === 'crash' && now - this.deadMs >= CRASH_MS) {
      this.phase = 'over';
      this.o.hooks.onGameOver(this.death!, this.progress());
    }
    this.draw(now);
    this.o.hooks.onFrame(this.renderTick / TPB, this.progress());
  }

  private progress(): number {
    return Math.min(1, Math.max(0, this.s.tick / this.L.endTick));
  }

  /** Rafa's world x at a tick. */
  private rafaX(tick: number): number {
    return (tick / TPB) * this.L.def.blocksPerBeat * B;
  }

  private tick(now: number): void {
    const T = this.s.tick + 1;
    let pressed = false, released = false;
    const apply = (down: boolean) => {
      if (down && !this.held) (pressed = true), (this.held = true);
      else if (!down && this.held) (released = true), (this.held = false);
    };
    const bot = this.o.bot;
    if (bot) for (; this.botIdx < bot.length && bot[this.botIdx].tick <= T; this.botIdx++) apply(bot[this.botIdx].down);
    else while (this.pending.length && this.pending[0].tick <= T) apply(this.pending.shift()!.down);

    const s = this.s, L = this.L, fx = this.effects;
    for (const e of step(L, s, { pressed, released, held: this.held })) {
      const t = e.tick / TPB, x = this.rafaX(e.tick), cy = -(s.y + RAFA_H[L.def.rafa] / 2) * B;
      if (e.type === 'jump') this.fx.jumpTick = e.tick;
      else if (e.type === 'land') {
        this.fx.landTick = e.tick;
        fx.land(t, x, -s.y * B);
      } else if (e.type === 'pickup') {
        const it = L.items[e.item];
        fx.pickup(t, e.kind, it.beat * L.def.blocksPerBeat * B, -(it.y + ITEM_SIZE / 2) * B);
      } else if (e.type === 'smash') {
        const p = hazardPos(L.hazards[e.hazard], t, L.def.blocksPerBeat, this.pos);
        fx.smash(t, e.kind === 'rat', p.x * B, -(p.y + HAZARDS[e.kind].h / 2) * B);
      } else if (e.type === 'shieldBreak') fx.shieldBreak(t, x, cy);
      else if (e.type === 'overdriveOn') fx.ignite(t, x, cy);
      else if (e.type === 'death') {
        this.phase = 'crash';
        this.death = e;
        this.deadMs = this.endMs = now;
        this.fx.deadTick = e.tick;
        fx.crash(t, x, cy);
      } else if (e.type === 'win') {
        this.phase = 'won';
        this.endMs = now;
        const r = this.rect;
        fx.confetti(t, r.left, r.top, r.w);
      }
      this.o.hooks.onSimEvent(e);
    }
  }

  /** Effects clock: the render beat during the run, then wall-clock beats after a crash or a win. */
  private fxBeat(now: number): number {
    if (this.phase === 'ready' || this.phase === 'run') return this.renderTick / TPB;
    return this.s.tick / TPB + ((now - this.endMs) * this.L.def.bpm) / 60000;
  }

  private draw(now: number): void {
    const s = this.s, L = this.L, d = L.def, bpb = d.blocksPerBeat;
    const beat = this.renderTick / TPB;
    const alpha = this.renderTick - (s.tick - 1);
    const y = s.prevY + (s.y - s.prevY) * Math.min(1, Math.max(0, alpha));
    const cam = this.cameras.main;
    const { w, h } = this.view;
    // Whole backbuffer pixels for the scroll, so 1:1 sprites stay sharp.
    const left = Math.round((beat * bpb * B - VIEW.playerX * w) * cam.zoom) / cam.zoom;
    const top = VIEW.groundFromBottom * B - h;
    cam.centerOn(left + w / 2, top + h / 2);
    Object.assign(this.rect, { left, top, w, h });
    const right = left + w;
    const od = overdriveActive(s, Math.floor(this.renderTick));
    const fxBeat = this.fxBeat(now);

    if (this.bg) this.bg.draw(left, w, top + h, cam.zoom, beat, od);
    else this.drawGreyGround(left, right);

    const rx = left + Math.round(VIEW.playerX * w);
    const pose = this.boss?.draw(beat, rx) ?? null;
    if (pose?.skid && this.phase === 'run') {
      for (; this.lastSkid + 0.25 <= beat; this.lastSkid = Math.max(this.lastSkid + 0.25, beat - 0.5)) this.effects.land(beat, rx + (pose.ahead - 0.3) * B, 0);
    } else this.lastSkid = beat;
    if (pose?.hit && !this.bossHit) this.effects.hit(fxBeat, rx + pose.ahead * B, -1.2 * B);
    this.bossHit = !!pose?.hit;
    this.views.draw(s, beat, left, right, rx + (BOSS_AHEAD + 0.01) * B, this.boss?.kinds ?? NO_KINDS);

    const started = this.phase !== 'ready';
    const deadMs = this.deadMs + HITSTOP_MS;
    // Idle (count-in, after the win) follows the fx beat so she keeps breathing while the run stands still.
    RAFA[d.rafa].draw(this.rafa, s, this.fx, !started || s.won ? fxBeat : beat, rx, -y * B, od, now, deadMs, started, s.won && now - this.endMs > KNEE_MS);
    const alive = this.fx.deadTick < 0 && !s.won;
    this.effects.update(fxBeat, rx, -y * B, -(y + RAFA_H[d.rafa] / 2) * B,
      { od, pre: s.tick < s.preUntil, shield: s.shield, alive }, this.rect);

    if (this.dbg) this.drawDebug(beat, rx, y);
  }

  private drawGreyGround(left: number, right: number): void {
    const g = this.g.clear();
    g.fillStyle(0x0b0b10, 1).fillRect(left, 0, right - left, VIEW.groundFromBottom * B + 4);
    for (const [a, b] of this.L.ground) {
      if (b * B < left || a * B > right) continue;
      const x0 = Math.max(a * B, left - 8), x1 = Math.min(b * B, right + 8);
      g.fillStyle(0x3b3542, 1).fillRect(x0, 0, x1 - x0, VIEW.groundFromBottom * B + 4);
      g.fillStyle(0x6e6578, 1).fillRect(x0, 0, x1 - x0, 10);
    }
  }

  private drawDebug(beat: number, rx: number, y: number): void {
    const d = this.dbg!, L = this.L, bpb = L.def.blocksPerBeat;
    d.clear().lineStyle(4, 0x00ff66, 1);
    d.strokeRect(rx - (PLAYER.w / 2) * B, -(y + PLAYER.h) * B, PLAYER.w * B, PLAYER.h * B);
    d.lineStyle(3, 0xff00ff, 1);
    for (let i = 0; i < L.hazards.length; i++) {
      const hz = L.hazards[i];
      if (Math.abs(hz.beat - beat) > 12) continue;
      const p = hazardPos(hz, beat, bpb, this.pos);
      if (!p.on) continue;
      const hw = L.halfW[i] * B, hh = HAZARDS[hz.kind].h * B;
      d.strokeRect(p.x * B - hw, -p.y * B - hh, hw * 2, hh);
    }
    d.lineStyle(3, 0x00ccff, 1);
    for (const it of L.items) {
      if (Math.abs(it.beat - beat) > 8) continue;
      const s = ITEM_SIZE * B;
      d.strokeRect(it.beat * bpb * B - s / 2, -it.y * B - s, s, s);
    }
  }
}

const NO_KINDS: ReadonlySet<never> = new Set();
