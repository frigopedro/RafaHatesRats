// Beatability check and autoplay trace: a forward, layered sweep over input decisions.
// Every 1/8 beat each surviving state branches into "press / nothing" (button up) or "hold / release"
// (button down); children are de-duplicated on their exact physical state, so the frontier stays small.
import { TICKS_PER_BEAT as TPB } from '../config';
import type { InputFrame, Level, LevelDef, SimEvent, SimState } from '../types';
import { cloneState, compileLevel, createState, step } from './sim';

export const DECISION_TICKS = TPB / 8;

/** Button edge applied on the sim step that advances to `tick`. */
export interface TraceInput {
  tick: number;
  down: boolean;
}

export interface SolveResult {
  ok: boolean;
  inputs: TraceInput[]; // one winning input trace (empty when !ok)
  failBeat: number; // when !ok: beat at which the last surviving state died
  peak: number; // largest frontier seen (perf diagnostics)
}

interface Node {
  s: SimState;
  parent: number; // index in the previous layer
  act: number;
}
const NONE = 0, PRESS = 1, HOLD = 2, RELEASE = 3;
const FRAMES: InputFrame[] = [
  { pressed: false, released: false, held: false },
  { pressed: true, released: false, held: true },
  { pressed: false, released: false, held: true },
  { pressed: false, released: true, held: false },
];
const KEEP: InputFrame[] = [FRAMES[NONE], FRAMES[HOLD]];

/** Everything that changes what can happen next. Coins, taken items and smashed hazards are left out on purpose:
 *  x is monotonic, so whatever was taken or smashed is already behind both states. So are shield and pré-treino
 *  state: the solver treats a shield break as a death and never air-jumps. */
function key(s: SimState): string {
  const t = s.tick;
  const od = s.overdriveUntil * TPB > t ? `${s.overdriveFrom},${s.overdriveUntil}` : '';
  return `${s.y},${s.vy},${s.support},${+s.held},${s.cutDone ? -1 : s.jumpTicks},${s.coyote},${s.buffer},${od}`;
}

/** Only decisions that can change the outcome. Presses are tried only when they start a ground jump right away:
 *  buffered presses would start jumps off the 1/8-beat grid so the frontier never re-converges, and the pré-treino
 *  air jump is "never required" by design, so a proof must not use it. Holding only matters while the early-release
 *  cut can still shorten the rise. The solver may therefore miss some wins, never invent one. */
function actions(s: SimState): number[] {
  if (s.held) return s.cutDone ? [RELEASE] : [HOLD, RELEASE];
  return s.support >= 0 || s.coyote > 0 ? [NONE, PRESS] : [NONE];
}

export function solve(def: LevelDef, opts: { marginMs?: number; startBeat?: number } = {}): SolveResult {
  const L: Level = compileLevel(def, opts.marginMs ?? 0);
  let layer: Node[] = [{ s: createState(L, opts.startBeat), parent: -1, act: NONE }];
  const history: { parent: number; act: number; tick: number }[][] = [];
  let failTick = layer[0].s.tick;
  let peak = 1;

  while (layer.length) {
    const next = new Map<string, Node>();
    for (let i = 0; i < layer.length; i++) {
      const base = layer[i].s;
      for (const act of actions(base)) {
        const s = cloneState(base);
        for (let k = 0; k < DECISION_TICKS && !s.dead && !s.won; k++) {
          const ev = step(L, s, k === 0 ? FRAMES[act] : KEEP[+s.held]);
          // A proof must not lean on the Whey shield (it is optional), so a hit that breaks it counts as a death.
          for (let e = 0; e < ev.length; e++) if (ev[e].type === 'shieldBreak') s.dead = true;
        }
        if (s.dead) failTick = Math.max(failTick, s.tick);
        else if (s.won) {
          history.push(layer.map((n) => ({ parent: n.parent, act: n.act, tick: n.s.tick })));
          return { ok: true, inputs: trace(history, i, act, base.tick), failBeat: NaN, peak };
        } else {
          const k = key(s);
          if (!next.has(k)) next.set(k, { s, parent: i, act });
        }
      }
    }
    history.push(layer.map((n) => ({ parent: n.parent, act: n.act, tick: n.s.tick })));
    layer = [...next.values()];
    peak = Math.max(peak, layer.length);
  }
  return { ok: false, inputs: [], failBeat: failTick / TPB, peak };
}

function trace(history: { parent: number; act: number; tick: number }[][], idx: number, act: number, tick: number): TraceInput[] {
  const out: TraceInput[] = [];
  // Walk back from the winning decision; a decision taken at layer tick T is applied on the step to T + 1.
  for (let l = history.length - 1; l >= 0; l--) {
    if (act === PRESS || act === RELEASE) out.push({ tick: tick + 1, down: act === PRESS });
    const n = history[l][idx];
    if (l === 0) break;
    act = n.act;
    idx = n.parent;
    tick = history[l - 1][idx].tick;
  }
  return out.reverse();
}

/** Plays a trace in the plain sim (margin 0) and returns the final state; `onEvents` sees every tick's events. */
export function replay(def: LevelDef, inputs: TraceInput[], onEvents?: (e: SimEvent[]) => void): SimState {
  const L = compileLevel(def);
  const s = createState(L);
  let i = 0;
  while (!s.dead && !s.won) {
    let pressed = false, released = false, held = s.held;
    for (; i < inputs.length && inputs[i].tick <= s.tick + 1; i++) {
      if (inputs[i].down) (pressed = true), (held = true);
      else (released = true), (held = false);
    }
    const ev = step(L, s, { pressed, released, held });
    onEvents?.(ev);
  }
  return s;
}
