// Turns engine output into display strings. Shared by cards, the detail
// screen, the share image and accessibility labels.

import { countState, isLunar, readoutValue, type CountState, type ReadoutValue } from '../core/count';
import { nextMilestones, type Milestone } from '../core/milestones';
import type { CountEvent, Readout, Settings } from '../core/types';
import type { Formatter } from '../i18n/format';

export const PALETTE: Record<string, { light: string; dark: string }> = {
  rose: { light: '#e11d48', dark: '#fb7185' },
  pink: { light: '#db2777', dark: '#f472b6' },
  orange: { light: '#ea580c', dark: '#fb923c' },
  amber: { light: '#b45309', dark: '#fbbf24' },
  lime: { light: '#4d7c0f', dark: '#a3e635' },
  green: { light: '#15803d', dark: '#4ade80' },
  teal: { light: '#0f766e', dark: '#2dd4bf' },
  sky: { light: '#0369a1', dark: '#38bdf8' },
  blue: { light: '#2563eb', dark: '#60a5fa' },
  indigo: { light: '#4f46e5', dark: '#818cf8' },
  violet: { light: '#7c3aed', dark: '#a78bfa' },
  slate: { light: '#475569', dark: '#94a3b8' },
};

/** A color value is a palette name, "#rrggbb", or "grad:<first>,<second>" (either part a name or hex). */
export function parseColor(value: string): { a: string; b: string | null } {
  if (value.startsWith('grad:')) {
    const [a, b] = value.slice(5).split(',');
    return { a: a || 'blue', b: b || null };
  }
  return { a: value, b: null };
}

