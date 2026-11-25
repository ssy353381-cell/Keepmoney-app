// 快速記帳：把一句話（打字或語音聽寫）解析成一筆記帳。
// 注意：此檔案刻意不 import 任何東西（連專案內的檔案都不行），
// 之後會原封不動複製到 Supabase Edge Function（Deno）使用。
// 日期一律是 YYYY-MM-DD，以當地時間運算，不使用 toISOString。

export type QuickParseResult = {
  /** 解析不到就是 null；> 0、最多兩位小數、<= 999999999999.99 */
  amount: number | null;
  type: 'expense' | 'income';
  /** YYYY-MM-DD */
  occurredOn: string;
  /** 對應到預設分類名稱，猜不到為 null */
  categoryName: string | null;
  /** 去掉金額、日期詞之後剩下的文字（trim、壓縮空白，可為空字串） */
  note: string;
};

const MAX_AMOUNT = 999999999999.99;
const MAX_NOTE_LENGTH = 200;

// ---------------------------------------------------------------------------
// 分類關鍵字（key 是資料庫預設分類名稱）
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  飲食: [
    '早餐',
    '午餐',
    '晚餐',
    '宵夜',
    '早午餐',
    '早飯',
    '午飯',
    '晚飯',
    '點心',
    '零食',
    '飲料',
    '咖啡',
    '手搖',
    '奶茶',
    '珍奶',
    '便當',
    '麵',
    '飯',
    '餐',
    '火鍋',
    '餐廳',
    '外送',
    'Uber Eats',
    'UberEats',
    'foodpanda',
    '超商',
    '便利商店',
    '麥當勞',
    '星巴克',
    '披薩',
    '漢堡',
    '水果',
    '小吃',
    '燒烤',
    '早點',
  ],
  交通: [
    '捷運',
    '公車',
    '客運',
    '計程車',
    'Uber',
    '高鐵',
    '台鐵',
    '火車',
    '加油',
    '油錢',
    '油費',
    '停車',
    '過路費',
    'ETC',
    'Ubike',
    '機票',
    '搭車',
    '車資',
  ],
  購物: [
    '衣服',
    '褲子',
    '鞋',
    '包包',
    '蝦皮',
    'momo',
    '網購',
    '3C',
    '手機殼',
    '外套',
    '裙子',
    '襪子',
  ],
  日用品: [
    '衛生紙',
    '洗髮精',
    '沐浴乳',
    '牙膏',
    '清潔',
    '日用品',
    '全聯',
    '家樂福',
    '洗衣精',
    '衛生棉',
    '牙刷',
    '面紙',
  ],
  居家: ['房租', '租金', '家具', '家電', '修繕', '管理費'],
  帳單: [
    '電費',
    '水費',
    '瓦斯',
    '網路費',
    '電話費',
    '手機費',
    '話費',
    '電信費',
    '水電',
    '保險',
    '訂閱',
    'Netflix',
    'Spotify',
  ],
  娛樂: ['電影', '遊戲', 'KTV', '唱歌', '旅遊', '門票', '演唱會', '唱K'],
  醫療: ['看醫生', '看診', '診所', '醫院', '掛號', '藥', '牙醫', '藥局', '健保'],
  教育: ['書', '課程', '學費', '補習', '教材'],
  社交: ['聚餐', '請客', '禮物', '紅包', '份子錢', '送禮', '禮金'],
};

export const INCOME_CATEGORY_KEYWORDS: Record<string, string[]> = {
  薪資: ['薪水', '薪資', '月薪'],
  獎金: ['獎金', '年終', '三節'],
  投資: ['利息', '股利', '股息', '配息'],
  兼職: ['兼職', '打工', '接案', '稿費'],
};

// 出現其中任何一個詞就視為收入。
const INCOME_TYPE_KEYWORDS: string[] = [
  '薪水',
  '薪資',
  '月薪',
  '獎金',
  '年終',
  '紅包收入',
  '收入',
  '入帳',
  '進帳',
  '利息',
  '股利',
  '股息',
  '配息',
  '退款',
  '退費',
  '兼職',
  '打工',
  '接案',
  '稿費',
];

// ---------------------------------------------------------------------------
// 日期小工具（當地時間，不用 toISOString）
// ---------------------------------------------------------------------------

