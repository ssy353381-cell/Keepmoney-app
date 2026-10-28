import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { check, ledgerKeys, unwrap } from '@/api/keys';
import { supabase } from '@/lib/supabase';
import { useLedger } from '@/providers/ledger-provider';
import type { Enums, Tables } from '@/types/database';

export type Account = Tables<'accounts'>;
export type AccountType = Enums<'account_type'>;

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'cash', label: '現金', icon: '💵' },
  { value: 'bank', label: '銀行', icon: '🏦' },
  { value: 'credit_card', label: '信用卡', icon: '💳' },
  { value: 'e_wallet', label: '電子支付', icon: '📱' },
  { value: 'investment', label: '投資', icon: '📈' },
  { value: 'other', label: '其他', icon: '👛' },
];

export function accountTypeInfo(type: AccountType) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
}

export function useAccounts() {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.accounts(ledger.id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('accounts')
          .select('*')
          .eq('ledger_id', ledger.id)
          .order('sort_order')
          .order('created_at'),
      ),
  });
}

/** 各帳戶目前餘額：account_id → balance */
export function useAccountBalances() {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.balances(ledger.id),
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from('account_balances')
          .select('account_id, balance')
          .eq('ledger_id', ledger.id),
      );
      return new Map(rows.map((row) => [row.account_id ?? '', row.balance ?? 0]));
    },
  });
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'initial_balance' | 'is_archived'>;

export function useSaveAccount() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: AccountInput }) => {
      if (id) {
        check(await supabase.from('accounts').update(input).eq('id', id));
      } else {
        check(await supabase.from('accounts').insert({ ...input, ledger_id: ledger.id }));
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}

export function useDeleteAccount() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      check(await supabase.from('accounts').delete().eq('id', id));
    },
    // 不等重新整理完成，讓編輯畫面先關閉，避免閃過「找不到這個帳戶」
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) });
    },
  });
}
