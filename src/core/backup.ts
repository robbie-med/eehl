// Backup, restore and export. The JSON backup is the full-fidelity format;
// an encrypted backup wraps it in AES-256-GCM with a PBKDF2-derived key.

import { dayNumber, fromDayNumber, toISODate } from './civil';
import { anchorWall } from './count';
import { presetFields, uid } from './presets';
import { eventOccurrencesBetween } from './schedule';
import { milestonesFor } from './milestones';
import type { AppData, CountEvent, EventList, Settings } from './types';
import { isValidZone, wallAt } from './zone';
import type { Formatter } from '../i18n/format';

export const DEFAULT_SETTINGS: Settings = {
  locale: 'system',
  theme: 'system',
  dateFormat: 'locale',
  showCountingAge: true,
  leapRule: 'regular',
  manGrouping: false,
  ddayScript: 'latin',
  cardMode: 'full',
  sort: 'manual',
  showDates: true,
  showArrows: true,
  confirmDelete: true,
  liveSeconds: true,
  weekStart: 0,
  digest: { enabled: false, time: '08:00' },
  defaultZone: null,
  defaultReminder: { enabled: true, daysBefore: 0, time: '09:00' },
  holidays: null,
  showHolidays: true,
  showSolarTerms: false,
  life: { birthEventId: null, birthDate: null, years: 90 },
  lock: { enabled: false, autoLockMinutes: 5 },
};

export function emptyData(): AppData {
  return { version: 1, events: [], lists: [], settings: { ...DEFAULT_SETTINGS }, deleted: {} };
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Fill in anything missing so older or hand-edited backups still load. */
export function normalizeEvent(raw: Record<string, unknown>, now: number): CountEvent | null {
  if (typeof raw.epochMs !== 'number' || !Number.isFinite(raw.epochMs)) return null;
  const preset = (typeof raw.preset === 'string' ? raw.preset : 'custom') as CountEvent['preset'];
  const defaults = presetFields(['custom', 'couple', 'baby', 'birthday', 'wedding', 'memorial', 'exam', 'service'].includes(preset) ? preset : 'custom');
  const zone = typeof raw.zone === 'string' && isValidZone(raw.zone) ? raw.zone : 'UTC';
  const merged = { ...defaults, ...raw } as CountEvent;
  // Sub-items need ids for editing; shared links and hand-made files may omit them.
  const withIds = <T extends { id?: string }>(list: unknown, fallback: T[]): T[] =>
    (Array.isArray(list) ? (list as T[]) : fallback).filter(isObj).map((x) => (typeof x.id === 'string' && x.id ? x : { ...x, id: uid() }));
  const ev = {
    ...merged,
    readouts: withIds(merged.readouts, defaults.readouts),
    milestones: withIds(merged.milestones, defaults.milestones),
    reminders: withIds(merged.reminders, defaults.reminders),
  } as CountEvent;
  return {
    ...ev,
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    title: String(raw.title ?? ''),
    emoji: typeof raw.emoji === 'string' ? raw.emoji : '📅',
    color: typeof raw.color === 'string' ? raw.color : 'blue',
    preset: ev.preset ?? 'custom',
    zone,
    allDay: raw.allDay !== false,
    spanStartMs: typeof raw.spanStartMs === 'number' ? raw.spanStartMs : null,
    calendar: raw.calendar === 'korean-lunar' || raw.calendar === 'chinese-lunar' ? raw.calendar : 'gregorian',
    lunar: isObj(raw.lunar) ? (raw.lunar as unknown as CountEvent['lunar']) : null,
    leapRule: raw.leapRule === 'leap-when-exists' ? 'leap-when-exists' : 'regular',
    displayZone: raw.displayZone === 'device' ? 'device' : 'event',
    counter: isObj(raw.counter)
      ? {
          label: String(raw.counter.label ?? ''),
          value: Number(raw.counter.value) || 0,
          step: Number(raw.counter.step) || 1,
          unit: String(raw.counter.unit ?? ''),
        }
      : null,
    notes: String(raw.notes ?? ''),
    listId: typeof raw.listId === 'string' ? raw.listId : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    pinned: !!raw.pinned,
    archived: !!raw.archived,
    private: !!raw.private,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    editedAt: typeof raw.editedAt === 'number' ? raw.editedAt : now,
  };
}

export function normalizeData(raw: unknown, now = Date.now()): AppData {
  if (!isObj(raw)) throw new Error('not an eehl backup');
  const events = Array.isArray(raw.events)
    ? raw.events.filter(isObj).map((e) => normalizeEvent(e, now)).filter((e): e is CountEvent => !!e)
    : [];
  const lists: EventList[] = Array.isArray(raw.lists)
    ? raw.lists.filter(isObj).map((l) => ({
        id: typeof l.id === 'string' ? l.id : uid(),
        name: String(l.name ?? ''),
        color: typeof l.color === 'string' ? l.color : 'slate',
        collapsed: !!l.collapsed,
        parentId: typeof l.parentId === 'string' ? l.parentId : null,
        defaultReadout: isObj(l.defaultReadout) ? (l.defaultReadout as EventList['defaultReadout']) : null,
        defaultZone: typeof l.defaultZone === 'string' && isValidZone(l.defaultZone) ? l.defaultZone : null,
        sort: (['manual', 'soonest', 'date', 'title'] as const).includes(l.sort as never) ? (l.sort as EventList['sort']) : 'inherit',
      }))
    : [];
  // Only one level of nesting: a child's parent must exist and be top-level.
  const top = new Set(lists.filter((l) => !l.parentId).map((l) => l.id));
  for (const l of lists) if (l.parentId && !top.has(l.parentId)) l.parentId = null;
  const deleted: Record<string, number> = {};
  if (isObj(raw.deleted)) for (const [k, v] of Object.entries(raw.deleted)) if (typeof v === 'number') deleted[k] = v;
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...(s as Partial<Settings>),
    digest: { ...DEFAULT_SETTINGS.digest, ...(isObj(s.digest) ? (s.digest as Partial<Settings['digest']>) : {}) },
    defaultReminder: {
      ...DEFAULT_SETTINGS.defaultReminder,
      ...(isObj(s.defaultReminder) ? (s.defaultReminder as Partial<Settings['defaultReminder']>) : {}),
    },
    life: { ...DEFAULT_SETTINGS.life, ...(isObj(s.life) ? (s.life as Partial<Settings['life']>) : {}) },
    lock: { ...DEFAULT_SETTINGS.lock, ...(isObj(s.lock) ? (s.lock as Partial<Settings['lock']>) : {}) },
  };
  return { version: 1, events, lists, settings, deleted };
}

