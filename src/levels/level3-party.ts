// Level 3 — A Festa. 144 BPM, 208 beats, boss: O Aranha da Carreta on his party train. Rafa in her wheelchair.
// Casual-fair (DESIGN §2): beatable with big jumps only, any jump clears a small thing, required actions ≥ 2 beats
// apart (a big jump lands with a beat of clear floor before the next press), nothing in a section's first beat, every
// "don't jump" alone with ≥ 1.25 beats of nothing around it. New reads, one at a time:
// - stage fountains (sparkler) fire in sync on the even beats, off on the odd ones: ON when you get there = hold, off = roll.
// - waiters cross toward her (big: hold).
// - the boss adds one attack per phase: web blob (lob, lands on the floor: hop), web line (head height: stay down),
//   backflip dive (wound up from pose 2, tumbles off the roof at her: hold).
// The 1.4-wide `table` isn't used: at ±60 ms even a full big jump can't clear it (needs a 1.3 hitbox).
import { ARANHA_AHEAD as A } from '../config';
import type { HazardEvent, LevelDef } from '../types';
import { attack, bossEnter, bossExit, bossMove, coinArc, coinLine, hint, hz, item, rep } from './dsl';

const HOP = 0, BIG = 0.5; // hold lengths for coin arcs
const HIGH = 2.2; // balloons float just above her head in the chair (she's ~1.9 blocks tall with it)
const gift = (b: number) => hz(b, 'giftBox');
const bottle = (b: number) => hz(b, 'champagne');
const chair = (b: number) => hz(b, 'chair');
const cake = (b: number) => hz(b, 'cakeTable');
const tower = (b: number) => hz(b, 'champagneTower');
const balloons = (b: number) => hz(b, 'balloons', { b: 'static', y: HIGH });
const waiter = (b: number) => hz(b, 'waiter', { b: 'run', speed: 1 });
const spark = (b: number) => hz(b, 'sparkler', { b: 'pulse', period: 2, on: 1, phase: -0.5 }); // ON for [2k − ½, 2k + ½)
// Attacks leave his hands A blocks ahead of her. The blob lands 1 beat before she gets there (its shadow warns first).
const blob = (b: number) => attack(hz(b, 'webBlob', { b: 'lob', lead: 1, flight: 1, dx: A - 8, dy: 4 }), 'web', 1.5, 4, A);
const line = (b: number) => attack(hz(b, 'webLine', { b: 'fly', y: 2, speed: 1 }), 'line', 1.5, 4, A);
// Slow on purpose: a fast roller is short enough to hop, and the dive is a "hold".
const dive = (b: number) => attack(hz(b, 'spiderDive', { b: 'fly', y: 0, speed: 0.5 }), 'dive', 2, 4, A);
const smashRow = (from: number, n: number): HazardEvent[] =>
  rep(from, 0.5, n, (b, i) => [gift, chair, bottle][i % 3](b)) as HazardEvent[];

