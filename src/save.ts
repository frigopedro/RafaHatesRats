// Progress + settings in one localStorage key. Everything read back is validated and clamped: corrupt or foreign
// JSON gives defaults, and storage errors (private mode, quota) are swallowed so the game always runs.

export interface LevelSave {
  best: number; // best progress, 0..100 (%)
  coins: number; // most golden dumbbells in a finished run
  attempts: number;
  done: boolean;
}

export interface Settings {
  music: number; // 0..100
  sfx: number; // 0..100
  reduceFx: boolean; // less shake / flash / confetti
}

export interface Save {
  levels: Record<string, LevelSave>; // keyed by level id ('gym', 'church', 'party')
  settings: Settings;
}

const KEY = 'rhr.save.v1';

const num = (v: unknown, max: number, def = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : def;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

export function defaultSettings(reduceMotion = false): Settings {
  return { music: 80, sfx: 80, reduceFx: reduceMotion };
}

/** Any JSON value → a valid Save. `reduceMotion` is the default for reduceFx when none was saved. */
export function parseSave(raw: unknown, reduceMotion = false): Save {
  const r = obj(raw), s = obj(r.settings), d = defaultSettings(reduceMotion);
  const levels: Record<string, LevelSave> = {};
  for (const [key, v] of Object.entries(obj(r.levels))) {
    // Before the story rewrite ids were numbers and level 1 was already the gym; old 2 and 3 no longer exist.
    // Integer keys enumerate first, so a real 'gym' entry overwrites a migrated '1'.
    const id = key === '1' ? 'gym' : key;
    if (!/^[a-z][a-z0-9_-]{0,23}$/.test(id)) continue;
    const l = obj(v);
    levels[id] = { best: num(l.best, 100), coins: num(l.coins, 9999), attempts: num(l.attempts, 1e9), done: l.done === true };
  }
  return {
    levels,
    settings: {
      music: num(s.music, 100, d.music),
      sfx: num(s.sfx, 100, d.sfx),
      reduceFx: typeof s.reduceFx === 'boolean' ? s.reduceFx : d.reduceFx,
    },
  };
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function load(): Save {
  try {
    return parseSave(JSON.parse(localStorage.getItem(KEY) ?? 'null'), reduceMotion());
  } catch {
    return parseSave(null, reduceMotion());
  }
}

export const save: Save = load();

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / quota: progress just isn't kept */
  }
}

export function levelSave(id: string): LevelSave {
  return (save.levels[id] ??= { best: 0, coins: 0, attempts: 0, done: false });
}

export function resetProgress(): void {
  save.levels = {};
  persist();
}

// Settings for other modules (audio volumes, game effects): read with getSettings(), react with onSettings().
const subs = new Set<(s: Settings) => void>();
export const getSettings = (): Readonly<Settings> => save.settings;
export function onSettings(fn: (s: Settings) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
export function setSettings(patch: Partial<Settings>): void {
  Object.assign(save.settings, patch);
  persist();
  for (const fn of subs) fn(save.settings);
}
