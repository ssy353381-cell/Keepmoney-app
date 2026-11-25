import type { QuickParseResult } from '@/lib/quick-parse';

type CategoryCandidate = {
  id: string;
  name: string;
  kind: 'expense' | 'income';
  parent_id: string | null;
  is_archived: boolean;
  sort_order: number;
};

type AccountCandidate = {
  id: string;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
};

/**
 * 依解析結果找出要用的分類與帳戶，規則與資料庫的 quick_add 一致：
 * 分類：同類型、未封存、名稱相符（不分大小寫，上層分類優先，再依 sort_order）
 *   → 找不到用上層「其他」→ 再找不到用該類型 sort_order 第一個上層分類。
 * categoryMatched 只有名稱真的對到才是 true。
 * 帳戶：未封存中 sort_order、created_at 最前面的一個。
 */
export function resolveQuickEntry(
  parsed: QuickParseResult,
  categories: CategoryCandidate[],
  accounts: AccountCandidate[],
): { categoryId: string | null; categoryMatched: boolean; accountId: string | null } {
  // 陣列的原始順序當作最後的排序依據（Array.sort 是穩定排序）
  const usable = categories
    .filter((c) => c.kind === parsed.type && !c.is_archived)
    .sort((a, b) => a.sort_order - b.sort_order);
  const parents = usable.filter((c) => c.parent_id === null);

  let categoryId: string | null = null;
  let categoryMatched = false;

  const wanted = parsed.categoryName?.trim().toLowerCase();
  if (wanted) {
    const matches = usable.filter((c) => c.name.toLowerCase() === wanted);
    const match = matches.find((c) => c.parent_id === null) ?? matches[0];
    if (match) {
      categoryId = match.id;
      categoryMatched = true;
    }
  }
  if (categoryId === null) {
    categoryId = (parents.find((c) => c.name === '其他') ?? parents[0])?.id ?? null;
  }

  const account = accounts
    .filter((a) => !a.is_archived)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))[0];

  return { categoryId, categoryMatched, accountId: account?.id ?? null };
}
