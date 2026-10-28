import { groupByDate } from '@/lib/group-by-date';

describe('groupByDate', () => {
  it('依日期分組並保留順序', () => {
    const items = [
      { id: 'a', occurred_on: '2026-10-28' },
      { id: 'b', occurred_on: '2026-10-28' },
      { id: 'c', occurred_on: '2026-10-05' },
    ];
    expect(groupByDate(items)).toEqual([
      { date: '2026-10-28', data: [items[0], items[1]] },
      { date: '2026-10-05', data: [items[2]] },
    ]);
  });

  it('空陣列', () => {
    expect(groupByDate([])).toEqual([]);
  });
});
