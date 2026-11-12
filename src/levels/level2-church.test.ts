// Level 2's kindness rules (casual phone players): ±75 ms with ~10% to spare, beatable with big jumps only, every small
// obstacle clearable by any jump length, room around every action and every "don't jump", three Whey shields.
import { describe, expect, it } from 'vitest';
import { HAZARDS, HIGH_Y, OVERDRIVE, PHYS } from '../config';
import { solve } from '../sim/solver';
import type { HazardEvent } from '../types';
import { level2 as def } from './level2-church';

const hazards = def.chart.filter((e): e is HazardEvent => e.t === 'hazard');
const isHigh = (h: HazardEvent) => (h.b === 'static' || h.b === 'fly') && (h.y ?? 0) >= HIGH_Y;
const od = def.chart.flatMap((e) => (e.t === 'item' && e.kind === 'gelol' ? [[Math.floor(e.beat) + 1, Math.floor(e.beat) + 1 + OVERDRIVE.beats]] : []));
const smashed = (h: HazardEvent) => HAZARDS[h.kind].size === 'small' && od.some(([a, b]) => h.beat >= a && h.beat < b);
/** Obstacles that need a jump, in order (small ones inside a Gelol overdrive are just walked through). */
const jumps = hazards.filter((h) => !isHigh(h) && !smashed(h)).map((h) => h.beat).sort((a, b) => a - b);

describe('level church — kindness', () => {
  it('is beatable with ~10% more than its ±75 ms', () => {
    expect(solve(def, { marginMs: def.marginMs * 1.1 }).ok).toBe(true);
  });

  it('is beatable with big jumps only (the hop is optional, for coins)', () => {
    const minHold = PHYS.minHoldMs;
    PHYS.minHoldMs = Infinity; // releasing never cuts the rise
    try {
      expect(solve(def, { marginMs: def.marginMs }).ok).toBe(true);
    } finally {
      PHYS.minHoldMs = minHold;
    }
  });

  it('no hop-only traps: with the big obstacles left out, every forced hold from a tap to a full jump wins at ±75 ms', () => {
    const small = { ...def, chart: def.chart.filter((e) => e.t !== 'hazard' || isHigh(e) || HAZARDS[e.kind].size === 'small') };
    for (const holdTicks of [1, 24, 30, 45, 60]) expect(solve(small, { marginMs: def.marginMs, holdTicks }).ok, `hold ${holdTicks} ticks`).toBe(true);
  });

  it('leaves room: 2.25 beats between jumps (lands +0.5, 1.25 clear, presses −0.5), none in a section\'s first beat', () => {
    for (let i = 1; i < jumps.length; i++) expect(jumps[i] - jumps[i - 1], `jump at ${jumps[i]}`).toBeGreaterThanOrEqual(2.25);
    for (const s of def.sections) for (const j of jumps) expect(j - 0.5 >= s.beat && j - 0.5 < s.beat + 1, `jump at ${j} in ${s.name}`).toBe(false);
  });

  it('gives every dove and lantern 1.5 beats of nothing else on either side', () => {
    for (const h of hazards.filter(isHigh)) for (const j of jumps) expect(Math.abs(j - h.beat), `${h.kind}@${h.beat} vs jump at ${j}`).toBeGreaterThanOrEqual(2);
  });

  it('has three Whey shields and a sign before the first big obstacle', () => {
    expect(def.chart.filter((e) => e.t === 'item' && e.kind === 'whey').length).toBe(3);
    const firstBig = hazards.find((h) => HAZARDS[h.kind].size === 'big' && !isHigh(h))!;
    expect(def.chart.some((e) => e.t === 'cue' && e.cue === 'hint' && e.beat < firstBig.beat && e.beat > firstBig.beat - 4)).toBe(true);
  });
});
