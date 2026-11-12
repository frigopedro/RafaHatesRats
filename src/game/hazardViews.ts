// World objects from the code-drawn atlases (props.*, bosses.*: 1 art px = 3 world px, nearest filtering; aranha.*:
// the Aranha drawn at 4× that density, smooth filtering, for his spiderDive): hazards,
// items, platforms, landing shadows, hint signs. Placement follows each frame's pivot: bottom-pivot frames at the
// hitbox's bottom centre, centre-pivot frames at its centre. Animations are timed from the beat. Any frame missing
// from the atlases falls back to the grey-box drawing below (one console warning per name), never a crash.
import Phaser from 'phaser';
import { DROP_FALL_BEATS, DROP_SHADOW_BEATS, HAZARDS, HIGH_Y, ITEM_SIZE, VIEW } from '../config';
import { hazardPos, landBeat, platformOffset, type Pos } from '../sim/behaviors';
import type { HazardEvent, HazardKind, ItemKind, Level, SimState, Theme } from '../types';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;
const B = VIEW.block;
export const PROPS = 'props', BOSSES = 'bosses', ARANHA = 'aranha';
export const ART_SCALE = 3;
export const ARANHA_SCALE = 0.75; // public/art/aranha.json meta.scale
const PLAT: Record<Theme, string> = { gym: 'plat_gym', church: 'plat_church', party: 'plat_stage' };
/** Ceiling height (art px from the view top, manifest coords) that hanging chains run up to. */
const CEILING: Record<Theme, number> = { gym: 24, church: 16, party: 22 };
const CHAIN_FROM = 44; // bag_chain starts this many art px above the bag's pivot (its ring)
const LANTERN_FROM = 35; // same for lantern_chain and the lantern's ring

export interface Art { key: string; frames: string[]; center: boolean }

const warned = new Set<string>();
const artCache = new Map<string, Art | null>();
/** `base` (or its `base_0..n` animation) in the code-drawn atlases, or null with one warning. */
export function findArt(scene: Phaser.Scene, base: string): Art | null {
  if (artCache.has(base)) return artCache.get(base)!;
  let art: Art | null = null;
  for (const key of [PROPS, BOSSES, ARANHA]) {
    if (!scene.textures.exists(key)) continue;
    const t = scene.textures.get(key);
    const frames: string[] = [];
    while (t.has(`${base}_${frames.length}`)) frames.push(`${base}_${frames.length}`);
    if (!frames.length && t.has(base)) frames.push(base);
    if (frames.length) {
      art = { key, frames, center: t.get(frames[0]).pivotY < 0.75 };
      break;
    }
  }
  if (!art && !warned.has(base)) {
    warned.add(base);
    console.warn(`art: no frame '${base}' in the atlases, drawing a grey box`);
  }
  artCache.set(base, art);
  return art;
}
/** Atlas textures may be re-baked between page loads; forget what the last scene found. */
export const resetArtCache = () => artCache.clear();

/** Images handed out in draw order each frame; the unused rest are hidden. No allocation once warm. */
export class Pool {
  private readonly a: Img[] = [];
  private n = 0;
  constructor(private readonly scene: Phaser.Scene, private readonly depth: number) {}
  get(key: string, frame: string): Img {
    let o = this.a[this.n++];
    if (!o) this.a.push((o = this.scene.add.image(0, 0, key, frame).setDepth(this.depth)));
    else if (o.texture.key !== key || o.frame.name !== frame) o.setTexture(key, frame);
    return o.setVisible(true).setScale(key === ARANHA ? ARANHA_SCALE : ART_SCALE).setRotation(0).setAlpha(1).setFlipX(false);
  }
  begin(): void {
    this.n = 0;
  }
  end(): void {
    for (let i = this.n; i < this.a.length; i++) if (this.a[i].visible) this.a[i].setVisible(false);
  }
  get size(): number {
    return this.a.length;
  }
}

const frameAt = (art: Art, beat: number, perBeat: number) => art.frames[Math.floor(beat * perBeat) % art.frames.length];
const PER_BEAT: Partial<Record<HazardKind, number>> = { rat: 8, frisbee: 8, shockwave: 6, ropeWave: 3, dove: 8, flowerGirl: 8, ringBearer: 8, photographer: 2, candleStand: 2, sparkler: 8 };
/** Thrown down from the Aranha's hands on the train roof: drawn this many blocks above their flight line at release,
 *  settling onto it 2.5 blocks ahead of Rafa, before they can touch her (visual only; the hitbox flies level). */
const ROOF_DROP: Partial<Record<HazardKind, number>> = { webLine: 2.1, spiderDive: 3.1 };

export class WorldViews {
  private readonly g: G; // grey-box fallback
  private readonly back: Pool; // platforms, shadows, chains
  private readonly front: Pool; // hazards
  private readonly items: Pool;
  private readonly pos: Pos = { x: 0, y: 0, on: false };
  private hideFrom = 0;
  private readonly signs: { x: number; img: Img | null; text: Phaser.GameObjects.Text }[] = [];
  private readonly bpb: number;
  private readonly ceilY: number;
  private readonly plat: string;

