/**
 * 台灣電子發票證明聯 QR code 解析（純函式、零相依）。
 *
 * 左方 QR 前 77 字元為固定欄位，之後以冒號分隔品目資料；
 * 右方 QR 以 `**` 開頭，接續左方未寫完的品目。
 * 解析寬容、驗證嚴格：格式不符一律回傳 null，不猜測。
 */

export type InvoiceItem = { name: string; quantity: number; unitPrice: number };

export type InvoiceQr = {
  /** 發票字軌號碼，例如 AB12345678 */
  invoiceNumber: string;
  /** 開立日期 YYYY-MM-DD（西元） */
  date: string;
  randomCode: string;
  /** 銷售額（未稅） */
  salesAmount: number;
  /** 總計額（含稅） */
  totalAmount: number;
  /** 記帳用金額：總計額大於 0 用總計額，否則用銷售額 */
  amount: number;
  /** 買方統編；00000000 視為沒有 */
  buyerId: string | null;
  sellerId: string;
  /** 能解析的品目（Big5 編碼時為空陣列） */
  items: InvoiceItem[];
  /** 左右合併後品目數仍少於「交易品目總筆數」 */
  itemsTruncated: boolean;
};

const FIXED_LENGTH = 77;
const NOTE_MAX_LENGTH = 200;

const LEFT_FIXED_PATTERN = /^[A-Z]{2}\d{8}\d{7}\d{4}[0-9A-Fa-f]{8}[0-9A-Fa-f]{8}\d{8}\d{8}/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** 民國日期 `YYYMMDD`（7 碼）轉西元 `YYYY-MM-DD`；不合法回傳 null。 */
export function rocDateToAd(roc: string): string | null {
  if (!/^\d{7}$/.test(roc)) return null;
  const rocYear = Number(roc.slice(0, 3));
  const month = Number(roc.slice(3, 5));
  const day = Number(roc.slice(5, 7));
  if (rocYear < 100 || rocYear > 199) return null;
  const year = rocYear + 1911;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** 是否為左方 QR（固定欄位的結構正確，不檢查日期與金額內容）。 */
export function isLeftInvoiceQr(text: string): boolean {
  const t = text.trim();
  return t.length >= FIXED_LENGTH && LEFT_FIXED_PATTERN.test(t);
}

/** 是否為右方 QR（以 `**` 開頭）。 */
export function isRightInvoiceQr(text: string): boolean {
  return text.trim().startsWith('**');
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** 自行實作的 Base64 解碼（不依賴 atob / Buffer），失敗回傳 null。 */
function base64ToBytes(input: string): number[] | null {
  const clean = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const body = clean.replace(/=+$/, '');
  if (body.length === 0 || body.length % 4 === 1) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of body) {
    const value = BASE64_CHARS.indexOf(ch);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}

/** 自行實作的嚴格 UTF-8 解碼（不依賴 TextDecoder），失敗回傳 null。 */
function utf8ToString(bytes: number[]): string | null {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let need = 0;
    let cp = 0;
    let min = 0;
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
      continue;
    } else if (b >= 0xc2 && b <= 0xdf) {
      need = 1;
      cp = b & 0x1f;
      min = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      need = 2;
      cp = b & 0x0f;
      min = 0x800;
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3;
      cp = b & 0x07;
      min = 0x10000;
    } else {
      return null;
    }
    for (let k = 1; k <= need; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
      return null;
    }
    out += String.fromCodePoint(cp);
    i += need + 1;
  }
  return out;
}

function decodeBase64Utf8(input: string): string | null {
  const bytes = base64ToBytes(input);
  return bytes ? utf8ToString(bytes) : null;
}

/** 取得品目欄位的 token 清單（已去掉尾端空白欄位）。 */
function splitItemTokens(raw: string): string[] {
  const tokens = raw.split(':');
  while (tokens.length > 0 && tokens[tokens.length - 1].trim() === '') {
    tokens.pop();
  }
  return tokens;
}

