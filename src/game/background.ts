// Background from public/art/bg/manifest.json (see its `_doc`): parallax layers, beat overlays, ground tiles
// (+ beat-toggled ground overlays) and set-piece sprites, all art px drawn ×scale with nearest filtering. Built from repeated Images, not
// TileSprites: Phaser's TileSprite resamples the tile into a power-of-two canvas, which smears pixel art.
// Everything is a function of (camera, beat), so pause, restart and Gelol tempo need nothing extra.
import Phaser from 'phaser';
import type { Theme } from '../types';

interface Pic { file: string; width: number; height: number }
interface Layer extends Pic { name: string; y: number; parallax: number; tileX: boolean; frames?: string[]; beat?: string }
interface Overlay { name: string; layer: string; at: [number, number][]; width: number; height: number; frames: Record<string, string>; beat?: string }
interface Sprite extends Pic {
  name: string; pivot: { x: number; y: number }; blend?: string; beat?: string; frames?: string[];
  mount?: { layer: string; points: [number, number][] }; once?: boolean; // once: placed with its pivot on the ground at the level end
}
interface GroundOverlay extends Pic { name: string; beat?: string }
interface ThemeDef {
  skyColor: string; layers: Layer[]; overlays?: Overlay[]; sprites?: Sprite[];
  ground: { top: Pic; fill: Pic; overlays?: GroundOverlay[] };
}
export interface BgManifest { scale: number; view: { groundY: number; block: number }; themes: Partial<Record<Theme, ThemeDef>> }

export const BG_MANIFEST = 'bgManifest';

/** Every image file a theme uses, as [texture key, url] (the key is the file path). */
export function themeFiles(m: BgManifest, theme: Theme): string[] {
  const t = m.themes[theme];
  if (!t) return [];
  const files = new Set<string>();
  for (const l of t.layers) for (const f of l.frames ?? [l.file]) files.add(f);
  for (const o of t.overlays ?? []) for (const f of Object.values(o.frames)) files.add(f);
  for (const s of t.sprites ?? []) for (const f of s.frames ?? [s.file]) files.add(f);
  for (const p of [t.ground.top, t.ground.fill, ...(t.ground.overlays ?? [])]) files.add(p.file);
  return [...files];
}

const frac = (v: number) => v - Math.floor(v);
const mod = (v: number, m: number) => ((v % m) + m) % m;

/** Frame index (−1 = hidden) of a beat-driven overlay/layer/sprite from its `beat` note, and a swing angle.
 *  shortcut: the manifest describes beat behaviour in prose; these patterns cover the gym/church/party wording
 *  (unmatched text: first frame for the first half of each beat). Upgrade to a structured field if themes multiply. */
function beatRule(text = '', n: number): (beat: number, od: boolean, i: number) => number {
  const parity = /draw on (even|odd) beats/.exec(text);
  if (parity) {
    const want = parity[1] === 'odd' ? 1 : 0;
    return (b) => (mod(Math.floor(b), 2) === want ? 0 : -1);
  }
  if (/half beat/.test(text)) return (b) => mod(Math.floor(b * 2), n);
  if (/cycle/.test(text)) return (b) => Math.floor(frac(b) * n) % n;
  const duty = Number(/([\d.]+) beat/.exec(text)?.[1] ?? 0.5);
  const on = Math.min(n - 1, Number(/frame (\d)/.exec(text)?.[1] ?? 0)), off = n > 1 ? (on ? 0 : 1) : -1;
  const alt = /Gelol alternate/i.test(text);
  return (b, od, i) => (alt && od && mod(Math.floor(b) + i, 2) ? off : frac(b) < duty ? on : off);
}

type Rule = (beat: number, od: boolean, i: number) => number;

export class Background {
  private readonly S: number;
  private readonly gy: number; // ground line, art px from the view top
  private readonly t: ThemeDef;
  private readonly pools = new Map<unknown, Phaser.GameObjects.Image[]>();
  private readonly used = new Map<unknown, number>();
  private readonly rules = new Map<unknown, Rule>(); // per layer/overlay/sprite, parsed once
  private readonly swing = new Map<Sprite, number>(); // radians
  private readonly layerX = new Map<string, number>(); // this frame: first-repeat screen x (art px) per layer
  private depth = -100; // depth for images created now: the background sits behind everything at depth ≥ 0
  // this frame
  private left = 0;
  private right = 0;
  private zoom = 1;
  private beat = 0;
  private od = false;

  /** `endX` = world px of the level end. Parallax is anchored there, so the finish frame matches the artist's mocks. */
  constructor(private readonly scene: Phaser.Scene, m: BgManifest, theme: Theme, private readonly endX: number, private readonly ground: [number, number][]) {
    this.S = m.scale;
    this.gy = m.view.groundY;
    this.t = m.themes[theme]!;
    for (const f of themeFiles(m, theme)) if (scene.textures.exists(f)) scene.textures.get(f).setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.cameras.main.setBackgroundColor(this.t.skyColor); // the sky above the art when the view is taller than 360
    for (const l of this.t.layers) this.rules.set(l, beatRule(l.beat, l.frames?.length ?? 1));
    for (const o of this.t.overlays ?? []) this.rules.set(o, beatRule(o.beat, Object.keys(o.frames).length));
    for (const o of this.t.ground.overlays ?? []) this.rules.set(o, beatRule(o.beat, 1));
    for (const sp of this.t.sprites ?? []) {
      this.rules.set(sp, beatRule(sp.beat, sp.frames?.length ?? 1));
      this.swing.set(sp, Number(/swing ±(\d+)/.exec(sp.beat ?? '')?.[1] ?? 0) * (Math.PI / 180));
    }
  }

