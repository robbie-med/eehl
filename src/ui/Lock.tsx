// App lock: settings section and the lock screen.

import { useState } from 'preact/hooks';
import { disableLock, enableLock, lockNow, resetAll, settings, t, unlock, updateSettings } from '../state/store';
import { confirmDialog, Field, Icon, Section, Select, showToast } from './components';

const AUTO_LOCK = [0, 1, 5, 15, 60];

export function LockSection() {
  const s = t.value;
  const l = s.lock;
  const lock = settings.value.lock;
  const [setting, setSetting] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const minutes = (n: number) => (n === 0 ? l.immediately : s.lock.minutes.replace('{n}', String(n)));

  return (
    <Section title={l.title}>
      <p class="field-hint">{l.hint}</p>
      {!lock.enabled && !setting && (
        <button class="btn" onClick={() => setSetting(true)}>
          <Icon name="lock" size={18} /> {l.enable}
        </button>
      )}
      {!lock.enabled && setting && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (a.length < 4) return setError(l.tooShort);
            if (a !== b) return setError(l.mismatch);
            setBusy(true);
            await enableLock(a, lock.autoLockMinutes);
            setBusy(false);
            setSetting(false);
            setA('');
            setB('');
            setError('');
          }}
        >
          <Field label={l.passphrase}>
            <input class="input" type="password" autocomplete="new-password" value={a} onInput={(e) => setA((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label={l.confirm}>
            <input class="input" type="password" autocomplete="new-password" value={b} onInput={(e) => setB((e.target as HTMLInputElement).value)} />
          </Field>
          {error && <p class="error">{error}</p>}
          <div class="row-buttons">
            <button type="button" class="btn" onClick={() => setSetting(false)}>
              {s.common.cancel}
            </button>
            <button type="submit" class="btn primary" disabled={busy}>
              {l.enable}
            </button>
          </div>
        </form>
      )}
      {lock.enabled && (
        <>
          <Field label={l.after}>
            <Select
              value={String(lock.autoLockMinutes)}
              options={AUTO_LOCK.map((n) => ({ value: String(n), label: minutes(n) }))}
              onChange={(v) => updateSettings({ lock: { ...lock, autoLockMinutes: Number(v) } })}
            />
          </Field>
          <div class="button-stack">
            <button class="btn" onClick={() => lockNow()}>
              <Icon name="lock" size={18} /> {l.lockNow}
            </button>
            <button class="btn danger" onClick={() => disableLock()}>
              {l.disable}
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

export function LockScreen() {
  const s = t.value;
  const l = s.lock;
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div class="lock-screen">
      <form
        class="lock-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await unlock(pass);
            setPass('');
            setError('');
          } catch {
            setError(l.wrong);
          } finally {
            setBusy(false);
          }
        }}
      >
        <img src="icons/mark.svg" alt="" width="64" height="64" />
        <h1>{l.unlockTitle}</h1>
        <input
          class="input"
          type="password"
          autoFocus
          autocomplete="current-password"
          aria-label={l.passphrase}
          placeholder={l.passphrase}
          value={pass}
          onInput={(e) => setPass((e.target as HTMLInputElement).value)}
        />
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button class="btn primary wide" type="submit" disabled={busy || !pass}>
          <Icon name="lock" size={18} /> {l.unlock}
        </button>
        <details class="lock-forgot">
          <summary>{l.reset}</summary>
          <p class="field-hint">{l.forgot}</p>
          <button
            type="button"
            class="btn danger"
            onClick={async () => {
              if (await confirmDialog(l.resetConfirm, l.reset, true)) {
                resetAll();
                showToast(l.reset);
              }
            }}
          >
            {l.reset}
          </button>
        </details>
      </form>
    </div>
  );
}
