// Names of the 24 solar terms (keys from core/solarterms.ts TERM_KEYS) and of
// public holidays (namespaced keys from core/holidays.ts), in every UI
// language. Holidays of another country are named the way that language
// usually names them, with the country added where the bare name would be
// ambiguous (e.g. Korean 추석 in Chinese is 中秋节（韩国）).

export interface HolidayName {
  en: string;
  ko: string;
  ja: string;
  'zh-Hans': string;
  'zh-Hant': string;
}

const n = (en: string, ko: string, ja: string, hans: string, hant: string): HolidayName => ({
  en,
  ko,
  ja,
  'zh-Hans': hans,
  'zh-Hant': hant,
});

export const HOLIDAY_NAMES: Record<string, HolidayName> = {
  // ---- 24 solar terms
  'minor-cold': n('Minor Cold', '소한', '小寒', '小寒', '小寒'),
  'major-cold': n('Major Cold', '대한', '大寒', '大寒', '大寒'),
  'start-of-spring': n('Start of Spring', '입춘', '立春', '立春', '立春'),
  'rain-water': n('Rain Water', '우수', '雨水', '雨水', '雨水'),
  'awakening-of-insects': n('Awakening of Insects', '경칩', '啓蟄', '惊蛰', '驚蟄'),
  'spring-equinox': n('Spring Equinox', '춘분', '春分', '春分', '春分'),
  'clear-and-bright': n('Clear and Bright', '청명', '清明', '清明', '清明'),
  'grain-rain': n('Grain Rain', '곡우', '穀雨', '谷雨', '穀雨'),
  'start-of-summer': n('Start of Summer', '입하', '立夏', '立夏', '立夏'),
  'grain-buds': n('Grain Buds', '소만', '小満', '小满', '小滿'),
  'grain-in-ear': n('Grain in Ear', '망종', '芒種', '芒种', '芒種'),
  'summer-solstice': n('Summer Solstice', '하지', '夏至', '夏至', '夏至'),
  'minor-heat': n('Minor Heat', '소서', '小暑', '小暑', '小暑'),
  'major-heat': n('Major Heat', '대서', '大暑', '大暑', '大暑'),
  'start-of-autumn': n('Start of Autumn', '입추', '立秋', '立秋', '立秋'),
  'end-of-heat': n('End of Heat', '처서', '処暑', '处暑', '處暑'),
  'white-dew': n('White Dew', '백로', '白露', '白露', '白露'),
  'autumn-equinox': n('Autumn Equinox', '추분', '秋分', '秋分', '秋分'),
  'cold-dew': n('Cold Dew', '한로', '寒露', '寒露', '寒露'),
  'frost-descent': n("Frost's Descent", '상강', '霜降', '霜降', '霜降'),
  'start-of-winter': n('Start of Winter', '입동', '立冬', '立冬', '立冬'),
  'minor-snow': n('Minor Snow', '소설', '小雪', '小雪', '小雪'),
  'major-snow': n('Major Snow', '대설', '大雪', '大雪', '大雪'),
  'winter-solstice': n('Winter Solstice', '동지', '冬至', '冬至', '冬至'),

  // ---- South Korea
  'kr:new-year': n("New Year's Day", '신정', '元日（韓国）', '元旦（韩国）', '元旦（韓國）'),
  'kr:seollal': n('Seollal', '설날', 'ソルラル（旧正月）', '春节（韩国）', '春節（韓國）'),
  'kr:independence-movement-day': n('Independence Movement Day', '삼일절', '三一節', '三一节', '三一節'),
  'kr:arbor-day': n('Arbor Day', '식목일', '植木日', '植树节（韩国）', '植樹節（韓國）'),
  'kr:labor-day': n('Labor Day', '노동절', '労働節（韓国）', '劳动节（韩国）', '勞動節（韓國）'),
  'kr:childrens-day': n("Children's Day", '어린이날', 'こどもの日（韓国）', '儿童节（韩国）', '兒童節（韓國）'),
  'kr:buddhas-birthday': n("Buddha's Birthday", '부처님오신날', '釈迦誕生日（韓国）', '佛诞（韩国）', '佛誕（韓國）'),
  'kr:memorial-day': n('Memorial Day', '현충일', '顕忠日', '显忠日', '顯忠日'),
  'kr:constitution-day': n('Constitution Day', '제헌절', '制憲節', '制宪节', '制憲節'),
  'kr:liberation-day': n('Liberation Day', '광복절', '光復節', '光复节', '光復節'),
  'kr:chuseok': n('Chuseok', '추석', '秋夕（チュソク）', '中秋节（韩国）', '中秋節（韓國）'),
  'kr:national-foundation-day': n('National Foundation Day', '개천절', '開天節', '开天节', '開天節'),
  'kr:hangul-day': n('Hangul Day', '한글날', 'ハングルの日', '韩文日', '韓文日'),
  'kr:christmas': n('Christmas Day', '성탄절', 'クリスマス（韓国）', '圣诞节（韩国）', '聖誕節（韓國）'),
  'kr:substitute': n('Substitute holiday', '대체공휴일', '代替公休日（韓国）', '补休（韩国）', '補假（韓國）'),

  // ---- Japan
  'jp:new-year': n("New Year's Day", '새해 첫날(일본)', '元日', '元旦（日本）', '元旦（日本）'),
  'jp:coming-of-age-day': n('Coming of Age Day', '성인의 날', '成人の日', '成人节', '成人之日'),
  'jp:foundation-day': n('National Foundation Day', '건국기념일', '建国記念の日', '建国纪念日', '建國紀念日'),
  'jp:emperors-birthday': n("The Emperor's Birthday", '천황 탄생일', '天皇誕生日', '天皇诞辰', '天皇誕辰'),
  'jp:vernal-equinox': n('Vernal Equinox Day', '춘분의 날', '春分の日', '春分之日', '春分之日'),
  'jp:showa-day': n('Shōwa Day', '쇼와의 날', '昭和の日', '昭和之日', '昭和之日'),
  'jp:constitution-day': n('Constitution Memorial Day', '헌법기념일', '憲法記念日', '宪法纪念日', '憲法紀念日'),
  'jp:greenery-day': n('Greenery Day', '녹색의 날', 'みどりの日', '绿之日', '綠之日'),
  'jp:childrens-day': n("Children's Day", '어린이날(일본)', 'こどもの日', '儿童节（日本）', '兒童節（日本）'),
  'jp:marine-day': n('Marine Day', '바다의 날', '海の日', '海之日', '海之日'),
  'jp:mountain-day': n('Mountain Day', '산의 날', '山の日', '山之日', '山之日'),
  'jp:respect-for-aged-day': n('Respect for the Aged Day', '경로의 날', '敬老の日', '敬老日', '敬老日'),
  'jp:autumnal-equinox': n('Autumnal Equinox Day', '추분의 날', '秋分の日', '秋分之日', '秋分之日'),
  'jp:sports-day': n('Sports Day', '스포츠의 날', 'スポーツの日', '体育日', '體育日'),
  'jp:culture-day': n('Culture Day', '문화의 날', '文化の日', '文化日', '文化日'),
  'jp:labor-thanksgiving-day': n('Labor Thanksgiving Day', '근로감사의 날', '勤労感謝の日', '勤劳感谢日', '勤勞感謝日'),
  'jp:enthronement': n('Enthronement Day', '즉위일', '即位の日', '天皇即位日', '天皇即位日'),
  'jp:enthronement-ceremony': n('Enthronement Ceremony', '즉위례 정전의 의식', '即位礼正殿の儀の行われる日', '即位礼正殿仪式日', '即位禮正殿儀式日'),
  'jp:substitute': n('Substitute holiday', '대체휴일(일본)', '振替休日', '补休（日本）', '補假（日本）'),
  'jp:citizens-holiday': n("Citizens' Holiday", '국민의 휴일', '国民の休日', '国民休息日', '國民休息日'),

  // ---- Mainland China
  'cn:new-year': n("New Year's Day", '원단(중국)', '元旦（中国）', '元旦', '元旦（中國大陸）'),
  'cn:spring-festival-eve': n('Spring Festival Eve', '제석(중국)', '除夕（中国）', '除夕', '除夕（中國大陸）'),
  'cn:spring-festival': n('Spring Festival', '춘절', '春節', '春节', '春節'),
  'cn:qingming': n('Qingming Festival', '청명절', '清明節', '清明节', '清明節'),
  'cn:labour-day': n('Labour Day', '노동절(중국)', '労働節', '劳动节', '勞動節'),
  'cn:dragon-boat': n('Dragon Boat Festival', '단오절', '端午節', '端午节', '端午節'),
  'cn:mid-autumn': n('Mid-Autumn Festival', '중추절', '中秋節', '中秋节', '中秋節'),
  'cn:national-day': n('National Day', '국경절', '国慶節', '国庆节', '國慶節'),

  // ---- Taiwan
  'tw:new-year': n('Founding Day / New Year\'s Day', '중화민국 개국기념일', '中華民国開国記念日', '中华民国开国纪念日', '中華民國開國紀念日'),
  'tw:little-new-years-eve': n("Day before Lunar New Year's Eve", '섣달그믐 전날', '小年夜', '小年夜', '小年夜'),
  'tw:lunar-new-years-eve': n("Lunar New Year's Eve", '섣달그믐(대만)', '除夕', '除夕', '除夕'),
  'tw:lunar-new-year': n('Lunar New Year', '춘절(대만)', '春節（台湾）', '春节（台湾）', '春節'),
  'tw:peace-memorial-day': n('Peace Memorial Day', '228 평화기념일', '和平記念日', '和平纪念日', '和平紀念日'),
  'tw:childrens-day': n("Children's Day", '어린이날(대만)', '児童節', '儿童节', '兒童節'),
  'tw:tomb-sweeping-day': n('Tomb-Sweeping Day', '청명절(대만)', '民族掃墓節', '民族扫墓节', '民族掃墓節'),
  'tw:labour-day': n('Labour Day', '노동절(대만)', '労働節（台湾）', '劳动节（台湾）', '勞動節'),
  'tw:dragon-boat': n('Dragon Boat Festival', '단오절(대만)', '端午節（台湾）', '端午节（台湾）', '端午節'),
  'tw:mid-autumn': n('Mid-Autumn Festival', '중추절(대만)', '中秋節（台湾）', '中秋节（台湾）', '中秋節'),
  'tw:teachers-day': n("Teachers' Day", '스승의 날(대만)', '教師節', '教师节', '教師節'),
  'tw:national-day': n('National Day (Double Tenth)', '쌍십절', '双十節', '国庆日（双十节）', '國慶日'),
  'tw:retrocession-day': n('Retrocession Day', '대만 광복절', '台湾光復節', '台湾光复暨金门古宁头大捷纪念日', '臺灣光復暨金門古寧頭大捷紀念日'),
  'tw:constitution-day': n('Constitution Day', '행헌기념일', '行憲記念日', '行宪纪念日', '行憲紀念日'),
  'tw:substitute': n('Substitute holiday', '대체휴일(대만)', '振替休日（台湾）', '补假（台湾）', '補假'),

  // ---- Hong Kong
  'hk:new-year': n('The first day of January', '신정(홍콩)', '元日（香港）', '一月一日', '一月一日'),
  'hk:lunar-new-year': n('Lunar New Year', '음력설(홍콩)', '旧正月（香港）', '农历年', '農曆年'),
  'hk:ching-ming': n('Ching Ming Festival', '청명절(홍콩)', '清明節（香港）', '清明节', '清明節'),
  'hk:good-friday': n('Good Friday', '성금요일', '聖金曜日', '耶稣受难节', '耶穌受難節'),
  'hk:day-after-good-friday': n('The day following Good Friday', '성금요일 다음 날', '聖金曜日の翌日', '耶稣受难节翌日', '耶穌受難節翌日'),
  'hk:easter-monday': n('Easter Monday', '부활절 월요일', 'イースターマンデー', '复活节星期一', '復活節星期一'),
  'hk:labour-day': n('Labour Day', '노동절(홍콩)', '労働節（香港）', '劳动节', '勞動節'),
  'hk:buddhas-birthday': n('The Birthday of the Buddha', '석가탄신일(홍콩)', '仏誕節', '佛诞', '佛誕'),
  'hk:tuen-ng': n('Tuen Ng Festival', '단오절(홍콩)', '端午節（香港）', '端午节', '端午節'),
  'hk:sar-day': n('HKSAR Establishment Day', '홍콩 특별행정구 수립 기념일', '香港特別行政区成立記念日', '香港特别行政区成立纪念日', '香港特別行政區成立紀念日'),
  'hk:day-after-mid-autumn': n('The day following Mid-Autumn Festival', '중추절 다음 날', '中秋節の翌日', '中秋节翌日', '中秋節翌日'),
  'hk:national-day': n('National Day', '국경절(홍콩)', '国慶節（香港）', '国庆日', '國慶日'),
  'hk:chung-yeung': n('Chung Yeung Festival', '중양절', '重陽節', '重阳节', '重陽節'),
  'hk:christmas': n('Christmas Day', '크리스마스(홍콩)', 'クリスマス（香港）', '圣诞节', '聖誕節'),
  'hk:christmas-weekday': n('The first weekday after Christmas Day', '크리스마스 다음 첫 평일', 'クリスマス後の最初の平日', '圣诞节后第一个平日', '聖誕節後第一個周日'),
  'hk:substitute': n('Substitute holiday', '대체휴일(홍콩)', '振替休日（香港）', '补假（香港）', '補假（香港）'),

  // ---- United States
  'us:new-year': n("New Year's Day", '새해 첫날(미국)', '元日（米国）', '元旦（美国）', '元旦（美國）'),
  'us:mlk-day': n('Martin Luther King Jr. Day', '마틴 루서 킹 데이', 'キング牧師記念日', '马丁·路德·金纪念日', '馬丁·路德·金紀念日'),
  'us:washingtons-birthday': n("Washington's Birthday", '대통령의 날', 'ワシントン誕生日（大統領の日）', '总统日', '總統日'),
  'us:memorial-day': n('Memorial Day', '메모리얼 데이', 'メモリアル・デー', '阵亡将士纪念日', '陣亡將士紀念日'),
  'us:juneteenth': n('Juneteenth', '준틴스', 'ジューンティーンス', '六月节', '六月節'),
  'us:independence-day': n('Independence Day', '독립기념일(미국)', '独立記念日', '独立日', '獨立紀念日'),
  'us:labor-day': n('Labor Day', '노동절(미국)', 'レイバー・デー', '劳动节（美国）', '勞動節（美國）'),
  'us:columbus-day': n('Columbus Day', '콜럼버스의 날', 'コロンブス・デー', '哥伦布日', '哥倫布日'),
  'us:veterans-day': n('Veterans Day', '재향군인의 날', '退役軍人の日', '退伍军人节', '退伍軍人節'),
  'us:thanksgiving': n('Thanksgiving Day', '추수감사절', '感謝祭', '感恩节', '感恩節'),
  'us:christmas': n('Christmas Day', '크리스마스(미국)', 'クリスマス（米国）', '圣诞节（美国）', '聖誕節（美國）'),
  'us:observed': n('Observed holiday', '대체휴일(미국)', '振替休日（米国）', '补假（美国）', '補假（美國）'),
};
