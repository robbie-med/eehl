import { parseISODate } from './civil';
import { newEvent, type NewEventInput } from './presets';
import type { CountEvent } from './types';
import { instantOf } from './zone';

export function d(s: string) {
  const c = parseISODate(s);
  if (!c) throw new Error('bad date ' + s);
  return c;
}

/** Instant of a wall time "YYYY-MM-DD HH:MM" in a zone. */
export function at(s: string, zone = 'Asia/Seoul'): number {
  const [date, time = '00:00'] = s.split(' ');
  const [h, mi] = time.split(':').map(Number);
  return instantOf({ ...d(date), h, mi, s: 0, ms: 0 }, zone);
}

export function ev(
  date: string,
  opts: Partial<Omit<NewEventInput, 'date'>> & { event?: Partial<CountEvent> } = {},
): CountEvent {
  const { event, ...rest } = opts;
  const e = newEvent({ preset: 'custom', title: 'T', time: null, zone: 'Asia/Seoul', now: 0, ...rest, date: d(date) });
  return { ...e, ...event };
}
