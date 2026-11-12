import type { LevelDef } from '../types';
import { level1 } from './level1-gym';
import { level2 } from './level2-church';
import { level3 } from './level3-party';

/** Level registry, in play order. Levels 2 and 3 get appended here. */
export const LEVELS: LevelDef[] = [level1, level2, level3];
