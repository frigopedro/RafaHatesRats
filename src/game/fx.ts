// "Juice", subordinate to readability: a bounded particle pool (props atlas effects, timed in beats) plus a few
// persistent pieces (Whey bubble, Gelol glow/vignette, beat line). Particles run on an "fx beat" that the scene keeps
// advancing after a crash or a win, so bursts finish while the run itself is frozen. Camera shake/flash obey reduceFx.
import Phaser from 'phaser';
import { VIEW } from '../config';
import { getSettings } from '../save';
import type { ItemKind } from '../types';
import { ART_SCALE, BOSSES, findArt, PROPS } from './hazardViews';

type Img = Phaser.GameObjects.Image;
const B = VIEW.block;
const MAX = 160; // particle cap: the oldest is recycled when full

interface Part {
  img: Img; key: string; frames: string[]; loop: number; // loop > 0: frames per beat; 0: play once over the life
  t0: number; life: number; x: number; y: number; vx: number; vy: number; g: number; // px, px/beat, px/beat²
  spin: number; rot: number; scale: number; fade: boolean; alpha: number;
}
interface Opts { vx?: number; vy?: number; g?: number; spin?: number; rot?: number; scale?: number; tint?: number; loop?: number; fade?: boolean; add?: boolean; alpha?: number; depth?: number; key?: string }

const PICK_TINT: Record<ItemKind, number> = { coin: 0xffe27a, whey: 0xd8f0ff, pre: 0xa8ff7a, gelol: 0xffa24a };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function gradient(scene: Phaser.Scene, key: string, w: number, h: number, inner: string, outer: string, r0: number, r1: number): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h)!;
  const ctx = t.getContext();
  const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * r0, w / 2, h / 2, r1);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
  t.refresh();
}

export class Fx {
  private readonly parts: Part[] = [];
  private next = 0;
  private readonly pops: { text: Phaser.GameObjects.Text; t0: number; x: number; y: number }[] = [];
  private popNext = 0;
  private readonly shield: Img | null;
  private readonly glow: Img;
  private readonly vignette: Img;
  private readonly beatLine: Phaser.GameObjects.Rectangle;
  private lastTrail = -1e9;
  private lastLine = -1e9;
  private lastZap = -1e9;
  private odSince = -1e9;

  constructor(private readonly scene: Phaser.Scene) {
    gradient(scene, 'fx_glow', 128, 128, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)', 0, 64);
    gradient(scene, 'fx_vignette', 256, 144, 'rgba(255,255,255,0)', 'rgba(255,255,255,1)', 0.32, Math.hypot(256, 144) / 2);
    this.glow = scene.add.image(0, 0, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a1c).setDepth(18).setVisible(false);
    const sh = findArt(scene, 'shield');
    this.shield = sh && scene.add.image(0, 0, sh.key, sh.frames[0]).setScale(ART_SCALE).setTint(0xbfe8ff).setDepth(21).setVisible(false);
    this.beatLine = scene.add.rectangle(0, 0, 10, 8, 0xfff0b0).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    this.vignette = scene.add.image(0, 0, 'fx_vignette').setOrigin(0, 0).setTint(0xff6a10).setDepth(30).setVisible(false);
    for (let i = 0; i < MAX; i++) {
      const img = scene.add.image(0, 0, PROPS).setVisible(false);
      this.parts.push({ img, key: PROPS, frames: [], loop: 0, t0: 0, life: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, spin: 0, rot: 0, scale: 1, fade: false, alpha: 1 });
    }
    for (let i = 0; i < 5; i++) {
      const text = scene.add.text(0, 0, '+1', { fontFamily: '"Jersey 15", system-ui, sans-serif', fontSize: '56px', color: '#ffe27a', stroke: '#2a1a08', strokeThickness: 8 })
        .setOrigin(0.5).setDepth(31).setVisible(false);
      this.pops.push({ text, t0: -1e9, x: 0, y: 0 });
    }
  }

  private get reduce(): boolean {
    return getSettings().reduceFx;
  }

