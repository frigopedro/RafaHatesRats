import { compileSong, type Song } from '../song';
import { church } from './church';
import { gym } from './gym';
import { party } from './party';

/** By LevelDef.songId: 'gym' (L1), 'church' (L2), 'party' (L3). */
export const SONGS: Record<string, Song> = Object.fromEntries([gym, church, party].map((d) => [d.id, compileSong(d)]));
