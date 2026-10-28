import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { check, fetchAllPages, ledgerKeys, unwrap } from '@/api/keys';
import { monthRange, type Month } from '@/lib/date';
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
  'type' | 'amount' | 'occurred_on' | 'account_id' | 'to_account_id' | 'category_id' | 'note'
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

export function useSaveTransaction() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      tagIds,
    }: {
      id: string | null;
      input: TransactionInput;
      tagIds: string[];
    }) => {
      let transactionId = id;
      if (id) {
        check(await supabase.from('transactions').update(input).eq('id', id));
        // 標籤整批換掉
        check(await supabase.from('transaction_tags').delete().eq('transaction_id', id));
      } else {
        const created = unwrap(
          await supabase
            .from('transactions')
            .insert({ ...input, ledger_id: ledger.id })
            .select('id')
            .single(),
        );
        transactionId = created.id;
      }

      if (transactionId && tagIds.length > 0) {
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
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}

export function useDeleteTransaction() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
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
