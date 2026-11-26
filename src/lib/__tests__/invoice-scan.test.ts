import {
  acceptScan,
  initialScanState,
  readInvoiceNumber,
  scanResult,
  type ScanState,
} from '../invoice-scan';

const FIXED =
  'AB12345678' +
  '1141125' +
  '1234' +
  '00000064' +
  '00000069' +
  '00000000' +
  '12345678' +
  'abcdefghijklmnopqrstuvwx';
const LEFT = FIXED + ':**********:2:3:1:咖啡:1:60:麵包:1:45';
const RIGHT = '**:蛋糕:1:30';

describe('acceptScan', () => {
  it('分類左右 QR，忽略其他 QR', () => {
    let s = initialScanState();
    s = acceptScan(s, 'https://example.com', 1);
    expect(s).toEqual(initialScanState());
    s = acceptScan(s, LEFT, 10);
    expect(s).toEqual({ left: LEFT, right: null, leftAt: 10 });
    s = acceptScan(s, RIGHT, 20);
    expect(s).toEqual({ left: LEFT, right: RIGHT, leftAt: 10 });
  });

  it('重複掃到同樣內容不改變 state（同一個物件）', () => {
    const s = acceptScan(initialScanState(), LEFT, 10);
    expect(acceptScan(s, LEFT, 999)).toBe(s);
    const r = acceptScan(s, RIGHT, 11);
    expect(acceptScan(r, RIGHT, 12)).toBe(r);
  });

  it('先掃到右方也可以', () => {
    const s = acceptScan(initialScanState(), RIGHT, 5);
    expect(s).toEqual({ left: null, right: RIGHT, leftAt: null });
    expect(acceptScan(s, LEFT, 8)).toEqual({ left: LEFT, right: RIGHT, leftAt: 8 });
  });

  it('換了另一張發票的左方 QR 會重新計時並清掉右方', () => {
    const other = LEFT.replace('AB12345678', 'CD87654321');
    const s = acceptScan(acceptScan(initialScanState(), LEFT, 1), RIGHT, 2);
    expect(acceptScan(s, other, 50)).toEqual({ left: other, right: null, leftAt: 50 });
  });
});

describe('scanResult', () => {
  it('沒有左方 QR 一律等待', () => {
    expect(scanResult(initialScanState(), 0)).toBe('waiting');
    expect(scanResult({ left: null, right: RIGHT, leftAt: null }, 5000)).toBe('waiting');
  });

  it('左方剛出現時等待右方', () => {
    const s = acceptScan(initialScanState(), LEFT, 1000);
    expect(scanResult(s, 1500)).toBe('waiting');
    expect(scanResult(s, 2200)).toBe('waiting'); // 剛好 1200ms 還不算超過
  });

  it('有右方就立刻解析並合併品目', () => {
    const s = acceptScan(acceptScan(initialScanState(), LEFT, 1000), RIGHT, 1100);
    const result = scanResult(s, 1100);
    expect(result).not.toBe('waiting');
    expect(result).not.toBe('invalid');
    if (typeof result === 'object') {
      expect(result.invoiceNumber).toBe('AB12345678');
      expect(result.amount).toBe(105);
      expect(result.items.map((i) => i.name)).toEqual(['咖啡', '麵包', '蛋糕']);
    }
  });

  it('等超過 waitMs 就只用左方解析', () => {
    const s = acceptScan(initialScanState(), LEFT, 1000);
    const result = scanResult(s, 2201);
    expect(typeof result).toBe('object');
    if (typeof result === 'object') expect(result.invoiceNumber).toBe('AB12345678');
  });

  it('可以自訂等待時間', () => {
    const s = acceptScan(initialScanState(), LEFT, 0);
    expect(scanResult(s, 500, 300)).not.toBe('waiting');
  });

  it('解析失敗（金額為 0）回傳 invalid', () => {
    const zero = FIXED.replace('00000064', '00000000').replace('00000069', '00000000');
    const s: ScanState = acceptScan(initialScanState(), zero + ':**********:1:1:1:x:1:1', 0);
    expect(scanResult(s, 5000)).toBe('invalid');
  });

  it('日期不合法回傳 invalid', () => {
    const bad = FIXED.replace('1141125', '1141399');
    const s = acceptScan(initialScanState(), bad, 0);
    expect(scanResult(s, 5000)).toBe('invalid');
  });
});

describe('readInvoiceNumber', () => {
  it('只接受 2 個大寫字母＋8 個數字', () => {
    expect(readInvoiceNumber('AB12345678')).toBe('AB12345678');
    expect(readInvoiceNumber('ab12345678')).toBeNull();
    expect(readInvoiceNumber('AB1234567')).toBeNull();
    expect(readInvoiceNumber('AB123456789')).toBeNull();
    expect(readInvoiceNumber('AB12345678\n')).toBeNull();
    expect(readInvoiceNumber(undefined)).toBeNull();
  });
});
