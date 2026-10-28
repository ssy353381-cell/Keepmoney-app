import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatDateLabel, parseDateString, toDateString, todayString } from '@/lib/date';

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

/** 日期選擇：快速選「今天／昨天」，或用系統日期選擇器 */
export function DateField({ value, onChange }: DateFieldProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const today = todayString();
  const yesterday = addDays(today, -1);

  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      value: parseDateString(value),
      mode: 'date',
      onValueChange: (_event, date) => onChange(toDateString(date)),
    });
  }

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        日期
      </ThemedText>
      <View style={styles.row}>
        <Chip label="今天" selected={value === today} onPress={() => onChange(today)} />
        <Chip label="昨天" selected={value === yesterday} onPress={() => onChange(yesterday)} />
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={parseDateString(value)}
            mode="date"
            display="compact"
            locale="zh-TW"
            accentColor={theme.tint}
            themeVariant={scheme === 'dark' ? 'dark' : 'light'}
            onValueChange={(_event, date) => onChange(toDateString(date))}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={openAndroidPicker}
            style={[styles.androidButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small">{formatDateLabel(value)}</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  androidButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
  },
});
