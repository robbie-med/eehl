// The data model. An Event owns its date once; readouts, milestone rules and
// reminders hang off it, so one date never has to be entered twice.

import type { LeapRule, LunarDate } from './lunar';

export type CalendarSystem = 'gregorian' | 'korean-lunar' | 'chinese-lunar';
export type Repeat = 'none' | 'yearly' | 'monthly';
/** auto: count down until the date, then count up. */
export type Direction = 'auto' | 'down' | 'up';
/** What a countdown does once its date has passed (direction 'down' only). */
export type EndBehavior = 'flip' | 'archive' | 'stop';
export type Rounding = 'floor' | 'round' | 'ceil';
export type Unit = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';
export const UNITS: Unit[] = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'];

export type PresetId =
  | 'custom'
  | 'couple'
  | 'baby'
  | 'birthday'
  | 'wedding'
  | 'memorial'
  | 'exam'
  | 'service';

export type ReadoutStyle =
  /** D-12 / D-Day / D+12 */
  | 'dday'
  /** The chosen units, largest first ("3 years 2 months 5 days"); one unit = a single total. */
  | 'units'
  /** International and East Asian counting age. */
  | 'age'
  /** Percent of a span elapsed, with a progress bar. */
  | 'percent'
  /** Gestational age (weeks + days) counting to a due date. */
  | 'gestation';

/**
 * 'target': the date being counted to or from right now (the next
 * occurrence for repeating events). 'origin': the original date, e.g. how old
 * someone is, or how long since a first anniversary.
 */
export type ReadoutBasis = 'target' | 'origin';

export interface Readout {
  id: string;
  style: ReadoutStyle;
  units: Unit[];
  rounding: Rounding;
  basis: ReadoutBasis;
}

export type MilestoneRule =
  | { id: string; type: 'every-n-days'; n: number; limit: number; notify: boolean }
  /** 1,000 / 2,000 / 5,000 / 10,000 … days */
  | { id: string; type: 'round-days'; notify: boolean }
  /** Couple: every 100 days to 1,000, then every 500; 22 days (투투) optional. */
  | { id: string; type: 'couple'; tutu: boolean; notify: boolean }
  /** Baby: one month (满月), 50 days, 100 days (백일), first and second birthdays (돌). */
  | { id: string; type: 'baby'; notify: boolean }
  /** Yearly anniversaries, on the lunar date for lunar events. */
  | { id: string; type: 'yearly'; notify: boolean }
  /** Monthly anniversaries up to `limit` months. */
  | { id: string; type: 'monthly'; limit: number; notify: boolean }
  /** 환갑/還暦, 칠순/古稀 … derived from a birthday. */
  | { id: string; type: 'long-life'; tradition: 'ko' | 'ja'; notify: boolean }
  /** Named wedding anniversaries (paper, wood, tin, silver, gold …). */
  | { id: string; type: 'wedding'; notify: boolean }
  /** A single custom day count ("day 1,000 of sobriety"). */
  | { id: string; type: 'custom-day'; day: number; label: string; notify: boolean };

export type MilestoneType = MilestoneRule['type'];

export interface Reminder {
  id: string;
  /** 'event': the event date (next occurrence). 'milestones': every milestone with notify on. */
  target: 'event' | 'milestones';
  /** Days before the date (0 = on the day). */
  daysBefore: number;
  /** Local time in the event's zone, "HH:MM". */
  time: string;
  channel: 'notification' | 'alarm';
}

export interface CountEvent {
  id: string;
  title: string;
  emoji: string;
  color: string;
  preset: PresetId;

  /** The anchor instant (UTC epoch ms). For all-day events: midnight in `zone`. */
  epochMs: number;
  /** IANA zone the event lives in. */
  zone: string;
  allDay: boolean;
  /** Optional span start, for progress readouts (service obligation, residency, pregnancy). */
  spanStartMs: number | null;

  calendar: CalendarSystem;
  /** For lunar events: the lunar date of the anchor. The Gregorian anchor is derived from it. */
  lunar: LunarDate | null;
  leapRule: LeapRule;

  repeat: Repeat;
  direction: Direction;
  endBehavior: EndBehavior;
  /** Korean convention: the start day is day 1, so 100 days falls on start + 99. */
  dayOne: boolean;
  /** Count the end day itself (school terms, service obligations). */
  inclusiveEnd: boolean;
  /** Display in the event's own zone, or the device's zone. */
  displayZone: 'event' | 'device';

  readouts: Readout[];
  milestones: MilestoneRule[];
  reminders: Reminder[];

  notes: string;
  listId: string | null;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  /** Blur the title in widgets and notifications. */
  private: boolean;
  createdAt: number;
  editedAt: number;
}

export interface EventList {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
}

export type DateFormat = 'locale' | 'DDMMMYYYY' | 'ISO' | 'YMD';
export type ThemeMode = 'system' | 'light' | 'dark' | 'black';
export type CardMode = 'full' | 'compact' | 'grid';
export type SortOrder = 'manual' | 'soonest' | 'date' | 'title';

export interface Settings {
  locale: 'system' | 'en' | 'ko';
  theme: ThemeMode;
  dateFormat: DateFormat;
  /** Show 세는 나이 / 数え年 next to international age. */
  showCountingAge: boolean;
  /** Default for new lunar events. */
  leapRule: LeapRule;
  /** Group large numbers by 만 (1만 2,345). */
  manGrouping: boolean;
  /** 'latin' D-Day, 'hangul' 디데이 on the day itself. */
  ddayScript: 'latin' | 'hangul';
  cardMode: CardMode;
  sort: SortOrder;
  showDates: boolean;
  showArrows: boolean;
  confirmDelete: boolean;
  liveSeconds: boolean;
  weekStart: 0 | 1;
  digest: { enabled: boolean; time: string };
  defaultZone: string | null;
  /** Default reminder applied to new events. */
  defaultReminder: { enabled: boolean; daysBefore: number; time: string };
}

export interface AppData {
  version: 1;
  events: CountEvent[];
  lists: EventList[];
  settings: Settings;
}
