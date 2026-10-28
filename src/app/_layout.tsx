import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

// 讀到登入狀態之前先保留啟動畫面，避免閃過登入頁
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...base, colors: { ...base.colors, primary: Colors.light.tint } };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={navigationTheme}>
          <SplashScreenController />
          <RootNavigator />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function SplashScreenController() {
  const { isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hide();
    }
  }, [isLoading]);
  return null;
}

function RootNavigator() {
  const { session, isLoading } = useAuth();
  // 還不知道有沒有登入時先不建立路由，否則會先被導向登入頁，弄丟原本要開的連結
  if (isLoading) {
    return null;
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}
