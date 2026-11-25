import {
  invoiceNote,
  isLeftInvoiceQr,
  isRightInvoiceQr,
  parseInvoiceQr,
  rocDateToAd,
  type InvoiceQr,
} from '../invoice-qr';

type Fixed = {
  no?: string;
  date?: string;
  rand?: string;
  sales?: string;
  total?: string;
  buyer?: string;
  seller?: string;
  sign?: string;
};

function fixed(o: Fixed = {}): string {
  return (
    (o.no ?? 'AB12345678') +
    (o.date ?? '1141125') +
    (o.rand ?? '1234') +
    (o.sales ?? '00000064') +
    (o.total ?? '00000069') +
    (o.buyer ?? '00000000') +
    (o.seller ?? '12345678') +
    (o.sign ?? 'abcdefghijklmnopqrstuvwx')
  );
}

const ITEMS_UTF8 = ':**********:2:3:1:咖啡:1:60:麵包:1:45';
const LEFT = fixed() + ITEMS_UTF8;
const RIGHT = '**:蛋糕:1:30';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToB64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

function b64(s: string): string {
  const bytes = unescape(encodeURIComponent(s))
    .split('')
    .map((c) => c.charCodeAt(0));
  return bytesToB64(bytes);
}

function must(left: string, right?: string | null): InvoiceQr {
  const r = parseInvoiceQr(left, right);
  if (!r) throw new Error('應該解析成功');
  return r;
}

describe('rocDateToAd', () => {
  it('民國轉西元', () => {
    expect(rocDateToAd('1141125')).toBe('2025-11-25');
  });
  it('民國 113 年 = 2024', () => {
    expect(rocDateToAd('1130101')).toBe('2024-01-01');
  });
  it('閏年 2/29 合法', () => {
    expect(rocDateToAd('1130229')).toBe('2024-02-29');
  });
  it('非閏年 2/29 不合法', () => {
    expect(rocDateToAd('1140229')).toBeNull();
  });
  it('2/30 不合法', () => {
    expect(rocDateToAd('1140230')).toBeNull();
  });
  it('月、日超出範圍不合法', () => {
    expect(rocDateToAd('1141301')).toBeNull();
    expect(rocDateToAd('1140100')).toBeNull();
    expect(rocDateToAd('1140431')).toBeNull();
  });
  it('年份超出民國 100～199 不合法', () => {
    expect(rocDateToAd('0990101')).toBeNull();
    expect(rocDateToAd('2000101')).toBeNull();
  });
  it('格式錯誤不合法', () => {
    expect(rocDateToAd('114112')).toBeNull();
    expect(rocDateToAd('11411255')).toBeNull();
    expect(rocDateToAd('11a1125')).toBeNull();
  });
});

describe('parseInvoiceQr 固定欄位', () => {
  it('解析各欄位', () => {
    const r = must(LEFT);
    expect(r.invoiceNumber).toBe('AB12345678');
    expect(r.date).toBe('2025-11-25');
    expect(r.randomCode).toBe('1234');
    expect(r.salesAmount).toBe(100);
    expect(r.totalAmount).toBe(105);
    expect(r.amount).toBe(105);
    expect(r.sellerId).toBe('12345678');
  });
  it('十六進位大小寫皆可', () => {
    const r = must(fixed({ sales: '000000ff', total: '000001FF' }));
    expect(r.salesAmount).toBe(255);
    expect(r.totalAmount).toBe(511);
  });
  it('買方統編 00000000 為 null', () => {
    expect(must(LEFT).buyerId).toBeNull();
  });
  it('有買方統編', () => {
    expect(must(fixed({ buyer: '87654321' })).buyerId).toBe('87654321');
  });
  it('總計額為 0 時用銷售額', () => {
    const r = must(fixed({ total: '00000000' }));
    expect(r.totalAmount).toBe(0);
    expect(r.amount).toBe(100);
  });
  it('amount 為 0 回傳 null', () => {
    expect(parseInvoiceQr(fixed({ sales: '0', total: '0' }))).toBeNull();
    expect(parseInvoiceQr(fixed({ sales: '00000000', total: '00000000' }))).toBeNull();
  });
  it('只有固定欄位也能解析，品目為空', () => {
    const r = must(fixed());
    expect(r.items).toEqual([]);
    expect(r.itemsTruncated).toBe(false);
  });
  it('前後空白與換行會被 trim', () => {
    const r = must(`  \n${LEFT}\r\n `, ` ${RIGHT}\n`);
    expect(r.invoiceNumber).toBe('AB12345678');
    expect(r.items).toHaveLength(3);
  });
});

