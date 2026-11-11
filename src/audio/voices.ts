// Synth voices. Each call builds the few nodes one note needs, starts them at context time `t` and lets them stop
// and disconnect themselves. Mixed for phone speakers: low parts carry harmonics (drive, saw/square) so they are heard
// without real sub.

/** Where a voice plays, plus the per-context things every note shares. */
export interface Out {
  ctx: BaseAudioContext;
  dest: AudioNode;
  drive: AudioNode; // soft clipper into dest: adds the overtones a phone speaker can actually reproduce
  noise: AudioBuffer;
  pulse: PeriodicWave; // 25% pulse, the chiptune lead
  live?: Live[]; // music only: lets a cut cancel the notes that have not sounded yet
  step: number; // tag for `live` (sequencer step being played)
}
export interface Live {
  n: AudioScheduledSourceNode;
  s: number; // step
  t: number; // start time
}

const CURVE = new Float32Array(1024).map((_, i) => Math.tanh(2.2 * (i / 511.5 - 1)));

export function makeOut(ctx: BaseAudioContext, dest: AudioNode, live?: Live[]): Out {
  const drive = ctx.createWaveShaper();
  drive.curve = CURVE;
  const post = ctx.createGain();
  post.gain.value = 0.8;
  drive.connect(post).connect(dest);
  return { ctx, dest, drive, noise: noiseBuffer(ctx), pulse: pulseWave(ctx), live, step: 0 };
}

const buffers = new WeakMap<BaseAudioContext, [AudioBuffer, PeriodicWave]>();
function shared(ctx: BaseAudioContext): [AudioBuffer, PeriodicWave] {
  let s = buffers.get(ctx);
  if (!s) {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * 0.25) / (Math.PI * k);
      im[k] = (1 - Math.cos(2 * Math.PI * k * 0.25)) / (Math.PI * k);
    }
    s = [b, ctx.createPeriodicWave(re, im)];
    buffers.set(ctx, s);
  }
  return s;
}
const noiseBuffer = (ctx: BaseAudioContext) => shared(ctx)[0];
const pulseWave = (ctx: BaseAudioContext) => shared(ctx)[1];

/** Master chain into the speakers: rumble cut (phones can't play it; it only eats headroom) and a fast limiter. */
/** The limiter's built-in look-ahead (Chromium and WebKit DynamicsCompressor: 6 ms); notes are sent this much
 *  earlier so they still arrive on the beat (measured by scripts/audio-check.mjs). */
export const MASTER_DELAY = 0.006;

export function masterChain(ctx: BaseAudioContext): GainNode {
  const input = ctx.createGain();
  input.gain.value = 0.8; // headroom: the compressor is not a brick wall (measured peaks reached 0 dBFS without this)
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 38;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -9;
  lim.knee.value = 4;
  lim.ratio.value = 12;
  lim.attack.value = 0.002;
  lim.release.value = 0.12;
  input.connect(hp).connect(lim).connect(ctx.destination);
  return input;
}

export const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

function disc(this: AudioNode) {
  this.disconnect();
}
function go<T extends AudioScheduledSourceNode>(o: Out, n: T, t: number, end: number): T {
  n.start(t);
  n.stop(end);
  n.onended = disc;
  o.live?.push({ n, s: o.step, t });
  return n;
}

export function osc(o: Out, type: OscillatorType | 'pulse', f: number, t: number, end: number, dest: AudioNode): OscillatorNode {
  const n = o.ctx.createOscillator();
  if (type === 'pulse') n.setPeriodicWave(o.pulse);
  else n.type = type;
  n.frequency.setValueAtTime(f, t);
  n.connect(dest);
  return go(o, n, t, end);
}

export function noise(o: Out, t: number, end: number, dest: AudioNode): AudioBufferSourceNode {
  const n = o.ctx.createBufferSource();
  n.buffer = o.noise;
  n.loop = true;
  n.connect(dest);
  n.start(t, Math.random() * 1.5);
  n.stop(end);
  n.onended = disc;
  o.live?.push({ n, s: o.step, t });
  return n;
}

