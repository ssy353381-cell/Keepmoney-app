import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useAccounts } from '@/api/accounts';
import { useCategories } from '@/api/categories';
import { TRANSACTION_TYPES, useQuickAdd } from '@/api/transactions';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChipGroup } from '@/components/ui/chip-group';
import { DateField } from '@/components/ui/date-field';
import { FormScreen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayString } from '@/lib/date';
import { toErrorMessage } from '@/lib/errors';
import { amountToInput, parseAmount } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { resolveQuickEntry } from '@/lib/quick-entry';
import { parseQuickText } from '@/lib/quick-parse';

type QuickType = 'expense' | 'income';

const QUICK_TYPES = TRANSACTION_TYPES.filter(
  (t): t is { value: QuickType; label: string } => t.value !== 'transfer',
);

/** 快速記帳：打（或用鍵盤麥克風說）一句話，確認預覽後儲存 */
export default function QuickScreen() {
  const accounts = useAccounts();
  const categories = useCategories();

  if (accounts.isSuccess && categories.isSuccess) {
    return <QuickForm accounts={accounts.data} categories={categories.data} />;
  }
  const error = accounts.error ?? categories.error;
  if (error) {
    return (
      <ErrorView
        message={toErrorMessage(error)}
        onRetry={() => {
          accounts.refetch();
          categories.refetch();
        }}
      />
    );
  }
  return <LoadingView />;
}

function QuickForm({
  accounts,
  categories,
}: {
  accounts: ReturnType<typeof useAccounts>['data'] & {};
  categories: ReturnType<typeof useCategories>['data'] & {};
}) {
  const theme = useTheme();
  const quickAdd = useQuickAdd();
  const [text, setText] = useState('');
  // 使用者手動改過的值；null 代表沿用解析結果
  const [userType, setUserType] = useState<QuickType | null>(null);
  const [userAmount, setUserAmount] = useState<string | null>(null);
  const [userCategoryId, setUserCategoryId] = useState<string | null>(null);
  const [userDate, setUserDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseQuickText(text, todayString()), [text]);
  const type = userType ?? parsed.type;
  const resolved = useMemo(
    () => resolveQuickEntry({ ...parsed, type }, categories, accounts),
    [parsed, type, categories, accounts],
  );

  const amountText = userAmount ?? amountToInput(parsed.amount);
  const amount = parseAmount(amountText);
  const categoryId = userCategoryId ?? resolved.categoryId;
  const date = userDate ?? parsed.occurredOn;
  const account = accounts.find((a) => a.id === resolved.accountId);
  const parentCategories = categories.filter(
    (c) => c.kind === type && c.parent_id === null && !c.is_archived,
  );
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedParentId = selectedCategory
    ? (selectedCategory.parent_id ?? selectedCategory.id)
    : null;
  const fallbackCategory = userCategoryId === null && !resolved.categoryMatched;

  const blocker = !account
    ? '還沒有可用的帳戶，請先到「帳戶」頁新增'
    : amount === null
      ? amountText.trim() === ''
        ? '請輸入金額，例如：午餐 120'
        : '金額要大於 0，最多兩位小數'
      : categoryId === null
        ? '還沒有可用的分類'
        : null;

  function changeType(next: QuickType) {
    setUserType(next);
    setUserCategoryId(null);
  }

  async function handleSave() {
    if (blocker !== null || amount === null || !account || categoryId === null) {
      return;
    }
    setError(null);
    try {
      await quickAdd.mutateAsync({
        type,
        amount,
        occurredOn: date,
        categoryId,
        accountId: account.id,
        note: parsed.note || null,
        needsReview: userCategoryId === null && !resolved.categoryMatched,
      });
      closeModal();
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  function openFullForm() {
    router.replace({
      pathname: '/transaction/[id]',
      params: {
        id: 'new',
        type,
        amount: amountText,
        date,
        ...(categoryId ? { categoryId } : {}),
        ...(parsed.note ? { note: parsed.note } : {}),
      },
    });
  }

  return (
    <FormScreen>
      <View style={styles.inputBlock}>
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          maxLength={200}
          placeholder="例如：昨天午餐 120"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="一句話記帳"
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          可以點鍵盤上的 🎤 用說的
        </ThemedText>
      </View>

      <Card style={styles.preview}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          預覽
        </ThemedText>
        <SegmentedControl options={QUICK_TYPES} value={type} onChange={changeType} />
        <TextField
          label="金額"
          value={amountText}
          onChangeText={setUserAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          error={amountText.trim() !== '' && amount === null ? '金額要大於 0，最多兩位小數' : null}
        />
        <ChipGroup label="分類">
          {parentCategories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={c.icon}
              selected={selectedParentId === c.id}
              onPress={() => setUserCategoryId(c.id)}
            />
          ))}
        </ChipGroup>
        {fallbackCategory && selectedCategory && (
          <ThemedText type="small" themeColor="textSecondary">
            {selectedCategory.name}（之後再補）
          </ThemedText>
        )}
        <DateField value={date} onChange={setUserDate} />
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            帳戶
          </ThemedText>
          <ThemedText type="small">
            {account ? account.name : '請先到「帳戶」頁新增帳戶'}
          </ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            備註
          </ThemedText>
          <ThemedText type="small" style={styles.note} numberOfLines={2}>
            {parsed.note || '（無）'}
          </ThemedText>
        </View>
      </Card>

      {(error ?? blocker) && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error ?? blocker}
        </ThemedText>
      )}

      <Button
        title="儲存"
        onPress={handleSave}
        disabled={blocker !== null}
        loading={quickAdd.isPending}
      />
      <Button title="改用完整表單" variant="secondary" onPress={openFullForm} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  inputBlock: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 22,
  },
  preview: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  note: {
    flex: 1,
    textAlign: 'right',
  },
});
