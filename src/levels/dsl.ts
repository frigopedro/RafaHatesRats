// Small helpers so a chart reads like a beat sheet. Every `beat` is when Rafa meets the thing.
import { BOSS_AHEAD, ITEM_SIZE, PLAYER, TICKS_PER_BEAT as TPB } from '../config';
import { releaseBeat } from '../sim/behaviors';
import { jumpCurve } from '../sim/sim';
import type { ChartEvent, HazardEvent, HazardKind, HazardMotion, ItemEvent, ItemKind, PlatformEvent } from '../types';

export const hz = (beat: number, kind: HazardKind, motion: HazardMotion = { b: 'static' }): HazardEvent =>
  ({ t: 'hazard', beat, kind, ...motion }) as HazardEvent;

/** Item whose box sits on the ground (or at height y). */
export const item = (beat: number, kind: ItemKind, y = 0): ItemEvent => ({ t: 'item', beat, kind, y });

export const platform = (beat: number, len: number, y: number, move?: PlatformEvent['move']): PlatformEvent =>
  ({ t: 'platform', beat, len, y, ...(move && { move }) });

export const hint = (beat: number, text: string): ChartEvent => ({ t: 'cue', beat, cue: 'hint', text });
export const bossEnter = (beat: number): ChartEvent => ({ t: 'cue', beat, cue: 'bossEnter' });
export const bossExit = (beat: number): ChartEvent => ({ t: 'cue', beat, cue: 'bossExit' });

/** `n` repeats of `f`, `every` beats apart, starting at `from`. */
export const rep = (from: number, every: number, n: number, f: (beat: number, i: number) => ChartEvent | ChartEvent[]) =>
  Array.from({ length: n }, (_, i) => f(from + i * every, i)).flat();

/** Boss attack: the hazard plus its telegraph cue `warn` beats before the boss releases it (see releaseBeat).
 *  The boss view pairs the cue with the first hazard of the attack's kind released at or after the cue. */
export const attack = (h: HazardEvent, name: string, warn = 1, bpb = 4): ChartEvent[] =>
  [{ t: 'cue', beat: releaseBeat(h, bpb, BOSS_AHEAD) - warn, cue: 'bossAttack', attack: name }, h];

/** A boss move with no hazard (e.g. a taunt between phases). */
export const bossMove = (beat: number, name: string): ChartEvent => ({ t: 'cue', beat, cue: 'bossAttack', attack: name });

/** `n` golden dumbbells on the exact arc of a jump pressed at `pressBeat` and held `holdBeats` (0 = tap),
 *  centred on Rafa's body so following the arc collects them all. */
export function coinArc(pressBeat: number, holdBeats: number, n: number): ItemEvent[] {
  const ys = jumpCurve(Math.round(holdBeats * TPB));
  return Array.from({ length: n }, (_, i) => {
    const k = Math.round(((i + 1) / (n + 1)) * (ys.length - 1));
    return item(pressBeat + k / TPB, 'coin', ys[k] + (PLAYER.h - ITEM_SIZE) / 2);
  });
}

/** A straight line of `n` coins at height y, `every` beats apart. */
export const coinLine = (from: number, every: number, n: number, y: number): ItemEvent[] =>
  rep(from, every, n, (b) => item(b, 'coin', y)) as ItemEvent[];
