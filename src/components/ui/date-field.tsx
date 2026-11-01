import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { MonthSwitcher } from '@/components/ui/month-switcher';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addDays,
  calendarDays,
  formatDateLabel,
  monthOf,
  todayString,
  WEEKDAY_LABELS,
  type Month,
} from '@/lib/date';

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * 日期選擇：快速選「今天／昨天」，或展開月曆選其他日期。
 * 用純 JS 實作，iPhone、Android、Web 的外觀與行為都一樣，也不依賴原生套件。
 */
export function DateField({ value, onChange }: DateFieldProps) {
  const today = todayString();
  const yesterday = addDays(today, -1);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Month>(() => monthOf(value));

  function select(date: string) {
    onChange(date);
    setOpen(false);
  }

  function toggleCalendar() {
    setViewMonth(monthOf(value));
    setOpen((current) => !current);
  }

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        日期
      </ThemedText>
      <View style={styles.row}>
        <Chip label="今天" selected={value === today} onPress={() => select(today)} />
        <Chip label="昨天" selected={value === yesterday} onPress={() => select(yesterday)} />
        <Chip
          label={formatDateLabel(value)}
          icon="📅"
          selected={open || (value !== today && value !== yesterday)}
          onPress={toggleCalendar}
        />
      </View>
      {open && (
        <Calendar
          month={viewMonth}
          selected={value}
          today={today}
          onMonthChange={setViewMonth}
          onSelect={select}
        />
      )}
    </View>
  );
}

type CalendarProps = {
  month: Month;
  selected: string;
  today: string;
  onMonthChange: (month: Month) => void;
  onSelect: (date: string) => void;
};

function Calendar({ month, selected, today, onMonthChange, onSelect }: CalendarProps) {
  const theme = useTheme();
  return (
    <View style={[styles.calendar, { backgroundColor: theme.backgroundElement }]}>
      <MonthSwitcher month={month} onChange={onMonthChange} />
      <View style={styles.grid}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.cell}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
          </View>
        ))}
        {calendarDays(month).map((date, index) => {
          if (!date) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }
          const isSelected = date === selected;
          const isToday = date === today;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={formatDateLabel(date)}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(date)}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  isSelected && { backgroundColor: theme.tint },
                  isToday && !isSelected && { borderColor: theme.tint, borderWidth: 1 },
                ]}>
                <ThemedText type="small" style={{ color: isSelected ? theme.onTint : theme.text }}>
                  {Number(date.slice(8))}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
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
    gap: Spacing.two,
  },
  calendar: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
