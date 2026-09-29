// Small shared building blocks: sheets, toasts, icons, form rows.

import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { platform } from '../platform';

// ---------- toast ----------

export const toast = signal<{ text: string; action?: { label: string; run: () => void }; id: number } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, action?: { label: string; run: () => void }) {
  clearTimeout(toastTimer);
  toast.value = { text, action, id: Date.now() };
  toastTimer = setTimeout(() => (toast.value = null), action ? 5000 : 2500);
}

export function Toast() {
  const v = toast.value;
  if (!v) return null;
  return (
    <div class="toast" role="status" key={v.id}>
      <span>{v.text}</span>
      {v.action && (
        <button
          class="toast-action"
          onClick={() => {
            v.action!.run();
            toast.value = null;
          }}
        >
          {v.action.label}
        </button>
      )}
    </div>
  );
}

// ---------- sheet ----------

export function Sheet(props: { open: boolean; onClose: () => void; title?: string; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    const off = platform.onBack(() => {
      props.onClose();
      return true;
    });
    const key = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    document.addEventListener('keydown', key);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      off();
      document.removeEventListener('keydown', key);
      prev?.focus?.();
    };
  }, [props.open]);
  if (!props.open) return null;
  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div
        class={'sheet' + (props.wide ? ' wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="sheet-grip" aria-hidden="true" />
        {props.title && <h2 class="sheet-title">{props.title}</h2>}
        {props.children}
      </div>
    </div>
  );
}

// ---------- confirm ----------

const confirmState = signal<{ text: string; ok: string; resolve: (v: boolean) => void; danger?: boolean } | null>(null);

export function confirmDialog(text: string, ok: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => (confirmState.value = { text, ok, resolve, danger }));
}

export function ConfirmHost(props: { cancel: string }) {
  const c = confirmState.value;
  const done = (v: boolean) => {
    c?.resolve(v);
    confirmState.value = null;
  };
  return (
    <Sheet open={!!c} onClose={() => done(false)}>
      <p class="confirm-text">{c?.text}</p>
      <div class="row-buttons">
        <button class="btn" onClick={() => done(false)}>
          {props.cancel}
        </button>
        <button class={'btn ' + (c?.danger ? 'danger' : 'primary')} onClick={() => done(true)}>
          {c?.ok}
        </button>
      </div>
    </Sheet>
  );
}

// ---------- prompt ----------

const promptState = signal<{ title: string; value: string; ok: string; type?: string; resolve: (v: string | null) => void } | null>(null);

export function promptDialog(title: string, ok: string, value = '', type = 'text'): Promise<string | null> {
  return new Promise((resolve) => (promptState.value = { title, value, ok, type, resolve }));
}

export function PromptHost(props: { cancel: string }) {
  const p = promptState.value;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (p) setTimeout(() => input.current?.focus(), 50);
  }, [p]);
  const done = (v: string | null) => {
    p?.resolve(v);
    promptState.value = null;
  };
  return (
    <Sheet open={!!p} onClose={() => done(null)} title={p?.title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          done(input.current?.value ?? '');
        }}
      >
        <input ref={input} class="input" type={p?.type ?? 'text'} value={p?.value} autocomplete="off" />
        <div class="row-buttons">
          <button type="button" class="btn" onClick={() => done(null)}>
            {props.cancel}
          </button>
          <button type="submit" class="btn primary">
            {p?.ok}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// ---------- icons (inline, stroke-based) ----------

