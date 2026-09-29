// Public holidays and business days for KR, JP, CN, TW, HK and US, 2000–2099,
// computed from each country's statutory rules (no network, no tables beyond
// the frozen lunar and solar-term data).
//
// What is NOT included, because it is decided case by case rather than by a
// rule: one-off holidays (Korean election days and 임시공휴일 such as
// 2024-10-01 or 2025-01-27, US presidential mourning days, …) and the
// make-up workdays that China and Taiwan announce each year (调休 / 補班):
// a weekend day that is declared a workday still counts as a weekend here,
// and the swapped-in weekdays are not listed. CN therefore lists the
// statutory 法定节假日 only, not the full announced 放假 blocks.
//
// Every entry is one day. A multi-day festival repeats its key on each day
// (설날 is three 'kr:seollal' entries); a day where two holidays coincide
// lists both. Substitute days (대체공휴일, 振替休日, observed days, 補假) use
// one key per country and have `substitute: true`.
//
// Rules by country (years are Gregorian unless marked lunar):
//
// US (federal): New Year's Day, MLK Day (3rd Mon Jan), Washington's Birthday
//   (3rd Mon Feb), Memorial Day (last Mon May), Juneteenth (Jun 19, from
//   2021), Independence Day, Labor Day (1st Mon Sep), Columbus Day (2nd Mon
//   Oct), Veterans Day (Nov 11), Thanksgiving (4th Thu Nov), Christmas. A
//   fixed-date holiday on Saturday is observed the Friday before, on Sunday
//   the Monday after ('us:observed'); New Year's Day on a Saturday is
//   observed on Dec 31 of the previous year.
//
// KR (관공서의 공휴일에 관한 규정): 신정 1/1; 설날 = the last day of lunar
//   month 12 and lunar 1/1–1/2 (korean-lunar); 삼일절 3/1; 식목일 4/5 (until
//   2005); 노동절 5/1 (from 2026); 어린이날 5/5; 부처님오신날 lunar 4/8; 현충일
//   6/6; 제헌절 7/17 (until 2007 and again from 2026); 광복절 8/15; 추석 =
//   lunar 8/14–8/16; 개천절 10/3; 한글날 10/9 (from 2013); 성탄절 12/25.
//   대체공휴일 ('kr:substitute'):
//   - 설날/추석 (from 2014): each day of the block that is a Sunday or also
//     another holiday gives one substitute: the first day after the block
//     that is neither a Sunday nor a holiday;
//   - on Saturday, Sunday or another holiday → the first following weekday
//     that is not a holiday: 어린이날 (from 2014), 광복절/개천절/한글날 (from
//     2021), 삼일절 (from 2022), 부처님오신날/성탄절 (from 2023), 노동절/제헌절
//     (from 2026);
//   - two holidays on the same day give one substitute day, not two
//     (2025-05-05 어린이날 + 부처님오신날 → 5/6 only).
//
// JP (国民の祝日に関する法律, from 2000): 元日 1/1; 成人の日 2nd Mon Jan;
//   建国記念の日 2/11; 天皇誕生日 12/23 (to 2018), none in 2019, 2/23 (from
//   2020); 春分の日 and 秋分の日 = the equinox date in Asia/Tokyo (the official
//   dates are announced a year ahead from the same astronomy); 4/29 みどりの日
//   (to 2006) / 昭和の日 (from 2007); 憲法記念日 5/3; みどりの日 5/4 (from
//   2007); こどもの日 5/5; 海の日 7/20 (2000–2002), 3rd Mon Jul (from 2003;
//   7/23 in 2020, 7/22 in 2021); 山の日 8/11 (from 2016; 8/10 in 2020, 8/8 in
//   2021); 敬老の日 9/15 (2000–2002), 3rd Mon Sep (from 2003); 体育の日 /
//   スポーツの日 2nd Mon Oct (7/24 in 2020, 7/23 in 2021); 文化の日 11/3;
//   勤労感謝の日 11/23; 2019 only: 即位の日 5/1 and 即位礼正殿の儀 10/22.
//   国民の休日: a day that is not a Sunday or a 祝日 but has a 祝日 on both
//   sides (so 2019-04-30 and 05-02, and silver weeks such as 2026-09-22).
//   振替休日: a 祝日 on Sunday → the next day that is not a holiday.
//
// CN (全国年节及纪念日放假办法, statutory days only): 元旦 1/1; 春节 =
//   lunar 1/1–1/3 (chinese-lunar) — 2008–2013 除夕 + 1/1–1/2 instead, and from
//   2025 除夕 + 1/1–1/3; 清明 (the solar term date in Asia/Shanghai, from
//   2008); 劳动节 5/1 (5/1–5/3 until 2007, 5/1–5/2 from 2025); 端午 lunar 5/5
//   and 中秋 lunar 8/15 (from 2008); 国庆 10/1–10/3. No substitutes: China
//   moves days by announcement (调休), which is out of scope.
//
// TW (紀念日及節日實施辦法, from 2025 the 條例): 開國紀念日 1/1; 春節 = 除夕
//   (the day before lunar 1/1) and lunar 1/1–1/3, plus 小年夜 (the day before
//   除夕) from 2026; 和平紀念日 2/28; 兒童節 4/4 (from 2011); 民族掃墓節 =
//   Qingming in Asia/Taipei; when 兒童節 and 民族掃墓節 fall on the same day
//   (from 2012), 兒童節 is observed the day before — or the day after when
//   that day is a Thursday; 勞動節 5/1 (historically a day off for workers
//   under the Labor Standards Act only; for everyone from 2025); 端午;
//   中秋; 國慶日 10/10; from 2025 also 教師節 9/28, 臺灣光復暨金門古寧頭大捷紀念日
//   10/25 and 行憲紀念日 12/25.
//   補假 ('tw:substitute'): a holiday on Saturday → the previous workday, on
//   Sunday → the next workday (勞動節 only from 2025); each weekend day inside
//   the 小年夜/除夕/春節 block adds one workday after the block.
//   Uncertain: whether the 2025 條例 keeps the Thursday exception for 兒童節,
//   and 行憲紀念日 before 2001 (not included).
//
// HK (General Holidays Ordinance, general holidays besides Sundays): 1/1;
//   Lunar New Year's Day and the next two days (chinese-lunar); Ching Ming
//   (the solar term date in Asia/Hong_Kong); Good Friday, the day following
//   Good Friday and Easter Monday (Anonymous Gregorian computus); 5/1;
//   Buddha's Birthday lunar 4/8; Tuen Ng lunar 5/5; 7/1; the day following
//   Mid-Autumn (lunar 8/16); 10/1; Chung Yeung lunar 9/9; Christmas and the
//   first weekday (non-Sunday) after it. A holiday on Sunday, or Ching Ming on
//   Easter Monday, gives 'hk:substitute' on the next day that is neither a
//   Sunday nor a holiday (this also yields the fourth day of Lunar New Year).
//   Saturday holidays are not moved.

