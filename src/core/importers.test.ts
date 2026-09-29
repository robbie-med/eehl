import { describe, expect, it } from 'vitest';
import { emptyData, toCSV, toICS } from './backup';
import { anchorWall } from './count';
import { parseCSV, parseICS, parseLooseDate, parseVCF } from './importers';
import { ev, at } from './testutil';
import { Formatter } from '../i18n/format';
import { toISODate } from './civil';

const f = new Formatter({ lang: 'en', dateFormat: 'ISO', manGrouping: false, ddayScript: 'latin' });
const date = (e: { epochMs: number; zone: string }) => toISODate(anchorWall(e));

describe('ICS import', () => {
  it('reads all-day, timed (UTC and TZID) and recurring events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:a',
      'SUMMARY:🎂 Mom\\, birthday',
      'DTSTART;VALUE=DATE:19660326',
      'RRULE:FREQ=YEARLY',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:b',
      'SUMMARY:Flight',
      'DTSTART;TZID=America/New_York:20261120T183000',
      'DESCRIPTION:Gate 12\\nSeat 3A',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:c',
      'SUMMARY:Call',
      'DTSTART:20261201T010000Z',
      'CATEGORIES:work,remote',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const r = parseICS(ics, 'Asia/Seoul', 0).events;
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ title: 'Mom, birthday', emoji: '🎂', repeat: 'yearly', preset: 'birthday', allDay: true, zone: 'Asia/Seoul' });
    expect(date(r[0])).toBe('1966-03-26');
    expect(r[1]).toMatchObject({ title: 'Flight', allDay: false, zone: 'America/New_York', notes: 'Gate 12\nSeat 3A' });
    expect(r[1].epochMs).toBe(at('2026-11-20 18:30', 'America/New_York'));
    expect(r[2]).toMatchObject({ zone: 'UTC', tags: ['work', 'remote'] });
  });
  it('round-trips eehl’s own export without duplicating milestones', () => {
    const data = emptyData();
    data.events = [ev('2026-01-01', { preset: 'couple', title: 'Us' })];
    const back = parseICS(toICS(data, at('2025-12-01 00:00'), f, 2), 'Asia/Seoul', 0).events;
    expect(back.map((e) => e.title)).toEqual(['Us']);
    expect(date(back[0])).toBe('2026-01-01');
  });
});

describe('CSV import', () => {
  it('round-trips eehl’s CSV export', () => {
    const data = emptyData();
    data.lists = [{ id: 'l', name: 'Family', color: 'slate', collapsed: false, parentId: null, defaultReadout: null, defaultZone: null, sort: 'inherit' }];
    data.events = [
      { ...ev('2026-01-01', { preset: 'couple', title: 'Us, forever' }), tags: ['a', 'b'], listId: 'l' },
      ev('1966-03-26', { preset: 'birthday', title: 'Mom', calendar: 'korean-lunar', lunar: { year: 1966, month: 3, day: 5, leap: false } }),
      ev('2026-11-19', { title: 'Exam', time: { h: 8, mi: 40 } }),
    ];
    const r = parseCSV(toCSV(data), 'UTC', 0);
    expect(r.events.map((e) => e.title)).toEqual(['Us, forever', 'Mom', 'Exam']);
    expect(r.events[0]).toMatchObject({ preset: 'couple', dayOne: true, tags: ['a', 'b'] });
    expect(r.listNames[r.events[0].id]).toBe('Family');
    expect(r.events[1]).toMatchObject({ calendar: 'korean-lunar', lunar: { year: 1966, month: 3, day: 5, leap: false }, repeat: 'yearly' });
    expect(r.events[2]).toMatchObject({ allDay: false, zone: 'Asia/Seoul' });
  });
  it('reads a plain two-column sheet in several date styles', () => {
    const r = parseCSV('Name,Date\nA,2026.09.28\nB,28SEP2026\nC,9/28/2026\n"D, quoted",2026年9月28日\nbad,someday\n', 'UTC', 0);
    expect(r.events.map((e) => [e.title, date(e)])).toEqual([
      ['A', '2026-09-28'],
      ['B', '2026-09-28'],
      ['C', '2026-09-28'],
      ['D, quoted', '2026-09-28'],
    ]);
  });
  it('parses loose dates', () => {
    expect(parseLooseDate('2026/2/3')).toEqual({ y: 2026, m: 2, d: 3 });
    expect(parseLooseDate('2026-02-30')).toBeNull();
  });
});

describe('vCard import', () => {
  it('turns birthdays and anniversaries into events', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:김지수',
      'BDAY:19900521',
      'ANNIVERSARY:2016-05-21',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Doe;Jane;;;',
      'BDAY:--0704',
      'END:VCARD',
    ].join('\n');
    const r = parseVCF(vcf, 'Asia/Seoul', Date.UTC(2026, 8, 29));
    expect(r.events.map((e) => [e.title, e.preset, date(e)])).toEqual([
      ['김지수', 'birthday', '1990-05-21'],
      ['김지수', 'wedding', '2016-05-21'],
      ['Jane Doe', 'birthday', '2026-07-04'],
    ]);
    expect(r.noYear).toBe(1);
    expect(r.events[2].readouts.map((x) => x.style)).toEqual(['dday']);
  });
});
