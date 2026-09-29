import { useMemo, useState } from 'preact/hooks';
import { dayNumber } from '../core/civil';
import { agenda } from '../core/schedule';
import { deviceZone, wallAt } from '../core/zone';
import { data, fmt, now, settings, t } from '../state/store';
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

  const byDay = new Map<number, typeof items>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);

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
      {items.length === 0 && <p class="muted center">{s.upcoming.empty}</p>}
      <ol class="agenda">
        {[...byDay.entries()].map(([day, list]) => (
          <li key={day} class={day === today ? 'is-today' : ''}>
            <div class="agenda-date">
              <span class="agenda-rel">{f.relDays(day - today)}</span>
              <span class="agenda-abs">{f.date(list[0].civil, true)}</span>
            </div>
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
        ))}
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
