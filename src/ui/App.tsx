import { useEffect } from 'preact/hooks';
import { lang, saveError, settings, t } from '../state/store';
import { platform } from '../platform';
import { ChooseHost, ConfirmHost, Icon, PromptHost, Toast } from './components';
import { Detail } from './Detail';
import { Editor } from './Editor';
import { Home } from './Home';
import { back, canGoBack, go, route } from './router';
import { Settings } from './Settings';
import { applyTheme, systemDark } from './theme';
import { Archive, Upcoming } from './Upcoming';

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
    default:
      page = <Home />;
  }
  const tab = r.name === 'upcoming' ? 'upcoming' : r.name === 'settings' ? 'settings' : r.name === 'home' ? 'home' : null;

  return (
    <div class="app">
      <main id="main">{page}</main>
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
    </div>
  );
}
