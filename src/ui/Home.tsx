import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { dayNumber, daysInMonth } from '../core/civil';
import { milestonesFor } from '../core/milestones';
import { PRESETS, readout } from '../core/presets';
import type { CountEvent, EventList, PresetId } from '../core/types';
import { deviceZone, wallAt } from '../core/zone';
import {
  data,
  deleteEvent,
  deleteEvents,
  duplicateEvent,
  fmt,
  now,
  patchEvent,
  patchEvents,
  restoreEvent,
  restoreEvents,
  settings,
  t,
  updateSettings,
  upsertList,
} from '../state/store';
import { platform } from '../platform';
import { confirmDialog, Icon, Sheet, showToast, useLongPress } from './components';
import { LIST_READOUTS, orderedLists } from './Lists';
import { ColorPicker } from './pickers';
import { colorOf, tintOf, viewOf, type EventView } from './present';
import { go, route } from './router';
import { shareEvent } from './share';
import { isDarkTheme } from './theme';

// Which readout each card shows; tap the number to cycle. Per viewer, not synced.
const INDEX_KEY = 'eehl:readout-index';
function loadIndex(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}');
  } catch {
    return {};
  }
}
export const readoutIndex = signal<Record<string, number>>(loadIndex());
export function cycleReadout(id: string, count: number) {
  const next = { ...readoutIndex.value, [id]: ((readoutIndex.value[id] ?? 0) + 1) % Math.max(1, count) };
  readoutIndex.value = next;
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(next));
  } catch {
    /* per-viewer convenience only */
  }
}

export const actionsFor = signal<string | null>(null);
/** Event ids to share as a QR code (the sheet lives in the App shell). */
export const qrFor = signal<string[] | null>(null);

function sortEvents(list: EventView[], mode: string): EventView[] {
  const out = [...list];
  switch (mode) {
    case 'soonest':
      // Upcoming first (closest countdown), then count-ups by most recent.
      return out.sort((a, b) => {
        const ka = a.st.mode === 'down' ? a.st.dday : 100000 + a.st.dday;
        const kb = b.st.mode === 'down' ? b.st.dday : 100000 + b.st.dday;
        return b.st.mode === 'down' && a.st.mode === 'down' ? kb - ka : ka - kb;
      });
    case 'date':
      return out.sort((a, b) => a.ev.epochMs - b.ev.epochMs);
    case 'title':
      return out.sort((a, b) => a.ev.title.localeCompare(b.ev.title));
    default:
      return out;
  }
}

interface Filters {
  tags: string[];
  presets: PresetId[];
  direction: 'all' | 'down' | 'up';
  milestoneThisMonth: boolean;
}
const NO_FILTERS: Filters = { tags: [], presets: [], direction: 'all', milestoneThisMonth: false };

/** Ids selected for bulk edit; null when not selecting. */
export const selection = signal<string[] | null>(null);

function toggleSelected(id: string) {
  const cur = selection.value ?? [];
  selection.value = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
}

