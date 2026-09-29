import { describe, expect, it } from 'vitest';
import { dayNumber, fromDayNumber } from './civil';
import { dayNumberToLunar, leapMonthOf, lunarToDayNumber, resolveLunarAnniversary, type LunarCalendar } from './lunar';
import { d } from './testutil';

const solar = (cal: LunarCalendar, year: number, month: number, day: number, leap = false) => {
  const n = lunarToDayNumber(cal, { year, month, day, leap });
  return n === null ? null : fromDayNumber(n);
};

describe('lunar calendars', () => {
  it('knows Seollal and Chuseok', () => {
    expect(solar('korean-lunar', 2025, 1, 1)).toEqual(d('2025-01-29'));
    expect(solar('korean-lunar', 2026, 1, 1)).toEqual(d('2026-02-17'));
    expect(solar('korean-lunar', 2024, 8, 15)).toEqual(d('2024-09-17'));
    expect(solar('korean-lunar', 2025, 8, 15)).toEqual(d('2025-10-06'));
    expect(solar('korean-lunar', 2026, 8, 15)).toEqual(d('2026-09-25'));
    expect(solar('chinese-lunar', 2026, 1, 1)).toEqual(d('2026-02-17'));
  });
  it('knows leap months, including where Korea and China differ', () => {
    expect(leapMonthOf('korean-lunar', 2023)).toBe(2);
    expect(leapMonthOf('korean-lunar', 2025)).toBe(6);
    expect(leapMonthOf('korean-lunar', 2020)).toBe(4);
    expect(leapMonthOf('korean-lunar', 2017)).toBe(5);
    expect(leapMonthOf('chinese-lunar', 2017)).toBe(6);
    expect(leapMonthOf('korean-lunar', 2026)).toBe(0);
    expect(solar('korean-lunar', 2017, 5, 1, true)).toEqual(d('2017-06-24'));
    expect(solar('chinese-lunar', 2017, 5, 1, true)).toBeNull();
  });
  it('round-trips every day 1900–2100', () => {
    for (const cal of ['korean-lunar', 'chinese-lunar'] as const) {
      for (let n = dayNumber(d('1900-02-01')); n <= dayNumber(d('2100-12-31')); n++) {
        const l = dayNumberToLunar(cal, n)!;
        expect(lunarToDayNumber(cal, l)).toBe(n);
      }
    }
  });
  it('agrees with the runtime ICU where it has the calendar', () => {
    const fmt = new Intl.DateTimeFormat('en-u-ca-dangi', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    for (let n = dayNumber(d('1950-01-01')); n <= dayNumber(d('2060-01-01')); n += 37) {
      const l = dayNumberToLunar('korean-lunar', n)!;
      const parts = fmt.formatToParts(new Date(n * 86400000));
      const month = parts.find((p) => p.type === 'month')!.value;
      expect(`${l.month}${l.leap ? 'bis' : ''}/${l.day}`).toBe(`${month}/${parts.find((p) => p.type === 'day')!.value}`);
    }
  });
  it('observes leap-month anniversaries on the regular month by default', () => {
    const born = { year: 2017, month: 5, day: 10, leap: true };
    const r = resolveLunarAnniversary('korean-lunar', born, 2026, 'regular')!;
    expect(r.used).toEqual({ year: 2026, month: 5, day: 10, leap: false });
    expect(r.adjustments).toContain('leap-to-regular');
    // 2028 has 윤5월 in Korea? If so, 'leap-when-exists' uses it.
    const year = [2028, 2036, 2039, 2047].find((y) => leapMonthOf('korean-lunar', y) === 5)!;
    const l = resolveLunarAnniversary('korean-lunar', born, year, 'leap-when-exists')!;
    expect(l.used.leap).toBe(true);
    const reg = resolveLunarAnniversary('korean-lunar', born, year, 'regular')!;
    expect(reg.used.leap).toBe(false);
    expect(l.dayNumber - reg.dayNumber).toBeGreaterThanOrEqual(29);
  });
  it('moves a missing 30th day to the 29th', () => {
    // Find a year where month 3 has 29 days.
    for (let y = 2027; y < 2040; y++) {
      if (lunarToDayNumber('korean-lunar', { year: y, month: 3, day: 30, leap: false }) === null) {
        const r = resolveLunarAnniversary('korean-lunar', { year: 2000, month: 3, day: 30, leap: false }, y, 'regular')!;
        expect(r.used.day).toBe(29);
        expect(r.adjustments).toContain('day-30-to-29');
        return;
      }
    }
    throw new Error('no short month found');
  });
});
