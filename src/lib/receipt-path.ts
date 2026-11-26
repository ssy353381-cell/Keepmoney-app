/** 收據照片在 receipts bucket 的路徑規則：<帳本 id>/<交易 id>/<檔名> */

export const RECEIPT_BUCKET = 'receipts';

/** 組出照片路徑（第一層資料夾必須是帳本 id，storage policy 靠它判斷權限） */
export function receiptPath(ledgerId: string, transactionId: string, fileId: string): string {
  return `${ledgerId}/${transactionId}/${fileId}.jpg`;
}

/** Storage `list` 回傳的項目（資料夾的 id 為 null） */
export type StorageListEntry = { name: string; id: string | null };

/**
 * 把某個資料夾的 list 結果拆成「底下的檔案完整路徑」與「子資料夾名稱」。
 * Storage 的 list 不會遞迴，所以要自己一層一層往下列。
 */
export function splitListing(
  prefix: string,
  entries: StorageListEntry[],
): { files: string[]; folders: string[] } {
  const files: string[] = [];
  const folders: string[] = [];
  for (const entry of entries) {
    if (!entry.name || entry.name === '.emptyFolderPlaceholder') {
      continue;
    }
    if (entry.id === null) {
      folders.push(entry.name);
    } else {
      files.push(`${prefix}/${entry.name}`);
    }
  }
  return { files, folders };
}

/** 把陣列切成固定大小的批次（Storage 一次刪除的數量有限） */
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
