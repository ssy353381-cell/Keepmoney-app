import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBudgets } from '@/api/budgets';
import { useYearTransactions } from '@/api/transactions';
import { ForestSvg } from '@/components/forest/forest-svg';
import { TreeSvg } from '@/components/forest/tree-svg';
import { SummaryTiles } from '@/components/summary-tiles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fab } from '@/components/ui/fab';
import { MonthSwitcher } from '@/components/ui/month-switcher';
import { WebTabBarInset } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ErrorView } from '@/components/ui/status-views';
import { YearSwitcher } from '@/components/ui/year-switcher';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { summarizeDays, summarizeMonths } from '@/lib/daily-summary';
import { monthOf, monthRange, todayString, type Month } from '@/lib/date';
import { toErrorMessage } from '@/lib/errors';
import { summarize } from '@/lib/stats';

type Mode = 'month' | 'year';

const MODES: { value: Mode; label: string }[] = [
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

/** 首頁：一天一片葉、一個月一棵樹、一年一座森林 */
export default function TreeScreen() {
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState<Month>(() => monthOf(new Date()));
  const transactions = useYearTransactions(month.year);
  const budgets = useBudgets();

  const today = todayString();
  const allTransactions = useMemo(() => transactions.data ?? [], [transactions.data]);
  const days = useMemo(() => summarizeDays(allTransactions), [allTransactions]);
  const months = useMemo(
    () => summarizeMonths(month.year, allTransactions),
    [month.year, allTransactions],
  );
  const monthTransactions = useMemo(() => {
    const { start, end } = monthRange(month);
    return allTransactions.filter((t) => t.occurred_on >= start && t.occurred_on <= end);
  }, [allTransactions, month]);
  const monthBudget = budgets.data?.find((b) => b.category_id === null)?.amount ?? null;

  const error = transactions.error ?? budgets.error;
  const recordedDays = months[month.month - 1]?.recordedDays ?? 0;

  function refresh() {
    transactions.refetch();
    budgets.refetch();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={transactions.isRefetching} onRefresh={refresh} />
          }>
          <SegmentedControl options={MODES} value={mode} onChange={setMode} />
          {mode === 'month' ? (
            <MonthSwitcher month={month} onChange={setMonth} />
          ) : (
            <YearSwitcher year={month.year} onChange={(year) => setMonth({ ...month, year })} />
          )}
          <SummaryTiles
            summary={summarize(mode === 'month' ? monthTransactions : allTransactions)}
          />

          {error ? (
            <ErrorView message={toErrorMessage(error)} onRetry={refresh} />
          ) : transactions.isPending ? (
            <ActivityIndicator style={styles.loading} />
          ) : mode === 'month' ? (
            <>
              <TreeSvg
                month={month}
                days={days}
                today={today}
                monthBudget={monthBudget}
                onPressDay={(date) => router.push({ pathname: '/day/[date]', params: { date } })}
              />
              {recordedDays === 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  點右下角＋記一筆，樹就會長出葉子
                </ThemedText>
              )}
            </>
          ) : (
            <ForestSvg
              year={month.year}
              months={months}
              today={today}
              monthBudget={monthBudget}
              onPressMonth={(selected) => {
                setMonth({ year: month.year, month: selected });
                setMode('month');
              }}
            />
          )}
        </ScrollView>
        <Fab label="記一筆" onPress={() => router.push('/transaction/new')} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three + WebTabBarInset,
    // 留空間給底部分頁列和＋按鈕
    paddingBottom: BottomTabInset + Spacing.six + Spacing.six,
  },
  loading: {
    marginTop: Spacing.six,
  },
  hint: {
    textAlign: 'center',
  },
});
