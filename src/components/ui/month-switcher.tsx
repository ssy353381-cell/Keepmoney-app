import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatMonth, isSameMonth, monthOf, shiftMonth, type Month } from '@/lib/date';

type MonthSwitcherProps = {
  month: Month;
  onChange: (month: Month) => void;
};

export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  const current = monthOf(new Date());
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="上個月"
        hitSlop={12}
        onPress={() => onChange(shiftMonth(month, -1))}
        style={styles.arrow}>
        <ThemedText type="subtitle">‹</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="回到本月"
        onPress={() => onChange(current)}>
        <ThemedText type="smallBold" style={styles.title}>
          {formatMonth(month)}
          {isSameMonth(month, current) ? '' : '　（回本月）'}
        </ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="下個月"
        hitSlop={12}
        onPress={() => onChange(shiftMonth(month, 1))}
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
