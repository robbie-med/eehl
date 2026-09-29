import { useState } from 'preact/hooks';
import { isLunar } from '../core/count';
import { explain } from '../core/explain';
import { milestonesFor } from '../core/milestones';
import { data, fmt, now, patchEvent, settings, t } from '../state/store';
import { Icon, Section, Sheet } from './components';
import { actionsFor, cycleReadout, EventActions, readoutIndex } from './Home';
import { colorOf, mix, viewOf } from './present';
import { back, go } from './router';
import { shareEvent } from './share';
import { isDarkTheme } from './theme';

export function Detail(props: { id: string }) {
  const s = t.value;
  const f = fmt.value;
  const set = settings.value;
  const ev = data.value.events.find((e) => e.id === props.id);
  const [explainIdx, setExplainIdx] = useState<number | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);
  if (!ev) {
    return (
      <div class="page">
        <header class="topbar">
          <button class="icon-btn" aria-label={s.common.back} onClick={back}>
            <Icon name="back" />
          </button>
        </header>
        <p class="muted center">{s.home.noResults}</p>
      </div>
    );
  }
  const v = viewOf(ev, now.value, f, set);
  if (!v) return <p class="muted center">{s.count.outOfRange}</p>;
  const dark = isDarkTheme();
  const accent = colorOf(ev.color, dark);
  const idx = (readoutIndex.value[ev.id] ?? 0) % v.readouts.length;
  const primary = v.readouts[idx];

  const today = v.st.todayDay;
  const all = milestonesFor(ev, v.st.origin.day, today + 366 * 100);
  const upcoming = all.filter((m) => m.day >= today);
  const past = all.filter((m) => m.day < today);
  const shownPast = showAllPast ? past : past.slice(-5);

  const explainRv = explainIdx !== null ? v.readouts[explainIdx] : null;
  const lines = explainRv ? explain(ev, v.st, explainRv.rv, f) : [];
  const listName = ev.listId ? data.value.lists.find((l) => l.id === ev.listId)?.name : null;

  return (
    <div class="page detail" style={{ '--accent': accent } as Record<string, string>}>
      <header class="topbar">
        <button class="icon-btn" aria-label={s.common.back} onClick={back}>
          <Icon name="back" />
        </button>
        <div class="topbar-actions">
          <button class="icon-btn" aria-label={ev.pinned ? s.actions.unpin : s.actions.pin} aria-pressed={ev.pinned} onClick={() => patchEvent(ev.id, { pinned: !ev.pinned })}>
            <Icon name="pin" class={ev.pinned ? 'filled' : ''} />
          </button>
          <button class="icon-btn" aria-label={s.actions.share} onClick={() => shareEvent(v, idx)}>
            <Icon name="share" />
          </button>
          <button class="icon-btn" aria-label={s.common.edit} onClick={() => go(`edit/${ev.id}`)}>
            <Icon name="edit" />
          </button>
          <button class="icon-btn" aria-label={f.t(s.a11y.menu, { title: ev.title })} onClick={() => (actionsFor.value = ev.id)}>
            <Icon name="more" />
          </button>
        </div>
      </header>

      <div class="hero" style={{ background: dark ? mix(accent, '#101216', 0.22) : mix(accent, '#ffffff', 0.14) }}>
        <div class="hero-emoji" aria-hidden="true">
          {ev.emoji}
        </div>
        <h1 class="hero-title">{ev.title || s.presets[ev.preset]}</h1>
        <p class="hero-date">{v.dateLine}</p>
        <button class="hero-number" onClick={() => cycleReadout(ev.id, v.readouts.length)} aria-label={`${primary.shown.aria}. ${s.a11y.cycle}`}>
          <span class="big">{primary.shown.main}</span>
          <span class="sub">{primary.shown.sub}</span>
          {primary.shown.progress !== undefined && (
            <span class="bar" aria-hidden="true">
              <span style={{ width: `${(primary.shown.progress * 100).toFixed(2)}%` }} />
            </span>
          )}
        </button>
        <div class="hero-tags">
          <span class="chip">{s.presets[ev.preset]}</span>
          {listName && <span class="chip">{listName}</span>}
          {ev.tags.map((tag) => (
            <span class="chip" key={tag}>
              #{tag}
            </span>
          ))}
          {ev.private && <span class="chip">{s.editor.private}</span>}
        </div>
      </div>

      <Section title={s.editor.display}>
        <ul class="readout-list">
          {v.readouts.map((o, i) => (
            <li key={o.r.id}>
              <button class="readout-row" onClick={() => setExplainIdx(i)}>
                <span class="readout-label">{o.shown.label}</span>
                <span class="readout-value">{o.shown.main}</span>
                <span class="readout-sub">{o.shown.sub}</span>
                <Icon name="info" size={18} class="muted" />
              </button>
            </li>
          ))}
        </ul>
        <p class="field-hint">{s.actions.explain}</p>
      </Section>

      <Section title={s.milestones.next}>
        {upcoming.length === 0 ? (
          <p class="muted">{s.milestones.none}</p>
        ) : (
          <ul class="timeline">
            {upcoming.slice(0, 3).map((m) => (
              <li key={m.key} class={m.day === today ? 'now' : ''}>
                <span class="tl-dot" />
                <span class="tl-label">{f.milestone(m.label)}</span>
                <span class="tl-date">
                  {f.date(m.civil, true)}
                  {m.lunar && isLunar(ev) && ` · ${f.lunar(m.lunar, ev.calendar)}`}
                </span>
                <span class="tl-rel">{f.relDays(m.day - today)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(past.length > 0 || upcoming.length > 0) && (
        <Section title={s.milestones.timeline}>
          <ul class="timeline">
            {past.length > shownPast.length && (
              <li class="more">
                <button class="link" onClick={() => setShowAllPast(true)}>
                  {s.common.more} ({past.length - shownPast.length})
                </button>
              </li>
            )}
            {shownPast.map((m) => (
              <li key={m.key} class="past">
                <span class="tl-dot" />
                <span class="tl-label">{f.milestone(m.label)}</span>
                <span class="tl-date">{f.date(m.civil)}</span>
                <span class="tl-rel">{f.relDays(m.day - today)}</span>
              </li>
            ))}
            <li class="today-marker">
              <span class="tl-dot" />
              <span class="tl-label">{s.common.today}</span>
              <span class="tl-date">{f.date(v.st.today)}</span>
            </li>
            {upcoming.slice(0, 15).map((m) => (
              <li key={m.key}>
                <span class="tl-dot" />
                <span class="tl-label">{f.milestone(m.label)}</span>
                <span class="tl-date">{f.date(m.civil)}</span>
                <span class="tl-rel">{f.relDays(m.day - today)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {ev.notes.trim() && (
        <Section title={s.editor.notes}>
          <p class="notes">{ev.notes}</p>
        </Section>
      )}

      <Sheet open={explainIdx !== null} onClose={() => setExplainIdx(null)} title={s.explain.title}>
        {explainRv && (
          <>
            <div class="explain-value">
              <span class="readout-label">{explainRv.shown.label}</span>
              <strong>{explainRv.shown.main}</strong>
              <span class="muted">{explainRv.shown.sub}</span>
            </div>
            <ol class="explain">
              {lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </>
        )}
      </Sheet>
      <EventActions />
    </div>
  );
}
