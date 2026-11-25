import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { accountTypeInfo, useAccounts, type Account } from '@/api/accounts';
import { useCategories, type Category } from '@/api/categories';
import { useCreateTag, useTags, type Tag } from '@/api/tags';
import {
  TRANSACTION_TYPES,
  useDeleteTransaction,
  useSaveTransaction,
  useTransaction,
  type Transaction,
  type TransactionType,
} from '@/api/transactions';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ChipGroup } from '@/components/ui/chip-group';
import { DateField } from '@/components/ui/date-field';
import { FormScreen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidDateString, todayString } from '@/lib/date';
import { confirmAction } from '@/lib/dialogs';
import { toErrorMessage } from '@/lib/errors';
import { amountToInput, parseAmount } from '@/lib/money';
import { closeModal } from '@/lib/navigation';

export default function TransactionScreen() {
  const params = useLocalSearchParams<{
    id: string;
    date?: string;
    type?: string;
    amount?: string;
    categoryId?: string;
    note?: string;
  }>();
  const { id, date } = params;
  // 從「某一天」進來時，新記錄的預設日期是那一天
  const defaultDate = date && isValidDateString(date) ? date : todayString();
  const transactionId = id === 'new' ? null : id;
  const existing = useTransaction(transactionId);
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();

  if (
    accounts.isSuccess &&
    categories.isSuccess &&
    tags.isSuccess &&
    (transactionId === null || existing.isSuccess)
  ) {
    return (
      <>
        <Stack.Screen options={{ title: transactionId ? '編輯記錄' : '記一筆' }} />
        <TransactionForm
          preset={transactionId === null ? readPreset(params, categories.data) : {}}
          key={transactionId ?? 'new'}
          transactionId={transactionId}
          initial={existing.data?.transaction ?? null}
          initialTagIds={existing.data?.tagIds ?? []}
          defaultDate={defaultDate}
          accounts={accounts.data}
          categories={categories.data}
          tags={tags.data}
        />
      </>
    );
  }

  const error = existing.error ?? accounts.error ?? categories.error ?? tags.error;
  if (error) {
    return (
      <ErrorView
        message={toErrorMessage(error)}
        onRetry={() => {
          existing.refetch();
          accounts.refetch();
          categories.refetch();
          tags.refetch();
        }}
      />
    );
  }
  return <LoadingView />;
}

type Preset = {
  type?: TransactionType;
  amount?: number;
  categoryId?: string;
  note?: string;
};

/** 讀取從快速記帳帶過來的預設值；不合法的參數一律忽略 */
function readPreset(
  params: { type?: string; amount?: string; categoryId?: string; note?: string },
  categories: Category[],
): Preset {
  const type = TRANSACTION_TYPES.find((t) => t.value === params.type)?.value;
  const amount = params.amount ? parseAmount(params.amount) : null;
  const category = params.categoryId
    ? categories.find((c) => c.id === params.categoryId)
    : undefined;
  const categoryOk =
    category !== undefined &&
    type !== undefined &&
    type !== 'transfer' &&
    category.kind === type &&
    !category.is_archived;
  return {
    type,
    amount: amount ?? undefined,
    categoryId: categoryOk ? category.id : undefined,
    note: params.note?.trim() ? params.note.trim().slice(0, 200) : undefined,
  };
}

type TransactionFormProps = {
  preset: Preset;
  transactionId: string | null;
  initial: Transaction | null;
  initialTagIds: string[];
  defaultDate: string;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
};

