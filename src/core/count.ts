// The counting engine: where an event's dates fall, which date it is
// counting to or from right now, and every readout. The UI only formats
// what this returns.

import { addMonths, addYears, dayNumber, fromDayNumber, type Civil, type WallTime } from './civil';
import { diffCivil, diffInstants, hasTimeUnits, type UnitValues } from './diff';
import {
  dayNumberToLunar,
  lunarToDayNumber,
  resolveLunarAnniversary,
  type LunarAdjustment,
  type LunarCalendar,
  type LunarDate,
} from './lunar';
import type { CountEvent, Readout, Unit } from './types';
import { DAY, deviceZone, resolveWall, wallAt, type Disambiguation } from './zone';

export interface Occurrence {
  /** 0 = the original date, 1 = first anniversary / repeat, … */
  k: number;
  civil: Civil;
  day: number; // day number of civil
  /** Start instant: midnight for all-day events, else the event's wall time. */
  epochMs: number;
  lunar: LunarDate | null;
  lunarAdjustments: LunarAdjustment[];
  /** Feb 29 (or a 31st) that had to move to the month's last day. */
  clamped: boolean;
  dst: Disambiguation;
}

export function isLunar(ev: Pick<CountEvent, 'calendar'>): ev is { calendar: LunarCalendar } {
  return ev.calendar === 'korean-lunar' || ev.calendar === 'chinese-lunar';
}

/** The wall date and time of the anchor in the event's own zone. */
export function anchorWall(ev: Pick<CountEvent, 'epochMs' | 'zone'>): WallTime {
  return wallAt(ev.epochMs, ev.zone);
}

export function displayZoneOf(ev: Pick<CountEvent, 'displayZone' | 'zone'>): string {
  return ev.displayZone === 'device' ? deviceZone() : ev.zone;
}

function occurrenceCivil(ev: CountEvent, k: number): Omit<Occurrence, 'epochMs' | 'dst' | 'k'> | null {
  const w = anchorWall(ev);
  if (k === 0 || ev.repeat === 'none') {
    return { civil: w, day: dayNumber(w), lunar: ev.lunar, lunarAdjustments: [], clamped: false };
  }
  if (ev.repeat === 'yearly' && isLunar(ev) && ev.lunar) {
    const r = resolveLunarAnniversary(ev.calendar, ev.lunar, ev.lunar.year + k, ev.leapRule);
    if (!r) return null;
    return { civil: fromDayNumber(r.dayNumber), day: r.dayNumber, lunar: r.used, lunarAdjustments: r.adjustments, clamped: false };
  }
  const c = ev.repeat === 'yearly' ? addYears(w, k) : addMonths(w, k);
  return { civil: c, day: dayNumber(c), lunar: null, lunarAdjustments: [], clamped: c.d !== w.d };
}

/** The k-th occurrence of an event (k = 0 is the anchor itself). Null outside the lunar tables. */
export function occurrence(ev: CountEvent, k: number): Occurrence | null {
  const c = occurrenceCivil(ev, k);
  if (!c) return null;
  if (k === 0) {
    return { ...c, k, epochMs: ev.epochMs, dst: 'none' };
  }
  const w = anchorWall(ev);
  const r = resolveWall({ ...w, y: c.civil.y, m: c.civil.m, d: c.civil.d }, ev.zone);
  return { ...c, k, epochMs: r.epochMs, dst: r.adjustment };
}

/** Rough period of a repeat in days, for estimating which k is near a date. */
function period(ev: CountEvent): number {
  return ev.repeat === 'monthly' ? 30.436875 : 365.2425;
}

/**
 * The first occurrence whose date is on or after `day` (a day number in the
 * event's own calendar dates). For non-repeating events that is the anchor
 * when it is not in the past, else null.
 */
export function occurrenceOnOrAfter(ev: CountEvent, day: number): Occurrence | null {
  const first = occurrence(ev, 0);
  if (!first) return null;
  if (first.day >= day) return first;
  if (ev.repeat === 'none') return null;
  let k = Math.max(1, Math.floor((day - first.day) / period(ev)) - 1);
  for (let guard = 0; guard < 8; guard++, k++) {
    const o = occurrence(ev, k);
    if (!o) return null;
    if (o.day >= day) return o;
  }
  return null;
}

export function occurrenceBefore(ev: CountEvent, day: number): Occurrence | null {
  const next = occurrenceOnOrAfter(ev, day);
  if (next) return next.k > 0 ? occurrence(ev, next.k - 1) : null;
  if (ev.repeat === 'none') return occurrence(ev, 0);
  return null;
}

export type Mode = 'down' | 'up' | 'ended';

