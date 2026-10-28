import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';

export function LoadingView() {
  return (
    <ThemedView style={styles.center}>
      <ActivityIndicator />
    </ThemedView>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <ThemedView style={styles.center}>
      <ThemedText style={styles.text}>{message}</ThemedText>
      {onRetry && <Button title="重試" variant="secondary" onPress={onRetry} />}
    </ThemedView>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <ThemedView style={styles.empty}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {description && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          {description}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  text: {
    textAlign: 'center',
  },
});
