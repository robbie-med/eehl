import { signal } from '@preact/signals';

export type Route =
  | { name: 'home' }
  | { name: 'event'; id: string }
  | { name: 'new'; preset: string }
  | { name: 'edit'; id: string }
  | { name: 'upcoming' }
  | { name: 'settings' }
  | { name: 'archive' }
  | { name: 'life' }
  | { name: 'import'; code: string };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'event':
      return parts[1] ? { name: 'event', id: parts[1] } : { name: 'home' };
    case 'new':
      return { name: 'new', preset: parts[1] ?? 'custom' };
    case 'edit':
      return parts[1] ? { name: 'edit', id: parts[1] } : { name: 'home' };
    case 'upcoming':
      return { name: 'upcoming' };
    case 'settings':
      return { name: 'settings' };
    case 'archive':
      return { name: 'archive' };
    case 'life':
      return { name: 'life' };
    case 'import':
      return parts[1] ? { name: 'import', code: parts[1] } : { name: 'home' };
    default:
      return { name: 'home' };
  }
}

export const route = signal<Route>(parse(typeof location !== 'undefined' ? location.hash : ''));

// In-app history, so "back" never leaves the app and a deep link falls back home.
const stack: string[] = typeof location !== 'undefined' ? [location.hash || '#/'] : [];

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const h = location.hash || '#/';
    if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
    else stack.push(h);
    route.value = parse(h);
    window.scrollTo(0, 0);
  });
}

export function go(path: string, replace = false) {
  const hash = '#/' + path.replace(/^\//, '');
  if (replace) {
    history.replaceState(null, '', hash);
    stack[stack.length - 1] = hash;
    route.value = parse(hash);
    window.scrollTo(0, 0);
  } else if (location.hash !== hash) location.hash = hash;
}

export function canGoBack(): boolean {
  return stack.length > 1;
}

/** Back within the app, or home when there is no in-app history. */
export function back() {
  if (stack.length > 1) history.back();
  else go('', true);
}
