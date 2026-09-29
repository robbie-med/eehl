import { describe, expect, it } from 'vitest';
import { addMonths, addYears, dayNumber, fromDayNumber, monthsBetween, parseISODate, toISODate, weekday } from './civil';
import { d } from './testutil';

describe('civil dates', () => {
  it('round-trips day numbers across 1600–2400', () => {
    for (let n = dayNumber(d('1600-01-01')); n <= dayNumber(d('2400-12-31')); n += 7) {
      expect(dayNumber(fromDayNumber(n))).toBe(n);
    }
  });
  it('matches Date.UTC', () => {
    for (let n = -30000; n <= 60000; n += 97) {
      const t = new Date(n * 86400000);
      expect(fromDayNumber(n)).toEqual({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
    }
  });
  it('clamps month arithmetic to month end', () => {
    expect(addMonths(d('2023-01-31'), 1)).toEqual(d('2023-02-28'));
    expect(addMonths(d('2024-01-31'), 1)).toEqual(d('2024-02-29'));
    expect(addMonths(d('2024-03-31'), -1)).toEqual(d('2024-02-29'));
    expect(addYears(d('2024-02-29'), 1)).toEqual(d('2025-02-28'));
    expect(addYears(d('2024-02-29'), 4)).toEqual(d('2028-02-29'));
  });
  it('counts whole months like a person', () => {
    expect(monthsBetween(d('2024-01-31'), d('2024-02-29'))).toBe(1);
    expect(monthsBetween(d('2024-01-31'), d('2024-02-28'))).toBe(0);
    expect(monthsBetween(d('2024-01-15'), d('2025-01-14'))).toBe(11);
    expect(monthsBetween(d('2024-01-15'), d('2025-01-15'))).toBe(12);
  });
  it('knows weekdays', () => {
    expect(weekday(d('2026-09-29'))).toBe(2); // Tuesday
    expect(weekday(d('1970-01-01'))).toBe(4);
  });
  it('parses and prints ISO dates', () => {
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(toISODate(d('0999-03-04'))).toBe('0999-03-04');
  });
});
