import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { check, fetchAllPages, ledgerKeys, unwrap } from '@/api/keys';
import { removeReceipts, uploadReceipt } from '@/api/receipts';
import { monthRange, yearRange, type Month } from '@/lib/date';
import { toErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useLedger } from '@/providers/ledger-provider';
import type { Enums, Tables } from '@/types/database';

export type Transaction = Tables<'transactions'>;
export type TransactionType = Enums<'transaction_type'>;

export const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
  { value: 'transfer', label: '轉帳' },
];

export type TransactionInput = Pick<
  Transaction,
  | 'type'
  | 'amount'
  | 'occurred_on'
  | 'account_id'
  | 'to_account_id'
  | 'category_id'
  | 'note'
  | 'needs_review'
>;

/** 某個月的交易，新到舊 */
export function useMonthTransactions(month: Month) {
  const ledger = useLedger();
  const { start, end } = monthRange(month);
  return useQuery({
    queryKey: ledgerKeys.transactions(ledger.id, start, end),
    queryFn: () =>
      fetchAllPages((from, to) =>
        supabase
          .from('transactions')
          .select('*')
          .eq('ledger_id', ledger.id)
          .gte('occurred_on', start)
          .lte('occurred_on', end)
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to),
      ),
  });
}

/** 樹與森林只需要的精簡欄位 */
export type YearTransaction = Pick<
  Transaction,
  'id' | 'type' | 'amount' | 'occurred_on' | 'created_at' | 'category_id' | 'needs_review'
>;

/** 整年的交易（精簡欄位），舊到新；首頁的樹與森林用 */
export function useYearTransactions(year: number) {
  const ledger = useLedger();
  const { start, end } = yearRange(year);
  return useQuery({
    queryKey: ledgerKeys.yearTransactions(ledger.id, year),
    queryFn: (): Promise<YearTransaction[]> =>
      fetchAllPages((from, to) =>
        supabase
          .from('transactions')
          .select('id,type,amount,occurred_on,created_at,category_id,needs_review')
          .eq('ledger_id', ledger.id)
          .gte('occurred_on', start)
          .lte('occurred_on', end)
          .order('occurred_on', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id')
          .range(from, to),
      ),
  });
}

/** 所有待確認（needs_review）的交易，新到舊 */
export function useNeedsReviewTransactions() {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.needsReview(ledger.id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('transactions')
          .select('*')
          .eq('ledger_id', ledger.id)
          .eq('needs_review', true)
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id')
          .limit(500),
      ),
  });
}

export type QuickAddInput = {
  type: 'expense' | 'income';
  amount: number;
  occurredOn: string;
  categoryId: string | null;
  accountId: string;
  note: string | null;
  needsReview: boolean;
};

/** App 內一句話快速記帳：新增一筆來源為 quick 的交易 */
export function useQuickAdd() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuickAddInput) => {
      check(
        await supabase.from('transactions').insert({
          ledger_id: ledger.id,
          type: input.type,
          amount: input.amount,
          occurred_on: input.occurredOn,
          category_id: input.categoryId,
          account_id: input.accountId,
          note: input.note,
          needs_review: input.needsReview,
          source: 'quick',
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}

/** 單筆交易與它的標籤 */
export function useTransaction(id: string | null) {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.transaction(ledger.id, id ?? ''),
    enabled: id !== null,
    queryFn: async () => {
      const transaction = unwrap(
        await supabase
          .from('transactions')
          .select('*')
          .eq('id', id ?? '')
          .single(),
      );
      const tags = unwrap(
        await supabase
          .from('transaction_tags')
          .select('tag_id')
          .eq('transaction_id', id ?? ''),
      );
      return { transaction, tagIds: tags.map((t) => t.tag_id) };
    },
  });
}

/** 表單裡收據照片的狀態：沿用原本的、移除、或換成新拍／新選的（本機 uri） */
export type ReceiptChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; uri: string };

export type SaveTransactionResult = {
  transactionId: string;
  /** 交易已存好但照片處理失敗時的訊息；null 代表全部成功 */
  photoError: string | null;
};

export function useSaveTransaction() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      tagIds,
      invoiceNumber,
      receipt,
      oldReceiptPath,
    }: {
      id: string | null;
      input: TransactionInput;
      tagIds: string[];
      /** 只在新增時寫入（來自掃描電子發票）；編輯時不會改 invoice_number 與 source */
      invoiceNumber?: string | null;
      receipt: ReceiptChange;
      /** 編輯前這筆記錄原本的照片路徑 */
      oldReceiptPath: string | null;
    }): Promise<SaveTransactionResult> => {
      let transactionId = id;
      if (id) {
        check(await supabase.from('transactions').update(input).eq('id', id));
        // 標籤整批換掉
        check(await supabase.from('transaction_tags').delete().eq('transaction_id', id));
      } else {
        const created = unwrap(
          await supabase
            .from('transactions')
            .insert({
              ...input,
              ledger_id: ledger.id,
              ...(invoiceNumber ? { invoice_number: invoiceNumber, source: 'invoice_qr' } : {}),
            })
            .select('id')
            .single(),
        );
        transactionId = created.id;
      }
      if (!transactionId) {
        throw new Error('沒有取得資料，請稍後再試');
      }

      if (tagIds.length > 0) {
        check(
          await supabase.from('transaction_tags').insert(
            tagIds.map((tag_id) => ({
              ledger_id: ledger.id,
              transaction_id: transactionId,
              tag_id,
            })),
          ),
        );
      }

      // 交易本身已經存好；照片失敗只回報訊息，不讓使用者以為整筆失敗
      let photoError: string | null = null;
      try {
        if (receipt.kind === 'new') {
          const path = await uploadReceipt(ledger.id, transactionId, receipt.uri);
          try {
            check(
              await supabase
                .from('transactions')
                .update({ receipt_path: path })
                .eq('id', transactionId),
            );
          } catch (e) {
            // 路徑沒寫進去，剛上傳的檔案就成了孤兒，盡量清掉
            await removeReceipts([path]).catch(() => undefined);
            throw e;
          }
          // 新照片已經就位，才刪舊的；舊檔刪不掉不影響結果
          if (oldReceiptPath) {
            await removeReceipts([oldReceiptPath]).catch(() => undefined);
          }
        } else if (receipt.kind === 'remove' && oldReceiptPath) {
          check(
            await supabase
              .from('transactions')
              .update({ receipt_path: null })
              .eq('id', transactionId),
          );
          await removeReceipts([oldReceiptPath]);
        }
      } catch (e) {
        photoError = toErrorMessage(e);
      }
      return { transactionId, photoError };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}

export function useDeleteTransaction() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // 先刪照片（找不到檔案不算錯），再刪交易；刪不掉照片就不刪交易，避免留下孤兒檔案
      const row = unwrap(
        await supabase.from('transactions').select('receipt_path').eq('id', id).single(),
      );
      if (row.receipt_path) {
        await removeReceipts([row.receipt_path]);
      }
      check(await supabase.from('transactions').delete().eq('id', id));
    },
    // 不等重新整理完成，讓畫面先關閉；已刪除的那筆不用再抓（會查不到而報錯）
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({
        queryKey: ledgerKeys.all(ledger.id),
        predicate: (query) => query.queryKey[2] !== 'transaction' || query.queryKey[3] !== id,
      });
    },
  });
}
