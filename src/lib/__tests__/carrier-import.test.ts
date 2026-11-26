import {
  carrierNote,
  guessCarrierCategory,
  parseCarrierFile,
  planCarrierImport,
  type CarrierInvoice,
  type CarrierParseResult,
} from '../carrier-import';

function ok(text: string): CarrierParseResult {
  const result = parseCarrierFile(text);
  if ('error' in result) throw new Error(result.error);
  return result;
}

function invoice(overrides: Partial<CarrierInvoice> = {}): CarrierInvoice {
  return {
    invoiceNumber: 'AB12345678',
    date: '2026-11-01',
    amount: 120,
    storeName: null,
    sellerId: null,
    items: [],
    status: 'issued',
    ...overrides,
  };
}

const PIPE_SAMPLE = [
  '表頭=M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|',
  '明細=D|發票號碼|小計|品項名稱|',
  'M|手機條碼|/ABC1234|20261101|12345678|全家便利商店|AB12345678|120|開立|',
  'D|AB12345678|60|拿鐵咖啡|',
  'D|AB12345678|60|御飯糰|',
  'M|手機條碼|/ABC1234|20261102|87654321|全聯福利中心|CD87654321|356|開立|',
].join('\n');

describe('parseCarrierFile：pipe 格式', () => {
  it('解析 M 與 D 列並合併品名', () => {
    const result = ok(PIPE_SAMPLE);
    expect(result.format).toBe('pipe');
    expect(result.skipped).toEqual([]);
    expect(result.invoices).toEqual([
      {
        invoiceNumber: 'AB12345678',
        date: '2026-11-01',
        amount: 120,
        storeName: '全家便利商店',
        sellerId: '12345678',
        items: ['拿鐵咖啡', '御飯糰'],
        status: 'issued',
      },
      {
        invoiceNumber: 'CD87654321',
        date: '2026-11-02',
        amount: 356,
        storeName: '全聯福利中心',
        sellerId: '87654321',
        items: [],
        status: 'issued',
      },
    ]);
  });

  it('沒有說明列時依預設欄位順序解析', () => {
    const result = ok('M|手機條碼|/ABC1234|20261101|12345678|全家|AB12345678|120|開立|');
    expect(result.invoices[0]).toMatchObject({
      invoiceNumber: 'AB12345678',
      date: '2026-11-01',
      amount: 120,
      storeName: '全家',
      sellerId: '12345678',
    });
  });

  it('說明列決定欄位順序（欄位順序不同）', () => {
    const text = [
      '表頭=M|發票號碼|總金額|商店店名|發票日期|商店統編|發票狀態|',
      '明細=D|品項名稱|發票號碼|小計|',
      'M|AB12345678|99|7-ELEVEN|2026/11/03|11111111|開立|',
      'D|可樂|AB12345678|99|',
    ].join('\n');
    const result = ok(text);
    expect(result.invoices).toEqual([
      {
        invoiceNumber: 'AB12345678',
        date: '2026-11-03',
        amount: 99,
        storeName: '7-ELEVEN',
        sellerId: '11111111',
        items: ['可樂'],
        status: 'issued',
      },
    ]);
  });

  it('說明列缺少必要欄位時回報錯誤', () => {
    const text = ['表頭=M|載具名稱|商店店名|發票號碼|', 'M|手機條碼|全家|AB12345678|'].join('\n');
    expect(parseCarrierFile(text)).toEqual({ error: '檔案缺少必要欄位：日期、金額' });
  });

  it('行尾多餘的 | 與空白不影響解析', () => {
    const result = ok('M|手機條碼|/ABC1234|20261101|12345678|全家|AB12345678|120|開立|||  ');
    expect(result.invoices).toHaveLength(1);
  });

  it('支援西元與民國日期的各種寫法', () => {
    const dates = ['20261101', '2026/11/01', '2026-11-01', '1151101', '115/11/01', '115-11-1'];
    const text = dates
      .map((d, i) => `M|手機條碼|/ABC1234|${d}|12345678|店|AB1234567${i}|10|開立|`)
      .join('\n');
    const result = ok(text);
    expect(result.skipped).toEqual([]);
    expect(result.invoices.map((i) => i.date)).toEqual(Array(dates.length).fill('2026-11-01'));
  });

  it('作廢相關狀態標為 void，開立與空白為 issued', () => {
    const rows = ['作廢', '已作廢', '註銷', '折讓', '開立', ''].map(
      (s, i) => `M|手機條碼|/ABC1234|20261101|12345678|店|AB1234567${i}|10|${s}|`,
    );
    const result = ok(rows.join('\n'));
    expect(result.invoices.map((i) => i.status)).toEqual([
      'void',
      'void',
      'void',
      'void',
      'issued',
      'issued',
    ]);
  });

  it('品名去重並保留順序', () => {
    const text = [
      'M|手機條碼|/ABC1234|20261101|12345678|店|AB12345678|120|開立|',
      'D|AB12345678|60|咖啡|',
      'D|AB12345678|60|麵包|',
      'D|AB12345678|60|咖啡|',
    ].join('\n');
    expect(ok(text).invoices[0].items).toEqual(['咖啡', '麵包']);
  });

  it('發票號碼轉大寫並去掉空白與連字號', () => {
    const result = ok('M|手機條碼|/ABC1234|20261101|12345678|店|ab-12345678 |120|開立|');
    expect(result.invoices[0].invoiceNumber).toBe('AB12345678');
  });

  it('金額支援千分位與「元」，小數最多兩位', () => {
    const text = [
      'M|手機條碼|/A|20261101|12345678|店|AB00000001|1,200|開立|',
      'M|手機條碼|/A|20261101|12345678|店|AB00000002|350元|開立|',
      'M|手機條碼|/A|20261101|12345678|店|AB00000003|12.5|開立|',
    ].join('\n');
    const result = ok(text);
    expect(result.invoices.map((i) => i.amount)).toEqual([1200, 350, 12.5]);
  });

  it('結果依日期由舊到新、同日依發票號碼排序', () => {
    const text = [
      'M|手機條碼|/A|20261105|12345678|店|ZZ00000001|10|開立|',
      'M|手機條碼|/A|20261101|12345678|店|BB00000001|10|開立|',
      'M|手機條碼|/A|20261101|12345678|店|AA00000001|10|開立|',
    ].join('\n');
    expect(ok(text).invoices.map((i) => i.invoiceNumber)).toEqual([
      'AA00000001',
      'BB00000001',
      'ZZ00000001',
    ]);
  });

  it('無效的商店統編變成 null', () => {
    const result = ok('M|手機條碼|/A|20261101|123|店|AB12345678|10|開立|');
    expect(result.invoices[0].sellerId).toBeNull();
  });

  it('單列不合法放進 skipped 並附 1-based 行號與原因，不中斷', () => {
    const text = [
      '表頭=M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|', // 1
      'M|手機條碼|/A|20261101|12345678|店|AB12345678|120|開立|', // 2
      'M|手機條碼|/A|20261101|12345678|店|XX123|120|開立|', // 3
      'M|手機條碼|/A|20261340|12345678|店|AB00000002|120|開立|', // 4
      'M|手機條碼|/A|20261101|12345678|店|AB00000003|0|開立|', // 5
      'M|手機條碼|/A|20261101|12345678|店|AB00000004|abc|開立|', // 6
      '', // 7
      '共 4 筆', // 8
      'D|AB99999999|10|不存在|', // 9
    ].join('\n');
    const result = ok(text);
    expect(result.invoices).toHaveLength(1);
    expect(result.skipped.map((s) => s.line)).toEqual([3, 4, 5, 6, 8, 9]);
    expect(result.skipped[0].reason).toContain('發票號碼格式不正確');
    expect(result.skipped[1].reason).toContain('日期不合法');
    expect(result.skipped[2].reason).toContain('金額不是正數');
    expect(result.skipped[4].reason).toContain('無法辨識');
    expect(result.skipped[5].reason).toContain('找不到對應的發票');
  });

  it('被略過的 M 列所屬的 D 列不重複回報', () => {
    const text = [
      'M|手機條碼|/A|20261101|12345678|店|AB12345678|0|開立|',
      'D|AB12345678|60|咖啡|',
    ].join('\n');
    const result = ok(text);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].line).toBe(1);
  });

  it('BOM 加 CRLF 換行', () => {
    const result = ok(`﻿${PIPE_SAMPLE.replace(/\n/g, '\r\n')}\r\n`);
    expect(result.invoices).toHaveLength(2);
    expect(result.invoices[0].items).toEqual(['拿鐵咖啡', '御飯糰']);
    expect(result.skipped).toEqual([]);
  });

  it('同一發票號碼出現兩次的 M 列都保留，交給 planCarrierImport 去重', () => {
    const row = 'M|手機條碼|/A|20261101|12345678|店|AB12345678|120|開立|';
    expect(ok(`${row}\n${row}`).invoices).toHaveLength(2);
  });
});