export function filter(o: Out, type: BiquadFilterType, f: number, q: number, dest: AudioNode): BiquadFilterNode {
  const n = o.ctx.createBiquadFilter();
  n.type = type;
  n.frequency.value = f;
  n.Q.value = q;
  n.connect(dest);
  return n;
}

/** Percussive envelope: 2 ms attack to `v`, exponential decay to silence at t + d. */
export function hit(o: Out, t: number, v: number, d: number, dest: AudioNode): GainNode {
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.002);
  g.gain.exponentialRampToValueAtTime(1e-4, t + d);
  g.connect(dest);
  return g;
}

/** Linear ADSR held for `len`; returns the end time. */
function adsr(g: AudioParam, t: number, len: number, v: number, a: number, d: number, s: number, r: number): number {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(v, t + a);
  if (len > a + d) {
    g.linearRampToValueAtTime(v * s, t + a + d);
    g.setValueAtTime(v * s, t + len);
  }
  const end = t + Math.max(len, a) + r;
  g.linearRampToValueAtTime(0, end);
  return end;
}

function glide(p: AudioParam, from: number | undefined, to: number, t: number) {
  if (from) {
    p.setValueAtTime(from, t);
    p.exponentialRampToValueAtTime(to, t + 0.06);
  } else p.setValueAtTime(to, t);
}

// ── Drums ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Electro kick (`deep` = 808-style boom for the funk). */
export function kick(o: Out, t: number, v: number, deep = false) {
  const d = deep ? 0.45 : 0.3;
  const body = hit(o, t, v * (deep ? 0.65 : 1), d, o.drive);
  const f = osc(o, 'sine', deep ? 140 : 180, t, t + d, body).frequency;
  f.exponentialRampToValueAtTime(deep ? 44 : 52, t + (deep ? 0.14 : 0.07));
  noise(o, t, t + 0.015, filter(o, 'highpass', 2500, 0.7, hit(o, t, v * 0.35, 0.015, o.dest)));
}

export function snare(o: Out, t: number, v: number) {
  noise(o, t, t + 0.2, filter(o, 'highpass', 1400, 0.7, hit(o, t, v * 0.55, 0.2, o.dest)));
  osc(o, 'triangle', 210, t, t + 0.1, hit(o, t, v * 0.5, 0.1, o.dest)).frequency.exponentialRampToValueAtTime(150, t + 0.08);
}

export function clap(o: Out, t: number, v: number) {
  const g = o.ctx.createGain();
  for (let k = 0; k < 3; k++) {
    g.gain.setValueAtTime(v * 0.6, t + k * 0.011);
    g.gain.exponentialRampToValueAtTime(v * 0.06, t + k * 0.011 + 0.01);
  }
  g.gain.setValueAtTime(v * 0.6, t + 0.033);
  g.gain.exponentialRampToValueAtTime(1e-4, t + 0.22);
  g.connect(o.dest);
  noise(o, t, t + 0.22, filter(o, 'bandpass', 1300, 1.1, g));
}

export function hat(o: Out, t: number, v: number, open = false) {
  const d = open ? 0.28 : 0.045;
  noise(o, t, t + d, filter(o, 'highpass', 7000, 0.8, hit(o, t, v * (open ? 0.3 : 0.42), d, o.dest)));
}

/** Pitched drum: the tamborzão "tum" (also fills). */
export function tom(o: Out, t: number, v: number, f: number) {
  const g = hit(o, t, v * 0.75, 0.22, o.drive);
  osc(o, 'sine', f * 1.7, t, t + 0.22, g).frequency.exponentialRampToValueAtTime(f, t + 0.06);
  noise(o, t, t + 0.04, filter(o, 'bandpass', 1800, 1, hit(o, t, v * 0.4, 0.04, o.dest)));
}

