import { planBudgetChanges } from '@/api/budgets';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/providers/ledger-provider', () => ({ useLedger: () => ({ id: 'ledger' }) }));

describe('planBudgetChanges', () => {
  const existing = [
    { id: 'b-total', category_id: null, amount: 20000 },
    { id: 'b-food', category_id: 'food', amount: 6000 },
    { id: 'b-fun', category_id: 'fun', amount: 1000 },
  ];

  it('新增、修改、刪除，金額沒變的不動', () => {
    expect(
      planBudgetChanges(existing, [
        { categoryId: null, amount: 20000 },
        { categoryId: 'food', amount: 7000 },
        { categoryId: 'fun', amount: null },
        { categoryId: 'transport', amount: 1500 },
        { categoryId: 'medical', amount: null },
      ]),
    ).toEqual({
      inserts: [{ categoryId: 'transport', amount: 1500 }],
      updates: [{ id: 'b-food', amount: 7000 }],
      deletes: ['b-fun'],
    });
  });
});
