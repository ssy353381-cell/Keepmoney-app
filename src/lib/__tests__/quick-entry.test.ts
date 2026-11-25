import { resolveQuickEntry } from '@/lib/quick-entry';
import type { QuickParseResult } from '@/lib/quick-parse';

type Cat = Parameters<typeof resolveQuickEntry>[1][number];

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

function parsed(extra: Partial<QuickParseResult> = {}): QuickParseResult {
  return {
    amount: 100,
    type: 'expense',
    occurredOn: '2026-11-25',
    categoryName: null,
    note: '',
    ...extra,
  };
}

const accounts = [{ id: 'a1', is_archived: false, sort_order: 0, created_at: '2026-01-01' }];

describe('resolveQuickEntry 分類', () => {
  const categories = [
    cat('food', '飲食', { sort_order: 1 }),
    cat('other', '其他', { sort_order: 9 }),
    cat('salary', '薪水', { kind: 'income', sort_order: 1 }),
  ];

  it('名稱相符', () => {
    const r = resolveQuickEntry(parsed({ categoryName: '飲食' }), categories, accounts);
    expect(r).toEqual({ categoryId: 'food', categoryMatched: true, accountId: 'a1' });
  });

  it('名稱不分大小寫', () => {
    const list = [cat('c', 'Coffee')];
    expect(resolveQuickEntry(parsed({ categoryName: 'coffee' }), list, accounts).categoryId).toBe(
      'c',
    );
  });

  it('上層分類優先於同名子分類', () => {
    const list = [
      cat('child', '早餐', { parent_id: 'food', sort_order: 0 }),
      cat('parent', '早餐', { sort_order: 5 }),
    ];
    expect(resolveQuickEntry(parsed({ categoryName: '早餐' }), list, accounts).categoryId).toBe(
      'parent',
    );
  });

  it('只有子分類相符時使用子分類', () => {
    const list = [cat('food', '飲食'), cat('child', '早餐', { parent_id: 'food' })];
    const r = resolveQuickEntry(parsed({ categoryName: '早餐' }), list, accounts);
    expect(r.categoryId).toBe('child');
    expect(r.categoryMatched).toBe(true);
  });

  it('同名時依 sort_order', () => {
    const list = [cat('b', '飲食', { sort_order: 2 }), cat('a', '飲食', { sort_order: 1 })];
    expect(resolveQuickEntry(parsed({ categoryName: '飲食' }), list, accounts).categoryId).toBe(
      'a',
    );
  });

  it('找不到名稱時退回「其他」，且不算對到', () => {
    const r = resolveQuickEntry(parsed({ categoryName: '不存在' }), categories, accounts);
    expect(r).toMatchObject({ categoryId: 'other', categoryMatched: false });
  });

  it('沒有猜到分類時退回「其他」', () => {
    const r = resolveQuickEntry(parsed(), categories, accounts);
    expect(r).toMatchObject({ categoryId: 'other', categoryMatched: false });
  });

  it('沒有「其他」時用第一個上層分類', () => {
    const list = [
      cat('child', '子', { parent_id: 'x', sort_order: 0 }),
      cat('b', '交通', { sort_order: 2 }),
      cat('a', '飲食', { sort_order: 1 }),
    ];
    const r = resolveQuickEntry(parsed(), list, accounts);
    expect(r).toMatchObject({ categoryId: 'a', categoryMatched: false });
  });

  it('「其他」是子分類時不採用', () => {
    const list = [cat('o', '其他', { parent_id: 'food' }), cat('food', '飲食', { sort_order: 1 })];
    expect(resolveQuickEntry(parsed(), list, accounts).categoryId).toBe('food');
  });

  it('封存的分類不會被選到', () => {
    const list = [
      cat('old', '飲食', { is_archived: true }),
      cat('other', '其他', { sort_order: 5 }),
    ];
    const r = resolveQuickEntry(parsed({ categoryName: '飲食' }), list, accounts);
    expect(r).toMatchObject({ categoryId: 'other', categoryMatched: false });
  });

  it('只看同類型的分類', () => {
    const r = resolveQuickEntry(
      parsed({ type: 'income', categoryName: '飲食' }),
      categories,
      accounts,
    );
    expect(r).toMatchObject({ categoryId: 'salary', categoryMatched: false });
  });

  it('完全沒有分類', () => {
    const r = resolveQuickEntry(parsed({ categoryName: '飲食' }), [], accounts);
    expect(r).toMatchObject({ categoryId: null, categoryMatched: false });
  });
});

describe('resolveQuickEntry 帳戶', () => {
  it('取未封存、sort_order 最小的帳戶', () => {
    const list = [
      { id: 'x', is_archived: true, sort_order: 0, created_at: '2026-01-01' },
      { id: 'b', is_archived: false, sort_order: 2, created_at: '2026-01-01' },
      { id: 'a', is_archived: false, sort_order: 1, created_at: '2026-03-01' },
    ];
    expect(resolveQuickEntry(parsed(), [], list).accountId).toBe('a');
  });

  it('sort_order 相同時取較早建立的', () => {
    const list = [
      { id: 'late', is_archived: false, sort_order: 0, created_at: '2026-03-01T00:00:00Z' },
      { id: 'early', is_archived: false, sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
    ];
    expect(resolveQuickEntry(parsed(), [], list).accountId).toBe('early');
  });

  it('沒有可用帳戶', () => {
    const archived = [{ id: 'x', is_archived: true, sort_order: 0, created_at: '2026-01-01' }];
    expect(resolveQuickEntry(parsed(), [], archived).accountId).toBeNull();
    expect(resolveQuickEntry(parsed(), [], []).accountId).toBeNull();
  });
});
