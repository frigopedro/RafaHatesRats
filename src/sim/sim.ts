// Deterministic rhythm-runner simulation. Pure TS: no Phaser, no DOM, no randomness.
// One step = one tick = 1/120 beat. Rafa's x is always beat × blocksPerBeat, so only y is simulated.
import {
  HAZARDS, HURT_INVULN_TICKS, ITEM_SIZE, OVERDRIVE, PHYS, PLAYER, PRE_TICKS, SHIELD_INVULN_TICKS, TICKS_PER_BEAT as TPB,
} from '../config';
import type { CueEvent, InputFrame, Level, LevelDef, SimEvent, SimState } from '../types';
import { hazardPos, hazardSpeed, platformOffset, type Pos } from './behaviors';

const DT = 1 / TPB;
const EPS = 1e-9;
const HALF_W = PLAYER.w / 2;

const fail = (def: LevelDef, msg: string): never => {
  throw new Error(`level ${def.id}: ${msg}`);
};
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Validates a LevelDef and prepares it for the sim. `marginMs` widens every hazard by the distance Rafa
 *  (relative to that hazard) covers in that time, so a run that survives proves ±marginMs of timing slack. */
export function compileLevel(def: LevelDef, marginMs = 0): Level {
  if (!(def.bpm > 0 && def.blocksPerBeat > 0 && def.lengthBeats > 0)) fail(def, 'bpm, blocksPerBeat, lengthBeats must be > 0');
  if (!(marginMs >= 0)) fail(def, 'marginMs must be >= 0');
  const bpb = def.blocksPerBeat;
  const marginBeats = (marginMs / 1000) * (def.bpm / 60);
  const byBeat = <T extends { beat: number }>(a: T[]) => a.sort((p, q) => p.beat - q.beat);

  const hazards = byBeat(def.chart.flatMap((e) => (e.t === 'hazard' ? [e] : [])));
  const items = byBeat(def.chart.flatMap((e) => (e.t === 'item' ? [e] : [])));
  const platforms = byBeat(def.chart.flatMap((e) => (e.t === 'platform' ? [e] : [])));
  const cues = byBeat([
    ...def.chart.flatMap((e) => (e.t === 'cue' ? [e] : [])),
    ...def.sections.map((s): CueEvent => ({ t: 'cue', beat: s.beat, cue: 'section', name: s.name })),
  ]);

  for (const e of def.chart) if (!num(e.beat)) fail(def, `chart event without a finite beat: ${JSON.stringify(e)}`);
  const halfW: number[] = [];
  const reach: number[] = [];
  for (const h of hazards) {
    const where = `${h.kind}@${h.beat}`;
    if (!HAZARDS[h.kind]) fail(def, `unknown hazard kind ${where}`);
    if ((h.b === 'run' || h.b === 'bounce' || h.b === 'fly') && !(h.speed >= 0)) fail(def, `${where}: speed must be >= 0`);
    if ((h.b === 'bounce' || h.b === 'pulse') && !(h.period > 0)) fail(def, `${where}: period must be > 0`);
    if (h.b === 'pulse' && !(h.on > 0 && h.on <= h.period)) fail(def, `${where}: on must be in (0, period]`);
    if ((h.b === 'drop' || h.b === 'lob') && !((h.lead ?? 1) >= 0)) fail(def, `${where}: lead must be >= 0`);
    if (h.b === 'lob' && !((h.flight ?? 1) > 0)) fail(def, `${where}: flight must be > 0`);
    const rel = bpb + hazardSpeed(h); // closing speed, blocks/beat
    halfW.push(HAZARDS[h.kind].w / 2 + marginBeats * rel);
    reach.push((HALF_W + halfW[halfW.length - 1]) / rel + EPS);
  }
  for (const p of platforms) {
    if (!(p.len > 0 && num(p.y))) fail(def, `platform@${p.beat}: len must be > 0 and y finite`);
    if (p.move && !(p.move.period > 0 && num(p.move.dx) && num(p.move.dy))) fail(def, `platform@${p.beat}: bad move`);
  }
  for (const i of items) if (!num(i.y)) fail(def, `item ${i.kind}@${i.beat}: y must be finite`);
  for (const [a, b] of def.ground) if (!(num(a) && num(b) && a < b)) fail(def, `bad ground span [${a}, ${b}]`);

  return {
    def, hazards, items, platforms, cues, marginMs, halfW, reach,
    maxReach: Math.max(0, ...reach),
    checkpoints: checkpoints(def),
    minHold: [minHoldTicks(def.bpm, 1), minHoldTicks(def.bpm, OVERDRIVE.rate)],
    ground: def.ground.map(([a, b]) => [a * bpb, b * bpb] as [number, number]).sort((p, q) => p[0] - q[0]),
    endTick: Math.round(def.lengthBeats * TPB),
  };
}

/** Easy-mode checkpoints: every section start after the first, unless the section says `checkpoint: false`. */
export const checkpoints = (def: LevelDef): number[] =>
  def.sections.filter((s) => s.beat > 0 && s.checkpoint !== false).map((s) => s.beat);

