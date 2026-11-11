import type { LevelDef } from '../types';
import { level1 } from './level1-gym';

/** Level registry, in play order. Levels 2 and 3 get appended here. */
export const LEVELS: LevelDef[] = [level1];
