import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** 一組可換行排列的 Chip，可加上標題 */
export function ChipGroup({ label, children }: PropsWithChildren<{ label?: string }>) {
  return (
    <View style={styles.container}>
      {label && (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      )}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
