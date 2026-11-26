import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  buildBackup,
  planRestore,
  transactionsToCsv,
  validateBackup,
  type BackupData,
  type BackupFile,
} from '@/lib/backup';
import type { Tables } from '@/types/database';

// ---- 測試資料 ----

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

const LEDGER = uuid(1);
const OTHER_LEDGER = uuid(2);
const CREATED = '2026-11-01T08:00:00+00:00';

const ACC_CASH = uuid(10);
const ACC_BANK = uuid(11);
const CAT_FOOD = uuid(20);
const CAT_LUNCH = uuid(21); // 飲食的子分類
const CAT_SALARY = uuid(22);
const TAG_TRIP = uuid(30);
const TAG_WORK = uuid(31);
const REC_RENT = uuid(40);

function account(over: Partial<Tables<'accounts'>> = {}): Tables<'accounts'> {
  return {
    id: ACC_CASH,
    ledger_id: LEDGER,
    name: '現金',
    type: 'cash',
    initial_balance: 100,
    is_archived: false,
    sort_order: 0,
    created_at: CREATED,
    updated_at: CREATED,
    ...over,
  };
}

function category(over: Partial<Tables<'categories'>> = {}): Tables<'categories'> {
  return {
    id: CAT_FOOD,
    ledger_id: LEDGER,
    kind: 'expense',
    parent_id: null,
    name: '飲食',
    icon: '🍱',
    color: '#FF8800',
    sort_order: 1,
    is_archived: false,
    created_at: CREATED,
    updated_at: CREATED,
    ...over,
  };
}

function tag(over: Partial<Tables<'tags'>> = {}): Tables<'tags'> {
  return {
    id: TAG_TRIP,
    ledger_id: LEDGER,
    name: '旅行',
    color: null,
    created_at: CREATED,
    ...over,
  };
}

function tx(over: Partial<Tables<'transactions'>> = {}): Tables<'transactions'> {
  return {
    id: uuid(100),
    ledger_id: LEDGER,
    type: 'expense',
    amount: 120,
    occurred_on: '2026-11-10',
    account_id: ACC_CASH,
    to_account_id: null,
    category_id: CAT_FOOD,
    category_kind: 'expense',
    note: '午餐',
    recurring_id: null,
    created_by: uuid(900),
    created_at: CREATED,
    updated_at: CREATED,
    needs_review: false,
    source: 'app',
    invoice_number: null,
    receipt_path: null,
    ...over,
  };
}

function recurring(
  over: Partial<Tables<'recurring_transactions'>> = {},
): Tables<'recurring_transactions'> {
  return {
    id: REC_RENT,
    ledger_id: LEDGER,
    type: 'expense',
    amount: 15000,
    account_id: ACC_BANK,
    to_account_id: null,
    category_id: CAT_FOOD,
    category_kind: 'expense',
    note: '房租',
    frequency: 'monthly',
    interval_count: 1,
    start_on: '2026-01-05',
    end_on: null,
    next_occurs_on: '2026-12-05',
    is_active: true,
    created_by: uuid(900),
    created_at: CREATED,
    updated_at: CREATED,
    ...over,
  };
}

function sampleData(over: Partial<BackupData> = {}): BackupData {
  return {
    ledger: { id: LEDGER, name: '我的帳本', currency: 'TWD' },
    accounts: [account(), account({ id: ACC_BANK, name: '薪轉戶', type: 'bank' })],
    categories: [
      category(),
      category({ id: CAT_LUNCH, parent_id: CAT_FOOD, name: '午餐', icon: null, color: null }),
      category({ id: CAT_SALARY, kind: 'income', name: '薪資' }),
    ],
    tags: [tag(), tag({ id: TAG_WORK, name: '公司' })],
    transactions: [
      tx({ id: uuid(100), category_id: CAT_LUNCH, source: 'shortcut', needs_review: true }),
      tx({
        id: uuid(101),
        type: 'income',
        amount: 50000,
        category_id: CAT_SALARY,
        category_kind: 'income',
        account_id: ACC_BANK,
        note: null,
        invoice_number: 'AB12345678',
        receipt_path: `${LEDGER}/r.jpg`,
        recurring_id: REC_RENT,
      }),
      tx({
        id: uuid(102),
        type: 'transfer',
        category_id: null,
        category_kind: null,
        account_id: ACC_BANK,
        to_account_id: ACC_CASH,
        amount: 1000,
      }),
    ],
    transaction_tags: [
      { ledger_id: LEDGER, transaction_id: uuid(100), tag_id: TAG_TRIP },
      { ledger_id: LEDGER, transaction_id: uuid(100), tag_id: TAG_WORK },
    ],
    budgets: [
      {
        id: uuid(50),
        ledger_id: LEDGER,
        category_id: null,
        category_kind: 'expense',
        amount: 30000,
        created_at: CREATED,
        updated_at: CREATED,
      },
      {
        id: uuid(51),
        ledger_id: LEDGER,
        category_id: CAT_FOOD,
        category_kind: 'expense',
        amount: 8000,
        created_at: CREATED,
        updated_at: CREATED,
      },
    ],
    recurring_transactions: [recurring()],
    ...over,
  };
}

