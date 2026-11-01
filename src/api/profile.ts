import { useMutation, useQuery } from '@tanstack/react-query';

import { check, unwrap } from '@/api/keys';
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

/**
 * 永久刪除自己的帳號，以及自己單獨擁有的帳本與所有資料（由資料庫觸發器處理）。
 * 成功後清掉手機上的登入狀態，路由會自動回到登入頁。
 */
export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: async () => {
      check(await supabase.rpc('delete_my_account'));
      // 帳號已在伺服器刪除，只需清除這台裝置上的登入狀態
      await supabase.auth.signOut({ scope: 'local' });
    },
  });
}
