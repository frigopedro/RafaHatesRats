/**
 * All game sound, synthesised in WebAudio (no audio files): voices, a beat-locked sequencer, three songs, SFX.
 *
 * Integration in src/main.ts (the whole job):
 *
 *   import { createAudio } from './audio';
 *   const audio = createAudio();                      // at load; the AudioContext is made on the first real tap
 *   // play(): right after control.start()
 *   audio.unlock(); audio.startLevel(def, clock, startBeat);
 *   // GameScene hooks:
 *   onSimEvent(e) { audio.onSimEvent(e); … }          // SFX; a death also fades the music out
 *   onFrame(beat, progress) { audio.pump(); … }        // EVERY frame, paused or not (that is how a pause is heard)
 *   // menus: audio.ui('click' | 'back' | 'start'); settings: audio.setMusicVolume(v), audio.setSfxVolume(v) (0..1)
 *   // leaving the level for a menu: audio.stop();
 *
 * Handled here, nothing to wire: unlocking on the first pointerup/touchend/click/keydown (iOS needs a real
 * activation; pointerdown from touch doesn't count), resuming after an iOS interruption on the next tap,
 * navigator.audioSession = 'playback' (iOS 17+: plays through the silent switch), suspend/resume on tab hide/show,
 * and game pause (seen as the clock standing still: what was scheduled ahead is cancelled and re-sent on resume).
 * Gelol overdrive needs no call either: tempo comes from the clock and the layer from the clock's overdrive window.
 *
 * Levels pick a song with LevelDef.songId: 'gym' (L1), 'church' (L2), 'party' (L3). Each song has a part for every
 * section name: intro warmup main gelol bossEnter boss1 boss2 boss3 finale (any other name plays 'main').
 */
import type { BeatClock } from '../game/clock';
import { PRE_TICKS, TICKS_PER_BEAT as TPB } from '../config';
import type { LevelDef, SimEvent } from '../types';
import { outputOffset, Sequencer, type Host } from './sequencer';
import * as sfx from './sfx';
import { SongPlayer, STEPS } from './song';
import { SONGS } from './songs';
import { makeOut, MASTER_DELAY, masterChain, type Live, type Out } from './voices';

export interface Audio {
  unlock(): Promise<void>;
  startLevel(def: LevelDef, clock: BeatClock, startBeat?: number): void;
  stop(fadeMs?: number): void;
  pump(): void;
  onSimEvent(e: SimEvent): void;
  ui(name: 'click' | 'back' | 'start'): void;
  setMusicVolume(v: number): void;
  setSfxVolume(v: number): void;
  suspend(): void;
  resume(): void;
}

interface Bus {
  gain: GainNode;
  shelf: BiquadFilterNode; // Gelol "opens up" the mix
  od: boolean; // shelf state
  live: Live[];
  out: Out;
}
interface Run {
  seq: Sequencer;
  player: SongPlayer;
  bus: Bus | null;
  preEnd: number; // beat the pré-treino runs out (-1 = none)
}

/** Default levels (0..1, squared into gain). */
export const VOLUME = { music: 0.8, sfx: 0.9 };
const COIN_STEPS = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16]; // a coin streak climbs the major scale