function sampleBackup(over: Partial<BackupData> = {}): BackupFile {
  return buildBackup(sampleData(over), new Date(2026, 10, 26, 9, 5, 7));
}

/** 從 JSON 讀回來的樣子（深拷貝、型別放寬），方便塞壞資料 */
function asJson(backup: BackupFile = sampleBackup()): Record<string, any> {
  return JSON.parse(JSON.stringify(backup));
}

function counter(prefix = 'new') {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

type Current = Parameters<typeof planRestore>[1];

const EMPTY_CURRENT: Current = { ledgerId: OTHER_LEDGER, accounts: [], categories: [], tags: [] };

// ---- buildBackup ----

describe('buildBackup', () => {
  it('帶上格式、版本、App 名稱與全部資料', () => {
    const data = sampleData();
    const backup = buildBackup(data, new Date(2026, 10, 26, 9, 5, 7));
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.app).toBe('KeepMoney');
    expect(backup.ledger).toEqual({ id: LEDGER, name: '我的帳本', currency: 'TWD' });
    expect(backup.accounts).toEqual(data.accounts);
    expect(backup.categories).toEqual(data.categories);
    expect(backup.tags).toEqual(data.tags);
    expect(backup.transactions).toEqual(data.transactions);
    expect(backup.transaction_tags).toEqual(data.transaction_tags);
    expect(backup.budgets).toEqual(data.budgets);
    expect(backup.recurring_transactions).toEqual(data.recurring_transactions);
  });

  it('exportedAt 是當地時間，不做 UTC 轉換', () => {
    const backup = buildBackup(sampleData(), new Date(2026, 0, 2, 3, 4, 5));
    expect(backup.exportedAt).toBe('2026-01-02T03:04:05');
  });

  it('ledger 只保留 id、name、currency', () => {
    const data = sampleData();
    const withExtra = {
      ...data,
      ledger: { ...data.ledger, created_by: 'someone', updated_at: CREATED },
    } as BackupData;
    expect(Object.keys(buildBackup(withExtra, new Date()).ledger).sort()).toEqual([
      'currency',
      'id',
      'name',
    ]);
  });

  it('複製陣列，之後改來源不影響備份', () => {
    const data = sampleData();
    const backup = buildBackup(data, new Date());
    data.transactions.push(tx({ id: uuid(999) }));
    expect(backup.transactions).toHaveLength(3);
  });

  it('可以 JSON 序列化再通過驗證', () => {
    const result = validateBackup(JSON.parse(JSON.stringify(sampleBackup())));
    expect(result.ok).toBe(true);
  });
});

// ---- backupFileName ----

describe('backupFileName', () => {
  it('組成 KeepMoney-帳本名稱-日期.副檔名', () => {
    expect(backupFileName('我的帳本', '2026-11-26', 'json')).toBe(
      'KeepMoney-我的帳本-2026-11-26.json',
    );
    expect(backupFileName('我的帳本', '2026-11-26', 'csv')).toBe(
      'KeepMoney-我的帳本-2026-11-26.csv',
    );
  });

  it('去掉檔名不合法的字元', () => {
    expect(backupFileName('a\\b/c:d*e?f"g<h>i|j', '2026-11-26', 'json')).toBe(
      'KeepMoney-abcdefghij-2026-11-26.json',
    );
  });

  it('名稱清完是空的就用「帳本」', () => {
    expect(backupFileName('  /*? ', '2026-11-26', 'json')).toBe('KeepMoney-帳本-2026-11-26.json');
  });

  it('開頭的點會去掉，避免變成隱藏檔', () => {
    expect(backupFileName('..家計', '2026-11-26', 'json')).toBe('KeepMoney-家計-2026-11-26.json');
  });
});

// ---- validateBackup ----

