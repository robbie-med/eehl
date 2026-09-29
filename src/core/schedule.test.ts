import { describe, expect, it } from 'vitest';
import { dayNumber } from './civil';
import { countState } from './count';
import { emptyData } from './backup';
import { buildSchedule, buildWidgetPayload, evalSegments, widgetSegments } from './schedule';
import { at, d, ev } from './testutil';
import { Formatter } from '../i18n/format';

const f = new Formatter({ lang: 'en', dateFormat: 'ISO', manGrouping: false, ddayScript: 'latin' });

describe('notification schedule', () => {
  it('schedules event reminders and milestone reminders in the event zone', () => {
    const data = emptyData();
    data.events = [ev('2026-10-10', { title: 'Exam', preset: 'exam' }), ev('2026-09-01', { title: 'Us', preset: 'couple' })];
    const s = buildSchedule(data, at('2026-09-29 12:00'), f);
    const exam = s.filter((n) => n.title.includes('Exam'));
    expect(exam.map((n) => n.body)).toEqual(['In 7 days', 'Tomorrow']);
    expect(exam[0].at).toBe(at('2026-10-03 09:00'));
    const us = s.filter((n) => n.title.includes('Us'));
    // 100 days = 2026-12-09 with day-one counting; reminder 7 days before and on the day.
    expect(us[0]).toMatchObject({ at: at('2026-12-02 09:00'), body: '100 days in 7 days' });
    expect(us[1]).toMatchObject({ at: at('2026-12-09 09:00'), body: '100 days today' });
    expect(s.every((n, i) => i === 0 || s[i - 1].at <= n.at)).toBe(true);
  });
  it('hides private titles', () => {
    const data = emptyData();
    data.events = [{ ...ev('2026-10-10', { title: 'Secret' }), private: true }];
    expect(buildSchedule(data, at('2026-09-29 12:00'), f)[0].title).toBe('📅 Private event');
  });
  it('builds a daily digest', () => {
    const data = emptyData();
    data.settings.digest = { enabled: true, time: '08:00' };
    data.events = [ev('2026-10-10', { title: 'Exam', preset: 'exam' })];
    const old = process.env.TZ;
    process.env.TZ = 'Asia/Seoul';
    try {
      const dg = buildSchedule(data, at('2026-09-29 12:00'), f).filter((n) => n.channel === 'digest');
      expect(dg).toHaveLength(1);
      expect(dg[0]).toMatchObject({ at: at('2026-10-10 08:00'), body: '📝 T · D-Day'.replace('T', 'Exam') });
    } finally {
      process.env.TZ = old;
    }
  });
});

describe('widget segments', () => {
  const check = (e: ReturnType<typeof ev>, from: string, days: number) => {
    const start = dayNumber(d(from));
    const segs = widgetSegments(e, start, days, (o) => String(o.k));
    for (let day = start; day < start + days; day++) {
      const st = countState(e, at(`${from} 12:00`) + (day - start) * 86400000)!;
      const v = evalSegments(segs, day)!;
      expect(v.n, `day ${day}`).toBe(st.dday);
      expect(v.ended).toBe(st.mode === 'ended');
    }
    return segs;
  };
  it('matches the engine for a countdown that flips', () => {
    expect(check(ev('2026-10-10'), '2026-09-01', 120)).toHaveLength(1);
  });
  it('matches the engine with day-one counting', () => check(ev('2026-10-10', { preset: 'couple' }), '2026-09-01', 120));
  it('matches the engine for an ending exam', () => check(ev('2026-10-10', { preset: 'exam' }), '2026-09-01', 120));
  it('matches the engine for yearly and lunar birthdays', () => {
    check(ev('1990-02-28', { preset: 'birthday' }), '2026-01-01', 800);
    check(ev('1990-01-01', { preset: 'birthday', calendar: 'korean-lunar', lunar: { year: 1990, month: 5, day: 30, leap: false } }), '2026-01-01', 800);
  });
  it('keeps payloads small', () => {
    const data = emptyData();
    data.events = Array.from({ length: 30 }, (_, i) => ev(`20${10 + (i % 15)}-0${1 + (i % 9)}-1${i % 9}`, { preset: i % 2 ? 'birthday' : 'couple' }));
    const json = JSON.stringify(buildWidgetPayload(data, at('2026-09-29 12:00'), f));
    expect(json.length).toBeLessThan(60000);
  });
});
