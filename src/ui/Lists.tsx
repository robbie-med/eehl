// Lists: nesting (one level), color, and defaults for new events.

import { useState } from 'preact/hooks';
import { uid } from '../core/presets';
import type { EventList, ReadoutStyle, SortOrder, Unit } from '../core/types';
import { data, deleteList, t, upsertList } from '../state/store';
import { confirmDialog, Field, Icon, promptDialog, Section, Select, Sheet } from './components';
import { qrFor } from './Home';
import { ColorPicker, ZonePicker } from './pickers';
import { colorOf } from './present';
import { isDarkTheme } from './theme';

/** Default-readout presets offered for a list. */
export const LIST_READOUTS: { key: string; style: ReadoutStyle; units: Unit[] }[] = [
  { key: 'dday', style: 'dday', units: [] },
  { key: 'days', style: 'units', units: ['days'] },
  { key: 'weeks', style: 'units', units: ['weeks', 'days'] },
  { key: 'ymd', style: 'units', units: ['years', 'months', 'days'] },
  { key: 'business', style: 'business', units: [] },
];

export function newList(name: string, parentId: string | null = null): EventList {
  return { id: uid(), name, color: 'slate', collapsed: false, parentId, defaultReadout: null, defaultZone: null, sort: 'inherit' };
}

/** Lists in display order: each top-level list followed by its children. */
export function orderedLists(lists: EventList[]): { list: EventList; depth: 0 | 1 }[] {
  const out: { list: EventList; depth: 0 | 1 }[] = [];
  for (const l of lists.filter((x) => !x.parentId)) {
    out.push({ list: l, depth: 0 });
    for (const c of lists.filter((x) => x.parentId === l.id)) out.push({ list: c, depth: 1 });
  }
  return out;
}

export function ListsSection() {
  const s = t.value;
  const st = s.settings;
  const [editing, setEditing] = useState<string | null>(null);
  const dark = isDarkTheme();
  const lists = data.value.lists;
  return (
    <Section
      title={st.lists}
      right={
        <button
          class="btn ghost small"
          onClick={async () => {
            const name = await promptDialog(st.listName, s.common.add);
            if (name?.trim()) upsertList(newList(name.trim()));
          }}
        >
          <Icon name="plus" size={16} /> {st.newList}
        </button>
      }
    >
      {lists.length === 0 && <p class="field-hint">{s.home.noList}</p>}
      {orderedLists(lists).map(({ list: l, depth }) => (
        <div class={'list-row' + (depth ? ' child' : '')} key={l.id}>
          <span class="dot big" style={{ background: colorOf(l.color, dark) }} />
          <button class="list-name" onClick={() => setEditing(l.id)}>
            {l.name} <span class="muted">({data.value.events.filter((e) => e.listId === l.id).length})</span>
          </button>
          <button class="icon-btn small" aria-label={s.settingsExtra.edit} onClick={() => setEditing(l.id)}>
            <Icon name="edit" size={18} />
          </button>
        </div>
      ))}
      <ListEditor id={editing} onClose={() => setEditing(null)} />
    </Section>
  );
}

function ListEditor(props: { id: string | null; onClose: () => void }) {
  const s = t.value;
  const x = s.settingsExtra;
  const list = data.value.lists.find((l) => l.id === props.id);
  if (!list) return null;
  const up = (patch: Partial<EventList>) => upsertList({ ...list, ...patch });
  const hasChildren = data.value.lists.some((l) => l.parentId === list.id);
  const parents = data.value.lists.filter((l) => !l.parentId && l.id !== list.id);
  const readoutKey = list.defaultReadout
    ? (LIST_READOUTS.find((r) => r.style === list.defaultReadout!.style && r.units.join() === list.defaultReadout!.units.join())?.key ?? '')
    : '';
  return (
    <Sheet open={!!props.id} onClose={props.onClose} title={x.edit}>
      <Field label={s.settings.listName}>
        <input class="input" value={list.name} onInput={(e) => up({ name: (e.target as HTMLInputElement).value })} />
      </Field>
      <div class="field">
        <span class="field-label">{s.editor.color}</span>
        <ColorPicker value={list.color} onChange={(color) => up({ color })} />
      </div>
      {!hasChildren && (
        <Field label={x.listParent}>
          <Select
            value={list.parentId ?? ''}
            options={[{ value: '', label: x.listTopLevel }, ...parents.map((p) => ({ value: p.id, label: p.name }))]}
            onChange={(v) => up({ parentId: v || null })}
          />
        </Field>
      )}
      <Field label={x.listSort}>
        <Select
          value={list.sort}
          options={[
            { value: 'inherit', label: x.listSortInherit },
            ...(['manual', 'soonest', 'date', 'title'] as SortOrder[]).map((o) => ({ value: o, label: s.settings.sorts[o] })),
          ]}
          onChange={(v) => up({ sort: v as EventList['sort'] })}
        />
      </Field>
      <p class="field-hint">{x.listDefaults}</p>
      <div class="field">
        <span class="field-label">{x.listZone}</span>
        <ZonePicker value={list.defaultZone ?? ''} allowEmpty={s.common.none} onChange={(z) => up({ defaultZone: z || null })} />
      </div>
      <Field label={x.listReadout}>
        <Select
          value={readoutKey}
          options={[
            { value: '', label: s.common.none },
            ...LIST_READOUTS.map((r) => ({
              value: r.key,
              label: r.style === 'units' ? r.units.map((u) => s.units[u][1]).join(' + ') : s.editor.styles[r.style],
            })),
          ]}
          onChange={(v) => {
            const r = LIST_READOUTS.find((x) => x.key === v);
            up({ defaultReadout: r ? { style: r.style, units: r.units } : null });
          }}
        />
      </Field>
      <button
        class="btn"
        disabled={!data.value.events.some((e) => e.listId === list.id)}
        onClick={() => {
          qrFor.value = data.value.events.filter((e) => e.listId === list.id).map((e) => e.id);
          props.onClose();
        }}
      >
        <Icon name="qr" size={18} /> {s.qr.shareList}
      </button>
      <div class="row-buttons">
        <button
          class="btn danger"
          onClick={async () => {
            if (await confirmDialog(s.settings.deleteList, s.common.delete, true)) {
              deleteList(list.id);
              props.onClose();
            }
          }}
        >
          <Icon name="trash" size={18} /> {s.common.delete}
        </button>
        <button class="btn primary" onClick={props.onClose}>
          {s.common.done}
        </button>
      </div>
    </Sheet>
  );
}
