import { useState } from 'preact/hooks';
import { dayNumber, fromDayNumber, parseISODate, toISODate } from '../core/civil';
import { anchorWall } from '../core/count';
import { dayNumberToLunar, inLunarRange, leapMonthOf, lunarToDayNumber, type LunarCalendar, type LunarDate } from '../core/lunar';
import { anchorInstant, newEvent, presetFields, PRESETS, readout, reminder, rule } from '../core/presets';
import {
  UNITS,
  type CalendarSystem,
  type Counter,
  type CountEvent,
  type MilestoneRule,
  type MilestoneType,
  type PresetId,
  type Readout,
  type ReadoutStyle,
  type Reminder,
  type Unit,
} from '../core/types';
import { deviceZone, wallAt } from '../core/zone';
import { data, fmt, lang, settings, t, upsertEvent } from '../state/store';
import { Field, Icon, Section, Segmented, Select, showToast, Toggle } from './components';
import { deleteWithConfirm } from './Home';
import { orderedLists } from './Lists';
import { ColorPicker, EmojiPicker, ZonePicker } from './pickers';
import { back, go } from './router';


interface Draft {
  ev: CountEvent;
  date: string;
  time: string;
  calendar: CalendarSystem;
  lunar: LunarDate;
  spanStart: string;
  tags: string;
}

function draftFrom(ev: CountEvent): Draft {
  const w = anchorWall(ev);
  const hasLunar = ev.calendar !== 'gregorian' && ev.lunar;
  const lunar = hasLunar ? ev.lunar! : dayNumberToLunar('korean-lunar', dayNumber(w)) ?? { year: w.y, month: 1, day: 1, leap: false };
  return {
    ev,
    date: toISODate(w),
    time: ev.allDay ? '09:00' : `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`,
    calendar: ev.calendar,
    lunar,
    spanStart: ev.spanStartMs !== null ? toISODate(wallAt(ev.spanStartMs, ev.zone)) : '',
    tags: ev.tags.join(', '),
  };
}

function freshEvent(preset: PresetId): CountEvent {
  const zone = settings.value.defaultZone ?? deviceZone();
  const today = wallAt(Date.now(), zone);
  const ev = newEvent({
    preset,
    title: '',
    date: today,
    time: null,
    zone,
    now: Date.now(),
    leapRule: settings.value.leapRule,
    tradition: lang.value === 'ja' ? 'ja' : 'ko',
    lang: lang.value,
  });
  if (ev.counter) ev.counter = { ...ev.counter, label: t.value.counterUi.defaultLabel, unit: t.value.counterUi.defaultUnit };
  return ev;
}

/** A new event in a list gets the list's default readout, unless it already has one like it. */
function withListReadout(readouts: Readout[], listId: string | null): Readout[] {
  const def = listId ? data.value.lists.find((l) => l.id === listId)?.defaultReadout : null;
  if (!def || readouts.some((r) => r.style === def.style && r.units.join() === def.units.join())) return readouts;
  return [...readouts, readout(def.style, def.units)];
}

