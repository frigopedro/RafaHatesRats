// Song notation and the per-step player. A song is pattern data keyed by section name; each track loops on its own
// length while the level is in that section, so levels can reorder or resize sections without touching the song.
import type { LevelDef, Section } from '../types';
import * as sfx from './sfx';
import {
  bass, bell, blip, chord, clap, cuica, hat, horn, kick, lead, pluck, riser, snare, tom, whistle,
  type BassKind, type LeadKind, type Out,
} from './voices';

export const STEPS = 4; // sequencer steps per beat (16ths)
const BAR = 4 * STEPS;

const DRUMS = ['kick', 'snare', 'clap', 'hat', 'open', 'tom', 'cuica', 'whistle'] as const;
const NOTES = ['bass', 'lead', 'arp', 'count', 'horn', 'bell'] as const;
type Drum = (typeof DRUMS)[number];
type NoteTrack = (typeof NOTES)[number];

export interface Sound {
  kick?: 'punch' | '808';
  bass?: BassKind;
  lead?: LeadKind;
}

/** Authored part.
 *  Drum tracks: one char per 16th: 'X' accent, 'x' hit, 'o' ghost, '.' rest (spaces and '|' ignored). On `tom`
 *  the char also picks the drum (X high, x mid, o low); on `cuica` x = whoop up, o = down; on `whistle` X = trill.
 *  Note tracks (bass lead arp count horn bell): tokens "a4" or "a4:3" (length in 16ths, default 2), "." / ".:8" rests, "~a4" glides in.
 *  `chords`: "Am" or "F:2" (length in beats, default 4); qualities m 7 m7 maj7 5 sus4 dim.
 *  Every track (and the chords) loops on its own length, which must be whole bars. */
export interface PartDef extends Partial<Record<Drum | NoteTrack, string>> {
  chords?: string;
  pad?: number; // pad level from the chords (0 = none)
  riser?: number; // beats of noise sweep ending exactly at the section end
  end?: PartDef; // tracks that replace this part's own in the section's last bar (fills, rolls)
  key?: number; // semitones, melodic tracks and chords
  sound?: Sound;
}

export interface SongDef {
  id: string;
  title: string;
  bpm: number;
  tonic: number; // MIDI note the win jingle is built on
  sound: Required<Sound>;
  parts: Record<string, PartDef>;
  /** Suggested level layout (what audio.html and the checks play); real levels may differ. */
  layout: Section[];
  lengthBeats: number;
}

interface Note {
  m: number;
  len: number; // steps
  from?: number; // glide start (previous note)
}
interface Part {
  drums: Partial<Record<Drum, Float32Array>>;
  notes: Partial<Record<NoteTrack, (Note | null)[]>>;
  chordStart: (number[] | null)[]; // per step: chord that starts here
  chordLen: number[]; // its length in steps
  chordAt: number[][]; // per step: chord sounding
  pad: number;
  riser: number;
  end: Part | null;
  key: number;
  sound: Required<Sound>;
}
export interface Song {
  def: SongDef;
  parts: Record<string, Part>;
}

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '5': [0, 7, 12],
  sus4: [0, 5, 7], dim: [0, 3, 6],
};
const VEL: Record<string, number> = { X: 1, x: 0.8, o: 0.45 };

function wholeBars(n: number, what: string) {
  if (n === 0 || n % BAR) throw new Error(`${what}: ${n} steps is not a whole number of bars`);
}

function parseDrums(s: string, what: string): Float32Array {
  const chars = s.replace(/[\s|]/g, '');
  wholeBars(chars.length, what);
  return Float32Array.from(chars, (c) => {
    if (c === '.') return 0;
    if (!(c in VEL)) throw new Error(`${what}: bad hit '${c}'`);
    return VEL[c];
  });
}

