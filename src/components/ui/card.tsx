import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** 灰底圓角區塊 */
export function Card({ style, ...props }: ViewProps) {
  return <ThemedView type="backgroundElement" style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
