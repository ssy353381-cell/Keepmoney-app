import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  /** 還在讀取手機裡保存的登入狀態 */
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      // 讀取失敗就當作未登入，不能一直停在啟動畫面
      .finally(() => setIsLoading(false));

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // 登出時清掉快取，下一位登入者不會看到上一位的資料
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={{ session, isLoading }}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth 必須在 <AuthProvider> 裡面使用');
  }
  return value;
}

/** 已登入畫面使用：取得目前使用者 */
export function useUser() {
  const { session } = useAuth();
  if (!session) {
    throw new Error('useUser 只能在登入後的畫面使用');
  }
  return session.user;
}
