// L1 "Campeonato Gym Rats" — 120 BPM, A minor. Bouncy electro/chiptune; the boss sections are Fabinho's theme: a
// bratty lead on taunting "nyah-nyah" intervals (falling minor third, up a fourth), an oom-pah chase, and a
// double-time tantrum.
import { each, oct, rep, type SongDef } from '../song';

const up = (n: string) => oct(n);
const bounce = (r: string) => rep(`${r} ${up(r)}`, 4); // 8th-note octave bounce
const pump = (r: string) => `${r} ${up(r)}:1 ${r}:1 .:2 ${up(r)} ${r} ${up(r)}:1 ${r}:1 ${r} ${up(r)}`;
const drive = (r: string) => rep(`${r}:1 ${r}:1 ${up(r)}:1 ${r}:1`, 4);

const FOUR = 'X...x...x...x...';
const BACK = '....x.......x...';
// Fabinho's material, written in D minor and played a fourth down (key −5) with the bass an octave up.
const FAB = -5;
const CHASE = 'd5:1 c#5:1 d5:2 f5:1 e5:1 f5:2 a5:2 g#5:1 a5:1 d6:4';
const CHASE_A = 'c#5:1 b4:1 c#5:2 e5:1 d5:1 e5:2 g5:2 f#5:1 g5:1 c#6:4';
const CHASES = [CHASE, CHASE, CHASE_A, CHASE].join(' | ');
const TAUNT = '.:8 c6:2 a5:2 d6:1 c6:1 a5:2';
const POLKA = oct(each('d2 d2 a1 d2', (r) => (r === 'a1' ? 'a1:4 e2:4 a1:4 e2:4' : `${r}:4 a1:4 ${r}:4 a1:4`)));
const OOMPAH = { chords: 'Dm Dm A7 Dm', key: FAB, kick: FOUR, snare: '..x...x...x...x.', bass: POLKA };
const ROLL = 'o.o.o.o.x.x.xxXX';

const HOOK_A = 'e5:2 e5:1 .:1 c5:2 e5:2 a5:3 g5:3 e5:2 | f5:3 e5:3 c5:2 a4:4 .:2 c5:2';
const HOOK = [
  HOOK_A, 'e5:2 e5:1 .:1 c5:2 e5:2 g5:3 a5:3 g5:2 | d5:3 b4:3 g4:2 ~b4:4 .:4',
  HOOK_A, 'e5:2 e5:1 .:1 c5:2 e5:2 g5:3 c6:3 b5:2 | d5:3 e5:3 g5:2 a5:6 .:2',
].join(' | ');

export const gym: SongDef = {
  id: 'gym',
  title: 'Campeonato Gym Rats',
  bpm: 120,
  tonic: 69,
  sound: { kick: 'punch', bass: 'saw', lead: 'pulse' },
  lengthBeats: 144,
  layout: [
    { beat: 0, name: 'intro' }, { beat: 8, name: 'warmup' }, { beat: 40, name: 'main' }, { beat: 72, name: 'gelol' },
    { beat: 96, name: 'bossEnter' }, { beat: 100, name: 'boss1' }, { beat: 112, name: 'boss2' },
    { beat: 124, name: 'boss3' }, { beat: 136, name: 'finale' },
  ],
  parts: {
    // Count-in: a coach's "1, 2, 3, 4" over a lone downbeat, then four-on-the-floor and a roll into the warm-up.
    intro: {
      chords: 'Am', pad: 0.25,
      kick: 'X...............', count: 'e5:4 e5:4 e5:4 a5:4', riser: 4,
      end: { kick: FOUR, snare: '........o.o.oxxX', hat: 'o.x.o.x.o.x.o.x.' },
    },
    // Drums, octave-bounce bass and a plucked arp; a light lead only in the second half.
    warmup: {
      chords: 'Am Am F G',
      kick: FOUR, clap: BACK, hat: 'o.x.o.x.o.x.o.x.',
      bass: each('a2 a2 f2 g2', bounce),
      arp: oct('a4 c5 e5 c5 a4 c5 e5 c5 | a4 c5 e5 a5 g5 e5 c5 e5 | a4 c5 f5 c5 a4 c5 f5 a5 | g4 b4 d5 b4 g4 b4 d5 g5', -1),
      lead: `${rep('.:16', 4)} | a4:3 c5:3 e5:2 d5:2 c5:2 a4:4 | .:2 e5:2 g5:3 e5:3 d5:2 c5:4 | c5:3 a4:3 c5:2 f5:4 e5:2 d5:2 | d5:3 b4:3 g4:2 d5:4 b4:2 .:2`,
      end: { snare: '............o.xX' },
    },
    // The hook.
    main: {
      chords: 'Am F C G', pad: 0.18,
      kick: FOUR, clap: BACK, hat: 'x.oxx.oxx.oxx.ox',
      bass: each('a2 f2 c3 g2', pump),
      lead: HOOK, riser: 4,
      end: { snare: '........o.o.oxXX', clap: '....x...........' },
    },
    // Gelol corridor: driving 16th bass, open hats, lead up high (the overdrive layer goes on top).
    gelol: {
      chords: 'F G Em Am', pad: 0.2,
      kick: FOUR, clap: BACK, hat: 'x...x...x...x...', open: '..x...x...x...x.',
      bass: each('f2 g2 e2 a2', drive),
      lead: 'a5:2 g5:2 f5:2 e5:2 f5:3 g5:3 a5:2 | b5:3 a5:3 g5:2 d5:4 g5:4 | g5:2 f5:2 e5:2 d5:2 e5:3 g5:3 b5:2 | c6:3 b5:3 a5:2 e5:4 a5:4',
      riser: 4,
      end: { snare: 'o.o.o.o.x.x.xxXX', clap: '................' },
    },
    // Fabinho shows up: one hit, the taunt up high, a roll into the chase.
    bossEnter: {
      chords: 'A7', key: FAB,
      kick: 'X...............', bass: 'a2:2 .:14', lead: 'c6:2 a5:2 d6:1 c6:1 a5:4 .:6', snare: '..........o.oxxX',
    },
    // Oom-pah chase: bass on the beat, snare on every offbeat, chromatic lead.
    boss1: { ...OOMPAH, lead: CHASES, end: { snare: ROLL } },
    boss2: { ...OOMPAH, hat: 'xoxoxoxoxoxoxoxo', lead: CHASES, count: TAUNT, end: { snare: ROLL } },
    // The tantrum: double-time kicks and snare, the chase an octave up.
    boss3: {
      ...OOMPAH, pad: 0.15,
      kick: 'X.x.x.x.X.x.x.x.', snare: '..x.x.xx..x.x.xx', hat: 'xoxoxoxoxoxoxoxo',
      lead: oct(CHASES), count: TAUNT, riser: 4,
      end: { snare: 'xxxxxxxxxxxxXXXX' },
    },
    // Victory: bVI–bVII–I into A major, back to the bright electro.
    finale: {
      chords: 'F:2 G:2 A', pad: 0.3,
      kick: FOUR, clap: BACK, hat: 'x...x...x...x...', open: '..x...x...x...x.',
      bass: 'f2 f3 f2 f3 g2 g3 g2 g3 | a2 a3 a2 a3 a2 a3 a2 a3',
      lead: 'a4:2 c5:2 f5:4 b4:2 d5:2 g5:4 | c#5:2 e5:2 a5:4 e5:2 a5:2 c#6:4',
    },
  },
};
