import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccounts } from '@/api/accounts';
import { useCategories } from '@/api/categories';
import { useMonthTransactions, useNeedsReviewTransactions } from '@/api/transactions';
import { SummaryTiles } from '@/components/summary-tiles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionRow } from '@/components/transaction-row';
import { Fab } from '@/components/ui/fab';
import { MonthSwitcher } from '@/components/ui/month-switcher';
import { WebTabBarInset } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { EmptyState, ErrorView } from '@/components/ui/status-views';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatDayHeader, monthOf, type Month } from '@/lib/date';
import { toErrorMessage } from '@/lib/errors';
import { groupByDate } from '@/lib/group-by-date';
import { formatMoney, sumAmounts } from '@/lib/money';
import { summarize } from '@/lib/stats';

type ListView = 'all' | 'review';

export default function TransactionsScreen() {
  const { review } = useLocalSearchParams<{ review?: string }>();
  const [month, setMonth] = useState<Month>(() => monthOf(new Date()));
  const [view, setView] = useState<ListView>(review === '1' ? 'review' : 'all');
  // 從首頁提示點進來時（分頁已經開著），參數改變就切到待確認
  const [seenReview, setSeenReview] = useState(review);
  if (review !== seenReview) {
    setSeenReview(review);
    if (review === '1') {
      setView('review');
    }
  }
  const monthTransactions = useMonthTransactions(month);
  const reviewTransactions = useNeedsReviewTransactions();
  const isReview = view === 'review';
  const transactions = isReview ? reviewTransactions : monthTransactions;
  const categories = useCategories();
  const accounts = useAccounts();

  const reviewCount = reviewTransactions.data?.length ?? 0;
  const viewOptions: { value: ListView; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'review', label: `待確認（${reviewCount}）` },
  ];
  const items = transactions.data ?? [];
  const sections = groupByDate(items);
  const categoriesById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const accountsById = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const error = transactions.error ?? categories.error ?? accounts.error;

  function refresh() {
    monthTransactions.refetch();
    reviewTransactions.refetch();
    categories.refetch();
    accounts.refetch();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={transactions.isRefetching} onRefresh={refresh} />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <SegmentedControl options={viewOptions} value={view} onChange={setView} />
              {!isReview && (
                <>
                  <MonthSwitcher month={month} onChange={setMonth} />
                  <SummaryTiles summary={summarize(items)} />
                </>
              )}
              {error && <ErrorView message={toErrorMessage(error)} onRetry={refresh} />}
            </View>
          }
          renderSectionHeader={({ section }) => {
            const dayExpense = sumAmounts(
              section.data.filter((t) => t.type === 'expense').map((t) => t.amount),
            );
            return (
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {formatDayHeader(section.date)}
                </ThemedText>
                {dayExpense > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    支出 {formatMoney(dayExpense)}
                  </ThemedText>
                )}
              </View>
            );
          }}
          renderItem={({ item }) => (
            <TransactionRow
              transaction={item}
              categoriesById={categoriesById}
              accountsById={accountsById}
              onPress={() =>
                router.push({ pathname: '/transaction/[id]', params: { id: item.id } })
              }
            />
          )}
          ListEmptyComponent={
            transactions.isPending ? (
              <ActivityIndicator style={styles.loading} />
            ) : error ? undefined : isReview ? (
              <EmptyState title="沒有待確認的記錄 🎉" />
            ) : (
              <EmptyState title="這個月還沒有記錄" description="點右下角的＋開始記帳" />
            )
          }
        />
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three + WebTabBarInset,
    // 留空間給底部分頁列和＋按鈕
    paddingBottom: BottomTabInset + Spacing.six + Spacing.six,
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  loading: {
    marginTop: Spacing.six,
  },
});
