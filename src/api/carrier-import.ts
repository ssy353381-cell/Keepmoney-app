import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { check, fetchAllPages, ledgerKeys } from '@/api/keys';
import { carrierNote, parseCarrierFile, type CarrierParseResult } from '@/lib/carrier-import';
import { looksGarbled, type CarrierRow } from '@/lib/carrier-plan';
import { toErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useLedger } from '@/providers/ledger-provider';

/** 明細檔大小上限：5MB 以上拒絕 */
const MAX_CARRIER_BYTES = 5 * 1024 * 1024;
const TOO_LARGE = '這個檔案太大了（超過 5MB），不像是載具消費明細';
const BATCH_SIZE = 500;

/** 選一個明細檔並解析。使用者取消選擇回傳 null；讀不懂時丟出中文錯誤訊息 */
export function usePickCarrierFile() {
  return useMutation({
    mutationFn: async (): Promise<CarrierParseResult | null> => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        return null;
      }
      const asset = result.assets[0];
      if (asset.size !== undefined && asset.size >= MAX_CARRIER_BYTES) {
        throw new Error(TOO_LARGE);
      }

      let text: string;
      if (asset.file) {
        // Web：選到的是瀏覽器的 File 物件
        text = await asset.file.text();
      } else {
        const file = new File(asset.uri);
        if ((file.size ?? 0) >= MAX_CARRIER_BYTES) {
          throw new Error(TOO_LARGE);
        }
        text = await file.text();
      }

      if (looksGarbled(text)) {
        throw new Error(
          '檔案編碼看起來不是 UTF-8，請用 Excel 或 Numbers 另存成「CSV UTF-8」後再匯入',
        );
      }
      const parsed = parseCarrierFile(text);
      if ('error' in parsed) {
        throw new Error(parsed.error);
      }
      return parsed;
    },
  });
}

/** 目前帳本已經有的發票號碼（含掃描 QR code 記下的） */
export function useExistingInvoiceNumbers() {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.invoiceNumbers(ledger.id),
    queryFn: async (): Promise<Set<string>> => {
      const rows = await fetchAllPages((from, to) =>
        supabase
          .from('transactions')
          .select('id, invoice_number')
          .eq('ledger_id', ledger.id)
          .not('invoice_number', 'is', null)
          .order('id')
          .range(from, to),
      );
      const numbers = new Set<string>();
      for (const row of rows) {
        if (row.invoice_number) {
          numbers.add(row.invoice_number);
        }
      }
      return numbers;
    },
  });
}

export type CarrierImportResult = {
  imported: number;
  /** 某一批失敗時的中文訊息；沒有失敗為 null */
  failure: string | null;
};

/** 匯入發票：每 500 筆一批寫入，某批失敗就停止（已寫入的不回滾） */
export function useImportCarrierInvoices() {
  const ledger = useLedger();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      rows: CarrierRow[];
      accountId: string;
    }): Promise<CarrierImportResult> => {
      let imported = 0;
      for (let start = 0; start < input.rows.length; start += BATCH_SIZE) {
        const batch = input.rows.slice(start, start + BATCH_SIZE);
        try {
          check(
            await supabase.from('transactions').insert(
              batch.map(({ invoice, categoryId }) => ({
                ledger_id: ledger.id,
                type: 'expense' as const,
                amount: invoice.amount,
                occurred_on: invoice.date,
                account_id: input.accountId,
                category_id: categoryId,
                note: carrierNote(invoice),
                invoice_number: invoice.invoiceNumber,
                needs_review: true,
                source: 'import' as const,
              })),
            ),
          );
        } catch (e) {
          return { imported, failure: toErrorMessage(e) };
        }
        imported += batch.length;
      }
      return { imported, failure: null };
    },
    // 就算中途失敗，已寫入的也要讓畫面更新
    onSettled: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all(ledger.id) }),
  });
}
