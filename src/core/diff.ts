// Calendar-aware differences between two instants, in a chosen set of units.
//
// Rules (stated in the explanation sheet):
//  - years and months use calendar arithmetic on the wall clock of the zone,
//    added to the start together (Jan 31 + 1 month = Feb 28/29);
//  - weeks and days are calendar days on that wall clock, so a DST change
//    does not turn one day into 23 or 25 hours;
//  - hours, minutes and seconds are exact elapsed time;
//  - rounding applies to the smallest selected unit; rounding up carries
//    into larger units (6 days 23 h rounded to days = 1 week).

import { addDays, addMonths, dayNumber, monthsBetween, type WallTime } from './civil';
import { HOUR, MINUTE, resolveWall, wallAt } from './zone';
import { UNITS, type Rounding, type Unit } from './types';

export type UnitValues = Partial<Record<Unit, number>>;

export interface DiffResult {
  values: UnitValues;
  /** +1 when `to` is after `from`, -1 when before, 0 when equal (after rounding). */
  sign: 1 | 0 | -1;
  /** True when a DST gap was stepped over while adding calendar units. */
  crossedGap: boolean;
}

const TIME_MS: Partial<Record<Unit, number>> = { hours: HOUR, minutes: MINUTE, seconds: 1000 };

function sortUnits(units: Unit[]): Unit[] {
  const set = new Set(units);
  const out = UNITS.filter((u) => set.has(u));
  return out.length ? out : ['days'];
}

interface Timeline {
  wall(ms: number): WallTime;
  instant(w: WallTime): { ms: number; gap: boolean };
}

function zoneTimeline(zone: string): Timeline {
  return {
    wall: (ms) => wallAt(ms, zone),
    instant: (w) => {
      const r = resolveWall(w, zone);
      return { ms: r.epochMs, gap: r.adjustment === 'gap' };
    },
  };
}

/** Pure civil-day timeline (no zone, no DST) for all-day, date-only counting. */
const civilTimeline: Timeline = {
  wall: (ms) => {
    const n = Math.floor(ms / 86_400_000);
    const d = new Date(n * 86_400_000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: 0, mi: 0, s: 0, ms: 0 };
  },
  instant: (w) => ({ ms: dayNumber(w) * 86_400_000, gap: false }),
};

function withDate(w: WallTime, c: { y: number; m: number; d: number }): WallTime {
  return { ...w, y: c.y, m: c.m, d: c.d };
}

interface Decomposition {
  values: UnitValues;
  end: number; // instant reached by the whole-unit values
  next: number; // instant one smallest-unit step past `end`
  gap: boolean;
}

function decompose(a: number, b: number, units: Unit[], tl: Timeline): Decomposition {
  const values: UnitValues = {};
  const wa = tl.wall(a);
  const smallest = units[units.length - 1];
  let gap = false;
  let cursor = a;
  let next = a;

  const hasY = units.includes('years');
  const hasM = units.includes('months');
  let monthsUsed = 0;
  if (hasY || hasM) {
    const wb = tl.wall(b);
    let total = monthsBetween(wa, wb);
    // Time of day can push the last month back by one.
    const at = (n: number) => tl.instant(withDate(wa, addMonths(wa, n)));
    while (total > 0 && at(total).ms > b) total--;
    while (at(total + 1).ms <= b) total++;
    const step = hasM ? 1 : 12;
    monthsUsed = total - (total % step);
    if (hasY) values.years = Math.floor(monthsUsed / 12);
    if (hasM) values.months = hasY ? monthsUsed % 12 : monthsUsed;
    const r = at(monthsUsed);
    gap ||= r.gap;
    cursor = r.ms;
    if (smallest === 'years' || smallest === 'months') next = at(monthsUsed + step).ms;
  }

  const hasW = units.includes('weeks');
  const hasD = units.includes('days');
  if (hasW || hasD) {
    const base = withDate(wa, addMonths(wa, monthsUsed));
    const at = (n: number) => tl.instant(withDate(base, addDays(base, n)));
    const wc = tl.wall(cursor);
    const wb = tl.wall(b);
    let days = Math.max(0, dayNumber(wb) - dayNumber(wc));
    while (days > 0 && at(days).ms > b) days--;
    while (at(days + 1).ms <= b) days++;
    const step = hasD ? 1 : 7;
    const used = days - (days % step);
    if (hasW) values.weeks = Math.floor(used / 7);
    if (hasD) values.days = hasW ? used % 7 : used;
    const r = at(used);
    gap ||= r.gap;
    cursor = r.ms;
    if (smallest === 'weeks' || smallest === 'days') next = at(used + step).ms;
  }

  let rest = b - cursor;
  for (const u of ['hours', 'minutes', 'seconds'] as const) {
    if (!units.includes(u)) continue;
    const size = TIME_MS[u]!;
    const n = Math.floor(rest / size);
    values[u] = n;
    rest -= n * size;
    cursor += n * size;
    if (u === smallest) next = cursor + size;
  }
  return { values, end: cursor, next, gap };
}

/**
 * Difference from instant `from` to instant `to` in `zone`. Values are always
 * non-negative; `sign` says which way. Pass zone = null for civil-day counting.
 */
export function diffInstants(
  from: number,
  to: number,
  unitList: Unit[],
  rounding: Rounding,
  zone: string | null,
): DiffResult {
  const units = sortUnits(unitList);
  const tl = zone ? zoneTimeline(zone) : civilTimeline;
  const forward = to >= from;
  const a = forward ? from : to;
  const b = forward ? to : from;
  let d = decompose(a, b, units, tl);
  let gap = d.gap;
  if (d.end < b && rounding !== 'floor') {
    // For a countdown, "round up" means toward the larger magnitude either way.
    const up = rounding === 'ceil' || b - d.end >= d.next - b;
    if (up) {
      d = decompose(a, d.next, units, tl);
      gap ||= d.gap;
    }
  }
  const zero = units.every((u) => !d.values[u]);
  return { values: d.values, sign: zero ? 0 : forward ? 1 : -1, crossedGap: gap };
}

/** Civil-date difference (all-day events counted in whole days). */
export function diffCivil(fromDay: number, toDay: number, units: Unit[], rounding: Rounding): DiffResult {
  return diffInstants(fromDay * 86_400_000, toDay * 86_400_000, units.filter((u) => !TIME_MS[u]), rounding, null);
}

export function hasTimeUnits(units: Unit[]): boolean {
  return units.some((u) => TIME_MS[u] !== undefined);
}
