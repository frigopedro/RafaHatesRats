// Level 2's cosmetic people; none of them touch the sim. Giovanni walks Rafa down the aisle a block behind her,
// Nathalia (the bride) chases her up the aisle from `bossEnter` on, Murilo (the groom) and the priest wait at the altar
// set piece. Giovanni and Nathalia replay Rafa's jumps from a height trail: Giovanni a moment late, Nathalia delayed by
// her distance behind Rafa, so she hops the same obstacles on the same spots. The sheet atlases (art/giovanni, art/nathalia, art/murilo; in-world
// frames `g_*`, all facing right, origin at the feet, drawn 1:1) may be missing: then there is no Giovanni and no
// chaser, and the generic drawn bride/groom (bosses atlas) stand at the altar.
import Phaser from 'phaser';
import { FABINHO_ATLAS } from '../art/sheets';
import { TICKS_PER_BEAT as TPB, VIEW } from '../config';
import type { LevelDef, Section, SimState, Theme } from '../types';
import type { BgManifest } from './background';
import { ART_SCALE, findArt } from './hazardViews';

const B = VIEW.block;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const loop = (frames: string[], beats: number, perBeat = frames.length) => frames[Math.floor(beats * perBeat) % frames.length];

/** Queues art/<name>.png + .json as atlas `name` only if the JSON is really there. It is fetched as text first: a
 *  missing file is a 404 in production but the dev server's index.html, which Phaser's JSON loader throws on. */
function loadOptionalAtlas(scene: Phaser.Scene, name: string): void {
  const probe = `${name}.probe`;
  scene.load.text(probe, `art/${name}.json`);
  scene.load.once(`filecomplete-text-${probe}`, (_k: string, _t: string, text: string) => {
    try {
      scene.load.atlas(name, `art/${name}.png`, JSON.parse(text));
    } catch {
      // not JSON: the atlas stays missing
    }
  });
}

/** Frames `base_0..n` of a texture, else [`base`] if it has that frame, else []. */
function seq(tex: Phaser.Textures.Texture, base: string): string[] {
  const out: string[] = [];
  while (tex.has(`${base}_${out.length}`)) out.push(`${base}_${out.length}`);
  return out.length || !tex.has(base) ? out : [base];
}

/** A sheet character's in-world frames, or null (one console.info) when the atlas or its run frames are missing. */
function sheet(scene: Phaser.Scene, atlas: string, names: { run: string; idle: string; react: string; win: string }) {
  const tex = scene.textures.exists(atlas) ? scene.textures.get(atlas) : null;
  const run = tex ? seq(tex, names.run) : [];
  if (!tex || !run.length) {
    console.info(`companion: no '${atlas}' atlas with ${names.run}_* frames yet`);
    return null;
  }
  const one = (n: string) => seq(tex, n)[0] ?? run[0];
  return { atlas, run, idle: one(names.idle), react: one(names.react), win: one(names.win) };
}

/** Rafa's height per tick, kept for the people who follow her. */
export class Trail {
  private readonly ys = new Float32Array(256); // ≥ the longest delay (bride: ~4 blocks = 120 ticks) plus a frame
  private last = -1;

  /** Call after every sim step. */
  track(s: SimState): void {
    if (s.tick <= this.last) this.ys.fill(0); // restarted
    this.last = s.tick;
    this.ys[s.tick % this.ys.length] = s.y;
  }

  /** Her height `beats` before render beat `beat`, interpolated between ticks. */
  at(beat: number, beats: number): number {
    const n = this.ys.length, t = (beat - beats) * TPB, i = Math.floor(t), f = t - i;
    const y = (k: number) => this.ys[((k % n) + n) % n];
    return y(i) * (1 - f) + y(i + 1) * f;
  }
}

// --- Giovanni ---

/** `?companion=fabinho` (dev server) borrows Fabinho's atlas to try the actor with another sheet. */
const GIOVANNI = {
  giovanni: { atlas: 'giovanni', run: 'g_run', idle: 'g_pose_idle', react: 'g_pose_phone', win: 'g_pose_armsup' },
  fabinho: { atlas: FABINHO_ATLAS, run: 'run', idle: 'turn_34', react: 'turn_front', win: 'leap_1' },
};
const BEHIND = 1.35; // blocks behind Rafa's feet while walking: his front arm clears her back crutch, his head the timer bar over hers
const BESIDE = 1.25; // at the altar, clear of her dance
const DELAY = 0.12; // beats he jumps after her: late enough to read as copying, short enough not to hang after she lands

export class Companion {
  private readonly img: Phaser.GameObjects.Image;