import { dayNumber, fromDayNumber } from './civil';
import { lunarToDayNumber } from './lunar';
import { solarTermDay } from './solarterms';

export type HolidayCountry = 'KR' | 'JP' | 'CN' | 'TW' | 'HK' | 'US';

export const HOLIDAY_COUNTRIES: HolidayCountry[] = ['KR', 'JP', 'CN', 'TW', 'HK', 'US'];

export const HOLIDAY_RANGE = { first: 2000, last: 2099 };

export interface Holiday {
  day: number;
  key: string;
  substitute: boolean;
}

// ---------------------------------------------------------------- helpers

const SUN = 0;
const THU = 4;
const SAT = 6;

/** 0 = Sunday … 6 = Saturday, for a day number. */
function wd(n: number): number {
  return (((n + 4) % 7) + 7) % 7;
}

const isWeekend = (n: number) => wd(n) === SAT || wd(n) === SUN;

function ymd(y: number, m: number, d: number): number {
  return dayNumber({ y, m, d });
}

/** The n-th (1-based) weekday `dow` of a month. */
function nthWeekday(y: number, m: number, dow: number, n: number): number {
  const first = ymd(y, m, 1);
  return first + ((dow - wd(first) + 7) % 7) + (n - 1) * 7;
}

function lastWeekday(y: number, m: number, dow: number): number {
  const next = m === 12 ? ymd(y + 1, 1, 1) : ymd(y, m + 1, 1);
  const last = next - 1;
  return last - ((wd(last) - dow + 7) % 7);
}

