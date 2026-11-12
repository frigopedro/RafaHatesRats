// Level 1 is the casual on-ramp. These are its kindness rules, so a chart edit can't quietly make it hard again.
import { describe, expect, it } from 'vitest';
import { HAZARDS, HIGH_Y, PHYS } from '../config';
import { solve } from '../sim/solver';
import type { HazardEvent, ItemEvent } from '../types';
import { level1 as def } from './level1-gym';

const hazards = def.chart.filter((e): e is HazardEvent => e.t === 'hazard').sort((a, b) => a.beat - b.beat);
const isHigh = (h: HazardEvent) => (h.b === 'static' || h.b === 'fly') && (h.y ?? 0) >= HIGH_Y;
const section = (beat: number) => [...def.sections].reverse().find((s) => s.beat <= beat)!.name;
// Things the player must react to: everything except what Gelol smashes in the corridor and finale.
const actions = hazards.filter((h) => !(['gelol', 'finale'].includes(section(h.beat)) && HAZARDS[h.kind].size === 'small'));

describe('level 1 — kindness rules', () => {
  it('passes at ±110 ms with 10% to spare', () => {
    expect(def.marginMs).toBe(110);
    expect(solve(def, { marginMs: 121 }).ok).toBe(true);
  });

  it('is beatable holding every jump (the full jump is always safe)', () => {
    const minHold = PHYS.minHoldTicks;
    PHYS.minHoldTicks = Infinity; // releasing never cuts the rise
    try {
      expect(solve(def, { marginMs: def.marginMs }).ok).toBe(true);
    } finally {
      PHYS.minHoldTicks = minHold;
    }
  });

  it.each([15, 30, 45])('sloppy in-between jumps are safe: every jump held %i ticks still wins at ±60 ms', (hold) => {
    expect(solve(def, { marginMs: 60, holdTicks: hold }).ok).toBe(true);
  });

  it('has nothing wider than 1.2 blocks', () => {
    for (const h of hazards) expect(HAZARDS[h.kind].w, `${h.kind}@${h.beat}`).toBeLessThanOrEqual(1.2);
  });

  it('leaves time to read: 2 beats between actions (1.5 in the fight), none in the first beat of a section', () => {
    for (let i = 1; i < actions.length; i++) {
      const gap = actions[i].beat - actions[i - 1].beat;
      const min = section(actions[i].beat).startsWith('boss') ? 1.5 : 2;
      expect(gap, `${actions[i - 1].kind}@${actions[i - 1].beat} → ${actions[i].kind}@${actions[i].beat}`).toBeGreaterThanOrEqual(min + 0.5);
    }
    for (const s of def.sections) for (const h of actions) expect(h.beat >= s.beat && h.beat < s.beat + 1, `${h.kind}@${h.beat}`).toBe(false);
  });

  it('has at most six "stay down" moments, each alone for 2 beats, the first of each kind behind "NÃO PULE!"', () => {
    const high = actions.filter(isHigh);
    expect(high.length).toBeLessThanOrEqual(6);
    for (const h of high) for (const o of actions) if (o !== h) expect(Math.abs(o.beat - h.beat), `${h.kind}@${h.beat} vs ${o.kind}@${o.beat}`).toBeGreaterThan(2);
    const signs = def.chart.filter((e) => e.t === 'cue' && e.cue === 'hint' && e.text === 'NÃO PULE!').map((e) => e.beat);
    for (const kind of new Set(high.map((h) => h.kind))) {
      const first = high.find((h) => h.kind === kind)!;
      expect(signs.some((b) => b < first.beat && first.beat - b <= 4), `sign before the first ${kind}`).toBe(true);
    }
  });

  it('announces the big jump and never asks for it more than once per 4 beats before the boss', () => {
    const big = actions.filter((h) => !isHigh(h) && HAZARDS[h.kind].size === 'big' && h.beat < 80);
    const segure = def.chart.find((e) => e.t === 'cue' && e.cue === 'hint' && e.text === 'SEGURE!')!;
    expect(segure.beat).toBeLessThan(big[0].beat);
    for (let i = 1; i < big.length; i++) expect(big[i].beat - big[i - 1].beat).toBeGreaterThanOrEqual(4);
  });

  it('gives three Whey shields: early in main, at the boss entrance, in boss 3', () => {
    const whey = def.chart.filter((e): e is ItemEvent => e.t === 'item' && e.kind === 'whey').map((e) => section(e.beat));
    expect(whey).toEqual(['main', 'bossEnter', 'boss3']);
  });
});
