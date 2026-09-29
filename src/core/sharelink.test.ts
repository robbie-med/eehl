import { describe, expect, it } from 'vitest';
import { normalizeEvent } from './backup';
import { decodeShare, encodeShare, isEncryptedShare } from './sharelink';
import { ev } from './testutil';

describe('share links', () => {
  it('round-trips events through a compact link', async () => {
    const events = [{ ...ev('2026-01-01', { preset: 'couple', title: '우리 💑' }), listId: 'mine', pinned: true }, ev('1990-10-05', { preset: 'birthday', title: 'Mom' })];
    const code = await encodeShare(events);
    expect(code[0]).toBe('z');
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(900); // fits a QR code comfortably
    const back = await decodeShare(code);
    expect(back.events).toHaveLength(2);
    const e = normalizeEvent(back.events[0] as Record<string, unknown>, 0)!;
    expect(e).toMatchObject({ title: '우리 💑', dayOne: true, listId: null, pinned: false, epochMs: events[0].epochMs });
    expect(e.readouts.every((r) => typeof r.id === 'string' && r.id.length > 0)).toBe(true);
    expect(e.readouts.map((r) => r.style)).toEqual(events[0].readouts.map((r) => r.style));
  });
  it('encrypts with a passphrase', async () => {
    const code = await encodeShare([ev('2026-01-01', { title: 'secret' })], 'pw');
    expect(isEncryptedShare(code)).toBe(true);
    await expect(decodeShare(code)).rejects.toThrow();
    await expect(decodeShare(code, 'nope')).rejects.toThrow();
    expect((await decodeShare(code, 'pw')).events[0].title).toBe('secret');
  });
  it('rejects damaged links', async () => {
    const code = await encodeShare([ev('2026-01-01')]);
    await expect(decodeShare(code.slice(0, 20))).rejects.toThrow();
  });
});
