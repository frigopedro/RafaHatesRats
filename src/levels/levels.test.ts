import { describe, expect, it } from 'vitest';
import { HIGH_Y, PHYS, TICKS_PER_BEAT as TPB } from '../config';
import { replay, solve } from '../sim/solver';
import { LEVELS } from './index';

describe.each(LEVELS)('level $id — $name', (def) => {
  const r = solve(def, { marginMs: def.marginMs });
  it(`is beatable with ±${def.marginMs} ms of timing slack`, () => {
    expect(r.ok, `last survivor died at beat ${r.failBeat}`).toBe(true);
  });
  it('the trace wins in the real sim without leaning on the Whey shield', () => {
    let shieldBreaks = 0;
    const s = replay(def, r.inputs, (ev) => (shieldBreaks += ev.filter((e) => e.type === 'shieldBreak').length));
    expect(s.won).toBe(true);
    expect(shieldBreaks).toBe(0);
  });
  // Levels 1–3's kindness rules make the hop optional; level1-gym/level2-church/level3-party.test.ts prove they are
  // beatable with big jumps only.
  it('needs the big jump: with no jump bigger than a hop it is not beatable', () => {
    const v = PHYS.jumpVel;
    PHYS.jumpVel = 10.3; // uncut apex ≈ 2.2 blocks and a bit more airtime than a real hop, so this only over-helps
    try {
      expect(solve(def, { marginMs: def.marginMs }).ok).toBe(false);
    } finally {
      PHYS.jumpVel = v;
    }
  });
  it('has a high hazard that forbids jumping: alone, walking under it is safe and any jump under it is a hit', () => {
    const high = def.chart.filter((e) => e.t === 'hazard' && (e.b === 'static' || e.b === 'fly') && (e.y ?? 0) >= HIGH_Y);
    const forbids = high.filter((h) => {
      const alone = { ...def, sections: [], chart: [h], lengthBeats: h.beat + 2 };
      const jumpAt = (beat: number, hold: number) => [{ tick: Math.round(beat * TPB), down: true }, { tick: Math.round((beat + hold) * TPB), down: false }];
      return replay(alone, []).won && [-0.3, -0.2, -0.1].every((d) => [0.05, 0.5].every((hold) => replay(alone, jumpAt(h.beat + d, hold)).dead));
    });
    expect(forbids.length).toBeGreaterThan(0);
  });
});
