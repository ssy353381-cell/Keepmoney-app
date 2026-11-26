import type { Tables } from '@/types/database';
import { isValidDateString, toDateString } from '@/lib/date';
import { MAX_AMOUNT } from '@/lib/money';

/** 備份檔的格式識別與版本；格式有不相容的變動時才加大版本 */
export const BACKUP_FORMAT = 'keepmoney-backup';
export const BACKUP_VERSION = 1;

export type BackupData = {
  ledger: Pick<Tables<'ledgers'>, 'id' | 'name' | 'currency'>;
  accounts: Tables<'accounts'>[];
  categories: Tables<'categories'>[];
  tags: Tables<'tags'>[];
  transactions: Tables<'transactions'>[];
  transaction_tags: Tables<'transaction_tags'>[];
  budgets: Tables<'budgets'>[];
  recurring_transactions: Tables<'recurring_transactions'>[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: 'KeepMoney';
} & BackupData;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 當地時間 YYYY-MM-DDTHH:mm:ss（不用 toISOString，那是 UTC） */
function localDateTime(date: Date): string {
  return `${toDateString(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 組出備份檔內容（陣列是複製的，之後改動來源不會影響備份） */
export function buildBackup(data: BackupData, exportedAt: Date): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: localDateTime(exportedAt),
    app: 'KeepMoney',
    ledger: { id: data.ledger.id, name: data.ledger.name, currency: data.ledger.currency },
    accounts: [...data.accounts],
    categories: [...data.categories],
    tags: [...data.tags],
    transactions: [...data.transactions],
    transaction_tags: [...data.transaction_tags],
    budgets: [...data.budgets],
    recurring_transactions: [...data.recurring_transactions],
  };
}

/** 檔名：KeepMoney-我的帳本-2026-11-26.json；去掉各平台檔名不允許的字元 */
export function backupFileName(ledgerName: string, date: string, ext: 'json' | 'csv'): string {
  const cleaned = ledgerName
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .trim()
    .replace(/^\.+/, '');
  return `KeepMoney-${cleaned || '帳本'}-${date}.${ext}`;
}

// ---------------------------------------------------------------------------
// 驗證
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const INVOICE_PATTERN = /^[A-Z]{2}[0-9]{8}$/;

const ACCOUNT_TYPES = ['cash', 'bank', 'credit_card', 'e_wallet', 'investment', 'other'];
const CATEGORY_KINDS = ['expense', 'income'];
const TRANSACTION_TYPES = ['expense', 'income', 'transfer'];
const TRANSACTION_SOURCES = ['app', 'quick', 'shortcut', 'invoice_qr', 'import'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 一個欄位的檢查結果；tooLong 有值代表「字數超過上限」，訊息會特別說明 */
type Check = { field: string; ok: boolean; maxLength?: number };

const isUuid = (v: unknown): boolean => typeof v === 'string' && UUID_PATTERN.test(v);
const isOptional = (v: unknown, test: (value: unknown) => boolean): boolean =>
  v === undefined || v === null || test(v);
const isNumber = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
const isBoolean = (v: unknown): boolean => typeof v === 'boolean';
const isDate = (v: unknown): boolean => typeof v === 'string' && isValidDateString(v);
const isOneOf = (v: unknown, list: string[]): boolean => typeof v === 'string' && list.includes(v);

/** 金額：大於 0、不超過資料庫上限、最多兩位小數 */
function isAmount(v: unknown): boolean {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > MAX_AMOUNT) {
    return false;
  }
  return Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
}

function textCheck(field: string, v: unknown, min: number, max: number): Check {
  const ok = typeof v === 'string' && v.length >= min && v.length <= max;
  return { field, ok, maxLength: typeof v === 'string' && v.length > max ? max : undefined };
}

function optionalTextCheck(field: string, v: unknown, max: number): Check {
  if (v === undefined || v === null) {
    return { field, ok: true };
  }
  return textCheck(field, v, 0, max);
}

function checkMessage(label: string, index: number, checks: Check[]): string | null {
  const bad = checks.find((c) => !c.ok);
  if (!bad) {
    return null;
  }
  if (bad.maxLength !== undefined) {
    return `第 ${index + 1} 筆${label}的${bad.field}太長（最多 ${bad.maxLength} 個字）`;
  }
  return `第 ${index + 1} 筆${label}的${bad.field}不正確`;
}

type EntityRule = { key: string; label: string; checks: (item: Obj) => Check[] };

const ENTITY_RULES: EntityRule[] = [
  {
    key: 'accounts',
    label: '帳戶',
    checks: (a) => [
      { field: 'id', ok: isUuid(a.id) },
      textCheck('名稱', a.name, 1, 50),
      { field: '類型', ok: isOneOf(a.type, ACCOUNT_TYPES) },
      { field: '期初餘額', ok: isNumber(a.initial_balance) },
      { field: '封存狀態', ok: isOptional(a.is_archived, isBoolean) },
      { field: '排序', ok: isOptional(a.sort_order, isNumber) },
    ],
  },
  {
    key: 'categories',
    label: '分類',
    checks: (c) => [
      { field: 'id', ok: isUuid(c.id) },
      { field: '類型', ok: isOneOf(c.kind, CATEGORY_KINDS) },
      { field: '上層分類', ok: isOptional(c.parent_id, isUuid) },
      textCheck('名稱', c.name, 1, 30),
      optionalTextCheck('圖示', c.icon, 16),
      {
        field: '顏色',
        ok: isOptional(c.color, (v) => typeof v === 'string' && COLOR_PATTERN.test(v)),
      },
      { field: '封存狀態', ok: isOptional(c.is_archived, isBoolean) },
      { field: '排序', ok: isOptional(c.sort_order, isNumber) },
    ],
  },
  {
    key: 'tags',
    label: '標籤',
    checks: (t) => [
      { field: 'id', ok: isUuid(t.id) },
      textCheck('名稱', t.name, 1, 30),
      {
        field: '顏色',
        ok: isOptional(t.color, (v) => typeof v === 'string' && COLOR_PATTERN.test(v)),
      },
    ],
  },
  {
    key: 'transactions',
    label: '交易',
    checks: (t) => [
      { field: 'id', ok: isUuid(t.id) },
      { field: '類型', ok: isOneOf(t.type, TRANSACTION_TYPES) },
      { field: '金額', ok: isAmount(t.amount) },
      { field: '日期', ok: isDate(t.occurred_on) },
      { field: '帳戶', ok: isUuid(t.account_id) },
      { field: '轉入帳戶', ok: isOptional(t.to_account_id, isUuid) },
      { field: '分類', ok: isOptional(t.category_id, isUuid) },
      { field: '定期收支', ok: isOptional(t.recurring_id, isUuid) },
      optionalTextCheck('備註', t.note, 200),
      {
        field: '發票號碼',
        ok: isOptional(t.invoice_number, (v) => typeof v === 'string' && INVOICE_PATTERN.test(v)),
      },
      { field: '待確認狀態', ok: isOptional(t.needs_review, isBoolean) },
      { field: '來源', ok: t.source === undefined || isOneOf(t.source, TRANSACTION_SOURCES) },
    ],
  },
  {
    key: 'transaction_tags',
    label: '交易標籤',
    checks: (t) => [
      { field: '交易', ok: isUuid(t.transaction_id) },
      { field: '標籤', ok: isUuid(t.tag_id) },
    ],
  },
  {
    key: 'budgets',
    label: '預算',
    checks: (b) => [
      { field: 'id', ok: isUuid(b.id) },
      { field: '分類', ok: isOptional(b.category_id, isUuid) },
      { field: '金額', ok: isAmount(b.amount) },
    ],
  },
  {
    key: 'recurring_transactions',
    label: '定期收支',
    checks: (r) => [
      { field: 'id', ok: isUuid(r.id) },
      { field: '類型', ok: isOneOf(r.type, TRANSACTION_TYPES) },
      { field: '金額', ok: isAmount(r.amount) },
      { field: '帳戶', ok: isUuid(r.account_id) },
      { field: '轉入帳戶', ok: isOptional(r.to_account_id, isUuid) },
      { field: '分類', ok: isOptional(r.category_id, isUuid) },
      optionalTextCheck('備註', r.note, 200),
      { field: '頻率', ok: isOneOf(r.frequency, FREQUENCIES) },
      {
        field: '間隔',
        ok:
          typeof r.interval_count === 'number' &&
          Number.isInteger(r.interval_count) &&
          r.interval_count >= 1 &&
          r.interval_count <= 365,
      },
      {
        field: '日期',
        ok:
          isDate(r.start_on) &&
          isDate(r.next_occurs_on) &&
          isOptional(r.end_on, isDate) &&
          (r.next_occurs_on as string) >= (r.start_on as string) &&
          (r.end_on === undefined || r.end_on === null || r.end_on >= (r.start_on as string)),
      },
      { field: '啟用狀態', ok: isOptional(r.is_active, isBoolean) },
    ],
  },
];

/**
 * 驗證使用者選的備份檔（JSON.parse 之後的內容）。
 * 檔案內容完全不可信：型別、長度、日期、金額都要檢查，避免之後寫入資料庫時整筆交易失敗。
 * 通過時回傳原物件（型別斷言為 BackupFile），沒有補預設值，planRestore 會自行處理缺漏的選填欄位。
 */
export function validateBackup(
  json: unknown,
): { ok: true; backup: BackupFile } | { ok: false; message: string } {
  const fail = (message: string) => ({ ok: false as const, message });

  if (!isObject(json)) {
    return fail('這不是 KeepMoney 的備份檔');
  }
  if (json.format !== BACKUP_FORMAT) {
    return fail('這不是 KeepMoney 的備份檔');
  }
  if (typeof json.version !== 'number' || !Number.isInteger(json.version) || json.version < 1) {
    return fail('備份檔的版本不正確');
  }
  if (json.version > BACKUP_VERSION) {
    return fail('這個備份是新版 App 產生的，請先更新 App');
  }

  const ledger = json.ledger;
  if (
    !isObject(ledger) ||
    !isUuid(ledger.id) ||
    typeof ledger.name !== 'string' ||
    ledger.name.length < 1 ||
    ledger.name.length > 50 ||
    typeof ledger.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(ledger.currency)
  ) {
    return fail('備份檔的帳本資料不正確');
  }

  for (const rule of ENTITY_RULES) {
    const list = json[rule.key];
    if (!Array.isArray(list)) {
      return fail(`備份檔缺少${rule.label}資料`);
    }
    const seen = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      const item: unknown = list[i];
      if (!isObject(item)) {
        return fail(`第 ${i + 1} 筆${rule.label}不正確`);
      }
      const message = checkMessage(rule.label, i, rule.checks(item));
      if (message) {
        return fail(message);
      }
      // 交易標籤沒有自己的 id，用（交易，標籤）組合判斷重複
      const identity =
        rule.key === 'transaction_tags'
          ? `${String(item.transaction_id)}|${String(item.tag_id)}`
          : String(item.id);
      if (seen.has(identity)) {
        return fail(`第 ${i + 1} 筆${rule.label}重複了`);
      }
      seen.add(identity);
    }
  }

  return { ok: true, backup: json as unknown as BackupFile };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const CSV_BOM = '﻿';
const TYPE_LABELS: Record<Tables<'transactions'>['type'], string> = {
  expense: '支出',
  income: '收入',
  transfer: '轉帳',
};

/**
 * 一個 CSV 欄位。
 * 文字欄位開頭是 = + - @（或 Tab）時前面補 '，避免 Excel 把它當公式執行（CSV 公式注入）；
 * 金額這類數字欄位不處理。含逗號、雙引號、換行就用雙引號包起來。
 */
function csvCell(value: string, isText: boolean): string {
  const text = isText && /^[=+\-@\t]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function compareTransactions(a: Tables<'transactions'>, b: Tables<'transactions'>): number {
  if (a.occurred_on !== b.occurred_on) {
    return a.occurred_on < b.occurred_on ? -1 : 1;
  }
  const timeA = Date.parse(a.created_at);
  const timeB = Date.parse(b.created_at);
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : 1;
  }
  return 0;
}

/** 交易明細轉 CSV（給 Excel 看，不能還原）：BOM 開頭、\r\n 換行、日期與建立時間由舊到新 */
export function transactionsToCsv(input: {
  transactions: Tables<'transactions'>[];
  categories: Tables<'categories'>[];
  accounts: Tables<'accounts'>[];
  tags: Tables<'tags'>[];
  transactionTags: Tables<'transaction_tags'>[];
}): string {
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const accountName = new Map(input.accounts.map((a) => [a.id, a.name]));
  const tagName = new Map(input.tags.map((t) => [t.id, t.name]));

  const tagsOfTransaction = new Map<string, string[]>();
  for (const link of input.transactionTags) {
    const name = tagName.get(link.tag_id);
    if (name === undefined) {
      continue;
    }
    const names = tagsOfTransaction.get(link.transaction_id) ?? [];
    names.push(name);
    tagsOfTransaction.set(link.transaction_id, names);
  }

  const header = [
    '日期',
    '類型',
    '金額',
    '分類',
    '子分類',
    '帳戶',
    '轉入帳戶',
    '備註',
    '標籤',
    '發票號碼',
    '待確認',
  ];
  const lines = [header.map((h) => csvCell(h, false)).join(',')];

  const sorted = [...input.transactions].sort(compareTransactions);
  for (const t of sorted) {
    const category = t.category_id ? categoryById.get(t.category_id) : undefined;
    const parent = category?.parent_id ? categoryById.get(category.parent_id) : undefined;
    // 有上層就「分類」放上層、「子分類」放自己；沒有上層則只填「分類」
    const categoryName = parent ? parent.name : (category?.name ?? '');
    const subCategoryName = parent && category ? category.name : '';
    const tagText = [...(tagsOfTransaction.get(t.id) ?? [])].sort().join('、');

    const cells: [string, boolean][] = [
      [t.occurred_on, false],
      [TYPE_LABELS[t.type], false],
      [String(t.amount), false],
      [categoryName, true],
      [subCategoryName, true],
      [accountName.get(t.account_id) ?? '', true],
      [t.to_account_id ? (accountName.get(t.to_account_id) ?? '') : '', true],
      [t.note ?? '', true],
      [tagText, true],
      [t.invoice_number ?? '', true],
      [t.needs_review ? '是' : '', false],
    ];
    lines.push(cells.map(([value, isText]) => csvCell(value, isText)).join(','));
  }

  return CSV_BOM + lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// 還原計畫
// ---------------------------------------------------------------------------

/** 以下各型別是「要 insert 的欄位」：不含 generated 欄位、created_by、updated_at */
export type AccountInsert = Pick<
  Tables<'accounts'>,
  | 'id'
  | 'ledger_id'
  | 'name'
  | 'type'
  | 'initial_balance'
  | 'is_archived'
  | 'sort_order'
  | 'created_at'
>;

export type CategoryInsert = Pick<
  Tables<'categories'>,
  | 'id'
  | 'ledger_id'
  | 'kind'
  | 'parent_id'
  | 'name'
  | 'icon'
  | 'color'
  | 'sort_order'
  | 'is_archived'
  | 'created_at'
>;

export type TagInsert = Pick<Tables<'tags'>, 'id' | 'ledger_id' | 'name' | 'color' | 'created_at'>;

export type TransactionInsert = Pick<
  Tables<'transactions'>,
  | 'id'
  | 'ledger_id'
  | 'type'
  | 'amount'
  | 'occurred_on'
  | 'account_id'
  | 'to_account_id'
  | 'category_id'
  | 'note'
  | 'recurring_id'
  | 'invoice_number'
  | 'needs_review'
  | 'source'
  | 'created_at'
> & {
  /** 照片不在備份裡，一律 null */
  receipt_path: null;
};

export type TransactionTagInsert = Pick<
  Tables<'transaction_tags'>,
  'ledger_id' | 'transaction_id' | 'tag_id'
>;

export type BudgetInsert = Pick<
  Tables<'budgets'>,
  'id' | 'ledger_id' | 'category_id' | 'category_kind' | 'amount' | 'created_at'
>;

export type RecurringInsert = Pick<
  Tables<'recurring_transactions'>,
  | 'id'
  | 'ledger_id'
  | 'type'
  | 'amount'
  | 'account_id'
  | 'to_account_id'
  | 'category_id'
  | 'note'
  | 'frequency'
  | 'interval_count'
  | 'start_on'
  | 'end_on'
  | 'next_occurs_on'
  | 'is_active'
  | 'created_at'
>;

export type RestorePlan = {
  accounts: AccountInsert[];
  categories: CategoryInsert[];
  tags: TagInsert[];
  transactions: TransactionInsert[];
  transaction_tags: TransactionTagInsert[];
  budgets: BudgetInsert[];
  recurring_transactions: RecurringInsert[];
  summary: {
    accounts: number;
    categories: number;
    tags: number;
    transactions: number;
    budgets: number;
    recurring: number;
    reusedAccounts: number;
    reusedCategories: number;
    reusedTags: number;
  };
};

/** 檔案裡的選填欄位可能整個不存在，統一轉成 null */
function orNull<T>(value: T | null | undefined): T | null {
  return value === undefined ? null : value;
}

type RefsInput = {
  type: Tables<'transactions'>['type'];
  account_id: string;
  to_account_id: string | null | undefined;
  category_id: string | null | undefined;
};

/**
 * 把交易或定期收支的帳戶、分類參照換成對應後的 id。
 * 找不到對應、或不符合資料庫的形狀限制（轉帳要有不同的轉入帳戶且沒有分類；
 * 收支要有同類型的分類且沒有轉入帳戶）就回傳 null，呼叫端略過該筆。
 */
function mapRefs(
  item: RefsInput,
  accountMap: Map<string, string>,
  categoryMap: Map<string, string | null>,
  categoryKindById: Map<string, string>,
): { account_id: string; to_account_id: string | null; category_id: string | null } | null {
  const accountId = accountMap.get(item.account_id);
  if (accountId === undefined) {
    return null;
  }
  const toAccountRaw = orNull(item.to_account_id);
  const categoryRaw = orNull(item.category_id);

  if (item.type === 'transfer') {
    if (categoryRaw !== null || toAccountRaw === null) {
      return null;
    }
    const toAccountId = accountMap.get(toAccountRaw);
    if (toAccountId === undefined || toAccountId === accountId) {
      return null;
    }
    return { account_id: accountId, to_account_id: toAccountId, category_id: null };
  }

  if (toAccountRaw !== null || categoryRaw === null) {
    return null;
  }
  const categoryId = categoryMap.get(categoryRaw);
  if (categoryId === undefined || categoryId === null) {
    return null;
  }
  if (categoryKindById.get(categoryRaw) !== item.type) {
    return null;
  }
  return { account_id: accountId, to_account_id: null, category_id: categoryId };
}

/**
 * 把備份攤平成「要寫進目前帳本的資料」。純函式，不碰資料庫；寫入由資料庫函式在單一交易內完成。
 *
 * - 同一本帳本：保留所有原本的 id，資料庫用 on conflict do nothing 補回不見的資料。
 * - 不同帳本：帳戶／分類／標籤盡量沿用目前帳本已有的（沿用的不會出現在輸出陣列），
 *   其餘與交易、預算、定期收支一律換新 id，所有參照一併換成對應後的 id。
 * - 對應不到的參照 → 該筆略過（交易的 recurring_id 對不到只會清成 null，交易本身保留）。
 */
export function planRestore(
  backup: BackupFile,
  current: {
    ledgerId: string;
    accounts: Tables<'accounts'>[];
    categories: Tables<'categories'>[];
    tags: Tables<'tags'>[];
  },
  newId: () => string,
): RestorePlan {
  const sameLedger = backup.ledger.id === current.ledgerId;
  const ledgerId = current.ledgerId;
  const idFor = (original: string) => (sameLedger ? original : newId());

  // 帳戶：名稱＋類型相同就沿用
  const currentAccounts = new Map<string, string>();
  for (const a of current.accounts) {
    const key = JSON.stringify([a.type, a.name]);
    if (!currentAccounts.has(key)) {
      currentAccounts.set(key, a.id);
    }
  }
  const accountMap = new Map<string, string>();
  const accounts: AccountInsert[] = [];
  let reusedAccounts = 0;
  for (const a of backup.accounts) {
    const existing = sameLedger ? undefined : currentAccounts.get(JSON.stringify([a.type, a.name]));
    if (existing !== undefined) {
      accountMap.set(a.id, existing);
      reusedAccounts++;
      continue;
    }
    const id = idFor(a.id);
    accountMap.set(a.id, id);
    accounts.push({
      id,
      ledger_id: ledgerId,
      name: a.name,
      type: a.type,
      initial_balance: a.initial_balance,
      is_archived: a.is_archived ?? false,
      sort_order: a.sort_order ?? 0,
      created_at: a.created_at,
    });
  }

  // 分類：(kind, 對應後的 parent, 名稱) 相同就沿用；遞迴處理，保證上層先於子分類
  const currentCategories = new Map<string, string>();
  for (const c of current.categories) {
    const key = JSON.stringify([c.kind, c.parent_id, c.name]);
    if (!currentCategories.has(key)) {
      currentCategories.set(key, c.id);
    }
  }
  const backupCategories = new Map(backup.categories.map((c) => [c.id, c]));
  const categoryKindById = new Map(backup.categories.map((c) => [c.id, c.kind as string]));
  const categoryMap = new Map<string, string | null>(); // null = 略過這個分類
  const resolving = new Set<string>();
  const categories: CategoryInsert[] = [];
  let reusedCategories = 0;

  const resolveCategory = (category: Tables<'categories'>): string | null => {
    const known = categoryMap.get(category.id);
    if (known !== undefined) {
      return known;
    }
    if (resolving.has(category.id)) {
      return null; // 循環參照
    }
    resolving.add(category.id);

    let result: string | null = null;
    let parentId: string | null = null;
    let usable = true;
    const parentRaw = orNull(category.parent_id);
    if (parentRaw !== null) {
      const parent = backupCategories.get(parentRaw);
      parentId = parent && parent.kind === category.kind ? resolveCategory(parent) : null;
      usable = parentId !== null;
    }

    if (usable) {
      const existing = sameLedger
        ? undefined
        : currentCategories.get(JSON.stringify([category.kind, parentId, category.name]));
      if (existing !== undefined) {
        result = existing;
        reusedCategories++;
      } else {
        result = idFor(category.id);
        categories.push({
          id: result,
          ledger_id: ledgerId,
          kind: category.kind,
          parent_id: parentId,
          name: category.name,
          icon: orNull(category.icon),
          color: orNull(category.color),
          sort_order: category.sort_order ?? 0,
          is_archived: category.is_archived ?? false,
          created_at: category.created_at,
        });
      }
    }

    resolving.delete(category.id);
    categoryMap.set(category.id, result);
    return result;
  };
  for (const c of backup.categories) {
    resolveCategory(c);
  }

  // 標籤：名稱相同（不分大小寫）就沿用
  const currentTags = new Map<string, string>();
  for (const t of current.tags) {
    const key = t.name.toLowerCase();
    if (!currentTags.has(key)) {
      currentTags.set(key, t.id);
    }
  }
  const tagMap = new Map<string, string>();
  const tags: TagInsert[] = [];
  let reusedTags = 0;
  for (const t of backup.tags) {
    const existing = sameLedger ? undefined : currentTags.get(t.name.toLowerCase());
    if (existing !== undefined) {
      tagMap.set(t.id, existing);
      reusedTags++;
      continue;
    }
    const id = idFor(t.id);
    tagMap.set(t.id, id);
    tags.push({
      id,
      ledger_id: ledgerId,
      name: t.name,
      color: orNull(t.color),
      created_at: t.created_at,
    });
  }

  // 定期收支（交易會參照它，所以先處理）
  const recurringMap = new Map<string, string>();
  const recurring: RecurringInsert[] = [];
  for (const r of backup.recurring_transactions) {
    const refs = mapRefs(r, accountMap, categoryMap, categoryKindById);
    if (!refs) {
      continue;
    }
    const id = idFor(r.id);
    recurringMap.set(r.id, id);
    recurring.push({
      id,
      ledger_id: ledgerId,
      type: r.type,
      amount: r.amount,
      ...refs,
      note: orNull(r.note),
      frequency: r.frequency,
      interval_count: r.interval_count,
      start_on: r.start_on,
      end_on: orNull(r.end_on),
      next_occurs_on: r.next_occurs_on,
      is_active: r.is_active ?? true,
      created_at: r.created_at,
    });
  }

  // 交易
  const transactionMap = new Map<string, string>();
  const transactions: TransactionInsert[] = [];
  for (const t of backup.transactions) {
    const refs = mapRefs(t, accountMap, categoryMap, categoryKindById);
    if (!refs) {
      continue;
    }
    const id = idFor(t.id);
    transactionMap.set(t.id, id);
    const recurringRaw = orNull(t.recurring_id);
    transactions.push({
      id,
      ledger_id: ledgerId,
      type: t.type,
      amount: t.amount,
      occurred_on: t.occurred_on,
      ...refs,
      note: orNull(t.note),
      recurring_id: recurringRaw === null ? null : (recurringMap.get(recurringRaw) ?? null),
      invoice_number: orNull(t.invoice_number),
      receipt_path: null,
      needs_review: t.needs_review ?? false,
      source: t.source ?? 'app',
      created_at: t.created_at,
    });
  }

  // 交易標籤：兩端都對得到才保留；標籤被合併時可能出現重複，要去重
  const transactionTags: TransactionTagInsert[] = [];
  const seenLinks = new Set<string>();
  for (const link of backup.transaction_tags) {
    const transactionId = transactionMap.get(link.transaction_id);
    const tagId = tagMap.get(link.tag_id);
    if (transactionId === undefined || tagId === undefined) {
      continue;
    }
    const key = `${transactionId}|${tagId}`;
    if (seenLinks.has(key)) {
      continue;
    }
    seenLinks.add(key);
    transactionTags.push({ ledger_id: ledgerId, transaction_id: transactionId, tag_id: tagId });
  }

  // 預算：category_id 為 null 是總預算，照留
  const budgets: BudgetInsert[] = [];
  for (const b of backup.budgets) {
    const categoryRaw = orNull(b.category_id);
    let categoryId: string | null = null;
    if (categoryRaw !== null) {
      const mapped = categoryMap.get(categoryRaw);
      if (
        mapped === undefined ||
        mapped === null ||
        categoryKindById.get(categoryRaw) !== 'expense'
      ) {
        continue;
      }
      categoryId = mapped;
    }
    budgets.push({
      id: idFor(b.id),
      ledger_id: ledgerId,
      category_id: categoryId,
      category_kind: 'expense',
      amount: b.amount,
      created_at: b.created_at,
    });
  }

  return {
    accounts,
    categories,
    tags,
    transactions,
    transaction_tags: transactionTags,
    budgets,
    recurring_transactions: recurring,
    summary: {
      accounts: accounts.length,
      categories: categories.length,
      tags: tags.length,
      transactions: transactions.length,
      budgets: budgets.length,
      recurring: recurring.length,
      reusedAccounts,
      reusedCategories,
      reusedTags,
    },
  };
}
