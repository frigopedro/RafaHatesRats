import { describe, expect, it } from 'vitest';
import { PHYS, TICKS_PER_BEAT as TPB } from '../config';
import type { ChartEvent, HazardEvent, LevelDef, SimEvent, SimState } from '../types';
import { hazardPos, type Pos } from './behaviors';
import { compileLevel, createState, jumpCurve, step } from './sim';

const level = (chart: ChartEvent[], ground: [number, number][] = [[-10, 100]]): LevelDef => ({
  id: 99, name: 't', theme: 'gym', rafa: 'wheelchair', bpm: 120, blocksPerBeat: 4, lengthBeats: 40,
  songId: '', marginMs: 0, sections: [], ground, chart,
});

/** Runs until `untilBeat` (or death/win) pressing at the given ticks; holds for `hold` ticks each. */
function run(def: LevelDef, presses: number[], untilBeat: number, hold = 0) {
  const L = compileLevel(def);
  const s = createState(L);
  const events: SimEvent[] = [];
  while (s.tick < untilBeat * TPB && !s.dead && !s.won) {
    const next = s.tick + 1;
    const pressed = presses.includes(next);
    const held = presses.some((p) => next >= p && next < p + hold);
    events.push(...step(L, s, { pressed, released: false, held }));
  }
  return { s, events, types: events.map((e) => e.type) };
}

const airtime = (ys: number[]) => ys.length / TPB;

describe('jump physics vs tuning table', () => {
  it('big jump (held): 1 beat airtime, 3 blocks apex, 4 blocks long', () => {
    const ys = jumpCurve(TPB);
    expect(airtime(ys)).toBeCloseTo(1, 1);
    expect(Math.max(...ys)).toBeCloseTo(3, 1);
    expect(airtime(ys) * 4).toBeCloseTo(4, 0);
  });
  it('hop (tap): ~0.78 beat, ~3.1 blocks long, ~2.2 blocks apex — clearly lower and shorter than the big jump', () => {
    const ys = jumpCurve(0);
    expect(airtime(ys)).toBeCloseTo(0.78, 1);
    expect(airtime(ys) * 4).toBeCloseTo(3.1, 0);
    expect(Math.max(...ys)).toBeGreaterThan(2.1);
    expect(Math.max(...ys)).toBeLessThan(2.3);
  });
  it('any tap shorter than the minimum hold gives the same hop; longer holds go higher', () => {
    expect(jumpCurve(PHYS.minHoldTicks - 1)).toEqual(jumpCurve(0));
    expect(Math.max(...jumpCurve(PHYS.minHoldTicks + 12))).toBeGreaterThan(Math.max(...jumpCurve(0)) + 0.2);
  });
});

describe('buffer and coyote (ticks)', () => {
  const landing = jumpCurve(0).length; // tick index of landing after a press at tick 1
  it('a press within the buffer before landing jumps on the landing tick', () => {
    const { events } = run(level([]), [1, landing - PHYS.bufferTicks + 2], 3);
    const jumps = events.filter((e) => e.type === 'jump');
    const land = events.find((e) => e.type === 'land')!;
    expect(jumps).toHaveLength(2);
    expect(jumps[1].tick).toBe(land.tick);
  });
  it('a press earlier than the buffer is dropped', () => {
    const { events } = run(level([]), [1, landing - PHYS.bufferTicks - 5], 3);
    expect(events.filter((e) => e.type === 'jump')).toHaveLength(1);
  });
  // Ground ends at beat 5 (x=20); Rafa's box leaves it at x=20.35, i.e. tick 611.
  const ledge = level([], [[-10, 5], [5.75, 100]]); // 3-block hole
  const leave = Math.ceil(((5 + 0.35 / 4) * TPB));
  it('coyote: a press shortly after leaving the edge is still a ground jump', () => {
    const { s, events } = run(ledge, [leave + PHYS.coyoteTicks - 2], 9, TPB);
    expect(events.find((e) => e.type === 'jump')).toMatchObject({ air: false });
    expect(s.dead).toBe(false);
  });
  it('after coyote time the press is only buffered and she falls in the hole', () => {
    const { s, events } = run(ledge, [leave + PHYS.coyoteTicks + 3], 9, TPB);
    expect(events.some((e) => e.type === 'jump')).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: 'death', cause: 'hole' });
    expect(s.dead).toBe(true);
  });
});

