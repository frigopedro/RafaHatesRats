// Gym Fabinho's run (level-1 boss). His v2 sheet's run row is a genuine 5-frame cycle (push-off, flight, knee drive),
// so this is just that cycle phase-locked to the beat; the exports stay as they were when it was a leg rig, so the
// boss actor uses it only while his move is a run and keeps atlas frames for everything else.
// Also his exercises: between attacks (taunt breaks included) he shows off in time with the music, a different
// exercise in each idle window — squats, push-ups, pull-ups, burpees, then again. Pure in (cues, beat).
import type Phaser from 'phaser';
import { animFrame, FABINHOGYM, FABINHOGYM_ATLAS } from '../art/sheets';

export interface FabinhoGymRun {
  root: Phaser.GameObjects.Container; // origin = his face x / feet y, like the atlas frames' pivots
  parts: Phaser.GameObjects.Image[];
}

/** The `fabinhogym` atlas must already be loaded. */
export function createFabinhoGymRun(scene: Phaser.Scene): FabinhoGymRun {
  const parts = [scene.add.image(0, 0, FABINHOGYM_ATLAS, FABINHOGYM.run.frames[0])];
  return { root: scene.add.container(0, 0, parts), parts };
}

/** Poses the run at `phase` (cycles: one per beat at Rafa's pace, so pass beat × rate) with his feet at (x, y).
 *  `flip` mirrors him to face left (toward Rafa when he is ahead of her), about his face, like setFlipX on his frames. */
export function drawFabinhoGymRun(r: FabinhoGymRun, phase: number, x: number, y: number, flip = false): void {
  // Half a cycle off hers, so beside her they are not in lockstep.
  r.parts[0].setFrame(animFrame(FABINHOGYM.run, phase + 0.5)); // the table runs one cycle per beat
  r.root.setPosition(x, y).setScale(flip ? -1 : 1, 1);
}

/** A boss cue as the boss actor holds it: `release` = beats from the cue to its hazard's release (NaN if none). */
export interface BossCue { beat: number; name: string; release: number }
/** An idle window in absolute beats; `k` = its ordinal in the fight (which exercise). */
export interface Idle { from: number; to: number; k: number }

// Beats a move keeps him busy after its cue (bosses.ts fabinho.pose: wind-up, release, recovery). Taunt breaks count
// as idle: he exercises instead.
const busy = (name: string, r: number) =>
  name === 'enter' ? 3 : name === 'exit' ? Infinity : name.startsWith('taunt') ? 0 : r + (name === 'shockwave' ? 0.5 : 0.6);
const LEAD = 1, MIN = 4; // back in his run ≥ 1 beat before the next telegraph; shorter windows stay as they were

/** The windows (≥ MIN beats) between the end of one busy move and LEAD beats before the next, all before `until`
 *  (the level's finale: from there his Gelol-finale behaviour wins). */
export function idleWindows(cues: BossCue[], until = Infinity): Idle[] {
  const out: Idle[] = [];
  let free: number | undefined; // when his last busy move ends
  for (const c of cues) {
    const b = busy(c.name, c.release);
    if (b <= 0) continue;
    const to = Math.min(c.beat - LEAD, until);
    if (free !== undefined && to - free >= MIN) out.push({ from: free, to, k: out.length });
    free = Math.max(free ?? -Infinity, c.beat + b);
  }
  return out;
}

export const EXERCISES = ['squat', 'pushup', 'pullup', 'burpee'] as const;
export const BAR = 2.85; // pull-up bar height, blocks: his hanging feet just off the floor (slice log: 260 px below it)
export const BAR_HALF = 88; // the bar's half-width, px (slice log)

/** His exercise at `beat` in window `w`: whole reps from the window's first whole beat, or null (he runs). */
export function exercise(w: Idle, beat: number): { frame: string; lift: number; skid: boolean; bar: boolean } | null {
  const name = EXERCISES[w.k % EXERCISES.length], a = FABINHOGYM[name], rep = a.frames.length / a.perBeat;
  const start = Math.ceil(w.from - 1e-6), t = beat - start;
  if (t < 0 || t >= Math.floor((w.to - start) / rep) * rep) return null;
  const frame = animFrame(a, t), u = ((t % rep) - 2.75) / 0.5; // burpee: airborne 2.75–3.25, peak on beat 3
  const bar = name === 'pullup', lift = bar ? BAR : frame === 'burpee_4' ? 2.4 * u * (1 - u) : 0;
  return { frame, lift, skid: !bar && lift === 0, bar };
}
