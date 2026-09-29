// Pure formatting: numbers, dates, units, D-day strings, milestone labels.
// No DOM and no global state, so the notification scheduler and the tests
// can use it too.

import type { Civil } from '../core/civil';
import { weekday } from '../core/civil';
import type { LunarCalendar, LunarDate } from '../core/lunar';
import type { MilestoneLabel } from '../core/milestones';
import type { DateFormat, Unit } from '../core/types';
import { UNITS } from '../core/types';
import { en, type Strings } from './en';
import { ko } from './ko';

export type Lang = 'en' | 'ko';

export const STRINGS: Record<Lang, Strings> = { en, ko };

export interface FormatOptions {
  lang: Lang;
  dateFormat: DateFormat;
  manGrouping: boolean;
  ddayScript: 'latin' | 'hangul';
}

const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function fill(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export function ordinalEn(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export class Formatter {
  readonly s: Strings;
  private readonly nf: Intl.NumberFormat;
  private readonly pf: Intl.NumberFormat;
  private readonly df: Intl.DateTimeFormat;
  private readonly wf: Intl.DateTimeFormat;
  private readonly tf: Intl.DateTimeFormat;
  private readonly locale: string;

  constructor(readonly opts: FormatOptions) {
    this.s = STRINGS[opts.lang];
    this.locale = opts.lang === 'ko' ? 'ko-KR' : 'en-US';
    this.nf = new Intl.NumberFormat(this.locale);
    this.pf = new Intl.NumberFormat(this.locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
    this.df = new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: opts.lang === 'ko' ? 'long' : 'short', day: 'numeric', timeZone: 'UTC' });
    this.wf = new Intl.DateTimeFormat(this.locale, { weekday: 'short', timeZone: 'UTC' });
    this.tf = new Intl.DateTimeFormat(this.locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  }

  get lang(): Lang {
    return this.opts.lang;
  }

  t(template: string, params?: Record<string, string | number>): string {
    return fill(template, params);
  }

  /** Integer with locale grouping, or 만/억 grouping when enabled. */
  num(n: number): string {
    const neg = n < 0;
    const a = Math.abs(Math.trunc(n));
    if (!this.opts.manGrouping || a < 10000) return (neg ? '-' : '') + this.nf.format(a);
    const eok = Math.floor(a / 1e8);
    const man = Math.floor((a % 1e8) / 1e4);
    const rest = a % 1e4;
    const parts: string[] = [];
    if (eok) parts.push(`${this.nf.format(eok)}억`);
    if (man) parts.push(`${this.nf.format(man)}만`);
    if (rest) parts.push(this.nf.format(rest));
    return (neg ? '-' : '') + parts.join(' ');
  }

  percent(fraction: number): string {
    return this.pf.format(fraction);
  }

  private utc(c: Civil): Date {
    const d = new Date(0);
    d.setUTCFullYear(c.y, c.m - 1, c.d);
    return d;
  }

  date(c: Civil, withWeekday = false): string {
    let s: string;
    const p2 = (n: number) => String(n).padStart(2, '0');
    switch (this.opts.dateFormat) {
      case 'DDMMMYYYY':
        s = `${p2(c.d)}${MONTHS_EN[c.m - 1]}${c.y}`;
        break;
      case 'ISO':
        s = `${c.y}-${p2(c.m)}-${p2(c.d)}`;
        break;
      case 'YMD':
        s = `${c.y}.${p2(c.m)}.${p2(c.d)}`;
        break;
      default:
        s = this.df.format(this.utc(c));
    }
    if (withWeekday) {
      const wd = this.wf.format(this.utc({ ...c, d: c.d }));
      s = this.opts.lang === 'ko' ? `${s} (${wd})` : `${wd}, ${s}`;
    }
    return s;
  }

  weekday(c: Civil): string {
    return this.wf.format(this.utc(c)) + (weekday(c) < 0 ? '' : '');
  }

  time(h: number, mi: number): string {
    const d = new Date(0);
    d.setUTCHours(h, mi);
    return this.tf.format(d);
  }

  unitName(u: Unit, n: number): string {
    const [one, many] = this.s.units[u];
    return n === 1 ? one : many;
  }

  /** Selected units, largest first, without leading zeros ("9 months 5 days", not "0 years 9 months 5 days"). */
  shownUnits(values: Partial<Record<Unit, number>>, units: Unit[]): Unit[] {
    const list = UNITS.filter((u) => units.includes(u));
    const used = list.length ? list : (['days'] as Unit[]);
    let i = 0;
    while (i < used.length - 1 && !values[used[i]]) i++;
    return used.slice(i);
  }

  /** "3 years 2 months 5 days" / "3년 2개월 5일". Compact: "3y 2mo 5d". */
  units(values: Partial<Record<Unit, number>>, units: Unit[], compact = false): string {
    const parts = this.shownUnits(values, units).map((u) => {
      const n = values[u] ?? 0;
      if (this.opts.lang === 'ko') return `${this.num(n)}${this.s.unitsShort[u]}`;
      return compact ? `${this.num(n)}${this.s.unitsShort[u]}` : `${this.num(n)} ${this.unitName(u, n)}`;
    });
    return parts.join(' ');
  }

  /** Splits "1,234 days" into number and unit parts for big display. */
  unitParts(values: Partial<Record<Unit, number>>, units: Unit[]): { n: string; u: string }[] {
    return this.shownUnits(values, units).map((u) => {
      const n = values[u] ?? 0;
      return { n: this.num(n), u: this.opts.lang === 'ko' ? this.s.unitsShort[u] : this.unitName(u, n) };
    });
  }

  /** D-12, D-Day (디데이), D+12. */
  dday(n: number): string {
    if (n === 0) return this.opts.ddayScript === 'hangul' ? '디데이' : 'D-Day';
    return n < 0 ? `D-${this.num(-n)}` : `D+${this.num(n)}`;
  }

  /** "Today", "Tomorrow", "in 12 days", "3 days ago". */
  relDays(n: number): string {
    if (n === 0) return this.s.common.today;
    if (n === 1) return this.s.common.tomorrow;
    if (n === -1) return this.s.common.yesterday;
    const amount = this.units({ days: Math.abs(n) }, ['days']);
    return fill(n > 0 ? this.s.count.inDays : this.s.count.daysAgo, { n: amount });
  }

  lunar(ld: LunarDate, cal: LunarCalendar, withCalendar = true): string {
    const body = fill(this.s.lunar.format, { leap: ld.leap ? this.s.lunar.leap : '', m: ld.month, d: ld.day });
    if (!withCalendar) return body;
    return `${cal === 'korean-lunar' ? this.s.lunar.koShort : this.s.lunar.cnShort} ${body}`;
  }

  ordinal(n: number): string {
    return this.opts.lang === 'en' ? ordinalEn(n) : String(n);
  }

  milestone(label: MilestoneLabel): string {
    const m = this.s.milestones;
    switch (label.kind) {
      case 'day':
        return fill(m.day, { n: this.num(label.n) });
      case 'tutu':
        return m.tutu;
      case 'year': {
        const tpl = label.preset === 'birthday' ? m.birthday : label.preset === 'memorial' ? m.memorial : m.anniversary;
        return fill(tpl, { n: label.n, ord: this.ordinal(label.n) });
      }
      case 'month':
        return fill(m.month, { n: label.n });
      case 'baby':
        return m.baby[label.key];
      case 'long-life':
        return fill(m.longLife, { name: m.longLifeNames[label.key] ?? label.key, c: label.countingAge, a: label.countingAge - 1 });
      case 'wedding': {
        const name = m.weddingNames[label.n];
        return fill(name ? m.wedding : m.weddingPlain, { n: label.n, ord: this.ordinal(label.n), name: name ?? '' });
      }
      case 'custom':
        return label.label.trim() || fill(m.day, { n: this.num(label.n) });
    }
  }
}
