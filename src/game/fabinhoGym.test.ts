// Fabinho's exercises fill the level-1 taunt breaks, one kind each, key frames on the beat, and he is back in his run
// at least a beat before every telegraph.
import { describe, expect, it } from 'vitest';
import { BOSS_AHEAD } from '../config';
import { level1 } from '../levels/level1-gym';
import { releaseBeat } from '../sim/behaviors';
import type { HazardEvent } from '../types';
import { exercise, idleWindows, type BossCue } from './fabinhoGym';

// The boss cues as BossActor builds them (release = the first boss hazard released at or after the cue).
const hazards = level1.chart.filter((e): e is HazardEvent => e.t === 'hazard' && ['frisbee', 'shockwave', 'medBall'].includes(e.kind));
const cues: BossCue[] = level1.chart.flatMap((e) => {
  if (e.t !== 'cue' || !['bossEnter', 'bossAttack', 'bossExit'].includes(e.cue)) return [];
  const name = e.cue === 'bossAttack' ? e.attack : e.cue === 'bossEnter' ? 'enter' : 'exit';
  const rel = hazards.map((h) => releaseBeat(h, 4, BOSS_AHEAD)).filter((r) => r >= e.beat - 1e-6);
  return [{ beat: e.beat, name, release: name.startsWith('taunt') || !rel.length ? NaN : Math.min(...rel) - e.beat }];
}).sort((a, b) => a.beat - b.beat);
const W = idleWindows(cues, level1.sections.find((s) => s.name === 'finale')!.beat);

describe('Fabinho exercises (level 1)', () => {
  it('one window per taunt break; the gap before the Gelol finale (132.1–136) is too short', () => {
    expect(W.map((w) => [w.from, w.to, w.k])).toEqual([[83, 87.5, 0], [expect.closeTo(102.6), 107, 1], [116, 120.5, 2]]);
    expect(idleWindows(cues)).toHaveLength(4); // without the finale cut it would hold burpees, 133–137
  });

  it('key frames land on the beat', () => {
    const at = (k: number, beat: number) => exercise(W[k], beat);
    expect([84, 86].map((b) => at(0, b)?.frame)).toEqual(['squat_2', 'squat_2']); // deepest
    expect([103, 104, 105, 106].map((b) => at(1, b)?.frame)).toEqual(Array(4).fill('pushup_1')); // chest down
    expect([117, 119].map((b) => at(2, b)?.frame)).toEqual(['pullup_2', 'pullup_2']); // chin over the bar
    const jump = [135.8, 136, 136.2].map((b) => exercise({ from: 132.1, to: 137, k: 3 }, b)!); // a 4th window
    expect(jump.map((e) => e.frame)).toEqual(Array(3).fill('burpee_4'));
    expect(jump[1].lift).toBeGreaterThan(jump[0].lift); // peak on beat 136
    expect(jump[1].lift).toBeGreaterThan(jump[2].lift);
  });

  it('runs again at least a beat before each telegraph', () => {
    for (const w of W) {
      expect(exercise(w, w.to)).toBeNull(); // `to` is already a beat before the next cue
      expect(exercise(w, w.from - 1e-3)).toBeNull();
    }
    expect(exercise(W[0], 86.9)).not.toBeNull(); // whole reps only: squats 83–87
    expect(exercise(W[0], 87)).toBeNull();
  });
});
