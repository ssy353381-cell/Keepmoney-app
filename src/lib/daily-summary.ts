import { sumAmounts } from '@/lib/money';

/** 當天的一筆收支（每一筆對應樹葉上的一條紋路） */
export type DayItem = {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  createdAt: string;
  /** 待確認的記錄（葉脈畫成虛線）；資料庫目前還沒有這個欄位 */
  needsReview?: boolean;
};

export type DaySummary = {
  date: string;
  expense: number;
  income: number;
  count: number;
  /** 依建立時間由舊到新 */
  items: DayItem[];
};

export type SummaryTransaction = {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  occurred_on: string;
  created_at: string;
  needs_review?: boolean | null;
};

export type MonthSummaryLite = {
  /** 1～12 */
  month: number;
  expense: number;
  income: number;
  /** 有記帳的天數 */
  recordedDays: number;
  /** 有記帳的日子，依日期由早到晚 */
  days: DaySummary[];
};

function compareCreatedAt(a: DayItem, b: DayItem): number {
  const timeA = Date.parse(a.createdAt);
  const timeB = Date.parse(b.createdAt);
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 依日期彙整收支（轉帳不算收支，略過）；只有有記帳的日子才會出現在結果裡 */
export function summarizeDays(transactions: SummaryTransaction[]): Map<string, DaySummary> {
  const itemsByDate = new Map<string, DayItem[]>();
  for (const t of transactions) {
    if (t.type === 'transfer') {
      continue;
    }
    const item: DayItem = {
      id: t.id,
      type: t.type,
      amount: t.amount,
      createdAt: t.created_at,
      needsReview: t.needs_review === true ? true : undefined,
    };
    const list = itemsByDate.get(t.occurred_on);
    if (list) {
      list.push(item);
    } else {
      itemsByDate.set(t.occurred_on, [item]);
    }
  }

  const result = new Map<string, DaySummary>();
  for (const [date, list] of itemsByDate) {
    const items = [...list].sort(compareCreatedAt);
    result.set(date, {
      date,
      expense: sumAmounts(items.filter((i) => i.type === 'expense').map((i) => i.amount)),
      income: sumAmounts(items.filter((i) => i.type === 'income').map((i) => i.amount)),
      count: items.length,
      items,
    });
  }
  return result;
}

/** 一整年的 12 個月摘要（一定回傳 12 個，沒資料的月份是空的） */
export function summarizeMonths(
  year: number,
  transactions: SummaryTransaction[],
): MonthSummaryLite[] {
  const days = summarizeDays(transactions);
  const buckets: DaySummary[][] = Array.from({ length: 12 }, () => []);
  for (const day of days.values()) {
    const [dayYear, dayMonth] = day.date.split('-').map(Number);
    if (dayYear === year && dayMonth >= 1 && dayMonth <= 12) {
      buckets[dayMonth - 1].push(day);
    }
  }
  return buckets.map((list, index) => {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return {
      month: index + 1,
      expense: sumAmounts(sorted.map((d) => d.expense)),
      income: sumAmounts(sorted.map((d) => d.income)),
      recordedDays: sorted.length,
      days: sorted,
    };
  });
}
