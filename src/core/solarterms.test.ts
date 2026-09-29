import { describe, expect, it } from 'vitest';
import { dayNumber, fromDayNumber } from './civil';
import { solarTermDay, solarTermsBetween, solarTermsInYear, TERM_KEYS, termLongitude } from './solarterms';
import { d } from './testutil';

const day = (s: string) => dayNumber(d(s));
const utc = (s: string) => Date.parse(s.replace(' ', 'T') + ':00Z');
const termAt = (year: number, key: string) => solarTermsInYear(year).find((t) => t.key === key)!.epochMs;

describe('solar terms', () => {
  it('has 24 stable keys starting at minor cold (285°)', () => {
    expect(TERM_KEYS).toHaveLength(24);
    expect(new Set(TERM_KEYS).size).toBe(24);
    expect(TERM_KEYS[0]).toBe('minor-cold');
    expect(termLongitude(0)).toBe(285);
    expect(termLongitude(TERM_KEYS.indexOf('spring-equinox'))).toBe(0);
    expect(termLongitude(TERM_KEYS.indexOf('summer-solstice'))).toBe(90);
    expect(termLongitude(TERM_KEYS.indexOf('autumn-equinox'))).toBe(180);
    expect(termLongitude(TERM_KEYS.indexOf('winter-solstice'))).toBe(270);
  });

  it('matches published equinox and solstice instants within 2 minutes', () => {
    const cases: [number, string, string][] = [
      [2024, 'spring-equinox', '2024-03-20 03:06'],
      [2024, 'summer-solstice', '2024-06-20 20:51'],
      [2024, 'autumn-equinox', '2024-09-22 12:44'],
      [2024, 'winter-solstice', '2024-12-21 09:20'],
      [2000, 'spring-equinox', '2000-03-20 07:35'],
      [2000, 'summer-solstice', '2000-06-21 01:48'],
      [2026, 'spring-equinox', '2026-03-20 14:46'],
      [2026, 'autumn-equinox', '2026-09-23 00:05'],
      [2026, 'winter-solstice', '2026-12-21 20:50'],
    ];
    for (const [year, key, when] of cases) {
      expect(Math.abs(termAt(year, key) - utc(when)), `${year} ${key}`).toBeLessThanOrEqual(2 * 60_000);
    }
  });

  it('gives Korean dates in Asia/Seoul', () => {
    expect(solarTermDay(2026, 'start-of-spring', 'Asia/Seoul')).toBe(day('2026-02-04'));
    expect(solarTermDay(2026, 'spring-equinox', 'Asia/Seoul')).toBe(day('2026-03-20'));
    expect(solarTermDay(2026, 'summer-solstice', 'Asia/Seoul')).toBe(day('2026-06-21'));
    expect(solarTermDay(2026, 'winter-solstice', 'Asia/Seoul')).toBe(day('2026-12-22'));
    expect(solarTermDay(2026, 'minor-cold', 'Asia/Seoul')).toBe(day('2026-01-05'));
  });

  it('gives Chinese and Japanese dates in their zones', () => {
    expect(solarTermDay(2025, 'clear-and-bright', 'Asia/Shanghai')).toBe(day('2025-04-04'));
    expect(solarTermDay(2026, 'clear-and-bright', 'Asia/Shanghai')).toBe(day('2026-04-05'));
    expect(solarTermDay(2026, 'spring-equinox', 'Asia/Tokyo')).toBe(day('2026-03-20'));
    expect(solarTermDay(2026, 'autumn-equinox', 'Asia/Tokyo')).toBe(day('2026-09-23'));
    expect(solarTermDay(2024, 'spring-equinox', 'Asia/Tokyo')).toBe(day('2024-03-20'));
    expect(solarTermDay(2024, 'autumn-equinox', 'Asia/Tokyo')).toBe(day('2024-09-22'));
  });

  it('depends on the zone', () => {
    // 2026 winter solstice is 20:50 UTC on Dec 21.
    expect(solarTermDay(2026, 'winter-solstice', 'UTC')).toBe(day('2026-12-21'));
    expect(solarTermDay(2026, 'winter-solstice', 'America/New_York')).toBe(day('2026-12-21'));
    expect(solarTermDay(2026, 'winter-solstice', 'Asia/Tokyo')).toBe(day('2026-12-22'));
  });

  it('returns every term once per year, in order, and nothing outside 1900–2100', () => {
    for (const year of [1900, 1970, 2026, 2100]) {
      const terms = solarTermsInYear(year);
      expect(terms.map((t) => t.key)).toEqual([...TERM_KEYS]);
      for (let i = 1; i < 24; i++) {
        const gap = (terms[i].epochMs - terms[i - 1].epochMs) / 86_400_000;
        expect(gap).toBeGreaterThan(14);
        expect(gap).toBeLessThan(16.1);
      }
      expect(fromDayNumber(Math.floor(terms[0].epochMs / 86_400_000)).y).toBe(year);
      expect(fromDayNumber(Math.floor(terms[23].epochMs / 86_400_000)).y).toBe(year);
    }
    expect(solarTermsInYear(1899)).toEqual([]);
    expect(solarTermsInYear(2101)).toEqual([]);
    expect(solarTermDay(2101, 'minor-cold', 'UTC')).toBeNull();
    expect(solarTermDay(2026, 'not-a-term', 'UTC')).toBeNull();
  });

  it('lists terms between two days, inclusive and across years', () => {
    const list = solarTermsBetween(day('2025-12-01'), day('2026-02-04'), 'Asia/Seoul');
    expect(list.map((t) => t.key)).toEqual(['major-snow', 'winter-solstice', 'minor-cold', 'major-cold', 'start-of-spring']);
    expect(list[list.length - 1].day).toBe(day('2026-02-04'));
    expect(solarTermsBetween(day('2026-02-05'), day('2026-02-17'), 'Asia/Seoul')).toEqual([]);
    expect(solarTermsBetween(day('2026-03-01'), day('2026-02-01'), 'Asia/Seoul')).toEqual([]);
    const year = solarTermsBetween(day('2026-01-01'), day('2026-12-31'), 'Asia/Shanghai');
    expect(year).toHaveLength(24);
    for (let i = 1; i < year.length; i++) expect(year[i].day).toBeGreaterThan(year[i - 1].day);
    expect(solarTermsBetween(day('1890-01-01'), day('1900-01-10'), 'UTC').map((t) => t.key)).toEqual(['minor-cold']);
  });
});
