// The gym run rig must not skate: a planted foot moves back at the floor's speed (so it stays put in the world),
// it touches down on the beat and the half-beat, and no joint jumps between 60 fps frames.
import { describe, expect, it } from 'vitest';
import { RAFA_GAIT, runPose } from './rafaGym';

// Thigh/shin bone lengths written to public/art/rafagym.json by scripts/slice-sheet.mjs.
const RIGS = [
  ['Rafa', RAFA_GAIT, 28.43, 28.43, 1], ['Rafa (Gelol)', RAFA_GAIT, 28.43, 28.43, 1.5],
] as const;
const GROUND = 384; // px per beat

describe.each(RIGS)('%s run rig', (_name, gait, L1, L2, cadence) => {
  const dt = 1 / 30 / 8; // 1/8 of a 60 fps frame at 120 BPM, in beats
  const poses = Array.from({ length: Math.round(1 / dt) + 1 }, (_, i) => runPose(i * dt * cadence, cadence, L1, L2, 0, gait));

  it('keeps a planted foot within 10% of the floor speed', () => {
    let worst = 0, planted = 0;
    for (let i = 1; i < poses.length; i++) for (const k of [0, 1]) {
      const a = poses[i - 1].legs[k], b = poses[i].legs[k];
      if (!a.planted || !b.planted) continue;
      planted++;
      const world = (p: typeof a, t: number) => p.ankle[0] + GROUND * t; // hip moves forward with the floor scroll
      worst = Math.max(worst, Math.abs(world(b, i * dt) - world(a, (i - 1) * dt)) / (GROUND * dt));
      expect(b.ankle[1]).toBeCloseTo(gait.ankleY, 5); // flat on the floor
    }
    expect(planted).toBeGreaterThan(0);
    expect(worst).toBeLessThan(0.1);
  });

  it('strikes on the beat and the half-beat, with a flight phase between', () => {
    const at = (t: number) => runPose(t * cadence, cadence, L1, L2, 0, gait).legs;
    expect(at(0)[0].planted).toBe(true);
    expect(at(0.5 / cadence)[1].planted).toBe(true);
    expect(at(0.25 / cadence).some((l) => l.planted)).toBe(false);
  });

  it('moves no joint more than 30 px between 60 fps frames', () => {
    for (let i = 8; i < poses.length; i += 8) for (const k of [0, 1]) {
      const a = poses[i - 8].legs[k], b = poses[i].legs[k];
      for (const key of ['knee', 'ankle'] as const) {
        expect(Math.hypot(b[key][0] - a[key][0], b[key][1] - a[key][1])).toBeLessThan(30);
      }
    }
  });
});
