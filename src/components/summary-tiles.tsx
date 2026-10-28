import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import type { MonthSummary } from '@/lib/stats';

/** 本月收入／支出／結餘三個數字 */
export function SummaryTiles({ summary }: { summary: MonthSummary }) {
  return (
    <Card style={styles.row}>
      <Tile label="收入" value={formatMoney(summary.income)} />
      <Tile label="支出" value={formatMoney(summary.expense)} />
      <Tile label="結餘" value={formatMoney(summary.net)} />
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tile: {
    flex: 1,
    gap: Spacing.half,
  },
  value: {
    fontSize: 18,
    lineHeight: 24,
  },
});
