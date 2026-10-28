/** 資料庫欄位 numeric(14, 2) 能存的最大金額 */
export const MAX_AMOUNT = 999_999_999_999.99;

const formatter = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });

/** 金額顯示：1234.5 → "$1,234.5"、-800 → "-$800" */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${formatter.format(Math.abs(amount))}`;
}

/** 以「分」為單位加總，避免 0.1 + 0.2 這類浮點誤差 */
export function sumAmounts(amounts: number[]): number {
  const cents = amounts.reduce((total, amount) => total + Math.round(amount * 100), 0);
  return cents / 100;
}

function parseNumber(input: string, allowNegative: boolean): number | null {
  const normalized = input.replace(/[,\s]/g, '');
  const pattern = allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/;
  if (!pattern.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Math.abs(value) > MAX_AMOUNT ? null : value;
}

/** 交易、預算金額：必須大於 0、最多兩位小數；不合法回傳 null */
export function parseAmount(input: string): number | null {
  const value = parseNumber(input, false);
  return value !== null && value > 0 ? value : null;
}

/** 帳戶期初餘額：可以是 0 或負數（例如信用卡欠款）；不合法回傳 null */
export function parseBalance(input: string): number | null {
  return input.trim() === '' ? 0 : parseNumber(input, true);
}

/** 把金額轉回輸入框用的字串（不加千分位） */
export function amountToInput(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? '' : String(amount);
}
