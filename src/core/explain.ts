// "How was this computed": every number on screen can explain itself.

import { hasTimeUnits } from './diff';
import { anchorWall, isLunar, occurrence, type CountState, type Occurrence, type ReadoutValue } from './count';
import type { CountEvent, Unit } from './types';
import { UNITS } from './types';
import { formatOffset, offsetAt, wallAt } from './zone';
import type { Formatter } from '../i18n/format';

function occLines(ev: CountEvent, o: Occurrence, f: Formatter, lines: string[]) {
  const e = f.s.explain;
  if (isLunar(ev) && o.lunar && o.k > 0) {
    lines.push(f.t(e.lunarResolved, { lunar: f.lunar(o.lunar, ev.calendar), date: f.date(o.civil, true) }));
  }
  for (const a of o.lunarAdjustments) {
    if (a === 'leap-to-regular') lines.push(e.leapToRegular);
    if (a === 'leap-kept') lines.push(e.leapKept);
    if (a === 'day-30-to-29') lines.push(e.day30);
  }
  if (o.clamped) lines.push(e.clamped);
  if (!ev.allDay && o.dst !== 'none') {
    const w = anchorWall(ev);
    const params = { time: f.time(w.h, w.mi), date: f.date(o.civil), zone: ev.zone };
    lines.push(f.t(o.dst === 'gap' ? e.dstGap : e.dstOverlap, params));
  }
}

export function explain(ev: CountEvent, st: CountState, rv: ReadoutValue, f: Formatter): string[] {
  const e = f.s.explain;
  const lines: string[] = [];
  const w = anchorWall(ev);
  if (ev.allDay) {
    lines.push(f.t(e.anchorAllDay, { date: f.date(w, true), zone: ev.zone }));
  } else {
    lines.push(
      f.t(e.anchor, {
        date: `${f.date(w, true)} ${f.time(w.h, w.mi)}`,
        zone: ev.zone,
        offset: formatOffset(offsetAt(ev.epochMs, ev.zone)),
      }),
    );
  }
  if (isLunar(ev) && ev.lunar) {
    lines.push(f.t(e.lunar, { lunar: f.lunar(ev.lunar, ev.calendar, false), calendar: ev.calendar === 'korean-lunar' ? f.s.editor.koreanLunar : f.s.editor.chineseLunar }));
  }
  const tw = wallAt(st.now, st.zone);
  lines.push(f.t(e.today, { date: `${f.date(st.today, true)} ${f.time(tw.h, tw.mi)}`, zone: st.zone }));
  if (st.zone !== ev.zone) lines.push(f.t(e.zoneNote, { zone: st.zone, eventZone: ev.zone }));

  const target = rv.fromOrigin ? st.origin : st.target;
  if (ev.repeat !== 'none' && !rv.fromOrigin && target.k > 0) {
    lines.push(f.t(e.repeat, { period: ev.repeat === 'yearly' ? e.year : e.month, k: target.k }));
  }
  if (st.mode === 'ended' && !rv.fromOrigin) {
    lines.push(e.ended);
    return lines;
  }
  lines.push(f.t(rv.direction === 'until' ? e.target : e.origin, { date: f.date(target.civil, true) }));
  occLines(ev, target, f, lines);

  const r = rv.readout;
  switch (r.style) {
    case 'dday': {
      const n = Math.abs(rv.dday ?? 0);
      lines.push(f.t(rv.direction === 'until' ? e.ddayDown : e.ddayUp, { n: f.num(n) }));
      if (ev.dayOne && rv.direction === 'since') lines.push(e.dayOne);
      break;
    }
    case 'units': {
      const units = UNITS.filter((u) => r.units.includes(u));
      if (units.some((u) => u === 'years' || u === 'months')) lines.push(e.calendarUnits);
      if (units.some((u) => u === 'weeks' || u === 'days')) lines.push(e.dayUnits);
      if (hasTimeUnits(units)) lines.push(e.timeUnits);
      if (ev.dayOne && rv.direction === 'since') lines.push(e.dayOne);
      if (ev.inclusiveEnd && rv.direction === 'until') lines.push(e.inclusiveEnd);
      const smallest: Unit = units[units.length - 1] ?? 'days';
      lines.push(f.t(e.rounding, { mode: f.s.editor.roundings[r.rounding], unit: f.unitName(smallest, 2) }));
      break;
    }
    case 'age':
      lines.push(e.age);
      break;
    case 'percent':
      if (rv.percent) lines.push(f.t(e.percent, { elapsed: f.num(rv.percent.elapsedDays), total: f.num(rv.percent.totalDays) }));
      if (ev.dayOne) lines.push(e.dayOne);
      break;
    case 'gestation':
      lines.push(e.gestation);
      break;
  }
  return lines;
}

/** For tests and the detail screen: the original occurrence, explained. */
export function explainOrigin(ev: CountEvent, f: Formatter): string[] {
  const o = occurrence(ev, 0);
  const lines: string[] = [];
  if (o) occLines(ev, o, f, lines);
  return lines;
}
