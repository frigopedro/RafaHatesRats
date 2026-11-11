// Reads the beat from the clock, steps the sim in whole ticks up to it, and draws. x is analytic from the beat;
// y is interpolated between the last two ticks.
import Phaser from 'phaser';
import { CRASH_MS, DROP_SHADOW_BEATS, HAZARDS, ITEM_SIZE, PLAYER, TICKS_PER_BEAT as TPB, VIEW } from '../config';
import { hazardPos, landBeat, platformOffset, type Pos } from '../sim/behaviors';
import { compileLevel, createState, overdriveActive, step } from '../sim/sim';
import type { TraceInput } from '../sim/solver';
import type { GameControl, GameHooks, Level, LevelDef, SimEvent, SimState } from '../types';
import type { BeatClock } from './clock';
import { drawHazard, drawItem, drawShadow } from './hazardViews';
import type { Input } from './input';
import { drawRafa, RAFA_ATLAS, type RafaFx } from './rafaView';

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
  private renderTick = 0; // fractional tick being drawn
  private g!: Phaser.GameObjects.Graphics;
  private dbg: Phaser.GameObjects.Graphics | null = null;
  private rafa!: Phaser.GameObjects.Image;
  private view = { w: 1, h: 1 }; // visible logical px
  private readonly pos: Pos = { x: 0, y: 0, on: false };

  constructor(private readonly o: SceneOptions) {
    super('game');
    this.L = compileLevel(o.level);
    this.s = createState(this.L, o.startBeat);
    this.renderTick = this.s.tick;
  }

  get running(): boolean {
    return this.phase === 'run';
  }

  preload(): void {
    this.load.atlas(RAFA_ATLAS, 'art/rafa.png', 'art/rafa.json');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1d4b52');
    this.g = this.add.graphics();
    const bpb = this.L.def.blocksPerBeat;
    for (const c of this.L.cues) {
      if (c.cue !== 'hint') continue;
      this.add.text(c.beat * bpb * B, -3.3 * B, c.text, {
        fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: '64px', color: '#ffe14a',
        stroke: '#1a1420', strokeThickness: 10,
      }).setOrigin(0.5, 1);
    }
    this.rafa = this.add.image(0, 0, RAFA_ATLAS, 'push_0');
    if (this.o.debug) this.dbg = this.add.graphics();
    this.scale.on('resize', this.layout, this);
    this.layout();
    this.o.onReady(this);
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

    for (const e of step(this.L, this.s, { pressed, released, held: this.held })) {
      if (e.type === 'jump') this.fx.jumpTick = e.tick;
      else if (e.type === 'land') this.fx.landTick = e.tick;
      else if (e.type === 'death') {
        this.phase = 'crash';
        this.death = e;
        this.deadMs = now;
        this.fx.deadTick = e.tick;
      } else if (e.type === 'win') this.phase = 'won';
      this.o.hooks.onSimEvent(e);
    }
  }

  private draw(now: number): void {
    const s = this.s, L = this.L, g = this.g, bpb = L.def.blocksPerBeat;
    const beat = this.renderTick / TPB;
    const alpha = this.renderTick - (s.tick - 1);
    const y = s.prevY + (s.y - s.prevY) * Math.min(1, Math.max(0, alpha));
    const cam = this.cameras.main;
    const { w, h } = this.view;
    // Whole backbuffer pixels for the scroll, so 1:1 sprites stay sharp.
    const left = Math.round((beat * bpb * B - VIEW.playerX * w) * cam.zoom) / cam.zoom;
    const top = VIEW.groundFromBottom * B - h;
    cam.centerOn(left + w / 2, top + h / 2);
    const right = left + w;
    const b0 = left / B / bpb - 1, b1 = right / B / bpb + 1; // visible beats, padded

    g.clear();
    // Holes first (dark pit), ground on top.
    g.fillStyle(0x0b0b10, 1).fillRect(left, 0, w, VIEW.groundFromBottom * B + 4);
    for (const [a, b] of L.ground) {
      if (b * B < left || a * B > right) continue;
      const x0 = Math.max(a * B, left - 8), x1 = Math.min(b * B, right + 8);
      g.fillStyle(0x3b3542, 1).fillRect(x0, 0, x1 - x0, VIEW.groundFromBottom * B + 4);
      g.fillStyle(0x6e6578, 1).fillRect(x0, 0, x1 - x0, 10);
    }
    // Beat marks on the floor: small every beat, tall every bar.
    g.fillStyle(0x8f86a0, 1);
    for (let k = Math.ceil(b0); k <= b1; k++) g.fillRect(k * bpb * B - 3, 10, 6, k % 4 ? 14 : 40);

    for (const p of L.platforms) {
      const x0 = (p.beat * bpb + platformOffset(p, beat, 'dx')) * B, x1 = x0 + p.len * bpb * B;
      if (x1 < left || x0 > right) continue;
      const py = -(p.y + platformOffset(p, beat, 'dy')) * B;
      g.fillStyle(0x1a1420, 1).fillRect(x0, py - 2, x1 - x0, 30);
      g.fillStyle(0x9aa7b0, 1).fillRect(x0 + 3, py, x1 - x0 - 6, 22);
    }

    for (let i = 0; i < L.hazards.length; i++) {
      const hz = L.hazards[i];
      if (hz.beat < b0 - 2 || hz.beat > b1 + 12) continue; // runners/fliers come from further ahead
      if (hz.b === 'drop' || hz.b === 'lob') {
        const k = 1 - (landBeat(hz) - beat) / DROP_SHADOW_BEATS;
        if (k > 0 && k < 1) drawShadow(g, hz.beat * bpb * B, k);
      }
      const p = hazardPos(hz, beat, bpb, this.pos);
      if (!p.on || p.x * B < left - 2 * B || p.x * B > right + 2 * B) continue;
      drawHazard(g, hz, p.x * B, -p.y * B, s.smashed[i] === 1);
    }
    for (let i = 0; i < L.items.length; i++) {
      const it = L.items[i];
      if (s.taken[i] || it.beat < b0 || it.beat > b1) continue;
      drawItem(g, it.kind, it.beat * bpb * B, -it.y * B, beat);
    }

    const od = overdriveActive(s, Math.floor(this.renderTick));
    const rx = left + Math.round(VIEW.playerX * w);
    if (od) g.fillStyle(0xff6a1c, 0.35).fillCircle(rx, -(y + PLAYER.h / 2) * B, 1.3 * B); // grey-box heat glow
    if (s.shield) g.lineStyle(6, 0xe8f2ff, 0.8).strokeCircle(rx, -(y + PLAYER.h / 2) * B, 1.15 * B);
    drawRafa(this.rafa, s, this.fx, beat, rx, -y * B, od, now, this.deadMs);

    if (this.dbg) this.drawDebug(beat, rx, y);
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