/** Cuíca "uh": a friction-drum whoop up (or down) through a formant. */
export function cuica(o: Out, t: number, v: number, up: boolean) {
  const g = hit(o, t, v * 0.35, 0.24, filter(o, 'bandpass', 900, 1.5, o.dest));
  const f = osc(o, 'triangle', up ? 330 : 620, t, t + 0.24, g).frequency;
  f.exponentialRampToValueAtTime(up ? 680 : 300, t + 0.12);
  f.exponentialRampToValueAtTime(up ? 520 : 260, t + 0.22);
}

/** Apito (samba whistle): a pip, or a trill when `long`. */
export function whistle(o: Out, t: number, v: number, long: boolean) {
  const d = long ? 0.4 : 0.09;
  const n = osc(o, 'sine', 2350, t, t + d, hit(o, t, v * 0.16, d, o.dest));
  if (long) {
    const depth = o.ctx.createGain();
    depth.gain.value = 180;
    depth.connect(n.frequency);
    osc(o, 'square', 26, t, t + d, depth);
  }
}

// ── Pitched ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type BassKind = 'saw' | 'square' | '808';
export function bass(o: Out, t: number, len: number, m: number, v: number, kind: BassKind, from?: number) {
  const g = o.ctx.createGain();
  const f = mtof(m);
  if (kind === '808') {
    // sine sub for headphones; a filtered square on top so phone speakers still hear the slides
    const end = adsr(g.gain, t, len, v * 0.28, 0.004, 0.25, 0.5, 0.06);
    g.connect(o.drive);
    glide(osc(o, 'sine', f, t, end, g).frequency, from && mtof(from), f, t);
    const lp = filter(o, 'lowpass', 2600, 1, hit(o, t, v * 0.45, Math.min(0.35, end - t), o.dest));
    glide(osc(o, 'square', f * 2, t, end, lp).frequency, from && mtof(from) * 2, f * 2, t);
    return;
  }
  const lp = filter(o, 'lowpass', 0, kind === 'saw' ? 5 : 2, g);
  g.connect(o.dest);
  lp.frequency.setValueAtTime(kind === 'saw' ? 2400 : 1700, t);
  lp.frequency.exponentialRampToValueAtTime(kind === 'saw' ? 520 : 700, t + 0.16);
  const end = adsr(g.gain, t, kind === 'square' ? Math.min(len, 0.09) : len, v * 0.5, 0.004, 0.1, 0.7, 0.04);
  glide(osc(o, kind === 'saw' ? 'sawtooth' : 'square', f, t, end, lp).frequency, from && mtof(from), f, t);
  const sq = osc(o, 'square', f, t, end, hit(o, t, v * 0.3, end - t, lp));
  sq.detune.value = 7;
  glide(sq.frequency, from && mtof(from), f, t);
}

export type LeadKind = 'pulse' | 'square' | 'supersaw' | 'organ';
export function lead(o: Out, t: number, len: number, m: number, v: number, kind: LeadKind, from?: number) {
  if (kind === 'organ') return organ(o, t, len, m, v, from);
  const f = mtof(m), f0 = from && mtof(from);
  const g = o.ctx.createGain();
  g.connect(o.dest);
  const saw = kind === 'supersaw';
  const end = adsr(g.gain, t, len, v * (saw ? 0.11 : 0.2), 0.006, 0.12, 0.7, saw ? 0.12 : 0.06);
  const lp = filter(o, 'lowpass', saw ? 5200 : 4200, 0.5, g);
  const vib = o.ctx.createGain(); // vibrato fades in after the attack, in cents
  vib.gain.setValueAtTime(0, t);
  vib.gain.linearRampToValueAtTime(saw ? 8 : 14, t + 0.25);
  osc(o, 'sine', 5.6, t, end, vib);
  for (const det of saw ? [-17, -8, 0, 8, 17] : [0]) {
    const n = osc(o, saw ? 'sawtooth' : kind, f, t, end, lp);
    n.detune.value = det;
    glide(n.frequency, f0, f, t);
    vib.connect(n.detune);
  }
}

