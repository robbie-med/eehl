// Importers: calendar files (.ics), spreadsheets (.csv, including eehl's own
// export) and contact cards (.vcf birthdays and anniversaries). Each returns
// new events; nothing is merged here.

import { parseISODate, type Civil } from './civil';
import { newEvent, readout } from './presets';
import type { CalendarSystem, CountEvent, PresetId, Repeat } from './types';
import { isValidZone } from './zone';

export interface ImportResult {
  events: CountEvent[];
  /** List names found in a CSV "list" column, keyed by event id. */
  listNames: Record<string, string>;
  /** Events whose source had no year (contact birthdays like --05-21). */
  noYear: number;
}

interface Draft {
  title: string;
  date: Civil;
  time?: { h: number; mi: number } | null;
  zone: string;
  repeat?: Repeat;
  preset?: PresetId;
  notes?: string;
  tags?: string[];
  calendar?: CalendarSystem;
  lunar?: { year: number; month: number; day: number; leap: boolean } | null;
  emoji?: string;
}

const BIRTHDAY = /birthday|b-?day|생일|생신|誕生日|生日|誕辰/i;
const EMOJI_PREFIX = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u;

function build(d: Draft, now: number): CountEvent {
  let title = d.title.trim();
  let emoji = d.emoji;
  const m = EMOJI_PREFIX.exec(title);
  if (m && !emoji) {
    emoji = m[1];
    title = title.slice(m[0].length);
  }
  const preset = d.preset ?? (d.repeat === 'yearly' && BIRTHDAY.test(title) ? 'birthday' : 'custom');
  const ev = newEvent({
    preset,
    title,
    date: d.date,
    time: d.time ?? null,
    zone: d.zone,
    now,
    calendar: d.calendar,
    lunar: d.lunar ?? null,
  });
  return {
    ...ev,
    emoji: emoji ?? ev.emoji,
    repeat: d.repeat ?? ev.repeat,
    notes: d.notes ?? '',
    tags: d.tags ?? [],
  };
}

// ---------- ICS ----------

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function icsUnescape(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

interface IcsProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): IcsProp | null {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const [name, ...params] = line.slice(0, colon).split(';');
  const p: Record<string, string> = {};
  for (const x of params) {
    const eq = x.indexOf('=');
    if (eq > 0) p[x.slice(0, eq).toUpperCase()] = x.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params: p, value: line.slice(colon + 1) };
}

export function parseICS(text: string, defaultZone: string, now = Date.now()): ImportResult {
  const events: CountEvent[] = [];
  const seenEehl = new Set<string>();
  let cur: IcsProp[] | null = null;
  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT/i.test(line)) cur = [];
    else if (/^END:VEVENT/i.test(line)) {
      if (cur) {
        const ev = icsEvent(cur, defaultZone, now, seenEehl);
        if (ev) events.push(ev);
      }
      cur = null;
    } else if (cur) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }
  return { events, listNames: {}, noYear: 0 };
}

function icsEvent(props: IcsProp[], defaultZone: string, now: number, seenEehl: Set<string>): CountEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const uid = get('UID')?.value ?? '';
  // eehl's own export has one entry per occurrence and milestone; keep only
  // the first occurrence of each event.
  const own = /^([0-9a-f-]{36})-(.+)@eehl$/i.exec(uid);
  if (own) {
    if (!own[2].startsWith('occ-') || seenEehl.has(own[1])) return null;
    seenEehl.add(own[1]);
  }
  const start = get('DTSTART');
  if (!start) return null;
  const v = start.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const date = { y: +m[1], m: +m[2], d: +m[3] };
  let zone = defaultZone;
  let time: { h: number; mi: number } | null = null;
  if (m[4] && start.params.VALUE !== 'DATE') {
    time = { h: +m[4], mi: +m[5] };
    if (m[7]) zone = 'UTC';
    else if (start.params.TZID && isValidZone(start.params.TZID)) zone = start.params.TZID;
  }
  const rrule = get('RRULE')?.value ?? '';
  const freq = /FREQ=(\w+)/i.exec(rrule)?.[1]?.toUpperCase();
  const repeat: Repeat = freq === 'YEARLY' ? 'yearly' : freq === 'MONTHLY' ? 'monthly' : 'none';
  const cats = get('CATEGORIES')?.value;
  return build(
    {
      title: icsUnescape(get('SUMMARY')?.value ?? ''),
      date,
      time,
      zone,
      repeat,
      notes: icsUnescape(get('DESCRIPTION')?.value ?? ''),
      tags: cats ? icsUnescape(cats).split(',').map((x) => x.trim()).filter(Boolean) : [],
    },
    now,
  );
}

// ---------- CSV ----------

export function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === '\t' || c === ';') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const COLUMNS: Record<string, RegExp> = {
  title: /^(title|name|event|summary|제목|이름|이벤트|タイトル|名前|件名|标题|標題|名称|名稱)$/i,
  date: /^(date|day|start|start date|날짜|일자|日付|日期|開始日|开始日期)$/i,
  time: /^(time|시간|時刻|时间|時間)$/i,
  zone: /^(zone|time ?zone|tz|시간대|タイムゾーン|时区|時區)$/i,
  calendar: /^(calendar|달력|暦|历法|曆法)$/i,
  lunar: /^(lunar|음력|旧暦|农历|農曆)$/i,
  repeat: /^(repeat|recurrence|반복|繰り返し|重复|重複)$/i,
  preset: /^(preset|kind|type|종류|種類|类型|類型)$/i,
  list: /^(list|group|category|목록|リスト|列表|清單)$/i,
  tags: /^(tags?|태그|タグ|标签|標籤)$/i,
  notes: /^(notes?|memo|description|메모|メモ|备注|備註)$/i,
};

