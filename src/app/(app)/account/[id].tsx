import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import {
  ACCOUNT_TYPES,
  useAccounts,
  useDeleteAccount,
  useSaveAccount,
  type Account,
  type AccountType,
} from '@/api/accounts';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ChipGroup } from '@/components/ui/chip-group';
import { FormScreen } from '@/components/ui/screen';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/dialogs';
import { toErrorMessage } from '@/lib/errors';
import { amountToInput, parseBalance } from '@/lib/money';
import { closeModal } from '@/lib/navigation';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = id === 'new' ? null : id;
  const accounts = useAccounts();

  if (!accounts.isSuccess) {
    return accounts.error ? (
      <ErrorView message={toErrorMessage(accounts.error)} onRetry={() => accounts.refetch()} />
    ) : (
      <LoadingView />
    );
  }

  const account = accountId ? accounts.data.find((a) => a.id === accountId) : null;
  if (accountId && !account) {
    return <ErrorView message="找不到這個帳戶" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: account ? '編輯帳戶' : '新增帳戶' }} />
      <AccountForm key={accountId ?? 'new'} account={account ?? null} />
    </>
  );
}

function AccountForm({ account }: { account: Account | null }) {
  const theme = useTheme();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'cash');
  const [balanceText, setBalanceText] = useState(amountToInput(account?.initial_balance ?? null));
  const [archived, setArchived] = useState(account?.is_archived ?? false);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveAccount();
  const remove = useDeleteAccount();

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('請輸入帳戶名稱');
      return;
    }
    const initialBalance = parseBalance(balanceText);
    if (initialBalance === null) {
      setError('期初餘額格式不正確（最多兩位小數，欠款請輸入負數）');
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({
        id: account?.id ?? null,
        input: { name: trimmed, type, initial_balance: initialBalance, is_archived: archived },
      });
      closeModal();
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  async function handleDelete() {
    if (!account) {
      return;
    }
    if (!(await confirmAction('刪除帳戶', `確定要刪除「${account.name}」嗎？`, '刪除'))) {
      return;
    }
    try {
      await remove.mutateAsync(account.id);
      closeModal();
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  return (
    <FormScreen>
      <TextField
        label="名稱"
        value={name}
        onChangeText={setName}
        maxLength={50}
        placeholder="例如：台新銀行、悠遊卡"
      />

      <ChipGroup label="類型">
        {ACCOUNT_TYPES.map((t) => (
          <Chip
            key={t.value}
            label={t.label}
            icon={t.icon}
            selected={type === t.value}
            onPress={() => setType(t.value)}
          />
        ))}
      </ChipGroup>

      <View style={styles.field}>
        <TextField
          label="期初餘額"
          value={balanceText}
          onChangeText={setBalanceText}
          // iOS 的數字鍵盤沒有負號，改用含標點的鍵盤
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
          placeholder="0"
        />
        <ThemedText type="small" themeColor="textSecondary">
          開始記帳時帳戶裡的金額；信用卡欠款請輸入負數。
        </ThemedText>
      </View>

      {account && (
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <ThemedText>封存</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              不再使用的帳戶可以封存：保留過去的記錄，但記帳時不會出現。
            </ThemedText>
          </View>
          <Switch value={archived} onValueChange={setArchived} />
        </View>
      )}

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      <Button title="儲存" onPress={handleSave} loading={save.isPending} />
      {account && (
        <Button
          title="刪除帳戶"
          variant="danger"
          onPress={handleDelete}
          loading={remove.isPending}
        />
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  switchText: {
    flex: 1,
    gap: Spacing.half,
  },
});
