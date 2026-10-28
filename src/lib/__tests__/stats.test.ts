import { budgetProgress, summarize, totalsByCategory, type StatsTransaction } from '@/lib/stats';

const categories = [
  { id: 'food', parent_id: null },
  { id: 'breakfast', parent_id: 'food' },
  { id: 'shopping', parent_id: null },
  { id: 'salary', parent_id: null },
];

const transactions: StatsTransaction[] = [
  { type: 'expense', amount: 120, category_id: 'breakfast' },
  { type: 'expense', amount: 380, category_id: 'food' },
  { type: 'expense', amount: 1500.5, category_id: 'shopping' },
  { type: 'income', amount: 40000, category_id: 'salary' },
  { type: 'transfer', amount: 3000, category_id: null },
];

describe('summarize', () => {
  it('轉帳不算收入或支出', () => {
    expect(summarize(transactions)).toEqual({ income: 40000, expense: 2000.5, net: 37999.5 });
  });
});

describe('totalsByCategory', () => {
  it('子分類併入父分類，依金額排序並計算比例', () => {
    const totals = totalsByCategory(transactions, categories, 'expense');
    expect(totals.map((t) => [t.categoryId, t.total])).toEqual([
      ['shopping', 1500.5],
      ['food', 500],
    ]);
    expect(totals[1].ratio).toBeCloseTo(500 / 2000.5);
  });

  it('沒有資料時回傳空陣列', () => {
    expect(totalsByCategory([], categories, 'expense')).toEqual([]);
  });
});

describe('budgetProgress', () => {
  it('總預算排第一，分類預算包含子分類的支出', () => {
    const progress = budgetProgress(
      [
        { id: 'b-food', category_id: 'food', amount: 400 },
        { id: 'b-total', category_id: null, amount: 20000 },
      ],
      transactions,
      categories,
    );
    expect(progress[0]).toMatchObject({ budgetId: 'b-total', spent: 2000.5, remaining: 17999.5 });
    expect(progress[1]).toMatchObject({
      budgetId: 'b-food',
      spent: 500,
      remaining: -100,
      ratio: 1.25,
    });
  });
});