  /** Spawns `base` (its `_0..n` animation or the single frame) at world (x, y) at fx beat `t`. */
  spawn(base: string, t: number, x: number, y: number, life: number, o: Opts = {}): void {
    const art = o.key ? { key: o.key, frames: [base] } : findArt(this.scene, base);
    if (!art || (o.key && !this.scene.textures.get(o.key).has(base))) return;
    const p = this.parts[this.next];
    this.next = (this.next + 1) % MAX;
    Object.assign(p, {
      key: art.key, frames: art.frames, loop: o.loop ?? 0, t0: t, life, x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0,
      spin: o.spin ?? 0, rot: o.rot ?? 0, scale: ART_SCALE * (o.scale ?? 1), fade: o.fade ?? true, alpha: o.alpha ?? 1,
    });
    p.img.setTexture(art.key, art.frames[0]).setTint(o.tint ?? 0xffffff).setDepth(o.depth ?? 25)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setVisible(true);
  }

  clear(): void {
    for (const p of this.parts) (p.life = 0), p.img.setVisible(false);
    for (const q of this.pops) (q.t0 = -1e9), q.text.setVisible(false);
    this.lastTrail = this.lastLine = this.lastZap = this.odSince = -1e9;
  }

  land(t: number, x: number, y: number): void {
    this.spawn('dust', t, x, y - 18, 0.4, { tint: 0xe9dcc4 });
  }

  pickup(t: number, kind: ItemKind, x: number, y: number): void {
    this.spawn('sparkle', t, x, y, 0.45, { tint: PICK_TINT[kind], scale: kind === 'coin' ? 1 : 1.6 });
    if (kind !== 'coin') return;
    const q = this.pops[this.popNext];
    this.popNext = (this.popNext + 1) % this.pops.length;
    Object.assign(q, { t0: t, x, y: y - 40 });
    q.text.setVisible(true);
  }

  smash(t: number, rat: boolean, x: number, y: number): void {
    this.spawn('smash', t, x, y, 0.45, { tint: 0xffd27a, scale: 1.2 });
    if (rat) this.spawn('rat_punted', t, x, y, 1.2, { key: BOSSES, vx: rnd(500, 800), vy: -rnd(900, 1200), g: 2600, spin: rnd(8, 14), fade: false });
  }

  shieldBreak(t: number, x: number, y: number): void {
    this.spawn('shield_break', t, x, y, 0.4, { tint: 0xbfe8ff });
  }

  ignite(t: number, x: number, y: number): void {
    this.spawn('smash', t, x, y, 0.5, { tint: 0xff8a2a, scale: 2.2, add: true });
    if (!this.reduce) this.scene.cameras.main.flash(160, 255, 150, 60);
  }

  crash(t: number, x: number, y: number): void {
    this.spawn('smash', t, x, y, 0.5, { tint: 0xffffff, scale: 1.8 });
    if (this.reduce) return;
    this.scene.cameras.main.shake(260, 0.008);
    this.scene.cameras.main.flash(110, 255, 255, 255);
  }

  /** A boss gets bowled over. */
  hit(t: number, x: number, y: number): void {
    this.spawn('smash', t, x, y, 0.5, { tint: 0xfff2c0, scale: 2 });
    if (!this.reduce) this.scene.cameras.main.shake(180, 0.006);
  }

  confetti(t: number, left: number, top: number, w: number): void {
    for (let i = 0; i < 60; i++) {
      this.spawn(`confetti_${i % 6}`, t + rnd(0, 0.6), left + rnd(0.05, 0.95) * w, top - rnd(0, 200), 5, {
        vy: rnd(250, 450), vx: rnd(-120, 120), spin: rnd(-10, 10), rot: rnd(0, 6), fade: false, depth: 29,
      });
    }
  }

