import { signal } from '@preact/signals';
import type { ThemeMode } from '../core/types';
import { platform } from '../platform';

const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const systemDark = signal(media?.matches ?? false);
media?.addEventListener?.('change', (e) => (systemDark.value = e.matches));

export function resolvedTheme(mode: ThemeMode): 'light' | 'dark' | 'black' {
  if (mode === 'system') return systemDark.value ? 'dark' : 'light';
  return mode;
}

export function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme !== 'light';
}

export function applyTheme(mode: ThemeMode, accent: string | null) {
  const theme = resolvedTheme(mode);
  const root = document.documentElement;
  root.dataset.theme = theme;
  if (accent) root.style.setProperty('--brand', accent);
  const bar = theme === 'black' ? '#000000' : theme === 'dark' ? '#101216' : '#f7f5f2';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar);
  platform.setThemeColors(bar, theme !== 'light');
}
