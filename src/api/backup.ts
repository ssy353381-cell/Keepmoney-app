import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { check, fetchAllPages, ledgerKeys, unwrap } from '@/api/keys';
import {
  backupFileName,
  buildBackup,
  planRestore,
  transactionsToCsv,
  validateBackup,
  type BackupData,
  type BackupFile,
} from '@/lib/backup';
import { todayString } from '@/lib/date';
import { toRestoreErrorMessage } from '@/lib/errors';
import { parseRestoreCounts, type RestoreCounts } from '@/lib/restore-result';
import { supabase } from '@/lib/supabase';
import { useLedger } from '@/providers/ledger-provider';
import type { Json } from '@/types/database';

export type BackupFormat = 'json' | 'csv';

/** 備份檔大小上限：超過就拒絕，避免一次讀進太大的檔案 */
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

/**
 * 交易與定期收支故意不選 created_by（使用者 uuid 不該出現在備份檔裡）。
 * BackupData 的型別要求這個欄位，所以下面查完後再補成 null。
 */
const TRANSACTION_COLUMNS =
  'id,ledger_id,type,amount,occurred_on,account_id,to_account_id,category_id,category_kind,note,recurring_id,invoice_number,receipt_path,needs_review,source,created_at,updated_at';
const RECURRING_COLUMNS =
  'id,ledger_id,type,amount,account_id,to_account_id,category_id,category_kind,note,frequency,interval_count,start_on,end_on,next_occurs_on,is_active,created_at,updated_at';

/** 抓目前帳本的全部資料（每張表都分頁抓完，超過 1000 筆也不會漏） */
export async function fetchBackupData(ledger: {
  id: string;
  name: string;
  currency: string;
}): Promise<BackupData> {
  const [
    accounts,
    categories,
    tags,
    transactions,
    transactionTags,
    budgets,
    recurringTransactions,
  ] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase.from('accounts').select('*').eq('ledger_id', ledger.id).order('id').range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from('categories')
        .select('*')
        .eq('ledger_id', ledger.id)
        .order('id')
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase.from('tags').select('*').eq('ledger_id', ledger.id).order('id').range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from('transactions')
        .select(TRANSACTION_COLUMNS)
        .eq('ledger_id', ledger.id)
        .order('id')
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from('transaction_tags')
        .select('*')
        .eq('ledger_id', ledger.id)
        .order('transaction_id')
        .order('tag_id')
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase.from('budgets').select('*').eq('ledger_id', ledger.id).order('id').range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from('recurring_transactions')
        .select(RECURRING_COLUMNS)
        .eq('ledger_id', ledger.id)
        .order('id')
        .range(from, to),
    ),
  ]);

  return {
    ledger: { id: ledger.id, name: ledger.name, currency: ledger.currency },
    accounts,
    categories,
    tags,
    transactions: transactions.map((t) => ({ ...t, created_by: null })),
    transaction_tags: transactionTags,
    budgets,
    recurring_transactions: recurringTransactions.map((r) => ({ ...r, created_by: null })),
  };
}

// ---------------------------------------------------------------------------
// 上次備份日期（存在這支手機上）
// ---------------------------------------------------------------------------

const lastBackupKey = (ledgerId: string) => `keepmoney:lastBackupAt:${ledgerId}`;
const lastBackupQueryKey = (ledgerId: string) => [...ledgerKeys.all(ledgerId), 'last-backup'];

