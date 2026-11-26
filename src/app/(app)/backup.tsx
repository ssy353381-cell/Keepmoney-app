import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useExportBackup,
  useLastBackupDate,
  usePickBackup,
  useRestoreBackup,
  type BackupFormat,
} from '@/api/backup';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BackupFile } from '@/lib/backup';
import { backupReminder } from '@/lib/backup-reminder';
import { todayString } from '@/lib/date';
import { confirmAction } from '@/lib/dialogs';
import { toErrorMessage } from '@/lib/errors';
import { describeRestoreCounts } from '@/lib/restore-result';

export default function BackupScreen() {
  const theme = useTheme();
  const lastBackup = useLastBackupDate();
  const exportBackup = useExportBackup();
  const pickBackup = usePickBackup();
  const restoreBackup = useRestoreBackup();

  const [exportingFormat, setExportingFormat] = useState<BackupFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [picked, setPicked] = useState<BackupFile | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const reminder = backupReminder(lastBackup.data ?? null, todayString());
  const busy = exportBackup.isPending || pickBackup.isPending || restoreBackup.isPending;

  async function handleExport(format: BackupFormat) {
    setExportError(null);
    setExportingFormat(format);
    try {
      await exportBackup.mutateAsync(format);
    } catch (e) {
      setExportError(toErrorMessage(e));
    } finally {
      setExportingFormat(null);
    }
  }

  async function handlePick() {
    setRestoreError(null);
    setRestoreMessage(null);
    setPicked(null);
    try {
      setPicked(await pickBackup.mutateAsync());
    } catch (e) {
      setRestoreError(toErrorMessage(e));
    }
  }

  async function handleRestore() {
    if (!picked) {
      return;
    }
    const confirmed = await confirmAction(
      '確認還原',
      '只會補回不見的資料，不會覆蓋或刪除現有資料；如果備份有問題，整個還原會取消。確定要還原嗎？',
      '還原',
    );
    if (!confirmed) {
      return;
    }
    setRestoreError(null);
    try {
      const counts = await restoreBackup.mutateAsync(picked);
      setRestoreMessage(describeRestoreCounts(counts));
      setPicked(null);
    } catch (e) {
      setRestoreError(toErrorMessage(e));
    }
  }

  return (
    <FormScreen>
      <ThemedText themeColor="textSecondary">
        你的記帳資料已經存在雲端（Supabase）。另外匯出一份備份檔，存到「檔案」、iCloud Drive 或
        Google Drive，萬一帳號出問題也能還原。收據照片不包含在備份裡。
      </ThemedText>

      <Card>
        <ThemedText type="smallBold">備份狀態</ThemedText>
        <ThemedText style={reminder.overdue ? { color: theme.warning } : undefined}>
          {reminder.text}
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="smallBold">匯出</ThemedText>
        <Button
          title="匯出完整備份（JSON）"
          onPress={() => handleExport('json')}
          loading={exportingFormat === 'json'}
          disabled={busy}
        />
        <Button
          title="匯出 Excel 表格（CSV）"
          variant="secondary"
          onPress={() => handleExport('csv')}
          loading={exportingFormat === 'csv'}
          disabled={busy}
        />
        <ThemedText type="small" themeColor="textSecondary">
          CSV 只能看，不能還原。
        </ThemedText>
        {exportError && <ThemedText style={{ color: theme.danger }}>{exportError}</ThemedText>}
      </Card>

      <Card>
        <ThemedText type="smallBold">從備份還原</ThemedText>
        <Button
          title="選擇備份檔"
          variant="secondary"
          onPress={handlePick}
          loading={pickBackup.isPending}
          disabled={busy}
        />
        {restoreError && <ThemedText style={{ color: theme.danger }}>{restoreError}</ThemedText>}
        {restoreMessage && <ThemedText>{restoreMessage}</ThemedText>}
      </Card>

      {picked && (
        <Card>
          <ThemedText type="smallBold">備份內容</ThemedText>
          <Row label="備份日期" value={picked.exportedAt.replace('T', ' ')} />
          <Row label="帳本" value={picked.ledger.name} />
          <Row label="交易" value={`${picked.transactions.length} 筆`} />
          <Row label="帳戶" value={`${picked.accounts.length} 個`} />
          <Row label="分類" value={`${picked.categories.length} 個`} />
          <ThemedText type="small" themeColor="textSecondary">
            同一本帳本的備份只會補回不見的資料，不會覆蓋或刪除現有資料；不同帳本的備份會合併進來。
          </ThemedText>
          <Button
            title="確認還原"
            onPress={handleRestore}
            loading={restoreBackup.isPending}
            disabled={busy}
          />
        </Card>
      )}
    </FormScreen>
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
});
