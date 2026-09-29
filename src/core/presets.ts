// Presets bundle notation, counting rules, readouts and milestone rules so
// that "Couple" or "Baby" sets everything correctly in one tap.

import { dayNumber, fromDayNumber, type Civil } from './civil';
import { lunarToDayNumber, type LeapRule, type LunarDate } from './lunar';
import type {
  CalendarSystem,
  CountEvent,
  MilestoneRule,
  PresetId,
  Readout,
  ReadoutBasis,
  ReadoutStyle,
  Reminder,
  Unit,
} from './types';
import { instantOf } from './zone';

export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function readout(style: ReadoutStyle, units: Unit[] = [], basis: ReadoutBasis = 'target'): Readout {
  return { id: uid(), style, units, rounding: 'floor', basis };
}

type RuleInput = MilestoneRule extends infer R ? (R extends MilestoneRule ? Omit<R, 'id'> : never) : never;
export function rule(r: RuleInput): MilestoneRule {
  return { ...r, id: uid() } as MilestoneRule;
}

export function reminder(target: Reminder['target'], daysBefore: number, time = '09:00'): Reminder {
  return { id: uid(), target, daysBefore, time, channel: 'notification' };
}

export interface PresetInfo {
  id: PresetId;
  emoji: string;
  color: string;
}

export const PRESETS: PresetInfo[] = [
  { id: 'custom', emoji: '📅', color: 'blue' },
  { id: 'couple', emoji: '💑', color: 'rose' },
  { id: 'baby', emoji: '👶', color: 'amber' },
  { id: 'birthday', emoji: '🎂', color: 'orange' },
  { id: 'wedding', emoji: '💍', color: 'violet' },
  { id: 'memorial', emoji: '🕯️', color: 'slate' },
  { id: 'exam', emoji: '📝', color: 'sky' },
  { id: 'service', emoji: '🎖️', color: 'green' },
];

type PresetFields = Pick<
  CountEvent,
  'repeat' | 'direction' | 'endBehavior' | 'dayOne' | 'inclusiveEnd' | 'readouts' | 'milestones' | 'reminders'
>;

/** Default fields for a preset. `tradition` picks long-life names (Korean or Japanese). */
export function presetFields(id: PresetId, tradition: 'ko' | 'ja' = 'ko'): PresetFields {
  const common: PresetFields = {
    repeat: 'none',
    direction: 'auto',
    endBehavior: 'flip',
    dayOne: false,
    inclusiveEnd: false,
    readouts: [readout('dday'), readout('units', ['days']), readout('units', ['years', 'months', 'days'])],
    milestones: [],
    reminders: [],
  };
  switch (id) {
    case 'custom':
      return { ...common, reminders: [reminder('event', 0)] };
    case 'couple':
      return {
        ...common,
        dayOne: true,
        readouts: [readout('dday'), readout('units', ['years', 'months', 'days']), readout('units', ['weeks', 'days'])],
        milestones: [rule({ type: 'couple', tutu: false, notify: true }), rule({ type: 'yearly', notify: true })],
        reminders: [reminder('milestones', 0), reminder('milestones', 7)],
      };
    case 'baby':
      return {
        ...common,
        dayOne: true,
        readouts: [
          readout('gestation'),
          readout('dday'),
          readout('units', ['weeks', 'days']),
          readout('units', ['months', 'days']),
          readout('units', ['years', 'months', 'days']),
        ],
        milestones: [rule({ type: 'baby', notify: true }), rule({ type: 'monthly', limit: 24, notify: false })],
        reminders: [reminder('milestones', 0), reminder('milestones', 7)],
      };
    case 'birthday':
      return {
        ...common,
        repeat: 'yearly',
        readouts: [readout('dday'), readout('age'), readout('units', ['days'], 'origin')],
        milestones: [
          rule({ type: 'yearly', notify: true }),
          rule({ type: 'long-life', tradition, notify: true }),
          rule({ type: 'round-days', notify: false }),
        ],
        reminders: [reminder('event', 0), reminder('event', 7)],
      };
    case 'wedding':
      return {
        ...common,
        repeat: 'yearly',
        readouts: [readout('dday'), readout('units', ['years', 'months', 'days'], 'origin'), readout('units', ['days'], 'origin')],
        milestones: [rule({ type: 'wedding', notify: true }), rule({ type: 'round-days', notify: false })],
        reminders: [reminder('event', 0), reminder('event', 14)],
      };
    case 'memorial':
      return {
        ...common,
        repeat: 'yearly',
        readouts: [readout('dday'), readout('units', ['years'], 'origin'), readout('units', ['days'], 'origin')],
        milestones: [rule({ type: 'yearly', notify: false })],
        reminders: [reminder('event', 7), reminder('event', 0)],
      };
    case 'exam':
      return {
        ...common,
        direction: 'down',
        endBehavior: 'archive',
        readouts: [readout('dday'), readout('units', ['weeks', 'days']), readout('units', ['days', 'hours', 'minutes'])],
        reminders: [reminder('event', 30), reminder('event', 7), reminder('event', 1)],
      };
    case 'service':
      return {
        ...common,
        direction: 'down',
        endBehavior: 'flip',
        dayOne: true,
        readouts: [readout('dday'), readout('percent'), readout('units', ['months', 'days'])],
        milestones: [rule({ type: 'every-n-days', n: 100, limit: 20, notify: false })],
        reminders: [reminder('event', 30), reminder('event', 0)],
      };
  }
}

export interface NewEventInput {
  preset: PresetId;
  title: string;
  date: Civil;
  /** null = all day */
  time: { h: number; mi: number } | null;
  zone: string;
  calendar?: CalendarSystem;
  lunar?: LunarDate | null;
  leapRule?: LeapRule;
  spanStart?: Civil | null;
  now: number;
  tradition?: 'ko' | 'ja';
}

export function anchorInstant(date: Civil, time: { h: number; mi: number } | null, zone: string): number {
  return instantOf({ ...date, h: time?.h ?? 0, mi: time?.mi ?? 0, s: 0, ms: 0 }, zone);
}

/** Gregorian date of a lunar anchor, or null if that lunar date does not exist. */
export function lunarAnchorDate(calendar: CalendarSystem, lunar: LunarDate): Civil | null {
  if (calendar === 'gregorian') return null;
  const n = lunarToDayNumber(calendar, lunar);
  return n === null ? null : fromDayNumber(n);
}

export function newEvent(input: NewEventInput): CountEvent {
  const info = PRESETS.find((p) => p.id === input.preset) ?? PRESETS[0];
  const calendar = input.calendar ?? 'gregorian';
  let date = input.date;
  if (calendar !== 'gregorian' && input.lunar) date = lunarAnchorDate(calendar, input.lunar) ?? date;
  return {
    id: uid(),
    title: input.title,
    emoji: info.emoji,
    color: info.color,
    preset: input.preset,
    epochMs: anchorInstant(date, input.time, input.zone),
    zone: input.zone,
    allDay: input.time === null,
    spanStartMs: input.spanStart ? anchorInstant(input.spanStart, null, input.zone) : null,
    calendar,
    lunar: calendar === 'gregorian' ? null : (input.lunar ?? null),
    leapRule: input.leapRule ?? 'regular',
    displayZone: 'event',
    ...presetFields(input.preset, input.tradition),
    notes: '',
    listId: null,
    tags: [],
    pinned: false,
    archived: false,
    private: false,
    createdAt: input.now,
    editedAt: input.now,
  };
}

/** Day number helper for tests and UI. */
export function civilDay(c: Civil): number {
  return dayNumber(c);
}