const paths: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  calendar: 'M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-2.2 1.3l-.3 2H10.6l-.3-2a7.6 7.6 0 0 1-2.2-1.3l-1.9.7-2-3.4 1.6-1.2a7.7 7.7 0 0 1 0-2.9L4.2 9.3l2-3.4 1.9.7a7.6 7.6 0 0 1 2.2-1.3l.3-2h3.8l.3 2c.8.3 1.6.8 2.2 1.3l1.9-.7 2 3.4-1.6 1.2c.2 1 .2 1.9 0 2.9z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  back: 'M15 5l-7 7 7 7',
  more: 'M12 6.5h.01M12 12h.01M12 17.5h.01',
  pin: 'M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6',
  archive: 'M4 5h16v4H4zM5.5 9v10h13V9M10 13h4',
  share: 'M12 4v11M7.5 8.5 12 4l4.5 4.5M5 14v6h14v-6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11v5M14 11v5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 6h16M4 12h16M4 18h16',
  chevron: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  close: 'M6 6l12 12M18 6 6 18',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7',
  filter: 'M4 6h16M7 12h10M10 18h4',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  lock: 'M6.5 11h11v9h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  life: 'M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM4 16h4v4H4z',
  sync: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  plusSmall: 'M12 7v10M7 12h10',
  minusSmall: 'M7 12h10',
};

export function Icon(props: { name: keyof typeof paths | string; size?: number; class?: string }) {
  const s = props.size ?? 22;
  return (
    <svg
      class={'icon ' + (props.class ?? '')}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={props.name === 'more' ? 3 : 1.8}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={paths[props.name] ?? ''} />
    </svg>
  );
}

// ---------- form rows ----------

export function Field(props: { label: string; hint?: string; children: ComponentChildren; id?: string }) {
  return (
    <label class="field" for={props.id}>
      <span class="field-label">{props.label}</span>
      {props.children}
      {props.hint && <span class="field-hint">{props.hint}</span>}
    </label>
  );
}

export function Toggle(props: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label class={'toggle-row' + (props.disabled ? ' disabled' : '')}>
      <span class="toggle-text">
        <span>{props.label}</span>
        {props.hint && <span class="field-hint">{props.hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        class="switch"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)}
      />
    </label>
  );
}

export function Select<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      id={props.id}
      class="input"
      value={props.value}
      aria-label={props.ariaLabel}
      onChange={(e) => props.onChange((e.target as HTMLSelectElement).value as T)}
    >
      {props.options.map((o) => (
        <option value={o.value} key={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div class="segmented" role="radiogroup" aria-label={props.ariaLabel}>
      {props.options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          class={props.value === o.value ? 'on' : ''}
          onClick={() => props.onChange(o.value)}
          key={o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section(props: { title?: string; children: ComponentChildren; right?: JSX.Element }) {
  return (
    <section class="section">
      {props.title && (
        <div class="section-head">
          <h2>{props.title}</h2>
          {props.right}
        </div>
      )}
      <div class="section-body">{props.children}</div>
    </section>
  );
}

/** Long-press detection that still lets taps through. */
export function useLongPress(onLong: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(15);
        onLong();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clearTimeout(timer.current);
    },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerCancel: () => clearTimeout(timer.current),
    onContextMenu: (e: Event) => {
      e.preventDefault();
      clearTimeout(timer.current);
      if (!fired.current) onLong();
      fired.current = true;
    },
    /** True if the last press became a long press (swallow the click). */
    wasLong: () => fired.current,
  };
}

// ---------- choice ----------

type Choice = { value: string; label: string; danger?: boolean };
const chooseState = signal<{ title: string; options: Choice[]; resolve: (v: string | null) => void } | null>(null);

export function chooseDialog(title: string, options: Choice[]): Promise<string | null> {
  return new Promise((resolve) => (chooseState.value = { title, options, resolve }));
}

export function ChooseHost(props: { cancel: string }) {
  const c = chooseState.value;
  const done = (v: string | null) => {
    c?.resolve(v);
    chooseState.value = null;
  };
  return (
    <Sheet open={!!c} onClose={() => done(null)} title={c?.title}>
      <div class="button-stack">
        {c?.options.map((o) => (
          <button key={o.value} class={'btn ' + (o.danger ? 'danger' : '')} onClick={() => done(o.value)}>
            {o.label}
          </button>
        ))}
        <button class="btn ghost" onClick={() => done(null)}>
          {props.cancel}
        </button>
      </div>
    </Sheet>
  );
}