function korean(y: number, m: number, d: number): number {
  return lunarToDayNumber('korean-lunar', { year: y, month: m, day: d, leap: false })!;
}

function chinese(y: number, m: number, d: number): number {
  return lunarToDayNumber('chinese-lunar', { year: y, month: m, day: d, leap: false })!;
}

/** Easter Sunday (Anonymous Gregorian algorithm). */
export function easterSunday(y: number): number {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h - 7 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

class List {
  items: Holiday[] = [];
  add(key: string, day: number, substitute = false) {
    if (!this.items.some((h) => h.day === day && h.key === key)) this.items.push({ day, key, substitute });
  }
  has(day: number) {
    return this.items.some((h) => h.day === day);
  }
  on(day: number) {
    return this.items.filter((h) => h.day === day);
  }
  /** First day from `start` (moving by `step`) that is not a holiday and not skipped. */
  free(start: number, skip: (n: number) => boolean, step = 1): number {
    let n = start;
    while (this.has(n) || skip(n)) n += step;
    return n;
  }
}

// ---------------------------------------------------------------- US

function buildUS(y: number): List {
  const L = new List();
  const fixed = (key: string, day: number) => {
    L.add(key, day);
    if (wd(day) === SAT) L.add('us:observed', day - 1, true);
    if (wd(day) === SUN) L.add('us:observed', day + 1, true);
  };
  const newYear = ymd(y, 1, 1);
  L.add('us:new-year', newYear);
  if (wd(newYear) === SUN) L.add('us:observed', newYear + 1, true);
  L.add('us:mlk-day', nthWeekday(y, 1, 1, 3));
  L.add('us:washingtons-birthday', nthWeekday(y, 2, 1, 3));
  L.add('us:memorial-day', lastWeekday(y, 5, 1));
  if (y >= 2021) fixed('us:juneteenth', ymd(y, 6, 19));
  fixed('us:independence-day', ymd(y, 7, 4));
  L.add('us:labor-day', nthWeekday(y, 9, 1, 1));
  L.add('us:columbus-day', nthWeekday(y, 10, 1, 2));
  fixed('us:veterans-day', ymd(y, 11, 11));
  L.add('us:thanksgiving', nthWeekday(y, 11, 4, 4));
  fixed('us:christmas', ymd(y, 12, 25));
  // Next New Year's Day on a Saturday is observed on Dec 31 of this year.
  if (wd(ymd(y + 1, 1, 1)) === SAT) L.add('us:observed', ymd(y, 12, 31), true);
  return L;
}

// ---------------------------------------------------------------- KR

function buildKR(y: number): List {
  const L = new List();
  const seol = korean(y, 1, 1);
  const seollal = [seol - 1, seol, seol + 1];
  const chu = korean(y, 8, 15);
  const chuseok = [chu - 1, chu, chu + 1];

  L.add('kr:new-year', ymd(y, 1, 1));
  for (const n of seollal) L.add('kr:seollal', n);
  L.add('kr:independence-movement-day', ymd(y, 3, 1));
  if (y <= 2005) L.add('kr:arbor-day', ymd(y, 4, 5));
  if (y >= 2026) L.add('kr:labor-day', ymd(y, 5, 1));
  L.add('kr:childrens-day', ymd(y, 5, 5));
  L.add('kr:buddhas-birthday', korean(y, 4, 8));
  L.add('kr:memorial-day', ymd(y, 6, 6));
  if (y <= 2007 || y >= 2026) L.add('kr:constitution-day', ymd(y, 7, 17));
  L.add('kr:liberation-day', ymd(y, 8, 15));
  for (const n of chuseok) L.add('kr:chuseok', n);
  L.add('kr:national-foundation-day', ymd(y, 10, 3));
  if (y >= 2013) L.add('kr:hangul-day', ymd(y, 10, 9));
  L.add('kr:christmas', ymd(y, 12, 25));

  // Substitute triggers keyed by the original day, so two holidays on one
  // day yield one substitute.
  const triggers = new Map<number, { from: number; weekdayOnly: boolean }>();
  if (y >= 2014) {
    for (const [block, key] of [[seollal, 'kr:seollal'], [chuseok, 'kr:chuseok']] as const) {
      for (const n of block) {
        if (wd(n) === SUN || L.on(n).some((h) => h.key !== key)) triggers.set(n, { from: block[2] + 1, weekdayOnly: false });
      }
    }
  }
  const since: Record<string, number> = {
    'kr:childrens-day': 2014,
    'kr:liberation-day': 2021,
    'kr:national-foundation-day': 2021,
    'kr:hangul-day': 2021,
    'kr:independence-movement-day': 2022,
    'kr:buddhas-birthday': 2023,
    'kr:christmas': 2023,
    'kr:labor-day': 2026,
    'kr:constitution-day': 2026,
  };
  for (const h of L.items) {
    if (!(since[h.key] <= y) || triggers.has(h.day)) continue;
    if (isWeekend(h.day) || L.on(h.day).length > 1) triggers.set(h.day, { from: h.day + 1, weekdayOnly: true });
  }
  for (const [, t] of [...triggers].sort((a, b) => a[0] - b[0])) {
    L.add('kr:substitute', L.free(t.from, t.weekdayOnly ? isWeekend : (n) => wd(n) === SUN), true);
  }
  return L;
}

// ---------------------------------------------------------------- JP

function buildJP(y: number): List {
  const L = new List();
  L.add('jp:new-year', ymd(y, 1, 1));
  L.add('jp:coming-of-age-day', nthWeekday(y, 1, 1, 2));
  L.add('jp:foundation-day', ymd(y, 2, 11));
  if (y >= 2020) L.add('jp:emperors-birthday', ymd(y, 2, 23));
  L.add('jp:vernal-equinox', solarTermDay(y, 'spring-equinox', 'Asia/Tokyo')!);
  L.add(y <= 2006 ? 'jp:greenery-day' : 'jp:showa-day', ymd(y, 4, 29));
  if (y === 2019) L.add('jp:enthronement', ymd(2019, 5, 1));
  L.add('jp:constitution-day', ymd(y, 5, 3));
  if (y >= 2007) L.add('jp:greenery-day', ymd(y, 5, 4));
  L.add('jp:childrens-day', ymd(y, 5, 5));
  L.add('jp:marine-day', y <= 2002 ? ymd(y, 7, 20) : y === 2020 ? ymd(y, 7, 23) : y === 2021 ? ymd(y, 7, 22) : nthWeekday(y, 7, 1, 3));
  if (y >= 2016) L.add('jp:mountain-day', y === 2020 ? ymd(y, 8, 10) : y === 2021 ? ymd(y, 8, 8) : ymd(y, 8, 11));
  L.add('jp:respect-for-aged-day', y <= 2002 ? ymd(y, 9, 15) : nthWeekday(y, 9, 1, 3));
  L.add('jp:autumnal-equinox', solarTermDay(y, 'autumn-equinox', 'Asia/Tokyo')!);
  L.add('jp:sports-day', y === 2020 ? ymd(y, 7, 24) : y === 2021 ? ymd(y, 7, 23) : nthWeekday(y, 10, 1, 2));
  if (y === 2019) L.add('jp:enthronement-ceremony', ymd(2019, 10, 22));
  L.add('jp:culture-day', ymd(y, 11, 3));
  L.add('jp:labor-thanksgiving-day', ymd(y, 11, 23));
  if (y <= 2018) L.add('jp:emperors-birthday', ymd(y, 12, 23));

  // 国民の休日 is judged against the 祝日 only; then 振替休日.
  const shukujitsu = new Set(L.items.map((h) => h.day));
  for (const n of [...shukujitsu]) {
    const mid = n + 1;
    if (!shukujitsu.has(mid) && shukujitsu.has(mid + 1) && wd(mid) !== SUN) L.add('jp:citizens-holiday', mid);
  }
  for (const n of [...shukujitsu].sort((a, b) => a - b)) {
    if (wd(n) === SUN) L.add('jp:substitute', L.free(n + 1, () => false), true);
  }
  return L;
}

// ---------------------------------------------------------------- CN

function buildCN(y: number): List {
  const L = new List();
  const lny = chinese(y, 1, 1);
  L.add('cn:new-year', ymd(y, 1, 1));
  if ((y >= 2008 && y <= 2013) || y >= 2025) L.add('cn:spring-festival-eve', lny - 1);
  const festivalDays = y >= 2008 && y <= 2013 ? 2 : 3;
  for (let i = 0; i < festivalDays; i++) L.add('cn:spring-festival', lny + i);
  if (y >= 2008) L.add('cn:qingming', solarTermDay(y, 'clear-and-bright', 'Asia/Shanghai')!);
  const labourDays = y <= 2007 ? 3 : y >= 2025 ? 2 : 1;
  for (let i = 0; i < labourDays; i++) L.add('cn:labour-day', ymd(y, 5, 1 + i));
  if (y >= 2008) {
    L.add('cn:dragon-boat', chinese(y, 5, 5));
    L.add('cn:mid-autumn', chinese(y, 8, 15));
  }
  for (let i = 0; i < 3; i++) L.add('cn:national-day', ymd(y, 10, 1 + i));
  return L;
}

// ---------------------------------------------------------------- TW

function buildTW(y: number): List {
  const L = new List();
  const lny = chinese(y, 1, 1);
  const block = [...(y >= 2026 ? [lny - 2] : []), lny - 1, lny, lny + 1, lny + 2];
  const moved: [string, number][] = []; // holidays that get weekend substitutes

  const single = (key: string, day: number, substituted = true) => {
    L.add(key, day);
    if (substituted) moved.push([key, day]);
  };
  single('tw:new-year', ymd(y, 1, 1));
  if (y >= 2026) L.add('tw:little-new-years-eve', block[0]);
  L.add('tw:lunar-new-years-eve', lny - 1);
  for (let i = 0; i < 3; i++) L.add('tw:lunar-new-year', lny + i);
  single('tw:peace-memorial-day', ymd(y, 2, 28));
  const tomb = solarTermDay(y, 'clear-and-bright', 'Asia/Taipei')!;
  const april4 = ymd(y, 4, 4);
  if (y >= 2011) {
    let children = april4;
    if (y >= 2012 && tomb === april4) children = wd(april4) === THU ? april4 + 1 : april4 - 1;
    single('tw:childrens-day', children);
  }
  single('tw:tomb-sweeping-day', tomb);
  single('tw:labour-day', ymd(y, 5, 1), y >= 2025);
  single('tw:dragon-boat', chinese(y, 5, 5));
  single('tw:mid-autumn', chinese(y, 8, 15));
  if (y >= 2025) single('tw:teachers-day', ymd(y, 9, 28));
  single('tw:national-day', ymd(y, 10, 10));
  if (y >= 2025) {
    single('tw:retrocession-day', ymd(y, 10, 25));
    single('tw:constitution-day', ymd(y, 12, 25));
  }

  // Lunar New Year block: each weekend day adds a workday after the block.
  const blockWeekend = block.filter(isWeekend).length;
  let next = block[block.length - 1] + 1;
  for (let i = 0; i < blockWeekend; i++) {
    const n = L.free(next, isWeekend);
    L.add('tw:substitute', n, true);
    next = n + 1;
  }
  for (const [, day] of moved.sort((a, b) => a[1] - b[1])) {
    if (wd(day) === SAT) L.add('tw:substitute', L.free(day - 1, isWeekend, -1), true);
    else if (wd(day) === SUN) L.add('tw:substitute', L.free(day + 1, isWeekend), true);
  }
  // Next year's 1/1 on a Saturday is made up on this year's last workday.
  if (wd(ymd(y + 1, 1, 1)) === SAT) L.add('tw:substitute', ymd(y, 12, 31), true);
  return L;
}

// ---------------------------------------------------------------- HK

function buildHK(y: number): List {
  const L = new List();
  const lny = chinese(y, 1, 1);
  const easter = easterSunday(y);
  const chingMing = solarTermDay(y, 'clear-and-bright', 'Asia/Hong_Kong')!;
  const christmas = ymd(y, 12, 25);
  L.add('hk:new-year', ymd(y, 1, 1));
  for (let i = 0; i < 3; i++) L.add('hk:lunar-new-year', lny + i);
  L.add('hk:ching-ming', chingMing);
  L.add('hk:good-friday', easter - 2);
  L.add('hk:day-after-good-friday', easter - 1);
  L.add('hk:easter-monday', easter + 1);
  L.add('hk:labour-day', ymd(y, 5, 1));
  L.add('hk:buddhas-birthday', chinese(y, 4, 8));
  L.add('hk:tuen-ng', chinese(y, 5, 5));
  L.add('hk:sar-day', ymd(y, 7, 1));
  L.add('hk:day-after-mid-autumn', chinese(y, 8, 16));
  L.add('hk:national-day', ymd(y, 10, 1));
  L.add('hk:chung-yeung', chinese(y, 9, 9));
  L.add('hk:christmas', christmas);
  L.add('hk:christmas-weekday', wd(christmas + 1) === SUN ? christmas + 2 : christmas + 1);

  const triggers = L.items.filter((h) => wd(h.day) === SUN).map((h) => h.day);
  if (chingMing === easter + 1) triggers.push(chingMing);
  for (const n of triggers.sort((a, b) => a - b)) {
    L.add('hk:substitute', L.free(n + 1, (d) => wd(d) === SUN), true);
  }
  return L;
}

// ---------------------------------------------------------------- API

const builders: Record<HolidayCountry, (y: number) => List> = {
  US: buildUS,
  KR: buildKR,
  JP: buildJP,
  CN: buildCN,
  TW: buildTW,
  HK: buildHK,
};

interface YearInfo {
  list: Holiday[];
  days: Set<number>;
  /** Distinct Mon–Fri days with a holiday, sorted. */
  weekdayHolidays: number[];
}

const cache = new Map<string, YearInfo>();
const EMPTY: YearInfo = { list: [], days: new Set(), weekdayHolidays: [] };

function info(country: HolidayCountry, year: number): YearInfo {
  if (!Number.isInteger(year) || year < HOLIDAY_RANGE.first || year > HOLIDAY_RANGE.last || !builders[country]) return EMPTY;
  const key = country + year;
  let hit = cache.get(key);
  if (!hit) {
    const first = ymd(year, 1, 1);
    const last = ymd(year, 12, 31);
    const list = builders[country](year)
      .items.filter((h) => h.day >= first && h.day <= last)
      .sort((a, b) => a.day - b.day);
    const days = new Set(list.map((h) => h.day));
    hit = { list, days, weekdayHolidays: [...days].filter((n) => !isWeekend(n)).sort((a, b) => a - b) };
    cache.set(key, hit);
  }
  return hit;
}

/** Holidays of a Gregorian year, sorted by day; [] outside HOLIDAY_RANGE. */
export function holidaysInYear(country: HolidayCountry, year: number): Holiday[] {
  return info(country, year).list.slice();
}

export function holidaysOn(country: HolidayCountry, day: number): Holiday[] {
  return info(country, fromDayNumber(day).y).list.filter((h) => h.day === day);
}

/** Mon–Fri and not a holiday (country null = weekends only). */
export function isBusinessDay(country: HolidayCountry | null, day: number): boolean {
  if (isWeekend(day)) return false;
  return country === null || !info(country, fromDayNumber(day).y).days.has(day);
}

/** Mon–Fri days before day n, counted from the Monday 1970-01-05 (a running total). */
function weekdaysBefore(n: number): number {
  const k = n - 4; // day 4 (1970-01-05) is a Monday
  const weeks = Math.floor(k / 7);
  return weeks * 5 + Math.min(k - weeks * 7, 5);
}

/**
 * Business days in [fromDay, toDay) (0 if toDay <= fromDay). country null =
 * weekends only; outside HOLIDAY_RANGE only weekends are skipped.
 */
export function businessDaysBetween(country: HolidayCountry | null, fromDay: number, toDay: number): number {
  if (!(toDay > fromDay)) return 0;
  let count = weekdaysBefore(toDay) - weekdaysBefore(fromDay);
  if (country === null) return count;
  const y0 = Math.max(fromDayNumber(fromDay).y, HOLIDAY_RANGE.first);
  const y1 = Math.min(fromDayNumber(toDay - 1).y, HOLIDAY_RANGE.last);
  for (let y = y0; y <= y1; y++) {
    const days = info(country, y).weekdayHolidays;
    if (fromDay <= ymd(y, 1, 1) && toDay > ymd(y, 12, 31)) count -= days.length;
    else for (const n of days) if (n >= fromDay && n < toDay) count--;
  }
  return count;
}
