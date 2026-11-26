import type { CarrierInvoice } from '@/lib/carrier-import';
import { buildCarrierRows, looksGarbled } from '@/lib/carrier-plan';

type Cat = Parameters<typeof buildCarrierRows>[1][number];

function cat(id: string, name: string, extra: Partial<Cat> = {}): Cat {
  return {
    id,
    name,
    kind: 'expense',
    parent_id: null,
    is_archived: false,
    sort_order: 0,
    ...extra,
  };
}

function invoice(extra: Partial<CarrierInvoice> = {}): CarrierInvoice {
  return {
    invoiceNumber: 'AB12345678',
    date: '2026-11-25',
    amount: 100,
    storeName: null,
    sellerId: null,
    items: [],
    status: 'issued',
    ...extra,
  };
}

describe('buildCarrierRows', () => {
  const categories = [
    cat('food', '飲食', { sort_order: 1 }),
    cat('other', '其他', { sort_order: 2 }),
  ];

  it('依店名猜到分類', () => {
    const rows = buildCarrierRows([invoice({ storeName: '全家便利商店' })], categories);
    expect(rows).toHaveLength(1);
    expect(rows[0].categoryId).toBe('food');
    expect(rows[0].categoryMatched).toBe(true);
  });

  it('猜不到或沒有對應分類時退回「其他」並標示未對到', () => {
    const rows = buildCarrierRows([invoice({ storeName: '某某行號' })], categories);
    expect(rows[0].categoryId).toBe('other');
    expect(rows[0].categoryMatched).toBe(false);
  });

  it('沒有「其他」時用第一個上層分類；略過封存與收入分類', () => {
    const rows = buildCarrierRows(
      [invoice()],
      [
        cat('a', '收入', { kind: 'income' }),
        cat('b', '封存', { is_archived: true }),
        cat('c', '交通', { sort_order: 3 }),
        cat('d', '娛樂', { sort_order: 4 }),
      ],
    );
    expect(rows[0].categoryId).toBe('c');
  });

  it('沒有任何支出分類時回傳空陣列', () => {
    expect(buildCarrierRows([invoice()], [cat('a', '薪水', { kind: 'income' })])).toEqual([]);
  });

  it('沒有發票時回傳空陣列', () => {
    expect(buildCarrierRows([], categories)).toEqual([]);
  });
});

describe('looksGarbled', () => {
  it('正常文字不是亂碼', () => {
    expect(looksGarbled('M|發票狀態|發票號碼\nD|AB12345678|拿鐵')).toBe(false);
    expect(looksGarbled('')).toBe(false);
  });

  it('大量替換字元視為亂碼', () => {
    expect(looksGarbled('�'.repeat(6) + 'a'.repeat(10000))).toBe(true);
  });

  it('少量但占比 1% 以上視為亂碼', () => {
    expect(looksGarbled('��' + 'a'.repeat(98))).toBe(true);
  });

  it('極少的替換字元且占比很低不算', () => {
    expect(looksGarbled('�' + 'a'.repeat(1000))).toBe(false);
  });
});
