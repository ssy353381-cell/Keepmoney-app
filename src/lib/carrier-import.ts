// 手機條碼載具消費明細匯入（純函式）。
// 我們拿不到財政部電子發票整合服務平台匯出檔的官方格式原文，
// 所以解析器依「表頭名稱」找欄位、容忍格式差異；解析不了就明確回報，不亂猜。
// 支援兩種格式：
//   pipe：以「|」分隔，M 列是發票表頭、D 列是明細（品項）。
//   csv ：一般逗號分隔，第一列是中文表頭。

import { isValidDateString } from '@/lib/date';
import { MAX_AMOUNT, parseAmount, parseBalance } from '@/lib/money';
import { EXPENSE_CATEGORY_KEYWORDS } from '@/lib/quick-parse';

export type CarrierInvoice = {
  /** AB12345678（轉大寫、去空白與連字號後須符合 ^[A-Z]{2}\d{8}$） */
  invoiceNumber: string;
  /** YYYY-MM-DD 西元 */
  date: string;
  /** > 0，最多兩位小數 */
  amount: number;
  storeName: string | null;
  /** 8 位數字 */
  sellerId: string | null;
  /** 品名（去重、保留順序） */
  items: string[];
  status: 'issued' | 'void';
};

export type CarrierParseResult = {
  format: 'pipe' | 'csv';
  /** 依日期由舊到新、同日依發票號碼 */
  invoices: CarrierInvoice[];
  /** 1-based 行號與中文原因 */
  skipped: { line: number; reason: string }[];
};

const NOTE_MAX_LENGTH = 200;
const NOTE_MAX_ITEMS = 2;

const UNRECOGNIZED_ERROR =
  '看不懂這個檔案的格式，請確認是從財政部電子發票整合服務平台匯出的載具消費明細';

// ---------------------------------------------------------------------------
// 欄位名稱（同義詞，越前面優先）
// ---------------------------------------------------------------------------

const FIELD_NAMES = {
  invoiceNumber: ['發票號碼'],
  date: ['發票日期', '開立日期', '消費日期'],
  store: ['商店店名', '商店名稱', '賣方名稱', '店家'],
  seller: ['商店統編', '賣方統編'],
  // 這三個都視為「整張發票的總金額」
  total: ['總金額', '發票金額', '金額'],
  status: ['發票狀態', '狀態'],
  item: ['品項名稱', '品名', '品項'],
  // 只有品項小計、沒有總金額欄時，才會用小計加總
  subtotal: ['小計', '品項小計', '品項金額'],
} as const;

type Columns = {
  invoiceNumber: number;
  date: number;
  store: number;
  seller: number;
  total: number;
  status: number;
  item: number;
  subtotal: number;
};

function normalizeHeader(value: string): string {
  return value.replace(/[\s　﻿]/g, '');
}

function findColumn(headers: string[], names: readonly string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const name of names) {
    const index = normalized.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function resolveColumns(headers: string[]): Columns {
  return {
    invoiceNumber: findColumn(headers, FIELD_NAMES.invoiceNumber),
    date: findColumn(headers, FIELD_NAMES.date),
    store: findColumn(headers, FIELD_NAMES.store),
    seller: findColumn(headers, FIELD_NAMES.seller),
    total: findColumn(headers, FIELD_NAMES.total),
    status: findColumn(headers, FIELD_NAMES.status),
    item: findColumn(headers, FIELD_NAMES.item),
    subtotal: findColumn(headers, FIELD_NAMES.subtotal),
  };
}

function cell(fields: string[], index: number): string {
  return index >= 0 ? (fields[index] ?? '').trim() : '';
}

// ---------------------------------------------------------------------------
// 單一欄位解析
// ---------------------------------------------------------------------------

function parseInvoiceNumber(raw: string): string | null {
  const value = raw.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z]{2}\d{8}$/.test(value) ? value : null;
}

function pad2(value: string): string {
  return value.padStart(2, '0');
}