export function Editor(props: { id?: string; preset?: string }) {
  const s = t.value;
  const f = fmt.value;
  const existing = props.id ? data.value.events.find((e) => e.id === props.id) : undefined;
  const isNew = !existing;
  const [d, setD] = useState<Draft>(() => draftFrom(existing ?? freshEvent((PRESETS.some((p) => p.id === props.preset) ? props.preset : 'custom') as PresetId)));
  const [error, setError] = useState('');
  const ev = d.ev;
  const set = (patch: Partial<CountEvent>) => setD({ ...d, ev: { ...d.ev, ...patch } });
  const setDraft = (patch: Partial<Draft>) => setD({ ...d, ...patch });

  const isLunarCal = d.calendar !== 'gregorian';
  const lunarCal = d.calendar as LunarCalendar;
  const lunarDay = isLunarCal ? lunarToDayNumber(lunarCal, d.lunar) : null;
  const yearHasLeap = isLunarCal && inLunarRange(d.lunar.year) ? leapMonthOf(lunarCal, d.lunar.year) : 0;

  const changePreset = (p: PresetId) => {
    const info = PRESETS.find((x) => x.id === p)!;
    setD({
      ...d,
      ev: {
        ...d.ev,
        preset: p,
        emoji: info.emoji,
        color: info.color,
        ...presetFields(p, lang.value === 'ja' ? 'ja' : 'ko', lang.value),
        counter: p === 'exam' ? (d.ev.counter ?? { label: s.counterUi.defaultLabel, value: 0, step: 1, unit: s.counterUi.defaultUnit }) : d.ev.counter,
      },
    });
  };

  const changeCalendar = (c: CalendarSystem) => {
    if (c === d.calendar) return;
    if (c === 'gregorian') {
      const n = lunarDay;
      setDraft({ calendar: c, date: n !== null ? toISODate(fromDayNumber(n)) : d.date });
      return;
    }
    const solar = parseISODate(d.date);
    const l = solar ? dayNumberToLunar(c, dayNumber(solar)) : null;
    setDraft({ calendar: c, lunar: l ?? d.lunar });
  };

  const save = () => {
    setError('');
    if (!ev.title.trim()) {
      setError(s.editor.titleRequired);
      return;
    }
    let date = parseISODate(d.date);
    if (isLunarCal) {
      if (lunarDay === null) {
        setError(s.editor.lunarInvalid);
        return;
      }
      date = fromDayNumber(lunarDay);
    }
    if (!date) {
      setError(s.editor.date);
      return;
    }
    const [h, mi] = d.time.split(':').map(Number);
    const time = ev.allDay ? null : { h: h || 0, mi: mi || 0 };
    const span = parseISODate(d.spanStart);
    const final: CountEvent = {
      ...ev,
      title: ev.title.trim(),
      epochMs: anchorInstant(date, time, ev.zone),
      calendar: d.calendar,
      lunar: isLunarCal ? d.lunar : null,
      // Monthly repeats of lunar dates are not supported; fall back to yearly.
      repeat: isLunarCal && ev.repeat === 'monthly' ? 'yearly' : ev.repeat,
      spanStartMs: span ? anchorInstant(span, null, ev.zone) : null,
      tags: d.tags.split(',').map((x) => x.trim()).filter(Boolean),
      readouts: withListReadout(ev.readouts.length ? ev.readouts : [readout('dday')], isNew ? ev.listId : null),
    };
    upsertEvent(final);
    showToast(s.editor.saved);
    if (isNew) go(`event/${final.id}`, true);
    else back();
  };

  const presetOptions = PRESETS.map((p) => ({ value: p.id, label: `${p.emoji} ${s.presets[p.id]}` }));

  return (
    <div class="page editor">
      <header class="topbar">
        <button class="icon-btn" aria-label={s.common.cancel} onClick={back}>
          <Icon name="close" />
        </button>
        <h1 class="topbar-title">{isNew ? s.editor.newTitle : s.editor.editTitle}</h1>
        <button class="btn primary small" onClick={save}>
          {s.common.save}
        </button>
      </header>

      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}

      <Section title={s.editor.preset}>
        <div class="preset-chips" role="radiogroup" aria-label={s.editor.preset}>
          {presetOptions.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={ev.preset === o.value}
              class={'chip-btn' + (ev.preset === o.value ? ' on' : '')}
              onClick={() => changePreset(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p class="field-hint">{s.presetHints[ev.preset]}</p>
        {!isNew && <p class="field-hint">{s.editor.presetNote}</p>}
      </Section>

      <Section title={s.editor.basics}>
        <Field label={s.editor.title}>
          <input
            class="input"
            value={ev.title}
            placeholder={s.editor.titlePlaceholder}
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
            autoFocus={isNew}
            maxLength={120}
          />
        </Field>
        <div class="field">
          <span class="field-label">{s.editor.emoji}</span>
          <EmojiPicker value={ev.emoji} onChange={(emoji) => set({ emoji })} />
        </div>
        <div class="field">
          <span class="field-label">{s.editor.color}</span>
          <ColorPicker value={ev.color} onChange={(color) => set({ color })} />
        </div>
        {data.value.lists.length > 0 && (
          <Field label={s.editor.list}>
            <Select
              value={ev.listId ?? ''}
              options={[
                { value: '', label: s.editor.noList },
                ...orderedLists(data.value.lists).map(({ list, depth }) => ({ value: list.id, label: (depth ? '　' : '') + list.name })),
              ]}
              onChange={(v) => {
                const list = data.value.lists.find((l) => l.id === v);
                // New events pick up the list's default time zone.
                set({ listId: v || null, ...(isNew && list?.defaultZone ? { zone: list.defaultZone } : {}) });
              }}
            />
          </Field>
        )}
      </Section>

      <Section title={s.editor.dateCalendar}>
        <Field label={s.editor.calendar}>
          <Segmented
            value={d.calendar}
            ariaLabel={s.editor.calendar}
            options={[
              { value: 'gregorian', label: s.editor.gregorian },
              { value: 'korean-lunar', label: s.editor.koreanLunar },
              { value: 'chinese-lunar', label: s.editor.chineseLunar },
            ]}
            onChange={(c) => changeCalendar(c as CalendarSystem)}
          />
        </Field>

        {!isLunarCal ? (
          <Field label={s.editor.date}>
            <input class="input" type="date" value={d.date} min="1000-01-01" max="9999-12-31" onInput={(e) => setDraft({ date: (e.target as HTMLInputElement).value })} required />
          </Field>
        ) : (
          <>
            <div class="lunar-row">
              <Field label={s.editor.lunarYear}>
                <input
                  class="input"
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={2100}
                  value={d.lunar.year}
                  onInput={(e) => setDraft({ lunar: { ...d.lunar, year: Number((e.target as HTMLInputElement).value) || d.lunar.year } })}
                />
              </Field>
              <Field label={s.editor.lunarMonth}>
                <Select
                  value={String(d.lunar.month)}
                  options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                  onChange={(v) => setDraft({ lunar: { ...d.lunar, month: Number(v) } })}
                />
              </Field>
              <Field label={s.editor.lunarDay}>
                <Select
                  value={String(d.lunar.day)}
                  options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                  onChange={(v) => setDraft({ lunar: { ...d.lunar, day: Number(v) } })}
                />
              </Field>
            </div>
            <Toggle
              label={s.editor.leapMonth}
              hint={yearHasLeap !== d.lunar.month && !d.lunar.leap ? f.t(s.editor.leapUnavailable, { m: d.lunar.month, y: d.lunar.year }) : undefined}
              checked={d.lunar.leap}
              disabled={yearHasLeap !== d.lunar.month && !d.lunar.leap}
              onChange={(v) => setDraft({ lunar: { ...d.lunar, leap: v } })}
            />
            <p class={lunarDay === null ? 'error' : 'resolved'}>
              {lunarDay === null
                ? inLunarRange(d.lunar.year)
                  ? s.editor.lunarInvalid
                  : s.count.outOfRange
                : f.t(s.editor.resolvesTo, { date: f.date(fromDayNumber(lunarDay), true) })}
            </p>
            {d.lunar.leap && (
              <Field label={s.editor.leapRule}>
                <Select
                  value={ev.leapRule}
                  options={[
                    { value: 'regular', label: s.editor.leapRegular },
                    { value: 'leap-when-exists', label: s.editor.leapWhenExists },
                  ]}
                  onChange={(v) => set({ leapRule: v })}
                />
              </Field>
            )}
          </>
        )}

        <Toggle label={s.editor.allDay} checked={ev.allDay} onChange={(v) => set({ allDay: v })} />
        {!ev.allDay && (
          <Field label={s.editor.time}>
            <input class="input" type="time" value={d.time} onInput={(e) => setDraft({ time: (e.target as HTMLInputElement).value })} />
          </Field>
        )}
        <div class="field">
          <span class="field-label">{s.editor.zone}</span>
          <ZonePicker value={ev.zone} onChange={(zone) => zone && set({ zone })} />
        </div>
        <Field label={s.editor.displayZone}>
          <Segmented
            value={ev.displayZone}
            options={[
              { value: 'event', label: s.editor.displayEvent },
              { value: 'device', label: s.editor.displayDevice },
            ]}
            onChange={(v) => set({ displayZone: v })}
          />
        </Field>
        {(ev.preset === 'service' || ev.readouts.some((r) => r.style === 'percent') || d.spanStart) && (
          <Field label={s.editor.spanStart} hint={s.editor.spanStartHint}>
            <input class="input" type="date" value={d.spanStart} onInput={(e) => setDraft({ spanStart: (e.target as HTMLInputElement).value })} />
          </Field>
        )}
      </Section>

      <Section title={s.editor.counting}>
        <Field label={s.editor.repeat}>
          <Select
            value={ev.repeat}
            options={[
              { value: 'none', label: s.editor.repeatNone },
              { value: 'yearly', label: s.editor.repeatYearly },
              ...(isLunarCal ? [] : [{ value: 'monthly' as const, label: s.editor.repeatMonthly }]),
            ]}
            onChange={(v) => set({ repeat: v })}
          />
        </Field>
        <Field label={s.editor.direction}>
          <Select
            value={ev.direction}
            options={[
              { value: 'auto', label: s.editor.directionAuto },
              { value: 'down', label: s.editor.directionDown },
              { value: 'up', label: s.editor.directionUp },
            ]}
            onChange={(v) => set({ direction: v })}
          />
        </Field>
        {ev.direction === 'down' && ev.repeat === 'none' && (
          <Field label={s.editor.endBehavior}>
            <Select
              value={ev.endBehavior}
              options={[
                { value: 'flip', label: s.editor.endFlip },
                { value: 'archive', label: s.editor.endArchive },
                { value: 'stop', label: s.editor.endStop },
              ]}
              onChange={(v) => set({ endBehavior: v })}
            />
          </Field>
        )}
        <Toggle label={s.editor.dayOne} hint={s.editor.dayOneHint} checked={ev.dayOne} onChange={(v) => set({ dayOne: v })} />
        <Toggle label={s.editor.inclusiveEnd} hint={s.editor.inclusiveEndHint} checked={ev.inclusiveEnd} onChange={(v) => set({ inclusiveEnd: v })} />
      </Section>

      <ReadoutsEditor readouts={ev.readouts} repeat={ev.repeat !== 'none'} onChange={(readouts) => set({ readouts })} />
      <MilestonesEditor rules={ev.milestones} onChange={(milestones) => set({ milestones })} />
      <RemindersEditor reminders={ev.reminders} onChange={(reminders) => set({ reminders })} />

      <CounterEditor counter={ev.counter} onChange={(counter) => set({ counter })} />

      <Section title={s.editor.appearance}>
        <Toggle label={s.editor.private} hint={s.editor.privateHint} checked={ev.private} onChange={(v) => set({ private: v })} />
      </Section>

      <Section title={s.editor.notes}>
        <textarea class="input" rows={4} value={ev.notes} onInput={(e) => set({ notes: (e.target as HTMLTextAreaElement).value })} aria-label={s.editor.notes} />
        <Field label={s.editor.tags}>
          <input class="input" value={d.tags} placeholder={s.editor.tagsPlaceholder} onInput={(e) => setDraft({ tags: (e.target as HTMLInputElement).value })} />
        </Field>
      </Section>

      <div class="editor-footer">
        <button class="btn primary wide" onClick={save}>
          {s.common.save}
        </button>
        {!isNew && (
          <button
            class="btn danger wide"
            onClick={async () => {
              if (await deleteWithConfirm(ev)) go('', true);
            }}
          >
            {s.common.delete}
          </button>
        )}
      </div>
    </div>
  );
}

function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function ReadoutsEditor(props: { readouts: Readout[]; repeat: boolean; onChange: (r: Readout[]) => void }) {
  const s = t.value;
  const styles: ReadoutStyle[] = ['dday', 'units', 'age', 'percent', 'gestation', 'business', 'counter'];
  const upd = (i: number, patch: Partial<Readout>) => props.onChange(props.readouts.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Section title={s.editor.display}>
      <p class="field-hint">{s.editor.displayHint}</p>
      {props.readouts.map((r, i) => (
        <div class="item-card" key={r.id}>
          <div class="item-head">
            <Select value={r.style} ariaLabel={s.editor.style} options={styles.map((x) => ({ value: x, label: s.editor.styles[x] }))} onChange={(v) => upd(i, { style: v, units: v === 'units' && !r.units.length ? ['days'] : r.units })} />
            <div class="item-tools">
              <button class="icon-btn small" aria-label={s.common.moveUp} disabled={i === 0} onClick={() => props.onChange(move(props.readouts, i, -1))}>
                <Icon name="up" size={18} />
              </button>
              <button class="icon-btn small" aria-label={s.common.moveDown} disabled={i === props.readouts.length - 1} onClick={() => props.onChange(move(props.readouts, i, 1))}>
                <Icon name="down" size={18} />
              </button>
              <button class="icon-btn small" aria-label={s.common.remove} onClick={() => props.onChange(props.readouts.filter((_, j) => j !== i))}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          </div>
          {r.style === 'units' && (
            <>
              <div class="unit-chips">
                {UNITS.map((u: Unit) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={r.units.includes(u)}
                    class={'chip-btn' + (r.units.includes(u) ? ' on' : '')}
                    onClick={() => {
                      const has = r.units.includes(u);
                      const units = has ? r.units.filter((x) => x !== u) : UNITS.filter((x) => x === u || r.units.includes(x));
                      if (units.length) upd(i, { units });
                    }}
                  >
                    {s.units[u][1]}
                  </button>
                ))}
              </div>
              <div class="two">
                <Field label={s.editor.rounding}>
                  <Select value={r.rounding} options={(['floor', 'round', 'ceil'] as const).map((x) => ({ value: x, label: s.editor.roundings[x] }))} onChange={(v) => upd(i, { rounding: v })} />
                </Field>
                {props.repeat && (
                  <Field label={s.editor.basis}>
                    <Select
                      value={r.basis}
                      options={[
                        { value: 'target', label: s.editor.basisTarget },
                        { value: 'origin', label: s.editor.basisOrigin },
                      ]}
                      onChange={(v) => upd(i, { basis: v })}
                    />
                  </Field>
                )}
              </div>
            </>
          )}
          {r.style === 'dday' && props.repeat && (
            <Field label={s.editor.basis}>
              <Select
                value={r.basis}
                options={[
                  { value: 'target', label: s.editor.basisTarget },
                  { value: 'origin', label: s.editor.basisOrigin },
                ]}
                onChange={(v) => upd(i, { basis: v })}
              />
            </Field>
          )}
        </div>
      ))}
      <button class="btn ghost" onClick={() => props.onChange([...props.readouts, readout('units', ['days'])])}>
        <Icon name="plus" size={18} /> {s.editor.addReadout}
      </button>
    </Section>
  );
}

function newRule(type: MilestoneType): MilestoneRule {
  switch (type) {
    case 'every-n-days':
      return rule({ type, n: 100, limit: 30, notify: true });
    case 'couple':
      return rule({ type, tutu: false, notify: true });
    case 'monthly':
      return rule({ type, limit: 24, notify: false });
    case 'long-life':
      return rule({ type, tradition: 'ko', notify: true });
    case 'custom-day':
      return rule({ type, day: 1000, label: '', notify: true });
    case 'wedding':
      return rule({ type, names: 'auto', notify: true });
    case 'span-months':
      return rule({ type, steps: [{ months: 6, label: '' }], notify: true });
    default:
      return rule({ type, notify: true } as never);
  }
}

function MilestonesEditor(props: { rules: MilestoneRule[]; onChange: (r: MilestoneRule[]) => void }) {
  const s = t.value;
  const m = s.milestones;
  const types: MilestoneType[] = ['couple', 'baby', 'yearly', 'round-days', 'every-n-days', 'monthly', 'long-life', 'wedding', 'span-months', 'custom-day'];
  const upd = (i: number, patch: Partial<MilestoneRule>) => props.onChange(props.rules.map((r, j) => (j === i ? ({ ...r, ...patch } as MilestoneRule) : r)));
  const num = (v: string, min: number) => Math.max(min, Math.floor(Number(v) || min));
  return (
    <Section title={m.title}>
      {props.rules.map((r, i) => (
        <div class="item-card" key={r.id}>
          <div class="item-head">
            <strong>{m.rules[r.type]}</strong>
            <div class="item-tools">
              <button class="icon-btn small" aria-label={s.common.remove} onClick={() => props.onChange(props.rules.filter((_, j) => j !== i))}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          </div>
          {r.type === 'couple' && <Toggle label={m.tutuOption} checked={r.tutu} onChange={(v) => upd(i, { tutu: v })} />}
          {r.type === 'every-n-days' && (
            <div class="two">
              <Field label={m.everyN}>
                <input class="input" type="number" min={1} value={r.n} onInput={(e) => upd(i, { n: num((e.target as HTMLInputElement).value, 1) })} />
              </Field>
              <Field label={m.limit}>
                <input class="input" type="number" min={1} max={1000} value={r.limit} onInput={(e) => upd(i, { limit: num((e.target as HTMLInputElement).value, 1) })} />
              </Field>
            </div>
          )}
          {r.type === 'monthly' && (
            <Field label={m.upToMonths}>
              <input class="input" type="number" min={1} max={1200} value={r.limit} onInput={(e) => upd(i, { limit: num((e.target as HTMLInputElement).value, 1) })} />
            </Field>
          )}
          {r.type === 'long-life' && (
            <Field label={m.tradition}>
              <Segmented
                value={r.tradition}
                options={[
                  { value: 'ko', label: m.traditionKo },
                  { value: 'ja', label: m.traditionJa },
                ]}
                onChange={(v) => upd(i, { tradition: v })}
              />
            </Field>
          )}
          {r.type === 'wedding' && (
            <Field label={m.names}>
              <Select
                value={r.names ?? 'auto'}
                options={[
                  { value: 'auto', label: m.namesAuto },
                  { value: 'en', label: m.namesEn },
                  { value: 'ko', label: m.namesKo },
                  { value: 'ja', label: m.namesJa },
                  { value: 'zh', label: m.namesZh },
                ]}
                onChange={(v) => upd(i, { names: v })}
              />
            </Field>
          )}
          {r.type === 'span-months' && (
            <div class="steps">
              <p class="field-hint">{m.stepsHint}</p>
              {r.steps.map((step, j) => (
                <div class="step-row" key={j}>
                  <input
                    class="input narrow"
                    type="number"
                    min={1}
                    aria-label={m.stepMonths}
                    value={step.months}
                    onInput={(e) => upd(i, { steps: r.steps.map((x, k) => (k === j ? { ...x, months: num((e.target as HTMLInputElement).value, 1) } : x)) })}
                  />
                  <span class="muted">{m.stepMonths}</span>
                  <input
                    class="input"
                    aria-label={m.stepLabel}
                    placeholder={m.stepLabel}
                    value={step.label}
                    onInput={(e) => upd(i, { steps: r.steps.map((x, k) => (k === j ? { ...x, label: (e.target as HTMLInputElement).value } : x)) })}
                  />
                  <button class="icon-btn small" aria-label={s.common.remove} onClick={() => upd(i, { steps: r.steps.filter((_, k) => k !== j) })}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              ))}
              <button class="btn ghost small" onClick={() => upd(i, { steps: [...r.steps, { months: (r.steps[r.steps.length - 1]?.months ?? 0) + 6, label: '' }] })}>
                <Icon name="plus" size={16} /> {m.addStep}
              </button>
            </div>
          )}
          {r.type === 'custom-day' && (
            <div class="two">
              <Field label={m.dayCount}>
                <input class="input" type="number" min={1} value={r.day} onInput={(e) => upd(i, { day: num((e.target as HTMLInputElement).value, 1) })} />
              </Field>
              <Field label={m.label}>
                <input class="input" value={r.label} onInput={(e) => upd(i, { label: (e.target as HTMLInputElement).value })} />
              </Field>
            </div>
          )}
          <Toggle label={m.notify} checked={r.notify} onChange={(v) => upd(i, { notify: v })} />
        </div>
      ))}
      <select
        class="input"
        value=""
        aria-label={m.addRule}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value as MilestoneType;
          if (v) props.onChange([...props.rules, newRule(v)]);
          (e.target as HTMLSelectElement).value = '';
        }}
      >
        <option value="">＋ {m.addRule}</option>
        {types.map((x) => (
          <option key={x} value={x}>
            {m.rules[x]}
          </option>
        ))}
      </select>
    </Section>
  );
}