/** 取出右方 QR 的品目字串（去掉 `**` 與開頭冒號）；不是右方 QR 回傳 null。 */
function rightItemString(right: string | null | undefined): string | null {
  if (typeof right !== 'string') return null;
  const t = right.trim();
  if (!t.startsWith('**')) return null;
  return t.slice(2).replace(/^:/, '');
}

function parseItems(tokens: string[], encoding: string): { items: InvoiceItem[]; groups: number } {
  const groups = Math.floor(tokens.length / 3);
  const items: InvoiceItem[] = [];
  if (encoding !== '1' && encoding !== '2') return { items, groups };
  for (let g = 0; g < groups; g++) {
    const rawName = tokens[g * 3];
    const quantity = parseNumber(tokens[g * 3 + 1]);
    const unitPrice = parseNumber(tokens[g * 3 + 2]);
    const name = encoding === '2' ? decodeBase64Utf8(rawName) : rawName;
    if (name === null || quantity === null || unitPrice === null) continue;
    const trimmed = name.trim();
    if (trimmed === '') continue;
    items.push({ name: trimmed, quantity, unitPrice });
  }
  return { items, groups };
}

function parseNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * 解析發票 QR。`left` 為左方 QR，`right` 為選填的右方 QR。
 * 固定欄位任何一項不合法、或金額不大於 0，回傳 null。
 */
export function parseInvoiceQr(left: string, right?: string | null): InvoiceQr | null {
  const text = left.trim();
  if (text.length < FIXED_LENGTH || !LEFT_FIXED_PATTERN.test(text)) {
    return null;
  }

  const invoiceNumber = text.slice(0, 10);
  const date = rocDateToAd(text.slice(10, 17));
  if (date === null) return null;
  const randomCode = text.slice(17, 21);
  const salesAmount = parseInt(text.slice(21, 29), 16);
  const totalAmount = parseInt(text.slice(29, 37), 16);
  const buyerRaw = text.slice(37, 45);
  const sellerId = text.slice(45, 53);

  const amount = totalAmount > 0 ? totalAmount : salesAmount;
  if (!(amount > 0)) return null;

  let items: InvoiceItem[] = [];
  let itemsTruncated = false;

  const rest = text.slice(FIXED_LENGTH);
  if (rest.startsWith(':')) {
    // 欄位：['', 營業人自用區, 本 QR 筆數, 總筆數, 編碼, ...品目]
    const parts = rest.split(':');
    const total = /^\d+$/.test((parts[3] ?? '').trim()) ? Number(parts[3].trim()) : null;
    const encoding = (parts[4] ?? '').trim();
    let itemString = parts.slice(5).join(':');

    const rightString = rightItemString(right);
    if (rightString !== null && rightString !== '') {
      itemString =
        itemString === '' || itemString.endsWith(':')
          ? itemString + rightString
          : `${itemString}:${rightString}`;
    }

    const parsed = parseItems(splitItemTokens(itemString), encoding);
    items = parsed.items;
    if (total !== null) itemsTruncated = parsed.groups < total;
  }

  return {
    invoiceNumber,
    date,
    randomCode,
    salesAmount,
    totalAmount,
    amount,
    buyerId: buyerRaw === '00000000' ? null : buyerRaw,
    sellerId,
    items,
    itemsTruncated,
  };
}

/** 給記帳備註用：「咖啡、麵包等 3 項」；沒有品目時為「發票 AB12345678」。 */
export function invoiceNote(invoice: InvoiceQr, maxItems = 2): string {
  const limit = Math.max(1, Math.floor(maxItems));
  const names = invoice.items.map((i) => i.name).filter((n) => n !== '');
  let note: string;
  if (names.length === 0) {
    note = `發票 ${invoice.invoiceNumber}`;
  } else {
    const shown = names.slice(0, limit).join('、');
    note = names.length > limit ? `${shown}等 ${names.length} 項` : shown;
  }
  const chars = Array.from(note);
  return chars.length > NOTE_MAX_LENGTH ? chars.slice(0, NOTE_MAX_LENGTH).join('') : note;
}
