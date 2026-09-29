import { describe, expect, it } from 'vitest';
import { dayNumber } from './civil';
import { diffCivil, diffInstants } from './diff';
import { at, d } from './testutil';
import { HOUR } from './zone';

const days = (a: string, b: string) => [dayNumber(d(a)), dayNumber(d(b))] as const;

describe('diff', () => {
  it('uses calendar months with the clamp rule', () => {
    expect(diffCivil(...days('2024-01-31', '2024-02-29'), ['months', 'days'], 'floor').values).toEqual({ months: 1, days: 0 });
    expect(diffCivil(...days('2023-01-31', '2023-03-01'), ['months', 'days'], 'floor').values).toEqual({ months: 1, days: 1 });
    expect(diffCivil(...days('2020-02-29', '2026-09-29'), ['years', 'months', 'days'], 'floor').values).toEqual({ years: 6, months: 7, days: 0 });
  });
  it('gives single totals', () => {
    expect(diffCivil(...days('2022-11-11', '2026-09-29'), ['days'], 'floor').values).toEqual({ days: 1418 });
    expect(diffCivil(...days('2022-11-11', '2026-09-29'), ['weeks'], 'floor').values).toEqual({ weeks: 202 });
    expect(diffCivil(...days('2022-11-11', '2026-09-29'), ['weeks', 'days'], 'floor').values).toEqual({ weeks: 202, days: 4 });
  });
  it('rounds the smallest unit and carries', () => {
    const a = at('2026-01-01 00:00', 'UTC');
    const b = a + 6 * 24 * HOUR + 23 * HOUR;
    expect(diffInstants(a, b, ['weeks', 'days'], 'floor', 'UTC').values).toEqual({ weeks: 0, days: 6 });
    expect(diffInstants(a, b, ['weeks', 'days'], 'ceil', 'UTC').values).toEqual({ weeks: 1, days: 0 });
    expect(diffInstants(a, b, ['weeks', 'days'], 'round', 'UTC').values).toEqual({ weeks: 1, days: 0 });
    expect(diffInstants(a, a + 11 * HOUR, ['days'], 'round', 'UTC').values).toEqual({ days: 0 });
    expect(diffInstants(a, a + 13 * HOUR, ['days'], 'round', 'UTC').values).toEqual({ days: 1 });
  });
  it('counts calendar days across DST but exact hours', () => {
    const z = 'America/New_York';
    const a = at('2026-03-07 12:00', z);
    const b = at('2026-03-08 12:00', z);
    expect(diffInstants(a, b, ['days'], 'floor', z).values).toEqual({ days: 1 });
    expect(diffInstants(a, b, ['hours'], 'floor', z).values).toEqual({ hours: 23 });
    expect(diffInstants(a, b, ['days', 'hours'], 'floor', z).values).toEqual({ days: 1, hours: 0 });
  });
  it('reports direction', () => {
    const a = at('2026-01-01 00:00');
    expect(diffInstants(a, a + HOUR, ['hours'], 'floor', 'Asia/Seoul').sign).toBe(1);
    expect(diffInstants(a + HOUR, a, ['hours'], 'floor', 'Asia/Seoul').sign).toBe(-1);
    expect(diffInstants(a, a + 1000, ['hours'], 'floor', 'Asia/Seoul').sign).toBe(0);
  });
  it('decomposes consistently (property)', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 400; i++) {
      const a = dayNumber(d('1990-01-01')) + Math.floor(rnd() * 20000);
      const b = a + Math.floor(rnd() * 5000);
      const all = diffCivil(a, b, ['days'], 'floor').values.days!;
      expect(all).toBe(b - a);
      const wd = diffCivil(a, b, ['weeks', 'days'], 'floor').values;
      expect(wd.weeks! * 7 + wd.days!).toBe(b - a);
      const ymd = diffCivil(a, b, ['years', 'months', 'days'], 'floor').values;
      expect(ymd.months!).toBeLessThan(12);
      expect(ymd.days!).toBeLessThan(31);
    }
  });
});
