// The one beat clock for game and (later) music. Derived from performance.now() and an anchor, never from Phaser's
// smoothed frame delta (it would drift against audio). Gelol overdrive runs the beat ×OVERDRIVE.rate between two
// whole beats; the anchor is moved exactly onto those beats so both segments stay exact.
import { OVERDRIVE } from '../config';

export class BeatClock {
  private t0 = 0; // performance.now() ms at the anchor
  private b0 = 0; // beat at the anchor
  private running = false;
  private odFrom = 0;
  private odUntil = 0;

  constructor(readonly bpm: number) {}

  /** Beats per ms at `beat`. */
  private rate(beat: number): number {
    return (this.bpm / 60000) * (beat >= this.odFrom && beat < this.odUntil ? OVERDRIVE.rate : 1);
  }

  private nextEdge(beat: number): number {
    return beat < this.odFrom ? this.odFrom : beat < this.odUntil ? this.odUntil : Infinity;
  }

  /** Current beat (frozen while paused). */
  beat(now = performance.now()): number {
    if (!this.running) return this.b0;
    for (;;) {
      const r = this.rate(this.b0);
      const b = this.b0 + (now - this.t0) * r;
      const edge = this.nextEdge(this.b0);
      if (b < edge) return b;
      this.t0 += (edge - this.b0) / r; // re-anchor exactly on the tempo change
      this.b0 = edge;
    }
  }

  /** Start (or jump) to `beat` now. Clears overdrive. */
  start(beat: number): void {
    this.odFrom = this.odUntil = 0;
    this.reanchor(beat);
  }

  /** Continue from `beat` now, e.g. after a hitch, without fast-forwarding. */
  reanchor(beat: number): void {
    this.t0 = performance.now();
    this.b0 = beat;
    this.running = true;
  }

  pause(): void {
    this.b0 = this.beat();
    this.running = false;
  }

  resume(): void {
    if (!this.running) this.reanchor(this.b0);
  }

  /** Overdrive window in whole beats (from the sim's overdriveFrom/Until). */
  setOverdrive(from: number, until: number): void {
    this.odFrom = from;
    this.odUntil = until;
  }

  /** performance.now() time (ms) at which a coming `beat` (≥ the current one) happens if nothing pauses or changes
   *  the overdrive window. An audio engine maps it to its own
   *  clock with ctx.currentTime + (timeAt(beat) − performance.now()) / 1000, so notes share this anchor. */
  timeAt(beat: number): number {
    let t = this.running ? this.t0 : performance.now();
    let b = this.b0;
    for (;;) {
      const r = this.rate(b);
      const edge = this.nextEdge(b);
      if (beat <= edge) return t + (beat - b) / r;
      t += (edge - b) / r;
      b = edge;
    }
  }
}
