// audio.html: play any song from any section through the real engine, toggle overdrive/pause, fire every SFX, and
// watch a metronome driven by the same BeatClock (judge audio/visual sync by eye and ear on the phone).
// Also exposes window.audioDev for scripts/audio-check.mjs (offline renders with the real voices and patterns).
import { OVERDRIVE } from '../config';
import { BeatClock } from '../game/clock';
import { LEVELS } from '../levels';
import type { LevelDef } from '../types';
import { createAudio, VOLUME } from '.';
import * as sfx from './sfx';
import { SongPlayer, STEPS } from './song';
import { SONGS } from './songs';
import { makeOut, MASTER_DELAY, masterChain, type Out } from './voices';

const SFX: Record<string, (o: Out, t: number) => void> = {
  hop: sfx.hop, bigJump: sfx.bigJump, land: (o, t) => sfx.land(o, t), landHeavy: (o, t) => sfx.land(o, t, true),
  coin: (o, t) => sfx.coin(o, t), coinStreak: (o, t) => [0, 2, 4, 5, 7].forEach((k, i) => sfx.coin(o, t + i * 0.12, k)),
  ignite: sfx.ignite, powerDown: sfx.powerDown, whey: sfx.whey, pre: sfx.pre, shieldBreak: sfx.shieldBreak,
  smash: sfx.smash, squeak: sfx.squeak, crash: sfx.crash, bossSting: sfx.bossSting, tick: sfx.tick,
  defeat: sfx.defeat, win: (o, t) => sfx.win(o, t, 69),
  click: (o, t) => sfx.ui(o, t, 'click'), back: (o, t) => sfx.ui(o, t, 'back'), start: (o, t) => sfx.ui(o, t, 'start'),
};

const levelFor = (id: string): LevelDef =>
  LEVELS.find((l) => l.songId === id) ??
  ({ ...LEVELS[0], songId: id, bpm: SONGS[id].def.bpm, sections: SONGS[id].def.layout, lengthBeats: SONGS[id].def.lengthBeats, chart: [] } as LevelDef);

// ── Offline renders ──────────────────────────────────────────────────────────────────────────────────────────────
const RATE = 44100;
const LEAD_IN = 0.05; // s before beat 0

function pack(buf: AudioBuffer) {
  const d = buf.getChannelData(0);
  let peak = 0, nan = false;
  const pcm = new Int16Array(d.length);
  for (let i = 0; i < d.length; i++) {
    const x = d[i];
    if (x !== x) nan = true;
    const a = Math.abs(x);
    if (a > peak) peak = a;
    pcm[i] = Math.max(-1, Math.min(1, x)) * 32767;
  }
  const wav = new Uint8Array(44 + pcm.byteLength);
  const v = new DataView(wav.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, pcm.byteLength, true);
  wav.set(new Uint8Array(pcm.buffer), 44);
  let bin = '';
  for (let i = 0; i < wav.length; i += 0x8000) bin += String.fromCharCode(...wav.subarray(i, i + 0x8000));
  return { wav: btoa(bin), peak, nan };
}

/** `bars` of one song part, played as a section of exactly that length (so its last-bar fill and riser happen). */
async function renderPart(songId: string, part: string, { bars = 16, od = false, only = '' } = {}) {
  const song = SONGS[songId];
  const spb = 60 / (song.def.bpm * (od ? OVERDRIVE.rate : 1));
  const beats = bars * 4;
  const ctx = new OfflineAudioContext(1, Math.ceil((LEAD_IN + beats * spb + 1.5) * RATE), RATE);
  const bus = ctx.createGain();
  bus.gain.value = VOLUME.music ** 2;
  bus.connect(masterChain(ctx));
  const o = makeOut(ctx, bus);
  const player = new SongPlayer(song, { sections: [{ beat: 0, name: part }], lengthBeats: beats, chart: [] }, only || undefined);
  const at = (b: number) => LEAD_IN - MASTER_DELAY + b * spb; // as the engine sends them
  for (let s = 0; s < beats * STEPS; s++) {
    player.play(o, s, at);
    if (od && !only) player.overdrive(o, s, at, s > 0, true);
  }
  return { ...pack(await ctx.startRendering()), spb, leadIn: LEAD_IN };
}

