// The 24 solar terms (절기 / 节气 / 節気), backed by the frozen table in
// solarterm-data.ts (scripts/gen-solar-terms.py, 1900–2100).
//
// Rules:
//  - a term is the instant the Sun's apparent geocentric ecliptic longitude
//    reaches a multiple of 15° (minor cold = 285°, then +15° each; the spring
//    equinox is 0°), stored to the nearest minute (UTC);
//  - the civil date of a term depends on the zone: a term just before
//    midnight in Seoul can fall on the previous day in Shanghai, so every
//    date lookup takes an IANA zone;
//  - each Gregorian year holds exactly one of every term, in the order of
//    TERM_KEYS (minor cold ~Jan 5 … winter solstice ~Dec 22).

import { dayNumber, fromDayNumber } from './civil';
import { SOLAR_TERMS_FIRST_YEAR, SOLAR_TERMS_LAST_YEAR, SOLAR_TERM_MINUTES } from './solarterm-data';
import { MINUTE, wallAt } from './zone';

export const TERM_KEYS = [
  'minor-cold',
  'major-cold',
  'start-of-spring',
  'rain-water',
  'awakening-of-insects',
  'spring-equinox',
  'clear-and-bright',
  'grain-rain',
  'start-of-summer',
  'grain-buds',
  'grain-in-ear',
  'summer-solstice',
  'minor-heat',
  'major-heat',
  'start-of-autumn',
  'end-of-heat',
  'white-dew',
  'autumn-equinox',
  'cold-dew',
  'frost-descent',
  'start-of-winter',
  'minor-snow',
  'major-snow',
  'winter-solstice',
] as const;

export type TermKey = (typeof TERM_KEYS)[number];

export const SOLAR_TERM_RANGE = { first: SOLAR_TERMS_FIRST_YEAR, last: SOLAR_TERMS_LAST_YEAR };

export interface SolarTerm {
  key: TermKey;
  /** Position in TERM_KEYS (0 = minor cold). */
  index: number;
  epochMs: number;
}

export interface SolarTermDay {
  key: TermKey;
  /** Civil day number in the requested zone. */
  day: number;
  epochMs: number;
}

/** Apparent solar longitude (degrees) that defines a term. */
export function termLongitude(index: number): number {
  return (285 + 15 * index) % 360;
}

/** The 24 terms of a Gregorian year, in time order; [] outside 1900–2100. */
export function solarTermsInYear(year: number): SolarTerm[] {
  const row = SOLAR_TERM_MINUTES[year - SOLAR_TERMS_FIRST_YEAR];
  if (!row || !Number.isInteger(year)) return [];
  const jan1 = Date.UTC(year, 0, 1);
  return row.map((minutes, index) => ({ key: TERM_KEYS[index], index, epochMs: jan1 + minutes * MINUTE }));
}

function civilDay(epochMs: number, zone: string): number {
  return dayNumber(wallAt(epochMs, zone));
}

/** Day number of the civil date of a term in `zone`, or null when unknown. */
export function solarTermDay(year: number, key: string, zone: string): number | null {
  const index = (TERM_KEYS as readonly string[]).indexOf(key);
  if (index < 0) return null;
  const term = solarTermsInYear(year)[index];
  return term ? civilDay(term.epochMs, zone) : null;
}

/** Terms whose civil date in `zone` lies in [fromDay, toDay], sorted. */
export function solarTermsBetween(fromDay: number, toDay: number, zone: string): SolarTermDay[] {
  if (toDay < fromDay) return [];
  // Day number → Gregorian year, widened by one to cover zone offsets at
  // New Year (minor cold is ~Jan 5, winter solstice ~Dec 22, so ±1 is ample).
  const first = Math.max(fromDayNumber(fromDay).y - 1, SOLAR_TERMS_FIRST_YEAR);
  const last = Math.min(fromDayNumber(toDay).y + 1, SOLAR_TERMS_LAST_YEAR);
  const out: SolarTermDay[] = [];
  for (let y = first; y <= last; y++) {
    for (const t of solarTermsInYear(y)) {
      const day = civilDay(t.epochMs, zone);
      if (day >= fromDay && day <= toDay) out.push({ key: t.key, day, epochMs: t.epochMs });
    }
  }
  return out;
}
