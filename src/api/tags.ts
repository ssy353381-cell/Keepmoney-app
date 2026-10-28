import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ledgerKeys, unwrap } from '@/api/keys';
import { supabase } from '@/lib/supabase';
import { useLedger } from '@/providers/ledger-provider';
import type { Tables } from '@/types/database';

export type Tag = Tables<'tags'>;

export function useTags() {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.tags(ledger.id),
    queryFn: async () =>
      unwrap(await supabase.from('tags').select('*').eq('ledger_id', ledger.id).order('name')),
  });
}

export function useCreateTag() {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      unwrap(
        await supabase.from('tags').insert({ ledger_id: ledger.id, name }).select('*').single(),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.tags(ledger.id) }),
  });
}