describe('parseInvoiceQr 不合法輸入', () => {
  it('字軌小寫', () => {
    expect(parseInvoiceQr(fixed({ no: 'ab12345678' }))).toBeNull();
  });
  it('字軌長度或內容錯誤', () => {
    expect(parseInvoiceQr(fixed({ no: 'A123456789' }))).toBeNull();
  });
  it('日期 2/30', () => {
    expect(parseInvoiceQr(fixed({ date: '1140230' }))).toBeNull();
  });
  it('隨機碼不是數字', () => {
    expect(parseInvoiceQr(fixed({ rand: '12ab' }))).toBeNull();
  });
  it('金額不是 hex', () => {
    expect(parseInvoiceQr(fixed({ sales: '0000006G' }))).toBeNull();
  });
  it('統編不是 8 位數字', () => {
    expect(parseInvoiceQr(fixed({ seller: '1234567A' }))).toBeNull();
  });
  it('長度不足', () => {
    expect(parseInvoiceQr(fixed().slice(0, 76))).toBeNull();
    expect(parseInvoiceQr('')).toBeNull();
  });
  it('右方 QR 不能當左方', () => {
    expect(parseInvoiceQr(RIGHT)).toBeNull();
  });
});

describe('品目解析', () => {
  it('編碼 1：UTF-8 品名', () => {
    const r = must(LEFT);
    expect(r.items).toEqual([
      { name: '咖啡', quantity: 1, unitPrice: 60 },
      { name: '麵包', quantity: 1, unitPrice: 45 },
    ]);
    expect(r.itemsTruncated).toBe(true);
  });
  it('左右合併', () => {
    const r = must(LEFT, RIGHT);
    expect(r.items.map((i) => i.name)).toEqual(['咖啡', '麵包', '蛋糕']);
    expect(r.items[2]).toEqual({ name: '蛋糕', quantity: 1, unitPrice: 30 });
    expect(r.itemsTruncated).toBe(false);
  });
  it('右方沒有開頭冒號也可', () => {
    const r = must(LEFT, '**蛋糕:1:30');
    expect(r.items).toHaveLength(3);
  });
  it('右方不是 ** 開頭就忽略', () => {
    const r = must(LEFT, ':蛋糕:1:30');
    expect(r.items).toHaveLength(2);
    expect(r.itemsTruncated).toBe(true);
  });
  it('右方為 null 或空字串', () => {
    expect(must(LEFT, null).items).toHaveLength(2);
    expect(must(LEFT, '').items).toHaveLength(2);
  });
  it('筆數相符時 itemsTruncated 為 false', () => {
    const r = must(fixed() + ':**********:2:2:1:咖啡:1:60:麵包:1:45');
    expect(r.itemsTruncated).toBe(false);
  });
  it('品名 trim、數量單價可有小數', () => {
    const r = must(fixed() + ':**********:1:1:1: 牛奶 :1.5:12.5');
    expect(r.items).toEqual([{ name: '牛奶', quantity: 1.5, unitPrice: 12.5 }]);
  });
  it('數量不是數字的品目略過，但仍計入筆數', () => {
    const r = must(fixed() + ':**********:2:2:1:咖啡:x:60:麵包:1:45');
    expect(r.items.map((i) => i.name)).toEqual(['麵包']);
    expect(r.itemsTruncated).toBe(false);
  });
  it('編碼 0（Big5）品目為空陣列', () => {
    const r = must(fixed() + ':**********:1:1:0:abc:1:60');
    expect(r.items).toEqual([]);
    expect(r.amount).toBe(105);
  });
  it('編碼 2：Base64 中文品名', () => {
    const left = fixed() + `:**********:2:2:2:${b64('咖啡')}:1:60:${b64('Latte 😀')}:2:45`;
    const r = must(left);
    expect(r.items).toEqual([
      { name: '咖啡', quantity: 1, unitPrice: 60 },
      { name: 'Latte 😀', quantity: 2, unitPrice: 45 },
    ]);
  });
  it('編碼 2：解不了的品名略過', () => {
    const left = fixed() + `:**********:2:2:2:***:1:60:${b64('麵包')}:1:45`;
    expect(must(left).items.map((i) => i.name)).toEqual(['麵包']);
  });
  it('編碼 2：不合法 UTF-8 略過', () => {
    // 0xC3 0x28 是不合法的 UTF-8 序列
    const bad = bytesToB64([0xc3, 0x28]);
    const left = fixed() + `:**********:1:1:2:${bad}:1:60`;
    expect(must(left).items).toEqual([]);
  });
  it('編碼 2：右方也使用同一編碼', () => {
    const left = fixed() + `:**********:1:2:2:${b64('咖啡')}:1:60`;
    const r = must(left, `**:${b64('蛋糕')}:1:30`);
    expect(r.items.map((i) => i.name)).toEqual(['咖啡', '蛋糕']);
    expect(r.itemsTruncated).toBe(false);
  });
  it('冒號區段格式怪異仍解析發票', () => {
    const r = must(fixed() + ':garbage');
    expect(r.amount).toBe(105);
    expect(r.items).toEqual([]);
    expect(r.itemsTruncated).toBe(false);
  });
  it('尾端不完整的品目被忽略', () => {
    const r = must(fixed() + ':**********:2:2:1:咖啡:1:60:麵包:1');
    expect(r.items.map((i) => i.name)).toEqual(['咖啡']);
    expect(r.itemsTruncated).toBe(true);
  });
});

