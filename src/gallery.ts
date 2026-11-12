// Dev-only gallery (gallery.html, not part of the build): the sheet characters' in-game animations at game scale
// (1 block = 96 px, one game px = one device px), driven by a 120 BPM beat clock — `?beat=N` freezes it at beat N for
// screenshots — followed by every shipped atlas frame with its pivot (the full sheets: shots/slice-*.png).
import Phaser from 'phaser';
import { animFrame, FABINHOGYM, FABINHOGYM_ATLAS, RAFAGYM_ATLAS, RAFAMULETA_ATLAS, type SheetAnim } from './art/sheets';
import { TICKS_PER_BEAT as TPB, VIEW } from './config';
import { createFabinhoGymRun, drawFabinhoGymRun } from './game/fabinhoGym';
import { createRafaGym, drawRafaGym } from './game/rafaGym';
import { createRafaMuleta, drawRafaMuleta } from './game/rafaMuleta';
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
  scale: { name: 'with gym Fabinho (scale)', period: 4, at: (lb) => simulate(lb) },
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
  (scene) => { scene.load.atlas(RAFAGYM_ATLAS, 'art/rafagym.png', 'art/rafagym.json'); scene.load.atlas(FABINHOGYM_ATLAS, 'art/fabinhogym.png', 'art/fabinhogym.json'); },
  [[C.idle, 270], [C.move, 270], [C.hop, 300], [C.big, 300], [C.gelol, 300], [C.victory, 270], [C.knees, 270], [C.death, 480], [C.scale, 340]],
  (scene, c) => {
    const r = createRafaGym(scene);
    const fab = c === C.scale ? scene.add.image(0, 0, FABINHOGYM_ATLAS, FABINHOGYM.run.frames[0]) : null;
    return {
      parts: fab ? [r.root, fab] : [r.root],
      draw: (p, lb, dist, ms) => {
        drawRafaGym(r, p.s, p.fx, lb, dist, -p.s.y * B, !!p.od, ms, (p.deadAt ?? 0) * MS_PER_BEAT, p.started ?? true, p.knees);
        fab?.setFrame(animFrame(FABINHOGYM.run, lb)).setPosition(dist + 150, 0);
      },
    };
  });

const muletaSection = rafaRow('Rafa — muleta, level 2 (rafaMuleta.ts, real sim)',
  (scene) => { if (!scene.textures.exists(RAFAMULETA_ATLAS)) scene.load.atlas(RAFAMULETA_ATLAS, 'art/rafamuleta.png', 'art/rafamuleta.json'); },
  [[C.idle, 320], [C.move, 360], [C.hop, 380], [C.big, 380], [C.gelol, 380], [C.victory, 380], [C.death, 600]],
  (scene) => {
    const r = createRafaMuleta(scene);
    return {
      parts: [r.body],
      draw: (p, lb, dist, ms) => drawRafaMuleta(r, p.s, p.fx, lb, dist, -p.s.y * B, !!p.od, ms, (p.deadAt ?? 0) * MS_PER_BEAT, p.started ?? true),
    };
  });