export function createAudio(): Audio {
  let ctx: AudioContext | null = null;
  let music: GainNode, effects: GainNode, fx: Out;
  const vol = { ...VOLUME };
  let offset = NaN; // context time − performance time, s
  let run: Run | null = null;
  let suspended = false;
  let primed = false;
  let lastJump = 0, lastCoin = -1e9, streak = 0;

  function ensure(): AudioContext {
    if (ctx) return ctx;
    const c = (ctx = new AudioContext({ latencyHint: 'interactive' }));
    const master = masterChain(c);
    music = c.createGain();
    effects = c.createGain();
    music.gain.value = vol.music ** 2;
    effects.gain.value = vol.sfx ** 2;
    music.connect(master);
    effects.connect(master);
    fx = makeOut(c, effects);
    return c;
  }
  const ready = () => ctx?.state === 'running' && !suspended;

  function newBus(): Bus {
    const c = ensure();
    const gain = c.createGain();
    const shelf = c.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 2500;
    gain.connect(shelf).connect(music);
    const live: Live[] = [];
    return { gain, shelf, od: false, live, out: makeOut(c, gain, live) };
  }

  /** Cancels the bus's notes from `fromStep` on (none has started). With `fadeMs`, also fades out what is still
   *  ringing and drops the bus (pause, stop, restart). */
  function cut(fromStep: number, fadeMs = 0) {
    const bus = run?.bus;
    if (!bus || !ctx) return;
    const live = bus.live;
    let j = 0;
    for (const l of live) {
      if (l.s < fromStep) live[j++] = l;
      else {
        l.n.onended = null;
        l.n.stop();
        l.n.disconnect();
      }
    }
    live.length = j;
    if (!fadeMs) return;
    run!.bus = null;
    const t = ctx.currentTime;
    bus.gain.gain.cancelScheduledValues(t);
    bus.gain.gain.setTargetAtTime(0, t, fadeMs / 6000);
    setTimeout(() => bus.shelf.disconnect(), fadeMs + 60);
  }

  const host: Host = {
    ctxNow: () => ctx!.currentTime,
    toCtx: (p) => p / 1000 + offset - MASTER_DELAY,
    play(step, at, prev, od, countdown) {
      const r = run!, bus = (r.bus ??= newBus()), beat = step / STEPS;
      if (od !== bus.od) bus.shelf.gain.setTargetAtTime(od ? 5 : 0, Math.max(at(beat), ctx!.currentTime), 0.01);
      bus.od = od;
      bus.out.step = step;
      r.player.play(bus.out, step, at);
      if (od || prev) r.player.overdrive(bus.out, step, at, prev, od, countdown);
      // Pré-treino running out: ticks on its last two beats, a fizzle when it ends
      for (let k = 2; k >= 0; k--) {
        const b = r.preEnd - k;
        if (b >= beat && b < beat + 1 / STEPS) (k ? sfx.preTick : sfx.fizzle)(bus.out, at(b));
      }
    },
    cut: (from, pause) => cut(from, pause ? 30 : 0),
  };

  const api: Audio = {
    async unlock() {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
      const c = ensure();
      if (!primed) {
        // iOS: a sound started inside the gesture fully unlocks output
        const b = c.createBufferSource();
        b.buffer = c.createBuffer(1, 1, c.sampleRate);
        b.connect(c.destination);
        b.start();
        primed = true;
      }
      if (c.state !== 'running' && !document.hidden) await c.resume().catch(() => {});
    },

    startLevel(def, clock, startBeat = 0) {
      api.stop();
      const song = SONGS[def.songId] ?? SONGS.gym;
      if (!SONGS[def.songId]) console.warn(`audio: no song '${def.songId}', playing 'gym'`);
      run = { seq: new Sequencer(clock, host), player: new SongPlayer(song, def), bus: null, preEnd: -1 };
      run.seq.start(startBeat);
      ensure();
      lastCoin = -1e9;
      streak = 0;
      api.pump(); // the first downbeat now, not a frame later
    },

    stop(fadeMs = 30) {
      if (run && ctx) cut(run.seq.rewind(), fadeMs);
      run = null;
    },

    pump() {
      if (!run || !ready()) return;
      const c = ctx!;
      const fresh = outputOffset(c);
      // follow slow drift smoothly; re-lock at once after a jump (context resumed, output change)
      offset = Math.abs(fresh - offset) < 0.02 ? offset + (fresh - offset) * 0.02 : fresh;
      const live = run.bus?.live;
      if (live) {
        let k = 0;
        while (k < live.length && live[k].t < c.currentTime - 4) k++;
        if (k) live.splice(0, k);
      }
      run.seq.pump();
    },

    onSimEvent(e) {
      if (e.type === 'death') api.stop(80);
      if (!ready()) return;
      const t = ctx!.currentTime;
      switch (e.type) {
        case 'jump':
          (e.air ? sfx.bigJump : sfx.hop)(fx, t);
          lastJump = e.tick;
          break;
        case 'land':
          sfx.land(fx, t, e.tick - lastJump > 0.9 * TPB); // heavier after a big jump
          break;
        case 'pickup':
          if (e.kind === 'coin') {
            streak = e.tick - lastCoin <= 1.5 * TPB ? Math.min(streak + 1, COIN_STEPS.length - 1) : 0;
            lastCoin = e.tick;
            sfx.coin(fx, t, COIN_STEPS[streak]);
          } else if (e.kind === 'gelol') sfx.ignite(fx, t);
          else if (e.kind === 'whey') sfx.whey(fx, t);
          else {
            sfx.pre(fx, t);
            if (run) {
              run.preEnd = (e.tick + PRE_TICKS) / TPB; // a second pickup restarts it, like the sim
              cut(run.seq.rewind(), 0); // re-send what is already queued so stale ticks never sound
            }
          }
          break;
        case 'smash':
          sfx.smash(fx, t);
          if (e.kind === 'rat') sfx.squeak(fx, t + 0.03);
          break;
        case 'shieldBreak':
          sfx.shieldBreak(fx, t);
          if (e.kind === 'rat') sfx.squeak(fx, t + 0.03);
          break;
        case 'death':
          sfx.crash(fx, t);
          if (e.cause === 'rat') sfx.squeak(fx, t + 0.05);
          break;
        case 'cue':
          if (e.cue.cue === 'bossExit') sfx.defeat(fx, t);
          break;
        // bossEnter stings, attack telegraph ticks, the overdrive power chord / power-down and the win jingle are
        // part of the music stream, so they land exactly on their beats.
      }
    },

    ui(name) {
      void api.unlock(); // menu taps are real activations
      if (ctx?.state === 'running') sfx.ui(fx, ctx.currentTime, name);
    },

    setMusicVolume(v) {
      vol.music = Math.min(1, Math.max(0, v));
      if (ctx) music.gain.setTargetAtTime(vol.music ** 2, ctx.currentTime, 0.02);
    },
    setSfxVolume(v) {
      vol.sfx = Math.min(1, Math.max(0, v));
      if (ctx) effects.gain.setTargetAtTime(vol.sfx ** 2, ctx.currentTime, 0.02);
    },

    suspend() {
      suspended = true;
      if (run && ctx) cut(run.seq.hold(), 20);
      void ctx?.suspend().catch(() => {});
    },
    resume() {
      suspended = false;
      if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
    },
  };

  const onGesture = () => {
    if (!suspended && ctx?.state !== 'running') void api.unlock();
  };
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, onGesture, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? api.suspend() : api.resume()));
  return api;
}
