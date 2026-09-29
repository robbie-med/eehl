import { describe, expect, it } from 'vitest';
import { HOUR, offsetAt, resolveWall, wallAt } from './zone';

describe('time zones', () => {
  it('reads offsets', () => {
    expect(offsetAt(Date.UTC(2026, 0, 1), 'Asia/Seoul')).toBe(9 * HOUR);
    expect(offsetAt(Date.UTC(2026, 6, 1), 'America/New_York')).toBe(-4 * HOUR);
    expect(offsetAt(Date.UTC(2026, 0, 1), 'America/New_York')).toBe(-5 * HOUR);
  });
  it('moves times in a DST gap forward', () => {
    // 2026-03-08 02:30 does not exist in New York.
    const r = resolveWall({ y: 2026, m: 3, d: 8, h: 2, mi: 30, s: 0, ms: 0 }, 'America/New_York');
    expect(r.adjustment).toBe('gap');
    expect(wallAt(r.epochMs, 'America/New_York')).toMatchObject({ h: 3, mi: 30 });
  });
  it('takes the earlier instant in an overlap', () => {
    // 2026-11-01 01:30 happens twice in New York.
    const r = resolveWall({ y: 2026, m: 11, d: 1, h: 1, mi: 30, s: 0, ms: 0 }, 'America/New_York');
    expect(r.adjustment).toBe('overlap');
    expect(r.epochMs).toBe(Date.UTC(2026, 10, 1, 5, 30));
  });
  it('round-trips ordinary wall times', () => {
    for (const zone of ['Asia/Seoul', 'Europe/London', 'Australia/Lord_Howe', 'America/St_Johns', 'Pacific/Kiritimati']) {
      for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2021, 0, 1); t += 7 * HOUR + 13 * 60000) {
        const w = wallAt(t, zone);
        const r = resolveWall(w, zone);
        if (r.adjustment === 'none') expect(r.epochMs).toBe(t);
      }
    }
  });
  it('handles a skipped midnight (Asia/Beirut style) and whole skipped days', () => {
    // Samoa skipped 2011-12-30 entirely.
    const r = resolveWall({ y: 2011, m: 12, d: 30, h: 12, mi: 0, s: 0, ms: 0 }, 'Pacific/Apia');
    expect(r.adjustment).toBe('gap');
    expect(wallAt(r.epochMs, 'Pacific/Apia')).toMatchObject({ y: 2011, m: 12, d: 31, h: 12 });
  });
});
