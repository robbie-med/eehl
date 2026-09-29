// Japanese era years (和暦). Rules:
//  - only the eras since Japan adopted the Gregorian calendar are covered:
//    明治 from 1873-01-01 (Meiji 6; earlier Meiji dates were lunisolar, so
//    they return null), 大正 from 1912-07-30, 昭和 from 1926-12-25,
//    平成 from 1989-01-08 and 令和 from 2019-05-01;
//  - an era's first day starts year 1 (元年), and its year number goes up on
//    each following Jan 1 (so 1989-01-07 is Shōwa 64 and 1989-01-08 Heisei 1).

import { compareCivil, type Civil } from './civil';

export type JapaneseEra = 'meiji' | 'taisho' | 'showa' | 'heisei' | 'reiwa';

export const ERA_NAMES: Record<JapaneseEra, { ja: string; en: string; letter: string }> = {
  meiji: { ja: '明治', en: 'Meiji', letter: 'M' },
  taisho: { ja: '大正', en: 'Taishō', letter: 'T' },
  showa: { ja: '昭和', en: 'Shōwa', letter: 'S' },
  heisei: { ja: '平成', en: 'Heisei', letter: 'H' },
  reiwa: { ja: '令和', en: 'Reiwa', letter: 'R' },
};

/** Era starts, newest first. `firstYear` is the Gregorian year of 元年. */
const ERAS: { era: JapaneseEra; start: Civil; firstYear: number }[] = [
  { era: 'reiwa', start: { y: 2019, m: 5, d: 1 }, firstYear: 2019 },
  { era: 'heisei', start: { y: 1989, m: 1, d: 8 }, firstYear: 1989 },
  { era: 'showa', start: { y: 1926, m: 12, d: 25 }, firstYear: 1926 },
  { era: 'taisho', start: { y: 1912, m: 7, d: 30 }, firstYear: 1912 },
  // Meiji began in 1868; 1873-01-01 is where Gregorian dates start.
  { era: 'meiji', start: { y: 1873, m: 1, d: 1 }, firstYear: 1868 },
];

export function japaneseEra(c: Civil): { era: JapaneseEra; year: number } | null {
  for (const e of ERAS) {
    if (compareCivil(c, e.start) >= 0) return { era: e.era, year: c.y - e.firstYear + 1 };
  }
  return null;
}
