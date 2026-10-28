import { formatMoney, parseAmount, parseBalance, sumAmounts } from '@/lib/money';

describe('formatMoney', () => {
  it('加上千分位與 $ 符號', () => {
    expect(formatMoney(1234)).toBe('$1,234');
    expect(formatMoney(1234.5)).toBe('$1,234.5');
    expect(formatMoney(0)).toBe('$0');
  });

  it('負數把負號放在 $ 前面', () => {
    expect(formatMoney(-800)).toBe('-$800');
  });
});

describe('sumAmounts', () => {
  it('避免浮點誤差', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([19.99, 0.01, -5])).toBe(15);
    expect(sumAmounts([])).toBe(0);
  });
});

describe('parseAmount', () => {
  it('接受正數、千分位、最多兩位小數', () => {
    expect(parseAmount('120')).toBe(120);
    expect(parseAmount('1,234.5')).toBe(1234.5);
    expect(parseAmount(' 99.99 ')).toBe(99.99);
  });

  it('拒絕 0、負數、三位小數與非數字', () => {
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('1e5')).toBeNull();
  });

  it('拒絕超過資料庫上限的金額', () => {
    expect(parseAmount('1000000000000')).toBeNull();
  });
});

describe('parseBalance', () => {
  it('空白視為 0，可以是負數', () => {
    expect(parseBalance('')).toBe(0);
    expect(parseBalance('-5000')).toBe(-5000);
    expect(parseBalance('0')).toBe(0);
  });

  it('拒絕非數字', () => {
    expect(parseBalance('--1')).toBeNull();
  });
});