export const level3: LevelDef = {
  id: 'party',
  name: 'A Festa',
  theme: 'party',
  rafa: 'wheelchair',
  boss: 'aranha',
  bpm: 144,
  blocksPerBeat: 4,
  lengthBeats: 208,
  songId: 'party',
  marginMs: 55,
  // The song's layout: bossEnter is one bar, so the fight's sections sit on bar lines 4 beats off the 8-beat grid.
  sections: [
    { beat: 0, name: 'intro' },
    { beat: 8, name: 'warmup' },
    { beat: 40, name: 'main' },
    { beat: 88, name: 'gelol' },
    { beat: 112, name: 'bossEnter' },
    { beat: 116, name: 'boss1' },
    { beat: 140, name: 'boss2' },
    { beat: 164, name: 'boss3' },
    { beat: 188, name: 'finale' },
  ],
  ground: [[-8, 216]],
  chart: [
    // Intro (0–8): count-in at the door; a line of dumbbells shows what to collect.
    ...coinLine(4, 0.5, 6, 0.3),

    // Warm-up (8–40): arriving at the reception — gifts, bottles, a knocked-over chair; the first big pieces (signposted);
    // then the fountains: one met between bursts (roll), two met mid-burst (hold).
    gift(10), ...coinArc(9.65, HOP, 3, 144),
    bottle(12.5),
    chair(15), ...coinArc(14.65, HOP, 3, 144),
    gift(17.5),
    hint(19, 'SEGURE!'),
    tower(21), ...coinArc(20.5, BIG, 5),
    bottle(23.5),
    cake(26), ...coinArc(25.5, BIG, 5),
    chair(28.5),
    tower(31),
    spark(33), ...coinLine(32.75, 0.25, 3, 0.3),
    spark(36), ...coinArc(35.5, BIG, 5),
    spark(38),

    // Main (40–88): balloons (stay down), waiters, fountain rows, the cake and the tower; Whey and Pré-treino.
    gift(41.5),
    hint(42.5, 'NÃO PULE!'),
    balloons(44), ...coinLine(43.75, 0.5, 2, 0.3),
    waiter(46.5), ...coinArc(46, BIG, 5),
    item(48.5, 'whey'),
    bottle(49.5),
    tower(51.5),
    balloons(54),
    chair(55.75),
    spark(58), spark(59), spark(60), ...coinArc(57.5, BIG, 5), ...coinArc(59.5, BIG, 5), // ON, off, ON
    cake(62.5),
    gift(65),
    waiter(67.5),
    item(69.5, 'pre'),
    cake(72), ...coinLine(71.75, 0.25, 5, 4.6), // high line: only with the pré-treino air jump
    balloons(75),
    tower(77.5),
    spark(80), spark(81), spark(82),
    gift(84.5),
    cake(86.5), ...coinArc(86, BIG, 5),

    // Gelol (88–112): the drop as a reward — two Gelols keep the overdrive going 90–112 through a smash corridor; only
    // four big pieces, well apart, still want the hold.
    hint(88.5, 'ESMAGA!'),
    item(89.25, 'gelol'),
    ...smashRow(90, 8),
    tower(95.5),
    ...smashRow(97, 4),
    item(99.25, 'gelol'),
    ...smashRow(100, 8),
    cake(105.5),
    ...smashRow(107, 4),
    waiter(110),

    // Boss enter (111.25–116): the train bursts in from the right and slams to a stop on the boom at 112; he squats
    // on the roof through the honks. Whey for the fight.
    bossEnter(111.25),
    item(114, 'whey'), ...coinLine(114.5, 0.5, 3, 0.3),

    // Boss 1 (116–140): the squat taunt, then web blobs only (hop), with a few known party pieces.
    bossMove(116, 'taunt'),
    ...blob(123),
    ...blob(125.5),
    gift(128),
    ...blob(130.5),
    ...blob(133),
    bottle(135.5),
    ...blob(138),

    // Boss 2 (140–164): taunt, then he adds web lines at head height (stay down), between blobs.
    bossMove(140, 'taunt'),
    ...line(146),
    ...blob(148.5),
    ...blob(150.5),
    ...line(153),
    ...blob(156),
    ...line(158.5),
    gift(161),

    // Boss 3 (164–188): taunt, a Whey, then he adds the backflip dive (hold), mixed with lines and blobs.
    bossMove(164, 'taunt'),
    item(166, 'whey'),
    ...dive(171), ...coinArc(170.5, BIG, 5),
    ...blob(176.5),
    ...line(179),
    ...dive(182.5),
    bossMove(185, 'taunt'),

    // Finale (188–208): Gelol, she rams the train — he's tangled in his own web and ends head-first in the speaker —
    // the train rolls off, then a last smash run onto the middle of the dance floor.
    item(188.5, 'gelol'),
    bossExit(190),
    ...coinLine(191, 0.5, 4, 0.3),
    ...smashRow(194, 12),
    ...coinLine(201, 0.5, 12, 0.3),
  ],
};
