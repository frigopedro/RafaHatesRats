// Dev-only gallery (gallery.html): every animation of the sheet characters at game scale (1 block = 96 px, one game
// px = one device px), driven by a 120 BPM beat clock — `?beat=N` freezes it at beat N for screenshots — followed by
// every atlas frame with its pivot. Other lanes add their own entries to SECTIONS / ATLASES.
import Phaser from 'phaser';
import { animFrame, FABINHO, FABINHO_ATLAS, RAFAGYM_ATLAS, type SheetAnim } from './art/sheets';
import { TICKS_PER_BEAT as TPB, VIEW } from './config';
import { createRafaGym, drawRafaGym } from './game/rafaGym';
import { createRafa, drawRafa, RAFA_ATLAS, type RafaFx } from './game/rafaView';
import { compileLevel, createState, overdriveActive, step } from './sim/sim';
import type { SimState } from './types';

const BPM = 120, MS_PER_BEAT = 60000 / BPM, B = VIEW.block, W = 2800, TITLE = 44;
const DPR = Math.min(window.devicePixelRatio || 1, VIEW.maxDpr);
const frozen = new URLSearchParams(location.search).get('beat');
const t0 = performance.now();
const clockBeat = () => (frozen !== null ? Number(frozen) : (performance.now() - t0) / MS_PER_BEAT);

/** One horizontal band of the canvas. `create` returns the per-frame update, called with the clock beat. */
interface Section {
  title: string;
  height: number; // game px, title included
  preload(scene: Phaser.Scene): void;
  create(scene: Phaser.Scene, top: number, g: Phaser.GameObjects.Graphics): (beat: number) => void;
}

const label = (scene: Phaser.Scene, x: number, y: number, text: string) =>
  scene.add.text(x, y, text, { fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: '#111' });

/** Cell backdrop + ground line with beat ticks every block, scrolled by `scroll` px (the world moving past). */
function cell(g: Phaser.GameObjects.Graphics, x: number, w: number, top: number, groundY: number, bottom: number, scroll: number, k: number) {
  g.fillStyle(k % 2 ? 0x777a7e : 0x83868a, 1).fillRect(x, top, w, bottom - top);
  g.fillStyle(0x45474b, 1).fillRect(x, groundY, w, 4);
  for (let tx = x + (((-scroll % B) + B) % B); tx < x + w; tx += B) g.fillRect(tx - 1, groundY, 3, 14);
}

// --- Rafa (wheelchair): the real sim on flat ground, so jumps have the game's exact arcs ---
const FLAT = compileLevel({
  id: 'gallery', name: 'gallery', theme: 'gym', rafa: 'wheelchair', bpm: BPM, blocksPerBeat: 4, lengthBeats: 1e6,
  songId: '', marginMs: 0, sections: [], ground: [[-1e6, 1e6]], chart: [],
});
/** State at `beat` (from 0) with the button held over [down, up) beats. */
function simulate(beat: number, down = -1, up = -1): { s: SimState; fx: RafaFx } {
  const s = createState(FLAT, 0);
  const fx: RafaFx = { jumpTick: -1e9, landTick: -1e9, deadTick: -1 };
  const end = Math.floor(beat * TPB), d = Math.round(down * TPB), u = Math.round(up * TPB);
  while (s.tick < end) {
    const t = s.tick + 1;
    for (const e of step(FLAT, s, { pressed: t === d, released: t === u, held: t >= d && t < u })) {
      if (e.type === 'jump') fx.jumpTick = e.tick;
      else if (e.type === 'land') fx.landTick = e.tick;
    }
  }
  return { s, fx };
}

interface RafaPose { s: SimState; fx: RafaFx; started?: boolean; od?: boolean; deadAt?: number; stopAt?: number; knees?: boolean }
interface RafaCase {
  name: string;
  period: number; // beats; the case replays from its beat 0
  at(lb: number): RafaPose;
}
const won = (knees = false): RafaPose => { const r = simulate(0); r.s.won = true; return { ...r, knees }; };
const C = {
  idle: { name: 'idle', period: 4, at: () => ({ ...simulate(0), started: false }) },
  move: { name: 'move', period: 4, at: (lb) => simulate(lb) },
  hop: { name: 'hop (tap)', period: 2, at: (lb) => simulate(lb, 0.5, 0.5 + 1 / TPB) },
  big: { name: 'big jump (hold)', period: 2, at: (lb) => simulate(lb, 0.25, 1.5) },
  gelol: {
    name: 'Gelol (beats 0–3)', period: 4, at: (lb) => {
      const r = simulate(lb);
      r.s.overdriveFrom = 0;
      r.s.overdriveUntil = 3;
      return { ...r, od: overdriveActive(r.s, r.s.tick) };
    },
  },
  victory: { name: 'victory', period: 4, at: () => won() },
  knees: { name: 'ending (knees)', period: 4, at: () => won(true) },
  death: {
    name: 'death at beat 1', period: 4, at: (lb) => {
      const r = simulate(Math.min(lb, 1));
      if (lb >= 1) r.fx.deadTick = TPB;
      return { ...r, deadAt: 1, stopAt: 1 };
    },
  },
  scale: { name: 'with Fabinho (scale)', period: 4, at: (lb) => simulate(lb) },
} satisfies Record<string, RafaCase>;

