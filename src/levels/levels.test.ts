import { describe, expect, it } from 'vitest';
import { PHYS } from '../config';
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
  it('needs the hop: with every jump a full big jump it is not beatable', () => {
    const minHold = PHYS.minHoldTicks;
    PHYS.minHoldTicks = Infinity; // releasing never cuts the rise
    try {
      expect(solve(def, { marginMs: def.marginMs }).ok).toBe(false);
    } finally {
      PHYS.minHoldTicks = minHold;
    }
  });
  it('needs the big jump: with no jump bigger than a hop it is not beatable', () => {
    const v = PHYS.jumpVel;
    PHYS.jumpVel = 10.3; // uncut apex ≈ 2.2 blocks and a bit more airtime than a real hop, so this only over-helps
    try {
      expect(solve(def, { marginMs: def.marginMs }).ok).toBe(false);
    } finally {
      PHYS.jumpVel = v;
    }
  });
});
