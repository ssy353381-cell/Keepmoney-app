import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { ledgerKeys } from '@/api/keys';
import { supabase } from '@/lib/supabase';
import { chunk, RECEIPT_BUCKET, receiptPath, splitListing } from '@/lib/receipt-path';
import { useLedger } from '@/providers/ledger-provider';

const SIGNED_URL_SECONDS = 3600;
const LIST_PAGE_SIZE = 100;
const REMOVE_BATCH_SIZE = 100;

/** 收據照片的暫時網址（私有 bucket，要用 signed URL 才看得到） */
export function useReceiptUrl(path: string | null) {
  const ledger = useLedger();
  return useQuery({
    queryKey: ledgerKeys.receipt(ledger.id, path ?? ''),
    enabled: path !== null,
    // 網址 60 分鐘到期，50 分鐘後就視為過期重抓
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(path ?? '', SIGNED_URL_SECONDS);
      if (error) {
        throw error;
      }
      return data.signedUrl;
    },
  });
}

/**
 * 上傳一張（已壓縮的）本機 JPEG，回傳它在 bucket 的路徑。
 * 用 expo-file-system 讀成位元組，再複製成獨立的 ArrayBuffer 上傳
 * （React Native 的 fetch 不能直接送 file:// 的 Blob，ArrayBuffer 最穩）。
 */
export async function uploadReceipt(
  ledgerId: string,
  transactionId: string,
  localUri: string,
): Promise<string> {
  const bytes = await new File(localUri).bytes();
  const body = new Uint8Array(bytes).buffer;
  const path = receiptPath(ledgerId, transactionId, randomUUID());
  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) {
    throw error;
  }
  return path;
}

function isNotFound(error: { message?: string; statusCode?: string | number; status?: number }) {
  return (
    String(error.statusCode ?? error.status) === '404' || /not.?found/i.test(error.message ?? '')
  );
}

/** 刪除照片檔案；檔案本來就不存在不算錯 */
export async function removeReceipts(paths: string[]): Promise<void> {
  for (const batch of chunk(paths, REMOVE_BATCH_SIZE)) {
    const { error } = await supabase.storage.from(RECEIPT_BUCKET).remove(batch);
    if (error && !isNotFound(error)) {
      throw error;
    }
  }
}

/** 列出資料夾底下的所有項目（分頁抓完） */
async function listAll(prefix: string) {
  const entries: { name: string; id: string | null }[] = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) {
      throw error;
    }
    entries.push(...data.map((d) => ({ name: d.name, id: d.id })));
    if (data.length < LIST_PAGE_SIZE) {
      return entries;
    }
  }
}

/** 帳本底下所有照片的路徑。Storage 的 list 不會遞迴：先列交易資料夾，再列各資料夾的檔案 */
export async function listLedgerReceiptPaths(ledgerId: string): Promise<string[]> {
  const top = splitListing(ledgerId, await listAll(ledgerId));
  const paths = [...top.files];
  for (const folder of top.folders) {
    const prefix = `${ledgerId}/${folder}`;
    paths.push(...splitListing(prefix, await listAll(prefix)).files);
  }
  return paths;
}

/** 刪除帳本裡的所有收據照片（刪除帳號前呼叫） */
export async function removeAllLedgerReceipts(ledgerId: string): Promise<void> {
  await removeReceipts(await listLedgerReceiptPaths(ledgerId));
}