/** `hearts` = hits she can take (1 = today's one-hit game, which the solver proves). */
export function createState(L: Level, startBeat = 0, hearts = 1): SimState {
  const tick = Math.round(startBeat * TPB);
  let cueIdx = 0;
  while (cueIdx < L.cues.length && Math.round(L.cues[cueIdx].beat * TPB) < tick) cueIdx++;
  return {
    tick, y: 0, prevY: 0, vy: 0, support: overGround(L, (tick / TPB) * L.def.blocksPerBeat) ? 0 : -1,
    held: false, jumpTicks: 0, cutDone: true, coyote: 0, buffer: 0, airJump: true,
    shield: false, hearts, maxHearts: hearts, invulnUntil: 0, preUntil: 0, overdriveFrom: 0, overdriveUntil: 0, coins: 0, cueIdx,
    dead: false, won: false,
    taken: new Uint8Array(L.items.length), smashed: new Uint8Array(L.hazards.length),
  };
}

export function cloneState(s: SimState): SimState {
  return { ...s, taken: s.taken.slice(), smashed: s.smashed.slice() };
}

export function overdriveActive(s: SimState, tick = s.tick): boolean {
  return tick >= s.overdriveFrom * TPB && tick < s.overdriveUntil * TPB;
}

function overGround(L: Level, px: number): boolean {
  for (const [a, b] of L.ground) if (px + HALF_W > a && px - HALF_W < b) return true;
  return false;
}

/** Top of platform k at `beat` if Rafa (at px) overlaps it horizontally, else NaN. */
function platformTop(L: Level, k: number, beat: number, px: number): number {
  const p = L.platforms[k];
  const bpb = L.def.blocksPerBeat;
  const x0 = p.beat * bpb + platformOffset(p, beat, 'dx');
  if (px + HALF_W <= x0 || px - HALF_W >= x0 + p.len * bpb) return NaN;
  return p.y + platformOffset(p, beat, 'dy');
}

/** First index in a beat-sorted array with beat >= b. */
function lowerBound(a: { beat: number }[], b: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid].beat < b) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Reused across calls: step() returns this array, valid until the next step().
const EV: SimEvent[] = [];
const P: Pos = { x: 0, y: 0, on: false };

function jump(s: SimState, air: boolean) {
  s.vy = PHYS.jumpVel;
  s.support = -1;
  s.coyote = 0;
  s.buffer = 0;
  s.jumpTicks = 0;
  s.cutDone = false;
  EV.push({ type: 'jump', tick: s.tick, air });
}

