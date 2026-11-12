import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeatClock } from '../game/clock';
import { LEVELS } from '../levels';
import { outputOffset, Sequencer, type Host } from './sequencer';
import * as sfx from './sfx';
import { SongPlayer } from './song';
import { SONGS } from './songs';
import type { Out } from './voices';

let now = 0;
vi.spyOn(performance, 'now').mockImplementation(() => now);
afterEach(() => (now = 0));

const OFF = 3.7, LAT = 0.02; // context time = perf/1000 + OFF is heard; the context renders LAT ahead of that
const ctxNow = () => (Math.floor(((now / 1000 + OFF + LAT) * 48000) / 128) * 128) / 48000; // 128-frame quanta
interface Rec { step: number; t: number; prev: boolean; od: boolean; cd: number; sentAt: number }

describe('Sequencer', () => {
  it('hears every step once, in order, on time, across hitches, two Gelols, a pause and a restart', () => {
    const clock = new BeatClock(120); // 500 ms per beat
    let rec: Rec[] = [];
    let pauseFrom = -1, resends = 0, worstLead = Infinity, anchorAt = 0, cancelledTicks = 0;
    const host: Host = {
      ctxNow,
      toCtx: (p) => p / 1000 + OFF,
      play(step, at, prev, od, cd) {
        const t = at(step / 4);
        if (now - anchorAt > 40) worstLead = Math.min(worstLead, t - ctxNow());
        rec.push({ step, t, prev, od, cd, sentAt: ctxNow() });
      },
      cut(from, pause) {
        const c = ctxNow();
        for (const r of rec) if (r.step >= from) expect(r.t).toBeGreaterThan(c); // cancelled before it sounded
        if (pause && clock.beat(now - 50) === clock.beat(now) && pauseFrom < 0) pauseFrom = from;
        if (!pause) resends++;
        cancelledTicks += rec.filter((r) => r.step >= from && r.cd).length;
        rec = rec.filter((r) => r.step < from);
      },
    };
    const frames = [16, 16, 33, 16, 120, 17, 16, 16, 120, 16];
    let f = 0;
    const frame = () => (now += frames[f++ % frames.length]);

    now = anchorAt = 1000;
    clock.start(0);
    let seq = new Sequencer(clock, host);
    seq.start(0);
    let p1 = false, p2 = false, bp = 0, Pr = 0, known1 = 0, known2 = 0;
    while (clock.beat() < 100) {
      frame();
      const b = clock.beat();
      // what GameScene does: sim step (Gelol pickups set the clock's window) before the audio pump
      if (!p1 && b >= 70.84) (p1 = true), clock.setOverdrive(71, 83), (known1 = ctxNow());
      // second Gelol stretches it to 82 + 12 (as the sim does): after the 3 and 2 ticks, while the 1 is queued
      // (seen at beat 81.72 with these frames, ~110 ms before that tick)
      if (!p2 && b >= 81.7) (p2 = true), clock.setOverdrive(71, 94), (known2 = ctxNow());
      if (!bp && b >= 30) {
        bp = b;
        clock.pause();
        for (const end = now + 700; now < end; frame()) seq.pump();
        clock.resume();
        Pr = anchorAt = now;
      }
      seq.pump();
    }
    host.cut(seq.rewind(), true); // restart: the engine cuts the old run
    const run1 = rec;

    const span = (a: number, b: number) => {
      const od = Math.max(0, Math.min(b, 94) - Math.max(a, 71));
      return (b - a - od) * 500 + (od * 500) / 1.3;
    };
    expect(pauseFrom).toBeGreaterThan(30 * 4);
    expect(resends).toBeGreaterThan(0); // the Gelol windows really did change steps already sent
    expect(run1.length).toBeGreaterThanOrEqual(400);
    run1.forEach((r, i) => {
      expect(r.step).toBe(i);
      const beat = r.step / 4;
      const perf = r.step < pauseFrom ? 1000 + span(0, beat) : Pr + span(bp, beat);
      expect(Math.abs(r.t - Math.max(perf / 1000 + OFF, r.sentAt))).toBeLessThan(0.001); // late steps play at once
      // overdrive on every step of the window that had not sounded when the window became known (here a 120 ms
      // hitch delays the first pickup until 4 ms before beat 71, so that one beat-71 step keeps the normal layer)
      const inOd = (r.step >= 71 * 4 && r.step < 83 * 4 && r.t > known1) || (r.step >= 83 * 4 && r.step < 94 * 4 && r.t > known2);
      expect(r.od, `step ${r.step}`).toBe(inOd);
      if (r.step > 71 * 4 && r.step < 94 * 4) expect(r.od).toBe(true);
      if (i) expect(r.prev).toBe(run1[i - 1].od);
    });

    rec = [];
    clock.start(0);
    const T0 = (anchorAt = now);
    seq = new Sequencer(clock, host);
    seq.start(0);
    while (clock.beat() < 20) frame(), seq.pump();
    expect(rec.length).toBeGreaterThanOrEqual(80);
    rec.forEach((r, i) => {
      expect(r.step).toBe(i);
      expect(Math.abs(r.t - Math.max((T0 + r.step * 125) / 1000 + OFF, r.sentAt))).toBeLessThan(0.001);
      expect(r.od).toBe(false);
    });
    expect(worstLead).toBeGreaterThan(0); // nothing was sent late, 120 ms hitches included
    // Gelol countdown: 3, 2 heard before the stretch; its queued 1 was cancelled; then 3, 2, 1 before the real end
    expect(run1.filter((r) => r.cd).map((r) => [r.step / 4, r.cd])).toEqual([[80, 3], [81, 2], [91, 3], [92, 2], [93, 1]]);
    expect(cancelledTicks).toBeGreaterThan(0);
    expect(rec.some((r) => r.cd)).toBe(false); // none after the restart
  });

  it('maps output time from the timestamp when sane, else from currentTime minus latency', () => {
    const base = { currentTime: 10.05, baseLatency: 0.01, outputLatency: 0.03 };
    expect(outputOffset({ ...base, getOutputTimestamp: () => ({ contextTime: 10.0, performanceTime: 5000 }) }, 5040)).toBeCloseTo(5);
    expect(outputOffset({ ...base, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }, 5000)).toBeCloseTo(5.02);
    expect(outputOffset({ ...base, getOutputTimestamp: () => ({ contextTime: 2, performanceTime: 5000 }) }, 5000)).toBeCloseTo(5.02);
  });
});