export interface MergeConflict {
  id: string;
  title: string;
  /** The copy that won (edited later). */
  kept: 'mine' | 'theirs';
  /** The copy that lost, so it can be restored from the conflict log. */
  other: CountEvent;
  at: number;
}

/**
 * Merge two copies of the data: per event, the most recently edited copy
 * wins (last-writer-wins by editedAt). A deletion wins over any edit made
 * before it. When `since` is given (the last successful sync), an event
 * edited on both sides after it is reported as a conflict.
 */
export function mergeData(current: AppData, incoming: AppData, since?: number, now = Date.now()): { data: AppData; conflicts: MergeConflict[] } {
  const deleted: Record<string, number> = { ...current.deleted };
  for (const [id, at] of Object.entries(incoming.deleted ?? {})) deleted[id] = Math.max(deleted[id] ?? 0, at);
  const conflicts: MergeConflict[] = [];
  const events = new Map(current.events.map((e) => [e.id, e]));
  for (const e of incoming.events) {
    const mine = events.get(e.id);
    if (!mine) {
      events.set(e.id, e);
      continue;
    }
    if (e.editedAt === mine.editedAt) continue;
    const theirsWins = e.editedAt > mine.editedAt;
    if (since !== undefined && mine.editedAt > since && e.editedAt > since && JSON.stringify(mine) !== JSON.stringify(e)) {
      conflicts.push({ id: e.id, title: (theirsWins ? e : mine).title, kept: theirsWins ? 'theirs' : 'mine', other: theirsWins ? mine : e, at: now });
    }
    if (theirsWins) events.set(e.id, e);
  }
  for (const [id, at] of Object.entries(deleted)) {
    const e = events.get(id);
    if (e && e.editedAt <= at) events.delete(id);
  }
  const lists = new Map(current.lists.map((l) => [l.id, l]));
  for (const l of incoming.lists) if (!lists.has(l.id)) lists.set(l.id, l);
  for (const id of Object.keys(deleted)) lists.delete(id);
  // Keep tombstones for a year; long enough for any device to sync.
  const cutoff = now - 366 * 86_400_000;
  for (const [id, at] of Object.entries(deleted)) if (at < cutoff) delete deleted[id];
  return { data: { ...current, events: [...events.values()], lists: [...lists.values()], deleted }, conflicts };
}

export interface BackupFile {
  app: 'eehl';
  format: 1;
  exportedAt: string;
  data: AppData;
}

export interface EncryptedBackupFile {
  app: 'eehl';
  format: 1;
  encrypted: { alg: 'AES-256-GCM'; kdf: 'PBKDF2-SHA256'; iterations: number; salt: string; iv: string; data: string };
}