/** Advances one tick. Returns the events of this tick (a shared array, overwritten by the next call). */
export function step(L: Level, s: SimState, inp: InputFrame): SimEvent[] {
  EV.length = 0;
  if (s.dead || s.won) return EV;
  const bpb = L.def.blocksPerBeat;
  const t = ++s.tick;
  const beat = t / TPB;
  const px = beat * bpb;
  s.prevY = s.y;
  s.held = inp.held;
  if (s.overdriveFrom < s.overdriveUntil) {
    if (t === s.overdriveFrom * TPB) EV.push({ type: 'overdriveOn', tick: t });
    if (t === s.overdriveUntil * TPB) EV.push({ type: 'overdriveOff', tick: t });
  }
  if (s.coyote > 0) s.coyote--;
  if (s.buffer > 0) s.buffer--;

  // Input: ground/coyote jump, else pré-treino air jump, else buffer the press for the landing.
  if (inp.pressed) {
    if (s.support >= 0 || s.coyote > 0) jump(s, false);
    else if (s.airJump && t < s.preUntil) {
      s.airJump = false;
      jump(s, true);
    } else s.buffer = PHYS.bufferTicks;
  }
  // Releasing while rising cuts the rise, but never before the minimum hold.
  if (!s.cutDone) {
    s.jumpTicks++;
    if (s.vy <= 0) s.cutDone = true;
    else if (!s.held && s.jumpTicks >= L.minHold[overdriveActive(s, t) ? 1 : 0]) {
      s.vy *= PHYS.cut;
      s.cutDone = true;
    }
    if (s.cutDone) s.jumpTicks = 0;
  }

  if (s.support >= 0) {
    const top = s.support === 0 ? (overGround(L, px) ? 0 : NaN) : platformTop(L, s.support - 1, beat, px);
    if (top === top) s.y = top;
    else {
      s.support = -1;
      s.coyote = PHYS.coyoteTicks;
    }
    s.vy = 0;
  }
  if (s.support < 0) {
    // Exact constant-gravity kinematics over one tick.
    s.y += s.vy * DT - 0.5 * PHYS.gravity * DT * DT;
    s.vy -= PHYS.gravity * DT;
    if (s.vy <= 0) {
      let best = -1, bestTop = -Infinity;
      // Ground is solid: landing also steps her back up out of the first holeDepth of a hole.
      if (s.y <= 0 && s.y >= -PHYS.holeDepth && overGround(L, px)) (best = 0), (bestTop = 0);
      for (let k = 0; k < L.platforms.length; k++) {
        const top = platformTop(L, k, beat, px);
        if (!(top > bestTop) || s.y > top) continue;
        const prevTop = L.platforms[k].y + platformOffset(L.platforms[k], beat - DT, 'dy');
        if (s.prevY >= prevTop - EPS) (best = k + 1), (bestTop = top); // one-way: was above it a tick ago
      }
      if (best >= 0) {
        s.y = bestTop;
        s.vy = 0;
        s.support = best;
        s.coyote = 0;
        s.airJump = true;
        EV.push({ type: 'land', tick: t });
        if (s.buffer > 0) jump(s, false);
      }
    }
    if (s.support < 0 && s.y < -PHYS.holeDepth) {
      s.dead = true;
      EV.push({ type: 'death', tick: t, cause: 'hole', hazard: -1 });
      return EV;
    }
  }

  // Hazards. Hitboxes are compared with strict overlap (touching edges is safe).
  const top = s.y + PLAYER.h;
  const od = overdriveActive(s, t);
  for (let i = lowerBound(L.hazards, beat - L.maxReach); i < L.hazards.length; i++) {
    const h = L.hazards[i];
    if (h.beat > beat + L.maxReach) break;
    if (s.smashed[i] || Math.abs(beat - h.beat) > L.reach[i]) continue;
    if (!hazardPos(h, beat, bpb, P).on) continue;
    const def = HAZARDS[h.kind];
    if (Math.abs(P.x - px) >= HALF_W + L.halfW[i] || P.y >= top || P.y + def.h <= s.y) continue;
    if (t < s.invulnUntil) continue;
    if (od && def.size === 'small') {
      s.smashed[i] = 1;
      EV.push({ type: 'smash', tick: t, hazard: i, kind: h.kind });
    } else if (s.shield) {
      s.shield = false;
      s.invulnUntil = t + SHIELD_INVULN_TICKS;
      EV.push({ type: 'shieldBreak', tick: t, hazard: i, kind: h.kind });
    } else if (s.hearts > 1) {
      s.hearts--;
      s.invulnUntil = t + HURT_INVULN_TICKS;
      EV.push({ type: 'hurt', tick: t, hazard: i, kind: h.kind });
    } else {
      s.dead = true;
      EV.push({ type: 'death', tick: t, cause: h.kind, hazard: i });
      return EV;
    }
  }

  // Items.
  const itemReach = (HALF_W + ITEM_SIZE / 2) / bpb;
  for (let i = lowerBound(L.items, beat - itemReach); i < L.items.length; i++) {
    const it = L.items[i];
    if (it.beat > beat + itemReach) break;
    if (s.taken[i] || Math.abs(it.beat * bpb - px) >= HALF_W + ITEM_SIZE / 2) continue;
    if (it.y >= top || it.y + ITEM_SIZE <= s.y) continue;
    s.taken[i] = 1;
    EV.push({ type: 'pickup', tick: t, item: i, kind: it.kind });
    if (it.kind === 'coin') s.coins++;
    else if (it.kind === 'whey') s.shield = true;
    else if (it.kind === 'pre') {
      s.preUntil = t + PRE_TICKS;
      s.airJump = true;
    } else {
      // Gelol starts on the next whole beat; picking another one while it runs extends it.
      const next = Math.floor(t / TPB) + 1;
      if (t >= s.overdriveUntil * TPB) s.overdriveFrom = next;
      s.overdriveUntil = next + OVERDRIVE.beats;
    }
  }

  while (s.cueIdx < L.cues.length && Math.round(L.cues[s.cueIdx].beat * TPB) <= t) {
    const cue = L.cues[s.cueIdx++];
    if (cue.cue === 'section' && L.checkpoints.includes(cue.beat)) s.hearts = s.maxHearts;
    EV.push({ type: 'cue', tick: t, cue });
  }
  if (t >= L.endTick) {
    s.won = true;
    EV.push({ type: 'win', tick: t });
  }
  return EV;
}

/** PHYS.minHoldMs as whole sim ticks at `bpm`, with the clock running ×`rate` (Gelol overdrive). */
export function minHoldTicks(bpm: number, rate = 1): number {
  return Math.round((PHYS.minHoldMs / 60000) * bpm * rate * TPB);
}

/** Rafa's height per tick for a jump from flat ground at `bpm`: index 0 = takeoff tick, last = landing (0).
 *  `holdTicks` = how long the button stays down (0 = tap). Used by the chart DSL to put coins on real arcs. */
export function jumpCurve(holdTicks: number, bpm = 120): number[] {
  const L = compileLevel({
    id: '', name: '', theme: 'gym', rafa: 'standing', bpm, blocksPerBeat: 1, lengthBeats: 1e6,
    songId: '', marginMs: 0, sections: [], ground: [[-1e6, 1e6]], chart: [],
  });
  const s = createState(L);
  const ys: number[] = [];
  for (let k = 0; k < 10 * TPB; k++) {
    const held = k < holdTicks;
    step(L, s, { pressed: k === 0, released: k === holdTicks, held });
    ys.push(s.y);
    if (k > 0 && s.support >= 0) break;
  }
  return ys;
}