type Ymd = { y: number; m: number; d: number };

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatYmd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function parseYmd(s: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return isValidYmd(y, mo, d) ? { y, m: mo, d } : null;
}

function addDays(base: Ymd, days: number): string {
  const dt = new Date(base.y, base.m - 1, base.d + days);
  return formatYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/** 月/日：若在 today 之後（今年），視為去年；不合法回傳 null。 */
function resolveMonthDay(today: Ymd, m: number, d: number): string | null {
  const todayStr = formatYmd(today.y, today.m, today.d);
  if (!isValidYmd(today.y, m, d)) return null;
  const thisYear = formatYmd(today.y, m, d);
  if (thisYear <= todayStr) return thisYear;
  return isValidYmd(today.y - 1, m, d) ? formatYmd(today.y - 1, m, d) : null;
}

/** 只有日：當月；若那天在 today 之後，視為上個月；不合法回傳 null。 */
function resolveDayOnly(today: Ymd, d: number): string | null {
  if (!isValidYmd(today.y, today.m, d)) return null;
  const todayStr = formatYmd(today.y, today.m, today.d);
  const thisMonth = formatYmd(today.y, today.m, d);
  if (thisMonth <= todayStr) return thisMonth;
  const py = today.m === 1 ? today.y - 1 : today.y;
  const pm = today.m === 1 ? 12 : today.m - 1;
  return isValidYmd(py, pm, d) ? formatYmd(py, pm, d) : null;
}

// ---------------------------------------------------------------------------
// 文字小工具
// ---------------------------------------------------------------------------

type Span = { start: number; end: number };

/** 全形數字／英文字母／＄．／ 與數字間的全形逗號轉半形（長度不變，索引可沿用）。 */
function normalizeWidth(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[＄．／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/(\d)，(?=\d)/g, '$1,');
}

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

function isDigitChar(ch: string): boolean {
  return ch >= '0' && ch <= '9' && ch.length === 1;
}

// ---------------------------------------------------------------------------
// 數字解析
// ---------------------------------------------------------------------------

const CN_DIGIT: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  兩: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  壹: 1,
  貳: 2,
  贰: 2,
  參: 3,
  叁: 3,
  肆: 4,
  伍: 5,
  陸: 6,
  陆: 6,
  柒: 7,
  捌: 8,
  玖: 9,
};

const CN_UNIT: Record<string, number> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
  萬: 10000,
  万: 10000,
};

const CN_CHARS = Object.keys(CN_DIGIT).join('') + Object.keys(CN_UNIT).join('');
const CN_UNIT_CHARS = Object.keys(CN_UNIT).join('');

// 單一數字元素：阿拉伯數字（可含千分位與小數）或一個中文數字字元。
const NUMBER_ELEMENT = `(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|[${CN_CHARS}])`;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 解析中文數字或中阿混合數字，例如「一百二」=120、「兩百五」=250、
 * 「一千零五十」=1050、「1.5萬」=15000、「2萬3」=23000。
 * 解析不了回傳 null。結果一定 > 0 且最多兩位小數。
 */
export function parseChineseNumber(text: string): number | null {
  const s = normalizeWidth(String(text ?? ''))
    .replace(/\s+/g, '')
    .replace(/^(?:NTD?\$?|\$)/i, '')
    .replace(/(?:元|塊|块|圓|圆)(?:錢|钱)?$/, '')
    .replace(/(\d),(?=\d)/g, '$1');
  if (s === '') return null;

  // 純阿拉伯數字
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    const v = round2(Number(s));
    return v > 0 ? v : null;
  }

  const tokens = s.match(new RegExp(`\\d+(?:\\.\\d+)?|[${CN_CHARS}]`, 'g'));
  if (!tokens || tokens.join('') !== s) return null;

  let total = 0; // 已結算的「萬」以上部分
  let section = 0; // 目前萬以下的累計
  let cur: number | null = null; // 尚未乘單位的數字
  let lastUnit = 0; // 最近一次的單位，用來處理「一百二」「兩萬三」這類省略單位的寫法
  let zeroSeen = false;

  for (const tok of tokens) {
    if (isDigitChar(tok.charAt(0))) {
      if (cur !== null) return null;
      cur = Number(tok);
      continue;
    }
    const digit = CN_DIGIT[tok];
    if (digit !== undefined) {
      if (digit === 0) {
        if (cur !== null) return null;
        zeroSeen = true;
        continue;
      }
      if (cur !== null) return null;
      cur = digit;
      continue;
    }
    const unit = CN_UNIT[tok];
    if (unit === undefined) return null;
    if (unit === 10) {
      section += (cur ?? 1) * 10;
    } else if (unit === 10000) {
      const base = section + (cur ?? 0);
      if (base <= 0) return null;
      total += base * 10000;
      section = 0;
    } else {
      if (cur === null) return null;
      section += cur * unit;
    }
    cur = null;
    lastUnit = unit;
    zeroSeen = false;
  }

  if (cur !== null) {
    // 「一百二」=120、「三千五」=3500、「一萬五」=15000：個位數接在百／千／萬之後，省略下一個單位。
    if (lastUnit >= 100 && !zeroSeen && Number.isInteger(cur) && cur >= 1 && cur <= 9) {
      section += (cur * lastUnit) / 10;
    } else {
      section += cur;
    }
  }

  const result = round2(total + section);
  return result > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// 日期偵測
