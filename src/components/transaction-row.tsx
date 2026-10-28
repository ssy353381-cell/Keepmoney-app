import { Pressable, StyleSheet, View } from 'react-native';

import type { Account } from '@/api/accounts';
import { categoryIcon, categoryLabel, type Category } from '@/api/categories';
import type { Transaction } from '@/api/transactions';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

type TransactionRowProps = {
  transaction: Transaction;
  categoriesById: Map<string, Category>;
  accountsById: Map<string, Account>;
  onPress: () => void;
};

export function TransactionRow({
  transaction: t,
  categoriesById,
  accountsById,
  onPress,
}: TransactionRowProps) {
  const theme = useTheme();
  const category = t.category_id ? categoriesById.get(t.category_id) : undefined;
  const account = accountsById.get(t.account_id)?.name ?? '';

  const isTransfer = t.type === 'transfer';
  const title = isTransfer ? '轉帳' : category ? categoryLabel(category, categoriesById) : '未分類';
  const icon = isTransfer ? '🔁' : category ? categoryIcon(category, categoriesById) : '🏷️';
  const accountText = isTransfer
    ? `${account} → ${t.to_account_id ? (accountsById.get(t.to_account_id)?.name ?? '') : ''}`
    : account;
  const subtitle = t.note ? `${t.note}・${accountText}` : accountText;

  const amountText =
    t.type === 'expense'
      ? `-${formatMoney(t.amount)}`
      : t.type === 'income'
        ? `+${formatMoney(t.amount)}`
        : formatMoney(t.amount);
  const amountColor =
    t.type === 'expense' ? theme.expense : t.type === 'income' ? theme.income : theme.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ${amountText} ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText>{icon}</ThemedText>
      </View>
      <View style={styles.text}>
        <ThemedText numberOfLines={1}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={[styles.amount, { color: amountColor }]}>
        {amountText}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  amount: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
});
