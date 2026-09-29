# TODO

State as of this commit: the **web app / PWA is complete**: every spec feature for the web except sync (skipped on purpose). The counting engine is tested and pinned by golden vectors, the UI by an end-to-end test of ~20 flows, and CI and the Pages deploy are set up. The **native Android app is not started**; the plan is below.

---

## 1. Native Android app (Kotlin, no WebView)

Goal: fully native, as light and fast as possible, with every feature of the web app plus what only Android can do (exact reminders, widgets, boot rescheduling). No Google Play Services, no INTERNET permission.

### 1.1 Stack (light and fast)

Recommended, lightest option:

- [ ] **Kotlin + Android framework Views**, no AppCompat, no Compose, no Material Components library. Use `android:Theme.Material` / `Theme.DeviceDefault.DayNight` and draw cards with plain `View`s and `GradientDrawable`s. Target: release APK under 1 MB, cold start under 150 ms.
  - Alternative if you'd rather write UI faster: Jetpack Compose + Material 3 (the original spec). It costs roughly 2–4 MB of APK and a slower first frame. Glance widgets would pull Compose in anyway; with Views, widgets use plain `RemoteViews`.
- [ ] **No libraries you don't need**: `java.time` is built in from API 26 (minSdk 26), so no desugaring. `org.json` is built in, so no kotlinx.serialization. No DI framework, no Room: store data as one JSON file (same format as the web backup), written atomically (`AtomicFile`).
- [ ] Only dependency worth taking: `androidx.core` (for `NotificationCompat`, `AtomicFile`, window insets), and even that is optional.
- [ ] Gradle: AGP 9.x / Gradle 9.x (current as of Sep 2026: AGP 9.4.1, Gradle 9.8.0, Kotlin 2.4.x), compileSdk/targetSdk 37, minSdk 26.
- [ ] R8 full mode, `isShrinkResources = true`, `dependenciesInfo { includeInApk = false; includeInBundle = false }` (F-Droid asks for this).
- [ ] Fail the build if a Google dependency sneaks in:
  ```kotlin
  configurations.all {
      resolutionStrategy.eachDependency {
          require(!requested.group.startsWith("com.google.android.gms") && !requested.group.startsWith("com.google.firebase")) {
              "Google Play Services / Firebase are not allowed: ${requested.group}"
          }
      }
  }
  ```

### 1.2 Port the engine (`core` Gradle module, pure Kotlin/JVM)

Port `src/core/*.ts` file for file into a JVM-only module with no Android imports, so it's unit-testable on the desktop JVM:

| TypeScript | Kotlin | Notes |
| --- | --- | --- |
| `civil.ts` | `Civil.kt` | `LocalDate.toEpochDay()` is the same day number (1970-01-01 = 0). Keep `addMonths` clamping. |
| `zone.ts` | `Zone.kt` | `ZonedDateTime.ofLocal(ldt, zone, null)` resolves gaps forward and overlaps to the earlier instant, the same "compatible" rule. Report gap/overlap via `zone.rules.getValidOffsets(ldt).size` (0 = gap, 2 = overlap). |
| `lunar.ts` + `lunar-data.ts` | `Lunar.kt` | Load `spec/lunar-tables.json` (copy into `res/raw` or embed as a Kotlin array via a generator task). **Do not** use `android.icu` at run time; the frozen table keeps Android and web identical. |
| `diff.ts` | `Diff.kt` | Same decomposition: months together from the start, then calendar days, then exact time; rounding by re-decomposing to the next step. |
| `count.ts` | `Count.kt` | `countState`, `readoutValue`, occurrences, device vs event zone. |
| `milestones.ts` | `Milestones.kt` | Rules → milestones, dedupe by key. |
| `schedule.ts` | `Schedule.kt` | Agenda and notification schedule. Widget segments are not needed natively: the widget can call the engine directly. |
| `explain.ts` | `Explain.kt` | Returns string resource IDs + args. |
| `backup.ts` | `Backup.kt` | **Same JSON format** (`{"app":"eehl","format":1,"data":{…}}`, `AppData` version 1) so backups move between the PWA and Android. Encrypted backups use PBKDF2-SHA256 (310,000 iterations) + AES-256-GCM, via `javax.crypto`. ICS/CSV identical. |
| `presets.ts` | `Presets.kt` | Same defaults. |
| `solarterms.ts` + `solarterm-data.ts` | `SolarTerms.kt` | Load `spec/solar-terms.json` (UTC minutes per term, 1900–2100). |
| `holidays.ts` | `Holidays.kt` | Pure rules; port with its tests (substitute holidays, Japan's citizens' holiday, HK Easter). |
| `era.ts` | `Era.kt` | Five era start dates. |
| `importers.ts` | `Importers.kt` | .ics / .csv / .vcf parsing, same results. |
| `sharelink.ts` | `ShareLink.kt` | Same link format (`#/import/z…` / `e…`, deflate-raw + optional AES-GCM), so a QR from the PWA opens in the Android app and vice versa. Register the web origin as an App Link for `#/import/`. |
| `i18n/format.ts` | `Format.kt` | D-day strings, 만/억 grouping, date formats (DDMMMYYYY, ISO, YYYY.MM.DD, locale). |