describe('validateBackup', () => {
  function expectFail(json: unknown, message: string | RegExp) {
    const result = validateBackup(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      if (typeof message === 'string') {
        expect(result.message).toBe(message);
      } else {
        expect(result.message).toMatch(message);
      }
    }
  }

  it('合法的備份通過，回傳原內容', () => {
    const json = asJson();
    const result = validateBackup(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.transactions).toHaveLength(3);
    }
  });

  it.each([null, undefined, 'text', 42, [], true])('不是物件（%p）', (value) => {
    expectFail(value, '這不是 KeepMoney 的備份檔');
  });

  it('format 不對', () => {
    expectFail({ ...asJson(), format: 'other' }, '這不是 KeepMoney 的備份檔');
  });

  it('版本比目前新', () => {
    expectFail(
      { ...asJson(), version: BACKUP_VERSION + 1 },
      '這個備份是新版 App 產生的，請先更新 App',
    );
  });

  it.each(['1', null, 0, 1.5, NaN])('版本不是正整數（%p）', (version) => {
    expectFail({ ...asJson(), version }, '備份檔的版本不正確');
  });

  it('缺少陣列', () => {
    const json = asJson();
    delete json.transactions;
    expectFail(json, '備份檔缺少交易資料');
  });

  it('陣列欄位不是陣列', () => {
    expectFail({ ...asJson(), tags: {} }, '備份檔缺少標籤資料');
  });

  it('帳本資料不正確', () => {
    expectFail(
      { ...asJson(), ledger: { id: LEDGER, name: '', currency: 'TWD' } },
      '備份檔的帳本資料不正確',
    );
    expectFail({ ...asJson(), ledger: null }, '備份檔的帳本資料不正確');
  });

  it('交易金額不正確', () => {
    const json = asJson();
    json.transactions[2].amount = 0;
    expectFail(json, '第 3 筆交易的金額不正確');
  });

  it.each([-5, '100', null, NaN, 1.234, 1_000_000_000_000])('交易金額不合法（%p）', (amount) => {
    const json = asJson();
    json.transactions[0].amount = amount;
    expectFail(json, '第 1 筆交易的金額不正確');
  });

  it.each(['2026-02-30', '2026/11/10', '20261110', 20261110])('交易日期不合法（%p）', (date) => {
    const json = asJson();
    json.transactions[1].occurred_on = date;
    expectFail(json, '第 2 筆交易的日期不正確');
  });

  it('交易類型不合法', () => {
    const json = asJson();
    json.transactions[0].type = 'refund';
    expectFail(json, '第 1 筆交易的類型不正確');
  });

  it('交易缺少帳戶', () => {
    const json = asJson();
    delete json.transactions[0].account_id;
    expectFail(json, '第 1 筆交易的帳戶不正確');
  });

  it('交易 id 不是 uuid', () => {
    const json = asJson();
    json.transactions[0].id = 'abc';
    expectFail(json, '第 1 筆交易的id不正確');
  });

  it('備註超過 200 字', () => {
    const json = asJson();
    json.transactions[0].note = 'a'.repeat(201);
    expectFail(json, '第 1 筆交易的備註太長（最多 200 個字）');
  });

  it('備註剛好 200 字可以', () => {
    const json = asJson();
    json.transactions[0].note = 'a'.repeat(200);
    expect(validateBackup(json).ok).toBe(true);
  });

  it('帳戶名稱超過 50 字', () => {
    const json = asJson();
    json.accounts[1].name = '帳'.repeat(51);
    expectFail(json, '第 2 筆帳戶的名稱太長（最多 50 個字）');
  });

  it('分類與標籤名稱超過 30 字', () => {
    const a = asJson();
    a.categories[0].name = '類'.repeat(31);
    expectFail(a, '第 1 筆分類的名稱太長（最多 30 個字）');
    const b = asJson();
    b.tags[1].name = '標'.repeat(31);
    expectFail(b, '第 2 筆標籤的名稱太長（最多 30 個字）');
  });

  it('名稱是空字串', () => {
    const json = asJson();
    json.tags[0].name = '';
    expectFail(json, '第 1 筆標籤的名稱不正確');
  });

  it('顏色與發票號碼格式不對', () => {
    const a = asJson();
    a.categories[0].color = 'red';
    expectFail(a, '第 1 筆分類的顏色不正確');
    const b = asJson();
    b.transactions[1].invoice_number = 'ab123';
    expectFail(b, '第 2 筆交易的發票號碼不正確');
  });

  it('陣列裡不是物件', () => {
    const json = asJson();
    json.accounts[0] = 'oops';
    expectFail(json, '第 1 筆帳戶不正確');
  });

  it('id 重複', () => {
    const json = asJson();
    json.transactions[1].id = json.transactions[0].id;
    expectFail(json, '第 2 筆交易重複了');
  });

  it('預算金額不正確', () => {
    const json = asJson();
    json.budgets[1].amount = -1;
    expectFail(json, '第 2 筆預算的金額不正確');
  });

  it('定期收支的日期順序不正確', () => {
    const json = asJson();
    json.recurring_transactions[0].next_occurs_on = '2025-01-01';
    expectFail(json, '第 1 筆定期收支的日期不正確');
  });
});

