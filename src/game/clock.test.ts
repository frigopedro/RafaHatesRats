import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeatClock } from './clock';

let now = 0;
vi.spyOn(performance, 'now').mockImplementation(() => now);
afterEach(() => (now = 0));

describe('BeatClock', () => {
  it('derives the beat from the anchor, freezes on pause and resumes where it stopped', () => {
    const c = new BeatClock(120); // 2 beats per second
    c.start(4);
    now = 1000;
    expect(c.beat()).toBeCloseTo(6);
    c.pause();
    now = 5000;
    expect(c.beat()).toBeCloseTo(6);
    c.resume();
    now = 5500;
    expect(c.beat()).toBeCloseTo(7);
  });

  it('runs ×1.3 exactly between the overdrive beats and maps beats back to time', () => {
    const c = new BeatClock(120);
    c.start(0);
    c.setOverdrive(2, 4);
    now = 1000; // beat 2 exactly
    expect(c.beat()).toBeCloseTo(2);
    now = 1000 + 2000 / 2.6; // 2 beats at 2.6 beats/s
    expect(c.beat()).toBeCloseTo(4);
    now += 500;
    expect(c.beat()).toBeCloseTo(5);
    expect(c.timeAt(6)).toBeCloseTo(now + 500);
    c.setOverdrive(8, 10); // a second Gelol later on
    expect(c.timeAt(9)).toBeCloseTo(now + 1500 + 1000 / 2.6);
    expect(c.timeAt(11)).toBeCloseTo(now + 1500 + 2000 / 2.6 + 500);
  });
});