function TransactionForm({
  preset,
  transactionId,
  initial,
  initialTagIds,
  defaultDate,
  accounts,
  categories,
  tags,
}: TransactionFormProps) {
  const theme = useTheme();
  // 封存的帳戶不能選，但編輯舊記錄時仍要顯示原本選的帳戶
  const selectableAccounts = accounts.filter(
    (a) => !a.is_archived || a.id === initial?.account_id || a.id === initial?.to_account_id,
  );

  const [type, setType] = useState<TransactionType>(initial?.type ?? preset.type ?? 'expense');
  const [amountText, setAmountText] = useState(amountToInput(initial?.amount ?? preset.amount));
  const [categoryId, setCategoryId] = useState<string | null>(
    initial?.category_id ?? preset.categoryId ?? null,
  );
  const [accountId, setAccountId] = useState<string | null>(
    initial?.account_id ?? selectableAccounts[0]?.id ?? null,
  );
  const [toAccountId, setToAccountId] = useState<string | null>(initial?.to_account_id ?? null);
  const [date, setDate] = useState(initial?.occurred_on ?? defaultDate);
  const [note, setNote] = useState(initial?.note ?? preset.note ?? '');
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds);
  const [newTagName, setNewTagName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useSaveTransaction();
  const remove = useDeleteTransaction();
  const createTag = useCreateTag();

  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const selectedCategory = categoryId ? categoriesById.get(categoryId) : undefined;
  const selectedParentId = selectedCategory
    ? (selectedCategory.parent_id ?? selectedCategory.id)
    : null;
  const isVisible = (c: Category) => !c.is_archived || c.id === categoryId;
  const parentCategories = categories.filter(
    (c) => c.kind === type && c.parent_id === null && isVisible(c),
  );
  const childCategories = categories.filter(
    (c) => selectedParentId !== null && c.parent_id === selectedParentId && isVisible(c),
  );

  function changeType(next: TransactionType) {
    setType(next);
    setCategoryId(null);
    setToAccountId(null);
    setError(null);
  }

  function toggleTag(tagId: string) {
    setTagIds((current) =>
      current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId],
    );
  }

  async function handleAddTag() {
    const name = newTagName.trim();
    if (!name) {
      return;
    }
    const existingTag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    try {
      const tag = existingTag ?? (await createTag.mutateAsync(name));
      setTagIds((current) => (current.includes(tag.id) ? current : [...current, tag.id]));
      setNewTagName('');
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  async function handleSave() {
    const amount = parseAmount(amountText);
    if (amount === null) {
      setError('請輸入大於 0 的金額（最多兩位小數）');
      return;
    }
    if (!accountId) {
      setError('請選擇帳戶');
      return;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setError('請選擇不同的轉入帳戶');
      return;
    }
    if (type !== 'transfer' && !categoryId) {
      setError('請選擇分類');
      return;
    }

    setError(null);
    try {
      await save.mutateAsync({
        id: transactionId,
        input: {
          type,
          amount,
          occurred_on: date,
          account_id: accountId,
          to_account_id: type === 'transfer' ? toAccountId : null,
          category_id: type === 'transfer' ? null : categoryId,
          note: note.trim() || null,
          // 在完整表單儲存就是確認過了
          needs_review: false,
        },
        tagIds,
      });
      closeModal();
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  async function handleDelete() {
    if (!transactionId) {
      return;
    }
    if (!(await confirmAction('刪除記錄', '確定要刪除這筆記錄嗎？刪除後無法復原。', '刪除'))) {
      return;
    }
    try {
      await remove.mutateAsync(transactionId);
      closeModal();
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  return (
    <FormScreen>
      {initial?.needs_review && (
        <Card>
          <ThemedText type="small">這筆是快速記下的，確認分類、帳戶後按儲存就完成了</ThemedText>
        </Card>
      )}
      <SegmentedControl options={TRANSACTION_TYPES} value={type} onChange={changeType} />

      <TextField
        label="金額"
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="0"
        autoFocus={!transactionId}
        style={styles.amount}
      />

      {type !== 'transfer' && (
        <View style={styles.section}>
          <ChipGroup label="分類">
            {parentCategories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                icon={c.icon}
                selected={selectedParentId === c.id}
                onPress={() => setCategoryId(c.id)}
              />
            ))}
          </ChipGroup>
          {childCategories.length > 0 && (
            <ChipGroup label="子分類（選填）">
              {childCategories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(categoryId === c.id ? selectedParentId : c.id)}
                />
              ))}
            </ChipGroup>
          )}
        </View>
      )}

      <AccountPicker
        label={type === 'transfer' ? '從哪個帳戶轉出' : '帳戶'}
        accounts={selectableAccounts}
        value={accountId}
        onChange={setAccountId}
      />
      {type === 'transfer' && (
        <AccountPicker
          label="轉入哪個帳戶"
          accounts={selectableAccounts.filter((a) => a.id !== accountId)}
          value={toAccountId}
          onChange={setToAccountId}
        />
      )}

      <DateField value={date} onChange={setDate} />

      <TextField
        label="備註（選填）"
        value={note}
        onChangeText={setNote}
        maxLength={200}
        placeholder="例如：午餐、計程車"
      />

      <View style={styles.section}>
        <ChipGroup label="標籤（選填）">
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={`#${tag.name}`}
              selected={tagIds.includes(tag.id)}
              onPress={() => toggleTag(tag.id)}
            />
          ))}
        </ChipGroup>
        <View style={styles.newTag}>
          <View style={styles.newTagInput}>
            <TextField
              value={newTagName}
              onChangeText={setNewTagName}
              maxLength={30}
              placeholder="新增標籤，例如：旅行"
              onSubmitEditing={handleAddTag}
            />
          </View>
          <Button
            title="新增"
            variant="secondary"
            onPress={handleAddTag}
            loading={createTag.isPending}
          />
        </View>
      </View>

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      <Button title="儲存" onPress={handleSave} loading={save.isPending} />
      {transactionId && (
        <Button
          title="刪除這筆記錄"
          variant="danger"
          onPress={handleDelete}
          loading={remove.isPending}
        />
      )}
    </FormScreen>
  );
}

function AccountPicker({
  label,
  accounts,
  value,
  onChange,
}: {
  label: string;
  accounts: Account[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (accounts.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {label}：還沒有可用的帳戶，請先到「帳戶」頁新增
      </ThemedText>
    );
  }
  return (
    <ChipGroup label={label}>
      {accounts.map((a) => (
        <Chip
          key={a.id}
          label={a.name}
          icon={accountTypeInfo(a.type).icon}
          selected={value === a.id}
          onPress={() => onChange(a.id)}
        />
      ))}
    </ChipGroup>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontSize: 28,
    fontWeight: '600',
    minHeight: 56,
  },
  section: {
    gap: Spacing.three,
  },
  newTag: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  newTagInput: {
    flex: 1,
  },
});
