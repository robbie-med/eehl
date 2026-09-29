// The milestone engine: turns an event's rules into dated milestones.

import { addMonths, addYears, dayNumber, fromDayNumber, type Civil } from './civil';
import { occurrence } from './count';
import type { LunarDate } from './lunar';
import type { CountEvent, MilestoneRule, PresetId } from './types';

export type BabyKey = 'one-month' | 'day-50' | 'day-100' | 'first-birthday' | 'second-birthday';

export type MilestoneLabel =
  | { kind: 'day'; n: number }
  | { kind: 'tutu' }
  | { kind: 'year'; n: number; preset: PresetId }
  | { kind: 'month'; n: number }
  | { kind: 'baby'; key: BabyKey }
  | { kind: 'long-life'; key: string; tradition: 'ko' | 'ja'; countingAge: number }
  | { kind: 'wedding'; n: number }
  | { kind: 'custom'; label: string; n: number };

export interface Milestone {
  key: string;
  ruleIds: string[];
  eventId: string;
  day: number;
  civil: Civil;
  lunar: LunarDate | null;
  label: MilestoneLabel;
  notify: boolean;
}

export const LONG_LIFE: Record<'ko' | 'ja', { key: string; countingAge: number }[]> = {
  // Traditional reckoning by counting age (세는 나이 / 数え年); 환갑 and 還暦 are
  // the 60th birthday (counting age 61) by definition.
  ko: [
    { key: 'hwangap', countingAge: 61 },
    { key: 'chilsun', countingAge: 70 },
    { key: 'huisu', countingAge: 77 },
    { key: 'palsun', countingAge: 80 },
    { key: 'misu', countingAge: 88 },
    { key: 'gusun', countingAge: 90 },
    { key: 'baeksu', countingAge: 99 },
  ],
  ja: [
    { key: 'kanreki', countingAge: 61 },
    { key: 'koki', countingAge: 70 },
    { key: 'kiju', countingAge: 77 },
    { key: 'sanju', countingAge: 80 },
    { key: 'beiju', countingAge: 88 },
    { key: 'sotsuju', countingAge: 90 },
    { key: 'hakuju', countingAge: 99 },
    { key: 'hyakuju', countingAge: 100 },
  ],
};

export const COUPLE_DAYS: number[] = [
  ...Array.from({ length: 10 }, (_, i) => (i + 1) * 100),
  1500, 2000, 2500, 3000,
  ...Array.from({ length: 7 }, (_, i) => (i + 4) * 1000),
];

export const ROUND_DAYS: number[] = [
  ...Array.from({ length: 10 }, (_, i) => (i + 1) * 1000),
  15000, 20000, 25000, 30000, 35000, 40000,
];

/** Day number on which "day N" falls: with day-one counting, day 100 is start + 99. */
export function dayOfCount(ev: CountEvent, originDay: number, n: number): number {
  return originDay + n - (ev.dayOne ? 1 : 0);
}

interface RawMilestone {
  key: string;
  day: number;
  label: MilestoneLabel;
  lunar?: LunarDate | null;
}

function* ruleMilestones(
  ev: CountEvent,
  rule: MilestoneRule,
  originDay: number,
  origin: Civil,
  toDay: number,
): Generator<RawMilestone> {
  const day = (n: number, label: MilestoneLabel = { kind: 'day', n }) => ({ key: `day:${n}`, day: dayOfCount(ev, originDay, n), label });
  const yearly = function* (label: (k: number) => MilestoneLabel, keyPrefix = 'year'): Generator<RawMilestone> {
    for (let k = 1; k < 200; k++) {
      const o = occurrence({ ...ev, repeat: 'yearly' }, k);
      if (!o || o.day > toDay) return;
      yield { key: `${keyPrefix}:${k}`, day: o.day, label: label(k), lunar: o.lunar };
    }
  };
  switch (rule.type) {
    case 'every-n-days':
      for (let k = 1; k <= Math.min(rule.limit, 1000) && rule.n > 0; k++) yield day(rule.n * k);
      break;
    case 'round-days':
      for (const n of ROUND_DAYS) yield day(n);
      break;
    case 'couple':
      if (rule.tutu) yield { ...day(22), key: 'tutu', label: { kind: 'tutu' } };
      for (const n of COUPLE_DAYS) yield day(n);
      break;
    case 'baby':
      yield { key: 'baby:one-month', day: dayNumber(addMonths(origin, 1)), label: { kind: 'baby', key: 'one-month' } };
      yield { ...day(50), key: 'baby:day-50', label: { kind: 'baby', key: 'day-50' } };
      yield { ...day(100), key: 'baby:day-100', label: { kind: 'baby', key: 'day-100' } };
      yield { key: 'baby:first-birthday', day: dayNumber(addYears(origin, 1)), label: { kind: 'baby', key: 'first-birthday' } };
      yield { key: 'baby:second-birthday', day: dayNumber(addYears(origin, 2)), label: { kind: 'baby', key: 'second-birthday' } };
      break;
    case 'yearly':
      yield* yearly((n) => ({ kind: 'year', n, preset: ev.preset }));
      break;
    case 'wedding':
      yield* yearly((n) => ({ kind: 'wedding', n }));
      break;
    case 'monthly':
      for (let k = 1; k <= Math.min(rule.limit, 1200); k++) {
        yield { key: `month:${k}`, day: dayNumber(addMonths(origin, k)), label: { kind: 'month', n: k } };
      }
      break;
    case 'long-life':
      for (const l of LONG_LIFE[rule.tradition]) {
        const o = occurrence({ ...ev, repeat: 'yearly' }, l.countingAge - 1);
        if (o) {
          yield {
            key: `long-life:${l.key}`,
            day: o.day,
            lunar: o.lunar,
            label: { kind: 'long-life', key: l.key, tradition: rule.tradition, countingAge: l.countingAge },
          };
        }
      }
      break;
    case 'custom-day':
      yield { ...day(rule.day, { kind: 'custom', label: rule.label, n: rule.day }), key: `custom:${rule.id}` };
      break;
  }
}

/** All milestones of an event from `fromDay` to `toDay` (inclusive), sorted by date. */
export function milestonesFor(ev: CountEvent, fromDay: number, toDay: number): Milestone[] {
  const origin = occurrence(ev, 0);
  if (!origin) return [];
  const byKey = new Map<string, Milestone>();
  for (const rule of ev.milestones) {
    for (const m of ruleMilestones(ev, rule, origin.day, origin.civil, toDay)) {
      if (m.day < fromDay || m.day > toDay || m.day <= origin.day) continue;
      const existing = byKey.get(m.key);
      if (existing) {
        existing.notify ||= rule.notify;
        existing.ruleIds.push(rule.id);
        continue;
      }
      byKey.set(m.key, {
        key: m.key,
        ruleIds: [rule.id],
        eventId: ev.id,
        day: m.day,
        civil: fromDayNumber(m.day),
        lunar: m.lunar ?? null,
        label: m.label,
        notify: rule.notify,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.day - b.day || a.key.localeCompare(b.key));
}

export function nextMilestones(ev: CountEvent, todayDay: number, count: number, horizonDays = 366 * 120): Milestone[] {
  return milestonesFor(ev, todayDay, todayDay + horizonDays).slice(0, count);
}
