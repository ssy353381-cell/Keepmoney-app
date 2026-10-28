import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/hooks/use-theme';
import { toErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError('請輸入 Email 和密碼');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    // 成功時登入狀態改變，路由會自動切到主畫面
    if (signInError) {
      setError(toErrorMessage(signInError));
    }
  }

  return (
    <AuthLayout title="登入">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      <TextField
        label="密碼"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSignIn}
      />
      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
      <Button title="登入" onPress={handleSignIn} loading={submitting} />
      <Link href="/sign-up" style={styles.link}>
        <ThemedText type="small" themeColor="textSecondary">
          還沒有帳號？立即註冊
        </ThemedText>
      </Link>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center',
    padding: 8,
  },
});
