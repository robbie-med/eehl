import { render } from 'preact';
import { startBackups } from './platform/backups';
import { start } from './state/store';
import { App } from './ui/App';
import './ui/styles.css';

declare const __ANDROID__: boolean;

start();
startBackups();
render(<App />, document.getElementById('app')!);

if (!__ANDROID__ && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('eehl: service worker failed', e));
  });
  navigator.storage?.persist?.().catch(() => undefined);
}
