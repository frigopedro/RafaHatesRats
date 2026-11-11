// L3 "A Festa" — 144 BPM, A♭ major / F minor. Bright hard-dance party: four-on-the-floor, rolling off-beat bass,
// supersaw anthem (I–V–vi–IV); main builds into the Gelol drop. The boss drops into funk carioca for O Aranha da
// Carreta (party-train honks, apito, tamborzão-style kick/tom/clap syncopation, sliding 808, call and response).
// The finale is the drop a tone higher.
import { each, oct, rep, type PartDef, type SongDef } from '../song';

const roll = (r: string) => rep(`.:1 ${r}:1 ${r}:1 ${r}:1`, 4);
const arp16 = (a: string, b: string, c: string) => rep(`${a}:1 ${b}:1 ${c}:1 ${b}:1`, 4);

const FOUR = 'X...x...x...x...';
const BACK = '....x.......x...';
const OPEN = '..x...x...x...x.';
const ROOTS = 'ab1 eb2 f2 db2';
const ARP = [arp16('eb4', 'ab4', 'c5'), arp16('eb4', 'g4', 'bb4'), arp16('f4', 'ab4', 'c5'), arp16('f4', 'ab4', 'db5')].join(' | ');
const AB = 'c5:4 eb5:2 c5:2 ab4:3 c5:3 eb5:2', EB = 'g5:6 f5:2 eb5:4 bb4:4';
const FM = 'c5:4 ab4:2 f4:2 c5:3 db5:3 c5:2', DB = 'ab4:4 f4:2 db4:2 f4:3 ab4:3 db5:2';
const THEME = [AB, EB, FM, DB].join(' | ');
const ANTHEM = [THEME, 'c5:4 eb5:2 ab5:2 g5:3 f5:3 eb5:2', 'f5:3 g5:3 bb5:2 ~c6:8', FM, DB].join(' | ');
const ROLL = 'o.o.o.o.x.x.xxXX';

const drop: PartDef = {
  chords: 'Ab Eb Fm Db', pad: 0.15,
  kick: FOUR, clap: BACK, hat: 'xxxxxxxxxxxxxxxx', open: OPEN,
  bass: each(ROOTS, roll), arp: ARP, lead: ANTHEM,
};

// The funk, written in A minor, played in F minor (key +8; leads an octave down to stay in range).
const F = 8;
const funk: PartDef = {
  key: F, sound: { kick: '808', bass: '808', lead: 'square' },
  kick: 'X..x....X..x....', clap: '......X.......X.', snare: '......x.......x.', tom: '..x.o..x..x.o..x', hat: 'xoxoxoxoxoxoxoxo', open: OPEN,
  chords: 'Am', bass: 'a1:3 a2:3 ~e2:2 a1:3 c2:3 ~d2:2',
};
const FILL = '..x.o..xXxXxXxXx';

export const party: SongDef = {
  id: 'party',
  title: 'A Festa',
  bpm: 144,
  tonic: 70, // the finale is a tone up (B♭)
  sound: { kick: 'punch', bass: 'saw', lead: 'supersaw' },
  lengthBeats: 208,
  layout: [
    { beat: 0, name: 'intro' }, { beat: 8, name: 'warmup' }, { beat: 40, name: 'main' }, { beat: 88, name: 'gelol' },
    { beat: 112, name: 'bossEnter' }, { beat: 116, name: 'boss1' }, { beat: 140, name: 'boss2' },
    { beat: 164, name: 'boss3' }, { beat: 188, name: 'finale' },
  ],
  parts: {
    intro: {
      chords: 'Ab', pad: 0.25,
      kick: 'X...............', count: 'eb5:4 eb5:4 eb5:4 ab5:4', riser: 4,
      end: { kick: FOUR, snare: '........o.o.oxxX', open: OPEN },
    },
    warmup: {
      chords: 'Ab Eb Fm Db',
      kick: FOUR, clap: BACK, hat: 'oxxxoxxxoxxxoxxx', open: OPEN,
      bass: each(ROOTS, roll), arp: ARP,
      end: { snare: '............oxxX' },
    },
    // The build: the theme, then riser and roll into the drop.
    main: {
      chords: 'Ab Eb Fm Db', pad: 0.12,
      kick: FOUR, clap: BACK, hat: 'x.xxx.xxx.xxx.xx', open: OPEN,
      bass: each(ROOTS, roll), lead: THEME, riser: 4,
      end: { snare: ROLL, kick: 'X...x...x.......' },
    },
    gelol: { ...drop, riser: 4, end: { snare: ROLL } },
    // The switch: one boom, two party-train honks, an apito trill and a tom pickup straight into the funk.
    bossEnter: {
      ...funk, chords: 'E7', kick: 'X...............', clap: undefined, snare: undefined, open: undefined, hat: '........x.x.x.x.',
      bass: 'e2:4 .:12', horn: 'e3:3 .:1 e3:4 .:8', whistle: '........X.......', cuica: '....o...........', tom: '............ooxX',
    },
    boss1: { ...funk, cuica: 'x...............', end: { tom: FILL, whistle: '........x.x.x.x.' } },
    // Call (square) and response (chip blips).
    boss2: {
      ...funk, lead: oct('e5:3 e5:3 g5:2 .:8', -1), count: oct('.:8 a5:3 g5:3 e5:2', -1),
      end: { tom: FILL, cuica: 'x.......o.......' },
    },
    boss3: {
      ...funk, chords: 'Am Am Dm E7', cuica: 'x.......o.......',
      bass: 'a1:3 a2:3 ~e2:2 a1:3 c2:3 ~d2:2 | a1:3 a2:3 ~e2:2 a1:3 c2:3 ~d2:2 | d2:3 d3:3 ~a2:2 d2:3 f2:3 ~g2:2 | e2:3 e3:3 ~b2:2 e2:3 g#2:3 ~b2:2',
      lead: oct('e5:3 e5:3 g5:2 .:8 | g5:3 g5:3 a5:2 .:8', -1), count: oct('.:8 a5:3 g5:3 e5:2 | .:8 c6:3 b5:3 a5:2', -1),
      riser: 2,
      end: { tom: FILL, whistle: '........X.......', cuica: '................' },
    },
    // The last Gelol: the drop again, a tone higher.
    finale: { ...drop, key: 2, pad: 0.25 },
  },
};
