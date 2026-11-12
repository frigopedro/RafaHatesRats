// Sound effects: short, mostly sine/triangle chirps above the music's register so they read over it. Each takes the
// context time to play at.
import { blip, chord, filter, hit, lead, mtof, noise, osc, type Out } from './voices';

/** One oscillator with an exponential pitch sweep f0 → f1 and a percussive envelope. */
function sweep(o: Out, t: number, d: number, type: OscillatorType | 'pulse', f0: number, f1: number, v: number, dest = o.dest) {
  const n = osc(o, type, f0, t, t + d, hit(o, t, v, d, dest));
  n.frequency.exponentialRampToValueAtTime(f1, t + d * 0.8);
  return n;
}

export const hop = (o: Out, t: number) => sweep(o, t, 0.1, 'triangle', 420, 980, 0.32);

export function bigJump(o: Out, t: number) {
  sweep(o, t, 0.07, 'triangle', 300, 620, 0.3);
  sweep(o, t + 0.05, 0.14, 'triangle', 620, 1500, 0.3);
}

export function land(o: Out, t: number, heavy = false) {
  noise(o, t, t + 0.07, filter(o, 'lowpass', heavy ? 700 : 450, 0.7, hit(o, t, heavy ? 0.5 : 0.3, 0.07, o.dest)));
  sweep(o, t, heavy ? 0.1 : 0.06, 'sine', 160, 60, heavy ? 0.5 : 0.3, o.drive);
}

/** Golden dumbbell; `k` semitones up (climbs along a streak). */
export function coin(o: Out, t: number, k = 0) {
  osc(o, 'square', mtof(83 + k), t, t + 0.06, hit(o, t, 0.12, 0.06, o.dest));
  osc(o, 'square', mtof(88 + k), t + 0.055, t + 0.26, hit(o, t + 0.055, 0.12, 0.2, o.dest));
}

/** Gelol pickup whoosh (the power chord lands on the overdrive's first beat, from the sequencer). */
export function ignite(o: Out, t: number) {
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.25);
  g.gain.linearRampToValueAtTime(0, t + 0.42);
  g.connect(o.dest);
  const bp = filter(o, 'bandpass', 300, 1.8, g);
  bp.frequency.exponentialRampToValueAtTime(5000, t + 0.4);
  noise(o, t, t + 0.42, bp);
  sweep(o, t, 0.4, 'sawtooth', 90, 360, 0.15, filter(o, 'lowpass', 1800, 1, o.dest));
}

/** Gelol ending countdown, `n` = beats left (3, 2, 1): a bright pulse bip stepping up and getting louder. */
export function countdown(o: Out, t: number, n: number) {
  const m = n === 3 ? 88 : n === 2 ? 91 : 96, v = n === 1 ? 0.2 : n === 2 ? 0.16 : 0.13;
  sweep(o, t, 0.09, 'pulse', mtof(m + 0.5), mtof(m), v);
  osc(o, 'sine', mtof(m + 12), t, t + 0.05, hit(o, t, v * 0.5, 0.05, o.dest));
}

/** Pré-treino running out: a soft bubble tick (its last two beats) … */
export const preTick = (o: Out, t: number) => sweep(o, t, 0.06, 'triangle', 650, 1000, 0.18);

/** … and the fizzle when it ends: soda hiss falling away. */
export function fizzle(o: Out, t: number) {
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(1e-4, t + 0.35);
  g.connect(o.dest);
  const bp = filter(o, 'bandpass', 4500, 1.5, g);
  bp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
  noise(o, t, t + 0.35, bp);
  sweep(o, t, 0.2, 'triangle', 900, 260, 0.1);
}

export function powerDown(o: Out, t: number) {
  sweep(o, t, 0.5, 'sawtooth', 520, 70, 0.22, filter(o, 'lowpass', 1600, 2, o.dest));
}

export function whey(o: Out, t: number) {
  [84, 88, 91, 96].forEach((m, i) => osc(o, 'triangle', mtof(m), t + i * 0.045, t + i * 0.045 + 0.2, hit(o, t + i * 0.045, 0.22, 0.2, o.dest)));
}

/** Pré-treino: a jittery caffeine trill. */
export function pre(o: Out, t: number) {
  for (let i = 0; i < 8; i++) osc(o, 'square', i % 2 ? 1500 : 1150, t + i * 0.032, t + i * 0.032 + 0.03, hit(o, t + i * 0.032, 0.09, 0.03, o.dest));
}

export function shieldBreak(o: Out, t: number) {
  noise(o, t, t + 0.15, filter(o, 'highpass', 4000, 0.7, hit(o, t, 0.4, 0.15, o.dest)));
  for (const f of [2610, 3720, 5130]) osc(o, 'sine', f, t, t + 0.35, hit(o, t, 0.1, 0.35, o.dest));
}

export function smash(o: Out, t: number) {
  noise(o, t, t + 0.14, filter(o, 'bandpass', 750, 0.8, hit(o, t, 0.7, 0.14, o.dest)));
  sweep(o, t, 0.12, 'sine', 200, 50, 0.5, o.drive);
}

export function squeak(o: Out, t: number) {
  const n = osc(o, 'sine', 2100, t, t + 0.13, hit(o, t, 0.2, 0.13, o.dest));
  n.frequency.linearRampToValueAtTime(3100, t + 0.04);
  n.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
}

/** Death: a comic falling wobble and a soft bump. Plays hundreds of times, so nothing harsh. */
export function crash(o: Out, t: number) {
  const n = sweep(o, t, 0.45, 'triangle', 700, 160, 0.4, filter(o, 'lowpass', 2500, 0.7, o.dest));
  const wob = o.ctx.createGain();
  wob.gain.value = 60;
  wob.connect(n.frequency);
  osc(o, 'sine', 9, t, t + 0.45, wob);
  land(o, t + 0.05, true);
}

/** Boss attack telegraph: a dry woodblock tick. */
export function tick(o: Out, t: number) {
  osc(o, 'sine', 1750, t, t + 0.04, hit(o, t, 0.3, 0.04, o.dest));
  noise(o, t, t + 0.02, filter(o, 'bandpass', 2600, 2, hit(o, t, 0.2, 0.02, o.dest)));
}

/** Boss beaten: a sad trombone. */
export function defeat(o: Out, t: number) {
  [55, 54, 53].forEach((m, i) => lead(o, t + i * 0.28, 0.22, m, 1.4, 'square'));
  lead(o, t + 0.84, 0.7, 52, 1.4, 'square', 53);
}

/** Victory fanfare on `tonic` (major). */
export function win(o: Out, t: number, tonic: number) {
  [0, 4, 7, 12].forEach((k, i) => blip(o, t + i * 0.09, 0.09, tonic + k, 1.3));
  chord(o, t + 0.36, 0.9, [tonic - 12, tonic - 5, tonic, tonic + 4], 0.6, 1);
  lead(o, t + 0.36, 0.9, tonic + 12, 1, 'pulse');
}

export function ui(o: Out, t: number, name: 'click' | 'back' | 'start') {
  if (name === 'click') blip(o, t, 0.03, 91, 0.9);
  else if (name === 'back') [86, 79].forEach((m, i) => blip(o, t + i * 0.06, 0.05, m, 0.9));
  else [72, 76, 79, 84].forEach((m, i) => blip(o, t + i * 0.06, 0.06, m, 1));
}