/** A row of Rafa cells driven by the real sim. `make` builds one Rafa (plus anything else for that cell); its
 *  objects are put in a holder that scrolls back by the distance rolled, so she stays put in her cell. */
function rafaRow(title: string, preload: (scene: Phaser.Scene) => void, cases: [RafaCase, number][],
  make: (scene: Phaser.Scene, c: RafaCase) => { parts: Phaser.GameObjects.GameObject[]; draw(p: RafaPose, lb: number, dist: number, ms: number): void }): Section {
  return {
    title,
    height: TITLE + 620,
    preload,
    create(scene, top, g) {
      const groundY = top + TITLE + 540, bottom = top + this.height;
      let x0 = 0;
      const cells = cases.map(([c, w], k) => {
        const x = x0;
        x0 += w;
        label(scene, x + 10, top + TITLE + 6, c.name).setDepth(1);
        const r = make(scene, c);
        return { c, w, x, k, r, holder: scene.add.container(0, groundY, r.parts) };
      });
      return (beat) => {
        for (const { c, w, x, k, r, holder } of cells) {
          const lb = beat - Math.floor(beat / c.period) * c.period, start = beat - lb;
          const p = c.at(lb);
          const dist = (start + Math.min(lb, p.stopAt ?? lb)) * FLAT.def.blocksPerBeat * B; // world px rolled
          cell(g, x, w, top + TITLE, groundY, bottom, dist, k);
          r.draw(p, lb, dist, lb * MS_PER_BEAT);
          holder.x = x + 130 - dist; // her hitbox centre sits 130 px into the cell
        }
      };
    },
  };
}

const rafaSection = rafaRow('Rafa — wheelchair, level 3 (rafaView.ts, real sim)',
  (scene) => scene.load.atlas(RAFA_ATLAS, 'art/rafa.png', 'art/rafa.json'),
  [[C.idle, 300], [C.move, 300], [C.hop, 340], [C.big, 340], [C.gelol, 340], [C.victory, 300], [C.death, 880]],
  (scene) => {
    const r = createRafa(scene);
    return {
      parts: [r.root, r.wheel],
      draw: (p, lb, dist, ms) => drawRafa(r, p.s, p.fx, lb, dist, -p.s.y * B, !!p.od, ms, (p.deadAt ?? 0) * MS_PER_BEAT, p.started ?? true),
    };
  });

const gymSection = rafaRow('Rafa — gym, level 1 (rafaGym.ts, real sim)',
  (scene) => scene.load.atlas(RAFAGYM_ATLAS, 'art/rafagym.png', 'art/rafagym.json'),
  [[C.idle, 270], [C.move, 270], [C.hop, 300], [C.big, 300], [C.gelol, 300], [C.victory, 270], [C.knees, 270], [C.death, 480], [C.scale, 340]],
  (scene, c) => {
    const r = createRafaGym(scene);
    const fab = c === C.scale ? scene.add.image(0, 0, FABINHO_ATLAS, 'run_0') : null;
    return {
      parts: fab ? [r.body, fab] : [r.body],
      draw: (p, lb, dist, ms) => {
        drawRafaGym(r, p.s, p.fx, lb, dist, -p.s.y * B, !!p.od, ms, (p.deadAt ?? 0) * MS_PER_BEAT, p.started ?? true, p.knees);
        fab?.setFrame(animFrame(FABINHO.run, lb)).setPosition(dist + 150, 0);
      },
    };
  });