  /** Per frame. `t` = fx beat; (x, y) = Rafa's feet (world px); `cy` = her visual centre. */
  update(t: number, x: number, y: number, cy: number, st: { od: boolean; pre: boolean; shield: boolean; alive: boolean }, view: { left: number; top: number; w: number; h: number }): void {
    const { left, top, w, h } = view;
    const fb = t - Math.floor(t);
    // On-the-beat pulse: a glow along the floor line, strongest on the bar.
    this.beatLine.setPosition(left, 0).setSize(w, 8).setAlpha((Math.floor(t) % 4 ? 0.22 : 0.4) * (1 - fb) ** 3);

    // Gelol: fire trail and embers behind her, speed lines, warm glow and vignette.
    if (st.od && st.alive) {
      if (this.odSince < -1e8) this.odSince = t;
      const k = Math.min(1, (t - this.odSince) / 0.5);
      this.glow.setVisible(true).setPosition(x, cy).setScale(3.2 + 0.4 * (1 - fb)).setAlpha(0.35 * k);
      this.vignette.setVisible(true).setPosition(left, top).setDisplaySize(w, h).setAlpha(0.32 * k);
      for (; this.lastTrail + 1 / 12 <= t; this.lastTrail = Math.max(this.lastTrail + 1 / 12, t - 0.5)) {
        this.spawn('fire', t, x - rnd(10, 40), y - rnd(20, 150), 0.5, { vy: -rnd(80, 200), vx: -rnd(0, 60), loop: 8, scale: rnd(0.9, 1.4), depth: 18 });
        if (Math.random() < 0.5) this.spawn('ember', t, x - rnd(0, 30), y - rnd(30, 180), 0.8, { vy: -rnd(150, 350), vx: -rnd(50, 200), depth: 18 });
      }
      for (; this.lastLine + 1 / 10 <= t; this.lastLine = Math.max(this.lastLine + 1 / 10, t - 0.5)) {
        this.spawn('speedline', t, left + w * rnd(0.6, 1.1), top + h * rnd(0.15, 0.85), 0.35, { vx: -2400, scale: rnd(1.5, 3), alpha: 0.45, tint: 0xffe0b0, depth: 2 });
      }
    } else {
      this.odSince = -1e9;
      this.glow.setVisible(false);
      this.vignette.setVisible(false);
      this.lastTrail = this.lastLine = t;
    }
    // Pré-treino: jittery sparks around her.
    if (st.pre && st.alive) {
      for (; this.lastZap + 1 / 6 <= t; this.lastZap = Math.max(this.lastZap + 1 / 6, t - 0.5)) {
        this.spawn('zap', t, x + rnd(-0.6, 0.6) * B, cy + rnd(-1.1, 0.9) * B, 0.25, { rot: rnd(-0.6, 0.6), depth: 22 });
      }
    } else this.lastZap = t;
    // Whey: a bubble around her that breathes on the beat.
    this.shield?.setVisible(st.shield && st.alive).setPosition(x, cy).setAlpha(0.5 + 0.2 * (1 - fb)).setScale(ART_SCALE * (1 + 0.03 * (1 - fb)));

    for (const p of this.parts) {
      if (!p.img.visible) continue;
      const a = t - p.t0;
      if (a >= p.life) {
        p.img.setVisible(false);
        continue;
      }
      if (a < 0) {
        p.img.setAlpha(0);
        continue;
      }
      const u = a / p.life;
      const f = p.loop ? Math.floor(a * p.loop) % p.frames.length : Math.min(p.frames.length - 1, Math.floor(u * p.frames.length));
      if (p.frames.length > 1) p.img.setFrame(p.frames[f]);
      p.img.setPosition(p.x + p.vx * a, p.y + p.vy * a + 0.5 * p.g * a * a).setRotation(p.rot + p.spin * a).setScale(p.scale)
        .setAlpha(p.alpha * (p.fade ? 1 - u * u : 1));
    }
    for (const q of this.pops) {
      if (!q.text.visible) continue;
      const a = t - q.t0;
      if (a > 0.6 || a < 0) q.text.setVisible(false);
      else q.text.setPosition(q.x, q.y - 120 * a).setAlpha(1 - (a / 0.6) ** 2);
    }
  }
}
