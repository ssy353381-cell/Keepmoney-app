import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { checkSupabaseConnection, type ConnectionResult } from '@/lib/check-supabase-connection';
import { isSupabaseConfigured } from '@/lib/env';

export default function SettingsScreen() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);

  async function handleCheck() {
    setChecking(true);
    setResult(await checkSupabaseConnection());
    setChecking(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">設定</ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Supabase 連線</ThemedText>
          {isSupabaseConfigured ? (
            <>
              <Pressable
                onPress={handleCheck}
                disabled={checking}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundSelected" style={styles.button}>
                  <ThemedText type="small">{checking ? '測試中…' : '測試連線'}</ThemedText>
                </ThemedView>
              </Pressable>
              {result && (
                <ThemedText type="small" themeColor="textSecondary">
                  {result.ok ? '✅ 連線成功' : `❌ 連線失敗：${result.message}`}
                </ThemedText>
              )}
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              尚未設定：請複製 .env.example 為 .env，填入 Supabase 專案的 URL 與 publishable key
              後重新啟動。
            </ThemedText>
          )}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    // Web 的分頁列浮在畫面頂端，要多留空間避免蓋到標題
    paddingTop: Platform.select({ web: Spacing.six + Spacing.three, default: Spacing.four }),
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