// --- Fabinho: each animation from src/art/sheets.ts; one-shot animations replay every 2 beats ---
const FAB_CASES: { name: keyof typeof FABINHO; moving?: boolean }[] = [
  { name: 'run', moving: true }, { name: 'walk', moving: true }, { name: 'leap' }, { name: 'land' }, { name: 'throw' },
  { name: 'idle' }, { name: 'taunt_pushup' }, { name: 'taunt_situp' }, { name: 'defeated' }, { name: 'sulk' },
  { name: 'idleBust' }, { name: 'throwBust' },
];
const FAB_ROW = [TITLE + 520, 380]; // row heights: the leap row has room for its arc
const fabinhoSection: Section = {
  title: 'Fabinho (src/art/sheets.ts) — leap shown on a 1-beat, 2-block arc; *Bust = HUD/cards only',
  height: TITLE + FAB_ROW[0] + FAB_ROW[1] - TITLE,
  preload: (scene) => scene.load.atlas(FABINHO_ATLAS, 'art/fabinho.png', 'art/fabinho.json'),
  create(scene, top, g) {
    const per = 6, w = W / per;
    const cells = FAB_CASES.map((c, i) => {
      const row = Math.floor(i / per), x = (i % per) * w;
      const y0 = top + TITLE + (row ? FAB_ROW[0] - TITLE : 0), h = FAB_ROW[row] - (row ? 0 : TITLE);
      label(scene, x + 10, y0 + 6, c.name).setDepth(1);
      const img = scene.add.image(x + w / 2, y0 + h - 50, FABINHO_ATLAS, FABINHO[c.name].frames[0]);
      return { c, x, y0, h, img, k: i + row };
    });
    return (beat) => {
      for (const { c, x, y0, h, img, k } of cells) {
        const anim: SheetAnim = FABINHO[c.name];
        const lb = anim.loop ? beat : beat % 2;
        const groundY = y0 + h - 50;
        cell(g, x, w, y0, groundY, y0 + h, c.moving ? beat * 4 * B : 0, k);
        const arc = c.name === 'leap' && lb < 1 ? 4 * 2 * B * lb * (1 - lb) : 0;
        img.setFrame(animFrame(anim, lb)).setY(groundY - arc);
      }
    };
  },
};

const SECTIONS: Section[] = [gymSection, fabinhoSection, rafaSection];
const ATLASES = ['rafagym', 'rafa', 'fabinho']; // static "all frames" listing below the canvas

class Gallery extends Phaser.Scene {
  private updates: ((beat: number) => void)[] = [];
  private g!: Phaser.GameObjects.Graphics;
  preload() {
    for (const s of SECTIONS) s.preload(this);
  }
  create() {
    this.g = this.add.graphics().setDepth(-1);
    let top = 0;
    for (const s of SECTIONS) {
      label(this, 12, top + 10, s.title).setFontSize(28).setDepth(1);
      this.updates.push(s.create(this, top, this.g));
      top += s.height;
    }
    document.body.dataset.ready = '1'; // scripts/shots-gallery.mjs waits for this
  }
  update() {
    const beat = clockBeat();
    this.g.clear();
    for (const u of this.updates) u(beat);
  }
}

const H = SECTIONS.reduce((t, s) => t + s.height, 0);
new Phaser.Game({
  type: Phaser.WEBGL, // preFX glow
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#7b7e82',
  banner: false,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
  audio: { noAudio: true },
  scene: Gallery,
});

// Every atlas frame at 1:1 device px: magenta ring = origin (anchor), cyan dot = spokes hub.
for (const name of ATLASES) {
  fetch(`art/${name}.json`).then((r) => r.json()).then(({ frames, meta }) => {
    const root = document.getElementById('frames')!;
    root.insertAdjacentHTML('beforeend', `<h2>${name}.png — all frames with pivots</h2>`);
    const box = document.createElement('div');
    box.className = 'frames';
    for (const [key, f] of Object.entries<any>(frames)) {
      const { x, y, w, h } = f.frame, s = 1 / DPR;
      const el = document.createElement('div');
      el.className = 'frame';
      el.style.cssText = `width:${w * s}px;height:${h * s}px;background:url(art/${name}.png) ${-x * s}px ${-y * s}px / ${meta.size.w * s}px ${meta.size.h * s}px`;
      el.innerHTML = `<span>${key}</span>`;
      const dot = (cls: string, px: number, py: number) => el.insertAdjacentHTML('beforeend', `<i class="${cls}" style="left:${px * s}px;top:${py * s}px"></i>`);
      if (f.anchor) dot('pivot', f.anchor.x * w, f.anchor.y * h);
      if (f.hub) dot('hub', f.hub.x, f.hub.y);
      box.append(el);
    }
    root.append(box);
  });
}
