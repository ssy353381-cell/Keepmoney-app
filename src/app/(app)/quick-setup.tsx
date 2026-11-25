import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAccounts } from '@/api/accounts';
import {
  MAX_QUICK_TOKENS,
  useCreateQuickEntryToken,
  useDeleteQuickEntryToken,
  useQuickEntryTokens,
  type QuickEntryToken,
} from '@/api/quick-entry-tokens';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChipGroup } from '@/components/ui/chip-group';
import { FormScreen } from '@/components/ui/screen';
import { ErrorView, LoadingView } from '@/components/ui/status-views';
import { TextField } from '@/components/ui/text-field';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/dialogs';
import { quickEntryUrl } from '@/lib/env';
import { toErrorMessage } from '@/lib/errors';
import { formatLastUsed } from '@/lib/relative-time';

const DEFAULT_LABEL = '我的 iPhone';
const DATE_FORMAT = 'yyyy-MM-dd';
const HEADER_NAME = 'x-keepmoney-token';

/** 複製到剪貼簿，按鈕文字暫時變成「已複製 ✓」 */
function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  async function copy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), 2000);
  }
  return { copied, copy };
}

function CopyButton({ value, title }: { value: string; title: string }) {
  const { copied, copy } = useCopy(value);
  return (
    <Button title={copied ? '已複製 ✓' : title} variant="secondary" onPress={() => void copy()} />
  );
}

/** 步驟裡的小複製按鈕 */
function MiniCopy({ value }: { value: string }) {
  const theme = useTheme();
  const { copied, copy } = useCopy(value);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void copy()}
      style={({ pressed }) => [
        styles.mini,
        { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small">{copied ? '已複製 ✓' : '複製'}</ThemedText>
    </Pressable>
  );
}

function B({ children }: PropsWithChildren) {
  return <ThemedText type="smallBold">{children}</ThemedText>;
}

function Step({ number, children }: PropsWithChildren<{ number: number }>) {
  const theme = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: theme.tint }]}>
        <ThemedText type="smallBold" style={{ color: theme.onTint }}>
          {number}
        </ThemedText>
      </View>
      <View style={styles.stepBody}>{children}</View>
    </View>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.copyRow}>
      <ThemedText type="small" style={styles.mono} selectable>
        {label}
      </ThemedText>
      <MiniCopy value={value} />
    </View>
  );
}

/** 不開 App 記帳：產生捷徑金鑰，並教使用者在 iPhone「捷徑」App 設定 */
export default function QuickSetupScreen() {
  const tokens = useQuickEntryTokens();
  const accounts = useAccounts();

  if (tokens.isError || accounts.isError) {
    return (
      <ErrorView
        message={toErrorMessage(tokens.error ?? accounts.error)}
        onRetry={() => {
          void tokens.refetch();
          void accounts.refetch();
        }}
      />
    );
  }
  if (!tokens.isSuccess || !accounts.isSuccess) {
    return <LoadingView />;
  }
  return <QuickSetupForm tokens={tokens.data} accounts={accounts.data} />;
}

