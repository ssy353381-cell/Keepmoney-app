import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipProps = {
  label: string;
  icon?: string | null;
  selected?: boolean;
  onPress: () => void;
};

/** 可選取的圓角標籤（分類、帳戶、標籤選擇用） */
export function Chip({ label, icon, selected = false, onPress }: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.tint : theme.backgroundElement,
          borderColor: selected ? theme.tint : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.onTint : theme.text }}>
        {icon ? `${icon} ${label}` : label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.7,
  },
});
