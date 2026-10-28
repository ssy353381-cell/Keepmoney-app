import type { PostgrestError } from '@supabase/supabase-js';

/**
 * 查詢快取的 key。帳本內的資料都以 ['ledger', ledgerId] 開頭，
 * 任何寫入後只要讓整本帳本的快取失效，所有畫面就會重新整理。
 */
export const ledgerKeys = {
  all: (ledgerId: string) => ['ledger', ledgerId] as const,
  accounts: (ledgerId: string) => ['ledger', ledgerId, 'accounts'] as const,
  balances: (ledgerId: string) => ['ledger', ledgerId, 'balances'] as const,
  categories: (ledgerId: string) => ['ledger', ledgerId, 'categories'] as const,
  tags: (ledgerId: string) => ['ledger', ledgerId, 'tags'] as const,
  budgets: (ledgerId: string) => ['ledger', ledgerId, 'budgets'] as const,
  transactions: (ledgerId: string, start: string, end: string) =>
    ['ledger', ledgerId, 'transactions', start, end] as const,
  transaction: (ledgerId: string, id: string) => ['ledger', ledgerId, 'transaction', id] as const,
};

/** 查詢用：Supabase 回傳 { data, error }，有錯就丟出，讓 react-query 進入錯誤狀態 */
export function unwrap<T>(result: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (result.error) {
    throw result.error;
  }
  if (result.data === null || result.data === undefined) {
    throw new Error('沒有取得資料，請稍後再試');
  }
  return result.data;
}

/** 寫入用：不需要回傳資料，只檢查有沒有錯 */
export function check(result: { error: PostgrestError | null }): void {
  if (result.error) {
    throw result.error;
  }
}

/** Supabase 每次最多回傳 1000 筆，超過時分頁抓完 */
export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = unwrap(await fetchPage(from, from + pageSize - 1));
    rows.push(...page);
    if (page.length < pageSize) {
      return rows;
    }
  }
}
