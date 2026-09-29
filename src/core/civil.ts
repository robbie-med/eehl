// Proleptic Gregorian civil dates as plain numbers. Day numbers count days
// since 1970-01-01 (day 0), so they are time-zone free.

export interface Civil {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

export interface WallTime extends Civil {
  h: number;
  mi: number;
  s: number;
  ms: number;
}

// Howard Hinnant's days_from_civil / civil_from_days.
export function dayNumber({ y, m, d }: Civil): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDayNumber(n: number): Civil {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return m === 2 ? (isLeapYear(y) ? 29 : 28) : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(c: Civil): number {
  return (((dayNumber(c) + 4) % 7) + 7) % 7;
}

export function addDays(c: Civil, n: number): Civil {
  return fromDayNumber(dayNumber(c) + n);
}

/**
 * Month arithmetic with the stated rule: when the target month is shorter,
 * clamp to its last day (Jan 31 + 1 month = Feb 28 or 29).
 */
export function addMonths(c: Civil, n: number): Civil {
  const total = c.y * 12 + (c.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return { y, m, d: Math.min(c.d, daysInMonth(y, m)) };
}

export function addYears(c: Civil, n: number): Civil {
  return addMonths(c, n * 12);
}

/** True when adding months to `c` had to clamp the day. */
export function monthAddClamps(c: Civil, n: number): boolean {
  return addMonths(c, n).d !== c.d;
}

export function compareCivil(a: Civil, b: Civil): number {
  return dayNumber(a) - dayNumber(b);
}

export function sameCivil(a: Civil, b: Civil): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

export function parseISODate(s: string): Civil | null {
  const m = /^(-?\d{4,6})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const c = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  if (c.m < 1 || c.m > 12 || c.d < 1 || c.d > daysInMonth(c.y, c.m)) return null;
  return c;
}

export function toISODate(c: Civil): string {
  const y = c.y < 0 ? '-' + String(-c.y).padStart(6, '0') : String(c.y).padStart(4, '0');
  return `${y}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
}

/** Whole calendar months from a to b (b >= a), the way a person counts them. */
export function monthsBetween(a: Civil, b: Civil): number {
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (months > 0 && compareCivil(addMonths(a, months), b) > 0) months--;
  if (months < 0 && compareCivil(addMonths(a, months), b) < 0) months++;
  return months;
}
