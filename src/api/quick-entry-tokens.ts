import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { check, ledgerKeys, unwrap } from '@/api/keys';
import { supabase } from '@/lib/supabase';
import { useLedger } from '@/providers/ledger-provider';

/** 一個帳號最多可以有幾把捷徑金鑰（與資料庫的限制一致） */
export const MAX_QUICK_TOKENS = 5;

export type QuickEntryToken = {
  id: string;
  label: string | null;
  default_account_id: string | null;
  created_at: string;
  last_used_at: string | null;
};

/** 我的捷徑金鑰（token_hash 沒有讀取權限，所以不能用 select('*')） */
export function useQuickEntryTokens() {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.quickTokens(ledger.id),
    queryFn: async (): Promise<QuickEntryToken[]> =>
      unwrap(
        await supabase
          .from('quick_entry_tokens')
          .select('id,label,default_account_id,created_at,last_used_at')
          .eq('ledger_id', ledger.id)
          .order('created_at', { ascending: false }),
      ),
  });
}

/** 產生金鑰，回傳明文（只有這一次拿得到） */
export function useCreateQuickEntryToken() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; defaultAccountId: string | null }) => {
      const result = await supabase.rpc('create_quick_entry_token', {
        p_ledger_id: ledger.id,
        p_label: input.label,
        ...(input.defaultAccountId ? { p_default_account_id: input.defaultAccountId } : {}),
      });
      return unwrap(result);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}

/** 修改金鑰的預設帳戶 */
export function useUpdateQuickEntryToken() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      defaultAccountId,
    }: {
      id: string;
      defaultAccountId: string | null;
    }) => {
      check(
        await supabase
          .from('quick_entry_tokens')
          .update({ default_account_id: defaultAccountId })
          .eq('id', id),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}

export function useDeleteQuickEntryToken() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      check(await supabase.from('quick_entry_tokens').delete().eq('id', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}
