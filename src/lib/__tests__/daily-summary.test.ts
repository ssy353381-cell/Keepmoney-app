import { summarizeDays, summarizeMonths, type SummaryTransaction } from '@/lib/daily-summary';

function tx(
  id: string,
  type: SummaryTransaction['type'],
  amount: number,
  occurred_on: string,
  created_at = '2026-10-28T10:00:00+00:00',
  needs_review?: boolean,
): SummaryTransaction {
  return { id, type, amount, occurred_on, created_at, needs_review };
}

describe('summarizeDays', () => {
  it('依日期加總支出與收入，items 依建立時間由舊到新', () => {
    const days = summarizeDays([
      tx('b', 'expense', 100.1, '2026-10-28', '2026-10-28T12:00:00+00:00'),
      tx('a', 'expense', 200.2, '2026-10-28', '2026-10-28T08:00:00+00:00'),
      tx('c', 'income', 50, '2026-10-28', '2026-10-28T09:00:00+00:00'),
      tx('d', 'expense', 10, '2026-10-29'),
    ]);
    const day = days.get('2026-10-28');
    expect(day?.count).toBe(3);
    expect(day?.expense).toBe(300.3);
    expect(day?.income).toBe(50);
    expect(day?.items.map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(days.get('2026-10-29')?.count).toBe(1);
    expect(days.size).toBe(2);
  });

  it('轉帳不算收支，只有轉帳的日子不會出現', () => {
    const days = summarizeDays([
      tx('t', 'transfer', 999, '2026-10-28'),
      tx('e', 'expense', 10, '2026-10-29'),
    ]);
    expect(days.has('2026-10-28')).toBe(false);
    expect(days.get('2026-10-29')?.count).toBe(1);
  });

  it('needs_review 帶到 items，沒有這個欄位也可以', () => {
    const days = summarizeDays([
      tx('a', 'expense', 10, '2026-10-28', '2026-10-28T08:00:00+00:00', true),
      tx('b', 'expense', 10, '2026-10-28', '2026-10-28T09:00:00+00:00'),
    ]);
    expect(days.get('2026-10-28')?.items.map((i) => i.needsReview)).toEqual([true, undefined]);
  });

  it('沒有資料回傳空 Map', () => {
    expect(summarizeDays([]).size).toBe(0);
  });
});

describe('summarizeMonths', () => {
  it('一定回傳 12 個月', () => {
    const months = summarizeMonths(2026, []);
    expect(months).toHaveLength(12);
    expect(months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(months.every((m) => m.recordedDays === 0 && m.days.length === 0)).toBe(true);
  });

  it('依月份歸類、計算記帳天數，忽略其他年份與轉帳', () => {
    const months = summarizeMonths(2026, [
      tx('1', 'expense', 100, '2026-10-28'),
      tx('2', 'expense', 50, '2026-10-28'),
      tx('3', 'income', 1000, '2026-10-05'),
      tx('4', 'expense', 30, '2026-01-01'),
      tx('5', 'expense', 999, '2025-10-28'),
      tx('6', 'transfer', 999, '2026-10-30'),
    ]);
    const october = months[9];
    expect(october.expense).toBe(150);
    expect(october.income).toBe(1000);
    expect(october.recordedDays).toBe(2);
    expect(october.days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-28']);
    expect(months[0].recordedDays).toBe(1);
    expect(months[0].expense).toBe(30);
  });
});
