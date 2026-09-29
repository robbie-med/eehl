// Golden vectors: the engine's answers for a broad, fixed set of cases, stored
// in spec/golden.json. Any port of the engine (the native Android app in
// Kotlin) loads the same file and must reproduce every case exactly.
//
// Regenerate after an intentional change:  UPDATE_GOLDEN=1 npx vitest run golden

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayNumber, fromDayNumber, parseISODate, toISODate } from './civil';
import { countState, readoutValue } from './count';
import { diffInstants } from './diff';
import { dayNumberToLunar, leapMonthOf, resolveLunarAnniversary, type LunarCalendar, type LeapRule } from './lunar';
import { milestonesFor } from './milestones';
import { newEvent, readout, type NewEventInput } from './presets';
import type { CountEvent, Rounding, Unit } from './types';
import { instantOf, wallAt } from './zone';

const FILE = new URL('../../spec/golden.json', import.meta.url);

const d = (s: string) => parseISODate(s)!;
const at = (s: string, zone: string) => {
  const [date, time = '00:00'] = s.split(' ');
  const [h, mi] = time.split(':').map(Number);
  return instantOf({ ...d(date), h, mi, s: 0, ms: 0 }, zone);
};
const iso = (ms: number, zone: string) => {
  const w = wallAt(ms, zone);
  return `${toISODate(w)} ${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`;
};

// ---------- inputs ----------

type EventSpec = Omit<NewEventInput, 'date' | 'now' | 'title' | 'time'> & {
  name: string;
  date: string;
  time?: string;
  patch?: Partial<Pick<CountEvent, 'direction' | 'endBehavior' | 'dayOne' | 'inclusiveEnd' | 'repeat' | 'leapRule'>>;
};

const EVENTS: EventSpec[] = [
  { name: 'countdown', preset: 'custom', date: '2026-10-01', zone: 'Asia/Seoul' },
  { name: 'couple', preset: 'couple', date: '2026-01-01', zone: 'Asia/Seoul' },
  { name: 'baby', preset: 'baby', date: '2026-03-15', zone: 'Asia/Seoul' },
  { name: 'due-date', preset: 'baby', date: '2027-01-01', zone: 'Asia/Seoul' },
  { name: 'birthday', preset: 'birthday', date: '1990-10-05', zone: 'Asia/Seoul' },
  { name: 'feb29', preset: 'birthday', date: '2000-02-29', zone: 'America/New_York' },
  { name: 'lunar-birthday', preset: 'birthday', date: '1966-03-26', zone: 'Asia/Seoul', calendar: 'korean-lunar', lunar: { year: 1966, month: 3, day: 5, leap: false } },
  { name: 'leap-month-birthday', preset: 'birthday', date: '2017-07-03', zone: 'Asia/Seoul', calendar: 'korean-lunar', lunar: { year: 2017, month: 5, day: 10, leap: true } },
  {
    name: 'leap-month-when-exists',
    preset: 'birthday',
    date: '2017-07-03',
    zone: 'Asia/Seoul',
    calendar: 'korean-lunar',
    lunar: { year: 2017, month: 5, day: 10, leap: true },
    patch: { leapRule: 'leap-when-exists' },
  },
  { name: 'day30-memorial', preset: 'memorial', date: '2000-04-04', zone: 'Asia/Seoul', calendar: 'korean-lunar', lunar: { year: 2000, month: 2, day: 30, leap: false } },
  { name: 'chinese-lunar', preset: 'birthday', date: '1985-02-20', zone: 'Asia/Shanghai', calendar: 'chinese-lunar', lunar: { year: 1985, month: 1, day: 1, leap: false } },
  { name: 'wedding', preset: 'wedding', date: '2016-05-21', zone: 'Asia/Tokyo' },
  { name: 'exam', preset: 'exam', date: '2026-11-19', zone: 'Asia/Seoul' },
  { name: 'exam-stop', preset: 'exam', date: '2026-11-19', zone: 'Asia/Seoul', patch: { endBehavior: 'stop' } },
  { name: 'service', preset: 'service', date: '2027-03-14', zone: 'Asia/Seoul', spanStart: { y: 2025, m: 9, d: 15 } },
  { name: 'timed', preset: 'custom', date: '2026-09-29', time: '18:00', zone: 'Asia/Seoul' },
  { name: 'timed-dst', preset: 'custom', date: '2026-03-08', time: '02:30', zone: 'America/New_York' },
  { name: 'monthly', preset: 'custom', date: '2026-01-31', zone: 'Europe/London', patch: { repeat: 'monthly' } },
  { name: 'inclusive-end', preset: 'custom', date: '2026-12-18', zone: 'America/Chicago', patch: { inclusiveEnd: true, direction: 'down', endBehavior: 'archive' } },
  { name: 'up-repeating', preset: 'wedding', date: '2016-05-21', zone: 'Asia/Seoul', patch: { direction: 'up' } },
];

