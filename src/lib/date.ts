/** 月份（month 為 1～12） */
export type Month = { year: number; month: number };

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 依裝置當地時間轉成 YYYY-MM-DD（不能用 toISOString，那是 UTC，台灣早上 8 點前會差一天） */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** YYYY-MM-DD → 當地時間午夜的 Date */
export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return toDateString(parseDateString(value)) === value;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function addDays(value: string, days: number): string {
  const date = parseDateString(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function monthOf(value: Date | string): Month {
  const date = typeof value === 'string' ? parseDateString(value) : value;
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function shiftMonth({ year, month }: Month, delta: number): Month {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 當月第一天與最後一天（含），用來查詢 occurred_on */
export function monthRange({ year, month }: Month): { start: string; end: string } {
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
}

export function isSameMonth(a: Month, b: Month): boolean {
  return a.year === b.year && a.month === b.month;
}

export function formatMonth({ year, month }: Month): string {
  return `${year}年${month}月`;
}

/** 明細的日期標題：今天、昨天，其他顯示「10月28日 週二」 */
export function formatDayHeader(value: string, today: string = todayString()): string {
  if (value === today) {
    return '今天';
  }
  if (value === addDays(today, -1)) {
    return '昨天';
  }
  const date = parseDateString(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 週${WEEKDAYS[date.getDay()]}`;
}

/** 表單上顯示的日期：「2026/10/28（週三）」 */
export function formatDateLabel(value: string): string {
  const date = parseDateString(value);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}（週${WEEKDAYS[date.getDay()]}）`;
}
