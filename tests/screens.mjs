// Seeds sample events and captures screenshots of the built app (dev aid).
// Usage: npm run build && node tests/screens.mjs [outDir] [lang]
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const out = process.argv[2] ?? 'screens';
const lang = process.argv[3] ?? 'ko';
const theme = process.argv[4] ?? 'light';
mkdirSync(out, { recursive: true });
const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(root, p);
  if (!existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({
  viewport: { width: 400, height: 860 },
  deviceScaleFactor: 2,
  locale: lang === 'ko' ? 'ko-KR' : 'en-US',
  timezoneId: 'Asia/Seoul',
  colorScheme: theme === 'light' ? 'light' : 'dark',
});
await ctx.addInitScript(({ lang, theme }) => {
  // Freeze "now" so screenshots are stable: 2026-09-29 12:00 KST.
  const fixed = Date.UTC(2026, 8, 29, 3, 0, 0);
  const RealDate = Date;
  let offset = fixed - RealDate.now();
  class FakeDate extends RealDate {
    constructor(...a) {
      if (a.length === 0) super(RealDate.now() + offset);
      else super(...a);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = FakeDate;
  if (!localStorage.getItem('eehl:seeded') && window.__SEED__ !== false) {
    localStorage.setItem('eehl:seeded', '1');
    localStorage.setItem('eehl:seed-lang', lang);
    localStorage.setItem('eehl:seed-theme', theme);
  }
}, { lang, theme });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()));
const base = `http://localhost:${port}/`;
await page.goto(base);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/0-empty.png` });

// Seed through the real store by importing a backup-shaped object.
await page.evaluate(({ lang, theme }) => {
  const Z = 'Asia/Seoul';
  const day = (y, m, d) => Date.UTC(y, m - 1, d) - 9 * 3600e3;
  const r = (style, units = [], basis = 'target') => ({ id: Math.random().toString(36).slice(2), style, units, rounding: 'floor', basis });
  const base = { zone: Z, allDay: true, spanStartMs: null, calendar: 'gregorian', lunar: null, leapRule: 'regular', displayZone: 'event', notes: '', listId: null, tags: [], pinned: false, archived: false, private: false, createdAt: 0, editedAt: 0, inclusiveEnd: false, endBehavior: 'flip', direction: 'auto', repeat: 'none', reminders: [] };
  const events = [
    { ...base, id: 'couple', title: lang === 'ko' ? '우리 처음 사귄 날' : 'Us', emoji: '💑', color: 'rose', preset: 'couple', epochMs: day(2025, 12, 25), dayOne: true, pinned: true,
      readouts: [r('dday'), r('units', ['years', 'months', 'days']), r('units', ['weeks', 'days'])],
      milestones: [{ id: 'm1', type: 'couple', tutu: false, notify: true }, { id: 'm2', type: 'yearly', notify: true }] },
    { ...base, id: 'baby', title: lang === 'ko' ? '하린이' : 'Harin', emoji: '👶', color: 'amber', preset: 'baby', epochMs: day(2026, 7, 2), dayOne: true,
      readouts: [r('gestation'), r('dday'), r('units', ['weeks', 'days']), r('units', ['months', 'days'])],
      milestones: [{ id: 'b1', type: 'baby', notify: true }] },
    { ...base, id: 'mom', title: lang === 'ko' ? '엄마 생신' : "Mom's birthday", emoji: '🎂', color: 'orange', preset: 'birthday', epochMs: day(1966, 4, 24), calendar: 'korean-lunar', lunar: { year: 1966, month: 3, day: 5, leap: false }, repeat: 'yearly', dayOne: false,
      readouts: [r('dday'), r('age'), r('units', ['days'], 'origin')],
      milestones: [{ id: 'y', type: 'yearly', notify: true }, { id: 'l', type: 'long-life', tradition: 'ko', notify: true }] },
    { ...base, id: 'exam', title: lang === 'ko' ? '2027 수능' : 'CSAT 2027', emoji: '📝', color: 'sky', preset: 'exam', epochMs: day(2026, 11, 19), direction: 'down', endBehavior: 'archive', dayOne: false,
      readouts: [r('dday'), r('units', ['weeks', 'days']), r('units', ['days', 'hours', 'minutes'])], milestones: [] },
    { ...base, id: 'svc', title: lang === 'ko' ? '전역' : 'Discharge', emoji: '🎖️', color: 'green', preset: 'service', epochMs: day(2027, 3, 14), spanStartMs: day(2025, 9, 15), direction: 'down', dayOne: true,
      readouts: [r('percent'), r('dday'), r('units', ['months', 'days'])], milestones: [] },
    { ...base, id: 'wed', title: lang === 'ko' ? '결혼기념일' : 'Wedding', emoji: '💍', color: 'violet', preset: 'wedding', epochMs: day(2016, 10, 8), repeat: 'yearly', dayOne: false,
      readouts: [r('dday'), r('units', ['years', 'months', 'days'], 'origin')], milestones: [{ id: 'w', type: 'wedding', notify: true }] },
  ];
  const data = { version: 1, events, lists: [], settings: { locale: lang, theme } };
  localStorage.setItem('eehl:data:v1', JSON.stringify(data));
}, { lang, theme });
await page.reload();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/1-home.png`, fullPage: true });
await page.goto(base + '#/event/couple');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/2-detail.png`, fullPage: true });
await page.click('.readout-row >> nth=1');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/3-explain.png` });
await page.goto(base + '#/event/mom');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/4-mom.png`, fullPage: true });
await page.goto(base + '#/upcoming');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/5-upcoming.png`, fullPage: true });
await page.goto(base + '#/new/couple');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/6-editor.png`, fullPage: true });
await page.goto(base + '#/settings');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/7-settings.png`, fullPage: true });
await browser.close();
server.close();
console.log('screens in', out);