function QuickSetupForm({
  tokens,
  accounts,
}: {
  tokens: QuickEntryToken[];
  accounts: { id: string; name: string; is_archived: boolean }[];
}) {
  const theme = useTheme();
  const createToken = useCreateQuickEntryToken();
  const deleteToken = useDeleteQuickEntryToken();
  const [label, setLabel] = useState(DEFAULT_LABEL);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 明文金鑰只放在這個 state，離開畫面就消失，絕不寫入任何儲存空間
  const [newToken, setNewToken] = useState<string | null>(null);
  const url = quickEntryUrl();
  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const atLimit = tokens.length >= MAX_QUICK_TOKENS;
  const now = new Date();

  async function handleCreate() {
    setError(null);
    try {
      const token = await createToken.mutateAsync({
        label: label.trim() || DEFAULT_LABEL,
        defaultAccountId: accountId,
      });
      setNewToken(token);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  async function handleDelete(token: QuickEntryToken) {
    const confirmed = await confirmAction(
      '刪除金鑰',
      `刪除「${token.label ?? '未命名'}」後，使用這把金鑰的捷徑就不能記帳了。確定要刪除嗎？`,
      '刪除',
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      await deleteToken.mutateAsync(token.id);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }

  return (
    <FormScreen>
      <ThemedText type="small" themeColor="textSecondary">
        在 iPhone「捷徑」App 建一個捷徑，之後說「嘿 Siri，記一筆」或按動作按鈕，說出「午餐
        120」就會記下來，標成待確認，之後再到 App 補細節。
      </ThemedText>

      <Card>
        <ThemedText type="smallBold">我的捷徑金鑰</ThemedText>
        {tokens.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            還沒有金鑰，先在下方產生一把。
          </ThemedText>
        ) : (
          tokens.map((token) => (
            <View key={token.id} style={styles.tokenRow}>
              <View style={styles.tokenInfo}>
                <ThemedText type="smallBold">{token.label ?? '未命名'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  建立於 {token.created_at.slice(0, 10)}・上次使用{' '}
                  {formatLastUsed(token.last_used_at, now)}
                </ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={deleteToken.isPending}
                onPress={() => void handleDelete(token)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  刪除
                </ThemedText>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      {atLimit ? (
        <ThemedText type="small" themeColor="textSecondary">
          最多只能有 {MAX_QUICK_TOKENS} 把金鑰，請先刪除不用的才能產生新的。
        </ThemedText>
      ) : (
        <Card>
          <ThemedText type="smallBold">產生新金鑰</ThemedText>
          <TextField
            label="名稱"
            value={label}
            onChangeText={setLabel}
            maxLength={30}
            placeholder={DEFAULT_LABEL}
          />
          <ChipGroup label="預設帳戶（不選＝第一個帳戶）">
            {activeAccounts.map((account) => (
              <Chip
                key={account.id}
                label={account.name}
                selected={accountId === account.id}
                onPress={() => setAccountId(accountId === account.id ? null : account.id)}
              />
            ))}
          </ChipGroup>
          {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
          <Button
            title="產生金鑰"
            onPress={() => void handleCreate()}
            loading={createToken.isPending}
          />
        </Card>
      )}
      {atLimit && error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      {newToken && (
        <View style={[styles.newToken, { backgroundColor: theme.warningSubtle }]}>
          <ThemedText type="smallBold">你的新金鑰</ThemedText>
          <ThemedText selectable style={styles.mono}>
            {newToken}
          </ThemedText>
          <CopyButton value={newToken} title="複製金鑰" />
          <ThemedText type="small">
            金鑰只會顯示這一次，請現在貼到捷徑裡。遺失了就刪掉重新產生。任何拿到金鑰的人都能幫你記帳，不要分享給別人。
          </ThemedText>
        </View>
      )}

      <Card>
        <ThemedText type="smallBold">網址</ThemedText>
        <ThemedText type="small" selectable style={styles.mono}>
          {url}
        </ThemedText>
        <CopyButton value={url} title="複製網址" />
      </Card>

      <Card>
        <ThemedText type="smallBold">設定步驟</ThemedText>
        <Step number={1}>
          <ThemedText type="small">
            打開 iPhone 的<B>「捷徑」App</B>，點右上角<B>「＋」</B>新增捷徑，名稱取
            <B>「記一筆」</B>（Siri 就會聽這個名字）。
          </ThemedText>
        </Step>
        <Step number={2}>
          <ThemedText type="small">
            加入動作<B>「聽寫文字」</B>（語言選「中文（台灣）」）。想用打字的話改加
            <B>「要求輸入」</B>。
          </ThemedText>
        </Step>
        <Step number={3}>
          <ThemedText type="small">
            加入動作<B>「取得 URL 的內容」</B>：網址貼上剛剛複製的網址；展開後「方法」選
            <B>POST</B>。
          </ThemedText>
          <ThemedText type="small">
            「標頭」新增一個，鍵是 <B>{HEADER_NAME}</B>，值貼上金鑰：
          </ThemedText>
          <CopyRow label={HEADER_NAME} value={HEADER_NAME} />
          <ThemedText type="small">
            「要求本文」選 <B>JSON</B>，新增欄位 <B>text</B>
            ＝「聽寫的文字」（點變數選取），再新增欄位
            <B>date</B>＝「目前日期」，並把日期格式設成「自訂」：
          </ThemedText>
          <CopyRow label={DATE_FORMAT} value={DATE_FORMAT} />
        </Step>
        <Step number={4}>
          <ThemedText type="small">
            加入動作<B>「顯示通知」</B>，內容選<B>「URL 的內容」</B>。
          </ThemedText>
        </Step>
        <Step number={5}>
          <ThemedText type="small">
            完成後說<B>「嘿 Siri，記一筆」</B>試試看。也可以到「設定 → 動作按鈕 → 捷徑」選它、「設定
            → 輔助使用 → 觸控 →
            背面輕點」設定輕點兩下執行，或把它加到控制中心、主畫面、鎖定畫面小工具。
          </ThemedText>
        </Step>
      </Card>

      <ThemedText type="small" themeColor="textSecondary">
        記下的帳會標成「待確認」，回到 App 首頁就會看到提醒。
      </ThemedText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  tokenInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  newToken: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  mono: {
    fontFamily: Fonts.mono,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: {
    flex: 1,
    gap: Spacing.two,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  mini: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