  constructor(private readonly scene: Phaser.Scene, private readonly L: Level, theme: Theme, groundY: number) {
    for (const k of [PROPS, BOSSES]) if (scene.textures.exists(k)) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.bpb = L.def.blocksPerBeat;
    this.ceilY = (CEILING[theme] - groundY) * ART_SCALE;
    this.plat = PLAT[theme];
    this.back = new Pool(scene, 5);
    this.makeSigns();
    this.front = new Pool(scene, 10);
    this.g = scene.add.graphics().setDepth(10);
    this.items = new Pool(scene, 12);
  }

  /** Hint signs: the `sign` board standing on the floor with the cue's text chalked on it (Jersey 15 once loaded). */
  private makeSigns(): void {
    const sign = findArt(this.scene, 'sign');
    for (const c of this.L.cues) {
      if (c.cue !== 'hint') continue;
      const x = c.beat * this.bpb * B;
      const img = sign && this.scene.add.image(x, 0, sign.key, sign.frames[0]).setScale(ART_SCALE).setDepth(4);
      // Writable board: frame px (5, 5, 63 × 31) of a 72 × 54 bottom-centre-pivot frame → centre 33.5 px above the pivot.
      const text = this.scene.add.text(x + 1.5, sign ? -33.5 * ART_SCALE : -3.3 * B, c.text, {
        fontFamily: '"Jersey 15", system-ui, sans-serif', fontSize: '80px', color: sign ? '#f2eee4' : '#ffe14a',
        ...(sign ? {} : { stroke: '#1a1420', strokeThickness: 10 }),
      }).setOrigin(0.5).setDepth(4);
      this.signs.push({ x, img, text });
    }
    const fit = () => {
      for (const s of this.signs) {
        s.text.setFontFamily('"Jersey 15", system-ui, sans-serif').setFontSize(80);
        if (s.img) s.text.setFontSize(Math.min(80, Math.floor((80 * 57 * ART_SCALE) / s.text.width)));
      }
    };
    fit();
    // The UI font comes from CSS; re-measure once it's ready (or give up after 2 s and keep the fallback).
    Promise.race([document.fonts.load('80px "Jersey 15"'), new Promise((r) => setTimeout(r, 2000))]).then(() => this.scene.sys.isActive() && fit(), () => {});
  }

  /** `hideFrom`: world x beyond which `bossKinds` hazards are still in the boss's hands (not drawn). */
  draw(s: SimState, beat: number, left: number, right: number, hideFrom: number, bossKinds: ReadonlySet<HazardKind>): void {
    const L = this.L, bpb = this.bpb, g = this.g;
    const b0 = left / B / bpb - 1, b1 = right / B / bpb + 1; // visible beats, padded
    g.clear();
    this.hideFrom = hideFrom;
    this.back.begin();
    this.front.begin();
    this.items.begin();

    const pl = L.platforms.length ? findArt(this.scene, `${this.plat}_m`) : null;
    for (const p of L.platforms) {
      const x0 = (p.beat * bpb + platformOffset(p, beat, 'dx')) * B, n = Math.max(1, Math.round(p.len * bpb));
      if (x0 + n * B < left || x0 > right) continue;
      const py = -(p.y + platformOffset(p, beat, 'dy')) * B;
      if (!pl) {
        g.fillStyle(0x1a1420, 1).fillRect(x0, py - 2, n * B, 30);
        g.fillStyle(0x9aa7b0, 1).fillRect(x0 + 3, py, n * B - 6, 22);
        continue;
      }
      for (let i = 0; i < n; i++) {
        const piece = n === 1 ? 'm' : i === 0 ? 'l' : i === n - 1 ? 'r' : 'm';
        this.back.get(pl.key, `${this.plat}_${piece}`).setPosition(x0 + i * B, py);
      }
    }

    for (const sg of this.signs) {
      const on = sg.x > left - 3 * B && sg.x < right + 3 * B;
      sg.img?.setVisible(on);
      sg.text.setVisible(on);
    }

    const shadow = findArt(this.scene, 'shadow');
    for (let i = 0; i < L.hazards.length; i++) {
      const hz = L.hazards[i];
      if (hz.beat < b0 - 2 || hz.beat > b1 + 12) continue; // runners/fliers come from further ahead
      if (hz.b === 'drop' || hz.b === 'lob') {
        const k = 1 - (landBeat(hz) - beat) / DROP_SHADOW_BEATS;
        if (k > 0 && k < 1 && !s.smashed[i]) {
          if (shadow) this.back.get(shadow.key, shadow.frames[0]).setPosition(hz.beat * bpb * B, 0).setScale(ART_SCALE * (0.55 + 0.55 * k)).setAlpha(0.35 + 0.6 * k);
          else drawShadow(g, hz.beat * bpb * B, k);
        }
      }
      const p = hazardPos(hz, beat, bpb, this.pos);
      if ((!p.on && hz.b !== 'pulse') || s.smashed[i] || p.x * B < left - 2 * B || p.x * B > right + 2 * B) continue;
      if (bossKinds.has(hz.kind) && p.x * B > hideFrom) continue;
      this.drawHazard(hz, p.x * B, -p.y * B, beat);
    }

    for (let i = 0; i < L.items.length; i++) {
      const it = L.items[i];
      if (s.taken[i] || it.beat < b0 || it.beat > b1) continue;
      const x = it.beat * bpb * B, y = -(it.y + ITEM_SIZE / 2) * B + Math.sin(beat * Math.PI * 2) * 4; // bob on the beat
      const art = findArt(this.scene, it.kind);
      if (!art) drawItem(g, it.kind, x, -it.y * B, beat);
      else this.items.get(art.key, frameAt(art, beat + it.beat * 0.37, it.kind === 'coin' ? 4 : 2)).setPosition(x, y);
    }

    this.back.end();
    this.front.end();
    this.items.end();
  }