// ---------------------------------------------------------------------------

const RELATIVE_DAYS: Record<string, number> = {
  今天: 0,
  昨天: -1,
  前天: -2,
  大前天: -3,
};

function scanDates(text: string, today: Ymd): { spans: Span[]; date: string | null } {
  const spans: Span[] = [];
  let date: string | null = null;

  const free = (span: Span) => !spans.some((s) => overlaps(s, span));
  const accept = (span: Span, resolved: string | null) => {
    spans.push(span);
    if (date === null && resolved !== null) date = resolved;
  };

  // 10月28日／10月28號／10月28
  const monthDay = /(\d{1,2})月(\d{1,2})(日|號|号)?/g;
  for (let m = monthDay.exec(text); m; m = monthDay.exec(text)) {
    const start = m.index;
    const end = start + m[0].length;
    if (isDigitChar(text.charAt(start - 1))) continue;
    if (!m[3] && isDigitChar(text.charAt(end))) continue;
    const span = { start, end };
    if (free(span)) accept(span, resolveMonthDay(today, Number(m[1]), Number(m[2])));
  }

  // 10/28
  const slash = /(\d{1,2})\/(\d{1,2})/g;
  for (let m = slash.exec(text); m; m = slash.exec(text)) {
    const start = m.index;
    const end = start + m[0].length;
    if (/[\d/.,]/.test(text.charAt(start - 1)) && start > 0) continue;
    if (/[\d/]/.test(text.charAt(end)) && end < text.length) continue;
    const span = { start, end };
    if (free(span)) accept(span, resolveMonthDay(today, Number(m[1]), Number(m[2])));
  }

  // 28號／28日
  const dayOnly = /(\d{1,2})(?:日|號|号)/g;
  for (let m = dayOnly.exec(text); m; m = dayOnly.exec(text)) {
    const start = m.index;
    const end = start + m[0].length;
    if (/[\d.,]/.test(text.charAt(start - 1)) && start > 0) continue;
    const span = { start, end };
    if (free(span)) accept(span, resolveDayOnly(today, Number(m[1])));
  }

  // 今天／昨天／前天／大前天
  const relative = /大前天|前天|昨天|今天/g;
  for (let m = relative.exec(text); m; m = relative.exec(text)) {
    const span = { start: m.index, end: m.index + m[0].length };
    if (free(span)) accept(span, addDays(today, RELATIVE_DAYS[m[0]]));
  }

  return { spans, date };
}

// ---------------------------------------------------------------------------
// 金額偵測
// ---------------------------------------------------------------------------

type AmountCandidate = {
  value: number;
  marked: boolean; // 帶有 元／塊／$／NT 標記
  span: Span; // 含標記的範圍
};

const PREFIX_MARKER = /(?:NTD?\s*\$?|\$)\s*$/i;
const SUFFIX_MARKER = /^\s*(?:元|塊|块|圓|圆)(?:錢|钱)?/;

