import { signal } from '@preact/signals';
import { useMemo, useRef, useState } from 'preact/hooks';
import { PRESETS } from '../core/presets';
import type { CountEvent, EventList, PresetId } from '../core/types';
import { data, deleteEvent, duplicateEvent, fmt, now, patchEvent, settings, t, updateSettings, upsertList } from '../state/store';
import { confirmDialog, Icon, Sheet, showToast, useLongPress } from './components';
import { colorOf, mix, viewOf, type EventView } from './present';
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

export function Home() {
  const s = t.value;
  const f = fmt.value;
  const set = settings.value;
  const d = data.value;
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const tick = now.value;

  const views = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lists = new Map(d.lists.map((l) => [l.id, l.name.toLowerCase()]));
    return d.events
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
      .map((e) => viewOf(e, tick, f, set))
      .filter((v): v is EventView => !!v);
  }, [d, tick, f, set, query]);

  const archivedCount = d.events.filter((e) => e.archived).length;
  const sorted = sortEvents(views, set.sort);
  const pinned = sorted.filter((v) => v.ev.pinned);
  const rest = sorted.filter((v) => !v.ev.pinned);
  const groups: { list: EventList | null; items: EventView[] }[] = [
    ...d.lists.map((l) => ({ list: l, items: rest.filter((v) => v.ev.listId === l.id) })),
    { list: null, items: rest.filter((v) => !v.ev.listId || !d.lists.some((l) => l.id === v.ev.listId)) },
  ].filter((g) => g.items.length > 0 || (g.list && !query));

  const empty = d.events.filter((e) => !e.archived).length === 0;

  return (
    <div class="page home">
      <header class="topbar">
        <h1 class="brand">
          <img src="icons/mark.svg" alt="" width="28" height="28" />
          <span>eehl</span>
        </h1>
        <div class="topbar-actions">
          {!empty && (
            <button class="icon-btn" aria-label={s.common.search} onClick={() => setSearching(!searching)}>
              <Icon name="search" />
            </button>
          )}
          {!empty && <CardModeButton />}
        </div>
      </header>

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

      {empty ? (
        <Welcome />
      ) : (
        <>
          {pinned.length > 0 && <Group title={s.home.pinned} items={pinned} />}
          {groups.map((g) => (
            <Group key={g.list?.id ?? 'none'} title={g.list ? g.list.name : groups.length > 1 || pinned.length ? s.home.noList : ''} list={g.list} items={g.items} />
          ))}
          {query && views.length === 0 && <p class="muted center">{s.home.noResults}</p>}
          {archivedCount > 0 && !query && (
            <button class="link-row" onClick={() => go('archive')}>
              <Icon name="archive" size={18} /> {s.home.archive} ({archivedCount})
            </button>
          )}
        </>
      )}

      <button class="fab" aria-label={s.home.newEvent} onClick={() => go('new/custom')}>
        <Icon name="plus" size={28} />
      </button>
      <EventActions />
    </div>
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

function Group(props: { title: string; items: EventView[]; list?: EventList | null }) {
  const mode = settings.value.cardMode;
  const collapsed = props.list?.collapsed ?? false;
  const dark = isDarkTheme();
  return (
    <section class="group">
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
  const bg = dark ? mix(accent, set.theme === 'black' ? '#000000' : '#16181d', 0.16) : mix(accent, '#ffffff', 0.1);
  const idx = (readoutIndex.value[v.ev.id] ?? 0) % v.readouts.length;
  const primary = v.readouts[idx];
  const others = v.readouts.filter((_, i) => i !== idx).slice(0, 2);
  const long = useLongPress(() => (actionsFor.value = v.ev.id));
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);

  const open = () => {
    if (long.wasLong() || Math.abs(dx) > 5) return;
    go(`event/${v.ev.id}`);
  };
  const cycle = (e: Event) => {
    e.stopPropagation();
    if (long.wasLong()) return;
    cycleReadout(v.ev.id, v.readouts.length);
  };

  const onPointerDown = (e: PointerEvent) => {
    long.onPointerDown(e);
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
        class={`card ${mode}${v.st.isToday ? ' today' : ''}`}
        style={{ '--accent': accent, background: bg, transform: dx ? `translateX(${dx}px)` : undefined } as Record<string, string>}
        onClick={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={long.onContextMenu}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && go(`event/${v.ev.id}`)}
        aria-label={v.ev.title}
      >
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
  deleteEvent(ev.id);
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
