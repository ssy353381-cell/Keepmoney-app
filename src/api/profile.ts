import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/api/keys';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/providers/auth-provider';

export function useProfile() {
  const user = useUser();
  return useQuery({
    queryKey: ['profile', user.id],
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select('*').eq('id', user.id).single()),
  });
}