/** Chip pipe organ: drawbar-style stack (8', 4', 2⅔', 2') with a slow chorus wobble; no decay, like a pipe. */
function organ(o: Out, t: number, len: number, m: number, v: number, from?: number) {
  const f = mtof(m);
  const g = o.ctx.createGain();
  g.connect(o.dest);
  const end = adsr(g.gain, t, len, v * 0.15, 0.01, 0.05, 0.9, 0.07);
  const lp = filter(o, 'lowpass', 3800, 0.5, g);
  const wob = o.ctx.createGain();
  wob.gain.value = 6;
  osc(o, 'sine', 6.5, t, end, wob);
  for (const [k, type, lvl] of [[1, 'pulse', 0.5], [2, 'square', 0.3], [3, 'sine', 0.35], [4, 'sine', 0.25]] as const) {
    const amp = o.ctx.createGain();
    amp.gain.value = lvl;
    amp.connect(lp);
    const n = osc(o, type, f * k, t, end, amp);
    glide(n.frequency, from && mtof(from) * k, f * k, t);
    wob.connect(n.detune);
  }
}

/** Church bell: inharmonic partials, each decaying at its own rate. */
export function bell(o: Out, t: number, m: number, v: number) {
  const f = mtof(m);
  for (const [r, a, d] of [[0.5, 0.5, 2.2], [1, 1, 1.8], [1.19, 0.45, 1.2], [1.5, 0.35, 1], [2, 0.5, 0.9], [2.74, 0.3, 0.6], [4.07, 0.15, 0.35]]) {
    osc(o, 'sine', f * r, t, t + d, hit(o, t, v * a * 0.11, d, o.dest));
  }
}

/** Short plucked arp note. */
export function pluck(o: Out, t: number, len: number, m: number, v: number) {
  const d = Math.min(Math.max(len, 0.06), 0.18);
  const lp = filter(o, 'lowpass', 0, 3, hit(o, t, v * 0.16, d, o.dest));
  lp.frequency.setValueAtTime(5000, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + d);
  osc(o, 'pulse', mtof(m), t, t + d, lp);
}

/** Chiptune blip (count-in, fanfares). */
export function blip(o: Out, t: number, len: number, m: number, v: number) {
  const d = Math.min(Math.max(len, 0.05), 0.3);
  osc(o, 'square', mtof(m), t, t + d, hit(o, t, v * 0.16, d, o.dest));
}

/** Sustained chord of detuned saws; `bright` opens the filter (stabs, power chords). */
export function chord(o: Out, t: number, len: number, ms: number[], v: number, bright = 0) {
  const g = o.ctx.createGain();
  g.connect(o.dest);
  const end = adsr(g.gain, t, len, v / ms.length, bright ? 0.005 : 0.12, 0.3, bright ? 0.4 : 0.85, bright ? 0.15 : 0.35);
  const lp = filter(o, 'lowpass', 1400 + bright * 3000, 0.6, g);
  for (const m of ms) for (const det of [-9, 9]) osc(o, 'sawtooth', mtof(m), t, end, lp).detune.value = det;
}

/** Party-train horn: a fat two-note honk with a pitch scoop. */
export function horn(o: Out, t: number, len: number, m: number, v: number) {
  const g = o.ctx.createGain();
  g.connect(o.dest);
  const end = adsr(g.gain, t, len, v * 0.14, 0.02, 0.1, 0.8, 0.08);
  const lp = filter(o, 'lowpass', 2200, 1, g);
  for (const k of [0, 4]) {
    const f = osc(o, 'sawtooth', mtof(m + k) * 0.94, t, end, lp).frequency;
    f.exponentialRampToValueAtTime(mtof(m + k), t + 0.06);
  }
}

/** Noise sweep up over `len` (builds). */
export function riser(o: Out, t: number, len: number, v: number) {
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v * 0.25, t + len);
  g.gain.linearRampToValueAtTime(0, t + len + 0.03);
  g.connect(o.dest);
  const bp = filter(o, 'bandpass', 0, 2.5, g);
  bp.frequency.setValueAtTime(350, t);
  bp.frequency.exponentialRampToValueAtTime(7000, t + len);
  noise(o, t, t + len + 0.03, bp);
}
