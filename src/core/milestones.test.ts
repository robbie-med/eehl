import { describe, expect, it } from 'vitest';
import { dayNumber, toISODate } from './civil';
import { milestonesFor } from './milestones';
import { d, ev } from './testutil';
import { Formatter } from '../i18n/format';

const f = new Formatter({ lang: 'en', dateFormat: 'ISO', manGrouping: false, ddayScript: 'latin' });
const ko = new Formatter({ lang: 'ko', dateFormat: 'ISO', manGrouping: true, ddayScript: 'latin' });

const list = (e: ReturnType<typeof ev>, to = '2040-01-01') =>
  milestonesFor(e, dayNumber(d('1900-01-01')), dayNumber(d(to))).map((m) => [toISODate(m.civil), f.milestone(m.label)]);

describe('milestones', () => {
  it('puts couple 100 days on start + 99 with day-one counting', () => {
    const m = list(ev('2026-01-01', { preset: 'couple' }), '2027-01-02');
    expect(m[0]).toEqual(['2026-04-10', '100 days']);
    expect(m).toContainEqual(['2027-01-01', '1st anniversary']);
    expect(list(ev('2026-01-01', { preset: 'couple' }), '2029-01-01')).toContainEqual(['2028-09-26', '1,000 days']);
  });
  it('generates baby milestones', () => {
    const m = list(ev('2026-03-15', { preset: 'baby' }), '2028-12-31');
    expect(m).toContainEqual(['2026-04-15', 'One month (满月)']);
    expect(m).toContainEqual(['2026-05-03', '50 days']);
    expect(m).toContainEqual(['2026-06-22', '100 days (백일)']);
    expect(m).toContainEqual(['2027-03-15', 'First birthday (돌)']);
  });
  it('derives long-life birthdays by counting age, on the lunar date for lunar birthdays', () => {
    const e = ev('1966-01-01', { preset: 'birthday', calendar: 'korean-lunar', lunar: { year: 1966, month: 3, day: 5, leap: false } });
    const m = milestonesFor(e, 0, dayNumber(d('2100-01-01')));
    const hwangap = m.find((x) => x.key === 'long-life:hwangap')!;
    expect(hwangap.civil.y).toBe(2026); // 60th birthday
    expect(hwangap.lunar).toMatchObject({ month: 3, day: 5 });
    expect(ko.milestone(hwangap.label)).toBe('환갑 (還甲) · 세는 나이 61세 (만 60세)');
    const chilsun = m.find((x) => x.key === 'long-life:chilsun')!;
    expect(chilsun.civil.y).toBe(2035); // counting age 70 = 69th birthday
  });
  it('names wedding anniversaries', () => {
    const m = list(ev('2016-05-21', { preset: 'wedding' }), '2027-01-01');
    expect(m).toContainEqual(['2026-05-21', '10th anniversary · Tin']);
    expect(m).toContainEqual(['2019-02-15', '1,000 days']);
  });
  it('dedupes rules that produce the same day', () => {
    const e = ev('2020-01-01', { preset: 'couple' });
    e.milestones.push({ id: 'x', type: 'round-days', notify: false });
    const m = milestonesFor(e, 0, dayNumber(d('2030-01-01'))).filter((x) => x.key === 'day:1000');
    expect(m).toHaveLength(1);
    expect(m[0].notify).toBe(true);
  });
});