- [ ] **Golden test**: a JUnit test that reads `spec/golden.json` and reproduces every case (lunar, anniversaries, diffs, 20 events × 11 moments × 10 readouts, milestones). This is the acceptance criterion for the port. When the web engine changes, the golden file changes and the Kotlin test tells you what to update.
- [ ] Port the unit tests in `src/core/*.test.ts` too (they document the edge cases: Samoa 2011, New York DST, Feb 29, lunar 30th day, 2017 Korea vs China).

### 1.3 App (`app` module)

Screens, matching the web app (`src/ui/*`):

- [ ] **Home**: pinned section, lists (collapsible), cards in full / compact / grid modes; tap the number to cycle readouts; swipe right to pin, left to archive (with undo); long-press menu (pin, edit, share image, duplicate, archive, delete); search; archive link; FAB. Empty state with the 8 preset tiles.
- [ ] **Event detail**: hero with the big readout, all readouts (tap → "how was this computed" bottom sheet), next milestones, timeline (past/today/future), notes, tags.
- [ ] **Editor**: preset chips, title, emoji, 12 colors, list; calendar (solar / 음력 / 农历) with lunar year/month/day + leap toggle (enabled only when that year has that leap month) and the resolved solar date; all-day/time; time zone; display zone; span start; repeat / direction / end behavior / day-one / inclusive end; readouts editor; milestone rules editor; reminders editor; private; notes; tags.
- [ ] **Upcoming**: 30/90/365-day agenda with holiday and solar-term overlays.
- [ ] **Life view**: weeks-of-life grid (a custom `View` drawing on a `Canvas`; see `src/ui/Life.tsx`).
- [ ] Filters (tags, kinds, direction, milestone this month), multi-select bulk edit, nested lists with per-list defaults, delete undo, counter (+/−) on the event page, QR share (`uqr`'s algorithm is ~1k lines; or a small QR encoder in Kotlin) and link import, app lock (encrypted file + `BiometricPrompt`), daily backups to a SAF folder, 5 UI languages (copy `src/i18n/*.ts` into `values-*/strings.xml`).
- [ ] **Settings**: everything in `src/ui/Settings.tsx`, plus exact-alarm status, notification permission, and Material You toggle.
- [ ] Share card: render the event to a `Bitmap` (same layout as `src/ui/share.ts`), share through `FileProvider`.
- [ ] Material You: on API 31+, take accents from `android.R.color.system_accent1_*`. True-black AMOLED theme.
- [ ] Accessibility: `contentDescription` like "1,408 days, 16 hours since Meeting"; support font scale up to 200 %; TalkBack order.
- [ ] Localization: `values/strings.xml` (en) and `values-ko/strings.xml` (ko); copy strings from `src/i18n/en.ts` / `ko.ts`.
- [ ] Back handling: sheets close first, then navigate back.

Android-only features:

- [ ] **Reminders**: compute the schedule with the ported `Schedule.kt`. Keep the whole list in a file, arm **only the next alarm** (AlarmManager allows at most 500), and on fire post everything due, then arm the next. `setExactAndAllowWhileIdle` when `canScheduleExactAlarms()`, otherwise `setAndAllowWhileIdle` with a visible warning in Settings. Request `SCHEDULE_EXACT_ALARM` with an explanation (or `USE_EXACT_ALARM` if it fits the policy for an alarm/reminder app).
- [ ] Reschedule on `BOOT_COMPLETED`, `TIME_SET`, `TIMEZONE_CHANGED`, `MY_PACKAGE_REPLACED`, `SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`. Recompute the schedule in the receiver (the engine is native now, so there's no "open the app to refresh" problem).
- [ ] Notification channels: Milestones, Reminders, Daily digest. Tapping opens the event. Private events show "Private event".
- [ ] `POST_NOTIFICATIONS` runtime permission (API 33+).
- [ ] **Widgets** (`RemoteViews`): single event 1×1 to 4×2 (resizable, responsive layouts on API 31+), list 4×4, next milestone, progress bar. A configure activity picks the event and the readout. Transparent / solid styles, monochrome themed icon. Update at local midnight (`AlarmManager.setWindow` at next midnight) plus `updatePeriodMillis = 30 min` as a fallback; no per-second ticking.
- [ ] Adaptive launcher icon + monochrome layer from `public/icons/mark.svg` (the 일 glyph is three strokes; convert to a `VectorDrawable`). Notification small icon from the same glyph.
- [ ] Import: device calendars via `CalendarContract` (works with DAVx5/Etar) and contact birthdays, requesting `READ_CALENDAR` / `READ_CONTACTS` only during import. ICS/CSV/JSON files via the Storage Access Framework.
- [ ] Backup to a folder chosen through SAF (`ACTION_OPEN_DOCUMENT_TREE`), manual or scheduled (WorkManager is the one AndroidX lib worth considering here; `JobScheduler` directly is lighter).
- [ ] Optional app lock (PIN / `BiometricPrompt` from the framework, API 28+).

Release:

- [ ] Signing config from environment variables; keep the keystore out of the repo.
- [ ] GitHub Actions: build, run JVM tests (including golden), assert no INTERNET permission in the merged manifest (`aapt2 dump permissions`), attach the APK to GitHub Releases.
- [ ] F-Droid metadata (`fastlane/metadata/android/{en-US,ko}`), reproducible build check, no anti-features.
- [ ] Optional: Accrescent.

---

## 2. Web app: what's left

Everything in the spec's web scope is built, except:

- [ ] **Sync (Syncthing folder, WebDAV/Nextcloud)**: skipped on purpose for now. The groundwork is in place: `mergeData` does last-writer-wins per event with deletion records (`AppData.deleted`) and reports conflicts, so a sync layer only needs to read/merge/write one file. Daily automatic backups to a folder (a Syncthing folder works) are built.
- [ ] Browsers cannot schedule notifications while the PWA is closed; reminders fire only while it's open. ICS export and the Android app cover the rest. Revisit if the Notification Triggers API ever ships.
- [ ] Importers for specific iOS countdown apps' export formats (the generic CSV importer recognises title/date columns in English, Korean, Japanese and Chinese, which covers most exports).
- [ ] Fonts are the system's (no network font loading, no bundled CJK fonts, to keep the app small). Bundle a subset of Pretendard / Noto Sans CJK if a consistent look matters more than size.

## 3. Decisions already made

- App name **eehl**; the icon is **일** ("day" / "one").
- Korean counting age (세는 나이) is **shown by default** next to international age (toggle in Settings).
- Leap-month (윤달) events default to the **regular month (평달)**, the traditional practice; per-event option to use the leap month when that year has it. A missing lunar 30th is observed on the 29th.
- Long-life birthdays use **traditional counting age**: 환갑/還暦 at counting age 61 (the 60th birthday), 칠순/古稀 at counting age 70 (the 69th birthday), and so on. Labels show both ages.
- Feb 29 anniversaries fall on Feb 28 in common years; Jan 31 + 1 month = end of February.
- **Free**: GPLv3, no paid build, no donations.
