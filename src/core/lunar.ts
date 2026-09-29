// Korean (음력, dangi) and Chinese (农历) lunisolar dates, backed by the
// frozen ICU tables in lunar-data.ts. Korea and China occasionally disagree
// because Korea computes new moons at UTC+9 and China at UTC+8 (2017 is the
// classic example: Korea had 윤5월, China had 闰六月).

import { CHINESE, DANGI, LUNAR_FIRST_YEAR, LUNAR_LAST_YEAR } from './lunar-data';

export type LunarCalendar = 'korean-lunar' | 'chinese-lunar';

export interface LunarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-30
  leap: boolean;
}

/**
 * How a lunar anniversary is observed in a year when its original month was
 * a leap month:
 *  - 'regular': always on the regular (평달) month of the same number. This is
 *    the traditional Korean practice for 윤달 birthdays and 기일, and the default.
 *  - 'leap-when-exists': on the leap month in years that have one of the same
 *    number, otherwise on the regular month.
 */
export type LeapRule = 'regular' | 'leap-when-exists';

export const LUNAR_RANGE = { first: LUNAR_FIRST_YEAR, last: LUNAR_LAST_YEAR };

interface MonthInfo {
  month: number;
  leap: boolean;
  start: number; // day number
  length: 29 | 30;
}

const cache = new Map<string, MonthInfo[] | null>();

function rows(cal: LunarCalendar) {
  return cal === 'korean-lunar' ? DANGI : CHINESE;
}

function months(cal: LunarCalendar, year: number): MonthInfo[] | null {
  const key = cal + year;
  if (cache.has(key)) return cache.get(key)!;
  let result: MonthInfo[] | null = null;
  const row = rows(cal)[year - LUNAR_FIRST_YEAR];
  if (row) {
    const [start, leap, bits] = row;
    result = [];
    let day = start;
    let month = 1;
    const count = leap ? 13 : 12;
    for (let i = 0; i < count; i++) {
      const isLeap = leap > 0 && i === leap; // the leap month follows its regular month
      const length = (bits & (1 << i)) !== 0 ? 30 : 29;
      result.push({ month: isLeap ? leap : month, leap: isLeap, start: day, length });
      day += length;
      if (!isLeap) month++;
    }
  }
  cache.set(key, result);
  return result;
}

export function inLunarRange(year: number): boolean {
  return year >= LUNAR_FIRST_YEAR && year <= LUNAR_LAST_YEAR;
}

/** The leap month of a lunar year (0 when it has none). */
export function leapMonthOf(cal: LunarCalendar, year: number): number {
  return rows(cal)[year - LUNAR_FIRST_YEAR]?.[1] ?? 0;
}

export function lunarMonthLength(cal: LunarCalendar, year: number, month: number, leap: boolean): number | null {
  return months(cal, year)?.find((m) => m.month === month && m.leap === leap)?.length ?? null;
}

/** Lunar → day number, or null when that date does not exist. */
export function lunarToDayNumber(cal: LunarCalendar, ld: LunarDate): number | null {
  const info = months(cal, ld.year)?.find((m) => m.month === ld.month && m.leap === ld.leap);
  if (!info || ld.day < 1 || ld.day > info.length) return null;
  return info.start + ld.day - 1;
}

/** Day number → lunar date, or null outside the table. */
export function dayNumberToLunar(cal: LunarCalendar, n: number): LunarDate | null {
  const table = rows(cal);
  // Lunar years start between Jan 21 and Feb 20, so the year is the
  // Gregorian year or the one before it.
  let lo = 0;
  let hi = table.length - 1;
  if (n < table[0][0]) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (table[mid][0] <= n) lo = mid;
    else hi = mid - 1;
  }
  const year = LUNAR_FIRST_YEAR + lo;
  const list = months(cal, year)!;
  for (const m of list) {
    if (n >= m.start && n < m.start + m.length) return { year, month: m.month, day: n - m.start + 1, leap: m.leap };
  }
  return null; // past the end of the last table year
}

export type LunarAdjustment = 'leap-to-regular' | 'leap-kept' | 'day-30-to-29';

export interface ResolvedLunar {
  dayNumber: number;
  /** The lunar date actually used in that year. */
  used: LunarDate;
  adjustments: LunarAdjustment[];
}

/**
 * Where a lunar anniversary of `original` falls in lunar year `year`.
 * Rules, all shown in the explanation sheet:
 *  - leap months follow `rule` (see LeapRule);
 *  - a 30th day in a year where that month has 29 days is observed on the
 *    29th (the last day of the month, 그믐), which is the common practice.
 */
export function resolveLunarAnniversary(
  cal: LunarCalendar,
  original: LunarDate,
  year: number,
  rule: LeapRule,
): ResolvedLunar | null {
  const list = months(cal, year);
  if (!list) return null;
  const adjustments: LunarAdjustment[] = [];
  let leap = false;
  if (original.leap) {
    if (rule === 'leap-when-exists' && leapMonthOf(cal, year) === original.month) {
      leap = true;
      adjustments.push('leap-kept');
    } else {
      adjustments.push('leap-to-regular');
    }
  }
  const info = list.find((m) => m.month === original.month && m.leap === leap)!;
  let day = original.day;
  if (day > info.length) {
    day = info.length;
    adjustments.push('day-30-to-29');
  }
  return { dayNumber: info.start + day - 1, used: { year, month: original.month, day, leap }, adjustments };
}