// A mock context that records every time handed to WebAudio (param automation, start, stop), driving the real
// SongPlayer and voices.
const times: number[] = [];
const param = () => ({
  value: 0, cancelScheduledValues() {}, setValueAtTime: (_: number, t: number) => times.push(t),
  linearRampToValueAtTime: (_: number, t: number) => times.push(t), exponentialRampToValueAtTime: (_: number, t: number) => times.push(t),
  setTargetAtTime: (_: number, t: number) => times.push(t),
});
const node = () => ({
  gain: param(), frequency: param(), detune: param(), Q: param(), type: '', buffer: null, loop: false, onended: null,
  connect: (d: unknown) => d, disconnect() {}, setPeriodicWave() {}, start: (t: number) => times.push(t), stop: (t: number) => times.push(t),
});
const mockCtx = { createGain: node, createOscillator: node, createBiquadFilter: node, createBufferSource: node, sampleRate: 48000 };
const out = { ctx: mockCtx, dest: node(), drive: node(), noise: {}, pulse: {}, step: 0 } as unknown as Out;

/** Runs the gym song through the real player. `ctxAt(perf)` = context time (null = not running yet, so no pump, as
 *  in the engine); `off` = context time heard − perf/1000. Returns played steps and the worst (time − currentTime). */
function runGym(seq: (h: Host) => Sequencer, ctxAt: (p: number) => number | null, off: () => number, frames: number, onFrame?: () => void) {
  const player = new SongPlayer(SONGS.gym, LEVELS[0]);
  const played: number[] = [];
  let worst = Infinity;
  const host: Host = {
    ctxNow: () => ctxAt(now)!,
    toCtx: (p) => p / 1000 + off(),
    play(step, at, prev, od, cd) {
      times.length = 0;
      out.step = step;
      player.play(out, step, at);
      if (od || prev) player.overdrive(out, step, at, prev, od, cd);
      for (const t of times) worst = Math.min(worst, t - ctxAt(now)!);
      played.push(step);
    },
    cut: (from) => played.splice(0, played.length, ...played.filter((st) => st < from)), // cancelled, as the engine does
  };
  const q = seq(host);
  for (let i = 0; i < frames; i++, now += 16) {
    onFrame?.();
    if (ctxAt(now) !== null) q.pump();
  }
  return { played, worst, seq: q };
}

