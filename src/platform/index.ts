// The only place that knows whether we run in a browser (PWA) or inside the
// Android shell. The shell injects `window.EehlAndroid` (a @JavascriptInterface)
// and answers async calls through `window.__eehlNative.resolve`.

import type { ScheduledNotification, WidgetPayload } from '../core/schedule';

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

interface AndroidBridge {
  info(): string;
  setSchedule(json: string): void;
  setWidgets(json: string): void;
  requestNotifications(callId: string): void;
  openExactAlarmSettings(): void;
  saveFile(callId: string, name: string, mime: string, base64: string): void;
  openFile(callId: string, mimes: string): void;
  shareImage(callId: string, name: string, base64: string, text: string): void;
  setThemeColors(statusBar: string, isDark: boolean): void;
  consumeLaunchEvent(): string;
}

export interface PlatformInfo {
  kind: 'android' | 'web';
  notifications: NotifPermission;
  exactAlarms: boolean | null;
  accent: string | null;
  appVersion: string | null;
  sdk: number | null;
}

declare global {
  interface Window {
    EehlAndroid?: AndroidBridge;
    __eehlNative?: {
      resolve(callId: string, json: string): void;
      back(): boolean;
      openEvent(id: string): void;
      refresh(): void;
    };
  }
}

const android = typeof window !== 'undefined' ? window.EehlAndroid : undefined;
const pending = new Map<string, (v: unknown) => void>();
let seq = 0;
const backHandlers: (() => boolean)[] = [];
const openHandlers: ((id: string) => void)[] = [];
const refreshHandlers: (() => void)[] = [];

if (typeof window !== 'undefined') {
  window.__eehlNative = {
    resolve(callId, json) {
      const fn = pending.get(callId);
      pending.delete(callId);
      try {
        fn?.(JSON.parse(json));
      } catch {
        fn?.(null);
      }
    },
    back() {
      for (let i = backHandlers.length - 1; i >= 0; i--) if (backHandlers[i]()) return true;
      return false;
    },
    openEvent(id) {
      openHandlers.forEach((h) => h(id));
    },
    refresh() {
      refreshHandlers.forEach((h) => h());
    },
  };
}

function call<T>(fn: (id: string) => void): Promise<T> {
  const id = `c${++seq}`;
  return new Promise<T>((resolve) => {
    pending.set(id, resolve as (v: unknown) => void);
    fn(id);
  });
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function webNotifPermission(): NotifPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotifPermission;
}

export const platform = {
  kind: (android ? 'android' : 'web') as 'android' | 'web',

  info(): PlatformInfo {
    if (android) {
      try {
        const i = JSON.parse(android.info());
        return { kind: 'android', ...i };
      } catch {
        /* fall through */
      }
    }
    return { kind: 'web', notifications: webNotifPermission(), exactAlarms: null, accent: null, appVersion: null, sdk: null };
  },

  async requestNotifications(): Promise<NotifPermission> {
    if (android) return (await call<{ result: NotifPermission }>((id) => android.requestNotifications(id)))?.result ?? 'denied';
    if (typeof Notification === 'undefined') return 'unsupported';
    return (await Notification.requestPermission()) as NotifPermission;
  },

  openExactAlarmSettings() {
    android?.openExactAlarmSettings();
  },

  setSchedule(list: ScheduledNotification[]) {
    android?.setSchedule(JSON.stringify(list));
  },

  setWidgets(payload: WidgetPayload) {
    android?.setWidgets(JSON.stringify(payload));
  },

  setThemeColors(statusBar: string, isDark: boolean) {
    android?.setThemeColors(statusBar, isDark);
  },

  /** Save a file the user picks a place for. Resolves true when written. */
  async saveFile(name: string, mime: string, content: string | Blob): Promise<boolean> {
    const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
    if (android) {
      const b64 = toBase64(new Uint8Array(await blob.arrayBuffer()));
      return !!(await call<{ ok: boolean }>((id) => android.saveFile(id, name, mime, b64)))?.ok;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  },

  async openFile(accept: string): Promise<{ name: string; text: string } | null> {
    if (android) {
      const r = await call<{ name: string; base64: string } | null>((id) => android.openFile(id, accept));
      if (!r) return null;
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      return { name: r.name, text: new TextDecoder().decode(bytes) };
    }
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = async () => {
        const file = input.files?.[0];
        resolve(file ? { name: file.name, text: await file.text() } : null);
      };
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  },

  async shareImage(blob: Blob, name: string, text: string): Promise<void> {
    if (android) {
      const b64 = toBase64(new Uint8Array(await blob.arrayBuffer()));
      await call((id) => android.shareImage(id, name, b64, text));
      return;
    }
    const file = new File([blob], name, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], text });
        return;
      } catch {
        /* cancelled or failed: fall back to download */
      }
    }
    await platform.saveFile(name, 'image/png', blob);
  },

  consumeLaunchEvent(): string | null {
    return android?.consumeLaunchEvent() || null;
  },

  onBack(handler: () => boolean): () => void {
    backHandlers.push(handler);
    return () => backHandlers.splice(backHandlers.indexOf(handler), 1);
  },

  onOpenEvent(handler: (id: string) => void) {
    openHandlers.push(handler);
  },

  onRefresh(handler: () => void) {
    refreshHandlers.push(handler);
  },

  /** Web only: show a notification now (used while the app is open). */
  async showNotification(title: string, body: string, tag: string) {
    if (android || webNotifPermission() !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png' });
      else new Notification(title, { body, tag });
    } catch {
      /* ignore */
    }
  },
};
