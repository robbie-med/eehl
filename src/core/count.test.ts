import { describe, expect, it } from 'vitest';
import { countState, readoutValue } from './count';
import { readout } from './presets';
import { at, ev } from './testutil';

describe('counting', () => {
  it('counts down to an all-day date', () => {
    const e = ev('2026-10-01');
    const st = countState(e, at('2026-09-29 12:00'))!;
    expect(st.mode).toBe('down');
    expect(st.dday).toBe(-2);
    expect(readoutValue(e, st, readout('units', ['days'])).values).toEqual({ days: 2 });
  });
  it('shows D-Day on the day, then flips to D+', () => {
    const e = ev('2026-10-01');
    expect(countState(e, at('2026-10-01 23:59'))!).toMatchObject({ mode: 'down', dday: 0, isToday: true });
    expect(countState(e, at('2026-10-02 00:00'))!).toMatchObject({ mode: 'up', dday: 1 });
  });
  it('counts the start day as day 1 for couples', () => {
    const e = ev('2026-01-01', { preset: 'couple' });
    expect(countState(e, at('2026-01-01 08:00'))!.dday).toBe(1);
    expect(countState(e, at('2026-04-10 08:00'))!.dday).toBe(100); // 100일 = start + 99
    const days = readoutValue(e, countState(e, at('2026-04-10 08:00'))!, readout('units', ['days']));
    expect(days.values.days).toBe(100);
  });
  it('ends and archives a finished exam', () => {
    const e = ev('2026-11-12', { preset: 'exam' });
    expect(countState(e, at('2026-11-12 10:00'))!).toMatchObject({ mode: 'down', dday: 0 });
    expect(countState(e, at('2026-11-13 10:00'))!).toMatchObject({ mode: 'ended', shouldArchive: true });
  });
  it('counts birthdays to the next occurrence with ages', () => {
    const e = ev('1990-10-05', { preset: 'birthday' });
    const st = countState(e, at('2026-09-29 12:00'))!;
    expect(st.target.civil).toMatchObject({ y: 2026, m: 10, d: 5 });
    expect(st.dday).toBe(-6);
    expect(readoutValue(e, st, readout('age')).age).toEqual({ international: 35, counting: 37, year: 36 });
    const after = countState(e, at('2026-10-06 12:00'))!;
    expect(after.target.civil).toMatchObject({ y: 2027, m: 10, d: 5 });
    expect(readoutValue(e, after, readout('age')).age!.international).toBe(36);
  });
  it('moves Feb 29 birthdays to Feb 28 in common years', () => {
    const e = ev('2000-02-29', { preset: 'birthday' });
    const st = countState(e, at('2026-02-01 12:00'))!;
    expect(st.target.civil).toMatchObject({ y: 2026, m: 2, d: 28 });
    expect(st.target.clamped).toBe(true);
  });
  it('resolves lunar birthdays each year', () => {
    const e = ev('1960-01-01', {
      preset: 'birthday',
      calendar: 'korean-lunar',
      lunar: { year: 1960, month: 8, day: 15, leap: false },
    });
    const st = countState(e, at('2026-09-01 12:00'))!;
    expect(st.target.civil).toMatchObject({ y: 2026, m: 9, d: 25 }); // Chuseok 2026
  });
  it('counts timed events in hours and flips after the moment', () => {
    const e = ev('2026-09-29', { time: { h: 18, mi: 0 } });
    const before = countState(e, at('2026-09-29 17:00'))!;
    expect(before.mode).toBe('down');
    expect(readoutValue(e, before, readout('units', ['hours', 'minutes'])).values).toEqual({ hours: 1, minutes: 0 });
    const after = countState(e, at('2026-09-29 19:30'))!;
    expect(after.mode).toBe('up');
    expect(after.dday).toBe(0);
    expect(readoutValue(e, after, readout('units', ['hours', 'minutes'])).values).toEqual({ hours: 1, minutes: 30 });
  });
  it('shows gestational age before a due date', () => {
    const e = ev('2027-01-01', { preset: 'baby' });
    const st = countState(e, at('2026-09-29 12:00'))!;
    const g = readoutValue(e, st, readout('gestation')).gestation!;
    // 94 days before the due date: 280 - 94 = 186 days = 26w4d, 2nd trimester.
    expect(g).toEqual({ weeks: 26, days: 4, trimester: 2, totalDays: 186 });
  });
  it('shows percent served for a service obligation', () => {
    const e = ev('2027-01-05', { preset: 'service', spanStart: { y: 2025, m: 7, d: 6 } });
    const st = countState(e, at('2026-04-06 00:00'))!;
    const p = readoutValue(e, st, readout('percent')).percent!;
    expect(p.totalDays).toBe(549);
    expect(p.remainingDays).toBe(274);
    expect(p.fraction).toBeGreaterThan(0.49);
    expect(p.fraction).toBeLessThan(0.51);
  });
  it('uses the device zone when asked', () => {
    const e = ev('2026-10-01', { time: { h: 9, mi: 0 } });
    // 2026-09-30 10:00 in New York is 2026-09-30 23:00 in Seoul: one day to go there.
    const now = at('2026-09-30 10:00', 'America/New_York');
    expect(countState(e, now)!.dday).toBe(-1);
    const old = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      // 2026-10-01 09:00 Seoul is 2026-09-30 20:00 in New York: still today there.
      expect(countState({ ...e, displayZone: 'device' }, now)!.dday).toBe(0);
    } finally {
      process.env.TZ = old;
    }
  });
});