describe('parseCarrierFile：csv 格式', () => {
  it('每張發票一列', () => {
    const text = [
      '發票號碼,發票日期,商店名稱,賣方統編,總金額,發票狀態',
      'AB12345678,2026/11/01,全家便利商店,12345678,120,開立',
      'CD87654321,2026/11/02,全聯福利中心,87654321,"1,356",開立',
    ].join('\n');
    const result = ok(text);
    expect(result.format).toBe('csv');
    expect(result.invoices).toEqual([
      {
        invoiceNumber: 'AB12345678',
        date: '2026-11-01',
        amount: 120,
        storeName: '全家便利商店',
        sellerId: '12345678',
        items: [],
        status: 'issued',
      },
      {
        invoiceNumber: 'CD87654321',
        date: '2026-11-02',
        amount: 1356,
        storeName: '全聯福利中心',
        sellerId: '87654321',
        items: [],
        status: 'issued',
      },
    ]);
  });

  it('多列同一發票：合併品名，金額取總金額欄', () => {
    const text = [
      '發票號碼,消費日期,賣方名稱,總金額,品名',
      'AB12345678,1151101,全家,120,拿鐵',
      'AB12345678,1151101,全家,120,御飯糰',
      'AB12345678,1151101,全家,120,拿鐵',
    ].join('\n');
    const result = ok(text);
    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0]).toMatchObject({
      date: '2026-11-01',
      amount: 120,
      items: ['拿鐵', '御飯糰'],
    });
  });

  it('同義欄位：開立日期、店家、商店統編、發票金額、狀態、品項', () => {
    const text = [
      '發票號碼,開立日期,店家,商店統編,發票金額,狀態,品項',
      'AB12345678,20261101,小店,12345678,50,已作廢,糖果',
    ].join('\n');
    expect(ok(text).invoices[0]).toEqual({
      invoiceNumber: 'AB12345678',
      date: '2026-11-01',
      amount: 50,
      storeName: '小店',
      sellerId: '12345678',
      items: ['糖果'],
      status: 'void',
    });
  });

  it('只有品項小計欄時加總各列', () => {
    const text = [
      '發票號碼,發票日期,商店店名,品項名稱,小計',
      'AB12345678,2026-11-01,全家,拿鐵,60',
      'AB12345678,2026-11-01,全家,御飯糰,"1,060"',
    ].join('\n');
    expect(ok(text).invoices[0].amount).toBe(1120);
  });

  it('品項小計加總後不是正數時略過', () => {
    const text = ['發票號碼,發票日期,小計', 'AB12345678,2026-11-01,-5'].join('\n');
    const result = ok(text);
    expect(result.invoices).toEqual([]);
    expect(result.skipped[0].line).toBe(2);
  });

  it('同一發票多列的金額不一致時整張略過並回報', () => {
    const text = [
      '發票號碼,發票日期,金額,品名',
      'AB12345678,2026-11-01,60,拿鐵',
      'AB12345678,2026-11-01,70,御飯糰',
    ].join('\n');
    const result = ok(text);
    expect(result.invoices).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('金額不一致');
  });

  it('雙引號欄位可含逗號、跳脫的雙引號與換行', () => {
    const text = [
      '發票號碼,發票日期,商店名稱,總金額,品名',
      'AB12345678,2026-11-01,"早餐店, 分店",100,"""招牌""蛋餅"',
      'AB12345678,2026-11-01,"早餐店, 分店",100,"豆漿',
      '大杯"',
      'CD87654321,2026-11-02,店,20,茶',
    ].join('\n');
    const result = ok(text);
    expect(result.skipped).toEqual([]);
    expect(result.invoices[0]).toMatchObject({
      storeName: '早餐店, 分店',
      items: ['"招牌"蛋餅', '豆漿\n大杯'],
    });
    expect(result.invoices[1].invoiceNumber).toBe('CD87654321');
  });

  it('BOM 加 CRLF 換行', () => {
    const text =
      '﻿發票號碼,發票日期,總金額\r\nAB12345678,2026/11/01,120\r\nCD87654321,2026/11/02,30\r\n';
    const result = ok(text);
    expect(result.invoices.map((i) => i.amount)).toEqual([120, 30]);
  });

  it('欄位名稱前後有空白也能對上', () => {
    const text = [' 發票號碼 , 發票日期 , 總金額 ', 'AB12345678,2026/11/01,120'].join('\n');
    expect(ok(text).invoices).toHaveLength(1);
  });

  it('skipped 行號是檔案中的 1-based 行號（含引號內換行）', () => {
    const text = [
      '發票號碼,發票日期,總金額,品名', // 1
      'AB12345678,2026/11/01,120,"a', // 2
      'b"', // 3
      'XX1,2026/11/01,120,x', // 4
      ',2026/11/01,120,x', // 5
      'CD87654321,2026/13/01,120,x', // 6
      'EF87654321,2026/11/01,-3,x', // 7
    ].join('\n');
    const result = ok(text);
    expect(result.invoices).toHaveLength(1);
    expect(result.skipped.map((s) => s.line)).toEqual([4, 5, 6, 7]);
    expect(result.skipped[1].reason).toBe('沒有發票號碼');
  });

  it('缺少必要欄位時回報缺哪些', () => {
    expect(parseCarrierFile('發票號碼,商店名稱\nAB12345678,店')).toEqual({
      error: '檔案缺少必要欄位：日期、金額',
    });
    expect(parseCarrierFile('發票號碼,發票日期,商店名稱\nAB12345678,2026/11/01,店')).toEqual({
      error: '檔案缺少必要欄位：金額',
    });
  });

  it('只有表頭沒有資料時回傳空結果', () => {
    const result = ok('發票號碼,發票日期,總金額');
    expect(result.invoices).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});

