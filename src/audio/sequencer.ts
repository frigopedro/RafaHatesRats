// Beat-driven scheduler. Every note time comes from the game's BeatClock (beat → performance.now() ms via timeAt),
// mapped to AudioContext time by the host. Steps (16ths) are sent in order a little ahead of time. If the clock
// changes under steps already sent but not yet sounding (Gelol starts or stretches, hitch re-anchor, pause), those
// steps are cancelled and sent again, so every note is heard exactly once, at the clock's final time.
import type { BeatClock } from '../game/clock';
import { STEPS } from './song';

export const LOOKAHEAD = 0.14; // s of audio scheduled ahead (real time, so more beats under overdrive)
const LATE = 0.08; // s; a step already this far in the past is skipped (never flammed in after a stall)

export interface Host {
  ctxNow(): number; // AudioContext.currentTime
  toCtx(perfMs: number): number; // performance.now() ms → context time that is heard at that moment
  /** Everything of one step. `prev`/`od`: overdrive at the previous/this step. */
  play(step: number, at: (beat: number) => number, prev: boolean, od: boolean): void;
  /** Cancel every step ≥ fromStep (none has started). `pause`: also fade out what is still ringing. */
  cut(fromStep: number, pause: boolean): void;
}

export class Sequencer {
  private next = 0; // next step to send
  private paused = false;
  private sent: number[] = []; // per step not yet sounding: step, perf ms, context time, overdrive 0/1
  private odLast = false; // overdrive at the step before `next`
  private odDone = false; // … at the last step that has sounded
  readonly at = (beat: number) => this.host.toCtx(this.clock.timeAt(beat));
  private readonly stepMs: number;

  constructor(private readonly clock: BeatClock, private readonly host: Host) {
    this.stepMs = 60000 / clock.bpm / STEPS;
  }

  start(beat: number): void {
    this.next = Math.ceil(beat * STEPS - 1e-6) + 0; // + 0: no -0 step
    this.paused = this.odLast = this.odDone = false;
    this.sent.length = 0;
  }

  /** Overdrive over [beat, beat + 1 step): the clock runs faster than nominal there. Only for coming beats. */
  private isOd(beat: number): boolean {
    return this.clock.timeAt(beat + 1 / STEPS) - this.clock.timeAt(beat) < this.stepMs / 1.1;
  }

  pump(now = performance.now()): void {
    const c = this.clock, s = this.sent, b = c.beat(now);
    // shortcut: BeatClock has no public `running`; a paused clock returns the same beat for any time.
    if (c.beat(now - 50) === b) {
      if (!this.paused) this.host.cut(this.rewind(0), true);
      this.paused = true;
      return;
    }
    this.paused = false;
    const ctxNow = this.host.ctxNow(), horizon = ctxNow + LOOKAHEAD;
    let k = 0;
    while (k < s.length && s[k + 2] <= ctxNow) k += 4;
    if (k) {
      this.odDone = s[k - 1] === 1;
      s.splice(0, k);
    }
    for (k = 0; k < s.length; k += 4) {
      const beat = s[k] / STEPS;
      if (Math.abs(c.timeAt(beat) - s[k + 1]) > 0.1 || +this.isOd(beat) !== s[k + 3]) {
        this.host.cut(this.rewind(k), false);
        break;
      }
    }
    if (this.next < b * STEPS - 4 * STEPS) this.next = Math.floor(b * STEPS); // long stall: skip, don't loop through it

    for (; ; this.next++) {
      const beat = this.next / STEPS, p = c.timeAt(beat), t = this.host.toCtx(p);
      if (t >= horizon) break;
      if (t < ctxNow - LATE) continue;
      const od = this.isOd(beat);
      this.host.play(this.next, this.at, this.odLast, od);
      this.odLast = od;
      s.push(this.next, p, t, +od);
    }
  }

  /** Takes back the sent steps not sounding yet, from entry `k` of `sent` on, to be sent again; returns the first
   *  such step (or `next` if none). The caller cancels them (Host.cut). */
  rewind(k = 0): number {
    const s = this.sent, c = this.host.ctxNow();
    while (k < s.length && s[k + 2] <= c) k += 4; // already sounding: keep
    if (k < s.length) {
      this.next = s[k];
      this.odLast = k ? s[k - 1] === 1 : this.odDone;
      s.length = k;
    }
    return this.next;
  }
}

/** Context time minus performance time (s): the context time heard at performance.now() = p is p / 1000 + offset.
 *  Uses the output timestamp when the browser gives a sane one, else currentTime minus the reported latency. */
export function outputOffset(
  ctx: Pick<AudioContext, 'currentTime' | 'baseLatency'> & Partial<Pick<AudioContext, 'getOutputTimestamp' | 'outputLatency'>>,
  now = performance.now(),
): number {
  const reported = ctx.outputLatency || ctx.baseLatency || 0;
  const fallback = ctx.currentTime - now / 1000 - reported;
  const ts = ctx.getOutputTimestamp?.();
  if (ts?.contextTime && ts.performanceTime) {
    const off = ts.contextTime - ts.performanceTime / 1000;
    const latency = ctx.currentTime - now / 1000 - off; // what is being rendered now vs what is heard now
    if (latency > -0.005 && latency < 0.5) return off;
  }
  return fallback;
}