function parseNotes(s: string, what: string): (Note | null)[] {
  const out: (Note | null)[] = [];
  const notes: Note[] = [];
  for (const tok of s.split(/[\s|]+/).filter(Boolean)) {
    const m = /^(~)?(?:([a-g])(#|b)?(\d)|(\.))(?::(\d+))?$/.exec(tok);
    if (!m) throw new Error(`${what}: bad token '${tok}'`);
    const len = m[6] ? Number(m[6]) : 2;
    if (m[2]) {
      const n: Note = { m: 12 * (Number(m[4]) + 1) + PC[m[2]] + (m[3] === '#' ? 1 : m[3] === 'b' ? -1 : 0), len };
      if (m[1]) n.from = -1; // resolved below, cyclically
      notes.push(n);
      out.push(n);
    } else out.push(null);
    for (let k = 1; k < len; k++) out.push(null);
  }
  wholeBars(out.length, what);
  notes.forEach((n, i) => n.from === -1 && (n.from = notes[(i + notes.length - 1) % notes.length].m));
  return out;
}

function compilePart(p: PartDef, base: Required<Sound>, what: string, parent?: Part): Part {
  const part: Part = {
    drums: {}, notes: {}, chordStart: parent?.chordStart ?? [], chordLen: parent?.chordLen ?? [],
    chordAt: parent?.chordAt ?? [], pad: p.pad ?? parent?.pad ?? 0, riser: p.riser ?? parent?.riser ?? 0, end: null,
    key: p.key ?? parent?.key ?? 0, sound: { ...base, ...parent?.sound, ...p.sound },
  };
  for (const d of DRUMS) if (p[d] !== undefined) part.drums[d] = parseDrums(p[d]!, `${what}.${d}`);
  for (const n of NOTES) if (p[n] !== undefined) part.notes[n] = parseNotes(p[n]!, `${what}.${n}`);
  if (p.chords) {
    part.chordStart = [];
    part.chordLen = [];
    part.chordAt = [];
    for (const tok of p.chords.split(/\s+/).filter(Boolean)) {
      const m = /^([A-G])(#|b)?(m7|maj7|m|7|5|sus4|dim)?(?::(\d+))?$/.exec(tok);
      if (!m) throw new Error(`${what}.chords: bad chord '${tok}'`);
      const root = 57 + ((PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 3 + 12) % 12); // A3..G#4
      const ms = QUALITY[m[3] ?? ''].map((i) => root + i);
      const len = (m[4] ? Number(m[4]) : 4) * STEPS;
      part.chordStart.push(ms);
      part.chordLen.push(len);
      for (let k = 0; k < len; k++) {
        if (k) part.chordStart.push(null), part.chordLen.push(0);
        part.chordAt.push(ms);
      }
    }
    wholeBars(part.chordAt.length, `${what}.chords`);
  }
  if (p.end) part.end = compilePart(p.end, base, `${what}.end`, part);
  return part;
}

export function compileSong(def: SongDef): Song {
  const parts: Record<string, Part> = {};
  for (const [name, p] of Object.entries(def.parts)) parts[name] = compilePart(p, def.sound, `${def.id}.${name}`);
  if (!parts.main) throw new Error(`${def.id}: needs a 'main' part (the fallback for unknown sections)`);
  return { def, parts };
}

// Authoring helpers for the song files.
export const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
/** Every note in `s` moved `k` octaves. */
export const oct = (s: string, k = 1) => s.replace(/([a-g](?:#|b)?)(\d)/g, (_, n, d) => n + (Number(d) + k));
/** One bar per root: `f(root)` for each note in `roots`. */
export const each = (roots: string, f: (r: string) => string) => roots.split(/\s+/).filter(Boolean).map(f).join(' | ');

const lowerBound = (a: number[], x: number) => {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};
const warned = new Set<string>();

/** Plays one song over one level's section layout, step by step. Stateless per step, so any step order works. */
export class SongPlayer {
  private readonly sections: Section[];
  private readonly lengthSteps: number;
  private readonly attacks: number[]; // bossAttack cue beats: the telegraph tick lands exactly on them
  // locate() result, reused (no per-step allocation)
  private part!: Part;
  private ls = 0; // step within the section
  private lb = -1; // step within the section's last bar, or -1
  private secEnd = 0; // beat

  /** `only`: play just this track (offline onset checks). */
  constructor(readonly song: Song, level: Pick<LevelDef, 'sections' | 'lengthBeats' | 'chart'>, private readonly only?: string) {
    this.sections = [...level.sections].sort((a, b) => a.beat - b.beat);
    this.lengthSteps = Math.round(level.lengthBeats * STEPS);
    this.attacks = level.chart.flatMap((e) => (e.t === 'cue' && e.cue === 'bossAttack' ? [e.beat] : [])).sort((a, b) => a - b);
  }

  private locate(step: number): void {
    const beat = step / STEPS, S = this.sections;
    let i = 0;
    while (i + 1 < S.length && S[i + 1].beat <= beat) i++;
    const name = S[i]?.name ?? 'main';
    let part = this.song.parts[name];
    if (!part) {
      part = this.song.parts.main;
      if (!warned.has(name)) warned.add(name), console.warn(`audio: song '${this.song.def.id}' has no part '${name}'; playing 'main'`);
    }
    this.part = part;
    const start = Math.round((S[i]?.beat ?? 0) * STEPS);
    this.secEnd = i + 1 < S.length ? S[i + 1].beat : this.lengthSteps / STEPS;
    const secSteps = Math.round(this.secEnd * STEPS) - start;
    this.ls = step - start;
    this.lb = this.ls >= secSteps - BAR ? this.ls - Math.max(0, secSteps - BAR) : -1;
  }

  /** Every sound of sequencer step `step` (absolute: beat × STEPS); `at` maps a beat to context time. */
  play(o: Out, step: number, at: (beat: number) => number): void {
    const beat = step / STEPS;
    if (step >= this.lengthSteps) {
      if (step === this.lengthSteps && !this.only) sfx.win(o, at(beat), this.song.def.tonic);
      return;
    }
    this.locate(step);
    const p = this.part, ls = this.ls, lb = this.lb, e = lb >= 0 ? p.end : null, s = p.sound;
    const t = at(beat);
    for (const d of DRUMS) {
      if (this.only && d !== this.only) continue;
      const own = e?.drums[d];
      const tr = own ?? p.drums[d];
      if (!tr) continue;
      const v = tr[(own ? lb : ls) % tr.length];
      if (!v) continue;
      if (d === 'kick') kick(o, t, v, s.kick === '808');
      else if (d === 'snare') snare(o, t, v);
      else if (d === 'clap') clap(o, t, v);
      else if (d === 'hat' || d === 'open') hat(o, t, v, d === 'open');
      else if (d === 'tom') tom(o, t, 0.85, v === 1 ? 250 : v > 0.5 ? 180 : 125);
      else if (d === 'cuica') cuica(o, t, 1, v > 0.5);
      else whistle(o, t, 1, v === 1);
    }
    for (const n of NOTES) {
      if (this.only && n !== this.only) continue;
      const own = e?.notes[n];
      const tr = own ?? p.notes[n];
      const ev = tr?.[(own ? lb : ls) % tr.length];
      if (!ev) continue;
      const m = ev.m + p.key, from = ev.from === undefined ? undefined : ev.from + p.key;
      const dur = at(beat + ev.len / STEPS) - t;
      if (n === 'bass') bass(o, t, dur, m, 0.9, s.bass, from);
      else if (n === 'lead') lead(o, t, dur, m, 1, s.lead, from);
      else if (n === 'arp') pluck(o, t, dur, m, 1);
      else if (n === 'count') blip(o, t, dur, m, 1);
      else if (n === 'bell') bell(o, t, m, 1);
      else horn(o, t, dur, m, 1);
    }
    if (this.only) return;
    const ci = ls % (p.chordStart.length || 1);
    const ch = p.chordStart[ci];
    if (ch && p.pad) chord(o, t, at(beat + p.chordLen[ci] / STEPS) - t, ch.map((m) => m + p.key), p.pad);
    if (p.riser) {
      const from = Math.max(this.secEnd - p.riser, beat - ls / STEPS); // whole section if it is shorter
      if (Math.abs(beat - from) < 1e-6) riser(o, t, at(this.secEnd) - t, 1);
    }
    for (let i = lowerBound(this.attacks, beat - 1e-9); i < this.attacks.length && this.attacks[i] < beat + 1 / STEPS - 1e-9; i++) {
      sfx.tick(o, at(this.attacks[i]));
    }
  }

  /** Gelol layer for one step: `prev`/`on` = overdrive at the previous/this step. */
  overdrive(o: Out, step: number, at: (beat: number) => number, prev: boolean, on: boolean): void {
    if (step >= this.lengthSteps) return;
    this.locate(step);
    const p = this.part, beat = step / STEPS, t = at(beat);
    const ms = (p.chordAt[this.ls % (p.chordAt.length || 1)] ?? [57, 60, 64]).map((m) => m + p.key);
    if (on && !prev) chord(o, t, at(beat + 2) - t, [ms[0] - 12, ms[0] - 5, ms[0]], 0.55, 1); // the Gelol power chord
    if (!on) {
      if (prev) sfx.powerDown(o, t);
      return;
    }
    const tones = [ms[0], ms[1], ms[2], ms[0] + 12];
    pluck(o, t, at(beat + 1 / STEPS) - t, tones[step % 4] + 12 * ((step >> 2) % 2), 0.9);
    hat(o, t, step % 2 ? 0.5 : 0.8);
  }
}
