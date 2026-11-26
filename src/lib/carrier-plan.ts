import { guessCarrierCategory, type CarrierInvoice } from '@/lib/carrier-import';
import { resolveQuickEntry } from '@/lib/quick-entry';

type CategoryCandidate = Parameters<typeof resolveQuickEntry>[1][number];

export type CarrierRow = {
  invoice: CarrierInvoice;
  categoryId: string;
  /** 分類名稱真的對到才是 true；false 代表退回「其他」（要待確認） */
  categoryMatched: boolean;
};

/**
 * 為每張發票決定分類：用店名猜分類名稱，再用跟快速記帳相同的規則找 id。
 * 找不到任何可用的支出分類時回傳空陣列（畫面要顯示錯誤）。
 */
export function buildCarrierRows(
  invoices: CarrierInvoice[],
  categories: CategoryCandidate[],
): CarrierRow[] {
  // 同一個分類名稱只解析一次，幾千張發票也不會重複排序分類
  const cache = new Map<string, { categoryId: string | null; categoryMatched: boolean }>();
  const rows: CarrierRow[] = [];

  for (const invoice of invoices) {
    const name = guessCarrierCategory(invoice);
    const cacheKey = name ?? '';
    let resolved = cache.get(cacheKey);
    if (!resolved) {
      resolved = resolveQuickEntry(
        {
          amount: invoice.amount,
          type: 'expense',
          occurredOn: invoice.date,
          categoryName: name,
          note: '',
        },
        categories,
        [],
      );
      cache.set(cacheKey, resolved);
    }
    if (resolved.categoryId === null) {
      return [];
    }
    rows.push({
      invoice,
      categoryId: resolved.categoryId,
      categoryMatched: resolved.categoryMatched,
    });
  }
  return rows;
}

/** 檔案是不是亂碼：替換字元 U+FFFD 超過 5 個，或佔非空白字元 1% 以上（例如 Big5 檔用 UTF-8 讀） */
export function looksGarbled(text: string): boolean {
  let replacement = 0;
  let visible = 0;
  for (const char of text) {
    if (char === '�') {
      replacement++;
      visible++;
    } else if (!/\s/.test(char)) {
      visible++;
    }
  }
  return replacement > 5 || (replacement > 0 && replacement / visible >= 0.01);
}
