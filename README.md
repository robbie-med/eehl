# eehl · 일

Count-ups and countdowns that speak East Asian anniversary culture natively: D-day notation, day-one counting, 100-day milestones, lunar (음력 / 农历) birthdays and memorial days, and international plus counting age. One event is one card with many readouts, so you never enter the same date twice.

- **Private by construction.** No accounts, no tracking, no Google services, no network calls. Your events stay on the device.
- **Honest math.** Every number can show how it was computed: time zone, DST, lunar leap-month rule, day-one counting, rounding.
- **Free software** under the GNU GPL v3. No ads, no paid tier, no donations.

The web app (PWA) lives at **https://eehl.robbiemed.org** and installs to the home screen on any phone or computer. A native Android app is planned; see [TODO.md](TODO.md).

## What it does

| | |
| --- | --- |
| Presets | Countdown, Couple (연애), Baby (아기), Birthday, Wedding, Memorial (기일), Exam (수능/高考), Service (전역일). Each sets counting rules, readouts, milestones and reminders in one tap. |
| Readouts | D-day (D-12 / D-Day / D+12), any combination of years, months, weeks, days, hours, minutes and seconds, age (만 나이 + 세는 나이), percent of a span, pregnancy weeks. Tap the number on a card to cycle through them. |
| Milestones | Every 100 days for couples, 백일/돌/满月 for babies, round numbers (1,000 days …), yearly anniversaries on the solar or lunar date, 환갑/칠순/還暦 by counting age, named wedding anniversaries, custom day counts. |
| Calendars | Gregorian, Korean lunar (dangi) and Chinese lunar, 1900–2100, including leap months. Korea and China really do differ (2017: 윤5월 vs 闰六月), so both are separate. |
| Leap months (윤달) | By default, an event whose original date was in a leap month is observed on the regular month (평달), which is the traditional practice. It can be switched per event to use the leap month in years that have one. |
| Calendar extras | The 24 solar terms (절기 / 节气 / 節気), public holidays for Korea, Japan, mainland China, Taiwan, Hong Kong and the US, a working-days readout that skips them, and Japanese era dates (令和8年). |
| Life view | Every week of a life as one square (52 per row, one row per year), with events and milestones plotted on it. |
| Organising | Lists (one level of nesting, per-list sort, default time zone and readout), tags, filter chips, multi-select bulk edit, pin/archive by swipe or long-press, undo for archive and delete. |
| Sharing | Share any event or list with another phone as a QR code. The events travel inside the link (optionally passphrase-encrypted) and are never uploaded. Share cards as images. |
| Import / export | JSON backup (optionally AES-256-GCM encrypted), daily automatic backups (to a folder where the browser allows it, otherwise a daily one-tap reminder), ICS and CSV export, and import from .ics calendars, .csv sheets and .vcf contact birthdays/anniversaries. |
| Privacy | Optional app lock: a passphrase is required to open eehl and the data is encrypted on the device with it. |
| Everything else | Upcoming agenda, per-event time zones, a manual counter on any event (study hours), custom and gradient colors, English, Korean, Japanese, Simplified and Traditional Chinese UI, light/dark/AMOLED black themes. |

## Develop

Requires Node 22.

```sh
npm ci
npm run dev          # local dev server
npm test             # unit tests + golden vectors (vitest)
npm run typecheck
npm run build        # production build in dist/ (+ service worker)
node tests/e2e.mjs   # end-to-end test of ~20 user flows against dist/ (Playwright + Chromium)
npm run screens      # screenshots of the main screens into screens/
```

## Layout

```
src/core/        the counting engine: pure TypeScript, no DOM
  solarterms.ts    24 solar terms from a frozen ephemeris table (solarterm-data.ts)
  holidays.ts      statutory public holidays KR/JP/CN/TW/HK/US, business days
  era.ts           Japanese era (和暦)
  importers.ts     .ics / .csv / .vcf import
  sharelink.ts     events packed into a (optionally encrypted) link for QR sharing
  civil.ts         proleptic Gregorian dates as day numbers
  zone.ts          IANA zones via Intl; DST gaps and overlaps resolved explicitly
  lunar.ts         Korean/Chinese lunar conversion from frozen ICU tables (lunar-data.ts)
  diff.ts          calendar-aware differences in any set of units, with rounding
  count.ts         what an event counts to/from right now, and every readout
  milestones.ts    milestone rules → dated milestones
  schedule.ts      agenda, notification schedule, widget timeline segments
  explain.ts       "how was this computed" lines
  backup.ts        JSON / encrypted backup, ICS and CSV export
  presets.ts       presets and defaults
src/i18n/        en, ko, ja, zh-Hans, zh-Hant strings; pure formatting (numbers, 만/万 grouping, dates)
src/state/       app state (Preact signals), persistence, clock
src/platform/    browser-specific code: files, sharing, notifications, daily backups
src/ui/          screens and components (Preact)
spec/            golden.json, lunar-tables.json, solar-terms.json: the engine's contract for other ports
scripts/         lunar and solar-term table generators, icon generator, service worker builder
tests/           e2e smoke test and screenshot script
```

## Correctness

- `npm test` runs ~60 unit tests: every day from 1900 to 2100 round-trips through both lunar calendars, DST gaps and overlaps, month-end clamping, day-one counting, widget segments against the engine, backups and encryption.
- `spec/golden.json` pins the engine's answers for ~5,000 cases: lunar dates, leap-month anniversaries under both rules, differences with every rounding mode, and 20 event types × 11 moments × 10 readouts. If the engine changes on purpose, regenerate with `UPDATE_GOLDEN=1 npx vitest run golden` and review the diff.
- Lunar tables are generated from ICU by `npm run gen:lunar`, and solar terms from a full ephemeris (PyEphem) by `scripts/gen-solar-terms.py`. The app never asks the runtime for either, so every browser gives the same answer.
- Holidays are statutory rules (including substitute holidays). One-off holidays such as election days, and China/Taiwan make-up workdays, are not included.

## Deploy

GitHub Actions (`.github/workflows/web.yml`) runs the checks on every push and PR, and deploys `dist/` to GitHub Pages from `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**, custom domain `eehl.robbiemed.org`.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
