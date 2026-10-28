import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/** Web 的分頁列浮在畫面頂端，內容要往下讓出空間 */
export const WebTabBarInset = Platform.select({ web: Spacing.six + Spacing.three, default: 0 });

/** 分頁裡的畫面：處理瀏海、底部分頁列與內容最大寬度 */
export function TabScreen({
  children,
  contentStyle,
  refreshing,
  onRefresh,
}: PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  /** 有傳 onRefresh 時支援下拉重新整理 */
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  const content = (
    <ScrollView
      contentContainerStyle={[styles.tabContent, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        {content}
      </SafeAreaView>
    </ThemedView>
  );
}

/** 表單畫面（彈出視窗）：鍵盤出現時不會擋住輸入框 */
export function FormScreen({ children }: PropsWithChildren) {
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
          <SafeAreaView edges={['bottom']} style={styles.formInner}>
            {children}
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  tabContent: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three + WebTabBarInset,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  formContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  formInner: {
    gap: Spacing.four,
    padding: Spacing.three,
  },
});
