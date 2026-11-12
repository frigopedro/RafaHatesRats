// Level 3's kindness rules (casual phone players): ±55 ms with ~10% to spare, beatable with big jumps only, every small
// obstacle clearable by any jump length, room around every action and every "don't jump", three Whey shields.
import { describe, expect, it } from 'vitest';
import { HAZARDS, HIGH_Y, OVERDRIVE, PHYS, TICKS_PER_BEAT as TPB } from '../config';
import { hazardPos } from '../sim/behaviors';
import { replay, solve } from '../sim/solver';
import type { HazardEvent } from '../types';
import { level3 as def } from './level3-party';

const hazards = def.chart.filter((e): e is HazardEvent => e.t === 'hazard');
const isHigh = (h: HazardEvent) => (h.b === 'static' || h.b === 'fly') && (h.y ?? 0) >= HIGH_Y;
const od = def.chart.flatMap((e) => (e.t === 'item' && e.kind === 'gelol' ? [Math.floor(e.beat) + 1] : []));
const smashed = (h: HazardEvent) => HAZARDS[h.kind].size === 'small' && od.some((a) => h.beat >= a && h.beat < a + 2 * OVERDRIVE.beats);
const offWhenMet = (h: HazardEvent) => h.b === 'pulse' && !hazardPos(h, h.beat, def.blocksPerBeat, { x: 0, y: 0, on: false }).on;
/** Obstacles that need a jump, in order (smashed small ones, fountains met between bursts and high ones don't). */
const jumps = hazards.filter((h) => !isHigh(h) && !smashed(h) && !offWhenMet(h)).map((h) => h.beat).sort((a, b) => a - b);

describe('level party — kindness', () => {
  it('is beatable with ~10% more than its ±55 ms', () => {
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

  it('every small obstacle, alone, clears with any hold from a tap to a full jump with ±55 ms of slack', () => {
    const need = 2 * Math.ceil((def.marginMs / 1000) * (def.bpm / 60) * TPB) + 1; // ticks of consecutive good presses
    const kinds = new Set(hazards.filter((q) => HAZARDS[q.kind].size === 'small' && !smashed(q)).map((q) => JSON.stringify({ ...q, beat: 4 })));
    for (const k of kinds) { // each distinct obstacle once
      const h = JSON.parse(k) as HazardEvent, alone = { ...def, sections: [], chart: [h], lengthBeats: 7 };
      for (const hold of [0, 0.2, 0.3, 0.4, 0.5]) {
        let run = 0, best = 0;
        for (let p = 2.5 * TPB; p <= 4 * TPB; p++) {
          const ok = replay(alone, [{ tick: p, down: true }, { tick: p + Math.max(1, Math.round(hold * TPB)), down: false }]).won;
          best = Math.max(best, (run = ok ? run + 1 : 0));
        }
        expect(best, `${h.kind} (${h.b}), hold ${hold} beat`).toBeGreaterThanOrEqual(need);
      }
    }
  });

  it('leaves room: 2 beats between jumps (lands +0.5, a beat of clear floor, presses −0.5), none in a section\'s first beat', () => {
    for (let i = 1; i < jumps.length; i++) expect(jumps[i] - jumps[i - 1], `jump at ${jumps[i]}`).toBeGreaterThanOrEqual(2);
    for (const s of def.sections) for (const j of jumps) expect(j - 0.5 >= s.beat && j - 0.5 < s.beat + 1, `jump at ${j} in ${s.name}`).toBe(false);
  });

  it('gives every balloon bunch and web line 1.25 beats of floor from any jump on either side', () => {
    for (const h of hazards.filter(isHigh)) for (const j of jumps) expect(Math.abs(j - h.beat), `${h.kind}@${h.beat} vs jump at ${j}`).toBeGreaterThanOrEqual(1.75);
  });

  it('has three Whey shields (main, bossEnter, boss3) and a sign before the first big obstacle', () => {
    const at = (b: number) => [...def.sections].reverse().find((s) => s.beat <= b)!.name;
    expect(def.chart.flatMap((e) => (e.t === 'item' && e.kind === 'whey' ? [at(e.beat)] : []))).toEqual(['main', 'bossEnter', 'boss3']);
    const firstBig = hazards.find((h) => HAZARDS[h.kind].size === 'big' && !isHigh(h) && !offWhenMet(h))!;
    expect(def.chart.some((e) => e.t === 'cue' && e.cue === 'hint' && e.beat < firstBig.beat && e.beat > firstBig.beat - 4)).toBe(true);
  });
});
