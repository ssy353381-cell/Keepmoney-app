import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 右下角的圓形新增按鈕 */
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        // 放在底部分頁列上方
        { backgroundColor: theme.tint, bottom: insets.bottom + BottomTabInset + Spacing.three },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.plus, { color: theme.onTint }]}>＋</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },
  plus: {
    fontSize: 28,
    lineHeight: 32,
  },
  pressed: {
    opacity: 0.8,
  },
});