  private static id(def: LevelDef): keyof typeof GIOVANNI | null {
    const q = import.meta.env.DEV ? new URLSearchParams(location.search).get('companion') : null;
    return q && q in GIOVANNI ? (q as keyof typeof GIOVANNI) : def.companion ?? null;
  }

  static preload(scene: Phaser.Scene, def: LevelDef): void {
    const id = Companion.id(def);
    if (id === 'fabinho') scene.load.atlas(FABINHO_ATLAS, 'art/fabinho.png', 'art/fabinho.json');
    else if (id) loadOptionalAtlas(scene, GIOVANNI[id].atlas);
  }

  /** The level's companion, or null when it has none or its atlas isn't there (yet). */
  static create(scene: Phaser.Scene, def: LevelDef, trail: Trail): Companion | null {
    const id = Companion.id(def);
    const sh = id && sheet(scene, GIOVANNI[id].atlas, GIOVANNI[id]);
    return sh ? new Companion(scene, sh, trail) : null;
  }

  private constructor(scene: Phaser.Scene, private readonly sh: NonNullable<ReturnType<typeof sheet>>, private readonly trail: Trail) {
    this.img = scene.add.image(0, 0, sh.atlas, sh.run[0]).setDepth(19); // just behind Rafa
  }

  /** `beat` = render beat, `fxBeat` keeps running after a crash or win; `rx` = Rafa's feet x. */
  draw(s: SimState, beat: number, fxBeat: number, rx: number, started: boolean): void {
    const y = this.trail.at(beat, DELAY);
    let frame = loop(this.sh.run, beat), ahead = -BEHIND, lift = y, rot = 0, sy = 1;
    if (y > 0.02) (frame = this.sh.run[1]), (rot = -0.08), (sy = 0.94); // a run frame with a small tuck
    if (!started) frame = this.sh.idle;
    else if (s.won) { // steps up beside her: arms up
      const k = ease(clamp01((fxBeat - s.tick / TPB) / 0.5));
      ahead = lerp(-BEHIND, -BESIDE, k);
      lift = y * (1 - k);
      if (k >= 1) (frame = this.sh.win), (rot = 0), (sy = 1);
    } else if (s.dead) { // she crashes: he stops and pretends to be busy with his phone
      lift = 0;
      frame = this.sh.react;
      rot = 0;
      sy = 1;
    }
    if (this.img.frame.name !== frame) this.img.setFrame(frame);
    this.img.setPosition(Math.round(rx + ahead * B), Math.round(-lift * B)).setRotation(rot).setScale(1, sy);
  }
}

// --- Nathalia, Murilo and the priest ---

const NATHALIA = { run: 'g_run', idle: 'g_pose_idle', react: 'g_pose_laugh', win: 'g_pose_laugh' };
const MURILO = { run: 'g_run', idle: 'g_pose_idle', react: 'g_pose_think', win: 'g_pose_armsup' };
/** How far behind Rafa (blocks) the chasing bride runs in each section: she gains each dash, the Gelol finale pulls away.
 *  4:3 shows ~4.2 blocks behind Rafa (her run frame reaches ~1 block back from her feet); Giovanni's back is at ~2.55. */
const CHASE: Record<string, number> = { bossEnter: 3.5, boss1: 3.35, boss2: 3.15, boss3: 2.95, finale: 3.5 };
const ENTER = 1.5; // beats to run in from off-screen at bossEnter, and to ease between sections
const PRIEST_X = 150; // altar sprite px: in front of the altar steps
const ARRIVE = 1; // beats after the win the chasing bride takes her spot

interface Person { img: Phaser.GameObjects.Image; x: number; frames: string[] }

/** Bride, groom and priest on the altar set piece's spots (the manifest's `spots`); with Nathalia's sheet the bride
 *  chases Rafa from `bossEnter` and reaches her spot just after Rafa reaches hers, then tosses her the bouquet. */
export class Couple {
  private readonly bride: Person | null; // stand-in at the altar (no sheet)
  private readonly chaser: { img: Phaser.GameObjects.Image; x: number; sh: NonNullable<ReturnType<typeof sheet>> } | null;
  private readonly groom: { p: Person; sh: ReturnType<typeof sheet> } | null;
  private readonly priest: Person | null;
  private readonly bouquet: Phaser.GameObjects.Image | null;

  static preload(scene: Phaser.Scene): void {
    for (const n of ['nathalia', 'murilo']) loadOptionalAtlas(scene, n);
  }

