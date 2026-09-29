import { describe, expect, it } from 'vitest';
import { Formatter } from './format';
import { en } from './en';
import { ko } from './ko';

const ko1 = new Formatter({ lang: 'ko', dateFormat: 'locale', manGrouping: true, ddayScript: 'hangul' });
const en1 = new Formatter({ lang: 'en', dateFormat: 'DDMMMYYYY', manGrouping: false, ddayScript: 'latin' });

function keys(o: unknown, prefix = ''): string[] {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return [prefix];
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix + '.' + k));
}

describe('format', () => {
  it('formats D-day', () => {
    expect(en1.dday(-12)).toBe('D-12');
    expect(en1.dday(0)).toBe('D-Day');
    expect(ko1.dday(0)).toBe('디데이');
    expect(en1.dday(1408)).toBe('D+1,408');
  });
  it('groups by 만', () => {
    expect(ko1.num(12345)).toBe('1만 2,345');
    expect(ko1.num(10000)).toBe('1만');
    expect(ko1.num(123456789)).toBe('1억 2,345만 6,789');
    expect(ko1.num(9999)).toBe('9,999');
  });
  it('formats units and dates', () => {
    expect(en1.units({ years: 1, months: 2, days: 1 }, ['years', 'months', 'days'])).toBe('1 year 2 months 1 day');
    expect(ko1.units({ weeks: 1666 }, ['weeks'])).toBe('1,666주');
    expect(en1.date({ y: 2026, m: 9, d: 28 })).toBe('28SEP2026');
    expect(ko1.date({ y: 2026, m: 9, d: 28 }, true)).toBe('2026년 9월 28일 (월)');
    expect(ko1.lunar({ year: 2017, month: 5, day: 3, leap: true }, 'korean-lunar')).toBe('음력 윤5월 3일');
  });
  it('has every Korean string', () => {
    expect(keys(ko).sort()).toEqual(keys(en).filter((k) => !/weddingNames\.\d+$/.test(k)).concat(keys(ko).filter((k) => /weddingNames\.\d+$/.test(k))).sort());
  });
});

describe('units display', () => {
  it('drops leading zero units but keeps a final zero', () => {
    expect(en1.units({ years: 0, months: 9, days: 5 }, ['years', 'months', 'days'])).toBe('9 months 5 days');
    expect(en1.units({ years: 0, months: 0, days: 0 }, ['years', 'months', 'days'])).toBe('0 days');
    expect(en1.units({ years: 1, months: 0, days: 5 }, ['years', 'months', 'days'])).toBe('1 year 0 months 5 days');
  });
});