export function Home() {
  const s = t.value;
  const f = fmt.value;
  const set = settings.value;
  const d = data.value;
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const tick = now.value;
  const selected = selection.value;
  const selectingNow = selected !== null;
  useEffect(() => {
    if (!selectingNow) return;
    // Back (Android) or Escape ends selection before anything else.
    const off = platform.onBack(() => ((selection.value = null), true));
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (selection.value = null);
    document.addEventListener('keydown', key);
    return () => {
      off();
      document.removeEventListener('keydown', key);
    };
  }, [selectingNow]);

  const allTags = useMemo(() => [...new Set(d.events.flatMap((e) => e.tags))].sort(), [d]);
  const usedPresets = useMemo(() => PRESETS.map((p) => p.id).filter((id) => d.events.some((e) => !e.archived && e.preset === id)), [d]);

  const views = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lists = new Map(d.lists.map((l) => [l.id, l.name.toLowerCase()]));
    const out = d.events
      .filter((e) => !e.archived)
      .filter(
        (e) =>
          !q ||
          e.title.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q) ||
          e.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          (e.listId && lists.get(e.listId)?.includes(q)) ||
          s.presets[e.preset].toLowerCase().includes(q),
      )
      .filter((e) => !filters.tags.length || filters.tags.some((tag) => e.tags.includes(tag)))
      .filter((e) => !filters.presets.length || filters.presets.includes(e.preset))
      .map((e) => viewOf(e, tick, f, set))
      .filter((v): v is EventView => !!v)
      .filter((v) => filters.direction === 'all' || (filters.direction === 'down' ? v.st.mode === 'down' : v.st.mode === 'up'));
    if (!filters.milestoneThisMonth) return out;
    const today = wallAt(tick, deviceZone());
    const first = dayNumber({ y: today.y, m: today.m, d: 1 });
    const last = dayNumber({ y: today.y, m: today.m, d: daysInMonth(today.y, today.m) });
    return out.filter((v) => milestonesFor(v.ev, first, last).length > 0);
  }, [d, tick, f, set, query, filters]);

  const filterCount = filters.tags.length + filters.presets.length + (filters.direction !== 'all' ? 1 : 0) + (filters.milestoneThisMonth ? 1 : 0);
  const archivedCount = d.events.filter((e) => e.archived).length;
  const pinned = sortEvents(views.filter((v) => v.ev.pinned), set.sort);
  const rest = views.filter((v) => !v.ev.pinned);
  const listIds = new Set(d.lists.map((l) => l.id));
  const narrowed = !!query || filterCount > 0;
  const groups: { list: EventList | null; depth: 0 | 1; items: EventView[] }[] = [
    ...orderedLists(d.lists).map(({ list, depth }) => ({
      list,
      depth,
      items: sortEvents(rest.filter((v) => v.ev.listId === list.id), list.sort === 'inherit' ? set.sort : list.sort),
    })),
    { list: null, depth: 0 as const, items: sortEvents(rest.filter((v) => !v.ev.listId || !listIds.has(v.ev.listId)), set.sort) },
  ].filter((g) => g.items.length > 0 || (g.list && !narrowed && !g.list.parentId));
  const parentCollapsed = (l: EventList | null) => !!l?.parentId && !!d.lists.find((p) => p.id === l.parentId)?.collapsed;

  const empty = d.events.filter((e) => !e.archived).length === 0;
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" class={'chip-btn small' + (on ? ' on' : '')} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  return (
    <div class="page home">
      {selected ? (
        <BulkBar ids={selected} all={views.map((v) => v.ev.id)} />
      ) : (
        <header class="topbar">
          <h1 class="brand">
            <img src="icons/mark.svg" alt="" width="28" height="28" />
            <span>eehl</span>
          </h1>
          <div class="topbar-actions">
            {!empty && (
              <button class="icon-btn" aria-label={s.common.search} aria-pressed={searching} onClick={() => setSearching(!searching)}>
                <Icon name="search" />
              </button>
            )}
            {!empty && (
              <button class={'icon-btn' + (filterCount ? ' badge' : '')} aria-label={s.filters.title} aria-pressed={filtering} data-count={filterCount || undefined} onClick={() => setFiltering(!filtering)}>
                <Icon name="filter" />
              </button>
            )}
            {!empty && (
              <button class="icon-btn" aria-label={s.bulk.select} onClick={() => (selection.value = [])}>
                <Icon name="check" />
              </button>
            )}
            {!empty && <CardModeButton />}
          </div>
        </header>
      )}

      {searching && (
        <div class="search">
          <input
            class="input"
            type="search"
            autoFocus
            placeholder={s.home.searchPlaceholder}
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
        </div>
      )}

      {filtering && !empty && (
        <div class="filters">
          <div class="filter-row">
            {chip(filters.direction === 'down', s.filters.countingDown, () => setFilters({ ...filters, direction: filters.direction === 'down' ? 'all' : 'down' }))}
            {chip(filters.direction === 'up', s.filters.countingUp, () => setFilters({ ...filters, direction: filters.direction === 'up' ? 'all' : 'up' }))}
            {chip(filters.milestoneThisMonth, s.filters.milestoneThisMonth, () => setFilters({ ...filters, milestoneThisMonth: !filters.milestoneThisMonth }))}
          </div>
          {usedPresets.length > 1 && (
            <div class="filter-row" aria-label={s.filters.presets}>
              {usedPresets.map((p) => chip(filters.presets.includes(p), `${PRESETS.find((x) => x.id === p)!.emoji} ${s.presets[p]}`, () => setFilters({ ...filters, presets: toggle(filters.presets, p) })))}
            </div>
          )}
          {allTags.length > 0 && (
            <div class="filter-row" aria-label={s.filters.tags}>
              {allTags.map((tag) => chip(filters.tags.includes(tag), `#${tag}`, () => setFilters({ ...filters, tags: toggle(filters.tags, tag) })))}
            </div>
          )}
          {filterCount > 0 && (
            <button class="link" onClick={() => setFilters(NO_FILTERS)}>
              {s.filters.clear}
            </button>
          )}
        </div>
      )}

      {empty ? (
        <Welcome />
      ) : (
        <>
          {pinned.length > 0 && <Group title={s.home.pinned} items={pinned} />}
          {groups.map((g) =>
            parentCollapsed(g.list) ? null : (
              <Group
                key={g.list?.id ?? 'none'}
                title={g.list ? g.list.name : groups.length > 1 || pinned.length ? s.home.noList : ''}
                list={g.list}
                depth={g.depth}
                items={g.items}
              />
            ),
          )}
          {narrowed && views.length === 0 && <p class="muted center">{s.home.noResults}</p>}
          {archivedCount > 0 && !narrowed && (
            <button class="link-row" onClick={() => go('archive')}>
              <Icon name="archive" size={18} /> {s.home.archive} ({archivedCount})
            </button>
          )}
        </>
      )}

      {!selected && (
        <button class="fab" aria-label={s.home.newEvent} onClick={() => go('new/custom')}>
          <Icon name="plus" size={28} />
        </button>
      )}
      <EventActions />
    </div>
  );
}

