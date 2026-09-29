// Named wedding anniversaries. Lists differ by tradition, so each rule picks
// a list (or follows the UI language).

import type { WeddingNames } from '../core/types';
import type { Lang } from './format';

export const WEDDING_NAMES: Record<Exclude<WeddingNames, 'auto'>, Record<number, string>> = {
  en: {
    1: 'Paper', 2: 'Cotton', 3: 'Leather', 4: 'Linen', 5: 'Wood', 6: 'Iron', 7: 'Wool', 8: 'Bronze',
    9: 'Pottery', 10: 'Tin', 11: 'Steel', 12: 'Silk', 13: 'Lace', 14: 'Ivory', 15: 'Crystal', 20: 'China',
    25: 'Silver', 30: 'Pearl', 35: 'Coral', 40: 'Ruby', 45: 'Sapphire', 50: 'Gold', 55: 'Emerald', 60: 'Diamond',
  },
  ko: {
    1: '지혼식', 5: '목혼식', 10: '석혼식', 15: '동혼식', 20: '도자기혼식', 25: '은혼식',
    30: '진주혼식', 35: '산호혼식', 40: '루비혼식', 45: '사파이어혼식', 50: '금혼식', 55: '에메랄드혼식', 60: '회혼식',
  },
  ja: {
    1: '紙婚式', 2: '綿婚式', 3: '革婚式', 4: '花婚式', 5: '木婚式', 6: '鉄婚式', 7: '銅婚式', 8: 'ゴム婚式',
    9: '陶器婚式', 10: '錫婚式', 11: '鋼鉄婚式', 12: '絹婚式', 13: 'レース婚式', 14: '象牙婚式', 15: '水晶婚式',
    20: '磁器婚式', 25: '銀婚式', 30: '真珠婚式', 35: '珊瑚婚式', 40: 'ルビー婚式', 45: 'サファイア婚式',
    50: '金婚式', 55: 'エメラルド婚式', 60: 'ダイヤモンド婚式',
  },
  zh: {
    1: '纸婚', 2: '棉婚', 3: '皮革婚', 4: '丝婚', 5: '木婚', 6: '铁婚', 7: '铜婚', 8: '陶器婚',
    9: '柳婚', 10: '锡婚', 11: '钢婚', 12: '链婚', 13: '花边婚', 14: '象牙婚', 15: '水晶婚', 20: '瓷婚',
    25: '银婚', 30: '珍珠婚', 35: '珊瑚婚', 40: '红宝石婚', 45: '蓝宝石婚', 50: '金婚', 55: '翡翠婚', 60: '钻石婚',
  },
};

/** Traditional-character forms for the Chinese list. */
const ZH_HANT: Record<string, string> = {
  纸婚: '紙婚', 铁婚: '鐵婚', 铜婚: '銅婚', 锡婚: '錫婚', 钢婚: '鋼婚', 链婚: '鏈婚', 花边婚: '花邊婚',
  瓷婚: '瓷婚', 银婚: '銀婚', 红宝石婚: '紅寶石婚', 蓝宝石婚: '藍寶石婚', 钻石婚: '鑽石婚', 丝婚: '絲婚',
};

export function weddingName(list: WeddingNames, uiLang: Lang, n: number): string | undefined {
  const key: Exclude<WeddingNames, 'auto'> =
    list !== 'auto' ? list : uiLang === 'ko' ? 'ko' : uiLang === 'ja' ? 'ja' : uiLang.startsWith('zh') ? 'zh' : 'en';
  const name = WEDDING_NAMES[key][n];
  if (name && key === 'zh' && uiLang === 'zh-Hant') return ZH_HANT[name] ?? name;
  return name;
}
