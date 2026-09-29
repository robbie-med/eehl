// Color (palette, custom hex, gradient), emoji and time zone pickers.

import { useMemo, useState } from 'preact/hooks';
import { deviceZone, formatOffset, knownZones, offsetAt } from '../core/zone';
import { fmt, t } from '../state/store';
import { colorOf, parseColor, PALETTE } from './present';
import { isDarkTheme } from './theme';

// ---------- color ----------

export function ColorPicker(props: { value: string; onChange: (v: string) => void }) {
  const s = t.value;
  const f = fmt.value;
  const dark = isDarkTheme();
  const { a, b } = parseColor(props.value);
  const [gradient, setGradient] = useState(!!b);
  const hexA = colorOf(a, dark);
  const hexB = b ? colorOf(b, dark) : hexA;
  const emit = (first: string, second: string | null) => props.onChange(second ? `grad:${first},${second}` : first);
  const named = Object.keys(PALETTE);
  return (
    <div class="color-picker">
      <div class="swatches" role="radiogroup" aria-label={s.editor.color}>
        {named.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={a === c}
            aria-label={f.t(s.a11y.color, { name: s.colors[c] })}
            class={'swatch' + (a === c ? ' on' : '')}
            style={{ background: colorOf(c, dark) }}
            onClick={() => emit(c, gradient ? (b ?? 'violet') : null)}
          />
        ))}
        <label class={'swatch custom' + (!named.includes(a) ? ' on' : '')} title={s.pickers.custom}>
          <input type="color" value={hexA} aria-label={s.pickers.custom} onInput={(e) => emit((e.target as HTMLInputElement).value, gradient ? b : null)} />
        </label>
      </div>
      <label class="toggle-row">
        <span>{s.pickers.gradient}</span>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          checked={gradient}
          onChange={(e) => {
            const on = (e.target as HTMLInputElement).checked;
            setGradient(on);
            emit(a, on ? (b ?? 'violet') : null);
          }}
        />
      </label>
      {gradient && (
        <div class="swatches" role="radiogroup" aria-label={s.pickers.secondColor}>
          {named.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={b === c}
              aria-label={f.t(s.a11y.color, { name: s.colors[c] })}
              class={'swatch' + (b === c ? ' on' : '')}
              style={{ background: colorOf(c, dark) }}
              onClick={() => emit(a, c)}
            />
          ))}
          <label class={'swatch custom' + (b && !named.includes(b) ? ' on' : '')} title={s.pickers.custom}>
            <input type="color" value={hexB} aria-label={s.pickers.secondColor} onInput={(e) => emit(a, (e.target as HTMLInputElement).value)} />
          </label>
        </div>
      )}
    </div>
  );
}

// ---------- emoji ----------

const EMOJI: Record<string, string[]> = {
  love: ['💑', '💏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '💕', '💞', '💘', '💍', '💐', '🌹', '💌', '🫶'],
  people: ['👶', '🍼', '🧒', '👧', '👦', '👩', '👨', '👵', '👴', '🤰', '👪', '🧑‍🎓', '👩‍⚕️', '🧑‍⚕️', '🪖', '🧑‍🍳', '🧑‍💻', '🙏'],
  celebrate: ['🎂', '🎉', '🎊', '🥳', '🎁', '🎈', '🎄', '🎃', '🧧', '🏮', '🎎', '🎏', '🎑', '🕯️', '🎆', '🎇', '🪅', '🍾'],
  nature: ['🌸', '🌷', '🌻', '🍀', '🌿', '🍁', '🍂', '🌙', '☀️', '⭐', '🌈', '❄️', '🌊', '⛰️', '🐶', '🐱', '🐰', '🐣'],
  food: ['🍰', '🧁', '🍜', '🍚', '🍙', '🍱', '🥟', '🍵', '☕', '🍷', '🍺', '🍓', '🍑', '🍊', '🥭', '🍡', '🥮', '🍗'],
  activity: ['📝', '📚', '🎓', '💪', '🏃', '🧘', '⚽', '⛳', '🎾', '🏊', '🚴', '🎹', '🎸', '🎨', '🎮', '🏆', '🥇', '🎯'],
  travel: ['✈️', '🧳', '🏖️', '🗼', '🗻', '⛩️', '🏯', '🚅', '🚗', '🚢', '🏕️', '🗺️', '🏠', '🏡', '🏥', '🏫', '🏢', '🌏'],
  objects: ['📅', '⏰', '⌛', '📌', '💼', '💊', '🩺', '💉', '🔑', '📷', '💻', '📱', '🎖️', '🪪', '💰', '🧾', '✉️', '🔔'],
  symbols: ['✨', '💫', '🔥', '💯', '✅', '❗', '❓', '♾️', '☯️', '🕊️', '⚕️', '🔆', '🆕', '🔜', '🎌', '🇰🇷', '🇯🇵', '🇨🇳'],
};

export function EmojiPicker(props: { value: string; onChange: (v: string) => void }) {
  const s = t.value;
  const [cat, setCat] = useState('love');
  return (
    <div class="emoji-picker">
      <input
        class="input emoji-input"
        value={props.value}
        maxLength={16}
        placeholder={s.pickers.emojiSearch}
        aria-label={s.pickers.emojiSearch}
        onInput={(e) => props.onChange((e.target as HTMLInputElement).value)}
      />
      <div class="emoji-cats" role="tablist">
        {Object.keys(EMOJI).map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} class={'chip-btn small' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
            {s.pickers.emojiCats[c]}
          </button>
        ))}
      </div>
      <div class="emoji-picks" role="tabpanel">
        {EMOJI[cat].map((e) => (
          <button key={e} type="button" class={'emoji-pick' + (props.value === e ? ' on' : '')} onClick={() => props.onChange(e)} aria-label={e}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- time zone ----------

export function ZonePicker(props: { value: string; onChange: (v: string) => void; allowEmpty?: string }) {
  const s = t.value;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => knownZones(), []);
  const now = Date.now();
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/\s+/g, '_');
    const found = needle ? zones.filter((z) => z.toLowerCase().includes(needle)) : zones;
    const dev = deviceZone();
    return [...new Set([dev, ...found])].filter((z) => !needle || z.toLowerCase().includes(needle)).slice(0, 60);
  }, [q, zones]);
  const label = (z: string) => `${z.replace(/_/g, ' ')} · ${formatOffset(offsetAt(now, z))}`;
  return (
    <div class="zone-picker">
      <button type="button" class="input zone-current" aria-expanded={open} onClick={() => setOpen(!open)}>
        {props.value ? label(props.value) : (props.allowEmpty ?? '')}
      </button>
      {open && (
        <div class="zone-pop">
          <input class="input" type="search" autoFocus placeholder={s.pickers.zoneSearch} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <ul class="zone-list" role="listbox">
            {props.allowEmpty && (
              <li>
                <button type="button" role="option" aria-selected={!props.value} onClick={() => (props.onChange(''), setOpen(false))}>
                  {props.allowEmpty}
                </button>
              </li>
            )}
            {list.map((z) => (
              <li key={z}>
                <button type="button" role="option" aria-selected={z === props.value} onClick={() => (props.onChange(z), setOpen(false), setQ(''))}>
                  {label(z)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
