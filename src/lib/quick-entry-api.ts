// 快速記帳 Edge Function 的請求／回應純函式。
// 注意：此檔案刻意不 import 任何東西，
// 會由 npm run sync:functions 複製到 supabase/functions/_shared/ 給 Edge Function（Deno）使用。

export type QuickEntryRequest = { text: string; date: string | null; token: string | null };

type ReadResult =
  { ok: true; value: QuickEntryRequest } | { ok: false; status: number; message: string };

const MAX_TEXT_LENGTH = 200;
const DEFAULT_TIME_ZONE = 'Asia/Taipei';

function isValidDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** 解析請求 body（JSON 物件）與 header 的金鑰；header 優先，其次 body.token */
export function readQuickEntryRequest(body: unknown, headerToken: string | null): ReadResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, message: '請求格式不正確，請送出 JSON 物件' };
  }
  const record = body as Record<string, unknown>;

  const fromHeader = typeof headerToken === 'string' ? headerToken.trim() : '';
  const fromBody = typeof record.token === 'string' ? record.token.trim() : '';
  const token = fromHeader || fromBody || null;
  if (token === null) {
    return {
      ok: false,
      status: 401,
      message: '缺少捷徑金鑰，請在捷徑中加入 x-keepmoney-token 標頭或 token 欄位',
    };
  }

  if (typeof record.text !== 'string' || record.text.trim().length === 0) {
    return { ok: false, status: 400, message: '沒有收到內容，請再說一次，例如：午餐 120' };
  }
  const text = record.text.trim();
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, status: 400, message: `內容太長了，請控制在 ${MAX_TEXT_LENGTH} 字以內` };
  }

  const rawDate = typeof record.date === 'string' ? record.date.trim() : '';
  const date = isValidDate(rawDate) ? rawDate : null;

  return { ok: true, value: { text, date, token } };
}

/** 指定時區（預設台北）的今天 YYYY-MM-DD */
export function todayInTimeZone(now: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function formatDate(occurredOn: string, today: string): string {
  if (!isValidDate(occurredOn)) return occurredOn;
  if (isValidDate(today)) {
    const diff = dayNumber(today) - dayNumber(occurredOn);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff === 2) return '前天';
  }
  const [, m, d] = occurredOn.split('-').map(Number);
  return `${m}/${d}`;
}

function formatAmount(amount: number): string {
  const text = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `$${text}`;
}

/** 成功時給捷徑顯示的文字 */
export function successReply(input: {
  type: 'expense' | 'income';
  amount: number;
  note: string;
  categoryName: string;
  accountName: string;
  occurredOn: string;
  today: string;
}): string {
  const head = input.type === 'income' ? '💰 已記下收入：' : '✅ 已記下：';
  const note = input.note.trim();
  const title = note ? `${note} ` : '';
  return (
    `${head}${title}${formatAmount(input.amount)}（${input.categoryName}・${input.accountName}）\n` +
    `日期：${formatDate(input.occurredOn, input.today)}｜之後可到 KeepMoney 補細節`
  );
}

/** 把 PostgREST 錯誤轉成 HTTP 狀態與給使用者看的訊息；只依資料庫錯誤碼判斷，500 不透露內部細節 */
export function errorReply(
  error: { code?: string; message?: string } | null,
  // 保留參數以符合呼叫端介面；狀態碼一律由資料庫錯誤碼決定
  _httpStatus: number,
): { status: number; message: string } {
  const generic = { status: 500, message: '伺服器暫時有問題，請稍後再試' };
  if (!error) return generic;
  const message = typeof error.message === 'string' ? error.message.trim() : '';
  switch (error.code) {
    case '28000':
      return { status: 401, message: message || '捷徑金鑰無效，請重新產生' };
    case '42501':
      return { status: 403, message: message || '沒有記帳權限' };
    case 'P0001':
      return { status: 422, message: message || '無法記帳，請檢查內容' };
    default:
      return generic;
  }
}
