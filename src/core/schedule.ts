// Everything computed ahead of time for places where the engine cannot run:
// the Upcoming agenda, the notification schedule handed to Android's
// AlarmManager (or checked while the web app is open), and the widget
// timeline segments the Android widget evaluates at midnight.

import { dayNumber, fromDayNumber, type Civil } from './civil';
import { displayZoneOf, occurrence, occurrenceOnOrAfter, type Occurrence } from './count';
import { milestonesFor, type Milestone } from './milestones';
import type { AppData, CountEvent } from './types';
import { deviceZone, instantOf, wallAt } from './zone';
import type { Formatter } from '../i18n/format';

export interface AgendaItem {
  key: string;
  event: CountEvent;
  day: number;
  civil: Civil;
  kind: 'event' | 'milestone';
  occurrence?: Occurrence;
  milestone?: Milestone;
}

export function eventOccurrencesBetween(ev: CountEvent, fromDay: number, toDay: number): Occurrence[] {
  const out: Occurrence[] = [];
  let o = occurrenceOnOrAfter(ev, fromDay);
  while (o && o.day <= toDay && out.length < 400) {
    out.push(o);
    if (ev.repeat === 'none') break;
    o = occurrence(ev, o.k + 1);
  }
  return out;
}

export function agenda(events: CountEvent[], fromDay: number, toDay: number): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const ev of events) {
    if (ev.archived) continue;
    for (const o of eventOccurrencesBetween(ev, fromDay, toDay)) {
      items.push({ key: `${ev.id}:occ:${o.k}`, event: ev, day: o.day, civil: o.civil, kind: 'event', occurrence: o });
    }
    for (const m of milestonesFor(ev, fromDay, toDay)) {
      items.push({ key: `${ev.id}:${m.key}`, event: ev, day: m.day, civil: m.civil, kind: 'milestone', milestone: m });
    }
  }
  return items.sort((a, b) => a.day - b.day || a.event.title.localeCompare(b.event.title));
}

export interface ScheduledNotification {
  /** Stable across rebuilds, so re-scheduling replaces rather than duplicates. */
  id: string;
  at: number;
  title: string;
  body: string;
  channel: 'milestones' | 'reminders' | 'digest';
  eventId: string | null;
  alarm: boolean;
}

function parseTime(s: string): { h: number; mi: number } {
  const [h, mi] = s.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 9, mi: Number.isFinite(mi) ? mi : 0 };
}

function at(day: number, time: string, zone: string): number {
  const c = fromDayNumber(day);
  return instantOf({ ...c, ...parseTime(time), s: 0, ms: 0 }, zone);
}

export function eventTitle(ev: CountEvent, f: Formatter): string {
  return ev.private ? `${ev.emoji} ${f.s.notif.privateTitle}` : `${ev.emoji} ${ev.title}`.trim();
}

/**
 * The notification schedule for the next `horizonDays` days, soonest first,
 * capped at `max` (Android allows 500 pending alarms per app; the shell only
 * ever arms the next one and keeps the rest in a list).
 */
export function buildSchedule(
  data: AppData,
  now: number,
  f: Formatter,
  horizonDays = 400,
  max = 500,
): ScheduledNotification[] {
  const out: ScheduledNotification[] = [];
  const s = f.s.notif;
  for (const ev of data.events) {
    if (ev.archived) continue;
    const today = dayNumber(wallAt(now, ev.zone));
    const title = eventTitle(ev, f);
    for (const r of ev.reminders) {
      const end = today + horizonDays + r.daysBefore;
      if (r.target === 'event') {
        for (const o of eventOccurrencesBetween(ev, today, end)) {
          const when = ev.allDay || r.daysBefore > 0 ? at(o.day - r.daysBefore, r.time, ev.zone) : at(o.day, r.time, ev.zone);
          if (when <= now) continue;
          const body = r.daysBefore === 0 ? s.eventToday : r.daysBefore === 1 ? s.eventTomorrow : f.t(s.eventInDays, { n: f.num(r.daysBefore) });
          out.push({ id: `${ev.id}:${r.id}:${o.k}`, at: when, title, body, channel: 'reminders', eventId: ev.id, alarm: r.channel === 'alarm' });
        }
      } else {
        for (const m of milestonesFor(ev, today, end)) {
          if (!m.notify) continue;
          const when = at(m.day - r.daysBefore, r.time, ev.zone);
          if (when <= now) continue;
          const label = f.milestone(m.label);
          const body = r.daysBefore === 0 ? f.t(s.milestoneToday, { label }) : f.t(s.milestoneInDays, { label, n: f.num(r.daysBefore) });
          out.push({ id: `${ev.id}:${r.id}:${m.key}`, at: when, title, body, channel: 'milestones', eventId: ev.id, alarm: r.channel === 'alarm' });
        }
      }
    }
  }

  const digest = data.settings.digest;
  if (digest.enabled) {
    const zone = deviceZone();
    const today = dayNumber(wallAt(now, zone));
    const items = agenda(data.events, today, today + horizonDays);
    const byDay = new Map<number, AgendaItem[]>();
    for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);
    for (const [day, list] of byDay) {
      const when = at(day, digest.time, zone);
      if (when <= now) continue;
      const lines = list.slice(0, 4).map((it) => {
        const t = it.event.private ? `${it.event.emoji} ${s.privateTitle}` : `${it.event.emoji} ${it.event.title}`;
        return it.kind === 'milestone' ? `${t} · ${f.milestone(it.milestone!.label)}` : `${t} · ${f.dday(0)}`;
      });
      if (list.length > 4) lines.push(f.t(s.digestMore, { n: list.length - 4 }));
      out.push({ id: `digest:${day}`, at: when, title: s.digestTitle, body: lines.join('\n'), channel: 'digest', eventId: null, alarm: false });
    }
  }

  return out.sort((a, b) => a.at - b.at).slice(0, max);
}

