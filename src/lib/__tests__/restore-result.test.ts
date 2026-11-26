import { describeRestoreCounts, parseRestoreCounts } from '@/lib/restore-result';

describe('parseRestoreCounts', () => {
  it('讀出各項筆數，缺少或不合理的值當 0', () => {
    expect(
      parseRestoreCounts({
        accounts: 2,
        transactions: 10,
        tags: -1,
        budgets: 'x',
        categories: 1.9,
      }),
    ).toEqual({
      accounts: 2,
      categories: 1,
      tags: 0,
      recurring_transactions: 0,
      transactions: 10,
      transaction_tags: 0,
      budgets: 0,
    });
  });

  it('不是物件就丟出錯誤', () => {
    expect(() => parseRestoreCounts(null)).toThrow();
    expect(() => parseRestoreCounts([1])).toThrow();
    expect(() => parseRestoreCounts('ok')).toThrow();
  });
});

describe('describeRestoreCounts', () => {
  const zero = parseRestoreCounts({});

  it('全部 0 筆時說明沒有需要補回的資料', () => {
    expect(describeRestoreCounts(zero)).toBe('沒有需要補回的資料');
  });

  it('只列出大於 0 的項目', () => {
    expect(describeRestoreCounts({ ...zero, transactions: 120, accounts: 3, categories: 8 })).toBe(
      '已還原：交易 120 筆、帳戶 3 個、分類 8 個',
    );
    expect(describeRestoreCounts({ ...zero, tags: 2, budgets: 1, recurring_transactions: 4 })).toBe(
      '已還原：標籤 2 個、預算 1 筆、定期收支 4 筆',
    );
  });
});
