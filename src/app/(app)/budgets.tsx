import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { planBudgetChanges, useBudgets, useSaveBudgets, type Budget } from '@/api/budgets';
import { useCategories, type Category } from '@/api/categories';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/screen';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toErrorMessage } from '@/lib/errors';
import { amountToInput, parseAmount } from '@/lib/money';
import { closeModal } from '@/lib/navigation';

/** 表單欄位的 key：每月總預算用 TOTAL，分類預算用分類 id */
const TOTAL = 'total';

export default function BudgetsScreen() {
  const budgets = useBudgets();
  const categories = useCategories();

  if (budgets.isSuccess && categories.isSuccess) {
    return <BudgetsForm budgets={budgets.data} categories={categories.data} />;
  }
  const error = budgets.error ?? categories.error;
  if (error) {
    return (
      <ErrorView
        message={toErrorMessage(error)}
        onRetry={() => {
          budgets.refetch();
          categories.refetch();
        }}
      />
    );
  }
  return <LoadingView />;
}

function BudgetsForm({ budgets, categories }: { budgets: Budget[]; categories: Category[] }) {
  const theme = useTheme();
  const save = useSaveBudgets();
  // 預算只能設在最上層的支出分類（子分類的支出會併入父分類計算）
  const budgetCategories = categories.filter(
    (c) =>
      c.kind === 'expense' &&
      c.parent_id === null &&
      (!c.is_archived || budgets.some((b) => b.category_id === c.id)),
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const amountOf = (categoryId: string | null) =>
      amountToInput(budgets.find((b) => b.category_id === categoryId)?.amount ?? null);
    return Object.fromEntries([
      [TOTAL, amountOf(null)],
      ...budgetCategories.map((c) => [c.id, amountOf(c.id)]),
    ]);
  });
  const [error, setError] = useState<string | null>(null);

  function setValue(key: string, text: string) {
    setValues((current) => ({ ...current, [key]: text }));
  }

  async function handleSave() {
    const fields = [
      { key: TOTAL, categoryId: null, name: '每月總預算' },
      ...budgetCategories.map((c) => ({ key: c.id, categoryId: c.id, name: c.name })),
    ];
    const drafts = [];
    for (const field of fields) {
      const text = (values[field.key] ?? '').trim();
      const amount = text === '' ? null : parseAmount(text);
      if (text !== '' && amount === null) {
        setError(`「${field.name}」的金額格式不正確（需大於 0，最多兩位小數）`);
        return;
      }
      drafts.push({ categoryId: field.categoryId, amount });
    }

    setError(null);
    try {
      await save.mutateAsync(planBudgetChanges(budgets, drafts));
      closeModal();
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  return (
    <FormScreen>
      <ThemedText type="small" themeColor="textSecondary">
        預算每個月都適用，留白代表不設定。分類預算會把子分類的支出一起算進去。
      </ThemedText>

      <TextField
        label="每月總預算"
        value={values[TOTAL]}
        onChangeText={(text) => setValue(TOTAL, text)}
        keyboardType="decimal-pad"
        placeholder="不設定"
      />

      <Card style={styles.list}>
        <ThemedText type="smallBold">分類預算</ThemedText>
        {budgetCategories.map((c) => (
          <View key={c.id} style={styles.row}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {c.icon ? `${c.icon} ${c.name}` : c.name}
            </ThemedText>
            <View style={styles.input}>
              <TextField
                value={values[c.id]}
                onChangeText={(text) => setValue(c.id, text)}
                keyboardType="decimal-pad"
                placeholder="不設定"
                accessibilityLabel={`${c.name}的每月預算`}
              />
            </View>
          </View>
        ))}
      </Card>

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
      <Button title="儲存" onPress={handleSave} loading={save.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  name: {
    flex: 1,
  },
  input: {
    width: 140,
  },
});