export interface CountState {
  now: number;
  zone: string; // display zone
  today: Civil;
  todayDay: number;
  origin: Occurrence;
  /** What the event is counting to (down) or from (up) right now. */
  target: Occurrence;
  mode: Mode;
  /** True when the target date is today. */
  isToday: boolean;
  /** Signed D-day number: negative before (D-12), 0 on the day, positive after (D+12). */
  dday: number;
  /** A countdown whose end behavior is 'archive' has ended; the store archives it. */
  shouldArchive: boolean;
}

/** Target day number as seen in the display zone. */
function dayIn(o: Occurrence, ev: CountEvent, zone: string): number {
  if (ev.allDay || zone === ev.zone) return o.day;
  return dayNumber(wallAt(o.epochMs, zone));
}

/**
 * Which date the event is about right now, and in which direction.
 *
 *  - Repeating events count down to the next occurrence (D-Day all day on it),
 *    unless direction is 'up', which counts up from the original date.
 *  - One-off events count down until their date, then count up (auto / flip),
 *    stop, or end and archive (direction 'down').
 *  - Day-one counting adds one to counts up, so the start day is D+1 / day 1.
 */
export function countState(ev: CountEvent, now: number): CountState | null {
  const zone = displayZoneOf(ev);
  const today = wallAt(now, zone);
  const todayDay = dayNumber(today);
  const origin = occurrence(ev, 0);
  if (!origin) return null;
  const base = { now, zone, today: { y: today.y, m: today.m, d: today.d }, todayDay, origin };
  const up = (from: Occurrence): CountState => {
    const n = todayDay - dayIn(from, ev, zone) + (ev.dayOne ? 1 : 0);
    return { ...base, target: from, mode: 'up', isToday: n === 0, dday: n, shouldArchive: false };
  };
  const down = (to: Occurrence): CountState => {
    const n = todayDay - dayIn(to, ev, zone);
    return { ...base, target: to, mode: 'down', isToday: n === 0, dday: n, shouldArchive: false };
  };

  if (ev.repeat !== 'none') {
    if (ev.direction === 'up' && dayIn(origin, ev, zone) <= todayDay) return up(origin);
    // Search a little before today in the event's calendar in case the
    // display zone is a day ahead or behind the event's zone.
    let o = occurrenceOnOrAfter(ev, todayDay - 1);
    while (o && dayIn(o, ev, zone) < todayDay) o = occurrence(ev, o.k + 1);
    return o ? down(o) : up(origin);
  }

  const originDay = dayIn(origin, ev, zone);
  const passed = ev.allDay ? todayDay > originDay : now >= origin.epochMs;
  if (!passed) {
    // Day-one counting makes the start day itself D+1.
    if (ev.allDay && ev.dayOne && todayDay === originDay) return up(origin);
    return down(origin);
  }
  if (ev.direction === 'down' && ev.endBehavior !== 'flip') {
    return { ...base, target: origin, mode: 'ended', isToday: false, dday: todayDay - originDay, shouldArchive: ev.endBehavior === 'archive' };
  }
  return up(origin);
}

export interface ReadoutValue {
  readout: Readout;
  /** 'until' counts down to the target, 'since' counts up from it. */
  direction: 'until' | 'since' | 'none';
  values: UnitValues;
  units: Unit[];
  dday?: number;
  mode: Mode;
  isToday: boolean;
  age?: { international: number; counting: number; year: number };
  percent?: { fraction: number; elapsedDays: number; remainingDays: number; totalDays: number };
  gestation?: { weeks: number; days: number; trimester: 1 | 2 | 3; totalDays: number };
  crossedGap: boolean;
  /** For 'origin' basis on repeating events: counting from the original date. */
  fromOrigin: boolean;
}

const DATE_UNITS = new Set<Unit>(['years', 'months', 'weeks', 'days']);

