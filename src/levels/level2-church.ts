// Level 2 — A Madrinha. 132 BPM, 176 beats, no boss: Rafa on a crutch hurries down the aisle to beat the bride
// to the altar, Giovanni a step behind her (cosmetic, src/game/companion.ts).
// Same reading rules as the gym: small = tap (hop), big = hold (big jump), high (doves, lanterns) = stay down.
// Teaches: small church clutter (warmup), the big pieces one at a time, then doves and lanterns alternating with
// things to jump (main), a Gelol smash through the aisle, and the "A noiva tá chegando!" dash, each section adding
// one runner: the flower girl and ring bearer (hop), rice thrown from the pews (hop), the photographer (big jump).
// Hazards sit on the march's accents: bars start every 4 beats from 8, the long c5 lands on bar + 1.
import type { HazardEvent, LevelDef } from '../types';
import { coinArc, coinLine, hint, hz, item, rep } from './dsl';

const HOP = 0, BIG = 0.5; // hold lengths for coin arcs
const HIGH = 2.5; // just above crutch-Rafa's hair (≈ 2.3 blocks), so they read as "stay down"
const GALLERY = 7.75; // choir-loft rail (manifest: y 48 art px = 248 above the ground line)
const lantern = (beat: number) => hz(beat, 'lantern', { b: 'static', y: HIGH });
const dove = (beat: number, speed = 2) => hz(beat, 'dove', { b: 'fly', y: HIGH - 0.1, speed });
const books = (beat: number) => hz(beat, 'hymnBooks', { b: 'drop', lead: 1, from: GALLERY });
// A handful thrown from a pew just ahead: short low arc, lands as a pile.
const rice = (beat: number) => hz(beat, 'rice', { b: 'lob', lead: 0.75, flight: 0.75, dx: 2, dy: 1.5 });
const girl = (beat: number, speed = 2) => hz(beat, 'flowerGirl', { b: 'run', speed });
const boy = (beat: number, speed = 2) => hz(beat, 'ringBearer', { b: 'run', speed });
const photographer = (beat: number) => hz(beat, 'photographer', { b: 'run', speed: 1 }); // backs into the aisle
const SMALL = ['rice', 'flowerBasket', 'kneeler', 'hymnBooks'] as const;
const smashRow = (from: number, n: number): HazardEvent[] =>
  rep(from, 0.5, n, (b, i) => hz(b, SMALL[i % SMALL.length])) as HazardEvent[];

export const level2: LevelDef = {
  id: 'church',
  name: 'A Madrinha',
  theme: 'church',
  rafa: 'crutches',
  companion: 'giovanni',
  bpm: 132,
  blocksPerBeat: 4,
  lengthBeats: 176,
  songId: 'church',
  marginMs: 75,
  sections: [ // the song's layout (src/audio/songs/church.ts)
    { beat: 0, name: 'intro' },
    { beat: 8, name: 'warmup' },
    { beat: 40, name: 'main' },
    { beat: 88, name: 'gelol' },
    { beat: 112, name: 'bossEnter' },
    { beat: 116, name: 'boss1' },
    { beat: 132, name: 'boss2' },
    { beat: 148, name: 'boss3' },
    { beat: 168, name: 'finale', checkpoint: false }, // needs the Gelol picked up at 166.75
  ],
  ground: [[-8, 184]],
  chart: [
    // Intro (0–8): the church doors, the organ alone.
    hint(3, 'ATRASADA!'),
    ...coinLine(5, 0.5, 5, 0.3),

    // Warm-up (8–40): one small thing at a time, on the march's accents.
    hz(13, 'kneeler'), ...coinArc(12.65, HOP, 3, 132),
    hz(17, 'flowerBasket'),
    hz(21, 'hymnBooks'), ...coinArc(20.65, HOP, 3, 132),
    hz(25, 'kneeler'),
    hz(27.5, 'flowerBasket'),
    hz(30, 'hymnBooks'),
    hz(33, 'flowerBasket'), ...coinArc(32.65, HOP, 3, 132),
    hz(35.5, 'kneeler'),
    hz(38, 'hymnBooks'),

    // Main (40–88): the big pieces one at a time, then doves and lanterns (stay down) between things to jump.
    hint(41, 'SEGURE!'),
    hz(43, 'pewEnd'), ...coinArc(42.5, BIG, 5),
    hz(46, 'kneeler'),
    hz(49, 'candleStand'), ...coinArc(48.5, BIG, 5),
    item(51, 'whey'),
    hz(52.5, 'flowerStand'), ...coinArc(52, BIG, 5),
    hint(55, 'NÃO PULE!'),
    lantern(57), lantern(58), ...coinLine(56.5, 0.5, 4, 0.3),
    books(60.5),
    dove(63),
    hz(65.5, 'pewEnd'),
    hz(68, 'flowerBasket'),
    dove(70.5),
    item(71.5, 'pre'),
    hz(73, 'flowerStand'), ...coinLine(73, 0.25, 5, 4.6), // high line: only with the pré-treino air jump
    books(75.5),
    lantern(78),
    hz(80.5, 'candleStand'), ...coinArc(80, BIG, 5),
    hz(83, 'kneeler'),
    hz(85.5, 'hymnBooks'),

    // Gelol corridor (88–112): overdrive 89–101 smashes the clutter; big pieces still need the big jump.
    hint(87, 'ESMAGA!'),
    item(88.75, 'gelol'),
    ...smashRow(90, 6),
    hz(94.5, 'pewEnd'),
    ...smashRow(96.5, 5),
    hz(100.5, 'flowerStand'),
    hz(103.5, 'kneeler'),
    dove(106),
    hz(108.5, 'candleStand'), ...coinArc(108, BIG, 5),

    // "A noiva tá chegando!" (112–116): bells, a sign, a Whey for the dash. Nathalia appears behind (cosmetic).
    hint(113, 'A NOIVA TÁ CHEGANDO!'),
    item(114.5, 'whey'), ...coinLine(115, 0.5, 4, 0.3),

    // Dash 1 (116–132): the flower girl and the ring bearer sprint up the aisle; doves keep "don't jump" alive.
    girl(118), boy(120.5),
    dove(123),
    girl(125.5),
    hz(128, 'pewEnd'),
    boy(130.5),

    // Dash 2 (132–148): + rice thrown from the pews (lands as a pile).
    rice(134), girl(136.25),
    dove(138.75),
    rice(141), hz(143.25, 'candleStand'),
    rice(145.5),
    item(147, 'whey'),

    // Dash 3 (148–168): + the photographer backing into the aisle (big; his flash a beat ahead is the tell).
    hint(148.5, 'SEGURE!'),
    photographer(150.5), rice(152.75),
    dove(155),
    girl(157), photographer(159.25),
    boy(161.5), rice(163.75),
    dove(166),
    item(166.75, 'gelol'),

    // Finale (168–176): Gelol from 167 smashes through the last of the aisle, then the altar.
    ...smashRow(169, 6),
    ...coinLine(172.5, 0.5, 6, 0.3),
  ],
};
