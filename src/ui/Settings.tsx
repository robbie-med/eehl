import { useEffect, useState } from 'preact/hooks';
import {
  dataFromFile,
  decryptBackup,
  encryptBackup,
  isEncrypted,
  toBackup,
  toCSV,
  toICS,
} from '../core/backup';
import { uid } from '../core/presets';
import type { Settings as S } from '../core/types';
import { deviceZone, knownZones } from '../core/zone';
import { Formatter } from '../i18n/format';
import { platform, type PlatformInfo } from '../platform';
import { data, deleteList, fmt, importData, scheduled, settings, t, updateSettings, upsertList } from '../state/store';
import { chooseDialog, confirmDialog, Field, Icon, promptDialog, Section, Select, showToast, Toggle } from './components';
import { colorOf, PALETTE } from './present';
import { isDarkTheme } from './theme';

declare const __APP_VERSION__: string;

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}
let installEvent: InstallPrompt | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPrompt;
  });
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export function Settings() {
  const s = t.value;
  const st = s.settings;
  const f = fmt.value;
  const set = settings.value;
  const [info, setInfo] = useState<PlatformInfo>(() => platform.info());
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [canInstall, setCanInstall] = useState(!!installEvent);
  const up = (p: Partial<S>) => updateSettings(p);

  useEffect(() => {
    const refresh = () => setInfo(platform.info());
    document.addEventListener('visibilitychange', refresh);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    const onPrompt = () => setCanInstall(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  const exportJson = async (encrypted: boolean) => {
    let body: unknown = toBackup(data.value);
    if (encrypted) {
      const pass = await promptDialog(st.passphrase, s.common.save, '', 'password');
      if (!pass) return;
      body = await encryptBackup(data.value, pass);
    }
    const ok = await platform.saveFile(`eehl-backup-${stamp()}${encrypted ? '.encrypted' : ''}.json`, 'application/json', JSON.stringify(body, null, 2));
    if (ok) showToast(st.exported);
  };

  const importJson = async () => {
    const file = await platform.openFile('application/json,.json');
    if (!file) return;
    try {
      let parsed: unknown = JSON.parse(file.text);
      if (isEncrypted(parsed)) {
        const pass = await promptDialog(st.passphrase, s.common.done, '', 'password');
        if (!pass) return;
        try {
          parsed = await decryptBackup(parsed, pass);
        } catch {
          showToast(st.wrongPassphrase);
          return;
        }
      }
      const incoming = dataFromFile(parsed);
      let mode: 'merge' | 'replace' = 'replace';
      if (data.value.events.length > 0) {
        const choice = await chooseDialog(st.importMode, [
          { value: 'merge', label: st.importMerge },
          { value: 'replace', label: st.importReplace, danger: true },
        ]);
        if (!choice) return;
        mode = choice as 'merge' | 'replace';
      }
      importData(incoming, mode);
      showToast(f.t(st.imported, { n: incoming.events.length }));
    } catch (e) {
      showToast(f.t(st.importFailed, { error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const notifLabel = {
    granted: st.notifGranted,
    denied: st.notifDenied,
    default: st.notifDefault,
    unsupported: st.notifUnsupported,
  }[info.notifications];

  const dark = isDarkTheme();

  return (
    <div class="page settings">
      <header class="topbar">
        <h1 class="topbar-title left">{st.title}</h1>
      </header>

      <Section title={st.general}>
        <Field label={st.language}>
          <Select
            value={set.locale}
            options={[
              { value: 'system', label: st.system },
              { value: 'en', label: 'English' },
              { value: 'ko', label: '한국어' },
            ]}
            onChange={(v) => up({ locale: v })}
          />
        </Field>
        <Field label={st.theme}>
          <Select value={set.theme} options={(['system', 'light', 'dark', 'black'] as const).map((x) => ({ value: x, label: st.themes[x] }))} onChange={(v) => up({ theme: v })} />
        </Field>
        <Field label={st.dateFormat}>
          <Select
            value={set.dateFormat}
            options={(['locale', 'DDMMMYYYY', 'ISO', 'YMD'] as const).map((x) => ({ value: x, label: `${st.dateFormats[x]} — ${new Formatter({ ...f.opts, dateFormat: x }).date({ y: 2026, m: 9, d: 28 })}` }))}
            onChange={(v) => up({ dateFormat: v })}
          />
        </Field>
      </Section>

      <Section title={st.cards}>
        <Field label={st.cardMode}>
          <Select value={set.cardMode} options={(['full', 'compact', 'grid'] as const).map((x) => ({ value: x, label: s.cardMode[x] }))} onChange={(v) => up({ cardMode: v })} />
        </Field>
        <Field label={st.sort}>
          <Select value={set.sort} options={(['manual', 'soonest', 'date', 'title'] as const).map((x) => ({ value: x, label: st.sorts[x] }))} onChange={(v) => up({ sort: v })} />
        </Field>
        <Toggle label={st.showDates} checked={set.showDates} onChange={(v) => up({ showDates: v })} />
        <Toggle label={st.showArrows} checked={set.showArrows} onChange={(v) => up({ showArrows: v })} />
        <Toggle label={st.liveSeconds} checked={set.liveSeconds} onChange={(v) => up({ liveSeconds: v })} />
        <Toggle label={st.confirmDelete} checked={set.confirmDelete} onChange={(v) => up({ confirmDelete: v })} />
      </Section>

      <Section title={st.eastAsian}>
        <Toggle label={st.showCountingAge} checked={set.showCountingAge} onChange={(v) => up({ showCountingAge: v })} />
        <Field label={st.leapRule}>
          <Select
            value={set.leapRule}
            options={[
              { value: 'regular', label: s.editor.leapRegular },
              { value: 'leap-when-exists', label: s.editor.leapWhenExists },
            ]}
            onChange={(v) => up({ leapRule: v })}
          />
        </Field>
        <Toggle label={st.manGrouping} checked={set.manGrouping} onChange={(v) => up({ manGrouping: v })} />
        <Field label={st.ddayScript}>
          <Select
            value={set.ddayScript}
            options={[
              { value: 'latin', label: st.ddayLatin },
              { value: 'hangul', label: st.ddayHangul },
            ]}
            onChange={(v) => up({ ddayScript: v })}
          />
        </Field>
      </Section>

      <Section title={st.defaults}>
        <Field label={st.defaultZone}>
          <select class="input" value={set.defaultZone ?? ''} onChange={(e) => up({ defaultZone: (e.target as HTMLSelectElement).value || null })}>
            <option value="">{f.t(st.deviceZone, { zone: deviceZone() })}</option>
            {knownZones().map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title={st.notifications}>
        <div class="kv">
          <span>{st.notifStatus}</span>
          <span>{notifLabel}</span>
        </div>
        {info.notifications !== 'granted' && info.notifications !== 'unsupported' && (
          <button
            class="btn"
            onClick={async () => {
              await platform.requestNotifications();
              setInfo(platform.info());
            }}
          >
            <Icon name="bell" size={18} /> {st.notifAllow}
          </button>
        )}
        {info.kind === 'android' && info.exactAlarms !== null && (
          <div class="kv">
            <span>{st.exactAlarms}</span>
            <span>
              {info.exactAlarms ? st.exactOk : st.exactDenied}
              {!info.exactAlarms && (
                <button class="link" onClick={() => platform.openExactAlarmSettings()}>
                  {' '}
                  {st.exactOpen}
                </button>
              )}
            </span>
          </div>
        )}
        <Toggle label={st.digest} hint={st.digestHint} checked={set.digest.enabled} onChange={(v) => up({ digest: { ...set.digest, enabled: v } })} />
        {set.digest.enabled && (
          <Field label={st.digestTime}>
            <input class="input narrow" type="time" value={set.digest.time} onInput={(e) => up({ digest: { ...set.digest, time: (e.target as HTMLInputElement).value || '08:00' } })} />
          </Field>
        )}
        <p class="field-hint">{f.t(st.scheduled, { n: f.num(scheduled.value.length) })}</p>
        {info.kind === 'web' && <p class="field-hint">{st.webNotifNote}</p>}
      </Section>

      <Section
        title={st.lists}
        right={
          <button
            class="btn ghost small"
            onClick={async () => {
              const name = await promptDialog(st.listName, s.common.add);
              if (name?.trim()) upsertList({ id: uid(), name: name.trim(), color: 'slate', collapsed: false });
            }}
          >
            <Icon name="plus" size={16} /> {st.newList}
          </button>
        }
      >
        {data.value.lists.map((l) => (
          <div class="list-row" key={l.id}>
            <select
              class="color-select"
              aria-label={s.editor.color}
              value={l.color}
              style={{ background: colorOf(l.color, dark) }}
              onChange={(e) => upsertList({ ...l, color: (e.target as HTMLSelectElement).value })}
            >
              {Object.keys(PALETTE).map((c) => (
                <option key={c} value={c}>
                  {s.colors[c]}
                </option>
              ))}
            </select>
            <button
              class="list-name"
              onClick={async () => {
                const name = await promptDialog(st.listName, s.common.save, l.name);
                if (name?.trim()) upsertList({ ...l, name: name.trim() });
              }}
            >
              {l.name} <span class="muted">({data.value.events.filter((e) => e.listId === l.id).length})</span>
            </button>
            <button
              class="icon-btn small"
              aria-label={s.common.delete}
              onClick={async () => {
                if (await confirmDialog(st.deleteList, s.common.delete, true)) deleteList(l.id);
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
      </Section>

      <Section title={st.data}>
        <div class="button-stack">
          <button class="btn" onClick={() => exportJson(false)}>
            {st.exportJson}
          </button>
          <button class="btn" onClick={() => exportJson(true)}>
            {st.exportEncrypted}
          </button>
          <p class="field-hint">{st.passphraseHint}</p>
          <button class="btn" onClick={importJson}>
            {st.importJson}
          </button>
          <button
            class="btn"
            onClick={async () => {
              if (await platform.saveFile(`eehl-${stamp()}.ics`, 'text/calendar', toICS(data.value, Date.now(), f))) showToast(st.exported);
            }}
          >
            {st.exportIcs}
          </button>
          <button
            class="btn"
            onClick={async () => {
              if (await platform.saveFile(`eehl-${stamp()}.csv`, 'text/csv', toCSV(data.value))) showToast(st.exported);
            }}
          >
            {st.exportCsv}
          </button>
        </div>
        {info.kind === 'web' && persisted !== null && (
          <div class="kv">
            <span>{st.storage}</span>
            <span>{persisted ? st.persisted : st.notPersisted}</span>
          </div>
        )}
      </Section>

      {info.kind === 'web' && canInstall && (
        <Section title={st.install}>
          <p class="field-hint">{st.installHint}</p>
          <button
            class="btn primary"
            onClick={async () => {
              await installEvent?.prompt();
              installEvent = null;
              setCanInstall(false);
            }}
          >
            {st.install}
          </button>
        </Section>
      )}

      <Section title={st.about}>
        <div class="about">
          <img src="icons/mark.svg" alt="" width="48" height="48" />
          <div>
            <strong>eehl · 일</strong>
            <p class="muted">{f.t(st.version, { v: info.appVersion ?? __APP_VERSION__ })}</p>
          </div>
        </div>
        <p>{st.privacy}</p>
        {info.kind === 'android' && <p>{st.androidPrivacy}</p>}
        <p>{st.license}</p>
        <p>
          <a href="https://github.com/robbie-med/eehl" target="_blank" rel="noopener">
            {st.source}
          </a>
        </p>
      </Section>
    </div>
  );
}
