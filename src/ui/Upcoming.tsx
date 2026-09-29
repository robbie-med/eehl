import { useMemo, useState } from 'preact/hooks';
import { dayNumber } from '../core/civil';
import { agenda } from '../core/schedule';
import { deviceZone, wallAt } from '../core/zone';
import { fromDayNumber } from '../core/civil';
import { holidaysOn, type HolidayCountry } from '../core/holidays';
import { solarTermsBetween } from '../core/solarterms';
import type { Settings } from '../core/types';
import { HOLIDAY_NAMES } from '../i18n/holiday-names';
import type { Lang } from '../i18n/format';
import { data, fmt, lang, now, settings, t } from '../state/store';
import { Icon, Segmented } from './components';
import { EventCard, EventActions } from './Home';
import { colorOf, viewOf, type EventView } from './present';
import { go } from './router';
import { isDarkTheme } from './theme';

export function Upcoming() {
  const s = t.value;
  const f = fmt.value;
  const [range, setRange] = useState<'30' | '90' | '365'>('90');
  const today = dayNumber(wallAt(now.value, deviceZone()));
  const hourKey = Math.floor(now.value / 3_600_000);
  const items = useMemo(() => agenda(data.value.events, today, today + Number(range)), [data.value, today, range, hourKey]);
  const dark = isDarkTheme();

  const set = settings.value;
  const overlays = useMemo(() => calendarOverlays(set, today, today + Number(range), lang.value), [set.holidays, set.showHolidays, set.showSolarTerms, today, range, lang.value]);

  const byDay = new Map<number, typeof items>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);
  for (const o of overlays) if (!byDay.has(o.day)) byDay.set(o.day, []);
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div class="page upcoming">
      <header class="topbar">
        <h1 class="topbar-title left">{s.upcoming.title}</h1>
      </header>
      <div class="pad">
        <Segmented
          value={range}
          ariaLabel={s.upcoming.title}
          options={(['30', '90', '365'] as const).map((n) => ({ value: n, label: f.units({ days: Number(n) }, ['days']) }))}
          onChange={setRange}
        />
      </div>
      {days.length === 0 && <p class="muted center">{s.upcoming.empty}</p>}
      <ol class="agenda">
        {days.map((day) => {
          const list = byDay.get(day)!;
          const marks = overlays.filter((o) => o.day === day);
          return (
          <li key={day} class={day === today ? 'is-today' : ''}>
            <div class="agenda-date">
              <span class="agenda-rel">{f.relDays(day - today)}</span>
              <span class="agenda-abs">{f.date(fromDayNumber(day), true)}</span>
            </div>
            {marks.length > 0 && (
              <div class="agenda-marks">
                {marks.map((o) => (
                  <span key={o.key} class={'agenda-mark ' + o.kind} title={o.kind === 'holiday' ? s.upcomingExtra.holiday : s.upcomingExtra.solarTerm}>
                    {o.label}
                  </span>
                ))}
              </div>
            )}
            <ul>
              {list.map((it) => (
                <li key={it.key}>
                  <button class="agenda-item" onClick={() => go(`event/${it.event.id}`)} style={{ '--accent': colorOf(it.event.color, dark) } as Record<string, string>}>
                    <span class="emoji" aria-hidden="true">
                      {it.event.emoji}
                    </span>
                    <span class="agenda-text">
                      <span class="agenda-title">{it.event.title}</span>
                      <span class="agenda-label">
                        {it.kind === 'milestone' ? f.milestone(it.milestone!.label) : it.occurrence!.k > 0 && it.event.repeat === 'yearly' ? f.milestone({ kind: 'year', n: it.occurrence!.k, preset: it.event.preset }) : s.upcoming.eventDay}
                      </span>
                    </span>
                    <span class="agenda-dday">{f.dday(today - day)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Archive() {
  const s = t.value;
  const f = fmt.value;
  const set = settings.value;
  const views = data.value.events
    .filter((e) => e.archived)
    .map((e) => viewOf(e, now.value, f, set, false))
    .filter((v): v is EventView => !!v);
  return (
    <div class="page">
      <header class="topbar">
        <button class="icon-btn" aria-label={s.common.back} onClick={() => go('', true)}>
          <Icon name="back" />
        </button>
        <h1 class="topbar-title">{s.home.archived}</h1>
        <span class="icon-btn" />
      </header>
      {views.length === 0 && <p class="muted center">{s.upcoming.empty}</p>}
      <div class="cards compact">
        {views.map((v) => (
          <EventCard key={v.ev.id} v={v} mode="compact" />
        ))}
      </div>
      <EventActions />
    </div>
  );
}

const TERM_ZONE: Record<HolidayCountry, string> = {
  KR: 'Asia/Seoul',
  JP: 'Asia/Tokyo',
  CN: 'Asia/Shanghai',
  TW: 'Asia/Taipei',
  HK: 'Asia/Hong_Kong',
  US: 'America/New_York',
};

export interface Overlay {
  key: string;
  day: number;
  kind: 'holiday' | 'term';
  label: string;
}

/** Public holidays and solar terms between two days, labelled in the UI language. */
export function calendarOverlays(set: Settings, from: number, to: number, ui: Lang): Overlay[] {
  const out: Overlay[] = [];
  const name = (key: string) => HOLIDAY_NAMES[key]?.[ui] ?? key;
  if (set.holidays && set.showHolidays) {
    for (let d = from; d <= to; d++) {
      for (const h of holidaysOn(set.holidays, d)) out.push({ key: `${h.key}:${d}`, day: d, kind: 'holiday', label: name(h.key) });
    }
  }
  if (set.showSolarTerms) {
    // Korean and Chinese reckoning differ by a day now and then; use the chosen country's zone.
    const zone = set.holidays ? TERM_ZONE[set.holidays] : ui === 'ko' ? 'Asia/Seoul' : ui === 'ja' ? 'Asia/Tokyo' : ui.startsWith('zh') ? 'Asia/Shanghai' : deviceZone();
    for (const term of solarTermsBetween(from, to, zone)) out.push({ key: `term:${term.key}:${term.day}`, day: term.day, kind: 'term', label: name(term.key) });
  }
  return out;
}
