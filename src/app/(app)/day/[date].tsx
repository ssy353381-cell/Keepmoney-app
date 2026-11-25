import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccounts } from '@/api/accounts';
import { useBudgets } from '@/api/budgets';
import { useCategories } from '@/api/categories';
import { useMonthTransactions } from '@/api/transactions';
import { LeafSvg } from '@/components/forest/leaf-svg';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionRow } from '@/components/transaction-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { summarizeDays } from '@/lib/daily-summary';
import {
  daysInMonth,
  formatDateLabel,
  formatDayHeader,
  isValidDateString,
  monthOf,
} from '@/lib/date';
import { toErrorMessage } from '@/lib/errors';
import { dailyReference, leafColor, spendingRatio, VEIN_COLORS } from '@/lib/leaf-color';
import { formatMoney } from '@/lib/money';
import { summarize } from '@/lib/stats';

export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  if (!date || !isValidDateString(date)) {
    return <ErrorView message="日期不正確" />;
  }
  return <DayContent date={date} />;
}

function DayContent({ date }: { date: string }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const month = monthOf(date);
  const transactions = useMonthTransactions(month);
  const categories = useCategories();
  const accounts = useAccounts();
  const budgets = useBudgets();

  const monthItems = useMemo(() => transactions.data ?? [], [transactions.data]);
  const dayTransactions = useMemo(
    () =>
      monthItems
        .filter((t) => t.occurred_on === date)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)),
    [monthItems, date],
  );
  const days = useMemo(() => summarizeDays(monthItems), [monthItems]);
  const day = days.get(date);

  const monthBudget = budgets.data?.find((b) => b.category_id === null)?.amount ?? null;
  const reference = dailyReference(
    monthBudget,
    daysInMonth(month),
    [...days.values()].map((d) => d.expense),
  );
  const color = leafColor(spendingRatio(day?.expense ?? 0, reference), scheme);
  const veinColors = VEIN_COLORS[scheme];
  const totals = summarize(dayTransactions);

  const categoriesById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const accountsById = new Map((accounts.data ?? []).map((a) => [a.id, a]));

  const error = transactions.error ?? categories.error ?? accounts.error ?? budgets.error;
  const pending = transactions.isPending || categories.isPending || accounts.isPending;

  function retry() {
    transactions.refetch();
    categories.refetch();
    accounts.refetch();
    budgets.refetch();
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: formatDayHeader(date) }} />
      {error ? (
        <ErrorView message={toErrorMessage(error)} onRetry={retry} />
      ) : pending ? (
        <LoadingView />
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <SafeAreaView edges={['bottom']} style={styles.inner}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.center}>
              {formatDateLabel(date)}
            </ThemedText>

            <View style={styles.leaf}>
              <LeafSvg items={day?.items ?? []} color={color} size={300} />
            </View>

            <View style={styles.legend}>
              <LegendItem color={veinColors.expense} label="實線：支出紋路" />
              <LegendItem color={veinColors.income} label="金色：收入紋路" />
            </View>

            <Card style={styles.totals}>
              <View style={styles.total}>
                <ThemedText type="small" themeColor="textSecondary">
                  收入
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.income }}>
                  {formatMoney(totals.income)}
                </ThemedText>
              </View>
              <View style={styles.total}>
                <ThemedText type="small" themeColor="textSecondary">
                  支出
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.expense }}>
                  {formatMoney(totals.expense)}
                </ThemedText>
              </View>
            </Card>

            <View>
              {dayTransactions.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  這天還沒有記錄
                </ThemedText>
              ) : (
                dayTransactions.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    categoriesById={categoriesById}
                    accountsById={accountsById}
                    onPress={() =>
                      router.push({ pathname: '/transaction/[id]', params: { id: t.id } })
                    }
                  />
                ))
              )}
            </View>

            <Button
              title="在這天記一筆"
              onPress={() =>
                router.push({ pathname: '/transaction/[id]', params: { id: 'new', date } })
              }
            />
          </SafeAreaView>
        </ScrollView>
      )}
    </ThemedView>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  leaf: {
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatch: {
    width: 20,
    height: 4,
    borderRadius: 2,
  },
  totals: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  total: {
    flex: 1,
    gap: Spacing.half,
  },
});