export function readoutValue(ev: CountEvent, st: CountState, r: Readout): ReadoutValue {
  const base = { readout: r, mode: st.mode, isToday: st.isToday, crossedGap: false, fromOrigin: false, units: r.units };
  switch (r.style) {
    case 'dday': {
      if (r.basis === 'origin' && ev.repeat !== 'none') {
        const n = st.todayDay - dayIn(st.origin, ev, st.zone) + (ev.dayOne ? 1 : 0);
        return { ...base, direction: n < 0 ? 'until' : 'since', values: {}, dday: n, fromOrigin: true, mode: n < 0 ? 'down' : 'up', isToday: n === 0 };
      }
      return { ...base, direction: st.mode === 'down' ? 'until' : st.mode === 'up' ? 'since' : 'none', values: {}, dday: st.dday };
    }
    case 'age': {
      const birth = st.origin.civil;
      const t = st.today;
      let international = t.y - birth.y;
      if (dayNumber(addYears(birth, international)) > st.todayDay) international--;
      return {
        ...base,
        direction: 'since',
        values: {},
        fromOrigin: true,
        age: { international: Math.max(0, international), counting: Math.max(1, t.y - birth.y + 1), year: Math.max(0, t.y - birth.y) },
      };
    }
    case 'percent': {
      const startMs = ev.spanStartMs ?? ev.createdAt;
      const endMs = st.origin.epochMs + (ev.inclusiveEnd && ev.allDay ? DAY : 0);
      const fraction = endMs > startMs ? Math.min(1, Math.max(0, (st.now - startMs) / (endMs - startMs))) : 1;
      const startDay = dayNumber(wallAt(startMs, ev.zone));
      const endDay = st.origin.day + (ev.inclusiveEnd ? 1 : 0);
      const one = ev.dayOne ? 1 : 0;
      const totalDays = endDay - startDay + one;
      const elapsedDays = Math.min(totalDays, Math.max(0, st.todayDay - startDay + one));
      return {
        ...base,
        direction: 'none',
        values: {},
        percent: { fraction, elapsedDays, remainingDays: Math.max(0, endDay - st.todayDay), totalDays },
      };
    }
    case 'gestation': {
      // Naegele: the due date is 40 weeks (280 days) after the last menstrual period.
      const total = 280 - (st.origin.day - st.todayDay);
      const weeks = Math.floor(total / 7);
      const days = total - weeks * 7;
      return {
        ...base,
        direction: 'until',
        values: {},
        gestation: { weeks, days, trimester: weeks < 14 ? 1 : weeks < 28 ? 2 : 3, totalDays: total },
      };
    }
    case 'units':
      return unitsValue(ev, st, r, base);
  }
}

function unitsValue(
  ev: CountEvent,
  st: CountState,
  r: Readout,
  base: Omit<ReadoutValue, 'direction' | 'values'>,
): ReadoutValue {
  const fromOrigin = r.basis === 'origin' && ev.repeat !== 'none';
  const target = fromOrigin ? st.origin : st.target;
  const originIsPast = st.todayDay >= dayIn(st.origin, ev, st.zone);
  const counting: 'until' | 'since' = fromOrigin ? (originIsPast ? 'since' : 'until') : st.mode === 'down' ? 'until' : 'since';
  if (st.mode === 'ended' && !fromOrigin) {
    return { ...base, direction: 'none', values: Object.fromEntries(r.units.map((u) => [u, 0])), fromOrigin };
  }
  const timed = hasTimeUnits(r.units);
  const dayOneShift = counting === 'since' && ev.dayOne ? 1 : 0;
  const inclusiveShift = counting === 'until' && ev.inclusiveEnd ? 1 : 0;

  if (!timed) {
    // Whole days on the calendar of the display zone.
    const targetDay = dayIn(target, ev, st.zone);
    const from = counting === 'since' ? targetDay - dayOneShift : st.todayDay;
    const to = counting === 'since' ? st.todayDay : targetDay + inclusiveShift;
    const d = diffCivil(from, Math.max(from, to), r.units.filter((u) => DATE_UNITS.has(u)), r.rounding);
    return { ...base, direction: counting, values: d.values, crossedGap: false, fromOrigin };
  }

  let targetMs = target.epochMs;
  if (ev.allDay && st.zone !== ev.zone) {
    const c = target.civil;
    targetMs = resolveWall({ y: c.y, m: c.m, d: c.d, h: 0, mi: 0, s: 0, ms: 0 }, st.zone).epochMs;
  }
  let from: number, to: number;
  if (counting === 'since') {
    from = dayOneShift ? shiftDays(targetMs, -1, st.zone) : targetMs;
    to = st.now;
  } else {
    from = st.now;
    to = inclusiveShift ? shiftDays(targetMs, 1, st.zone) : targetMs;
  }
  if (to < from) {
    // A countdown whose moment passed earlier today (non-flipping) stays at zero.
    return { ...base, direction: counting, values: Object.fromEntries(r.units.map((u) => [u, 0])), fromOrigin };
  }
  const d = diffInstants(from, to, r.units, r.rounding, st.zone);
  return { ...base, direction: counting, values: d.values, crossedGap: d.crossedGap, fromOrigin };
}

function shiftDays(ms: number, n: number, zone: string): number {
  const w = wallAt(ms, zone);
  const c = fromDayNumber(dayNumber(w) + n);
  return resolveWall({ ...w, y: c.y, m: c.m, d: c.d }, zone).epochMs;
}

/** Lunar date for a Gregorian day number, when the event is lunar. */
export function lunarOf(ev: CountEvent, day: number): LunarDate | null {
  if (!isLunar(ev)) return null;
  return dayNumberToLunar(ev.calendar, day);
}

/** Gregorian civil date of a lunar date, or null if it does not exist. */
export function solarOfLunar(cal: LunarCalendar, ld: LunarDate): Civil | null {
  const n = lunarToDayNumber(cal, ld);
  return n === null ? null : fromDayNumber(n);
}