  private img(pool: unknown, key: string): Phaser.GameObjects.Image | null {
    if (!this.scene.textures.exists(key)) return null;
    let a = this.pools.get(pool);
    if (!a) this.pools.set(pool, (a = []));
    const n = this.used.get(pool) ?? 0;
    this.used.set(pool, n + 1);
    let o = a[n];
    if (!o) {
      o = this.scene.add.image(0, 0, key).setOrigin(0, 0).setScale(this.S).setDepth(this.depth);
      a.push(o);
    } else if (o.texture.key !== key) o.setTexture(key);
    return o.setVisible(true);
  }

  private snap(x: number): number {
    return Math.round(x * this.zoom) / this.zoom;
  }

  /** Call once per frame. left/w/bottom = visible world x range and bottom edge; `zoom` rounds to backbuffer pixels. */
  draw(left: number, w: number, bottom: number, zoom: number, beat: number, od: boolean): void {
    const S = this.S, t = this.t, gy = this.gy;
    Object.assign(this, { left, right: left + w, zoom, beat, od });
    const camArt = (left - (this.endX - 0.28 * w)) / S; // 0 at the finish frame
    const wArt = w / S;
    const sprites = t.sprites ?? [];
    this.used.clear();
    this.depth = -100;

    for (const l of t.layers) {
      const x0 = l.tileX ? -mod(camArt * l.parallax, l.width) : 0;
      this.layerX.set(l.name, x0);
      const f = Math.max(0, this.rules.get(l)!(beat, od, 0));
      this.depth++;
      for (let x = x0; x < wArt; x += l.width) {
        this.img(l, l.frames?.[f] ?? l.file)?.setPosition(this.snap(left + x * S), (l.y - gy) * S);
        if (!l.tileX) break;
      }
      for (const o of t.overlays ?? []) {
        if (o.layer !== l.name) continue;
        const keys = Object.values(o.frames), rule = this.rules.get(o)!;
        for (let x = x0; x < wArt; x += l.width) {
          for (let i = 0; i < o.at.length; i++) {
            const [ax, ay] = o.at[i], k = rule(beat, od, i);
            if (k < 0 || x + ax > wArt || x + ax + o.width < 0) continue;
            this.img(o, keys[k])?.setPosition(this.snap(left + (x + ax) * S), (l.y + ay - gy) * S);
          }
          if (!l.tileX) break;
        }
      }
      // Normal-blend mounted sprites go right after their layer; additive ones and `once` set pieces after the ground.
      for (const sp of sprites) if (sp.mount?.layer === l.name && sp.blend !== 'add') this.sprite(sp, wArt);
    }

    // Ground: top + fill (+ beat overlays) tiled by world x over each solid span.
    this.depth++;
    for (const [a, b] of this.ground) {
      if (b < left || a > this.right) continue;
      this.tile('top', t.ground.top, 0, a, b);
      for (let y = t.ground.top.height * S; y < bottom; y += t.ground.fill.height * S) this.tile('fill', t.ground.fill, y, a, b);
      for (const o of t.ground.overlays ?? []) if (this.rules.get(o)!(beat, od, 0) >= 0) this.tile(o, o, 0, a, b);
    }
    for (const sp of sprites) if (sp.once || sp.blend === 'add') this.sprite(sp, wArt);

    for (const [pool, a] of this.pools) for (let i = this.used.get(pool) ?? 0; i < a.length; i++) a[i].setVisible(false);
  }

  /** Repeats of p tiled by world x (u = x mod width), cropped to [a, b) and the view. */
  private tile(pool: unknown, p: Pic, y: number, a: number, b: number): void {
    const pw = p.width * this.S;
    for (let x = Math.floor(Math.max(a, this.left - pw) / pw) * pw; x < Math.min(b, this.right); x += pw) {
      const o = this.img(pool, p.file);
      if (!o) return;
      const c0 = Math.max(0, a - x) / this.S, c1 = Math.min(p.width, (b - x) / this.S);
      o.setPosition(x, y).setCrop(c0, 0, c1 - c0, p.height);
    }
  }

  private sprite(sp: Sprite, wArt: number): void {
    const S = this.S;
    this.depth++;
    if (sp.once) { // placed with its pivot on the ground at the level end
      if (this.endX + sp.width * S > this.left && this.endX - sp.width * S < this.right) this.put(sp, this.endX, 0, 0);
      return;
    }
    const l = sp.mount && this.t.layers.find((q) => q.name === sp.mount!.layer);
    if (!l) return;
    for (let x = this.layerX.get(l.name)!; x < wArt + sp.width; x += l.width) {
      for (let i = 0; i < sp.mount!.points.length; i++) {
        const [mx, my] = sp.mount!.points[i];
        this.put(sp, this.left + (x + mx) * S, (l.y + my - this.gy) * S, i);
      }
      if (!l.tileX) break;
    }
  }

  private put(sp: Sprite, wx: number, wy: number, i: number): void {
    const keys = sp.frames ?? [sp.file];
    const o = this.img(sp, keys[Math.max(0, this.rules.get(sp)!(this.beat, this.od, i))]);
    if (!o) return;
    o.setOrigin(sp.pivot.x / sp.width, sp.pivot.y / sp.height).setPosition(this.snap(wx), wy);
    o.setBlendMode(sp.blend === 'add' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    // Spot cones swing with the beat; neighbours (and the next colour) swing opposite.
    const si = this.t.sprites!.indexOf(sp);
    o.setRotation(this.swing.get(sp)! * Math.sin(Math.PI * this.beat) * ((si + i) % 2 ? -1 : 1));
  }
}