/** 西元 8 碼、民國 7 碼，或用 / - . 分隔的西元（4 位年）／民國（3 位年）日期；不合法回傳 null。 */
function parseDate(raw: string): string | null {
  const text = raw.trim().split(/[\sT]/)[0] ?? '';
  let year: number;
  let month: string;
  let day: string;

  let match = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (match) {
    year = Number(match[1]);
    month = match[2];
    day = match[3];
  } else if ((match = /^(\d{3})(\d{2})(\d{2})$/.exec(text))) {
    year = Number(match[1]) + 1911;
    month = match[2];
    day = match[3];
    if (Number(match[1]) < 1) return null;
  } else if ((match = /^(\d{3,4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(text))) {
    year = match[1].length === 4 ? Number(match[1]) : Number(match[1]) + 1911;
    month = pad2(match[2]);
    day = pad2(match[3]);
    if (match[1].length === 3 && Number(match[1]) < 1) return null;
  } else {
    return null;
  }

  const result = `${String(year).padStart(4, '0')}-${month}-${day}`;
  return isValidDateString(result) ? result : null;
}

function cleanMoney(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:NT\$|NTD|TWD|\$)/i, '')
    .replace(/(?:元|圓)$/, '')
    .trim();
}

/** 金額：千分位、「元」都可以；必須 > 0、最多兩位小數。 */
function parseMoney(raw: string): number | null {
  return parseAmount(cleanMoney(raw));
}

/** 品項小計：可以是 0 或負數（折扣），空白視為不合法。 */
function parseSignedMoney(raw: string): number | null {
  const cleaned = cleanMoney(raw);
  return cleaned === '' ? null : parseBalance(cleaned);
}

function parseStatus(raw: string): 'issued' | 'void' {
  return /作廢|註銷|折讓/.test(raw) ? 'void' : 'issued';
}

function parseSellerId(raw: string): string | null {
  const value = raw.trim();
  return /^\d{8}$/.test(value) ? value : null;
}

// ---------------------------------------------------------------------------
// 暫存的發票（解析過程使用）
// ---------------------------------------------------------------------------

type Draft = {
  line: number;
  invoiceNumber: string;
  date: string;
  /** 以「分」計，避免浮點誤差 */
  cents: number;
  storeName: string | null;
  sellerId: string | null;
  items: string[];
  status: 'issued' | 'void';
  /** 同一張發票多列的總金額不一致 */
  conflict: boolean;
};

function addItem(draft: Draft, name: string): void {
  const value = name.trim();
  if (value !== '' && !draft.items.includes(value)) draft.items.push(value);
}

function toInvoice(draft: Draft): CarrierInvoice {
  return {
    invoiceNumber: draft.invoiceNumber,
    date: draft.date,
    amount: draft.cents / 100,
    storeName: draft.storeName,
    sellerId: draft.sellerId,
    items: draft.items,
    status: draft.status,
  };
}

function sortInvoices(invoices: CarrierInvoice[]): CarrierInvoice[] {
  return [...invoices].sort((a, b) =>
    a.date !== b.date
      ? a.date < b.date
        ? -1
        : 1
      : a.invoiceNumber < b.invoiceNumber
        ? -1
        : a.invoiceNumber > b.invoiceNumber
          ? 1
          : 0,
  );
}

function missingFieldsError(missing: string[]): { error: string } {
  return { error: `檔案缺少必要欄位：${missing.join('、')}` };
}

// ---------------------------------------------------------------------------
// pipe 格式
// ---------------------------------------------------------------------------

const DEFAULT_M_HEADERS = [
  'M',
  '載具名稱',
  '載具號碼',
  '發票日期',
  '商店統編',
  '商店店名',
  '發票號碼',
  '總金額',
  '發票狀態',
];
const DEFAULT_D_HEADERS = ['D', '發票號碼', '小計', '品項名稱'];

