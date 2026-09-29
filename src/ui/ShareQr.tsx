// QR sharing: a sheet that turns events into a scannable link, and the
// screen that opens such a link and adds the events.

import { useEffect, useState } from 'preact/hooks';
import { encode } from 'uqr';
import { normalizeEvent } from '../core/backup';
import { decodeShare, encodeShare, isEncryptedShare } from '../core/sharelink';
import type { CountEvent } from '../core/types';
import { addEvents, data, fmt, t } from '../state/store';
import { Field, Icon, Sheet, showToast } from './components';
import { qrFor } from './Home';
import { go } from './router';

/** Links longer than this make QR codes too dense to scan reliably from a screen. */
const MAX_LINK = 2200;

export function shareUrl(code: string): string {
  const base = location.href.split('#')[0];
  return `${base}#/import/${code}`;
}

function QrCode(props: { text: string }) {
  const qr = encode(props.text, { ecc: 'L', border: 2 });
  const n = qr.size;
  let d = '';
  qr.data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)));
  return (
    <svg class="qr" viewBox={`0 0 ${n} ${n}`} role="img" aria-label="QR" shape-rendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

export function QrSheet() {
  const s = t.value;
  const q = s.qr;
  const ids = qrFor.value;
  const [pass, setPass] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState('');
  const events = data.value.events.filter((e) => ids?.includes(e.id));
  useEffect(() => {
    setLink(null);
    setPass('');
    setError('');
  }, [ids?.join()]);
  const make = async () => {
    const url = shareUrl(await encodeShare(events, pass || undefined));
    if (url.length > MAX_LINK) {
      setError(q.tooBig);
      setLink(null);
    } else {
      setError('');
      setLink(url);
    }
  };
  useEffect(() => {
    if (ids && !pass) void make();
  }, [ids?.join()]);
  const close = () => (qrFor.value = null);
  return (
    <Sheet open={!!ids} onClose={close} title={q.title}>
      <p class="field-hint">{q.hint}</p>
      <p class="qr-names">{events.map((e) => `${e.emoji} ${e.title}`).join(' · ')}</p>
      {link && (
        <div class="qr-wrap">
          <QrCode text={link} />
        </div>
      )}
      {error && <p class="error">{error}</p>}
      <Field label={q.passphrase}>
        <input class="input" type="password" autocomplete="new-password" value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} />
      </Field>
      <div class="row-buttons">
        <button class="btn" onClick={make}>
          <Icon name="qr" size={18} /> {q.make}
        </button>
        {link && (
          <button
            class="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                showToast(q.copied);
              } catch {
                /* clipboard blocked; the QR still works */
              }
            }}
          >
            <Icon name="copy" size={18} /> {q.copy}
          </button>
        )}
        <button class="btn primary" onClick={close}>
          {s.common.done}
        </button>
      </div>
    </Sheet>
  );
}

export function ImportLink(props: { code: string }) {
  const s = t.value;
  const q = s.qr;
  const f = fmt.value;
  const locked = isEncryptedShare(props.code);
  const [pass, setPass] = useState('');
  const [events, setEvents] = useState<CountEvent[] | null>(null);
  const [error, setError] = useState('');
  const open = async () => {
    try {
      const payload = await decodeShare(props.code, pass || undefined);
      const now = Date.now();
      setEvents(payload.events.map((e) => normalizeEvent(e as Record<string, unknown>, now)).filter((e): e is CountEvent => !!e));
      setError('');
    } catch {
      setError(locked ? s.lock.wrong : q.bad);
    }
  };
  useEffect(() => {
    if (!locked) void open();
  }, [props.code]);
  return (
    <div class="page">
      <header class="topbar">
        <button class="icon-btn" aria-label={s.common.close} onClick={() => go('', true)}>
          <Icon name="close" />
        </button>
        <h1 class="topbar-title">{q.importTitle}</h1>
        <span class="icon-btn" />
      </header>
      {locked && !events && (
        <form
          class="section-body pad-y"
          onSubmit={(e) => {
            e.preventDefault();
            void open();
          }}
        >
          <p>{q.locked}</p>
          <input class="input" type="password" autoFocus value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} aria-label={s.lock.passphrase} />
          <div class="row-buttons">
            <button class="btn primary" type="submit">
              {s.lock.unlock}
            </button>
          </div>
        </form>
      )}
      {error && <p class="error center">{error}</p>}
      {events && (
        <>
          <p class="muted">{f.t(q.importBody, { n: events.length })}</p>
          <ul class="import-list">
            {events.map((e) => (
              <li key={e.id}>
                <span class="emoji" aria-hidden="true">
                  {e.emoji}
                </span>
                <span>{e.title}</span>
              </li>
            ))}
          </ul>
          <button
            class="btn primary wide"
            onClick={() => {
              addEvents(events);
              showToast(f.t(s.imports.added, { n: events.length }));
              go('', true);
            }}
          >
            {q.add}
          </button>
        </>
      )}
    </div>
  );
}