// --- Gelol glow check: the three Rafas mid-overdrive on each level's backdrop (gym teal, church plaster over dark
// pews, party dark), at game scale ---
const BACKDROPS: [string, number, number][] = [['gym', 0x134a4e, 0x134a4e], ['church', 0xcdbb9c, 0x4a3a36], ['party', 0x140e22, 0x140e22]];
const glowSection: Section = {
  title: 'Gelol glow (one baked quad, additive) on gym / church / party backdrops — gym Rafa, crutch Rafa, wheelchair Rafa',
  height: TITLE + 340,
  preload: (scene) => {
    for (const a of [RAFAGYM_ATLAS, RAFAMULETA_ATLAS, RAFA_ATLAS]) if (!scene.textures.exists(a)) scene.load.atlas(a, `art/${a}.png`, `art/${a}.json`);
  },
  create(scene, top, g) {
    const w = W / 9, groundY = top + TITLE + 300;
    const cells = BACKDROPS.flatMap(([name, wall, low], bi) => [0, 1, 2].map((kind) => {
      const k = bi * 3 + kind, x = k * w;
      label(scene, x + 8, top + TITLE + 6, `${name}: ${['gym', 'muleta', 'wheelchair'][kind]}`).setDepth(1).setColor(wall === 0xcdbb9c ? '#111' : '#eee');
      const gym = kind === 0 ? createRafaGym(scene) : null, mul = kind === 1 ? createRafaMuleta(scene) : null, wc = kind === 2 ? createRafa(scene) : null;
      const parts = gym ? [gym.root] : mul ? [mul.glow, mul.body] : [wc!.root, wc!.wheel];
      return { x, wall, low, gym, mul, wc, holder: scene.add.container(0, groundY, parts) };
    }));
    return (beat) => {
      const lb = 1.25 + (beat % 1), p = C.gelol.at(lb), dist = lb * 4 * B; // inside the overdrive, past the ignition beat
      for (const { x, wall, low, gym, mul, wc, holder } of cells) {
        g.fillStyle(wall, 1).fillRect(x, top + TITLE, w, 200).fillStyle(low, 1).fillRect(x, top + TITLE + 200, w, 140);
        g.fillStyle(0x2a2430, 1).fillRect(x, groundY, w, 6);
        if (gym) drawRafaGym(gym, p.s, p.fx, lb, dist, 0, true, lb * MS_PER_BEAT, 0, true);
        if (mul) drawRafaMuleta(mul, p.s, p.fx, lb, dist, 0, true, lb * MS_PER_BEAT, 0, true);
        if (wc) drawRafa(wc, p.s, p.fx, lb, dist, 0, true, lb * MS_PER_BEAT, 0, true);
        holder.x = x + w / 2 - 10 - dist;
      }
    };
  },
};

// --- Sheet characters driven by a table from src/art/sheets.ts; one-shot animations replay every 2 beats ---
function sheetSection<K extends string>(title: string, atlas: string, table: Record<K, SheetAnim>, cases: { name: K; moving?: boolean }[]): Section {
  const ROW = [TITLE + 520, 380]; // row heights: the first row has room for a leap arc
  return {
    title,
    height: TITLE + ROW[0] + ROW[1] - TITLE,
    preload: (scene) => { if (!scene.textures.exists(atlas)) scene.load.atlas(atlas, `art/${atlas}.png`, `art/${atlas}.json`); },
    create(scene, top, g) {
      const per = 6, w = W / per;
      const cells = cases.map((c, i) => {
        const row = Math.floor(i / per), x = (i % per) * w;
        const y0 = top + TITLE + (row ? ROW[0] - TITLE : 0), h = ROW[row] - (row ? 0 : TITLE);
        label(scene, x + 10, y0 + 6, c.name).setDepth(1);
        const img = scene.add.image(x + w / 2, y0 + h - 50, atlas, table[c.name].frames[0]);
        return { c, x, y0, h, img, k: i + row };
      });
      return (beat) => {
        for (const { c, x, y0, h, img, k } of cells) {
          const anim = table[c.name];
          const lb = anim.loop ? beat : beat % 2;
          const groundY = y0 + h - 50;
          cell(g, x, w, y0, groundY, y0 + h, c.moving ? beat * 4 * B : 0, k);
          const arc = c.name === 'leap' && lb < 1 ? 4 * 2 * B * lb * (1 - lb) : 0;
          img.setFrame(animFrame(anim, lb)).setY(groundY - arc);
        }
      };
    },
  };
}
const FAB_CASES: { name: keyof typeof FABINHOGYM; moving?: boolean }[] = [
  { name: 'run', moving: true }, { name: 'leap' }, { name: 'land' }, { name: 'throw' }, { name: 'idle' },
  { name: 'taunt_laugh' }, { name: 'taunt_phone' }, { name: 'defeated' }, { name: 'sulk' },
];
const fabinhoGymSection = sheetSection('Fabinho — gym v2, level-1 boss (FABINHOGYM) — taunt_* = laugh / phone; defeated = baked lying pose',
  FABINHOGYM_ATLAS, FABINHOGYM, FAB_CASES);

