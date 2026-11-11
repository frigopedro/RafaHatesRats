// L2 "A Madrinha" — 132 BPM, C major. Up-tempo chiptune dance arrangement of the Bridal Chorus (Wagner, Lohengrin,
// 1850 — public domain) on a chip pipe organ: solemn organ intro, then the beat drops under it. No boss: bossEnter
// and boss1–3 are the "the bride is coming!" dash — church bells, the march in double time, a key lift per section.
// Finale: arrival at the altar, a big organ cadence.
import { each, oct, rep, type SongDef } from '../song';

const up = (n: string) => oct(n);
const half = (r: string) => `${r} ${up(r)} ${r} ${up(r)}`; // half a bar of octave bounce
const drive = (r: string) => rep(`${r}:1 ${r}:1 ${up(r)}:1 ${r}:1`, 2); // half a bar of 16ths

const FOUR = 'X...x...x...x...';
const BACK = '....x.......x...';
const OPEN = '..x...x...x...x.';
const ROLL = 'o.o.o.o.x.x.xxXX';

// "Here comes the bride / all dressed in white …", one phrase per bar.
const BRIDE = [
  'g4:4 c5:6 c5:2 c5:4', 'g4:4 d5:6 b4:2 c5:4', 'g4:4 c5:6 f5:2 f5:4', 'e5:4 d5:2 c5:2 b4:4 c5:2 d5:2',
  'g4:4 c5:6 c5:2 c5:4', 'g4:4 d5:6 b4:2 c5:4', 'g4:4 c5:6 e5:2 g5:4', 'f5:4 d5:2 b4:2 c5:8',
].join(' | ');
const BRIDE_CHORDS = 'C G:2 C:2 F C:2 G:2 C G:2 C:2 C G:2 C:2';
const BRIDE_BASS = [
  `${half('c2')} ${half('c2')}`, `${half('g1')} ${half('c2')}`, `${half('f2')} ${half('f2')}`, `${half('c2')} ${half('g1')}`,
  `${half('c2')} ${half('c2')}`, `${half('g1')} ${half('c2')}`, `${half('c2')} ${half('c2')}`, `${half('g1')} ${half('c2')}`,
].join(' | ');
const A: Record<string, string> = { C: 'e4:1 g4:1 c5:1 g4:1', G: 'd4:1 g4:1 b4:1 g4:1', F: 'f4:1 a4:1 c5:1 a4:1' };
const BRIDE_ARP = ['CC', 'GC', 'FF', 'CG', 'CC', 'GC', 'CC', 'GC'].map((h) => rep(A[h[0]], 2) + ' ' + rep(A[h[1]], 2)).join(' | ');
// The march in double time: two phrases per bar.
const DASH = [
  'g4:2 c5:3 c5:1 c5:2 g4:2 d5:3 b4:1 c5:2', 'g4:2 c5:3 f5:1 f5:2 e5:2 d5:1 c5:1 b4:2 c5:1 d5:1',
  'g4:2 c5:3 c5:1 c5:2 g4:2 d5:3 b4:1 c5:2', 'g4:2 c5:3 e5:1 g5:2 f5:2 d5:1 b4:1 c5:4',
].join(' | ');
const DASH_CHORDS = 'C:2 G:1 C:1 F:2 C:1 G:1 C:2 G:1 C:1 C:2 G:1 C:1';
const DASH_BASS = [
  `${drive('c2')} ${drive('g1')}`, `${drive('f2')} ${drive('c2')}`, `${drive('c2')} ${drive('g1')}`, `${drive('c2')} ${drive('c2')}`,
].join(' | ');
const DASH_ARP = each('c c f c', (r) =>
  r === 'f' ? rep('f4:1 a4:1 c5:1 a4:1', 4) : rep('e4:1 g4:1 c5:1 g4:1', 4));
const dash = {
  chords: DASH_CHORDS, kick: FOUR, clap: BACK, open: OPEN, bass: DASH_BASS, lead: oct(DASH), arp: DASH_ARP,
  bell: 'c6:16', end: { snare: ROLL },
};

export const church: SongDef = {
  id: 'church',
  title: 'A Madrinha',
  bpm: 132,
  tonic: 65, // the finale lands in F
  sound: { kick: 'punch', bass: 'saw', lead: 'organ' },
  lengthBeats: 176,
  layout: [
    { beat: 0, name: 'intro' }, { beat: 8, name: 'warmup' }, { beat: 40, name: 'main' }, { beat: 88, name: 'gelol' },
    { beat: 112, name: 'bossEnter' }, { beat: 116, name: 'boss1' }, { beat: 132, name: 'boss2' },
    { beat: 148, name: 'boss3' }, { beat: 168, name: 'finale' },
  ],
  parts: {
    // The organ alone, as in church (a bell on each downbeat); a roll on the last beat cues the drop.
    intro: {
      chords: 'C G:2 C:2', pad: 0.12,
      kick: 'X...............', bell: 'c5:16', lead: 'g4:4 c5:6 c5:2 c5:4 | g4:4 d5:6 b4:2 c5:4',
      end: { snare: '............oxxX' },
    },
    // The beat drops under the organ.
    warmup: {
      chords: BRIDE_CHORDS,
      kick: FOUR, clap: BACK, hat: 'o.x.o.x.o.x.o.x.',
      bass: BRIDE_BASS, lead: BRIDE,
      end: { snare: '............o.xX' },
    },
    // Video-game wedding: the march on the chip lead an octave up, the organ holding chords, 16th arp.
    main: {
      chords: BRIDE_CHORDS, pad: 0.15, sound: { lead: 'pulse' },
      kick: FOUR, clap: BACK, hat: 'x.oxx.oxx.oxx.ox',
      bass: BRIDE_BASS, lead: oct(BRIDE), arp: BRIDE_ARP, riser: 4,
      end: { snare: ROLL },
    },
    gelol: {
      chords: DASH_CHORDS, pad: 0.15,
      kick: FOUR, clap: BACK, hat: 'x...x...x...x...', open: OPEN,
      bass: DASH_BASS, lead: oct(DASH), riser: 4,
      end: { snare: ROLL },
    },
    // "A noiva está chegando!": the bells peal, one organ chord, a roll.
    bossEnter: {
      chords: 'C', pad: 0.4,
      kick: 'X...............', bell: 'c6:4 g5:4 e5:4 c5:4', snare: '........o.o.oxxX',
    },
    boss1: { ...dash, key: 1 },
    boss2: { ...dash, key: 2, hat: 'xxxxxxxxxxxxxxxx', bell: 'c6:8 g5:8' },
    boss3: { ...dash, key: 3, hat: 'xxxxxxxxxxxxxxxx', snare: '....x..x....x.xx', bell: 'c6:4 g5:4 c6:4 g5:4', riser: 4, end: { snare: 'xxxxxxxxxxxxXXXX' } },
    // At the altar: IV–V–I on the full organ, bells.
    finale: {
      chords: 'F:2 G:2 C', pad: 0.4, key: 5,
      kick: 'X.......X.......', lead: 'a4:8 b4:8 | c5:16', bell: '.:16 | c6:8 g5:8',
    },
  },
};
