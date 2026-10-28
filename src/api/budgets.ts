import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { check, ledgerKeys, unwrap } from '@/api/keys';
import { supabase } from '@/lib/supabase';
import { useLedger } from '@/providers/ledger-provider';
import type { Tables } from '@/types/database';

export type Budget = Tables<'budgets'>;

/** 預算設定畫面送出的內容：categoryId 為 null 是每月總預算；amount 為 null 代表不設 */
export type BudgetDraft = { categoryId: string | null; amount: number | null };

export type BudgetChanges = {
  inserts: { categoryId: string | null; amount: number }[];
  updates: { id: string; amount: number }[];
  deletes: string[];
};

/** 比對現有預算與畫面上的設定，算出要新增、修改、刪除哪些 */
export function planBudgetChanges(
  existing: Pick<Budget, 'id' | 'category_id' | 'amount'>[],
  drafts: BudgetDraft[],
): BudgetChanges {
  const changes: BudgetChanges = { inserts: [], updates: [], deletes: [] };
  for (const draft of drafts) {
    const current = existing.find((b) => b.category_id === draft.categoryId);
    if (draft.amount === null) {
      if (current) changes.deletes.push(current.id);
    } else if (!current) {
      changes.inserts.push({ categoryId: draft.categoryId, amount: draft.amount });
    } else if (current.amount !== draft.amount) {
      changes.updates.push({ id: current.id, amount: draft.amount });
    }
  }
  return changes;
}

export function useBudgets() {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.budgets(ledger.id),
    queryFn: async () =>
      unwrap(await supabase.from('budgets').select('*').eq('ledger_id', ledger.id)),
  });
}

export function useSaveBudgets() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: BudgetChanges) => {
      if (changes.deletes.length > 0) {
        check(await supabase.from('budgets').delete().in('id', changes.deletes));
      }
      for (const update of changes.updates) {
        check(await supabase.from('budgets').update({ amount: update.amount }).eq('id', update.id));
      }
      if (changes.inserts.length > 0) {
        check(
          await supabase.from('budgets').insert(
            changes.inserts.map((insert) => ({
              ledger_id: ledger.id,
              category_id: insert.categoryId,
              amount: insert.amount,
            })),
          ),
        );
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}
