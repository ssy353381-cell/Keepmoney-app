import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/hooks/use-theme';
import { toErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 6;

export default function SignUpScreen() {
  const theme = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSignUp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('請輸入 Email');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元`);
      return;
    }
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一樣');
      return;
    }

    setSubmitting(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { display_name: displayName.trim() || undefined } },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(toErrorMessage(signUpError));
    } else if (!data.session) {
      // 專案開啟了 Email 驗證：要先到信箱點連結才能登入
      setSentTo(trimmedEmail);
    }
    // 有 session 代表不需要驗證，登入狀態改變後路由會自動切到主畫面
  }

  if (sentTo) {
    return (
      <AuthLayout title="註冊">
        <Card>
          <ThemedText type="smallBold">確認信已寄出</ThemedText>
          <ThemedText type="small">
            請到 {sentTo} 收信，點擊信中的確認連結後，再回到這裡登入。
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            點連結後瀏覽器若顯示無法開啟網頁是正常的，帳號已完成驗證。沒收到信請檢查垃圾郵件匣。
          </ThemedText>
        </Card>
        <Button title="前往登入" onPress={() => router.replace('/sign-in')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="建立帳號">
      <TextField
        label="暱稱（選填）"
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
        maxLength={50}
      />
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
        label={`密碼（至少 ${MIN_PASSWORD_LENGTH} 個字元）`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="再輸入一次密碼"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSignUp}
      />
      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
      <Button title="註冊" onPress={handleSignUp} loading={submitting} />
      <Link href="/sign-in" style={styles.link}>
        <ThemedText type="small" themeColor="textSecondary">
          已經有帳號？登入
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