const NOWS: [string, string][] = [
  ['2026-01-01 00:00', 'Asia/Seoul'],
  ['2026-03-08 12:00', 'America/New_York'],
  ['2026-04-10 08:00', 'Asia/Seoul'],
  ['2026-09-29 12:00', 'Asia/Seoul'],
  ['2026-09-29 19:30', 'Asia/Seoul'],
  ['2026-10-01 23:59', 'Asia/Seoul'],
  ['2026-11-19 10:00', 'Asia/Seoul'],
  ['2026-11-20 10:00', 'Asia/Seoul'],
  ['2026-12-18 23:00', 'America/Chicago'],
  ['2027-02-28 12:00', 'America/New_York'],
  ['2028-02-29 12:00', 'Asia/Seoul'],
];

const READOUTS: { style: 'dday' | 'units' | 'age' | 'percent' | 'gestation'; units?: Unit[]; basis?: 'target' | 'origin' }[] = [
  { style: 'dday' },
  { style: 'dday', basis: 'origin' },
  { style: 'units', units: ['days'] },
  { style: 'units', units: ['weeks', 'days'] },
  { style: 'units', units: ['years', 'months', 'days'] },
  { style: 'units', units: ['years', 'months', 'days'], basis: 'origin' },
  { style: 'units', units: ['days', 'hours', 'minutes'] },
  { style: 'age' },
  { style: 'percent' },
  { style: 'gestation' },
];

function build(spec: EventSpec): CountEvent {
  const [h, mi] = (spec.time ?? '').split(':').map(Number);
  const e = newEvent({
    ...spec,
    title: spec.name,
    date: d(spec.date),
    time: spec.time ? { h, mi } : null,
    now: 0,
  });
  return { ...e, id: spec.name, ...spec.patch };
}

// ---------- outputs ----------