/** 上次匯出 JSON 備份的日期（YYYY-MM-DD）；沒有紀錄或讀取失敗回傳 null */
export function useLastBackupDate() {
  const ledger = useLedger();
  return useQuery({
    queryKey: lastBackupQueryKey(ledger.id),
    queryFn: async (): Promise<string | null> => {
      try {
        return await AsyncStorage.getItem(lastBackupKey(ledger.id));
      } catch {
        return null;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// 匯出
// ---------------------------------------------------------------------------

const SHARE_OPTIONS = {
  json: { mimeType: 'application/json', UTI: 'public.json', dialogTitle: '匯出備份' },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: '匯出備份' },
} as const;

/** 匯出備份：抓資料 → 在快取目錄寫檔 → 開啟系統分享選單（可存到「檔案」、iCloud Drive、Google Drive） */
export function useExportBackup() {
  const ledger = useLedger();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (format: BackupFormat): Promise<void> => {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('這個裝置不支援分享檔案，請改用手機的 App 匯出備份');
      }

      const data = await fetchBackupData(ledger);
      const today = todayString();
      const content =
        format === 'json'
          ? JSON.stringify(buildBackup(data, new Date()), null, 2)
          : transactionsToCsv({
              transactions: data.transactions,
              categories: data.categories,
              accounts: data.accounts,
              tags: data.tags,
              transactionTags: data.transaction_tags,
            });

      const file = new File(Paths.cache, backupFileName(ledger.name, today, format));
      file.create({ overwrite: true });
      await file.write(content);
      await Sharing.shareAsync(file.uri, SHARE_OPTIONS[format]);

      // 只有完整備份（JSON）才算「已備份」；CSV 不能還原
      if (format === 'json') {
        try {
          await AsyncStorage.setItem(lastBackupKey(ledger.id), today);
        } catch {
          // 記不起來只是少了提醒，不影響備份本身
        }
      }
    },
    onSuccess: (_data, format) => {
      if (format === 'json') {
        queryClient.invalidateQueries({ queryKey: lastBackupQueryKey(ledger.id) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// 選擇備份檔
// ---------------------------------------------------------------------------

const NOT_A_BACKUP = '這不是 KeepMoney 的備份檔';

/** 選一個備份檔並驗證內容。使用者取消選擇回傳 null */
export function usePickBackup() {
  return useMutation({
    mutationFn: async (): Promise<BackupFile | null> => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'public.json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        return null;
      }
      const asset = result.assets[0];
      if (asset.size !== undefined && asset.size > MAX_BACKUP_BYTES) {
        throw new Error('這個檔案太大了（超過 20MB），不是 KeepMoney 的備份檔');
      }

      let text: string;
      if (asset.file) {
        // Web：選到的是瀏覽器的 File 物件
        text = await asset.file.text();
      } else {
        const file = new File(asset.uri);
        if ((file.size ?? 0) > MAX_BACKUP_BYTES) {
          throw new Error('這個檔案太大了（超過 20MB），不是 KeepMoney 的備份檔');
        }
        text = await file.text();
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(NOT_A_BACKUP);
      }
      const validated = validateBackup(json);
      if (!validated.ok) {
        throw new Error(validated.message);
      }
      return validated.backup;
    },
  });
}

// ---------------------------------------------------------------------------
// 還原
// ---------------------------------------------------------------------------

/** 從備份還原：只補回不見的資料，衝突的略過。成功回傳資料庫實際寫入的筆數 */
export function useRestoreBackup() {
  const ledger = useLedger();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (backup: BackupFile): Promise<RestoreCounts> => {
      try {
        const [accounts, categories, tags] = await Promise.all([
          fetchAllPages((from, to) =>
            supabase
              .from('accounts')
              .select('*')
              .eq('ledger_id', ledger.id)
              .order('id')
              .range(from, to),
          ),
          fetchAllPages((from, to) =>
            supabase
              .from('categories')
              .select('*')
              .eq('ledger_id', ledger.id)
              .order('id')
              .range(from, to),
          ),
          fetchAllPages((from, to) =>
            supabase
              .from('tags')
              .select('*')
              .eq('ledger_id', ledger.id)
              .order('id')
              .range(from, to),
          ),
        ]);

        const { summary: _summary, ...payload } = planRestore(
          backup,
          { ledgerId: ledger.id, accounts, categories, tags },
          randomUUID,
        );
        const result = await supabase.rpc('restore_backup', {
          p_ledger_id: ledger.id,
          p_payload: payload as unknown as Json,
        });
        check(result);
        return parseRestoreCounts(unwrap(result));
      } catch (e) {
        // 資料庫的錯誤訊息是英文；整個還原是單一交易，失敗時什麼都沒有寫入
        throw new Error(toRestoreErrorMessage(e));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) });
    },
  });
}
