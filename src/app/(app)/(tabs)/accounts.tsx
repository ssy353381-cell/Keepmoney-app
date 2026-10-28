import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { accountTypeInfo, useAccountBalances, useAccounts, type Account } from '@/api/accounts';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TabScreen } from '@/components/ui/screen';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toErrorMessage } from '@/lib/errors';
import { formatMoney, sumAmounts } from '@/lib/money';

export default function AccountsScreen() {
  const accounts = useAccounts();
  const balances = useAccountBalances();

  function refresh() {
    accounts.refetch();
    balances.refetch();
  }

  if (!accounts.isSuccess || !balances.isSuccess) {
    const error = accounts.error ?? balances.error;
    return error ? (
      <ErrorView message={toErrorMessage(error)} onRetry={refresh} />
    ) : (
      <LoadingView />
    );
  }

  const balanceOf = (a: Account) => balances.data.get(a.id) ?? a.initial_balance;
  const active = accounts.data.filter((a) => !a.is_archived);
  const archived = accounts.data.filter((a) => a.is_archived);
  const total = sumAmounts(active.map(balanceOf));

  return (
    <TabScreen refreshing={accounts.isRefetching || balances.isRefetching} onRefresh={refresh}>
      <ThemedText type="subtitle">帳戶</ThemedText>

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          淨資產（所有未封存帳戶）
        </ThemedText>
        <ThemedText type="title" numberOfLines={1} adjustsFontSizeToFit style={styles.total}>
          {formatMoney(total)}
        </ThemedText>
      </Card>

      <Card style={styles.list}>
        {active.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            還沒有帳戶
          </ThemedText>
        ) : (
          active.map((a) => <AccountRow key={a.id} account={a} balance={balanceOf(a)} />)
        )}
      </Card>

      <Button title="新增帳戶" variant="secondary" onPress={() => router.push('/account/new')} />

      {archived.length > 0 && (
        <View style={styles.archived}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            已封存
          </ThemedText>
          <Card style={styles.list}>
            {archived.map((a) => (
              <AccountRow key={a.id} account={a} balance={balanceOf(a)} />
            ))}
          </Card>
        </View>
      )}
    </TabScreen>
  );
}

function AccountRow({ account, balance }: { account: Account; balance: number }) {
  const theme = useTheme();
  const info = accountTypeInfo(account.type);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <ThemedText style={styles.icon}>{info.icon}</ThemedText>
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1}>{account.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {info.label}
        </ThemedText>
      </View>
      <ThemedText
        type="smallBold"
        style={[styles.balance, balance < 0 && { color: theme.expense }]}>
        {formatMoney(balance)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  total: {
    fontSize: 40,
    lineHeight: 48,
  },
  list: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    fontSize: 24,
    lineHeight: 32,
  },
  rowText: {
    flex: 1,
  },
  balance: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  archived: {
    gap: Spacing.two,
  },
});
