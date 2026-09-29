import { describe, expect, it } from 'vitest';
import { dataFromFile, decryptBackup, emptyData, encryptBackup, mergeData, toBackup, toCSV, toICS } from './backup';
import { at, ev } from './testutil';
import { Formatter } from '../i18n/format';

const f = new Formatter({ lang: 'en', dateFormat: 'ISO', manGrouping: false, ddayScript: 'latin' });

describe('backup', () => {
  it('round-trips JSON', () => {
    const data = emptyData();
    data.events = [ev('2026-01-01', { preset: 'couple', title: 'Us' })];
    const back = dataFromFile(JSON.parse(JSON.stringify(toBackup(data))));
    expect(back.events).toEqual(data.events);
    expect(back.settings).toEqual(data.settings);
  });
  it('encrypts and decrypts', async () => {
    const data = emptyData();
    data.events = [ev('2026-01-01', { title: '비밀' })];
    const enc = await encryptBackup(data, 'correct horse');
    expect(JSON.stringify(enc)).not.toContain('비밀');
    expect(dataFromFile(await decryptBackup(enc, 'correct horse')).events[0].title).toBe('비밀');
    await expect(decryptBackup(enc, 'wrong')).rejects.toThrow();
  });
  it('repairs partial data', () => {
    const d = dataFromFile({ events: [{ epochMs: 0, title: 'x' }, { title: 'no date' }], settings: { theme: 'dark' } });
    expect(d.events).toHaveLength(1);
    expect(d.events[0].readouts.length).toBeGreaterThan(0);
    expect(d.settings.theme).toBe('dark');
    expect(d.settings.showCountingAge).toBe(true);
  });
  it('merges by last edit', () => {
    const a = emptyData();
    const e = ev('2026-01-01', { title: 'old' });
    a.events = [{ ...e, editedAt: 1 }];
    const b = emptyData();
    b.events = [{ ...e, title: 'new', editedAt: 2 }, ev('2027-01-01')];
    const m = mergeData(a, b);
    expect(m.events).toHaveLength(2);
    expect(m.events.find((x) => x.id === e.id)!.title).toBe('new');
  });
  it('exports ICS and CSV', () => {
    const data = emptyData();
    data.events = [ev('2026-01-01', { preset: 'couple', title: 'Us, forever' })];
    const ics = toICS(data, at('2026-02-01 00:00'), f, 1);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260410');
    expect(ics).toContain('SUMMARY:💑 Us\\, forever · 100 days');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(toCSV(data)).toContain('"Us, forever",2026-01-01');
  });
});
