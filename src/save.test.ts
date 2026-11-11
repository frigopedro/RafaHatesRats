import { describe, expect, it } from 'vitest';
import { defaultSettings, parseSave } from './save';

describe('parseSave', () => {
  it('turns garbage into defaults', () => {
    for (const raw of [null, 42, 'x', [], { levels: 'no', settings: [1] }]) {
      expect(parseSave(raw)).toEqual({ levels: {}, settings: defaultSettings() });
    }
  });

  it('clamps and drops bad fields', () => {
    const s = parseSave({
      levels: { gym: { best: 140, coins: -3, attempts: 7.4, done: 'yes' }, 'EVIL!': { best: 50 }, party: null, __proto__x: 1 },
      settings: { music: 250, sfx: NaN, reduceFx: 1 },
    }, true);
    expect(s.levels).toEqual({
      gym: { best: 100, coins: 0, attempts: 7, done: false },
      party: { best: 0, coins: 0, attempts: 0, done: false },
    });
    expect(s.settings).toEqual({ music: 100, sfx: 80, reduceFx: true });
  });

  it('maps the old numeric level 1 to gym and drops old levels 2 and 3', () => {
    const old = { levels: { 1: { best: 41, attempts: 9 }, 2: { best: 80 }, 3: { best: 5 } }, settings: { music: 30, sfx: 40, reduceFx: false } };
    const s = parseSave(old);
    expect(s.levels).toEqual({ gym: { best: 41, coins: 0, attempts: 9, done: false } });
    expect(s.settings).toEqual({ music: 30, sfx: 40, reduceFx: false });
    expect(parseSave({ levels: { 1: { best: 10 }, gym: { best: 70 } } }).levels.gym.best).toBe(70);
  });

  it('keeps a valid save as is', () => {
    const ok = { levels: { church: { best: 63, coins: 21, attempts: 40, done: true } }, settings: { music: 0, sfx: 55, reduceFx: false } };
    expect(parseSave(JSON.parse(JSON.stringify(ok)), true)).toEqual(ok);
  });
});
