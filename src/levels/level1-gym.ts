// Level 1 — Campeonato Gym Rats. 120 BPM, 144 beats, boss: Fabinho.
// Reading guide: a tap (hop) clears small things, a hold (big jump) clears big ones, high things mean "stay down".
// Hop ≈ press 0.35 beat before the hazard; big jump ≈ press half a beat before (on the "and").
// Teaches one thing at a time: hop (warmup), big jump (warmup), stay down (main), then the same three as Fabinho's
// attacks: low plate = hop, high plate = stay down, shockwave = hop, low med ball = hop, high med ball = stay down.
import type { HazardEvent, LevelDef } from '../types';
import { attack, bossEnter, bossExit, bossMove, coinArc, coinLine, hint, hz, item, rep } from './dsl';

const HOP = 0, BIG = 0.5; // hold lengths for coin arcs
const HIGH = 2.3; // high hazards hang above standing Rafa's head (≈ 2.3 blocks), so they read as "stay down"
const rat = (beat: number, speed = 2) => hz(beat, 'rat', { b: 'run', speed });
const dropPlate = (beat: number) => hz(beat, 'plate', { b: 'drop', lead: 1 });
const bag = (beat: number) => hz(beat, 'bag', { b: 'static', y: HIGH });
// Fabinho's attacks all close at 2 blocks/beat, so each leaves his hands 1.5 beats before Rafa meets it.
// A high plate is thin, so it flies a little higher than the bags to clear her hair visibly.
const disc = (beat: number, high = false) =>
  attack(hz(beat, 'frisbee', { b: 'fly', y: high ? HIGH + 0.3 : 0.6, speed: 2 }), high ? 'frisbeeHigh' : 'frisbeeLow');
const wave = (beat: number) => attack(hz(beat, 'shockwave', { b: 'run', speed: 2 }), 'shockwave', 1.5); // wind-up = the leap
const ball = (beat: number, high = false) => attack(hz(beat, 'medBall', high
  ? { b: 'bounce', speed: 2, height: 2.4, period: 1, phase: 0.5 } // on the floor at his hands, over her head when met
  : { b: 'bounce', speed: 2, height: 0.8, period: 0.75 }), high ? 'medBallHigh' : 'medBallLow');
const smashRow = (from: number, n: number): HazardEvent[] =>
  rep(from, 0.5, n, (b, i) => (i % 2 ? rat(b, 3) : hz(b, i % 4 ? 'kettlebell' : 'dumbbell'))) as HazardEvent[];

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
  marginMs: 60,
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

    // Warm-up (8–40): single small hazards (tap), then rats, then big ones (hold).
    hint(10, 'TOQUE!'),
    hz(12, 'dumbbell'), ...coinArc(11.65, HOP, 3),
    hz(15, 'kettlebell'),
    hz(18, 'bottle'), ...coinArc(17.65, HOP, 3),
    hz(20, 'dumbbell'),
    rat(22), rat(24),
    hz(26, 'ropeWave'),
    hz(28, 'plate'),
    hint(30, 'SEGURE!'),
    hz(32, 'bench'), ...coinArc(31.5, BIG, 5),
    hz(35, 'treadmill'),
    hz(38, 'plateRack'), ...coinArc(37.5, BIG, 5),

    // Main (40–64): stay down under the bags, falling plates, combos, Whey and Pré-treino.
    hint(41, 'NÃO PULE!'),
    bag(43), bag(44), ...coinLine(42.5, 0.5, 4, 0.3),
    hz(46, 'dumbbell'), bag(46.6), // tap, don't hold: a big jump is still airborne under the bag
    item(48, 'whey'),
    dropPlate(50),
    hz(52, 'barbellRack'), ...coinArc(51.5, BIG, 5),
    hz(54, 'kettlebell'), hz(55, 'bottle'), bag(55.6),
    rat(57, 3), bag(57.6),
    item(58.5, 'pre'),
    hz(60, 'plyo'), ...coinLine(60, 0.25, 5, 4.6), // high line: only with the pré-treino air jump
    dropPlate(62), hz(63, 'ropeWave'),

    // Gelol corridor (64–80): overdrive 66–78 smashes the small stuff; big ones still need the big jump.
    hint(64.5, 'ESMAGA!'),
    item(65, 'gelol'),
    ...smashRow(66, 8),
    hz(70, 'bench'),
    ...smashRow(71.5, 5),
    hz(74.5, 'treadmill'),
    ...smashRow(76, 4),

    // Fabinho enters (80–88): overtakes her, then shows off with push-ups. Whey for the fight.
    bossEnter(80),
    bossMove(84, 'pushups'),
    item(85, 'whey'), ...coinLine(86, 0.5, 4, 0.3),

    // Boss 1 (88–104): weight plates. Low ones: hop. High ones: stay down.
    ...disc(91), ...disc(93), ...disc(95),
    hint(96, 'NÃO PULE!'),
    ...disc(98, true), ...disc(100, true),
    ...disc(101.5),
    bossMove(102.5, 'situps'),

    // Boss 2 (104–120): he leaps and lands a shockwave (hop), mixed with plates and gym gear.
    ...wave(108),
    hz(110, 'bench'), ...coinArc(109.5, BIG, 5),
    ...wave(112),
    ...disc(114.5, true),
    hz(116, 'dumbbell'),
    ...wave(118),
    bossMove(118.5, 'pushups'),

    // Boss 3 (120–136): medicine balls — over the low bounce, under the high one — then everything at once.
    ...ball(124),
    ...ball(127, true),
    ...disc(129),
    ...ball(131, true),
    ...wave(133),
    item(134, 'gelol'),

    // Finale (136–144): Gelol smash-through, she overtakes him, finish line.
    ...smashRow(136, 6),
    bossExit(138),
    ...coinLine(141, 0.5, 6, 0.3),
  ],
};
