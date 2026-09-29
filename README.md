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
| Other | Upcoming agenda, per-event time zones, lists, pin/archive (swipe or long-press), share as image, JSON backup (optionally AES-256-GCM encrypted), ICS calendar export, CSV export, English and Korean UI, light/dark/AMOLED black themes. |

## Develop

Requires Node 22.

```sh
npm ci
npm run dev          # local dev server
npm test             # unit tests + golden vectors (vitest)
npm run typecheck
npm run build        # production build in dist/ (+ service worker)
node tests/e2e.mjs   # end-to-end smoke test against dist/ (Playwright + Chromium)
npm run screens      # screenshots of the main screens into screens/
```

## Layout

```
src/core/        the counting engine: pure TypeScript, no DOM
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
src/i18n/        English and Korean strings, pure formatting (numbers, 만 grouping, dates)
src/state/       app state (Preact signals), persistence, clock
src/platform/    the only browser-specific code (files, sharing, notifications)
src/ui/          screens and components (Preact)
spec/            golden.json and lunar-tables.json: the engine's contract for other ports
scripts/         lunar table generator, icon generator, service worker builder
tests/           e2e smoke test and screenshot script
```

## Correctness

- `npm test` runs ~60 unit tests: every day from 1900 to 2100 round-trips through both lunar calendars, DST gaps and overlaps, month-end clamping, day-one counting, widget segments against the engine, backups and encryption.
- `spec/golden.json` pins the engine's answers for ~5,000 cases: lunar dates, leap-month anniversaries under both rules, differences with every rounding mode, and 20 event types × 11 moments × 10 readouts. If the engine changes on purpose, regenerate with `UPDATE_GOLDEN=1 npx vitest run golden` and review the diff.
- Lunar tables are generated from ICU by `npm run gen:lunar`. The app never asks the runtime's ICU at run time, so every browser gives the same answer.

## Deploy

GitHub Actions (`.github/workflows/web.yml`) runs the checks on every push and PR, and deploys `dist/` to GitHub Pages from `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**, custom domain `eehl.robbiemed.org`.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
