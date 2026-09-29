// Daily automatic backups.
//
//  - 'folder': where the browser can keep a folder handle (File System Access
//    API: Chrome/Edge on desktop), a dated file eehl-backup-YYYYMMDD.json is
//    written into the chosen folder once a day while eehl is open.
//  - 'reminder': elsewhere (phones, Safari, Firefox), a banner offers a
//    one-tap backup once a day.
//
// Backups are encrypted with the app-lock passphrase when app lock is on.

import { signal } from '@preact/signals';
import { encryptWithKey, toBackup } from '../core/backup';
import { data, locked, sessionKey } from '../state/store';
import { platform } from '.';

export type BackupMode = 'off' | 'folder' | 'reminder';

export interface BackupState {
  mode: BackupMode;
  folderName: string | null;
  lastBackup: number | null;
  lastError: string | null;
}

const KEY = 'eehl:backups:v1';
const EMPTY: BackupState = { mode: 'off', folderName: null, lastBackup: null, lastError: null };

function loadState(): BackupState {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...EMPTY };
  }
}

export const backupState = signal<BackupState>(loadState());

function save(patch: Partial<BackupState>) {
  backupState.value = { ...backupState.value, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(backupState.value));
  } catch {
    /* ignore */
  }
}

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
};

export const folderSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window && platform.kind === 'web';

// ---------- IndexedDB (folder handles survive reloads only there) ----------

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('eehl', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putFolder(h: DirHandle | null) {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    if (h) tx.objectStore('handles').put(h, 'backup-folder');
    else tx.objectStore('handles').delete('backup-folder');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getFolder(): Promise<DirHandle | null> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const req = db.transaction('handles').objectStore('handles').get('backup-folder');
      req.onsuccess = () => resolve((req.result as DirHandle) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ---------- backups ----------

function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function backupFileName(ms = Date.now()): string {
  return `eehl-backup-${localDay(ms)}.json`;
}

/** The backup file's contents: encrypted when app lock is on. */
export async function backupText(): Promise<string> {
  const key = sessionKey();
  return key ? JSON.stringify(await encryptWithKey(data.value, key)) : JSON.stringify(toBackup(data.value), null, 1);
}

export function isDue(now = Date.now()): boolean {
  const s = backupState.value;
  if (s.mode === 'off' || locked.value || data.value.events.length === 0) return false;
  return !s.lastBackup || localDay(s.lastBackup) !== localDay(now);
}

/** A reminder banner should show (reminder mode, not yet backed up today). */
export const reminderDue = signal(false);

export async function chooseFolder(): Promise<boolean> {
  const w = window as Window & { showDirectoryPicker?: (o?: unknown) => Promise<DirHandle> };
  if (!w.showDirectoryPicker) return false;
  try {
    const h = await w.showDirectoryPicker({ mode: 'readwrite', id: 'eehl-backups' });
    await putFolder(h);
    save({ mode: 'folder', folderName: h.name, lastBackup: null, lastError: null });
    return await backupToFolder(true);
  } catch {
    return false;
  }
}

async function backupToFolder(interactive: boolean): Promise<boolean> {
  const dir = await getFolder();
  if (!dir) return false;
  try {
    let perm = (await dir.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (perm !== 'granted' && interactive) perm = (await dir.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
    if (perm !== 'granted') return false;
    const fh = await dir.getFileHandle(backupFileName(), { create: true });
    const w = await fh.createWritable();
    await w.write(await backupText());
    await w.close();
    save({ lastBackup: Date.now(), lastError: null });
    return true;
  } catch (e) {
    save({ lastError: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/** One-tap backup (reminder banner, or "Back up now"): saves through the normal file dialog/download. */
export async function backupNow(): Promise<boolean> {
  if (backupState.value.mode === 'folder' && (await backupToFolder(true))) return true;
  const ok = await platform.saveFile(backupFileName(), 'application/json', await backupText());
  if (ok) save({ lastBackup: Date.now(), lastError: null });
  reminderDue.value = isDue();
  return ok;
}

export function setMode(mode: BackupMode) {
  if (mode !== 'folder') void putFolder(null).catch(() => undefined);
  save({ mode, folderName: mode === 'folder' ? backupState.value.folderName : null });
  reminderDue.value = isDue() && mode === 'reminder';
}

export function dismissReminder() {
  // Snooze until tomorrow without claiming a backup was made.
  reminderDue.value = false;
}

async function tick() {
  if (!isDue()) {
    reminderDue.value = false;
    return;
  }
  if (backupState.value.mode === 'folder') await backupToFolder(false);
  else if (backupState.value.mode === 'reminder') reminderDue.value = true;
}

export function startBackups() {
  setTimeout(() => void tick(), 2000);
  setInterval(() => document.visibilityState === 'visible' && void tick(), 30 * 60_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void tick());
}