function splitPipe(line: string): string[] {
  return line.split('|').map((part) => part.trim());
}

function descriptionHeaders(line: string): string[] {
  const rest = line.slice(line.search(/[=＝]/) + 1);
  return splitPipe(rest);
}

function parsePipe(lines: string[]): CarrierParseResult | { error: string } {
  // 先找說明列：有的話欄位位置以說明列的名稱為準，沒有就用預設順序。
  let mHeaders = DEFAULT_M_HEADERS;
  let dHeaders = DEFAULT_D_HEADERS;
  let hasMDescription = false;
  let hasDDescription = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!hasMDescription && /^表頭[=＝]/.test(line)) {
      mHeaders = descriptionHeaders(line);
      hasMDescription = true;
    } else if (!hasDDescription && /^明細[=＝]/.test(line)) {
      dHeaders = descriptionHeaders(line);
      hasDDescription = true;
    }
  }

  const m = resolveColumns(mHeaders);
  const d = resolveColumns(dHeaders);

  const missing: string[] = [];
  if (m.invoiceNumber < 0) missing.push('發票號碼');
  if (m.date < 0) missing.push('日期');
  if (m.total < 0) missing.push('金額');
  if (missing.length > 0) return missingFieldsError(missing);

  const drafts: Draft[] = [];
  const skipped: { line: number; reason: string }[] = [];
  // 同一個發票號碼出現多次時，明細列接在最近一筆 M 列後面
  const latest = new Map<string, Draft>();
  // 有 M 列但被略過的發票號碼：它的 D 列不必再重複回報
  const knownNumbers = new Set<string>();

  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trim();
    if (line === '' || /^表頭[=＝]/.test(line) || /^明細[=＝]/.test(line)) return;

    if (line.startsWith('M|')) {
      const fields = splitPipe(line);
      const rawNumber = cell(fields, m.invoiceNumber);
      const number = parseInvoiceNumber(rawNumber);
      if (number === null) {
        skipped.push({
          line: lineNo,
          reason: rawNumber === '' ? '沒有發票號碼' : `發票號碼格式不正確：${rawNumber}`,
        });
        return;
      }
      knownNumbers.add(number);
      const rawDate = cell(fields, m.date);
      const date = parseDate(rawDate);
      if (date === null) {
        skipped.push({
          line: lineNo,
          reason: `日期不合法：${rawDate === '' ? '（空白）' : rawDate}`,
        });
        return;
      }
      const rawAmount = cell(fields, m.total);
      const amount = parseMoney(rawAmount);
      if (amount === null) {
        skipped.push({
          line: lineNo,
          reason: `金額不是正數：${rawAmount === '' ? '（空白）' : rawAmount}`,
        });
        return;
      }
      const draft: Draft = {
        line: lineNo,
        invoiceNumber: number,
        date,
        cents: Math.round(amount * 100),
        storeName: cell(fields, m.store) || null,
        sellerId: parseSellerId(cell(fields, m.seller)),
        items: [],
        status: parseStatus(cell(fields, m.status)),
        conflict: false,
      };
      drafts.push(draft);
      latest.set(number, draft);
      return;
    }

    if (line.startsWith('D|')) {
      // 找不到明細欄位時（說明列寫的欄位名稱不認得）就不收品名，也不報錯
      if (d.invoiceNumber < 0 || d.item < 0) return;
      const fields = splitPipe(line);
      const rawNumber = cell(fields, d.invoiceNumber);
      const number = parseInvoiceNumber(rawNumber);
      if (number === null) {
        skipped.push({ line: lineNo, reason: `明細列的發票號碼格式不正確：${rawNumber}` });
        return;
      }
      const target = latest.get(number);
      if (!target) {
        if (!knownNumbers.has(number)) {
          skipped.push({ line: lineNo, reason: `找不到對應的發票表頭列：${number}` });
        }
        return;
      }
      addItem(target, cell(fields, d.item));
      return;
    }

    skipped.push({ line: lineNo, reason: '無法辨識的列（開頭不是 M| 或 D|）' });
  });

  return {
    format: 'pipe',
    invoices: sortInvoices(drafts.map(toInvoice)),
    skipped: skipped.sort((a, b) => a.line - b.line),
  };
}

