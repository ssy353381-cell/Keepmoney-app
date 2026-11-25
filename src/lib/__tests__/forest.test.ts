import { summarizeMonths, type SummaryTransaction } from '@/lib/daily-summary';
import { daysInMonth } from '@/lib/date';
import { buildForest } from '@/lib/forest';

function txs(entries: [string, number][]): SummaryTransaction[] {
  return entries.map(([date, amount], i) => ({
    id: `t${i}`,
    type: 'expense',
    amount,
    occurred_on: date,
    created_at: `${date}T10:00:00+00:00`,
  }));
}

const entries: [string, number][] = [
  ...Array.from({ length: 20 }, (_, i): [string, number] => [
    `2026-01-${String(i + 1).padStart(2, '0')}`,
    100 + i * 10,
  ]),
  ['2026-03-05', 500],
  ['2026-10-28', 300],
  ['2026-10-29', 3000],
];

describe('buildForest', () => {
  const months = summarizeMonths(2026, txs(entries));
  const forest = buildForest(2026, months, '2026-11-25', 'light', null);

  it('一定 12 棵，月份與標籤依序', () => {
    expect(forest).toHaveLength(12);
    expect(forest.map((t) => t.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(forest[0].label).toBe('1月');
    expect(forest[11].label).toBe('12月');
  });

  it('沒資料也是 12 棵', () => {
    expect(buildForest(2026, summarizeMonths(2026, []), '2026-11-25', 'dark', null)).toHaveLength(
      12,
    );
  });

  it('樹冠圓點數＝有記帳的天數', () => {
    expect(forest[0].canopy).toHaveLength(20);
    expect(forest[2].canopy).toHaveLength(1);
    expect(forest[9].canopy).toHaveLength(2);
  });

  it('狀態：未來月份是 sapling、過去沒記帳是 empty、有記帳是 grown', () => {
    expect(forest[0].state).toBe('grown');
    expect(forest[1].state).toBe('empty');
    expect(forest[1].canopy).toHaveLength(0);
    expect(forest[10].state).toBe('empty'); // 本月沒記帳
    expect(forest[11].state).toBe('sapling');
    expect(forest[11].expense).toBe(0);
  });

  it('樹高隨記帳天數增加', () => {
    const lowest = forest[2].height;
    expect(forest[0].height).toBeGreaterThan(lowest);
    const full = summarizeMonths(
      2026,
      txs(
        Array.from({ length: daysInMonth({ year: 2026, month: 1 }) }, (_, i): [string, number] => [
          `2026-01-${String(i + 1).padStart(2, '0')}`,
          10,
        ]),
      ),
    );
    const fullTree = buildForest(2026, full, '2026-11-25', 'light', null)[0];
    expect(fullTree.height).toBeCloseTo(96, 5);
  });

  it('月支出帶到樹上', () => {
    expect(forest[9].expense).toBe(3300);
  });

  it('所有座標都在畫布內', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const tree of buildForest(2026, months, '2026-11-25', scheme, 30000)) {
        expect(tree.cx).toBeGreaterThan(0);
        expect(tree.cx).toBeLessThan(360);
        expect(tree.baseY).toBeLessThanOrEqual(560);
        expect(tree.baseY - tree.height).toBeGreaterThanOrEqual(0);
        for (const dot of tree.canopy) {
          expect(dot.x - dot.r).toBeGreaterThanOrEqual(0);
          expect(dot.x + dot.r).toBeLessThanOrEqual(360);
          expect(dot.y - dot.r).toBeGreaterThanOrEqual(0);
          expect(dot.y + dot.r).toBeLessThanOrEqual(560);
          expect(dot.color).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
  });

  it('12 棵樹排成 3 欄 4 列', () => {
    expect(new Set(forest.map((t) => t.cx)).size).toBe(3);
    expect(new Set(forest.map((t) => t.baseY)).size).toBe(4);
    expect(forest[0].cx).toBeLessThan(forest[1].cx);
    expect(forest[3].baseY).toBeGreaterThan(forest[0].baseY);
  });

  it('支出高的日子顏色偏紅（有預算時以預算為準）', () => {
    // 10 月預算 31000 → 每天 1000；10/29 支出 3000 是 3 倍 → 紅色
    const tree = buildForest(2026, months, '2026-11-25', 'light', 31000)[9];
    expect(tree.canopy[1].color).toBe('#D9583B');
    expect(tree.canopy[0].color).not.toBe('#D9583B');
  });
});
