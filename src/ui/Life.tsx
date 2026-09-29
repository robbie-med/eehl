// Life view: every week of a life as one square, 52 per row, one row per
// year of age. Rows start on each birthday (so a row is 52 weeks = 364 days;
// the day or two left over is folded into the last week). Events and
// milestones are plotted as colored squares.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addYears, dayNumber, fromDayNumber, parseISODate, toISODate, type Civil } from '../core/civil';
import { occurrence } from '../core/count';
import { milestonesFor } from '../core/milestones';
import { deviceZone, wallAt } from '../core/zone';
import { data, fmt, now, settings, t, updateSettings } from '../state/store';
import { Field, Section, Segmented, Select } from './components';
import { colorOf } from './present';
import { go } from './router';
import { isDarkTheme } from './theme';

interface Mark {
  day: number;
  color: string;
  label: string;
  eventId: string;
}

function cellOf(birth: Civil, day: number): { row: number; col: number } | null {
  const b = dayNumber(birth);
  if (day < b) return null;
  let row = fromDayNumber(day).y - birth.y;
  while (row > 0 && dayNumber(addYears(birth, row)) > day) row--;
  const start = dayNumber(addYears(birth, row));
  return { row, col: Math.min(51, Math.floor((day - start) / 7)) };
}

export function Life() {
  const s = t.value;
  const l = s.life;
  const f = fmt.value;
  const set = settings.value;
  const life = set.life;
  const dark = isDarkTheme();
  const events = data.value.events.filter((e) => !e.archived);
  const birthdays = events.filter((e) => e.preset === 'birthday');
  const today = dayNumber(wallAt(now.value, deviceZone()));

  const birthEvent = events.find((e) => e.id === life.birthEventId);
  const birth: Civil | null = birthEvent ? (occurrence(birthEvent, 0)?.civil ?? null) : life.birthDate ? parseISODate(life.birthDate) : null;
  const years = Math.max(10, Math.min(120, life.years || 90));
  const source = birthEvent || !life.birthDate ? 'event' : 'date';

  const marks = useMemo<Mark[]>(() => {
    if (!birth) return [];
    const from = dayNumber(birth);
    const to = dayNumber(addYears(birth, years));
    const out: Mark[] = [];
    for (const ev of events) {
      const color = colorOf(ev.color, dark);
      const o = occurrence(ev, 0);
      if (o && o.day >= from && o.day < to && ev.id !== birthEvent?.id) out.push({ day: o.day, color, label: `${ev.emoji} ${ev.title}`, eventId: ev.id });
      // Yearly milestones would paint a column; keep the one-off ones.
      for (const m of milestonesFor(ev, from, to)) {
        if (m.label.kind === 'year' || m.label.kind === 'wedding' || m.label.kind === 'month') continue;
        out.push({ day: m.day, color, label: `${ev.emoji} ${ev.title} · ${f.milestone(m.label)}`, eventId: ev.id });
      }
    }
    return out;
  }, [data.value, birth?.y, birth?.m, birth?.d, years, dark, f]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<{ row: number; col: number } | null>(null);
  const [width, setWidth] = useState(360);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [!!birth]);

  const gutter = 28;
  const cell = Math.max(4, (width - gutter) / 52);
  const gap = cell > 7 ? 1.5 : 1;
  const height = Math.ceil(years * cell);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !birth) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim() || '#222';
    const line = css.getPropertyValue('--line').trim() || '#ddd';
    const brand = css.getPropertyValue('--brand').trim() || '#d4532b';
    const muted = css.getPropertyValue('--muted').trim() || '#888';
    const nowCell = cellOf(birth, today);
    const lived = (row: number, col: number) => !!nowCell && (row < nowCell.row || (row === nowCell.row && col < nowCell.col));
    ctx.font = `600 ${Math.min(11, cell + 2)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < years; row++) {
      if (row % 10 === 0) {
        ctx.fillStyle = muted;
        ctx.fillText(String(row), gutter - 6, row * cell + cell / 2);
      }
      for (let col = 0; col < 52; col++) {
        ctx.fillStyle = lived(row, col) ? ink : line;
        ctx.globalAlpha = lived(row, col) ? 0.55 : 1;
        ctx.fillRect(gutter + col * cell, row * cell, cell - gap, cell - gap);
      }
    }
    ctx.globalAlpha = 1;
    for (const m of marks) {
      const p = cellOf(birth, m.day);
      if (!p || p.row >= years) continue;
      ctx.fillStyle = m.color;
      ctx.fillRect(gutter + p.col * cell, p.row * cell, cell - gap, cell - gap);
    }
    if (nowCell && nowCell.row < years) {
      ctx.strokeStyle = brand;
      ctx.lineWidth = 2;
      ctx.strokeRect(gutter + nowCell.col * cell - 1, nowCell.row * cell - 1, cell - gap + 2, cell - gap + 2);
    }
    if (picked) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gutter + picked.col * cell - 1, picked.row * cell - 1, cell - gap + 2, cell - gap + 2);
    }
  }, [width, height, marks, today, picked, birth?.y, birth?.m, birth?.d, years, dark]);

  const nowCell = birth ? cellOf(birth, today) : null;
  const weeksLived = birth ? Math.floor((today - dayNumber(birth)) / 7) : 0;
  const weeksLeft = birth ? Math.max(0, Math.floor((dayNumber(addYears(birth, years)) - today) / 7)) : 0;
  const pickedStart = birth && picked ? dayNumber(addYears(birth, picked.row)) + picked.col * 7 : null;
  const pickedMarks = pickedStart !== null && birth ? marks.filter((m) => {
    const p = cellOf(birth, m.day);
    return p && p.row === picked!.row && p.col === picked!.col;
  }) : [];

  return (
    <div class="page life">
      <header class="topbar">
        <h1 class="topbar-title left">{l.title}</h1>
      </header>
      <p class="muted">{l.intro}</p>
      <Section>
        <Field label={l.birth}>
          <Segmented
            value={source}
            options={[
              { value: 'event', label: l.birthEvent },
              { value: 'date', label: l.birthDate },
            ]}
            onChange={(v) =>
              updateSettings({
                life: v === 'event' ? { ...life, birthDate: null, birthEventId: life.birthEventId ?? birthdays[0]?.id ?? null } : { ...life, birthEventId: null, birthDate: life.birthDate ?? toISODate(birth ?? { y: 1990, m: 1, d: 1 }) },
              })
            }
          />
        </Field>
        {source === 'event' ? (
          <Select
            value={life.birthEventId ?? ''}
            ariaLabel={l.birthEvent}
            options={[{ value: '', label: '—' }, ...birthdays.map((e) => ({ value: e.id, label: `${e.emoji} ${e.title}` }))]}
            onChange={(v) => updateSettings({ life: { ...life, birthEventId: v || null } })}
          />
        ) : (
          <input
            class="input"
            type="date"
            aria-label={l.birthDate}
            value={life.birthDate ?? ''}
            onInput={(e) => updateSettings({ life: { ...life, birthDate: (e.target as HTMLInputElement).value || null } })}
          />
        )}
        <Field label={l.years}>
          <input
            class="input narrow"
            type="number"
            min={10}
            max={120}
            value={years}
            onInput={(e) => updateSettings({ life: { ...life, years: Math.max(10, Math.min(120, Number((e.target as HTMLInputElement).value) || 90)) } })}
          />
        </Field>
      </Section>

      {!birth ? (
        <p class="muted center">{l.chooseBirth}</p>
      ) : (
        <>
          <p class="life-stats">
            <strong>{f.t(l.weeksLived, { n: f.num(weeksLived) })}</strong> · {f.t(l.weeksLeft, { n: f.num(weeksLeft), age: years })}
          </p>
          <div class="life-legend" aria-hidden="true">
            <span>
              <i class="lived" /> {l.legendPast}
            </span>
            <span>
              <i class="now" /> {l.legendNow}
            </span>
            <span>
              <i class="mark" /> {l.legendEvent}
            </span>
          </div>
          <div class="life-grid" ref={wrap}>
            <canvas
              ref={canvas}
              style={{ width: `${width}px`, height: `${height}px` }}
              role="img"
              aria-label={`${f.t(l.weeksLived, { n: weeksLived })}. ${f.t(l.weeksLeft, { n: weeksLeft, age: years })}`}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
                const col = Math.floor((e.clientX - r.left - gutter) / cell);
                const row = Math.floor((e.clientY - r.top) / cell);
                if (col >= 0 && col < 52 && row >= 0 && row < years) setPicked({ row, col });
              }}
            />
          </div>
          {picked && pickedStart !== null && (
            <div class="life-picked" role="status">
              <strong>{f.t(l.week, { date: f.date(fromDayNumber(pickedStart)), age: picked.row })}</strong>
              {pickedMarks.map((m, i) => (
                <button key={i} class="link-row" onClick={() => go(`event/${m.eventId}`)}>
                  <span class="dot" style={{ background: m.color }} /> {m.label} · {f.date(fromDayNumber(m.day))}
                </button>
              ))}
            </div>
          )}
          {nowCell === null && <p class="muted">{l.chooseBirth}</p>}
        </>
      )}
    </div>
  );
}