// ---------------------------------------------------------------------------
// csv 格式
// ---------------------------------------------------------------------------

/** 標準 CSV 解析：雙引號包欄位、"" 代表一個雙引號、引號內可換行。line 是該筆記錄開頭的行號。 */
function parseCsvRecords(text: string): { line: number; fields: string[] }[] {
  const records: { line: number; fields: string[] }[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
        if (ch === '\n') line++;
      }
    } else if (ch === '"' && field.trim() === '') {
      field = '';
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else if (ch === '\n') {
      fields.push(field);
      records.push({ line: recordLine, fields });
      fields = [];
      field = '';
      line++;
      recordLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== '' || fields.length > 0) {
    fields.push(field);
    records.push({ line: recordLine, fields });
  }

  return records.filter((r) => !(r.fields.length === 1 && r.fields[0].trim() === ''));
}

function parseCsv(text: string): CarrierParseResult | { error: string } {
  const records = parseCsvRecords(text);
  const header = records[0]?.fields ?? [];
  const c = resolveColumns(header);

  // 金額判斷規則：有「總金額／發票金額／金額」欄就當整張發票的總金額（同一張發票多列時，
  // 取第一列；各列不一致就整張略過並回報）；沒有這些欄、只有「小計／品項小計／品項金額」時，
  // 才把同一張發票各列的小計加總。
  const useTotal = c.total >= 0;
  const useSubtotal = !useTotal && c.subtotal >= 0;

  const missing: string[] = [];
  if (c.invoiceNumber < 0) missing.push('發票號碼');
  if (c.date < 0) missing.push('日期');
  if (!useTotal && !useSubtotal) missing.push('金額');
  if (missing.length > 0) return missingFieldsError(missing);

  const drafts = new Map<string, Draft>();
  const skipped: { line: number; reason: string }[] = [];

  for (const record of records.slice(1)) {
    const { line, fields } = record;
    const rawNumber = cell(fields, c.invoiceNumber);
    const number = parseInvoiceNumber(rawNumber);
    if (number === null) {
      skipped.push({
        line,
        reason: rawNumber === '' ? '沒有發票號碼' : `發票號碼格式不正確：${rawNumber}`,
      });
      continue;
    }

    let draft = drafts.get(number);
    if (!draft) {
      const rawDate = cell(fields, c.date);
      const date = parseDate(rawDate);
      if (date === null) {
        skipped.push({ line, reason: `日期不合法：${rawDate === '' ? '（空白）' : rawDate}` });
        continue;
      }
      let cents: number;
      if (useTotal) {
        const rawAmount = cell(fields, c.total);
        const amount = parseMoney(rawAmount);
        if (amount === null) {
          skipped.push({
            line,
            reason: `金額不是正數：${rawAmount === '' ? '（空白）' : rawAmount}`,
          });
          continue;
        }
        cents = Math.round(amount * 100);
      } else {
        const rawAmount = cell(fields, c.subtotal);
        const amount = parseSignedMoney(rawAmount);
        if (amount === null) {
          skipped.push({
            line,
            reason: `品項小計不是有效金額：${rawAmount === '' ? '（空白）' : rawAmount}`,
          });
          continue;
        }
        cents = Math.round(amount * 100);
      }
      draft = {
        line,
        invoiceNumber: number,
        date,
        cents,
        storeName: null,
        sellerId: null,
        items: [],
        status: 'issued',
        conflict: false,
      };
      drafts.set(number, draft);
    } else if (useTotal) {
      const amount = parseMoney(cell(fields, c.total));
      if (amount !== null && Math.round(amount * 100) !== draft.cents) draft.conflict = true;
    } else {
      const rawAmount = cell(fields, c.subtotal);
      const amount = parseSignedMoney(rawAmount);
      if (amount === null) {
        skipped.push({
          line,
          reason: `品項小計不是有效金額：${rawAmount === '' ? '（空白）' : rawAmount}`,
        });
        continue;
      }
      draft.cents += Math.round(amount * 100);
    }

    // 合併這一列的其他資訊
    if (draft.storeName === null) draft.storeName = cell(fields, c.store) || null;
    if (draft.sellerId === null) draft.sellerId = parseSellerId(cell(fields, c.seller));
    if (parseStatus(cell(fields, c.status)) === 'void') draft.status = 'void';
    addItem(draft, cell(fields, c.item));
  }

  const invoices: CarrierInvoice[] = [];
  for (const draft of drafts.values()) {
    if (draft.conflict) {
      skipped.push({
        line: draft.line,
        reason: `同一張發票（${draft.invoiceNumber}）的多列金額不一致，無法判斷哪個是總金額`,
      });
    } else if (draft.cents <= 0 || draft.cents / 100 > MAX_AMOUNT) {
      skipped.push({
        line: draft.line,
        reason: `發票（${draft.invoiceNumber}）的金額不是有效的正數`,
      });
    } else {
      invoices.push(toInvoice(draft));
    }
  }

  return {
    format: 'csv',
    invoices: sortInvoices(invoices),
    skipped: skipped.sort((a, b) => a.line - b.line),
  };
}