// ?film=run|gelol|hop|big: gym Rafa frame by frame at 60 fps (120 BPM → 30 frames per beat), each cell on ground
// marks fixed in the world (they scroll at floor speed), so a planted foot must stay on its mark.
const FILMS: Record<string, { c: RafaCase; from: number; frames: number; title: string; who?: 'fab' | 'both' | 'muleta'; bpm?: number }> = {
  run: { c: C.move, from: 0, frames: 30, title: 'run, one beat at 60 fps (strikes at frames 0 and 15)' },
  gelol: { c: C.gelol, from: 1, frames: 30, title: 'Gelol run (beat 1–2 of overdrive, ×1.5 cadence) at 60 fps' },
  hop: { c: C.hop, from: 0.4, frames: 30, title: 'hop: take-off at frame 3, landing ≈ frame 26, at 60 fps' },
  big: { c: C.big, from: 0.15, frames: 40, title: 'big jump: take-off at frame 3, landing ≈ frame 33, at 60 fps' },
  fabrun: { c: C.move, from: 0, frames: 30, title: 'gym Fabinho run (fabinhoGym.ts), one beat at 60 fps', who: 'fab' },
  both: { c: C.move, from: 0, frames: 30, title: 'Rafa with Fabinho running beside her (as in the boss section), 60 fps', who: 'both' },
  muleta: { c: C.move, from: 0, frames: 28, title: 'crutch Rafa (rafaMuleta.ts), one beat at 60 fps and 132 BPM (plants at frames 0 and 14)', who: 'muleta', bpm: 132 },
};
function filmSection(name: string): Section {
  const f = FILMS[name], per = 10, w = W / per, h = { hop: 470, big: 560 }[name] ?? 330, rows = Math.ceil(f.frames / per);
  return {
    title: f.who ? f.title : `Rafa — gym: ${f.title}`,
    height: TITLE + rows * h,
    preload: (scene) => { for (const a of [RAFAGYM_ATLAS, FABINHOGYM_ATLAS, RAFAMULETA_ATLAS]) scene.load.atlas(a, `art/${a}.png`, `art/${a}.json`); },
    create(scene, top, g) {
      const cells = Array.from({ length: f.frames }, (_, k) => {
        const x = (k % per) * w, y0 = top + TITLE + Math.floor(k / per) * h;
        label(scene, x + 6, y0 + 4, String(k)).setDepth(1);
        const r = createRafaGym(scene);
        const fab = f.who === 'fab' || f.who === 'both' ? createFabinhoGymRun(scene) : null;
        const mul = f.who === 'muleta' ? createRafaMuleta(scene) : null;
        r.root.setVisible(!f.who || f.who === 'both');
        const parts = [r.root, ...(fab ? [fab.root] : []), ...(mul ? [mul.body] : [])];
        return { k, x, y0, r, fab, mul, holder: scene.add.container(0, y0 + h - 40, parts) };
      });
      return () => {
        for (const { k, x, y0, r, fab, mul, holder } of cells) {
          const lb = f.from + (k * (f.bpm ?? 120)) / 3600, p = f.c.at(lb), dist = lb * FLAT.def.blocksPerBeat * B, groundY = y0 + h - 40;
          g.fillStyle(k % 2 ? 0x777a7e : 0x83868a, 1).fillRect(x, y0, w, h);
          g.fillStyle(0x45474b, 1).fillRect(x, groundY, w, 3);
          for (let m = Math.ceil((dist - 140) / 24) * 24; m < dist - 140 + w; m += 24) {
            g.fillStyle(m % 96 ? 0x45474b : 0xd02020, 1).fillRect(x + m - (dist - 140) - 1, groundY, 3, m % 96 ? 8 : 16);
          }
          drawRafaGym(r, p.s, p.fx, lb, dist, -p.s.y * B, !!p.od, lb * MS_PER_BEAT, 0, true);
          if (fab) drawFabinhoGymRun(fab, lb, dist + (f.who === 'both' ? 120 : 0), 0); // beside her, one block ahead
          if (mul) drawRafaMuleta(mul, p.s, p.fx, lb, dist, -p.s.y * B, false, lb * MS_PER_BEAT, 0, true);
          holder.x = x + (f.who === 'both' ? 90 : 140) - dist;
        }
      };
    },
  };
}
const film = new URLSearchParams(location.search).get('film');
const SECTIONS: Section[] = film ? [filmSection(film)] : [glowSection, gymSection, fabinhoGymSection, muletaSection, rafaSection];
const ATLASES = film ? [] : ['rafagym', 'fabinhogym', 'rafamuleta', 'giovanni', 'nathalia', 'murilo', 'rafa']; // static "all frames" listing below the canvas

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
  type: Phaser.WEBGL, // as the game renders
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
