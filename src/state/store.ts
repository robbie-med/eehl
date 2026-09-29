// App state: one signal holding all data, persisted to localStorage, plus a
// ticking clock. Every data change re-derives the notification schedule and
// the widget payload and hands them to the platform.

import { computed, effect, signal } from '@preact/signals';
import { emptyData, mergeData, normalizeData } from '../core/backup';
import { countState } from '../core/count';
import { uid } from '../core/presets';
import { buildSchedule, buildWidgetPayload, type ScheduledNotification } from '../core/schedule';
import type { AppData, CountEvent, EventList, Settings } from '../core/types';
import { Formatter, type Lang } from '../i18n/format';
import { platform } from '../platform';

const KEY = 'eehl:data:v1';

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeData(JSON.parse(raw));
  } catch (e) {
    console.error('eehl: could not load data', e);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}:corrupt:${Date.now()}`, raw);
    } catch {
      /* ignore */
    }
  }
  return emptyData();
}

export const data = signal<AppData>(load());
export const now = signal(Date.now());
export const saveError = signal(false);

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist(d: AppData) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
      saveError.value = false;
    } catch {
      saveError.value = true;
    }
  }, 150);
}

export function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify(data.value));
    } catch {
      saveError.value = true;
    }
  }
}

export const settings = computed(() => data.value.settings);

export const lang = computed<Lang>(() => {
  const l = settings.value.locale;
  if (l === 'en' || l === 'ko') return l;
  const nav = typeof navigator !== 'undefined' ? navigator.languages?.[0] ?? navigator.language : 'en';
  return /^ko\b/i.test(nav ?? '') ? 'ko' : 'en';
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

export function deleteEvent(id: string) {
  update((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) }));
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
    lists: d.lists.filter((l) => l.id !== id),
    events: d.events.map((e) => (e.listId === id ? { ...e, listId: null } : e)),
  }));
}

export function importData(incoming: AppData, mode: 'merge' | 'replace') {
  update((d) => (mode === 'replace' ? { ...incoming, settings: { ...incoming.settings } } : mergeData(d, incoming)));
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
      if (e.key === KEY && e.newValue) {
        try {
          data.value = normalizeData(JSON.parse(e.newValue));
        } catch {
          /* ignore */
        }
      }
    });
  }
  platform.onRefresh(() => schedule());
}