describe('hazard behaviours are pure functions of the beat', () => {
  const pos = (h: HazardEvent, beat: number): Pos => hazardPos(h, beat, 4, { x: 0, y: 0, on: false });
  const H = (m: object) => ({ t: 'hazard', beat: 10, kind: 'rat', ...m }) as HazardEvent;
  it('static sits at its beat', () => expect(pos(H({ b: 'static', y: 2 }), 3)).toEqual({ x: 40, y: 2, on: true }));
  it('drop lands `lead` beats before Rafa arrives and is absent before falling', () => {
    const h = H({ b: 'drop', lead: 1, from: 12 });
    expect(pos(h, 7.9).on).toBe(false);
    expect(pos(h, 8.5)).toMatchObject({ x: 40, on: true });
    expect(pos(h, 8.5).y).toBeGreaterThan(0);
    expect(pos(h, 9).y).toBe(0);
    expect(pos(h, 10).y).toBe(0);
  });
  it('run reaches its spot exactly on its beat, coming from ahead', () => {
    const h = H({ b: 'run', speed: 2 });
    expect(pos(h, 10)).toEqual({ x: 40, y: 0, on: true });
    expect(pos(h, 9).x).toBe(42);
  });
  it('bounce touches the ground on its beat with phase 0, peaks half a period later', () => {
    const h = H({ b: 'bounce', speed: 1, height: 2, period: 1 });
    expect(pos(h, 10).y).toBe(0);
    expect(pos(h, 10.5).y).toBeCloseTo(2);
    expect(pos(h, 9).x).toBe(41);
  });
  it('lob is thrown from ahead and lands on its spot `lead` beats early', () => {
    const h = H({ b: 'lob', lead: 1, flight: 1, dx: 6, dy: 4 });
    expect(pos(h, 7.9).on).toBe(false);
    expect(pos(h, 8)).toMatchObject({ x: 46, y: 4, on: true });
    expect(pos(h, 8.5).x).toBe(43);
    expect(pos(h, 9)).toEqual({ x: 40, y: 0, on: true });
  });
  it('fly keeps its height and closes in', () => {
    const h = H({ b: 'fly', y: 1.8, speed: 3 });
    expect(pos(h, 9)).toEqual({ x: 43, y: 1.8, on: true });
  });
  it('pulse is on for `on` beats of every period', () => {
    const h = H({ b: 'pulse', period: 2, on: 1, phase: 0 });
    expect(pos(h, 10.5).on).toBe(true);
    expect(pos(h, 11.5).on).toBe(false);
    expect(pos(h, 12.2).on).toBe(true);
  });
  it('a pulse hazard only kills while on', () => {
    const flame = (phase: number): ChartEvent => ({ t: 'hazard', beat: 4, kind: 'flame', b: 'pulse', period: 2, on: 1, phase });
    expect(run(level([flame(0)]), [], 6).s.dead).toBe(true);
    expect(run(level([flame(0.5)]), [], 6).s.dead).toBe(false); // off during [3.5, 4.5)
  });
});

describe('collisions and items', () => {
  const dumbbell: ChartEvent = { t: 'hazard', beat: 4, kind: 'dumbbell', b: 'static' };
  it('a small hazard kills when not jumped, a hop clears it', () => {
    expect(run(level([dumbbell]), [], 6).events.at(-1)).toMatchObject({ type: 'death', cause: 'dumbbell' });
    expect(run(level([dumbbell]), [Math.round(3.65 * TPB)], 6).s.dead).toBe(false);
  });
  it('a big hazard needs the big jump: a hop has no ±60 ms window over it, a big jump does', () => {
    const rack: ChartEvent = { t: 'hazard', beat: 4, kind: 'plateRack', b: 'static' };
    const slack = Math.round(0.12 * TPB); // 60 ms at 120 BPM
    const survives = (hold: number) => {
      const ok = new Set<number>();
      for (let p = 2 * TPB; p < 4 * TPB; p++) if (!run(level([rack]), [p], 6, hold).s.dead) ok.add(p);
      return [...ok].some((p) => ok.has(p - slack) && ok.has(p + slack));
    };
    expect(survives(0)).toBe(false);
    expect(survives(TPB)).toBe(true);
  });
  it('a high hazard kills a jump but not Rafa on the ground', () => {
    const bag: ChartEvent = { t: 'hazard', beat: 4, kind: 'bag', b: 'static', y: 1.8 };
    expect(run(level([bag]), [], 6).s.dead).toBe(false);
    expect(run(level([bag]), [Math.round(3.6 * TPB)], 6).s.dead).toBe(true);
  });
  it('Whey: one hit breaks the shield, 1 beat of invulnerability, then hits kill again', () => {
    const chart: ChartEvent[] = [
      { t: 'item', beat: 2, kind: 'whey', y: 0 }, dumbbell,
      { t: 'hazard', beat: 4.5, kind: 'bottle', b: 'static' }, // inside the invulnerable beat
      { t: 'hazard', beat: 6, kind: 'bottle', b: 'static' },
    ];
    const { s, types } = run(level(chart), [], 8);
    expect(types).toEqual(['pickup', 'shieldBreak', 'death']);
    expect(s.tick / TPB).toBeGreaterThan(5.8);
  });
  it('Gelol: overdrive from the next whole beat for 12 beats, smashes small hazards, not big ones', () => {
    const chart: ChartEvent[] = [
      { t: 'item', beat: 2.3, kind: 'gelol', y: 0 },
      { t: 'hazard', beat: 5, kind: 'rat', b: 'run', speed: 2 },
      { t: 'hazard', beat: 6, kind: 'kettlebell', b: 'static' },
      { t: 'hazard', beat: 8, kind: 'bench', b: 'static' },
    ];
    const { s, events, types } = run(level(chart), [], 10);
    expect(s.overdriveFrom).toBe(3);
    expect(s.overdriveUntil).toBe(15);
    expect(events.find((e) => e.type === 'overdriveOn')?.tick).toBe(3 * TPB);
    expect(types).toEqual(['pickup', 'overdriveOn', 'smash', 'smash', 'death']);
    expect(events.at(-1)).toMatchObject({ cause: 'bench' });
  });
  it('overdrive ends after 12 beats; a second Gelol while active extends it', () => {
    const one = run(level([{ t: 'item', beat: 2.3, kind: 'gelol', y: 0 }]), [], 20);
    expect(one.events.find((e) => e.type === 'overdriveOff')?.tick).toBe(15 * TPB);
    const two = run(level([{ t: 'item', beat: 2.3, kind: 'gelol', y: 0 }, { t: 'item', beat: 9.5, kind: 'gelol', y: 0 }]), [], 25);
    expect([two.s.overdriveFrom, two.s.overdriveUntil]).toEqual([3, 22]);
    expect(two.types.filter((t) => t === 'overdriveOn' || t === 'overdriveOff')).toEqual(['overdriveOn', 'overdriveOff']);
  });
  it('Pré-treino: one mid-air jump per airtime, only while active', () => {
    const pre: ChartEvent = { t: 'item', beat: 1, kind: 'pre', y: 0 };
    const t0 = 2 * TPB;
    const air = run(level([pre]), [t0, t0 + 30, t0 + 40], 4).events.filter((e) => e.type === 'jump');
    expect(air.map((e) => (e as { air: boolean }).air)).toEqual([false, true]);
    const none = run(level([]), [t0, t0 + 30], 4).events.filter((e) => e.type === 'jump');
    expect(none).toHaveLength(1);
  });
  it('coins are counted and each is taken once', () => {
    const coins: ChartEvent[] = [2, 2.1, 3].map((beat) => ({ t: 'item', beat, kind: 'coin', y: 0.3 }));
    expect(run(level(coins), [], 5).s.coins).toBe(3);
  });
});