// ---------------------------------------------------------------------------
// 主函式
// ---------------------------------------------------------------------------

/** 解析載具消費明細檔的文字內容。看不懂或缺必要欄位回傳 { error }；單列有問題只會放進 skipped。 */
export function parseCarrierFile(text: string): CarrierParseResult | { error: string } {
  const normalized = (typeof text === 'string' ? text : '')
    .replace(/^﻿+/, '')
    .replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  if (lines.some((line) => line.trim().startsWith('M|'))) {
    return parsePipe(lines);
  }

  const first = lines.find((line) => line.trim() !== '');
  if (first !== undefined && first.includes(',')) {
    const headers = parseCsvRecords(normalized)[0]?.fields ?? [];
    if (findColumn(headers, FIELD_NAMES.invoiceNumber) >= 0) {
      return parseCsv(normalized);
    }
  }

  return { error: UNRECOGNIZED_ERROR };
}

// ---------------------------------------------------------------------------
// 分類猜測
// ---------------------------------------------------------------------------

// 店名關鍵字（key 是預設分類名稱）。比對時忽略大小寫、空白與連字號。
const STORE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  飲食: [
    '全家',
    '7-ELEVEN',
    '7-11',
    '統一超商',
    '萊爾富',
    'OK超商',
    '麥當勞',
    '肯德基',
    '摩斯漢堡',
    '漢堡王',
    '星巴克',
    '路易莎',
    '85度C',
    '八方雲集',
    '鼎泰豐',
    '王品',
    '瓦城',
    '吉野家',
    '壽司郎',
    '爭鮮',
    '必勝客',
    '達美樂',
    '清心福全',
    '50嵐',
    '可不可熟成',
    '迷客夏',
    '大苑子',
    '麻古茶坊',
    '珍煮丹',
    '得正',
    'CoCo都可',
    '喫茶趣',
  ],
  日用品: [
    '全聯',
    '家樂福',
    '大潤發',
    '愛買',
    '美廉社',
    '屈臣氏',
    '康是美',
    '寶雅',
    '小北百貨',
    '好市多',
    'Costco',
  ],
  交通: [
    '中油',
    '台灣中油',
    '台塑石化',
    '全國加油站',
    '台灣高鐵',
    '臺灣高鐵',
    '台灣鐵路',
    '台鐵',
    '悠遊卡',
    '一卡通',
    '台灣大車隊',
    '遠通電收',
    'YouBike',
    '微笑單車',
  ],
  居家: ['IKEA', '宜家', '特力屋', 'HOLA', '宜得利', '詩肯柏'],
  教育: ['誠品', '博客來', '金石堂', '三民書局'],
  購物: [
    '蝦皮',
    'momo',
    'PChome',
    '燦坤',
    '全國電子',
    '無印良品',
    'UNIQLO',
    'ZARA',
    '新光三越',
    'SOGO',
    '遠東百貨',
    '微風',
  ],
  醫療: ['大樹藥局', '杏一', '丁丁藥局'],
  娛樂: ['威秀', '國賓影城', '秀泰', '好樂迪', '錢櫃'],
  帳單: ['台灣電力', '台灣自來水', '中華電信', '台灣大哥大', '遠傳電信', '亞太電信'],
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[\s\-－]/g, '');
}

