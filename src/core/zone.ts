// IANA time zone handling on top of Intl, which every target runtime has.
// Instants are epoch milliseconds (UTC). Wall times are what a clock in the
// zone shows. Converting wall → instant can hit a DST gap (the time does not
// exist) or overlap (it exists twice); we resolve both explicitly and report
// which happened so the "how was this computed" sheet can say so.

import type { WallTime } from './civil';

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      era: 'short',
    });
    formatters.set(zone, f);
  }
  return f;
}

export function isValidZone(zone: string): boolean {
  try {
    formatter(zone);
    return true;
  } catch {
    return false;
  }
}

export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function wallAt(epochMs: number, zone: string): WallTime {
  const parts = formatter(zone).formatToParts(new Date(epochMs));
  let y = 0, m = 0, d = 0, h = 0, mi = 0, s = 0, bc = false;
  for (const p of parts) {
    switch (p.type) {
      case 'year': y = Number(p.value); break;
      case 'month': m = Number(p.value); break;
      case 'day': d = Number(p.value); break;
      case 'hour': h = Number(p.value); break;
      case 'minute': mi = Number(p.value); break;
      case 'second': s = Number(p.value); break;
      case 'era': bc = /^B/i.test(p.value); break;
    }
  }
  if (bc) y = 1 - y;
  const ms = ((epochMs % 1000) + 1000) % 1000;
  return { y, m, d, h: h === 24 ? 0 : h, mi, s, ms };
}

function wallAsUTC(w: WallTime): number {
  const t = new Date(0);
  t.setUTCFullYear(w.y, w.m - 1, w.d);
  t.setUTCHours(w.h, w.mi, w.s, w.ms);
  return t.getTime();
}

/** Offset of `zone` from UTC at an instant, in ms (Seoul = +9h). */
export function offsetAt(epochMs: number, zone: string): number {
  return wallAsUTC(wallAt(epochMs, zone)) - epochMs;
}

export type Disambiguation = 'none' | 'gap' | 'overlap';

export interface ResolvedInstant {
  epochMs: number;
  adjustment: Disambiguation;
  /** For a gap, how far the wall time was pushed forward (ms). */
  shiftMs: number;
}

/**
 * Wall time → instant. Rules (same as Temporal's "compatible"):
 * a time inside a DST gap moves forward by the gap length; a time inside an
 * overlap takes the earlier of its two instants.
 */
export function resolveWall(w: WallTime, zone: string): ResolvedInstant {
  const local = wallAsUTC(w);
  const before = offsetAt(local - DAY, zone);
  const after = offsetAt(local + DAY, zone);
  const valid: number[] = [];
  for (const o of before === after ? [before] : [before, after]) {
    const t = local - o;
    if (offsetAt(t, zone) === o) valid.push(t);
  }
  if (valid.length === 0) {
    // Some zones change offset on a day boundary we did not sample; retry with
    // the offset found at the naive instant before declaring a gap.
    const o = offsetAt(local - before, zone);
    if (offsetAt(local - o, zone) === o) return { epochMs: local - o, adjustment: 'none', shiftMs: 0 };
    const t = local - before;
    return { epochMs: t, adjustment: 'gap', shiftMs: after - before };
  }
  if (valid.length === 2) return { epochMs: Math.min(...valid), adjustment: 'overlap', shiftMs: 0 };
  return { epochMs: valid[0], adjustment: 'none', shiftMs: 0 };
}

export function instantOf(w: WallTime, zone: string): number {
  return resolveWall(w, zone).epochMs;
}

/** Start of the civil day in `zone` (midnight, or the first instant after a midnight gap). */
export function startOfDay(y: number, m: number, d: number, zone: string): number {
  return instantOf({ y, m, d, h: 0, mi: 0, s: 0, ms: 0 }, zone);
}

export function formatOffset(ms: number): string {
  const sign = ms < 0 ? '−' : '+';
  const a = Math.abs(ms) / MINUTE;
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** Zones offered in the editor. Uses the runtime's list when available. */
export function knownZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  try {
    const list = intl.supportedValuesOf?.('timeZone');
    if (list && list.length) return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    /* fall through */
  }
  return [
    'UTC', 'Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Hong_Kong',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Berlin', 'Australia/Sydney',
  ];
}