function pickAmount(text: string, dateSpans: Span[]): { value: number; span: Span } | null {
  const candidates: AmountCandidate[] = [];
  const re = new RegExp(`${NUMBER_ELEMENT}+`, 'g');

  for (let m = re.exec(text); m; m = re.exec(text)) {
    const raw = m[0];
    const start = m.index;
    const end = start + raw.length;
    if (dateSpans.some((s) => overlaps(s, { start, end }))) continue;

    let from = start;
    let to = end;
    let marked = false;

    const before = text.slice(0, start);
    const pm = PREFIX_MARKER.exec(before);
    if (
      pm &&
      (pm[0].charAt(0) === '$' || pm.index === 0 || !/[A-Za-z]/.test(before.charAt(pm.index - 1)))
    ) {
      marked = true;
      from = pm.index;
    }
    const after = text.slice(end);
    const sm = SUFFIX_MARKER.exec(after);
    if (sm) {
      marked = true;
      to = end + sm[0].length;
    }

    if (!marked) {
      const next = after.charAt(0);
      // 例如「3C」「5g」這類英文縮寫不是金額
      if (/[A-Za-z]/.test(next)) continue;
      if (/\d/.test(raw)) {
        // 「10月」「3點」這類不是金額
        if (/[月年點点時时]/.test(next)) continue;
      } else {
        // 純中文數字：單一個字（一個、百貨、十分…）不當金額，必須含十百千萬等單位
        if (raw.length < 2) continue;
        if (!new RegExp(`[${CN_UNIT_CHARS}]`).test(raw)) continue;
        // 「二十號」「三十分鐘」之類是日期或數量
        if (/[號号日月天個个次人分點点年週周杯碗份顆張]/.test(next)) continue;
      }
    }

    const value = parseChineseNumber(raw);
    if (value === null || value <= 0 || value > MAX_AMOUNT) continue;
    candidates.push({ value, marked, span: { start: from, end: to } });
  }

  if (candidates.length === 0) return null;
  const marked = candidates.filter((c) => c.marked);
  const pool = marked.length > 0 ? marked : candidates;
  const chosen = pool[pool.length - 1];
  return { value: chosen.value, span: chosen.span };
}

// ---------------------------------------------------------------------------
// 分類與收支
// ---------------------------------------------------------------------------

function matchCategory(text: string, table: Record<string, string[]>): string | null {
  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  let best: string | null = null;
  let bestLength = 0;
  for (const name of Object.keys(table)) {
    for (const keyword of table[name]) {
      const k = keyword.toLowerCase();
      if (k.length > bestLength && lower.includes(k)) {
        best = name;
        bestLength = k.length;
      }
    }
  }
  return best;
}

function buildNote(text: string, removed: Span[]): string {
  const sorted = [...removed].sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const span of sorted) {
    if (span.start >= pos) {
      out += `${text.slice(pos, span.start)} `;
      pos = span.end;
    } else if (span.end > pos) {
      pos = span.end;
    }
  }
  out += text.slice(pos);

  const cleaned = out
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,，、;；:：.。\s]+|[,，、;；:：.。\s]+$/g, '');
  return Array.from(cleaned).slice(0, MAX_NOTE_LENGTH).join('').trim();
}

// ---------------------------------------------------------------------------
// 主函式
// ---------------------------------------------------------------------------

/**
 * 把一句話解析成一筆記帳。
 * @param text 使用者輸入或語音聽寫的文字
 * @param today 今天的日期（YYYY-MM-DD，當地時間），用來推算相對日期
 */
export function parseQuickText(text: string, today: string): QuickParseResult {
  const todayYmd = parseYmd(today);
  if (!todayYmd) {
    throw new RangeError('today 必須是合法的 YYYY-MM-DD 日期字串');
  }

  const src = normalizeWidth(typeof text === 'string' ? text : '');
  const dates = scanDates(src, todayYmd);
  const amount = pickAmount(src, dates.spans);

  const lower = src.toLowerCase();
  const type: 'expense' | 'income' = INCOME_TYPE_KEYWORDS.some((k) => lower.includes(k))
    ? 'income'
    : 'expense';
  const categoryName = matchCategory(
    src,
    type === 'income' ? INCOME_CATEGORY_KEYWORDS : EXPENSE_CATEGORY_KEYWORDS,
  );

  const removed = amount ? [...dates.spans, amount.span] : dates.spans;

  return {
    amount: amount ? amount.value : null,
    type,
    occurredOn: dates.date ?? today,
    categoryName,
    note: buildNote(src, removed),
  };
}