describe('starting mid-level', () => {
  // gym layout: main 40–72 (riser and roll in its last bar 68–72), gelol 72–96
  it.each([
    ['inside a normal section', 50],
    ['in the middle of an overdrive window', 76.3],
    ['in the last bar of a section (fill, riser)', 70.5],
  ])('%s: nothing before the start beat, nothing before the context time', (_, start) => {
    const OFF0 = 0.01 - 5 - LAT; // a context that has only just started: currentTime ≈ 0.01 s at perf 5000
    now = 5000;
    const clock = new BeatClock(120);
    clock.start(start);
    if (start > 71 && start < 83) clock.setOverdrive(71, 83);
    const r = runGym((h) => { const q = new Sequencer(clock, h); q.start(start); return q; }, (p) => p / 1000 + OFF0 + LAT, () => OFF0, 120);
    expect(r.played[0]).toBe(Math.ceil(start * 4));
    r.played.forEach((s, i) => expect(s).toBe(r.played[0] + i));
    expect(r.worst).toBeGreaterThanOrEqual(0);
  });
});

describe('a context that has only just started', () => {
  it.each([0, 0.005])('first pump at currentTime %s, 200 ms after the run started: the downbeat still sounds', (c0) => {
    now = 5000;
    const clock = new BeatClock(120);
    clock.start(0);
    const running = 5200; // iOS: resume() resolved 200 ms after JOGAR
    const ctxAt = (p: number) => (p < running ? null : c0 + (p - running) / 1000);
    const off = () => c0 - running / 1000 - LAT; // what outputOffset gives once running
    let seq!: Sequencer;
    const r = runGym((h) => (seq = new Sequencer(clock, h)), ctxAt, off, 60, () => now === 5000 && seq.start(0));
    expect(r.played[0]).toBe(0); // the downbeat, a little late rather than dropped
    expect(r.played.slice(1).every((s) => s * 125 + 5000 > running)).toBe(true); // nothing else from the past piles on
    r.played.forEach((s, i) => i && expect(s).toBeGreaterThan(r.played[i - 1]));
    expect(r.worst).toBeGreaterThanOrEqual(0);
  });

  it('SFX fired at currentTime 0 never schedule in the past', () => {
    for (const [name, f] of Object.entries(sfx)) {
      times.length = 0;
      (f as (o: Out, t: number, k: number) => void)(out, 0, 1);
      expect(Math.min(...times), name).toBeGreaterThanOrEqual(0);
    }
  });

  it('pause, tab hidden (context suspended), resume: the paused step comes back once, nothing in the past', () => {
    now = 5000;
    const clock = new BeatClock(120);
    clock.start(0);
    // context runs from perf 5000 at time 0.5; suspended 7000–9000 (frozen), resumes 150 ms after the game does
    const ctxAt = (p: number) => (p <= 7000 ? 0.5 + (p - 5000) / 1000 : p < 9150 ? null : 2.5 + (p - 9150) / 1000);
    const off = () => (now < 9150 ? 0.5 - 5 - LAT : 2.5 - 9.15 - LAT); // the engine re-locks after the resume
    let seq!: Sequencer, host!: Host, pausedAt = 0;
    const r = runGym((h) => ((host = h), (seq = new Sequencer(clock, h))), ctxAt, off, 400, () => {
      if (now === 5000) seq.start(0);
      if (now >= 7000 && !pausedAt) (pausedAt = clock.beat()), host.cut(seq.hold(), true), clock.pause(); // engine suspend() + game pause
      if (now >= 9000 && !clock.running) clock.resume();
    });
    const after = r.played.findIndex((s, i) => i && s <= r.played[i - 1]);
    expect(after).toBe(-1); // in order, never twice
    expect(r.played).toContain(Math.ceil(pausedAt * 4)); // the step after the pause point does sound
    expect(r.worst).toBeGreaterThanOrEqual(0);
  });
});

describe('songs', () => {
  it('compile and cover the section vocabulary', () => {
    const names = LEVELS[0].sections.map((s) => s.name);
    expect(Object.keys(SONGS).sort()).toEqual(['church', 'gym', 'party']);
    for (const s of Object.values(SONGS)) {
      for (const n of names) expect(s.parts[n], `${s.def.id}.${n}`).toBeTruthy();
      for (const sec of s.def.layout) expect(s.parts[sec.name]).toBeTruthy();
    }
    expect(SONGS[LEVELS[0].songId]).toBeTruthy();
  });
});
