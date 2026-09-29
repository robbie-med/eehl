import { useEffect } from 'preact/hooks';
import { backupNow, dismissReminder, reminderDue } from '../platform/backups';
import { lang, locked, saveError, settings, t } from '../state/store';
import { platform } from '../platform';
import { ChooseHost, ConfirmHost, Icon, PromptHost, Toast } from './components';
import { Detail } from './Detail';
import { Editor } from './Editor';
import { Home, selection } from './Home';
import { back, canGoBack, go, route } from './router';
import { Settings } from './Settings';
import { applyTheme, systemDark } from './theme';
import { Archive, Upcoming } from './Upcoming';
import { Life } from './Life';
import { LockScreen } from './Lock';
import { ImportLink, QrSheet } from './ShareQr';

export function App() {
  const s = t.value;
  const r = route.value;
  const set = settings.value;

  useEffect(() => {
    applyTheme(set.theme, platform.info().accent);
  }, [set.theme, systemDark.value]);

  useEffect(() => {
    document.documentElement.lang = lang.value;
  }, [lang.value]);

  // Leaving Home ends bulk selection.
  useEffect(() => {
    if (r.name !== 'home') selection.value = null;
  }, [r.name]);

  useEffect(() => {
    // Android back button: close sheets first (they register their own
    // handlers), then go back within the app, then let Android close it.
    const off = platform.onBack(() => {
      if (route.value.name === 'home') return false;
      if (canGoBack()) back();
      else go('', true);
      return true;
    });
    platform.onOpenEvent((id) => go(`event/${id}`));
    const launch = platform.consumeLaunchEvent();
    if (launch) go(`event/${launch}`);
    return off;
  }, []);

  let page;
  switch (r.name) {
    case 'event':
      page = <Detail id={r.id} key={r.id} />;
      break;
    case 'new':
      page = <Editor preset={r.preset} key={'new' + r.preset} />;
      break;
    case 'edit':
      page = <Editor id={r.id} key={'edit' + r.id} />;
      break;
    case 'upcoming':
      page = <Upcoming />;
      break;
    case 'settings':
      page = <Settings />;
      break;
    case 'archive':
      page = <Archive />;
      break;
    case 'life':
      page = <Life />;
      break;
    case 'import':
      page = <ImportLink code={r.code} key={r.code} />;
      break;
    default:
      page = <Home />;
  }
  const tab = r.name === 'upcoming' || r.name === 'settings' || r.name === 'home' || r.name === 'life' ? r.name : null;

  if (locked.value) {
    return (
      <div class="app">
        <LockScreen />
        <ConfirmHost cancel={s.common.cancel} />
        <Toast />
      </div>
    );
  }

  return (
    <div class="app">
      <main id="main">{page}</main>
      {reminderDue.value && tab && (
        <div class="banner-backup" role="status">
          <span>{s.backups.banner}</span>
          <button class="btn small primary" onClick={() => backupNow()}>
            {s.backups.now}
          </button>
          <button class="btn small ghost" onClick={dismissReminder}>
            {s.backups.later}
          </button>
        </div>
      )}
      {saveError.value && (
        <p class="error banner" role="alert">
          {s.errors.storage}
        </p>
      )}
      {tab && (
        <nav class="bottom-nav" aria-label="eehl">
          <button class={tab === 'home' ? 'on' : ''} aria-current={tab === 'home' ? 'page' : undefined} onClick={() => go('', true)}>
            <Icon name="home" />
            <span>{s.nav.home}</span>
          </button>
          <button class={tab === 'upcoming' ? 'on' : ''} aria-current={tab === 'upcoming' ? 'page' : undefined} onClick={() => go('upcoming', true)}>
            <Icon name="calendar" />
            <span>{s.nav.upcoming}</span>
          </button>
          <button class={tab === 'life' ? 'on' : ''} aria-current={tab === 'life' ? 'page' : undefined} onClick={() => go('life', true)}>
            <Icon name="life" />
            <span>{s.nav.life}</span>
          </button>
          <button class={tab === 'settings' ? 'on' : ''} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => go('settings', true)}>
            <Icon name="settings" />
            <span>{s.nav.settings}</span>
          </button>
        </nav>
      )}
      <Toast />
      <ConfirmHost cancel={s.common.cancel} />
      <PromptHost cancel={s.common.cancel} />
      <ChooseHost cancel={s.common.cancel} />
      <QrSheet />
    </div>
  );
}