function generate() {
  const lunar: unknown[] = [];
  for (const cal of ['korean-lunar', 'chinese-lunar'] as LunarCalendar[]) {
    for (let n = dayNumber(d('1900-02-15')); n <= dayNumber(d('2100-12-31')); n += 97) {
      lunar.push({ calendar: cal, solar: toISODate(fromDayNumber(n)), lunar: dayNumberToLunar(cal, n) });
    }
  }
  const leapMonths: Record<string, Record<number, number>> = { 'korean-lunar': {}, 'chinese-lunar': {} };
  for (const cal of ['korean-lunar', 'chinese-lunar'] as LunarCalendar[]) {
    for (let y = 1900; y <= 2100; y++) {
      const m = leapMonthOf(cal, y);
      if (m) leapMonths[cal][y] = m;
    }
  }

  const anniversaries: unknown[] = [];
  const originals = [
    { year: 2017, month: 5, day: 10, leap: true },
    { year: 2000, month: 2, day: 30, leap: false },
    { year: 1966, month: 3, day: 5, leap: false },
    { year: 2020, month: 4, day: 30, leap: true },
  ];
  for (const original of originals) {
    for (const rule of ['regular', 'leap-when-exists'] as LeapRule[]) {
      for (let year = 2024; year <= 2040; year++) {
        const r = resolveLunarAnniversary('korean-lunar', original, year, rule)!;
        anniversaries.push({ original, rule, year, solar: toISODate(fromDayNumber(r.dayNumber)), used: r.used, adjustments: r.adjustments });
      }
    }
  }

  const diffs: unknown[] = [];
  const pairs: [string, string, string][] = [
    ['2024-01-31 00:00', '2024-02-29 00:00', 'UTC'],
    ['2023-01-31 00:00', '2023-03-01 00:00', 'UTC'],
    ['2020-02-29 09:00', '2026-09-29 08:59', 'Asia/Seoul'],
    ['2026-03-07 12:00', '2026-03-08 12:00', 'America/New_York'],
    ['2026-11-01 00:30', '2026-11-01 03:30', 'America/New_York'],
    ['2026-01-01 00:00', '2026-01-07 23:00', 'UTC'],
    ['1999-12-31 23:59', '2026-09-29 12:00', 'Europe/London'],
    ['2026-09-29 12:00', '2026-11-19 00:00', 'Asia/Seoul'],
  ];
  const unitSets: Unit[][] = [['days'], ['weeks', 'days'], ['years', 'months', 'days'], ['months', 'days', 'hours'], ['hours', 'minutes', 'seconds'], ['weeks']];
  for (const [a, b, zone] of pairs) {
    for (const units of unitSets) {
      for (const rounding of ['floor', 'round', 'ceil'] as Rounding[]) {
        const r = diffInstants(at(a, zone), at(b, zone), units, rounding, zone);
        diffs.push({ from: a, to: b, zone, units, rounding, values: r.values, sign: r.sign });
      }
    }
  }

  const events = EVENTS.map((spec) => {
    const e = build(spec);
    const states = NOWS.map(([now, zone]) => {
      const t = at(now, zone);
      const st = countState(e, t)!;
      return {
        now,
        nowZone: zone,
        mode: st.mode,
        dday: st.dday,
        isToday: st.isToday,
        target: toISODate(st.target.civil),
        targetK: st.target.k,
        shouldArchive: st.shouldArchive,
        readouts: READOUTS.map((spec) => {
          const rv = readoutValue(e, st, { ...readout(spec.style, spec.units ?? [], spec.basis ?? 'target'), id: 'r' });
          return {
            ...spec,
            direction: rv.direction,
            values: rv.values,
            dday: rv.dday,
            age: rv.age,
            percent: rv.percent && { ...rv.percent, fraction: Math.round(rv.percent.fraction * 1e6) / 1e6 },
            gestation: rv.gestation,
          };
        }),
      };
    });
    const origin = dayNumber(wallAt(e.epochMs, e.zone));
    const milestones = milestonesFor(e, origin, origin + 366 * 100)
      .slice(0, 40)
      .map((m) => ({ key: m.key, date: toISODate(m.civil), label: m.label, notify: m.notify }));
    return { name: spec.name, input: { ...spec, anchor: iso(e.epochMs, e.zone), epochMs: e.epochMs, readoutDefaults: e.readouts.map((r) => r.style), rules: e.milestones.map((r) => ({ ...r, id: undefined })) }, states, milestones };
  });

  return {
    about: 'eehl engine golden vectors. Generated by src/core/golden.test.ts; any port must reproduce every case.',
    lunar,
    leapMonths,
    anniversaries,
    diffs,
    events,
  };
}

/** One case per line: compact, but diffs stay readable. */
function serialize(o: Record<string, unknown>): string {
  const parts = Object.entries(o).map(([k, v]) => {
    const body = Array.isArray(v) ? `[\n${v.map((x) => '  ' + JSON.stringify(x)).join(',\n')}\n ]` : JSON.stringify(v);
    return ` ${JSON.stringify(k)}: ${body}`;
  });
  return `{\n${parts.join(',\n')}\n}\n`;
}

describe('golden vectors', () => {
  it('match spec/golden.json', () => {
    const current = JSON.parse(JSON.stringify(generate()));
    if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) {
      writeFileSync(FILE, serialize(current));
    }
    const stored = JSON.parse(readFileSync(FILE, 'utf8'));
    expect(current).toEqual(stored);
  });
});