describe('ground holes and platforms', () => {
  it('a big jump crosses a 4-block hole; rolling into it is death', () => {
    const def = level([], [[-10, 5], [6, 100]]);
    expect(run(def, [], 8).events.at(-1)).toMatchObject({ type: 'death', cause: 'hole' });
    expect(run(def, [Math.round(4.9 * TPB)], 8, TPB).s.dead).toBe(false);
  });
  it('a narrow gap smaller than the hitbox is not a hole', () => {
    expect(run(level([], [[-10, 5], [5.1, 100]]), [], 8).s.dead).toBe(false);
  });
  const plat = (move?: { dx: number; dy: number; period: number }): ChartEvent => ({ t: 'platform', beat: 4, len: 3, y: 2, ...(move && { move }) });
  const onPlatform = (s: SimState) => s.support === 1;
  it('one-way platform: land on it from above', () => {
    const { s } = run(level([plat()]), [Math.round(3.5 * TPB)], 5.5, TPB);
    expect(onPlatform(s)).toBe(true);
    expect(s.y).toBe(2);
  });
  it('one-way platform: jump through it from below', () => {
    const { s, events } = run(level([plat()]), [Math.round(4.2 * TPB)], 4.6, TPB);
    expect(events.filter((e) => e.type === 'land')).toHaveLength(0);
    expect(s.y).toBeGreaterThan(2);
  });
  it('walking off a platform falls back to the ground', () => {
    const { s } = run(level([plat()]), [Math.round(3.5 * TPB)], 9, TPB);
    expect(s.support).toBe(0);
    expect(s.dead).toBe(false);
  });
  it('a moving platform carries Rafa with it', () => {
    const def = level([plat({ dx: 0, dy: 1, period: 2 })]);
    const L = compileLevel(def);
    const s = createState(L);
    const ys: number[] = [];
    while (s.tick < 6.5 * TPB) {
      const t = s.tick + 1;
      step(L, s, { pressed: t === Math.round(3.4 * TPB), released: false, held: t < 3.4 * TPB + TPB });
      if (s.support === 1) ys.push(s.y);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.5);
  });
});

describe('level validation', () => {
  it('rejects bad charts at the boundary', () => {
    expect(() => compileLevel(level([{ t: 'hazard', beat: 4, kind: 'rat', b: 'run', speed: -1 }]))).toThrow(/speed/);
    expect(() => compileLevel(level([{ t: 'hazard', beat: NaN, kind: 'rat', b: 'static' }]))).toThrow(/finite/);
    expect(() => compileLevel(level([], [[5, 2]]))).toThrow(/ground/);
  });
});
