import { Stack } from 'expo-router';

import { LedgerProvider } from '@/providers/ledger-provider';

export const unstable_settings = {
  // 直接開啟彈出視窗的連結時，底下仍然有分頁畫面
  anchor: '(tabs)',
};

export default function AppLayout() {
  return (
    <LedgerProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/[id]"
          options={{ presentation: 'modal', title: '記一筆' }}
        />
        <Stack.Screen name="account/[id]" options={{ presentation: 'modal', title: '帳戶' }} />
        <Stack.Screen name="budgets" options={{ presentation: 'modal', title: '每月預算' }} />
      </Stack>
    </LedgerProvider>
  );
}