/**
 * A run of days over which the D-day number changes linearly:
 * value(day) = base + slope * (day - from). `ended` runs show "Ended".
 */
export type Segment = [from: number, to: number, base: number, slope: -1 | 0 | 1, ended: 0 | 1, subtitle: string];

/** D-day number on a given day, mirroring countState at day granularity. */
export function ddayOnDay(ev: CountEvent, day: number, occDay: (o: Occurrence) => number): { n: number; ended: boolean; target: Occurrence } | null {
  const origin = occurrence(ev, 0);
  if (!origin) return null;
  const originDay = occDay(origin);
  const one = ev.dayOne ? 1 : 0;
  if (ev.repeat !== 'none') {
    if (ev.direction === 'up' && originDay <= day) return { n: day - originDay + one, ended: false, target: origin };
    let o = occurrenceOnOrAfter(ev, day - 1);
    while (o && occDay(o) < day) o = occurrence(ev, o.k + 1);
    if (!o) return { n: day - originDay + one, ended: false, target: origin };
    return { n: day - occDay(o), ended: false, target: o };
  }
  if (day < originDay) return { n: day - originDay, ended: false, target: origin };
  if (day === originDay) return { n: ev.allDay && ev.dayOne ? 1 : 0, ended: false, target: origin };
  if (ev.direction === 'down' && ev.endBehavior !== 'flip') return { n: day - originDay, ended: true, target: origin };
  return { n: day - originDay + one, ended: false, target: origin };
}

export interface WidgetEvent {
  id: string;
  title: string;
  emoji: string;
  color: string;
  private: boolean;
  zone: string;
  segments: Segment[];
}

export interface WidgetPayload {
  generatedAt: number;
  ddayWord: string;
  endedWord: string;
  privateTitle: string;
  staleWord: string;
  manGrouping: boolean;
  lang: string;
  events: WidgetEvent[];
}

export function widgetSegments(ev: CountEvent, fromDay: number, days: number, subtitle: (o: Occurrence) => string): Segment[] {
  const zone = displayZoneOf(ev);
  const cache = new Map<number, number>();
  const occDay = (o: Occurrence) => {
    if (ev.allDay || zone === ev.zone) return o.day;
    let d = cache.get(o.k);
    if (d === undefined) cache.set(o.k, (d = dayNumber(wallAt(o.epochMs, zone))));
    return d;
  };
  const segs: Segment[] = [];
  let cur: Segment | null = null;
  for (let day = fromDay; day < fromDay + days; day++) {
    const r = ddayOnDay(ev, day, occDay);
    if (!r) break;
    const sub = subtitle(r.target);
    const ended: 0 | 1 = r.ended ? 1 : 0;
    if (cur && cur[4] === ended && cur[5] === sub) {
      if (cur[1] === cur[0]) {
        const slope = r.n - cur[2];
        if (slope === -1 || slope === 0 || slope === 1) {
          cur[3] = slope;
          cur[1] = day;
          continue;
        }
      } else if (r.n === cur[2] + cur[3] * (day - cur[0])) {
        cur[1] = day;
        continue;
      }
    }
    cur = [day, day, r.n, 0, ended, sub];
    segs.push(cur);
  }
  return segs;
}

export function buildWidgetPayload(data: AppData, now: number, f: Formatter, days = 3 * 366): WidgetPayload {
  const events: WidgetEvent[] = [];
  for (const ev of data.events) {
    if (ev.archived) continue;
    const zone = displayZoneOf(ev);
    const today = dayNumber(wallAt(now, zone));
    const segments = widgetSegments(ev, today - 1, days, (o) => f.date(o.civil));
    events.push({ id: ev.id, title: ev.title, emoji: ev.emoji, color: ev.color, private: ev.private, zone, segments });
  }
  return {
    generatedAt: now,
    ddayWord: f.dday(0),
    endedWord: f.s.count.ended,
    privateTitle: f.s.notif.privateTitle,
    staleWord: '—',
    manGrouping: f.opts.manGrouping,
    lang: f.lang,
    events,
  };
}

/** Evaluate a segment list (the same logic the Kotlin widget uses). */
export function evalSegments(segs: Segment[], day: number): { n: number; ended: boolean; subtitle: string } | null {
  for (const s of segs) {
    if (day >= s[0] && day <= s[1]) return { n: s[2] + s[3] * (day - s[0]), ended: s[4] === 1, subtitle: s[5] };
  }
  const last = segs[segs.length - 1];
  if (last && day > last[1] && last[3] !== 0 && last[2] + last[3] * (last[1] - last[0]) > 0) {
    // Counting up with nothing ahead: keep counting.
    return { n: last[2] + last[3] * (day - last[0]), ended: last[4] === 1, subtitle: last[5] };
  }
  return null;
}
