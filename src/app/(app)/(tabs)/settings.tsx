import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useProfile } from '@/api/profile';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TabScreen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkSupabaseConnection, type ConnectionResult } from '@/lib/check-supabase-connection';
import { confirmAction } from '@/lib/dialogs';
import { toErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/providers/auth-provider';
import { useLedger } from '@/providers/ledger-provider';

export default function SettingsScreen() {
  const theme = useTheme();
  const user = useUser();
  const ledger = useLedger();
  const profile = useProfile();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);

  async function handleSignOut() {
    if (!(await confirmAction('登出', '確定要登出嗎？', '登出'))) {
      return;
    }
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setSigningOut(false);
    if (signOutError) {
      setError(toErrorMessage(signOutError));
    }
  }

  async function handleCheckConnection() {
    setChecking(true);
    setConnection(await checkSupabaseConnection());
    setChecking(false);
  }

  return (
    <TabScreen>
      <ThemedText type="subtitle">設定</ThemedText>

      <Card>
        <ThemedText type="smallBold">帳號</ThemedText>
        <Row label="暱稱" value={profile.data?.display_name ?? '—'} />
        <Row label="Email" value={user.email ?? '—'} />
        <Row label="帳本" value={ledger.name} />
      </Card>

      <Card>
        <ThemedText type="smallBold">連線狀態</ThemedText>
        <Button
          title={checking ? '測試中…' : '測試 Supabase 連線'}
          variant="secondary"
          onPress={handleCheckConnection}
          loading={checking}
        />
        {connection && (
          <ThemedText type="small" themeColor="textSecondary">
            {connection.ok ? '✅ 連線成功' : `❌ 連線失敗：${connection.message}`}
          </ThemedText>
        )}
      </Card>

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
      <Button title="登出" variant="danger" onPress={handleSignOut} loading={signingOut} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
        KeepMoney {Constants.expoConfig?.version ?? ''}
      </ThemedText>
    </TabScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.value} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  version: {
    textAlign: 'center',
  },
});
