/** restore_backup() 回報的「實際寫入筆數」（衝突略過的不算） */
export type RestoreCounts = {
  accounts: number;
  categories: number;
  tags: number;
  recurring_transactions: number;
  transactions: number;
  transaction_tags: number;
  budgets: number;
};

const KEYS: (keyof RestoreCounts)[] = [
  'accounts',
  'categories',
  'tags',
  'recurring_transactions',
  'transactions',
  'transaction_tags',
  'budgets',
];

/** 把資料庫回傳的 JSON 整理成筆數；格式不符就丟出錯誤，缺少的欄位當 0 */
export function parseRestoreCounts(value: unknown): RestoreCounts {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('還原的回應格式不正確，請檢查資料是否已補回');
  }
  const record = value as Record<string, unknown>;
  const counts = {} as RestoreCounts;
  for (const key of KEYS) {
    const n = record[key];
    counts[key] = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return counts;
}

/** 還原結果的說明文字；全部是 0 代表備份裡的資料目前都已經在帳本裡了 */
export function describeRestoreCounts(counts: RestoreCounts): string {
  const parts: string[] = [];
  if (counts.transactions > 0) parts.push(`交易 ${counts.transactions} 筆`);
  if (counts.accounts > 0) parts.push(`帳戶 ${counts.accounts} 個`);
  if (counts.categories > 0) parts.push(`分類 ${counts.categories} 個`);
  if (counts.tags > 0) parts.push(`標籤 ${counts.tags} 個`);
  if (counts.budgets > 0) parts.push(`預算 ${counts.budgets} 筆`);
  if (counts.recurring_transactions > 0) {
    parts.push(`定期收支 ${counts.recurring_transactions} 筆`);
  }
  if (parts.length === 0) {
    return '沒有需要補回的資料';
  }
  return `已還原：${parts.join('、')}`;
}
