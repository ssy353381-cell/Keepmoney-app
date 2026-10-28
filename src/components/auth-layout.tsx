import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** 登入、註冊頁的共用版面 */
export function AuthLayout({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            <View style={styles.content}>
              <View style={styles.header}>
                <ThemedText type="subtitle">KeepMoney</ThemedText>
                <ThemedText themeColor="textSecondary">{title}</ThemedText>
              </View>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
});