  private drawHazard(hz: HazardEvent, x: number, y: number, beat: number): void {
    const d = HAZARDS[hz.kind];
    let art = findArt(this.scene, d.art);
    let frame = art ? frameAt(art, beat, PER_BEAT[hz.kind] ?? 4) : '';
    let rot = 0;
    if (hz.kind === 'plate' && (hz.b !== 'drop' || beat >= landBeat(hz))) {
      // On the floor it lies flat (its hitbox is a flat 0.35); it falls in on edge.
      const flat = findArt(this.scene, 'plate_flat');
      if (flat) (art = flat), (frame = flat.frames[0]);
    } else if (hz.kind === 'plate' && hz.b === 'drop') rot = (landBeat(hz) - beat) * Math.PI * 1.5 / DROP_FALL_BEATS;
    else if (hz.kind === 'medBall' && art && hz.b === 'bounce') {
      // Frames turn 45° each; roll them by the distance covered so it never skids.
      const turn = (hz.speed * beat * B) / (10.5 * ART_SCALE) / (Math.PI / 4);
      frame = art.frames[Math.floor(turn) % art.frames.length];
    } else if (hz.kind === 'frisbee') rot = 0.12 * Math.sin(beat * Math.PI * 4); // a thrown plate wobbles
    else if (hz.kind === 'photographer' && beat >= hz.beat - 1.25 && beat < hz.beat - 1) frame = 'photographer_flash'; // his tell
    else if ((hz.b === 'drop' || hz.b === 'lob') && beat < landBeat(hz) && art && this.scene.textures.get(art.key).has(`${d.art}_air`)) {
      art = findArt(this.scene, `${d.art}_air`)!; // in flight; the floor frame once it lands
      frame = art.frames[0];
    } else if (hz.b === 'pulse' && !this.pos.on && art && this.scene.textures.get(art.key).has(`${d.art}_off`)) {
      art = findArt(this.scene, `${d.art}_off`)!; // between bursts
      frame = art.frames[0];
    }
    const drop = ROOF_DROP[hz.kind];
    if (drop) {
      const land = (beat * this.bpb + 2.5) * B, k = Math.min(1, Math.max(0, (x - land) / (this.hideFrom - land)));
      y -= drop * B * k * (2 - k); // falls from rest at his hands
      if (hz.kind === 'spiderDive') rot = -beat * Math.PI * 3; // tumbling at her
      if (hz.kind === 'spiderDive' && x < land - 4 * B) return; // past her he's gone: he climbs back onto the roof (bosses.ts)
    }
    if (!art) {
      drawHazard(this.g, hz, x, y, false);
      return;
    }
    const cy = art.center ? y - (d.h * B) / 2 : y;
    if (hz.kind === 'webLine' && art.frames.length) {
      const end = findArt(this.scene, 'webLine_end');
      if (end) {
        this.front.get(end.key, end.frames[0]).setPosition(x - (d.w * B) / 2, cy).setFlipX(true);
        this.front.get(end.key, end.frames[0]).setPosition(x + (d.w * B) / 2, cy);
      }
    }
    if (hz.kind === 'bag') this.chain(x, cy - CHAIN_FROM * ART_SCALE);
    if (hz.kind === 'lantern') this.chain(x, cy - LANTERN_FROM * ART_SCALE, 'lantern_chain');
    this.front.get(art.key, frame).setPosition(x, cy).setRotation(rot);
  }

  /** Tileable chain from (x, y) up to the theme's ceiling. */
  private chain(x: number, y: number, name = 'bag_chain'): void {
    const c = findArt(this.scene, name);
    if (!c) {
      this.g.fillStyle(0x1a1420, 1).fillRect(x - 3, this.ceilY, 6, y - this.ceilY);
      return;
    }
    const step = 8 * ART_SCALE;
    for (let cy = y; cy > this.ceilY; cy -= step) this.back.get(c.key, c.frames[0]).setPosition(x, cy);
  }
}

// --- Grey-box fallback (drawn at hitbox size, so what you see is what collides) ---

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