/** The accent (first) color of a color value, adjusted for the theme. */
export function colorOf(value: string, dark: boolean): string {
  const name = parseColor(value).a;
  if (/^#[0-9a-f]{6}$/i.test(name)) return name.toLowerCase();
  const p = PALETTE[name] ?? PALETTE.blue;
  return dark ? p.dark : p.light;
}

/** Soft card background: a tint of the color, or of both colors for a gradient. */
export function tintOf(value: string, dark: boolean, black: boolean): string {
  const { a, b } = parseColor(value);
  const base = dark ? (black ? '#000000' : '#16181d') : '#ffffff';
  const amount = dark ? 0.16 : 0.1;
  const first = mix(colorOf(a, dark), base, amount);
  if (!b) return first;
  return `linear-gradient(135deg, ${first}, ${mix(colorOf(b, dark), base, amount * 1.6)})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix `hex` into `base` by `amount` (0–1). Done in JS so old WebViews without color-mix() still work. */
export function mix(hex: string, base: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(base);
  const c = a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export interface Shown {
  /** Big text (D-12, 1,408, 만 35세 …). */
  main: string;
  /** Number/unit pairs for split display; when set, `main` is the plain-text form. */
  parts?: { n: string; u: string }[];
  /** Small line under the number. */
  sub: string;
  /** Short label for chips ("D-day", "Age" …). */
  label: string;
  /** 0–1 for progress readouts. */
  progress?: number;
  aria: string;
}

/** Readouts that make sense right now (no pregnancy weeks after the birth, no age before it). */
export function applicable(ev: CountEvent, st: CountState, r: Readout): boolean {
  switch (r.style) {
    case 'gestation':
      return st.mode === 'down' && st.dday >= -280 && ev.repeat === 'none';
    case 'age':
      return st.todayDay >= st.origin.day;
    case 'counter':
      return !!ev.counter;
    case 'percent':
      return true;
    default:
      return true;
  }
}

export function visibleReadouts(ev: CountEvent, st: CountState): Readout[] {
  const list = ev.readouts.filter((r) => applicable(ev, st, r));
  return list.length ? list : [{ id: 'fallback', style: 'dday', units: [], rounding: 'floor', basis: 'target' }];
}

export function show(ev: CountEvent, st: CountState, rv: ReadoutValue, f: Formatter, settings: Settings): Shown {
  const s = f.s;
  const title = ev.title || s.presets[ev.preset];
  const target = rv.fromOrigin ? st.origin : st.target;
  const dateStr = f.date(target.civil);
  switch (rv.readout.style) {
    case 'dday': {
      if (rv.mode === 'ended') return { main: s.count.ended, sub: dateStr, label: s.count.ddayLabel, aria: `${title}: ${s.count.ended}` };
      const n = rv.dday ?? 0;
      const main = f.dday(n);
      let sub: string;
      if (n === 0) sub = s.common.today;
      else if (n > 0 && ev.dayOne) sub = f.t(s.count.dayN, { n: f.num(n) });
      else sub = f.relDays(-n);
      return { main, sub, label: s.count.ddayLabel, aria: `${title}: ${main}, ${sub}` };
    }
    case 'units': {
      const parts = f.unitParts(rv.values, rv.readout.units);
      const text = f.units(rv.values, rv.readout.units);
      if (rv.direction === 'none') {
        return { main: text, parts, sub: s.count.ended, label: s.count.ended, aria: `${title}: ${s.count.ended}` };
      }
      const word = rv.direction === 'until' ? s.count.left : f.t(s.count.fromOriginLabel, { date: dateStr });
      const label = rv.direction === 'until' ? s.count.left : s.count.since;
      return {
        main: text,
        parts,
        sub: rv.direction === 'until' ? `${s.count.left} · ${dateStr}` : word,
        label,
        aria: f.t(s.a11y.readout, { value: text, dir: rv.direction === 'until' ? s.count.until : s.count.since, title }),
      };
    }
    case 'age': {
      const a = rv.age!;
      const main = f.t(s.count.internationalAge, { n: a.international });
      const extra = settings.showCountingAge ? f.t(s.count.countingAge, { n: a.counting }) : '';
      return { main, sub: extra, label: s.count.ageLabel, aria: `${title}: ${main}${extra ? ', ' + extra : ''}` };
    }
    case 'percent': {
      const p = rv.percent!;
      const main = f.percent(p.fraction);
      const sub = `${f.t(s.count.daysServed, { n: f.units({ days: p.elapsedDays }, ['days']) })} · ${f.t(s.count.daysLeft, { n: f.units({ days: p.remainingDays }, ['days']) })}`;
      return { main, sub, label: s.count.percentLabel, progress: p.fraction, aria: `${title}: ${main}, ${sub}` };
    }
    case 'business': {
      const b = rv.business!;
      const main = f.t(s.count.business, { n: f.num(b.days) });
      const country = b.holidays ? s.settingsExtra.countries[b.holidays] : '';
      const sub = `${f.t(s.count.businessSub, { holidays: country ? f.t(s.count.businessHolidays, { country }) : '' })} · ${rv.direction === 'until' ? s.count.left : s.count.since}`;
      return { main, sub, label: s.count.businessLabel, aria: `${title}: ${main}, ${sub}` };
    }
    case 'counter': {
      const c = rv.counter!;
      const main = `${f.num(c.value)}${c.unit ? (f.lang === 'en' ? ' ' : '') + c.unit : ''}`;
      const label = c.label || s.counterUi.title;
      return { main, sub: label, label, aria: `${title}: ${label} ${main}` };
    }
    case 'gestation': {
      const g = rv.gestation!;
      const main = f.t(s.count.gestation, { w: g.weeks, d: g.days });
      const sub = g.totalDays > 280 ? s.count.pastDue : `${f.t(s.count.trimester, { n: g.trimester })} · ${f.dday(st.dday)}`;
      return { main, sub, label: s.count.gestationLabel, aria: `${title}: ${main}, ${sub}` };
    }
  }
}

export interface EventView {
  ev: CountEvent;
  st: CountState;
  readouts: { r: Readout; rv: ReadoutValue; shown: Shown }[];
  dateLine: string;
  next: Milestone | null;
}

export function viewOf(ev: CountEvent, now: number, f: Formatter, settings: Settings, withNext = true): EventView | null {
  const st = countState(ev, now);
  if (!st) return null;
  const readouts = visibleReadouts(ev, st).map((r) => {
    const rv = readoutValue(ev, st, r, { holidays: settings.holidays });
    return { r, rv, shown: show(ev, st, rv, f, settings) };
  });
  return { ev, st, readouts, dateLine: dateLine(ev, st, f), next: withNext ? (nextMilestones(ev, st.todayDay, 1)[0] ?? null) : null };
}

export function dateLine(ev: CountEvent, st: CountState, f: Formatter): string {
  const o = st.target;
  let s = f.date(o.civil, true);
  if (!ev.allDay) {
    const parts = new Intl.DateTimeFormat(f.lang === 'ko' ? 'ko-KR' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: st.zone }).format(o.epochMs);
    s += ` · ${parts}`;
  }
  if (isLunar(ev) && o.lunar) s += ` · ${f.lunar(o.lunar, ev.calendar)}`;
  return s;
}

export function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || t === 'black';
}