function RemindersEditor(props: { reminders: Reminder[]; onChange: (r: Reminder[]) => void }) {
  const s = t.value;
  const e = s.editor;
  const upd = (i: number, patch: Partial<Reminder>) => props.onChange(props.reminders.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Section title={e.reminders}>
      <p class="field-hint">{e.remindersHint}</p>
      {props.reminders.map((r, i) => (
        <div class="item-card reminder" key={r.id}>
          <Select
            value={r.target}
            ariaLabel={e.reminderTarget}
            options={[
              { value: 'event', label: e.reminderEvent },
              { value: 'milestones', label: e.reminderMilestones },
            ]}
            onChange={(v) => upd(i, { target: v })}
          />
          <label class="inline">
            <input
              class="input narrow"
              type="number"
              min={0}
              max={365}
              value={r.daysBefore}
              aria-label={e.daysBefore}
              onInput={(ev) => upd(i, { daysBefore: Math.max(0, Math.min(365, Math.floor(Number((ev.target as HTMLInputElement).value) || 0))) })}
            />
            <span>{r.daysBefore === 0 ? e.onTheDay : e.daysBefore}</span>
          </label>
          <input class="input narrow" type="time" value={r.time} aria-label={e.atTime} onInput={(ev) => upd(i, { time: (ev.target as HTMLInputElement).value || '09:00' })} />
          <button class="icon-btn small" aria-label={s.common.remove} onClick={() => props.onChange(props.reminders.filter((_, j) => j !== i))}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
      <button class="btn ghost" onClick={() => props.onChange([...props.reminders, reminder('event', 1)])}>
        <Icon name="plus" size={18} /> {e.addReminder}
      </button>
    </Section>
  );
}

function CounterEditor(props: { counter: Counter | null; onChange: (c: Counter | null) => void }) {
  const s = t.value;
  const c = s.counterUi;
  const cur = props.counter;
  return (
    <Section title={c.title}>
      <Toggle
        label={c.enable}
        hint={c.hint}
        checked={!!cur}
        onChange={(on) => props.onChange(on ? (cur ?? { label: c.defaultLabel, value: 0, step: 1, unit: c.defaultUnit }) : null)}
      />
      {cur && (
        <div class="two">
          <Field label={c.label}>
            <input class="input" value={cur.label} onInput={(e) => props.onChange({ ...cur, label: (e.target as HTMLInputElement).value })} />
          </Field>
          <Field label={c.unit}>
            <input class="input" value={cur.unit} onInput={(e) => props.onChange({ ...cur, unit: (e.target as HTMLInputElement).value })} />
          </Field>
          <Field label={c.step}>
            <input
              class="input"
              type="number"
              min={0.25}
              step={0.25}
              value={cur.step}
              onInput={(e) => props.onChange({ ...cur, step: Math.max(0.25, Number((e.target as HTMLInputElement).value) || 1) })}
            />
          </Field>
        </div>
      )}
    </Section>
  );
}
