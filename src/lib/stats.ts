import { sumAmounts } from '@/lib/money';

type TransactionType = 'expense' | 'income' | 'transfer';
type CategoryKind = 'expense' | 'income';

export type StatsTransaction = {
  type: TransactionType;
  amount: number;
  category_id: string | null;
};

export type StatsCategory = {
  id: string;
  parent_id: string | null;
};

export type StatsBudget = {
  id: string;
  category_id: string | null;
  amount: number;
};

export type MonthSummary = { income: number; expense: number; net: number };

export type CategoryTotal = {
  /** 最上層分類（子分類的金額已併入父分類） */
  categoryId: string;
  total: number;
  /** 佔該類型總額的比例（0～1） */
  ratio: number;
};

export type BudgetProgress = {
  budgetId: string;
  /** null 代表每月總預算 */
  categoryId: string | null;
  amount: number;
  spent: number;
  remaining: number;
  /** 已使用比例，超支時會大於 1 */
  ratio: number;
};

/** 收入、支出、結餘（轉帳只是帳戶間移動，不算收支） */
export function summarize(transactions: StatsTransaction[]): MonthSummary {
  const income = sumAmounts(transactions.filter((t) => t.type === 'income').map((t) => t.amount));
  const expense = sumAmounts(transactions.filter((t) => t.type === 'expense').map((t) => t.amount));
  return { income, expense, net: sumAmounts([income, -expense]) };
}

/** 各最上層分類的總額，由大到小 */
export function totalsByCategory(
  transactions: StatsTransaction[],
  categories: StatsCategory[],
  kind: CategoryKind,
): CategoryTotal[] {
  const rootOf = new Map(categories.map((c) => [c.id, c.parent_id ?? c.id]));
  const amountsByRoot = new Map<string, number[]>();

  for (const t of transactions) {
    if (t.type !== kind || t.category_id === null) {
      continue;
    }
    const root = rootOf.get(t.category_id) ?? t.category_id;
    amountsByRoot.set(root, [...(amountsByRoot.get(root) ?? []), t.amount]);
  }

  const totals = [...amountsByRoot].map(([categoryId, amounts]) => ({
    categoryId,
    total: sumAmounts(amounts),
  }));
  const grandTotal = sumAmounts(totals.map((t) => t.total));

  return totals
    .map((t) => ({ ...t, ratio: grandTotal > 0 ? t.total / grandTotal : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** 預算使用進度：總預算在前，其餘依使用比例由高到低 */
export function budgetProgress(
  budgets: StatsBudget[],
  transactions: StatsTransaction[],
  categories: StatsCategory[],
): BudgetProgress[] {
  const expenseByRoot = new Map(
    totalsByCategory(transactions, categories, 'expense').map((t) => [t.categoryId, t.total]),
  );
  const totalExpense = summarize(transactions).expense;

  return budgets
    .map((budget) => {
      const spent =
        budget.category_id === null ? totalExpense : (expenseByRoot.get(budget.category_id) ?? 0);
      return {
        budgetId: budget.id,
        categoryId: budget.category_id,
        amount: budget.amount,
        spent,
        remaining: sumAmounts([budget.amount, -spent]),
        ratio: budget.amount > 0 ? spent / budget.amount : 0,
      };
    })
    .sort((a, b) => {
      if (a.categoryId === null) return -1;
      if (b.categoryId === null) return 1;
      return b.ratio - a.ratio;
    });
}
