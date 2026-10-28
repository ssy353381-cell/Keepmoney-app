import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/api/keys';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Ledger = Tables<'ledgers'>;

export function useLedgers(userId: string) {
  return useQuery({
    queryKey: ['ledgers', userId],
    queryFn: async () =>
      unwrap(await supabase.from('ledgers').select('*').order('created_at').order('id')),
  });
}
