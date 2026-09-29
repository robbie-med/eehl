// App state: one signal holding all data, persisted to localStorage, plus a
// ticking clock. Every data change re-derives the notification schedule and
// the widget payload and hands them to the platform.

import { computed, effect, signal } from '@preact/signals';
import {
  dataFromFile,
  decryptWithKey,
  deriveBackupKey,
  emptyData,
  encryptWithKey,
  isEncrypted,
  keyForFile,
  mergeData,
  normalizeData,
  type BackupKey,
} from '../core/backup';
import { countState } from '../core/count';
import { uid } from '../core/presets';
import { buildSchedule, buildWidgetPayload, type ScheduledNotification } from '../core/schedule';
import type { AppData, CountEvent, EventList, Settings } from '../core/types';
import { detectLang, Formatter, type Lang } from '../i18n/format';
import { platform } from '../platform';

const KEY = 'eehl:data:v1';

// App lock: when on, the stored data is an encrypted backup file (same format
// as "Export encrypted backup"), decrypted into memory at unlock. The key
// and passphrase live only in memory for the session.
let lockKey: BackupKey | null = null;
let lockPass: string | null = null;
export const locked = signal(false);

function readStored(): unknown {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('eehl: could not read data', e);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}:corrupt:${Date.now()}`, raw);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function load(): AppData {
  const raw = readStored();
  if (isEncrypted(raw)) {
    locked.value = true;
    return emptyData();
  }
  try {
    if (raw) return normalizeData(raw);
  } catch (e) {
    console.error('eehl: could not load data', e);
  }
  return emptyData();
}

export const data = signal<AppData>(load());
export const now = signal(Date.now());
export const saveError = signal(false);

function write(d: AppData) {
  // Never overwrite the encrypted store with the empty placeholder shown while locked.
  if (locked.value) return;
  const key = lockKey;
  const store = (text: string) => {
    try {
      localStorage.setItem(KEY, text);
      saveError.value = false;
    } catch {
      saveError.value = true;
    }
  };
  if (key) void encryptWithKey(d, key).then((file) => store(JSON.stringify(file)));
  else store(JSON.stringify(d));
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist(d: AppData) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    write(d);
  }, 150);
}

export function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    write(data.value);
  }
}

/** Unlock with the passphrase. Throws on a wrong passphrase. */
export async function unlock(passphrase: string): Promise<void> {
  const raw = readStored();
  if (!isEncrypted(raw)) {
    locked.value = false;
    return;
  }
  const key = await keyForFile(passphrase, raw);
  const plain = await decryptWithKey(raw, key);
  lockKey = key;
  lockPass = passphrase;
  locked.value = false;
  data.value = dataFromFile(plain);
}

export async function enableLock(passphrase: string, autoLockMinutes: number) {
  lockKey = await deriveBackupKey(passphrase);
  lockPass = passphrase;
  updateSettings({ lock: { enabled: true, autoLockMinutes } });
  flush();
}

export function disableLock() {
  lockKey = null;
  lockPass = null;
  updateSettings({ lock: { ...settings.value.lock, enabled: false } });
  flush();
}

export function lockNow() {
  if (!lockKey) return;
  flush();
  lockKey = null;
  lockPass = null;
  locked.value = true;
  data.value = emptyData();
}

/** The session passphrase, so sync can open encrypted files written by other devices. */
export function sessionPassphrase(): string | null {
  return lockPass;
}

export function sessionKey(): BackupKey | null {
  return lockKey;
}

/** Forgotten passphrase: erase everything on this device. */
export function resetAll() {
  clearTimeout(saveTimer);
  localStorage.removeItem(KEY);
  lockKey = null;
  lockPass = null;
  locked.value = false;
  data.value = emptyData();
}

export const settings = computed(() => data.value.settings);

export const lang = computed<Lang>(() => {
  const l = settings.value.locale;
  if (l !== 'system') return l;
  const tags = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : ['en'];
  return detectLang(tags);
});

export const fmt = computed(
  () =>
    new Formatter({
      lang: lang.value,
      dateFormat: settings.value.dateFormat,
      manGrouping: settings.value.manGrouping,
      ddayScript: settings.value.ddayScript,
    }),
);

export const t = computed(() => fmt.value.s);

function update(fn: (d: AppData) => AppData) {
  data.value = fn(data.value);
  persist(data.value);
}

export function upsertEvent(ev: CountEvent) {
  const stamped = { ...ev, editedAt: Date.now() };
  update((d) => {
    const i = d.events.findIndex((e) => e.id === ev.id);
    const events = [...d.events];
    if (i >= 0) events[i] = stamped;
    else events.push(stamped);
    return { ...d, events };
  });
}

export function patchEvent(id: string, patch: Partial<CountEvent>) {
  const ev = data.value.events.find((e) => e.id === id);
  if (ev) upsertEvent({ ...ev, ...patch });
}

/** Deletes and returns the event, so the caller can offer undo. */
export function deleteEvent(id: string): CountEvent | null {
  const ev = data.value.events.find((e) => e.id === id) ?? null;
  update((d) => ({ ...d, events: d.events.filter((e) => e.id !== id), deleted: { ...d.deleted, [id]: Date.now() } }));
  return ev;
}

export function restoreEvent(ev: CountEvent) {
  update((d) => {
    const deleted = { ...d.deleted };
    delete deleted[ev.id];
    return { ...d, deleted, events: d.events.some((e) => e.id === ev.id) ? d.events : [...d.events, { ...ev, editedAt: Date.now() }] };
  });
}

/** Apply one change to many events at once (bulk edit). */
export function patchEvents(ids: string[], patch: (e: CountEvent) => Partial<CountEvent>) {
  const set = new Set(ids);
  const t = Date.now();
  update((d) => ({ ...d, events: d.events.map((e) => (set.has(e.id) ? { ...e, ...patch(e), editedAt: t } : e)) }));
}

export function deleteEvents(ids: string[]): CountEvent[] {
  const set = new Set(ids);
  const gone = data.value.events.filter((e) => set.has(e.id));
  const t = Date.now();
  update((d) => {
    const deleted = { ...d.deleted };
    for (const id of ids) deleted[id] = t;
    return { ...d, events: d.events.filter((e) => !set.has(e.id)), deleted };
  });
  return gone;
}

export function restoreEvents(list: CountEvent[]) {
  for (const ev of list) restoreEvent(ev);
}

export function duplicateEvent(id: string): string | null {
  const ev = data.value.events.find((e) => e.id === id);
  if (!ev) return null;
  const copy = { ...ev, id: uid(), title: ev.title, pinned: false, createdAt: Date.now() };
  upsertEvent(copy);
  return copy.id;
}

export function reorderEvent(id: string, delta: number) {
  update((d) => {
    const events = [...d.events];
    const i = events.findIndex((e) => e.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= events.length) return d;
    [events[i], events[j]] = [events[j], events[i]];
    return { ...d, events };
  });
}

export function updateSettings(patch: Partial<Settings>) {
  update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
}

export function upsertList(list: EventList) {
  update((d) => {
    const i = d.lists.findIndex((l) => l.id === list.id);
    const lists = [...d.lists];
    if (i >= 0) lists[i] = list;
    else lists.push(list);
    return { ...d, lists };
  });
}

export function deleteList(id: string) {
  update((d) => ({
    ...d,
    lists: d.lists.filter((l) => l.id !== id).map((l) => (l.parentId === id ? { ...l, parentId: null } : l)),
    events: d.events.map((e) => (e.listId === id ? { ...e, listId: null, editedAt: Date.now() } : e)),
    deleted: { ...d.deleted, [id]: Date.now() },
  }));
}

/** Add events (from a file import or a shared QR link) without touching anything else. */
export function addEvents(events: CountEvent[]) {
  const t = Date.now();
  update((d) => {
    const ids = new Set(d.events.map((e) => e.id));
    const fresh = events.map((e) => (ids.has(e.id) ? { ...e, id: uid() } : e)).map((e) => ({ ...e, createdAt: t, editedAt: t }));
    const deleted = { ...d.deleted };
    for (const e of fresh) delete deleted[e.id];
    return { ...d, events: [...d.events, ...fresh], deleted };
  });
}

/** Replace the whole data set (sync, unlock). */
export function replaceData(next: AppData) {
  data.value = next;
  persist(next);
}

export function importData(incoming: AppData, mode: 'merge' | 'replace') {
  update((d) => (mode === 'replace' ? { ...incoming, settings: { ...incoming.settings } } : mergeData(d, incoming).data));
}

// ---------- clock ----------

const usesSeconds = computed(() =>
  settings.value.liveSeconds &&
  data.value.events.some((e) => !e.archived && e.readouts.some((r) => r.style === 'units' && r.units.includes('seconds'))),
);

let tick: ReturnType<typeof setTimeout> | undefined;
function schedule() {
  clearTimeout(tick);
  const t = Date.now();
  now.value = t;
  const step = usesSeconds.value ? 1000 : 30_000;
  tick = setTimeout(schedule, step - (t % step) + 5);
}

// ---------- side effects ----------

export const scheduled = signal<ScheduledNotification[]>([]);
const firedKey = 'eehl:fired:v1';

function fired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(firedKey) ?? '[]'));
  } catch {
    return new Set();
  }
}

/** Web: show due notifications while the app is open. */
function fireDue() {
  if (platform.kind !== 'web') return;
  const t = Date.now();
  const done = fired();
  let changed = false;
  for (const n of scheduled.value) {
    if (n.at > t) break;
    if (t - n.at > 6 * 3600_000 || done.has(n.id)) continue;
    done.add(n.id);
    changed = true;
    void platform.showNotification(n.title, n.body, n.id);
  }
  if (changed) {
    try {
      localStorage.setItem(firedKey, JSON.stringify([...done].slice(-500)));
    } catch {
      /* ignore */
    }
  }
}

let derivedTimer: ReturnType<typeof setTimeout> | undefined;
/** Changes once an hour, so derived schedules refresh without churning every tick. */
const hourKey = computed(() => Math.floor(now.value / 3_600_000));

export function start() {
  schedule();
  effect(() => {
    void usesSeconds.value;
    schedule();
  });

  // Auto-archive countdowns that ended with "archive".
  effect(() => {
    const t = now.value;
    const toArchive = data.value.events.filter((e) => !e.archived && e.direction === 'down' && e.endBehavior === 'archive' && countState(e, t)?.shouldArchive);
    if (toArchive.length) {
      const ids = new Set(toArchive.map((e) => e.id));
      update((d) => ({ ...d, events: d.events.map((e) => (ids.has(e.id) ? { ...e, archived: true } : e)) }));
    }
  });

  // Rebuild the schedule and widgets after data changes, and once a day.
  effect(() => {
    const d = data.value;
    const f = fmt.value;
    void hourKey.value;
    clearTimeout(derivedTimer);
    derivedTimer = setTimeout(() => {
      const t = Date.now();
      try {
        scheduled.value = buildSchedule(d, t, f);
        platform.setSchedule(scheduled.value);
        platform.setWidgets(buildWidgetPayload(d, t, f));
      } catch (e) {
        console.error('eehl: schedule failed', e);
      }
    }, 400);
  });

  effect(() => {
    void now.value;
    fireDue();
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') schedule();
      else flush();
    });
    window.addEventListener('pagehide', flush);
    window.addEventListener('storage', (e) => {
      // Another tab saved: follow it.
      if (e.key !== KEY || !e.newValue || locked.value) return;
      try {
        const raw = JSON.parse(e.newValue);
        if (!isEncrypted(raw)) data.value = normalizeData(raw);
        else if (lockPass) void keyForFile(lockPass, raw).then((k) => decryptWithKey(raw, k)).then((p) => (data.value = dataFromFile(p)));
      } catch {
        /* ignore */
      }
    });
    // Auto-lock after the app has been in the background for a while.
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      const lock = settings.value.lock;
      if (!lock.enabled || !lockKey) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        if (lock.autoLockMinutes === 0) lockNow();
      } else if (hiddenAt && Date.now() - hiddenAt >= lock.autoLockMinutes * 60_000) lockNow();
    });
  }
  platform.onRefresh(() => schedule());
}