/**
 * 用店名＋品名猜分類：店名關鍵字表與 EXPENSE_CATEGORY_KEYWORDS 一起比，最長關鍵字優先；
 * 長度相同時店名表優先。都沒有命中回傳 null。
 */
export function guessCarrierCategory(invoice: CarrierInvoice): string | null {
  const store = invoice.storeName ?? '';
  const storeCompact = compact(store);
  const haystack = [store, ...invoice.items]
    .join('\n')
    .toLowerCase()
    .replace(/[ \t]+/g, ' ');

  let best: string | null = null;
  let bestLength = 0;

  for (const name of Object.keys(STORE_CATEGORY_KEYWORDS)) {
    for (const keyword of STORE_CATEGORY_KEYWORDS[name]) {
      const k = compact(keyword);
      if (k.length > bestLength && storeCompact.includes(k)) {
        best = name;
        bestLength = k.length;
      }
    }
  }
  for (const name of Object.keys(EXPENSE_CATEGORY_KEYWORDS)) {
    for (const keyword of EXPENSE_CATEGORY_KEYWORDS[name]) {
      const k = keyword.toLowerCase();
      if (k.length > bestLength && haystack.includes(k)) {
        best = name;
        bestLength = k.length;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 備註與匯入規劃
// ---------------------------------------------------------------------------

/** 記帳備註：「全家便利商店：拿鐵咖啡、御飯糰」；品名超過 2 個寫「等 N 項」；最多 200 字。 */
export function carrierNote(invoice: CarrierInvoice): string {
  const store = (invoice.storeName ?? '').trim();
  const names = invoice.items.map((item) => item.trim()).filter((item) => item !== '');

  let itemText = '';
  if (names.length > 0) {
    const shown = names.slice(0, NOTE_MAX_ITEMS).join('、');
    itemText = names.length > NOTE_MAX_ITEMS ? `${shown}等 ${names.length} 項` : shown;
  }

  let note: string;
  if (store !== '' && itemText !== '') note = `${store}：${itemText}`;
  else if (store !== '') note = store;
  else if (itemText !== '') note = itemText;
  else note = `發票 ${invoice.invoiceNumber}`;

  const chars = Array.from(note);
  return chars.length > NOTE_MAX_LENGTH ? chars.slice(0, NOTE_MAX_LENGTH).join('') : note;
}

/** 決定哪些發票要匯入：排除作廢、資料庫已有的、檔案內重複的（保留第一筆）。 */
export function planCarrierImport(
  invoices: CarrierInvoice[],
  existingInvoiceNumbers: Set<string>,
): { toImport: CarrierInvoice[]; duplicates: number; voided: number } {
  const toImport: CarrierInvoice[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let voided = 0;

  for (const invoice of invoices) {
    if (invoice.status === 'void') {
      voided++;
      continue;
    }
    if (existingInvoiceNumbers.has(invoice.invoiceNumber) || seen.has(invoice.invoiceNumber)) {
      duplicates++;
      continue;
    }
    seen.add(invoice.invoiceNumber);
    toImport.push(invoice);
  }

  return { toImport, duplicates, voided };
}