export function toBackup(data: AppData, now = Date.now()): BackupFile {
  return { app: 'eehl', format: 1, exportedAt: new Date(now).toISOString(), data };
}

const b64 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const ITERATIONS = 310_000;

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackup(data: AppData, passphrase: string): Promise<EncryptedBackupFile> {
  return encryptWithKey(data, await deriveBackupKey(passphrase));
}

/** A key derived once (e.g. at unlock) and reused for every save; each save gets a fresh IV. */
export interface BackupKey {
  key: CryptoKey;
  salt: Uint8Array;
  iterations: number;
}

export async function deriveBackupKey(passphrase: string, salt?: Uint8Array, iterations = ITERATIONS): Promise<BackupKey> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(passphrase, s, iterations), salt: s, iterations };
}

export async function keyForFile(passphrase: string, file: EncryptedBackupFile): Promise<BackupKey> {
  return deriveBackupKey(passphrase, unb64(file.encrypted.salt), file.encrypted.iterations);
}

export async function encryptWithKey(data: AppData, k: BackupKey): Promise<EncryptedBackupFile> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(toBackup(data)));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k.key, plain));
  return {
    app: 'eehl',
    format: 1,
    encrypted: { alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: k.iterations, salt: b64(k.salt), iv: b64(iv), data: b64(ct) },
  };
}

export async function decryptWithKey(file: EncryptedBackupFile, k: BackupKey): Promise<unknown> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.encrypted.iv) as BufferSource }, k.key, unb64(file.encrypted.data) as BufferSource);
  return JSON.parse(new TextDecoder().decode(plain));
}

export function isEncrypted(x: unknown): x is EncryptedBackupFile {
  return isObj(x) && isObj(x.encrypted);
}

export async function decryptBackup(file: EncryptedBackupFile, passphrase: string): Promise<unknown> {
  const e = file.encrypted;
  const key = await deriveKey(passphrase, unb64(e.salt), e.iterations);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) as BufferSource }, key, unb64(e.data) as BufferSource);
  return JSON.parse(new TextDecoder().decode(plain));
}

/** Accepts a backup file, an encrypted backup (after decrypting) or bare AppData. */
export function dataFromFile(parsed: unknown): AppData {
  if (isObj(parsed) && parsed.app === 'eehl' && isObj(parsed.data)) return normalizeData(parsed.data);
  return normalizeData(parsed);
}

// ---------- ICS ----------

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line: string): string {
  // RFC 5545: lines longer than 75 octets are folded.
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    if (len + l > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += l;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const icsDate = (day: number) => toISODate(fromDayNumber(day)).replace(/-/g, '');

/**
 * Calendar export: each event's dates for the next `years` years plus every
 * milestone, as all-day entries, so reminders can live in any calendar.
 */
export function toICS(data: AppData, now: number, f: Formatter, years = 5): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//eehl//eehl//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:eehl'];
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  for (const ev of data.events) {
    if (ev.archived) continue;
    const today = dayNumber(wallAt(now, ev.zone));
    const end = today + years * 366;
    const title = ev.private ? f.s.notif.privateTitle : ev.title;
    const add = (key: string, day: number, summary: string) => {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}-${key}@eehl`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(day)}`,
        `DTEND;VALUE=DATE:${icsDate(day + 1)}`,
        fold(`SUMMARY:${icsEscape(summary)}`),
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      );
    };
    for (const o of eventOccurrencesBetween(ev, today, end)) add(`occ-${o.k}`, o.day, `${ev.emoji} ${title}`);
    for (const m of milestonesFor(ev, today, end)) add(m.key.replace(/[^\w-]/g, '-'), m.day, `${ev.emoji} ${title} · ${f.milestone(m.label)}`);
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ---------- CSV ----------

function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(data: AppData): string {
  const rows = [['title', 'date', 'time', 'zone', 'calendar', 'lunar', 'repeat', 'preset', 'list', 'tags', 'notes']];
  const lists = new Map(data.lists.map((l) => [l.id, l.name]));
  for (const ev of data.events) {
    const w = anchorWall(ev);
    rows.push([
      ev.title,
      toISODate(w),
      ev.allDay ? '' : `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`,
      ev.zone,
      ev.calendar,
      ev.lunar ? `${ev.lunar.year}-${ev.lunar.leap ? 'L' : ''}${ev.lunar.month}-${ev.lunar.day}` : '',
      ev.repeat,
      ev.preset,
      ev.listId ? (lists.get(ev.listId) ?? '') : '',
      ev.tags.join(', '),
      ev.notes,
    ]);
  }
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
