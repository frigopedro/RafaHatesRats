// The crutch gait must not skate: while the tips and front foot are planted, the sprite moves back at the floor's
// speed (so they stay put in the world), planting on the beat and the half-beat, and she never jumps between frames.
import { describe, expect, it } from 'vitest';
import { crutchGait } from './rafaMuleta';

const GROUND = 384; // px per beat

describe.each([1, 1.5])('crutch gait at %s× cadence', (rate) => {
  const dt = 1 / 4000;
  const at = (beat: number) => crutchGait(beat * rate, rate);

  it('keeps the planted tips within 10% of the floor speed', () => {
    let worst = 0, planted = 0;
    for (let i = 1; i <= 4000; i++) {
      const a = at((i - 1) * dt), b = at(i * dt);
      if (!a.planted || !b.planted || a.step !== b.step) continue;
      planted++;
      worst = Math.max(worst, Math.abs(b.dx + GROUND * i * dt - a.dx - GROUND * (i - 1) * dt) / (GROUND * dt));
      expect(b.lift).toBe(0);
    }
    expect(planted).toBeGreaterThan(0);
    expect(worst).toBeLessThan(0.1);
  });

  it('plants on the beat and the half-beat and swings between', () => {
    expect(at(0).planted).toBe(true);
    expect(at(0.5 / rate).planted).toBe(true);
    expect(at(0.25 / rate).planted).toBe(false);
  });

  it('moves no more than 25 px between 60 fps frames at 132 BPM', () => {
    const frame = 132 / 3600; // beats per 60 fps frame
    for (let t = frame; t < 2; t += frame) {
      const a = at(t - frame), b = at(t);
      expect(Math.hypot(b.dx - a.dx, b.lift - a.lift)).toBeLessThan(25);
    }
  });
});
