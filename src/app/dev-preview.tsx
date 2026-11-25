import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ForestSvg } from '@/components/forest/forest-svg';
import { LeafSvg } from '@/components/forest/leaf-svg';
import { TreeSvg } from '@/components/forest/tree-svg';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  summarizeDays,
  summarizeMonths,
  type DayItem,
  type SummaryTransaction,
} from '@/lib/daily-summary';
import { dailyReference, leafColor, spendingRatio } from '@/lib/leaf-color';

/** 開發預覽：不需登入，用寫死的假資料看樹葉、樹、森林的樣子（只在開發模式有這個路由） */

const TODAY = '2026-11-25';
const MONTH_BUDGET = 30000;

function items(entries: [DayItem['type'], number, boolean?][]): DayItem[] {
  return entries.map(([type, amount, needsReview], i) => ({
    id: `item-${i}`,
    type,
    amount,
    createdAt: `2026-11-25T${String(i % 24).padStart(2, '0')}:00:00+00:00`,
    needsReview,
  }));
}

const LEAVES: { title: string; items: DayItem[]; expense: number }[] = [
  { title: '0 筆', items: [], expense: 0 },
  { title: '1 筆', items: items([['expense', 350]]), expense: 350 },
  {
    title: '8 筆（含收入、待確認虛線）',
    items: items([
      ['expense', 120],
      ['expense', 85],
      ['income', 2000],
      ['expense', 640, true],
      ['expense', 45],
      ['income', 300],
      ['expense', 1280],
      ['expense', 200, true],
    ]),
    expense: 2370,
  },
  {
    title: '25 筆',
    items: items(
      Array.from({ length: 25 }, (_, i): [DayItem['type'], number] => [
        i % 6 === 5 ? 'income' : 'expense',
        30 + ((i * 97) % 700),
      ]),
    ),
    expense: 9000,
  },
];

/** 固定的偽亂數，讓每次打開預覽看到一樣的樹 */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function fakeTransactions(): SummaryTransaction[] {
  const random = seeded(7);
  const result: SummaryTransaction[] = [];
  let id = 0;
  for (let month = 1; month <= 11; month++) {
    // 6 月整月沒記帳；1 月只有幾天；其他月份大多數日子有記
    const chance = month === 6 ? 0 : month === 1 ? 0.15 : month === 11 ? 0.6 : 0.5 + month * 0.04;
    const lastDay = month === 11 ? 25 : new Date(2026, month, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      if (random() > chance) {
        continue;
      }
      const count = 1 + Math.floor(random() * 4);
      for (let k = 0; k < count; k++) {
        const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        result.push({
          id: `t${id++}`,
          type: random() < 0.12 ? 'income' : 'expense',
          amount: Math.round(40 + random() * random() * 2200),
          occurred_on: date,
          created_at: `${date}T${String(8 + k * 3).padStart(2, '0')}:00:00+00:00`,
        });
      }
    }
  }
  return result;
}

export default function DevPreviewScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [tapped, setTapped] = useState('（點樹上的葉子或森林裡的樹）');

  const transactions = useMemo(() => fakeTransactions(), []);
  const days = useMemo(() => summarizeDays(transactions), [transactions]);
  const months = useMemo(() => summarizeMonths(2026, transactions), [transactions]);
  const novemberExpenses = useMemo(
    () => [...days.values()].filter((d) => d.date.startsWith('2026-11')).map((d) => d.expense),
    [days],
  );
  const reference = dailyReference(MONTH_BUDGET, 30, novemberExpenses);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">開發預覽</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            假資料，今天當作 {TODAY}，每月預算 {MONTH_BUDGET}
          </ThemedText>

          <Section title="樹葉">
            <View style={styles.leaves}>
              {LEAVES.map((leaf) => (
                <View key={leaf.title} style={styles.leafCell}>
                  <LeafSvg
                    items={leaf.items}
                    color={leafColor(spendingRatio(leaf.expense, reference), scheme)}
                    size={200}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    {leaf.title}
                  </ThemedText>
                </View>
              ))}
            </View>
          </Section>

          <Section title="2026 年 11 月的樹">
            <TreeSvg
              month={{ year: 2026, month: 11 }}
              days={days}
              today={TODAY}
              monthBudget={MONTH_BUDGET}
              onPressDay={(date) => setTapped(`點了 ${date}`)}
            />
          </Section>

          <Section title="2026 年的森林">
            <ForestSvg
              year={2026}
              months={months}
              today={TODAY}
              monthBudget={MONTH_BUDGET}
              onPressMonth={(month) => setTapped(`點了 ${month} 月`)}
            />
          </Section>

          <ThemedText type="small" themeColor="textSecondary">
            {tapped}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
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
    gap: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  section: {
    gap: Spacing.two,
  },
  leaves: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
  },
  leafCell: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