describe('isLeftInvoiceQr / isRightInvoiceQr', () => {
  it('左方 QR', () => {
    expect(isLeftInvoiceQr(LEFT)).toBe(true);
    expect(isLeftInvoiceQr(`  ${LEFT}\n`)).toBe(true);
    expect(isRightInvoiceQr(LEFT)).toBe(false);
  });
  it('右方 QR 不是左方', () => {
    expect(isRightInvoiceQr(RIGHT)).toBe(true);
    expect(isRightInvoiceQr(`\n${RIGHT} `)).toBe(true);
    expect(isLeftInvoiceQr(RIGHT)).toBe(false);
  });
  it('其他文字都不是', () => {
    expect(isLeftInvoiceQr('https://example.com')).toBe(false);
    expect(isRightInvoiceQr('https://example.com')).toBe(false);
    expect(isLeftInvoiceQr('')).toBe(false);
    expect(isLeftInvoiceQr(fixed().slice(0, 76))).toBe(false);
  });
});

describe('invoiceNote', () => {
  it('沒有品目時用發票號碼', () => {
    expect(invoiceNote(must(fixed()))).toBe('發票 AB12345678');
  });
  it('超過上限顯示「等 N 項」', () => {
    expect(invoiceNote(must(LEFT, RIGHT))).toBe('咖啡、麵包等 3 項');
  });
  it('剛好等於上限不加「等」', () => {
    expect(invoiceNote(must(LEFT))).toBe('咖啡、麵包');
  });
  it('可指定 maxItems', () => {
    expect(invoiceNote(must(LEFT, RIGHT), 1)).toBe('咖啡等 3 項');
    expect(invoiceNote(must(LEFT, RIGHT), 3)).toBe('咖啡、麵包、蛋糕');
  });
  it('備註不超過 200 字', () => {
    const inv: InvoiceQr = {
      ...must(LEFT),
      items: [{ name: '長'.repeat(300), quantity: 1, unitPrice: 1 }],
    };
    expect(Array.from(invoiceNote(inv)).length).toBe(200);
  });
});
