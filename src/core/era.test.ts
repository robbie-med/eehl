import { describe, expect, it } from 'vitest';
import { ERA_NAMES, japaneseEra } from './era';
import { d } from './testutil';

describe('Japanese era', () => {
  it('handles era boundaries', () => {
    expect(japaneseEra(d('1989-01-07'))).toEqual({ era: 'showa', year: 64 });
    expect(japaneseEra(d('1989-01-08'))).toEqual({ era: 'heisei', year: 1 });
    expect(japaneseEra(d('2019-04-30'))).toEqual({ era: 'heisei', year: 31 });
    expect(japaneseEra(d('2019-05-01'))).toEqual({ era: 'reiwa', year: 1 });
    expect(japaneseEra(d('1912-07-29'))).toEqual({ era: 'meiji', year: 45 });
    expect(japaneseEra(d('1912-07-30'))).toEqual({ era: 'taisho', year: 1 });
    expect(japaneseEra(d('1926-12-24'))).toEqual({ era: 'taisho', year: 15 });
    expect(japaneseEra(d('1926-12-25'))).toEqual({ era: 'showa', year: 1 });
  });
  it('counts years from Jan 1 after 元年', () => {
    expect(japaneseEra(d('2019-12-31'))).toEqual({ era: 'reiwa', year: 1 });
    expect(japaneseEra(d('2020-01-01'))).toEqual({ era: 'reiwa', year: 2 });
    expect(japaneseEra(d('2026-09-29'))).toEqual({ era: 'reiwa', year: 8 });
    expect(japaneseEra(d('1927-01-01'))).toEqual({ era: 'showa', year: 2 });
    expect(japaneseEra(d('1945-08-15'))).toEqual({ era: 'showa', year: 20 });
  });
  it('starts Meiji at Gregorian adoption', () => {
    expect(japaneseEra(d('1873-01-01'))).toEqual({ era: 'meiji', year: 6 });
    expect(japaneseEra(d('1872-12-31'))).toBeNull();
    expect(japaneseEra(d('1600-01-01'))).toBeNull();
  });
  it('names every era', () => {
    expect(ERA_NAMES.reiwa).toEqual({ ja: '令和', en: 'Reiwa', letter: 'R' });
    expect(Object.keys(ERA_NAMES)).toEqual(['meiji', 'taisho', 'showa', 'heisei', 'reiwa']);
    expect(Object.values(ERA_NAMES).map((e) => e.letter).join('')).toBe('MTSHR');
  });
});