// ---- transactionsToCsv ----

describe('transactionsToCsv', () => {
  function csv(over: Partial<Parameters<typeof transactionsToCsv>[0]> = {}) {
    const data = sampleData();
    return transactionsToCsv({
      transactions: data.transactions,
      categories: data.categories,
      accounts: data.accounts,
      tags: data.tags,
      transactionTags: data.transaction_tags,
      ...over,
    });
  }
  const rows = (text: string) => text.slice(1).split('\r\n');

  it('開頭有 BOM，換行是 \\r\\n，第一列是表頭', () => {
    const text = csv();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('\r\n');
    expect(text).not.toMatch(/[^\r]\n/);
    expect(rows(text)[0]).toBe(
      '日期,類型,金額,分類,子分類,帳戶,轉入帳戶,備註,標籤,發票號碼,待確認',
    );
  });

  it('沒有交易時只有表頭', () => {
    expect(rows(csv({ transactions: [] }))).toHaveLength(1);
  });

  it('支出：類型、金額、分類／子分類、帳戶、標籤合併、待確認', () => {
    const lines = rows(csv());
    expect(lines[1]).toBe('2026-11-10,支出,120,飲食,午餐,現金,,午餐,公司、旅行,,是');
  });

  it('收入：沒有標籤、有發票號碼、沒備註；待確認留白', () => {
    expect(rows(csv())[2]).toBe('2026-11-10,收入,50000,薪資,,薪轉戶,,,,AB12345678,');
  });

  it('轉帳：填轉入帳戶、沒有分類', () => {
    expect(rows(csv())[3]).toBe('2026-11-10,轉帳,1000,,,薪轉戶,現金,午餐,,,');
  });

  it('沒有上層的分類只填「分類」欄', () => {
    const lines = rows(
      csv({ transactions: [tx({ id: uuid(120), category_id: CAT_FOOD, note: null })] }),
    );
    expect(lines[1]).toBe('2026-11-10,支出,120,飲食,,現金,,,,,');
  });

  it('依日期、再依 created_at 由舊到新', () => {
    const lines = rows(
      csv({
        transactions: [
          tx({ id: uuid(1), occurred_on: '2026-11-12', note: 'c' }),
          tx({
            id: uuid(2),
            occurred_on: '2026-11-10',
            created_at: '2026-11-10T09:00:00+00:00',
            note: 'b',
          }),
          tx({
            id: uuid(3),
            occurred_on: '2026-11-10',
            created_at: '2026-11-10T08:00:00+00:00',
            note: 'a',
          }),
        ],
      }),
    );
    expect(lines.slice(1).map((l) => l.split(',')[7])).toEqual(['a', 'b', 'c']);
  });

  it('逗號、雙引號、換行用雙引號包起來，內部雙引號變兩個', () => {
    const lines = csv({
      transactions: [tx({ note: '他說"好",\n再見' })],
    }).slice(1);
    expect(lines).toContain('"他說""好"",\n再見"');
  });

  it.each(['=SUM(A1)', '+1', '-1+2', '@cmd'])('文字欄位 %s 開頭防公式注入', (note) => {
    const text = csv({ transactions: [tx({ note })] });
    expect(text).toContain(`,'${note},`);
  });

  it("名稱開頭是公式字元也會加 '", () => {
    const text = csv({
      accounts: [account({ name: '=HYPERLINK("x")' })],
      transactions: [tx({ note: null })],
    });
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("金額欄位不加 '", () => {
    const text = csv({ transactions: [tx({ amount: 12.5 })] });
    expect(text).toContain(',支出,12.5,');
    expect(text).not.toContain("'12.5");
  });

  it('不是公式開頭的 = 不處理', () => {
    expect(csv({ transactions: [tx({ note: 'a=b' })] })).toContain(',a=b,');
  });

  it('參照找不到（帳戶、分類被刪）留白，不會壞掉', () => {
    const lines = rows(
      csv({ accounts: [], categories: [], tags: [], transactions: [tx({ note: null })] }),
    );
    expect(lines[1]).toBe('2026-11-10,支出,120,,,,,,,,');
  });
});

// ---- planRestore：同一本帳本 ----

describe('planRestore（同一本帳本）', () => {
  const current = { ledgerId: LEDGER, accounts: [], categories: [], tags: [] };

  function plan(over: Partial<BackupData> = {}) {
    const newId = jest.fn(counter());
    const result = planRestore(sampleBackup(over), current, newId);
    return { result, newId };
  }

  it('保留所有原本的 id，不產生新 id', () => {
    const { result, newId } = plan();
    expect(newId).not.toHaveBeenCalled();
    expect(result.accounts.map((a) => a.id)).toEqual([ACC_CASH, ACC_BANK]);
    expect(result.categories.map((c) => c.id)).toEqual([CAT_FOOD, CAT_LUNCH, CAT_SALARY]);
    expect(result.tags.map((t) => t.id)).toEqual([TAG_TRIP, TAG_WORK]);
    expect(result.transactions.map((t) => t.id)).toEqual([uuid(100), uuid(101), uuid(102)]);
    expect(result.budgets.map((b) => b.id)).toEqual([uuid(50), uuid(51)]);
    expect(result.recurring_transactions.map((r) => r.id)).toEqual([REC_RENT]);
  });

  it('參照維持不變，ledger_id 設為目前帳本', () => {
    const { result } = plan();
    const lunch = result.categories.find((c) => c.id === CAT_LUNCH);
    expect(lunch?.parent_id).toBe(CAT_FOOD);
    expect(result.transactions[0]).toMatchObject({ account_id: ACC_CASH, category_id: CAT_LUNCH });
    expect(result.transactions[1].recurring_id).toBe(REC_RENT);
    expect(result.transactions[2]).toMatchObject({ account_id: ACC_BANK, to_account_id: ACC_CASH });
    const all = [
      ...result.accounts,
      ...result.categories,
      ...result.tags,
      ...result.transactions,
      ...result.transaction_tags,
      ...result.budgets,
      ...result.recurring_transactions,
    ];
    expect(all.every((row) => row.ledger_id === LEDGER)).toBe(true);
  });

  it('summary 是實際要寫入的筆數，沒有沿用', () => {
    expect(plan().result.summary).toEqual({
      accounts: 2,
      categories: 3,
      tags: 2,
      transactions: 3,
      budgets: 2,
      recurring: 1,
      reusedAccounts: 0,
      reusedCategories: 0,
      reusedTags: 0,
    });
  });

  it('即使目前帳本已有同名資料，同一本帳本也不做沿用', () => {
    const result = planRestore(
      sampleBackup(),
      { ledgerId: LEDGER, accounts: [account()], categories: [category()], tags: [tag()] },
      counter(),
    );
    expect(result.summary.reusedAccounts).toBe(0);
    expect(result.accounts[0].id).toBe(ACC_CASH);
  });
});

// ---- planRestore：不同帳本 ----

describe('planRestore（不同帳本）', () => {
  function plan(current: Partial<Current> = {}, over: Partial<BackupData> = {}) {
    return planRestore(sampleBackup(over), { ...EMPTY_CURRENT, ...current }, counter());
  }

  it('沒有可沿用的資料時全部換新 id、參照一併對應', () => {
    const result = plan();
    const ids = [
      ...result.accounts,
      ...result.categories,
      ...result.tags,
      ...result.transactions,
      ...result.budgets,
      ...result.recurring_transactions,
    ].map((row) => row.id);
    expect(ids.every((id) => id.startsWith('new-'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(13);

    const accountIds = new Set(result.accounts.map((a) => a.id));
    const categoryIds = new Set(result.categories.map((c) => c.id));
    for (const t of result.transactions) {
      expect(accountIds.has(t.account_id)).toBe(true);
      expect(t.ledger_id).toBe(OTHER_LEDGER);
      if (t.category_id) {
        expect(categoryIds.has(t.category_id)).toBe(true);
      }
    }
    expect(result.summary).toMatchObject({ reusedAccounts: 0, reusedCategories: 0, reusedTags: 0 });
  });

  it('帳戶：名稱＋類型相同就沿用目前的 id', () => {
    const existing = account({
      id: uuid(900),
      ledger_id: OTHER_LEDGER,
      name: '現金',
      type: 'cash',
    });
    const result = plan({ accounts: [existing] });
    expect(result.summary.reusedAccounts).toBe(1);
    expect(result.accounts.map((a) => a.name)).toEqual(['薪轉戶']);
    expect(result.transactions[0].account_id).toBe(uuid(900));
    expect(result.transactions[2].to_account_id).toBe(uuid(900));
  });

  it('帳戶：名稱相同但類型不同不沿用', () => {
    const existing = account({ id: uuid(900), name: '現金', type: 'e_wallet' });
    const result = plan({ accounts: [existing] });
    expect(result.summary.reusedAccounts).toBe(0);
    expect(result.accounts.map((a) => a.name)).toEqual(['現金', '薪轉戶']);
  });

  it('分類：kind、名稱、parent 都相同就沿用，子分類的 parent 換成對應後的 id', () => {
    const existingFood = category({ id: uuid(901), ledger_id: OTHER_LEDGER });
    const result = plan({ categories: [existingFood] });
    expect(result.summary.reusedCategories).toBe(1);
    expect(result.categories.find((c) => c.name === '飲食')).toBeUndefined();
    const lunch = result.categories.find((c) => c.name === '午餐');
    expect(lunch?.parent_id).toBe(uuid(901));
    expect(lunch?.id.startsWith('new-')).toBe(true);
  });

  it('分類：上層與子分類都已存在則兩者皆沿用', () => {
    const result = plan({
      categories: [
        category({ id: uuid(901) }),
        category({ id: uuid(902), parent_id: uuid(901), name: '午餐' }),
      ],
    });
    expect(result.summary.reusedCategories).toBe(2);
    expect(result.transactions[0].category_id).toBe(uuid(902));
  });

  it('分類：同名但 kind 不同不沿用', () => {
    const result = plan({ categories: [category({ id: uuid(901), kind: 'income' })] });
    expect(result.summary.reusedCategories).toBe(0);
  });

  it('分類：同名子分類但上層不同不沿用', () => {
    const result = plan({
      categories: [
        category({ id: uuid(901), name: '交通' }),
        category({ id: uuid(902), parent_id: uuid(901), name: '午餐' }),
      ],
    });
    expect(result.summary.reusedCategories).toBe(0);
  });

  it('分類：上層一定排在子分類前面，即使備份裡順序相反', () => {
    const data = sampleData();
    const reversed = [...data.categories].reverse();
    const result = plan({}, { categories: reversed });
    const names = result.categories.map((c) => c.name);
    expect(names.indexOf('飲食')).toBeLessThan(names.indexOf('午餐'));
    const food = result.categories.find((c) => c.name === '飲食');
    expect(result.categories.find((c) => c.name === '午餐')?.parent_id).toBe(food?.id);
  });

  it('標籤：名稱相同（不分大小寫）就沿用，沿用的不重複寫入', () => {
    const result = plan({
      tags: [tag({ id: uuid(903), name: '旅行' }), tag({ id: uuid(904), name: '公司' })],
    });
    expect(result.summary.reusedTags).toBe(2);
    expect(result.tags).toHaveLength(0);
    expect(result.transaction_tags.map((l) => l.tag_id).sort()).toEqual([uuid(903), uuid(904)]);

    const caseInsensitive = plan(
      { tags: [tag({ id: uuid(903), name: 'ＡＢ' }), tag({ id: uuid(905), name: 'work' })] },
      {
        tags: [tag({ id: TAG_TRIP, name: 'WORK' })],
        transaction_tags: [{ ledger_id: LEDGER, transaction_id: uuid(100), tag_id: TAG_TRIP }],
      },
    );
    expect(caseInsensitive.summary.reusedTags).toBe(1);
    expect(caseInsensitive.transaction_tags[0].tag_id).toBe(uuid(905));
  });

  it('標籤被合併後重複的交易標籤只留一筆', () => {
    const result = plan(
      { tags: [tag({ id: uuid(903), name: 'work' })] },
      {
        tags: [tag({ id: TAG_TRIP, name: 'Work' }), tag({ id: TAG_WORK, name: 'WORK' })],
      },
    );
    expect(result.transaction_tags).toHaveLength(1);
  });

  it('交易與定期收支一律換新 id，recurring_id 對應到新的定期收支', () => {
    const result = plan();
    expect(result.transactions.every((t) => t.id.startsWith('new-'))).toBe(true);
    expect(result.recurring_transactions[0].id.startsWith('new-')).toBe(true);
    expect(result.transactions[1].recurring_id).toBe(result.recurring_transactions[0].id);
    expect(result.recurring_transactions[0].account_id).toBe(
      result.accounts.find((a) => a.name === '薪轉戶')?.id,
    );
  });

  it('transaction_tags 換成對應後的交易與標籤 id', () => {
    const result = plan();
    expect(result.transaction_tags).toHaveLength(2);
    for (const link of result.transaction_tags) {
      expect(result.transactions.some((t) => t.id === link.transaction_id)).toBe(true);
      expect(result.tags.some((t) => t.id === link.tag_id)).toBe(true);
      expect(link.ledger_id).toBe(OTHER_LEDGER);
    }
  });

  it('預算：總預算（category_id 為 null）照留，分類預算換成對應後的 id', () => {
    const result = plan();
    expect(result.budgets).toHaveLength(2);
    expect(result.budgets[0].category_id).toBeNull();
    expect(result.budgets[1].category_id).toBe(
      result.categories.find((c) => c.name === '飲食')?.id,
    );
    expect(result.budgets.every((b) => b.category_kind === 'expense')).toBe(true);
    expect(result.budgets.every((b) => b.id.startsWith('new-'))).toBe(true);
  });

  it('summary 計入沿用數量，筆數只算實際寫入的', () => {
    const result = plan({
      accounts: [account({ id: uuid(900), name: '現金', type: 'cash' })],
      tags: [tag({ id: uuid(903), name: '旅行' })],
    });
    expect(result.summary).toMatchObject({
      accounts: 1,
      tags: 1,
      reusedAccounts: 1,
      reusedTags: 1,
      transactions: 3,
      budgets: 2,
      recurring: 1,
    });
  });
});

// ---- planRestore：兩種情況共通 ----

describe('planRestore（共通規則）', () => {
  const both: [string, Current][] = [
    ['同一本帳本', { ledgerId: LEDGER, accounts: [], categories: [], tags: [] }],
    ['不同帳本', EMPTY_CURRENT],
  ];

  it.each(both)('%s：去掉 generated 與不該寫入的欄位，保留 created_at', (_name, current) => {
    const result = planRestore(sampleBackup(), current, counter());
    for (const row of [...result.transactions, ...result.recurring_transactions]) {
      expect(row).not.toHaveProperty('category_kind');
      expect(row).not.toHaveProperty('created_by');
      expect(row).not.toHaveProperty('updated_at');
      expect(row.created_at).toBe(CREATED);
    }
    for (const row of [
      ...result.accounts,
      ...result.categories,
      ...result.tags,
      ...result.budgets,
    ]) {
      expect(row).not.toHaveProperty('updated_at');
      expect(row.created_at).toBe(CREATED);
    }
    // 預算的 category_kind 不是 generated 欄位，要寫入
    expect(result.budgets[0].category_kind).toBe('expense');
  });

  it.each(both)(
    '%s：receipt_path 一律 null，invoice_number、needs_review、source 保留',
    (_n, current) => {
      const result = planRestore(sampleBackup(), current, counter());
      expect(result.transactions.every((t) => t.receipt_path === null)).toBe(true);
      expect(result.transactions[1].invoice_number).toBe('AB12345678');
      expect(result.transactions[0]).toMatchObject({ needs_review: true, source: 'shortcut' });
      expect(result.transactions[1]).toMatchObject({ needs_review: false, source: 'app' });
    },
  );

  it.each(both)('%s：帳戶找不到的交易略過，不計入 summary', (_n, current) => {
    const data = sampleData({
      transactions: [
        ...sampleData().transactions,
        tx({ id: uuid(110), account_id: uuid(777) }),
        tx({
          id: uuid(111),
          type: 'transfer',
          category_id: null,
          to_account_id: uuid(777),
          account_id: ACC_CASH,
        }),
      ],
    });
    const result = planRestore(buildBackup(data, new Date()), current, counter());
    expect(result.transactions).toHaveLength(3);
    expect(result.summary.transactions).toBe(3);
  });

  it.each(both)('%s：分類找不到、或分類類型與交易不符的交易略過', (_n, current) => {
    const data = sampleData({
      transactions: [
        tx({ id: uuid(110), category_id: uuid(778) }),
        tx({ id: uuid(111), type: 'income', category_id: CAT_FOOD, category_kind: 'income' }),
        tx({ id: uuid(112) }),
      ],
    });
    const result = planRestore(buildBackup(data, new Date()), current, counter());
    expect(result.transactions).toHaveLength(1);
  });

  it.each(both)(
    '%s：形狀不符資料庫限制的交易略過（轉帳到同一帳戶、轉帳帶分類、收支帶轉入帳戶）',
    (_n, current) => {
      const data = sampleData({
        transactions: [
          tx({ id: uuid(110), type: 'transfer', category_id: null, to_account_id: ACC_CASH }),
          tx({ id: uuid(111), type: 'transfer', to_account_id: ACC_BANK }),
          tx({ id: uuid(112), to_account_id: ACC_BANK }),
          tx({ id: uuid(113), category_id: null }),
        ],
      });
      const result = planRestore(buildBackup(data, new Date()), current, counter());
      expect(result.transactions).toHaveLength(0);
    },
  );

  it.each(both)('%s：子分類的上層不存在則該分類與其交易略過', (_n, current) => {
    const data = sampleData({
      categories: [
        category({ id: CAT_LUNCH, parent_id: uuid(779), name: '午餐' }),
        category({ id: CAT_FOOD }),
      ],
      transactions: [tx({ id: uuid(110), category_id: CAT_LUNCH }), tx({ id: uuid(111) })],
      budgets: [],
    });
    const result = planRestore(buildBackup(data, new Date()), current, counter());
    expect(result.categories.map((c) => c.id === CAT_LUNCH)).not.toContain(true);
    expect(result.categories).toHaveLength(1);
    expect(result.transactions).toHaveLength(1);
  });

  it.each(both)('%s：分類循環參照不會無限遞迴', (_n, current) => {
    const data = sampleData({
      categories: [
        category({ id: CAT_FOOD, parent_id: CAT_LUNCH }),
        category({ id: CAT_LUNCH, parent_id: CAT_FOOD, name: '午餐' }),
      ],
      transactions: [],
      budgets: [],
      recurring_transactions: [],
    });
    const result = planRestore(buildBackup(data, new Date()), current, counter());
    expect(result.categories).toHaveLength(0);
  });

  it.each(both)('%s：交易標籤指向不存在的交易或標籤就略過', (_n, current) => {
    const data = sampleData({
      transaction_tags: [
        { ledger_id: LEDGER, transaction_id: uuid(100), tag_id: TAG_TRIP },
        { ledger_id: LEDGER, transaction_id: uuid(888), tag_id: TAG_TRIP },
        { ledger_id: LEDGER, transaction_id: uuid(100), tag_id: uuid(889) },
      ],
    });
    const result = planRestore(buildBackup(data, new Date()), current, counter());
    expect(result.transaction_tags).toHaveLength(1);
  });

  it.each(both)('%s：預算的分類找不到就略過，定期收支的帳戶找不到就略過', (_n, current) => {
    const data = sampleData({
      budgets: [
        {
          id: uuid(60),
          ledger_id: LEDGER,
          category_id: uuid(780),
          category_kind: 'expense',
          amount: 1,
          created_at: CREATED,
          updated_at: CREATED,
        },
      ],
      recurring_transactions: [recurring({ account_id: uuid(781) })],
    });
    const result = planRestore(buildBackup(data, new Date()), current, counter());
    expect(result.budgets).toHaveLength(0);
    expect(result.recurring_transactions).toHaveLength(0);
    expect(result.summary).toMatchObject({ budgets: 0, recurring: 0 });
  });

  it.each(both)('%s：交易的定期收支不存在時 recurring_id 清成 null，交易保留', (_n, current) => {
    const data = sampleData({
      transactions: [tx({ id: uuid(110), recurring_id: uuid(782) })],
    });
    const result = planRestore(buildBackup(data, new Date()), current, counter());
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].recurring_id).toBeNull();
  });

  it.each(both)('%s：選填欄位缺漏時用預設值，不會寫出 undefined', (_n, current) => {
    const data = sampleData();
    const bare = JSON.parse(JSON.stringify(data));
    for (const t of bare.transactions) {
      delete t.needs_review;
      delete t.source;
      delete t.invoice_number;
      delete t.recurring_id;
      delete t.note;
    }
    const result = planRestore(buildBackup(bare, new Date()), current, counter());
    expect(result.transactions[0]).toMatchObject({
      needs_review: false,
      source: 'app',
      invoice_number: null,
      recurring_id: null,
      note: null,
    });
  });
});