/** Accepts 2026-09-28, 2026.09.28, 2026/9/28, 28SEP2026, 9/28/2026 (US order). */
export function parseLooseDate(s: string): Civil | null {
  const t = s.trim();
  const iso = parseISODate(t);
  if (iso) return iso;
  let m = /^(\d{4})[./年-]\s*(\d{1,2})[./月-]\s*(\d{1,2})日?$/.exec(t);
  if (m) return parseISODate(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  m = /^(\d{1,2})([A-Za-z]{3})(\d{4})$/.exec(t);
  if (m) {
    const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].indexOf(m[2].toUpperCase()) + 1;
    if (mon) return parseISODate(`${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return parseISODate(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`);
  return null;
}

export function parseCSV(text: string, defaultZone: string, now = Date.now()): ImportResult {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return { events: [], listNames: {}, noYear: 0 };
  const header = rows[0].map((h) => h.trim());
  const col = (k: string) => header.findIndex((h) => COLUMNS[k].test(h));
  const idx = Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, col(k)])) as Record<string, number>;
  // Without a header we can recognise, assume "title, date".
  if (idx.title < 0 && idx.date < 0) {
    idx.title = 0;
    idx.date = 1;
    rows.unshift([]);
  }
  const events: CountEvent[] = [];
  const listNames: Record<string, string> = {};
  for (const row of rows.slice(1)) {
    const cell = (k: string) => (idx[k] >= 0 ? (row[idx[k]] ?? '').trim() : '');
    const date = parseLooseDate(cell('date'));
    if (!date) continue;
    const tm = /^(\d{1,2}):(\d{2})$/.exec(cell('time'));
    const zone = isValidZone(cell('zone')) && cell('zone') ? cell('zone') : defaultZone;
    const calendar = (['korean-lunar', 'chinese-lunar'].includes(cell('calendar')) ? cell('calendar') : 'gregorian') as CalendarSystem;
    const lm = /^(\d{4})-(L?)(\d{1,2})-(\d{1,2})$/.exec(cell('lunar'));
    const repeat = (['none', 'yearly', 'monthly'].includes(cell('repeat')) ? cell('repeat') : 'none') as Repeat;
    const preset = (['custom', 'couple', 'baby', 'birthday', 'wedding', 'memorial', 'exam', 'service'].includes(cell('preset')) ? cell('preset') : undefined) as
      | PresetId
      | undefined;
    const ev = build(
      {
        title: cell('title'),
        date,
        time: tm ? { h: +tm[1], mi: +tm[2] } : null,
        zone,
        repeat: preset ? undefined : repeat,
        preset,
        notes: cell('notes'),
        tags: cell('tags').split(',').map((x) => x.trim()).filter(Boolean),
        calendar: lm ? calendar : 'gregorian',
        lunar: lm && calendar !== 'gregorian' ? { year: +lm[1], leap: !!lm[2], month: +lm[3], day: +lm[4] } : null,
      },
      now,
    );
    if (preset) ev.repeat = repeat === 'none' ? ev.repeat : repeat;
    if (cell('list')) listNames[ev.id] = cell('list');
    events.push(ev);
  }
  return { events, listNames, noYear: 0 };
}

// ---------- vCard ----------

export function parseVCF(text: string, defaultZone: string, now = Date.now()): ImportResult {
  const events: CountEvent[] = [];
  let noYear = 0;
  const thisYear = new Date(now).getUTCFullYear();
  for (const card of text.split(/BEGIN:VCARD/i).slice(1)) {
    const lines = unfold(card);
    const prop = (name: string) => {
      for (const l of lines) {
        const p = parseLine(l);
        if (p && (p.name === name || p.name.endsWith('.' + name))) return p;
      }
      return null;
    };
    const name = icsUnescape(prop('FN')?.value ?? prop('N')?.value.split(';').filter(Boolean).reverse().join(' ') ?? '').trim();
    for (const [field, preset] of [
      ['BDAY', 'birthday'],
      ['ANNIVERSARY', 'wedding'],
      ['X-ANNIVERSARY', 'wedding'],
    ] as const) {
      const v = prop(field)?.value.trim();
      if (!v) continue;
      let date: Civil | null = null;
      let missingYear = false;
      let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(v);
      if (m) date = parseISODate(`${m[1]}-${m[2]}-${m[3]}`);
      m = /^--(\d{2})-?(\d{2})/.exec(v);
      if (!date && m) {
        missingYear = true;
        date = parseISODate(`${thisYear}-${m[1]}-${m[2]}`) ?? parseISODate(`2024-${m[1]}-${m[2]}`);
      }
      if (!date) continue;
      const ev = build({ title: name, date, zone: defaultZone, preset }, now);
      if (missingYear) {
        noYear++;
        // Without a year there is no age; count down to the date only.
        ev.readouts = [readout('dday')];
        ev.milestones = ev.milestones.filter((r) => r.type === 'yearly');
      }
      events.push(ev);
    }
  }
  return { events, listNames: {}, noYear };
}