  /** null when the theme has no set piece with spots. */
  static create(scene: Phaser.Scene, m: BgManifest, theme: Theme, endX: number, sections: Section[], trail: Trail, bpb: number): Couple | null {
    const sp = m.themes[theme]?.sprites?.find((q) => q.spots?.rafa)?.spots;
    if (!sp?.bride || !sp.groom) return null;
    const x0 = endX - sp.rafa.x * m.scale; // the set piece's pivot (Background puts spots.rafa on the level end)
    const at = (x: number) => x0 + x * m.scale;
    return new Couple(scene, at(sp.bride.x), at(sp.groom.x), at(PRIEST_X), sections, trail, bpb);
  }

  private constructor(scene: Phaser.Scene, brideX: number, groomX: number, priestX: number, private readonly sections: Section[], private readonly trail: Trail, private readonly bpb: number) {
    const standIn = (name: string, x: number): Person | null => {
      const art = findArt(scene, name);
      return art && { img: scene.add.image(0, 0, art.key, art.frames[0]).setScale(ART_SCALE).setDepth(18), x, frames: art.frames };
    };
    const nat = sheet(scene, 'nathalia', NATHALIA), mur = sheet(scene, 'murilo', MURILO);
    this.chaser = nat && { img: scene.add.image(0, 0, nat.atlas, nat.run[0]).setDepth(18).setVisible(false), x: brideX, sh: nat };
    this.bride = nat ? null : standIn('bride', brideX);
    const g = mur ? { img: scene.add.image(0, 0, mur.atlas, mur.idle).setDepth(18), x: groomX, frames: [mur.idle] } : standIn('groom', groomX);
    this.groom = g && { p: g, sh: mur };
    this.priest = standIn('priest', priestX);
    const bq = findArt(scene, 'bouquet');
    this.bouquet = bq && scene.add.image(0, 0, bq.key, bq.frames[0]).setScale(2).setDepth(21).setVisible(false); // ×2: in scale with the ~180 px cast
  }

  /** `beat` = render beat, `fxBeat` keeps running after a crash or win; `rx` = Rafa's feet x. */
  draw(s: SimState, beat: number, fxBeat: number, rx: number): void {
    const since = s.won ? fxBeat - s.tick / TPB : -1; // beats since the win
    for (const p of [this.bride, this.priest]) p?.img.setFrame(loop(p.frames, fxBeat, 1)).setPosition(p.x, 0);
    if (this.groom) { // nervous: thinks, stands, thinks…; arms up when she makes it
      const { p, sh } = this.groom;
      p.img.setFrame(!sh ? loop(p.frames, fxBeat, 1) : since >= 0 ? sh.win : Math.floor(fxBeat / 2) % 2 ? sh.react : sh.idle).setPosition(p.x, 0);
    }
    const c = this.chaser;
    if (c) {
      const show = this.sections.some((q) => q.name === 'bossEnter' && beat >= q.beat);
      c.img.setVisible(show);
      if (show) {
        // Distance behind Rafa: eased between the sections' CHASE values; she enters from off-screen.
        let back = 9, prev = 9;
        for (const sec of this.sections) {
          if (sec.beat > beat || !(sec.name in CHASE)) continue;
          back = lerp(prev, CHASE[sec.name], ease(clamp01((beat - sec.beat) / ENTER)));
          prev = CHASE[sec.name];
        }
        back += 0.15 * Math.sin(Math.PI * beat); // straining, gaining and losing a little on the beat
        let x = rx - back * B, lift = this.trail.at(beat, back / this.bpb), frame = loop(c.sh.run, beat);
        if (since >= 0) { // runs on to her spot, then laughs
          const k = clamp01(since / ARRIVE);
          x = lerp(x, c.x, ease(k));
          lift *= 1 - k;
          if (k >= 1) frame = c.sh.win;
        } else if (s.dead) (frame = c.sh.react), (lift = 0);
        c.img.setFrame(frame).setPosition(Math.round(x), Math.round(-lift * B));
      }
    }
    // The bouquet: tossed from the bride's hands once she is on her spot, in Rafa's hands 0.75 beat later.
    const u = (since - (c ? ARRIVE : 0) - 0.25) / 0.75;
    this.bouquet?.setVisible(u >= 0);
    if (!this.bouquet || u < 0) return;
    const k = clamp01(u), fromX = (c ?? this.bride)?.x ?? rx, toX = rx + 0.5 * B;
    const y = -0.85 * B - 2.2 * B * 4 * k * (1 - k) + (k < 1 ? 0 : 6 * Math.sin(Math.PI * 2 * fxBeat));
    this.bouquet.setPosition(fromX + (toX - fromX) * k, y).setRotation(k < 1 ? -k * Math.PI * 2 : 0);
  }
}