async function renderSfx(name: string) {
  const ctx = new OfflineAudioContext(1, RATE * 1.8, RATE);
  const bus = ctx.createGain();
  bus.gain.value = VOLUME.sfx ** 2;
  bus.connect(masterChain(ctx));
  SFX[name](makeOut(ctx, bus), LEAD_IN);
  return pack(await ctx.startRendering());
}

(window as unknown as { audioDev: unknown }).audioDev = {
  renderPart, renderSfx, sfx: Object.keys(SFX),
  songs: Object.fromEntries(Object.entries(SONGS).map(([id, s]) => [id, s.def])),
};

// ── Page ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const audio = createAudio();
let clock = null as BeatClock | null;
let level = null as LevelDef | null;
let preview: { ctx: AudioContext; out: Out } | null = null;

const songSel = $<HTMLSelectElement>('song'), secSel = $<HTMLSelectElement>('section');
songSel.innerHTML = Object.values(SONGS).map((s) => `<option value="${s.def.id}">${s.def.title} (${s.def.bpm})</option>`).join('');
const fillSections = () => {
  secSel.innerHTML = levelFor(songSel.value).sections.map((s) => `<option value="${s.beat}">${s.name} @${s.beat}</option>`).join('');
};
songSel.onchange = fillSections;
fillSections();

$('unlock').onclick = () => void audio.unlock();
$('play').onclick = () => {
  void audio.unlock();
  level = levelFor(songSel.value);
  clock = new BeatClock(level.bpm);
  const beat = Number(secSel.value);
  clock.start(beat);
  audio.startLevel(level, clock, beat);
};
$('stop').onclick = () => {
  audio.stop(200);
  clock = null;
};
$('pause').onclick = () => {
  if (!clock) return;
  if (clock.beat(performance.now() - 50) === clock.beat()) clock.resume();
  else clock.pause();
};
$('od').onclick = () => {
  if (!clock) return;
  const from = Math.ceil(clock.beat()) + 1; // a whole beat known well ahead, like a Gelol
  clock.setOverdrive(from, from + OVERDRIVE.beats);
  audio.onSimEvent({ type: 'pickup', tick: 0, item: -1, kind: 'gelol' });
};
$('music').oninput = (e) => audio.setMusicVolume(Number((e.target as HTMLInputElement).value));
$('effects').oninput = (e) => audio.setSfxVolume(Number((e.target as HTMLInputElement).value));
$('sfx').innerHTML = Object.keys(SFX).map((n) => `<button data-sfx="${n}">${n}</button>`).join('');
$('sfx').onclick = (e) => {
  const name = (e.target as HTMLElement).dataset.sfx;
  if (!name) return;
  if (!preview) {
    const ctx = new AudioContext();
    const bus = ctx.createGain();
    bus.gain.value = VOLUME.sfx ** 2;
    bus.connect(masterChain(ctx));
    preview = { ctx, out: makeOut(ctx, bus) };
  }
  void preview.ctx.resume();
  SFX[name](preview.out, preview.ctx.currentTime + 0.01);
};

const metro = $('metro'), info = $('info');
(function frame() {
  requestAnimationFrame(frame);
  audio.pump();
  if (!clock || !level) return;
  const b = clock.beat();
  const k = 1 - (b - Math.floor(b));
  const bar = Math.floor(b) % 4 === 0;
  metro.style.background = bar ? `rgba(255, 90, 60, ${k})` : `rgba(255, 225, 74, ${k * 0.8})`;
  metro.style.transform = `scale(${1 + 0.15 * k ** 3})`;
  const sec = [...level.sections].reverse().find((s) => s.beat <= b);
  const od = clock.timeAt(b + 0.25) - clock.timeAt(b) < (60000 / clock.bpm / 4) / 1.1;
  info.textContent = `beat ${b.toFixed(2)} · bar ${Math.floor(b / 4) + 1}.${(Math.floor(b) % 4) + 1} · ${sec?.name ?? '-'}${od ? ' · GELOL ×1.3' : ''}`;
})();
