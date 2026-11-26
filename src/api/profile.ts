import { useMutation, useQuery } from '@tanstack/react-query';

import { check, unwrap } from '@/api/keys';
import { removeAllLedgerReceipts } from '@/api/receipts';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/providers/auth-provider';
import { useLedger } from '@/providers/ledger-provider';

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
  const ledger = useLedger();
  return useMutation({
    mutationFn: async () => {
      // 資料庫刪不掉 storage 的檔案，所以先清掉收據照片。
      // 清理失敗不能擋住刪帳號（App Store 規定一定要能刪），只記錄錯誤
      try {
        await removeAllLedgerReceipts(ledger.id);
      } catch (e) {
        console.warn('刪除帳號前清除收據照片失敗，照片可能殘留：', e);
      }
      check(await supabase.rpc('delete_my_account'));
      // 帳號已在伺服器刪除，只需清除這台裝置上的登入狀態
      await supabase.auth.signOut({ scope: 'local' });
    },
  });
}