function BulkBar(props: { ids: string[]; all: string[] }) {
  const s = t.value;
  const b = s.bulk;
  const f = fmt.value;
  const [sheet, setSheet] = useState<'list' | 'color' | 'readout' | null>(null);
  const ids = props.ids;
  const done = () => (selection.value = null);
  const none = ids.length === 0;
  const events = data.value.events.filter((e) => ids.includes(e.id));
  const allPinned = events.length > 0 && events.every((e) => e.pinned);
  return (
    <>
      <header class="topbar bulk">
        <button class="icon-btn" aria-label={b.done} onClick={done}>
          <Icon name="close" />
        </button>
        <h1 class="topbar-title left">{f.t(b.selected, { n: ids.length })}</h1>
        <button class="btn ghost small" onClick={() => (selection.value = ids.length === props.all.length ? [] : props.all)}>
          {b.selectAll}
        </button>
      </header>
      <div class="bulk-actions">
        <button class="btn small" disabled={none} onClick={() => patchEvents(ids, () => ({ pinned: !allPinned }))}>
          <Icon name="pin" size={18} /> {allPinned ? b.unpin : b.pin}
        </button>
        <button class="btn small" disabled={none} onClick={() => setSheet('list')}>
          {b.moveToList}
        </button>
        <button class="btn small" disabled={none} onClick={() => setSheet('color')}>
          {b.color}
        </button>
        <button class="btn small" disabled={none} onClick={() => setSheet('readout')}>
          {b.addReadout}
        </button>
        <button
          class="btn small"
          disabled={none}
          onClick={() => {
            patchEvents(ids, () => ({ archived: true }));
            showToast(s.actions.archivedToast, { label: s.actions.undo, run: () => patchEvents(ids, () => ({ archived: false })) });
            done();
          }}
        >
          <Icon name="archive" size={18} /> {b.archive}
        </button>
        <button
          class="btn small danger"
          disabled={none}
          onClick={async () => {
            if (!(await confirmDialog(f.t(b.deleteConfirm, { n: ids.length }), b.delete, true))) return;
            const gone = deleteEvents(ids);
            done();
            showToast(f.t(b.deleted, { n: gone.length }), { label: s.actions.undo, run: () => restoreEvents(gone) });
          }}
        >
          <Icon name="trash" size={18} /> {b.delete}
        </button>
      </div>
      <Sheet open={sheet === 'list'} onClose={() => setSheet(null)} title={b.moveToList}>
        <div class="menu">
          <button onClick={() => (patchEvents(ids, () => ({ listId: null })), setSheet(null))}>{s.editor.noList}</button>
          {orderedLists(data.value.lists).map(({ list, depth }) => (
            <button key={list.id} class={depth ? 'child' : ''} onClick={() => (patchEvents(ids, () => ({ listId: list.id })), setSheet(null))}>
              {list.name}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'color'} onClose={() => setSheet(null)} title={b.color}>
        <ColorPicker value={events[0]?.color ?? 'blue'} onChange={(color) => patchEvents(ids, () => ({ color }))} />
        <div class="row-buttons">
          <button class="btn primary" onClick={() => setSheet(null)}>
            {s.common.done}
          </button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'readout'} onClose={() => setSheet(null)} title={b.addReadout}>
        <div class="menu">
          {LIST_READOUTS.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                patchEvents(ids, (e) => ({ readouts: [...e.readouts, readout(r.style, r.units)] }));
                setSheet(null);
              }}
            >
              {r.style === 'units' ? r.units.map((u) => s.units[u][1]).join(' + ') : s.editor.styles[r.style]}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function CardModeButton() {
  const set = settings.value;
  const s = t.value;
  const order = ['full', 'compact', 'grid'] as const;
  const next = order[(order.indexOf(set.cardMode) + 1) % order.length];
  return (
    <button
      class="icon-btn"
      aria-label={`${s.home.viewMode}: ${s.cardMode[set.cardMode]}`}
      title={s.cardMode[next]}
      onClick={() => updateSettings({ cardMode: next })}
    >
      <Icon name={set.cardMode === 'grid' ? 'list' : 'grid'} />
    </button>
  );
}

function Group(props: { title: string; items: EventView[]; list?: EventList | null; depth?: 0 | 1 }) {
  const mode = settings.value.cardMode;
  const collapsed = props.list?.collapsed ?? false;
  const dark = isDarkTheme();
  return (
    <section class={'group' + (props.depth ? ' child' : '')}>
      {props.title && (
        <button
          class="group-head"
          aria-expanded={!collapsed}
          disabled={!props.list}
          onClick={() => props.list && upsertList({ ...props.list, collapsed: !collapsed })}
        >
          {props.list && <span class="dot" style={{ background: colorOf(props.list.color, dark) }} />}
          <span>{props.title}</span>
          <span class="count">{props.items.length}</span>
          {props.list && <Icon name={collapsed ? 'chevron' : 'down'} size={16} />}
        </button>
      )}
      {!collapsed && (
        <div class={'cards ' + mode}>
          {props.items.map((v) => (
            <EventCard key={v.ev.id} v={v} mode={mode} />
          ))}
        </div>
      )}
    </section>
  );
}

export function EventCard(props: { v: EventView; mode: 'full' | 'compact' | 'grid' }) {
  const { v, mode } = props;
  const s = t.value;
  const f = fmt.value;
  const set = settings.value;
  const dark = isDarkTheme();
  const accent = colorOf(v.ev.color, dark);
  const bg = tintOf(v.ev.color, dark, set.theme === 'black');
  const idx = (readoutIndex.value[v.ev.id] ?? 0) % v.readouts.length;
  const primary = v.readouts[idx];
  const others = v.readouts.filter((_, i) => i !== idx).slice(0, 2);
  const selecting = selection.value !== null;
  const isSelected = !!selection.value?.includes(v.ev.id);
  const long = useLongPress(() => (selecting ? toggleSelected(v.ev.id) : (actionsFor.value = v.ev.id)));
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);

  const open = () => {
    if (long.wasLong() || Math.abs(dx) > 5) return;
    if (selecting) toggleSelected(v.ev.id);
    else go(`event/${v.ev.id}`);
  };
  const cycle = (e: Event) => {
    if (selecting) return; // let the click select the card
    e.stopPropagation();
    if (long.wasLong()) return;
    cycleReadout(v.ev.id, v.readouts.length);
  };

  const onPointerDown = (e: PointerEvent) => {
    long.onPointerDown(e);
    if (selecting) return;
    drag.current = { x: e.clientX, y: e.clientY, active: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    long.onPointerMove(e);
    const d0 = drag.current;
    if (!d0 || e.pointerType === 'mouse') return;
    const ddx = e.clientX - d0.x;
    const ddy = e.clientY - d0.y;
    if (!d0.active && Math.abs(ddx) > 12 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
      d0.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (d0.active) setDx(Math.max(-140, Math.min(140, ddx)));
  };
  const onPointerUp = () => {
    long.onPointerUp();
    if (drag.current?.active) {
      if (dx > 90) {
        patchEvent(v.ev.id, { pinned: !v.ev.pinned });
        showToast(v.ev.pinned ? s.actions.unpin : s.actions.pinned);
      } else if (dx < -90) {
        archiveWithUndo(v.ev);
      }
      setTimeout(() => setDx(0), 0);
    }
    drag.current = null;
  };

  const arrow = set.showArrows && primary.rv.direction !== 'none' ? (primary.rv.direction === 'until' ? '↓' : '↑') : '';
  const number = (
    <button class="readout-btn" onClick={cycle} aria-label={`${primary.shown.aria}. ${s.a11y.cycle}`}>
      {primary.shown.parts && primary.shown.parts.length > 1 && mode === 'full' ? (
        <span class="big split">
          {primary.shown.parts.map((p, i) => (
            <span key={i}>
              <b>{p.n}</b>
              <small>{p.u}</small>
            </span>
          ))}
        </span>
      ) : primary.shown.parts && primary.shown.parts.length === 1 ? (
        <span class="big">
          <b>{primary.shown.parts[0].n}</b>
          <small>{primary.shown.parts[0].u}</small>
        </span>
      ) : (
        <span class="big">
          <b>{primary.shown.main}</b>
        </span>
      )}
      <span class="sub">
        {arrow && <span aria-hidden="true">{arrow} </span>}
        {primary.shown.sub}
      </span>
      {primary.shown.progress !== undefined && (
        <span class="bar" aria-hidden="true">
          <span style={{ width: `${(primary.shown.progress * 100).toFixed(2)}%` }} />
        </span>
      )}
    </button>
  );

  return (
    <div class="card-wrap" data-swipe={dx > 40 ? 'pin' : dx < -40 ? 'archive' : ''}>
      <div class="swipe-hint left" aria-hidden="true">
        <Icon name="pin" />
      </div>
      <div class="swipe-hint right" aria-hidden="true">
        <Icon name="archive" />
      </div>
      <article
        class={`card ${mode}${v.st.isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${primary.shown.progress !== undefined && mode === 'full' ? ' stacked' : ''}`}
        style={{ '--accent': accent, background: bg, transform: dx ? `translateX(${dx}px)` : undefined } as Record<string, string>}
        onClick={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={long.onContextMenu}
        role={selecting ? 'checkbox' : 'link'}
        aria-checked={selecting ? isSelected : undefined}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && open()}
        aria-label={v.ev.title}
      >
        {selecting && (
          <span class={'select-mark' + (isSelected ? ' on' : '')} aria-hidden="true">
            {isSelected && <Icon name="check" size={16} />}
          </span>
        )}
        <div class="card-main">
          <div class="emoji" aria-hidden="true">
            {v.ev.emoji}
          </div>
          <div class="card-text">
            <h3 class="title">
              {v.ev.pinned && mode !== 'full' && <Icon name="pin" size={14} class="pin-mark" />}
              {v.ev.title || s.presets[v.ev.preset]}
            </h3>
            {set.showDates && mode !== 'grid' && <p class="date">{v.dateLine}</p>}
          </div>
          {mode !== 'grid' && number}
        </div>
        {mode === 'grid' && number}
        {mode === 'full' && (others.length > 0 || v.next) && (
          <div class="card-extra">
            {others.map((o) => (
              <span class="chip" key={o.r.id}>
                {o.shown.main}
                {o.r.style === 'age' && o.shown.sub ? ` · ${o.shown.sub}` : ''}
              </span>
            ))}
            {v.next && (
              <span class="chip next">
                <Icon name="sparkle" size={14} /> {f.milestone(v.next.label)} · {f.relDays(v.next.day - v.st.todayDay)}
              </span>
            )}
          </div>
        )}
      </article>
    </div>
  );
}

export function archiveWithUndo(ev: CountEvent) {
  const s = t.value;
  patchEvent(ev.id, { archived: true });
  showToast(s.actions.archivedToast, { label: s.actions.undo, run: () => patchEvent(ev.id, { archived: false }) });
}

export async function deleteWithConfirm(ev: CountEvent): Promise<boolean> {
  const s = t.value;
  if (settings.value.confirmDelete) {
    const ok = await confirmDialog(fmt.value.t(s.actions.deleteConfirm, { title: ev.title }), s.common.delete, true);
    if (!ok) return false;
  }
  const gone = deleteEvent(ev.id);
  if (gone) showToast(fmt.value.t(s.bulk.deleted, { n: 1 }), { label: s.actions.undo, run: () => restoreEvent(gone) });
  return true;
}

export function EventActions() {
  const id = actionsFor.value;
  const ev = data.value.events.find((e) => e.id === id);
  const s = t.value;
  const close = () => (actionsFor.value = null);
  const act = (fn: () => void | Promise<unknown>) => () => {
    close();
    void fn();
  };
  const v = ev ? viewOf(ev, now.value, fmt.value, settings.value, false) : null;
  return (
    <Sheet open={!!ev} onClose={close} title={ev ? `${ev.emoji} ${ev.title}` : ''}>
      {ev && (
        <div class="menu">
          <button onClick={act(() => { selection.value = [ev.id]; })}>
            <Icon name="check" /> {s.bulk.select}
          </button>
          <button onClick={act(() => { qrFor.value = [ev.id]; })}>
            <Icon name="qr" /> {s.qr.share}
          </button>
          <button onClick={act(() => patchEvent(ev.id, { pinned: !ev.pinned }))}>
            <Icon name="pin" /> {ev.pinned ? s.actions.unpin : s.actions.pin}
          </button>
          <button onClick={act(() => go(`edit/${ev.id}`))}>
            <Icon name="edit" /> {s.common.edit}
          </button>
          <button onClick={act(async () => { if (v) await shareEvent(v, readoutIndex.value[ev.id] ?? 0); })}>
            <Icon name="share" /> {s.actions.share}
          </button>
          <button
            onClick={act(() => {
              const nid = duplicateEvent(ev.id);
              if (nid) go(`edit/${nid}`);
            })}
          >
            <Icon name="copy" /> {s.actions.duplicate}
          </button>
          <button onClick={act(() => (ev.archived ? patchEvent(ev.id, { archived: false }) : archiveWithUndo(ev)))}>
            <Icon name="archive" /> {ev.archived ? s.actions.unarchive : s.actions.archive}
          </button>
          <button
            class="danger"
            onClick={act(async () => {
              if ((await deleteWithConfirm(ev)) && route.value.name !== 'home') go('', true);
            })}
          >
            <Icon name="trash" /> {s.common.delete}
          </button>
        </div>
      )}
    </Sheet>
  );
}

function Welcome() {
  const s = t.value;
  const featured: PresetId[] = ['couple', 'baby', 'birthday', 'custom', 'exam', 'service', 'wedding', 'memorial'];
  return (
    <div class="welcome">
      <div class="welcome-mark" aria-hidden="true">
        <img src="icons/mark.svg" alt="" width="72" height="72" />
      </div>
      <h2>{s.home.emptyTitle}</h2>
      <p class="muted">{s.home.emptyBody}</p>
      <div class="preset-grid">
        {featured.map((id) => {
          const p = PRESETS.find((x) => x.id === id)!;
          return (
            <button key={id} class="preset-tile" onClick={() => go(`new/${id}`)} style={{ '--accent': colorOf(p.color, isDarkTheme()) } as Record<string, string>}>
              <span class="emoji">{p.emoji}</span>
              <span class="preset-name">{s.presets[id]}</span>
              <span class="preset-hint">{s.presetHints[id]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
