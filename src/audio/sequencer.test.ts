import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeatClock } from '../game/clock';
import { LEVELS } from '../levels';
import { outputOffset, Sequencer, type Host } from './sequencer';
import { SONGS } from './songs';

let now = 0;
vi.spyOn(performance, 'now').mockImplementation(() => now);
afterEach(() => (now = 0));

const OFF = 3.7, LAT = 0.02; // context time = perf/1000 + OFF is heard; the context renders LAT ahead of that
const ctxNow = () => (Math.floor(((now / 1000 + OFF + LAT) * 48000) / 128) * 128) / 48000; // 128-frame quanta
interface Rec { step: number; t: number; prev: boolean; od: boolean }

describe('Sequencer', () => {
  it('hears every step once, in order, on time, across hitches, two Gelols, a pause and a restart', () => {
    const clock = new BeatClock(120); // 500 ms per beat
    let rec: Rec[] = [];
    let pauseFrom = -1, resends = 0, worstLead = Infinity, anchorAt = 0;
    const host: Host = {
      ctxNow,
      toCtx: (p) => p / 1000 + OFF,
      play(step, at, prev, od) {
        const t = at(step / 4);
        if (now - anchorAt > 40) worstLead = Math.min(worstLead, t - ctxNow());
        rec.push({ step, t, prev, od });
      },
      cut(from, pause) {
        const c = ctxNow();
        for (const r of rec) if (r.step >= from) expect(r.t).toBeGreaterThan(c); // cancelled before it sounded
        if (pause && clock.beat(now - 50) === clock.beat(now) && pauseFrom < 0) pauseFrom = from;
        if (!pause) resends++;
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
      if (!p2 && b >= 82.7) (p2 = true), clock.setOverdrive(71, 95), (known2 = ctxNow()); // second Gelol stretches it
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
      const od = Math.max(0, Math.min(b, 95) - Math.max(a, 71));
      return (b - a - od) * 500 + (od * 500) / 1.3;
    };
    expect(pauseFrom).toBeGreaterThan(30 * 4);
    expect(resends).toBeGreaterThan(0); // the Gelol windows really did change steps already sent
    expect(run1.length).toBeGreaterThanOrEqual(400);
    run1.forEach((r, i) => {
      expect(r.step).toBe(i);
      const beat = r.step / 4;
      const perf = r.step < pauseFrom ? 1000 + span(0, beat) : Pr + span(bp, beat);
      expect(Math.abs(r.t - (perf / 1000 + OFF))).toBeLessThan(0.001);
      // overdrive on every step of the window that had not sounded when the window became known (here a 120 ms
      // hitch delays the first pickup until 4 ms before beat 71, so that one beat-71 step keeps the normal layer)
      const inOd = (r.step >= 71 * 4 && r.step < 83 * 4 && r.t > known1) || (r.step >= 83 * 4 && r.step < 95 * 4 && r.t > known2);
      expect(r.od, `step ${r.step}`).toBe(inOd);
      if (r.step > 71 * 4 && r.step < 95 * 4) expect(r.od).toBe(true);
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
      expect(Math.abs(r.t - ((T0 + r.step * 125) / 1000 + OFF))).toBeLessThan(0.001);
      expect(r.od).toBe(false);
    });
    expect(worstLead).toBeGreaterThan(0); // nothing was sent late, 120 ms hitches included
  });

  it('maps output time from the timestamp when sane, else from currentTime minus latency', () => {
    const base = { currentTime: 10.05, baseLatency: 0.01, outputLatency: 0.03 };
    expect(outputOffset({ ...base, getOutputTimestamp: () => ({ contextTime: 10.0, performanceTime: 5000 }) }, 5040)).toBeCloseTo(5);
    expect(outputOffset({ ...base, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }, 5000)).toBeCloseTo(5.02);
    expect(outputOffset({ ...base, getOutputTimestamp: () => ({ contextTime: 2, performanceTime: 5000 }) }, 5000)).toBeCloseTo(5.02);
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