describe('parseCarrierFile：看不懂的檔案', () => {
  const message = '看不懂這個檔案的格式，請確認是從財政部電子發票整合服務平台匯出的載具消費明細';

  it('空檔案', () => {
    expect(parseCarrierFile('')).toEqual({ error: message });
    expect(parseCarrierFile('\n\n  \n')).toEqual({ error: message });
  });

  it('隨便一段文字', () => {
    expect(parseCarrierFile('hello world')).toEqual({ error: message });
  });

  it('CSV 但沒有發票號碼欄', () => {
    expect(parseCarrierFile('日期,金額,店名\n2026/11/01,120,全家')).toEqual({ error: message });
  });

  it('只有說明列沒有 M 列', () => {
    expect(parseCarrierFile('表頭=M|載具名稱|發票號碼|\n明細=D|發票號碼|')).toEqual({
      error: message,
    });
  });
});

describe('guessCarrierCategory', () => {
  it('便利商店店名 → 飲食', () => {
    expect(guessCarrierCategory(invoice({ storeName: '全家便利商店' }))).toBe('飲食');
    expect(guessCarrierCategory(invoice({ storeName: '統一超商股份有限公司○○門市' }))).toBe('飲食');
    expect(guessCarrierCategory(invoice({ storeName: '7 ELEVEN' }))).toBe('飲食');
  });

  it('全聯、家樂福、屈臣氏 → 日用品', () => {
    expect(guessCarrierCategory(invoice({ storeName: '全聯福利中心' }))).toBe('日用品');
    expect(guessCarrierCategory(invoice({ storeName: '家樂福' }))).toBe('日用品');
    expect(guessCarrierCategory(invoice({ storeName: '屈臣氏' }))).toBe('日用品');
  });

  it('加油站 → 交通', () => {
    expect(guessCarrierCategory(invoice({ storeName: '台灣中油股份有限公司' }))).toBe('交通');
    expect(guessCarrierCategory(invoice({ storeName: '某某加油站', items: ['92無鉛汽油'] }))).toBe(
      '交通',
    );
  });

  it('IKEA → 居家、博客來 → 教育', () => {
    expect(guessCarrierCategory(invoice({ storeName: 'IKEA 宜家家居' }))).toBe('居家');
    expect(guessCarrierCategory(invoice({ storeName: '博客來數位科技' }))).toBe('教育');
  });

  it('品名命中 EXPENSE_CATEGORY_KEYWORDS', () => {
    expect(guessCarrierCategory(invoice({ storeName: '某某商行', items: ['衛生紙'] }))).toBe(
      '日用品',
    );
    expect(guessCarrierCategory(invoice({ items: ['拿鐵咖啡'] }))).toBe('飲食');
  });

  it('最長關鍵字優先：較長的品名關鍵字勝過較短的店名關鍵字', () => {
    // 全家（2 字）vs 洗髮精（3 字）
    expect(guessCarrierCategory(invoice({ storeName: '全家', items: ['洗髮精'] }))).toBe('日用品');
  });

  it('長度相同時店名表優先', () => {
    // 全聯（日用品，2 字）vs 咖啡（飲食，2 字）
    expect(guessCarrierCategory(invoice({ storeName: '全聯', items: ['咖啡'] }))).toBe('日用品');
  });

  it('都不命中回傳 null', () => {
    expect(
      guessCarrierCategory(invoice({ storeName: '某某有限公司', items: ['雜項'] })),
    ).toBeNull();
    expect(guessCarrierCategory(invoice())).toBeNull();
  });
});

