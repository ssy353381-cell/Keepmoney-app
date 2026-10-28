import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isSupabaseConfigured } from '@/lib/env';
import type { Database } from '@/types/database';

if (!isSupabaseConfigured) {
  throw new Error(
    '缺少 EXPO_PUBLIC_SUPABASE_URL 或 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY：請複製 .env.example 為 .env 並填入 Supabase 專案的值。',
  );
}

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    // Web 沿用瀏覽器的 localStorage，手機上把登入狀態存在 AsyncStorage
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// App 在前景時才自動更新登入 token，回到背景就停止；只需要註冊一次
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
