import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type YearSwitcherProps = {
  year: number;
  onChange: (year: number) => void;
};

export function YearSwitcher({ year, onChange }: YearSwitcherProps) {
  const current = new Date().getFullYear();
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="上一年"
        hitSlop={12}
        onPress={() => onChange(year - 1)}
        style={styles.arrow}>
        <ThemedText type="subtitle">‹</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="回到今年"
        onPress={() => onChange(current)}>
        <ThemedText type="smallBold" style={styles.title}>
          {year}年{year === current ? '' : '　（回今年）'}
        </ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="下一年"
        hitSlop={12}
        onPress={() => onChange(year + 1)}
        style={styles.arrow}>
        <ThemedText type="subtitle">›</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: {
    paddingHorizontal: Spacing.three,
  },
  title: {
    fontSize: 18,
  },
});