describe('carrierNote', () => {
  it('店名加品名', () => {
    expect(carrierNote(invoice({ storeName: '全家便利商店', items: ['拿鐵咖啡', '御飯糰'] }))).toBe(
      '全家便利商店：拿鐵咖啡、御飯糰',
    );
  });

  it('品名超過 2 個寫「等 N 項」', () => {
    expect(carrierNote(invoice({ storeName: '全家', items: ['A', 'B', 'C', 'D'] }))).toBe(
      '全家：A、B等 4 項',
    );
  });

  it('沒有品名只有店名', () => {
    expect(carrierNote(invoice({ storeName: '全聯福利中心' }))).toBe('全聯福利中心');
  });

  it('沒有店名只有品名', () => {
    expect(carrierNote(invoice({ items: ['咖啡'] }))).toBe('咖啡');
  });

  it('都沒有時用發票號碼', () => {
    expect(carrierNote(invoice())).toBe('發票 AB12345678');
  });

  it('最多 200 字', () => {
    const note = carrierNote(invoice({ storeName: '店'.repeat(150), items: ['品'.repeat(150)] }));
    expect(Array.from(note)).toHaveLength(200);
  });
});

describe('planCarrierImport', () => {
  it('排除作廢、已存在、檔案內重複（保留第一筆）', () => {
    const a = invoice({ invoiceNumber: 'AA00000001', amount: 10 });
    const aAgain = invoice({ invoiceNumber: 'AA00000001', amount: 99 });
    const b = invoice({ invoiceNumber: 'BB00000002' });
    const c = invoice({ invoiceNumber: 'CC00000003' });
    const d = invoice({ invoiceNumber: 'DD00000004', status: 'void' });
    const plan = planCarrierImport([a, aAgain, b, c, d], new Set(['BB00000002']));
    expect(plan.toImport).toEqual([a, c]);
    expect(plan.toImport[0].amount).toBe(10);
    expect(plan.duplicates).toBe(2);
    expect(plan.voided).toBe(1);
  });

  it('全部都是新的就全部匯入', () => {
    const list = [
      invoice({ invoiceNumber: 'AA00000001' }),
      invoice({ invoiceNumber: 'AA00000002' }),
    ];
    expect(planCarrierImport(list, new Set())).toEqual({
      toImport: list,
      duplicates: 0,
      voided: 0,
    });
  });

  it('空清單', () => {
    expect(planCarrierImport([], new Set(['AA00000001']))).toEqual({
      toImport: [],
      duplicates: 0,
      voided: 0,
    });
  });

  it('作廢且已存在的只算作廢', () => {
    const v = invoice({ invoiceNumber: 'AA00000001', status: 'void' });
    const plan = planCarrierImport([v], new Set(['AA00000001']));
    expect(plan).toEqual({ toImport: [], duplicates: 0, voided: 1 });
  });
});
