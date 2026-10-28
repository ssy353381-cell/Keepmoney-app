import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useBudgets } from '@/api/budgets';
import { categoryIcon, useCategories, type Category, type CategoryKind } from '@/api/categories';
import { useMonthTransactions } from '@/api/transactions';
import { SummaryTiles } from '@/components/summary-tiles';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { MonthSwitcher } from '@/components/ui/month-switcher';
import { ProgressBar, progressTone } from '@/components/ui/progress-bar';
import { TabScreen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { EmptyState, ErrorView, LoadingView } from '@/components/ui/status-views';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthOf, type Month } from '@/lib/date';
import { toErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { budgetProgress, summarize, totalsByCategory, type BudgetProgress } from '@/lib/stats';

const KIND_OPTIONS: { value: CategoryKind; label: string }[] = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
];

export default function StatsScreen() {
  const [month, setMonth] = useState<Month>(() => monthOf(new Date()));
  const [kind, setKind] = useState<CategoryKind>('expense');
  const transactions = useMonthTransactions(month);
  const categories = useCategories();
  const budgets = useBudgets();

  function refresh() {
    transactions.refetch();
    categories.refetch();
    budgets.refetch();
  }

  const error = transactions.error ?? categories.error ?? budgets.error;

  return (
    <TabScreen refreshing={transactions.isRefetching} onRefresh={refresh}>
      <MonthSwitcher month={month} onChange={setMonth} />
      {!transactions.isSuccess || !categories.isSuccess || !budgets.isSuccess ? (
        error ? (
          <ErrorView message={toErrorMessage(error)} onRetry={refresh} />
        ) : (
          <LoadingView />
        )
      ) : (
        <>
          <SummaryTiles summary={summarize(transactions.data)} />
          <BudgetCard
            progress={budgetProgress(budgets.data, transactions.data, categories.data)}
            categories={categories.data}
          />
          <Card>
            <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} />
            <CategoryRanking
              totals={totalsByCategory(transactions.data, categories.data, kind)}
              categories={categories.data}
            />
          </Card>
        </>
      )}
    </TabScreen>
  );
}

function BudgetCard({
  progress,
  categories,
}: {
  progress: BudgetProgress[];
  categories: Category[];
}) {
  const theme = useTheme();
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (
    <Card>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold">本月預算</ThemedText>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/budgets')}>
          <ThemedText type="small" style={{ color: theme.tint }}>
            {progress.length > 0 ? '調整' : '設定預算'}
          </ThemedText>
        </Pressable>
      </View>
      {progress.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          設定每月總預算或分類預算，就能在這裡看到還剩多少可以花。
        </ThemedText>
      ) : (
        progress.map((p) => {
          const category = p.categoryId ? byId.get(p.categoryId) : undefined;
          const name = category ? `${categoryIcon(category, byId)} ${category.name}` : '每月總預算';
          const tone = progressTone(p.ratio);
          const status =
            tone === 'danger'
              ? `超支 ${formatMoney(-p.remaining)}`
              : `剩 ${formatMoney(p.remaining)}${tone === 'warning' ? '（快用完了）' : ''}`;
          return (
            <View key={p.budgetId} style={styles.budget}>
              <View style={styles.budgetText}>
                <ThemedText type="small" numberOfLines={1} style={styles.flexShrink}>
                  {name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatMoney(p.spent)} / {formatMoney(p.amount)}
                </ThemedText>
              </View>
              <ProgressBar ratio={p.ratio} tone={tone} />
              <ThemedText
                type={tone === 'normal' ? 'small' : 'smallBold'}
                themeColor={tone === 'normal' ? 'textSecondary' : 'text'}>
                {tone === 'danger' ? '⚠️ ' : ''}
                {status}
              </ThemedText>
            </View>
          );
        })
      )}
    </Card>
  );
}

/** 分類排行：單一顏色的橫條，長度相對於第一名，金額與比例直接標在旁邊 */
function CategoryRanking({
  totals,
  categories,
}: {
  totals: ReturnType<typeof totalsByCategory>;
  categories: Category[];
}) {
  const theme = useTheme();
  const byId = new Map(categories.map((c) => [c.id, c]));
  if (totals.length === 0) {
    return <EmptyState title="這個月沒有資料" />;
  }
  const max = totals[0].total;
  return (
    <View style={styles.ranking}>
      {totals.map((t) => {
        const category = byId.get(t.categoryId);
        return (
          <View key={t.categoryId} style={styles.rankRow}>
            <View style={styles.rankText}>
              <ThemedText type="small" numberOfLines={1} style={styles.flexShrink}>
                {category ? `${categoryIcon(category, byId)} ${category.name}` : '未分類'}
              </ThemedText>
              <ThemedText type="small" style={styles.rankValue}>
                {formatMoney(t.total)}
                <ThemedText type="small" themeColor="textSecondary">
                  {`  ${Math.round(t.ratio * 100)}%`}
                </ThemedText>
              </ThemedText>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { width: `${(t.total / max) * 100}%`, backgroundColor: theme.tint },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budget: {
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  budgetText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  flexShrink: {
    flexShrink: 1,
  },
  ranking: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  rankRow: {
    gap: Spacing.one,
  },
  rankText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rankValue: {
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 10,
  },
  bar: {
    height: '100%',
    minWidth: 4,
    // 只有資料端是圓角，起點貼齊基準線
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
});
