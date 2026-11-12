// Level 1 — Campeonato Gym Rats. 120 BPM, 144 beats, boss: Fabinho. The casual on-ramp (tested in levels.test.ts):
// ±110 ms of timing slack, beatable holding every jump (a full jump is always safe), any jump clears the small stuff,
// at least 2 beats between things to do (1.5 in the fight), "stay down" moments alone and signposted, one Fabinho
// attack type per phase with long taunt breaks, three Whey shields.
import type { HazardEvent, LevelDef } from '../types';
import { attack, bossEnter, bossExit, bossMove, coinArc, coinLine, hint, hz, item, rep } from './dsl';

const HOP = 0, BIG = 0.5; // hold lengths for coin arcs
const HIGH = 2.3; // high hazards hang above standing Rafa's head (≈ 2.1 blocks), so they read as "stay down"
const rat = (beat: number) => hz(beat, 'rat', { b: 'run', speed: 1 }); // slow: any jump clears it
const bag = (beat: number) => hz(beat, 'bag', { b: 'static', y: HIGH });
// Fabinho's attacks all close at 2 blocks/beat, so each leaves his hands 1.5 beats before Rafa meets it.
// A high plate is thin, so it flies a little higher than the bags to clear her hair visibly.
const disc = (beat: number, high = false) =>
  attack(hz(beat, 'frisbee', { b: 'fly', y: high ? HIGH + 0.3 : 0.6, speed: 2 }), high ? 'frisbeeHigh' : 'frisbeeLow');
const wave = (beat: number) => attack(hz(beat, 'shockwave', { b: 'run', speed: 2 }), 'shockwave', 1.5); // wind-up = the leap
// Bowled along the floor from his hands; low bounces only, so any jump clears it.
const ball = (beat: number) => attack(hz(beat, 'medBall', { b: 'bounce', speed: 2, height: 0.6, period: 0.75 }), 'medBallLow');
// Gelol corridor filler: everything here is small, so overdrive smashes it.
const smashRow = (from: number, n: number): HazardEvent[] =>
  rep(from, 0.5, n, (b, i) => (i % 3 === 2 ? rat(b) : hz(b, i % 2 ? 'kettlebell' : 'dumbbell'))) as HazardEvent[];

export const level1: LevelDef = {
  id: 'gym',
  name: 'Campeonato Gym Rats',
  theme: 'gym',
  rafa: 'standing',
  boss: 'fabinho',
  bpm: 120,
  blocksPerBeat: 4,
  lengthBeats: 144,
  songId: 'gym',
  marginMs: 110,
  sections: [
    { beat: 0, name: 'intro' },
    { beat: 8, name: 'warmup' },
    { beat: 40, name: 'main' },
    { beat: 64, name: 'gelol' },
    { beat: 80, name: 'bossEnter' },
    { beat: 88, name: 'boss1' },
    { beat: 104, name: 'boss2' },
    { beat: 120, name: 'boss3' },
    { beat: 136, name: 'finale' },
  ],
  ground: [[-8, 152]],
  chart: [
    // Intro (0–8): count-in; a line of dumbbells on the floor shows what to collect.
    ...coinLine(4, 0.5, 6, 0.3),

    // Warm-up (8–40): one small thing every 4 beats (any jump works), then the two big ones behind "SEGURE!".
    hint(10, 'TOQUE!'),
    hz(13, 'dumbbell'), ...coinArc(12.65, HOP, 3),
    hz(17, 'kettlebell'),
    rat(21),
    hz(25, 'bottle'), ...coinArc(24.65, HOP, 3),
    hint(27, 'SEGURE!'),
    hz(30, 'bench'), ...coinArc(29.5, BIG, 5),
    hz(34, 'dumbbell'),
    hz(37, 'plateRack'), ...coinArc(36.5, BIG, 5),

    // Main (40–64): stay down under the bags (each alone), Whey and Pré-treino.
    item(41, 'whey'),
    hint(42, 'NÃO PULE!'),
    bag(44), ...coinLine(43.5, 0.5, 3, 0.3),
    hz(47, 'kettlebell'),
    hz(50, 'plyo'), ...coinArc(49.5, BIG, 5),
    bag(54), ...coinLine(53.5, 0.5, 3, 0.3),
    rat(57),
    item(58.5, 'pre'),
    hz(60.5, 'dumbbell'), ...coinLine(60.5, 0.25, 5, 4.6), // high line: only with the pré-treino air jump
    bag(63),

    // Gelol corridor (64–80): overdrive ~65–77 smashes everything small; just two big things to jump.
    hint(64, 'ESMAGA!'),
    item(64.5, 'gelol'), item(65.5, 'gelol'), // a second tube in case the first is jumped over
    ...smashRow(66, 8),
    hz(70.5, 'bench'),
    ...smashRow(72, 5),
    hz(75, 'plyo'),
    ...smashRow(76, 2),

    // Fabinho enters (80–88): overtakes her, then stops to taunt her for a few beats. Whey for the fight.
    bossEnter(80),
    item(82.5, 'whey'),
    bossMove(84, 'taunt'),
    ...coinLine(85, 0.5, 4, 0.3),

    // Boss 1 (88–104): weight plates. Low ones: any jump. Then two high ones behind "NÃO PULE!": stay down.
    ...disc(91), ...disc(94), ...disc(97),
    hint(98.5, 'NÃO PULE!'),
    ...disc(100.5, true), ...disc(103.5, true),

    // Boss 2 (104–120): a taunt break, then he leaps and lands shockwaves along the floor (any jump).
    bossMove(104, 'taunt'),
    ...wave(111), ...wave(114), ...wave(117),
    bossMove(117.5, 'taunt2'),

    // Boss 3 (120–136): Whey, then medicine balls bowled along the floor, low bounces (any jump).
    item(121, 'whey'),
    ...ball(124), ...ball(127), ...ball(130), ...ball(133),
    item(135, 'gelol'),

    // Finale (136–144): Gelol smash-through, she overtakes him, finish line.
    ...smashRow(137, 4),
    bossExit(138),
    ...coinLine(141, 0.5, 6, 0.3),
  ],
};
