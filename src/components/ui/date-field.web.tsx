import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { addDays, isValidDateString, todayString } from '@/lib/date';

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

/** Web 版：沒有系統日期選擇器，改用文字輸入 YYYY-MM-DD */
export function DateField({ value, onChange }: DateFieldProps) {
  const [text, setText] = useState(value);
  const today = todayString();
  const yesterday = addDays(today, -1);

  function select(date: string) {
    setText(date);
    onChange(date);
  }

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        日期
      </ThemedText>
      <View style={styles.row}>
        <Chip label="今天" selected={value === today} onPress={() => select(today)} />
        <Chip label="昨天" selected={value === yesterday} onPress={() => select(yesterday)} />
      </View>
      <TextField
        value={text}
        placeholder="YYYY-MM-DD"
        error={isValidDateString(text) ? null : '請輸入 YYYY-MM-DD 格式的日期'}
        onChangeText={(next) => {
          setText(next);
          if (isValidDateString(next)) {
            onChange(next);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
