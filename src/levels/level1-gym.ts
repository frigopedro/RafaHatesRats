// Level 1 — Campeonato Gym Rats. 120 BPM, 144 beats. Draft chart for M0 (to be synced to its song in M2).
// Reading guide: a tap (hop) clears small things, a hold (big jump) clears big ones, high things mean "stay down".
// Hop ≈ press 0.35 beat before the hazard; big jump ≈ press half a beat before (on the "and").
import type { LevelDef } from '../types';
import { attack, bossEnter, bossExit, coinArc, coinLine, hint, hz, item, rep } from './dsl';

const HOP = 0, BIG = 0.5; // hold lengths for coin arcs
const blob = (beat: number) => attack(hz(beat, 'webBlob', { b: 'lob', lead: 1, flight: 1, dx: 8, dy: 6 }), 'webBlob');
const line = (beat: number) => attack(hz(beat, 'webLine', { b: 'fly', y: 1.75, speed: 1 }), 'webLine');
const dive = (beat: number) => attack(hz(beat, 'spiderDive', { b: 'fly', y: 0, speed: 3 }), 'swingDive', 2);
const rat = (beat: number, speed = 2) => hz(beat, 'rat', { b: 'run', speed });
const plate = (beat: number) => hz(beat, 'plate', { b: 'drop', lead: 1 });
const bag = (beat: number) => hz(beat, 'bag', { b: 'static', y: 1.8 });

export const level1: LevelDef = {
  id: 1,
  name: 'Campeonato Gym Rats',
  theme: 'gym',
  rafa: 'wheelchair',
  bpm: 120,
  blocksPerBeat: 4,
  lengthBeats: 144,
  songId: 'gym',
  marginMs: 60,
  sections: [
    { beat: 0, name: 'intro' },
    { beat: 8, name: 'warmup' },
    { beat: 40, name: 'main' },
    { beat: 72, name: 'gelol' },
    { beat: 96, name: 'bossEnter' },
    { beat: 100, name: 'boss1' },
    { beat: 112, name: 'boss2' },
    { beat: 124, name: 'boss3' },
    { beat: 136, name: 'finale' },
  ],
  ground: [[-8, 152]],
  chart: [
    // Warm-up (8–40): single small hazards, then rats, then big ones.
    hint(10, 'TOQUE!'),
    hz(12, 'dumbbell'), ...coinArc(11.65, HOP, 3),
    hz(16, 'kettlebell'),
    hz(20, 'bottle'), ...coinArc(19.65, HOP, 3),
    hz(22, 'dumbbell'),
    rat(24), rat(26),
    hz(28, 'dumbbell'), hz(29, 'kettlebell'),
    hint(30, 'SEGURE!'),
    hz(32, 'bench'), ...coinArc(31.5, BIG, 5),
    hz(35, 'treadmill'),
    hz(38, 'plateRack'), ...coinArc(37.5, BIG, 5),

    // Main (40–72): combos, high bags, falling plates, Whey and Pré-treino.
    item(40, 'whey'),
    hint(41, 'NÃO PULE!'),
    bag(42), bag(43),
    hz(45, 'dumbbell'), bag(45.6), // tap, don't hold: a big jump is still airborne under the bag
    plate(48),
    hz(50, 'bench'), hz(52, 'kettlebell'), hz(53, 'bottle'), bag(53.6),
    rat(55, 3), bag(55.6),
    item(56, 'pre'),
    hz(58, 'treadmill'), ...coinLine(58, 0.25, 5, 4.6), // high line: only with the pré-treino air jump
    plate(60), hz(61, 'dumbbell'),
    hz(62.5, 'kettlebell'), bag(63.5),
    hz(65, 'plateRack'),
    rat(66, 3), rat(67),
    hz(69, 'bench'), ...coinArc(68.5, BIG, 5),

    // Gelol corridor (72–96): two Gelols chain 24 beats of overdrive; small stuff gets smashed, big still needs a jump.
    item(71, 'gelol'),
    hint(71.5, 'ESMAGA!'),
    ...rep(72, 0.5, 12, (b) => (b % 1 ? rat(b, 2) : hz(b, b % 2 ? 'dumbbell' : 'kettlebell'))),
    hz(79, 'bench'),
    ...rep(80.5, 0.5, 6, (b) => hz(b, 'bottle')),
    item(83.5, 'gelol'),
    ...rep(84, 0.5, 8, (b) => rat(b, 3)),
    hz(88.5, 'treadmill'),
    ...rep(90, 0.5, 8, (b) => (b % 1 ? hz(b, 'dumbbell') : rat(b))),
    hz(94, 'plateRack'),

    // Spider boss (96–136): web blobs (hop), web lines at head height (stay down), swing-dives (big jump).
    bossEnter(96),
    ...blob(101), ...blob(103), ...blob(105), ...blob(106), ...blob(108), ...blob(110),
    ...coinArc(105.65, HOP, 3),
    ...line(113), ...blob(114), ...line(116), ...blob(117), ...line(117.7), ...line(120), ...line(121), ...blob(122),
    item(119, 'whey'),
    ...dive(126), ...blob(128), ...dive(130), ...line(131), ...blob(132), ...dive(134),
    ...coinArc(129.5, BIG, 5),

    // Finale (136–144): a Gelol appears and Rafa rams the boss.
    item(137, 'gelol'),
    ...blob(139), ...blob(139.5),
    bossExit(140),
    ...coinLine(141, 0.5, 6, 0.4),
  ],
};
