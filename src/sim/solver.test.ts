import { describe, expect, it } from 'vitest';
import type { ChartEvent, LevelDef } from '../types';
import { replay, solve } from './solver';

const level = (chart: ChartEvent[]): LevelDef => ({
  id: 98, name: 't', theme: 'gym', rafa: 'wheelchair', bpm: 120, blocksPerBeat: 4, lengthBeats: 16,
  songId: '', marginMs: 60, sections: [], ground: [[-4, 20]], chart,
});

describe('solver', () => {
  it('finds a trace that wins when replayed in the plain sim', () => {
    const def = level([
      { t: 'hazard', beat: 4, kind: 'dumbbell', b: 'static' },
      { t: 'hazard', beat: 7, kind: 'bench', b: 'static' },
      { t: 'hazard', beat: 9, kind: 'bag', b: 'static', y: 1.8 },
      { t: 'hazard', beat: 11, kind: 'rat', b: 'run', speed: 3 },
    ]);
    const r = solve(def, { marginMs: 60 });
    expect(r.ok).toBe(true);
    expect(r.inputs.length).toBeGreaterThan(0);
    expect(replay(def, r.inputs).won).toBe(true);
  });

  it('reports an impossible chart as unbeatable, with the beat where the last survivor died', () => {
    // A plate rack with two bags stacked on it: a wall taller than the big jump's apex.
    const def = level([
      { t: 'hazard', beat: 6, kind: 'plateRack', b: 'static' },
      { t: 'hazard', beat: 6, kind: 'bag', b: 'static', y: 1.2 },
      { t: 'hazard', beat: 6, kind: 'bag', b: 'static', y: 2.2 },
    ]);
    const r = solve(def);
    expect(r.ok).toBe(false);
    expect(r.failBeat).toBeGreaterThan(5);
    expect(r.failBeat).toBeLessThan(6.5);
  });

  it('timing margin: a gap that needs pixel-perfect timing fails at ±60 ms but passes at 0', () => {
    // Small hazard 1 beat after a plate rack: the big jump's landing leaves almost no room for the next hop.
    const def = level([
      { t: 'hazard', beat: 6, kind: 'plateRack', b: 'static' },
      { t: 'hazard', beat: 6.95, kind: 'kettlebell', b: 'static' },
    ]);
    expect(solve(def, { marginMs: 0 }).ok).toBe(true);
    expect(solve(def, { marginMs: 60 }).ok).toBe(false);
  });
});
