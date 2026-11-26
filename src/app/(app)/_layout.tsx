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
        <Stack.Screen name="quick" options={{ presentation: 'modal', title: '快速記帳' }} />
        <Stack.Screen
          name="scan"
          options={{ presentation: 'fullScreenModal', title: '掃描電子發票' }}
        />
        <Stack.Screen
          name="quick-setup"
          options={{ presentation: 'modal', title: '不開 App 記帳' }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{ presentation: 'modal', title: '記一筆' }}
        />
        <Stack.Screen name="day/[date]" options={{ presentation: 'modal', title: '這一天' }} />
        <Stack.Screen name="account/[id]" options={{ presentation: 'modal', title: '帳戶' }} />
        <Stack.Screen name="budgets" options={{ presentation: 'modal', title: '每月預算' }} />
        <Stack.Screen name="backup" options={{ presentation: 'modal', title: '備份與還原' }} />
        <Stack.Screen
          name="carrier-import"
          options={{ presentation: 'modal', title: '匯入手機條碼發票' }}
        />
      </Stack>
    </LedgerProvider>
  );
}
