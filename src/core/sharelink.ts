// Share events between devices without a server: the events are packed into
// the URL fragment (never sent to any web server), deflate-compressed, and
// optionally encrypted with a passphrase. A QR code of the link lets another
// phone's camera open it.
//
// Format: "#/import/<k><base64url>" where k is 'z' (compressed) or
// 'e' (compressed, then AES-256-GCM with a PBKDF2-SHA256 key; salt 16 bytes,
// IV 12 bytes, 150,000 iterations).

import type { CountEvent } from './types';

export interface SharePayload {
  v: 1;
  events: Partial<CountEvent>[];
}

const ITERATIONS = 150_000;

function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

async function key(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Keeps what the other device needs; drops local-only fields (list, pin, archive). */
export function shareable(ev: CountEvent): Partial<CountEvent> {
  // Ids are re-created on import; leaving them out keeps the QR code small.
  const { id: _i, listId: _l, pinned: _p, archived: _a, createdAt: _c, editedAt: _e, ...rest } = ev;
  void _i, _l, _p, _a, _c, _e;
  const noId = <T extends { id: string }>(x: T) => {
    const { id: _x, ...r } = x;
    void _x;
    return r;
  };
  return {
    ...rest,
    readouts: ev.readouts.map(noId) as CountEvent['readouts'],
    milestones: ev.milestones.map(noId) as CountEvent['milestones'],
    reminders: ev.reminders.map(noId) as CountEvent['reminders'],
  };
}

export async function encodeShare(events: CountEvent[], passphrase?: string): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, events: events.map(shareable) } satisfies SharePayload));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  if (!passphrase) return 'z' + toB64url(packed);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(passphrase, salt), packed as BufferSource));
  const all = new Uint8Array(salt.length + iv.length + ct.length);
  all.set(salt);
  all.set(iv, 16);
  all.set(ct, 28);
  return 'e' + toB64url(all);
}

export function isEncryptedShare(code: string): boolean {
  return code.startsWith('e');
}

/** Throws on a damaged link or a wrong passphrase. */
export async function decodeShare(code: string, passphrase?: string): Promise<SharePayload> {
  let bytes = fromB64url(code.slice(1));
  if (code[0] === 'e') {
    if (!passphrase) throw new Error('passphrase required');
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(passphrase, salt), bytes.slice(28) as BufferSource));
  } else if (code[0] !== 'z') throw new Error('unknown format');
  const json = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
  const payload = JSON.parse(json) as SharePayload;
  if (payload.v !== 1 || !Array.isArray(payload.events)) throw new Error('unknown format');
  return payload;
}
