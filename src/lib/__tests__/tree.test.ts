import { calendarDays, daysInMonth, type Month } from '@/lib/date';
import { summarizeDays, type SummaryTransaction } from '@/lib/daily-summary';
import { buildTree, hitTestLeaf, leafCenter } from '@/lib/tree';

function dayMap(dates: string[]) {
  const txs: SummaryTransaction[] = dates.map((date, i) => ({
    id: `t${i}`,
    type: 'expense',
    amount: 100 + i * 50,
    occurred_on: date,
    created_at: `${date}T10:00:00+00:00`,
  }));
  return summarizeDays(txs);
}

const FAR_FUTURE = '2099-12-31';

describe('buildTree', () => {
  it.each([
    [{ year: 2026, month: 2 }, 28],
    [{ year: 2028, month: 2 }, 29],
    [{ year: 2026, month: 4 }, 30],
    [{ year: 2026, month: 10 }, 31],
  ] as [Month, number][])('每天一片葉子（%o 共 %i 天）', (month, days) => {
    const tree = buildTree(month, new Map(), FAR_FUTURE);
    expect(tree.leaves).toHaveLength(days);
    expect(tree.leaves.map((l) => l.date)).toEqual(
      calendarDays(month).filter((d): d is string => d !== null),
    );
    expect(days).toBe(daysInMonth(month));
  });

  it('2 月 1 日剛好是週日（4 週）有 4 根枝，6 週的月份有 6 根枝', () => {
    // 2026/2/1 是週日、共 28 天 → 正好 4 週
    expect(buildTree({ year: 2026, month: 2 }, new Map(), FAR_FUTURE).branches).toHaveLength(4);
    // 2026/8/1 是週六、31 天 → 6 週
    expect(buildTree({ year: 2026, month: 8 }, new Map(), FAR_FUTURE).branches).toHaveLength(6);
    expect(buildTree({ year: 2026, month: 10 }, new Map(), FAR_FUTURE).branches).toHaveLength(5);
  });

  it('樹幹與樹枝都有路徑，畫布大小固定', () => {
    const tree = buildTree({ year: 2026, month: 10 }, new Map(), FAR_FUTURE);
    expect(tree.width).toBe(360);
    expect(tree.height).toBe(440);
    expect(tree.trunk).toMatch(/^M.*Z$/);
    expect(tree.branches.every((b) => b.startsWith('M180,'))).toBe(true);
  });

  it('第 1 週的枝在最下面往右，之後左右交錯、往上排', () => {
    const tree = buildTree({ year: 2026, month: 10 }, new Map(), FAR_FUTURE);
    const parsed = tree.branches.map((b) => {
      const nums = b.match(/-?\d+(\.\d+)?/g)!.map(Number);
      return { startY: nums[1], endX: nums[4] };
    });
    expect(parsed[0].endX).toBeGreaterThan(180);
    expect(parsed[1].endX).toBeLessThan(180);
    expect(parsed[2].endX).toBeGreaterThan(180);
    for (let i = 1; i < parsed.length; i++) {
      expect(parsed[i].startY).toBeLessThan(parsed[i - 1].startY);
    }
  });

  it.each([2, 8, 10])('%i 月所有葉子（含葉尖）都在畫布內', (monthNumber) => {
    const month = { year: 2026, month: monthNumber };
    const all = calendarDays(month).filter((d): d is string => d !== null);
    const tree = buildTree(month, dayMap(all), FAR_FUTURE);
    for (const leaf of tree.leaves) {
      const length = 100 * Math.max(leaf.scale, 0.24);
      const rad = (leaf.rotation * Math.PI) / 180;
      const tipX = leaf.x + Math.sin(rad) * length;
      const tipY = leaf.y - Math.cos(rad) * length;
      for (const [x, y] of [
        [leaf.x, leaf.y],
        [tipX, tipY],
      ]) {
        expect(x).toBeGreaterThanOrEqual(8);
        expect(x).toBeLessThanOrEqual(352);
        expect(y).toBeGreaterThanOrEqual(8);
        expect(y).toBeLessThanOrEqual(432);
      }
    }
  });

  it('今天之後是 future（不畫葉），今天標記 isToday，沒記帳的過去是 bud', () => {
    const month = { year: 2026, month: 10 };
    const tree = buildTree(month, dayMap(['2026-10-27', '2026-10-28']), '2026-10-28');
    const byDate = new Map(tree.leaves.map((l) => [l.date, l]));
    expect(byDate.get('2026-10-29')?.state).toBe('future');
    expect(byDate.get('2026-10-29')?.scale).toBe(0);
    expect(byDate.get('2026-10-31')?.state).toBe('future');
    expect(byDate.get('2026-10-28')?.isToday).toBe(true);
    expect(byDate.get('2026-10-28')?.state).toBe('leaf');
    expect(byDate.get('2026-10-27')?.isToday).toBe(false);
    expect(byDate.get('2026-10-15')?.state).toBe('bud');
    expect(byDate.get('2026-10-15')?.summary).toBeNull();
    expect(tree.leaves.filter((l) => l.isToday)).toHaveLength(1);
  });

  it('今天沒記帳是小芽但仍標記 isToday', () => {
    const tree = buildTree({ year: 2026, month: 10 }, new Map(), '2026-10-28');
    const today = tree.leaves.find((l) => l.date === '2026-10-28');
    expect(today?.state).toBe('bud');
    expect(today?.isToday).toBe(true);
  });

  it('有記帳的葉子大小在 0.24～0.34 之間，金額越大越大', () => {
    const map = dayMap(['2026-10-01', '2026-10-02', '2026-10-03']);
    const tree = buildTree({ year: 2026, month: 10 }, map, FAR_FUTURE);
    const scales = ['2026-10-01', '2026-10-02', '2026-10-03'].map(
      (d) => tree.leaves.find((l) => l.date === d)!.scale,
    );
    for (const scale of scales) {
      expect(scale).toBeGreaterThanOrEqual(0.24);
      expect(scale).toBeLessThanOrEqual(0.34);
    }
    expect(scales[0]).toBeLessThan(scales[1]);
    expect(scales[1]).toBeLessThan(scales[2]);
    expect(scales[2]).toBeCloseTo(0.34, 5);
  });

  it('單數日在枝上方、雙數日在枝下方，葉柄離枝約 6px', () => {
    const tree = buildTree({ year: 2026, month: 11 }, new Map(), FAR_FUTURE);
    for (const leaf of tree.leaves) {
      const day = Number(leaf.date.slice(8));
      expect(Math.abs(leaf.rotation)).toBe(day % 2 === 1 ? 35 : 125);
      expect(Math.hypot(leaf.x - leaf.attachX, leaf.y - leaf.attachY)).toBeCloseTo(6, 1);
    }
  });

  it('樹枝接在 y≈405 到 y≈120，越上面越翹，並有裝飾小枝與填色枝外形', () => {
    const tree = buildTree({ year: 2026, month: 10 }, new Map(), FAR_FUTURE);
    const nums = tree.branches.map((b) => b.match(/-?\d+(\.\d+)?/g)!.map(Number));
    expect(nums[0][1]).toBe(405);
    expect(nums[nums.length - 1][1]).toBe(120);
    const rises = nums.map((n) => n[1] - n[5]);
    for (let i = 1; i < rises.length; i++) {
      expect(rises[i]).toBeGreaterThan(rises[i - 1]);
    }
    expect(tree.branchOutlines).toHaveLength(tree.branches.length);
    expect(tree.twigs.length).toBeGreaterThanOrEqual(1);
  });

  it('每一週的葉子越後面的星期越靠枝尖', () => {
    const tree = buildTree({ year: 2026, month: 11 }, new Map(), FAR_FUTURE);
    // 2026/11/1 是週日，第一週（往右）共 7 天
    const firstWeek = tree.leaves.slice(0, 7);
    for (let i = 1; i < 7; i++) {
      expect(firstWeek[i].x).toBeGreaterThan(firstWeek[i - 1].x);
    }
  });
});

describe('hitTestLeaf', () => {
  const month = { year: 2026, month: 10 };
  const all = calendarDays(month).filter((d): d is string => d !== null);
  const tree = buildTree(month, dayMap(all), '2026-10-20');

  it('點在葉子中心回傳那片葉子', () => {
    const target = tree.leaves.find((l) => l.date === '2026-10-10')!;
    const center = leafCenter(target);
    expect(hitTestLeaf(tree.leaves, center.x, center.y)?.date).toBe('2026-10-10');
  });

  it('點在兩片之間取比較近的', () => {
    const a = {
      ...tree.leaves[0],
      state: 'leaf' as const,
      x: 100,
      y: 100,
      rotation: 0,
      scale: 0.3,
    };
    const b = { ...a, date: 'b', x: 140 };
    const ca = leafCenter(a);
    expect(hitTestLeaf([a, b], ca.x + 12, ca.y)?.date).toBe(a.date);
    expect(hitTestLeaf([a, b], ca.x + 28, ca.y)?.date).toBe('b');
  });

  it('點太遠回傳 null', () => {
    expect(hitTestLeaf(tree.leaves, 0, 0)).toBeNull();
    const center = leafCenter(tree.leaves[0]);
    expect(hitTestLeaf([tree.leaves[0]], center.x + 40, center.y)).toBeNull();
    expect(hitTestLeaf([tree.leaves[0]], center.x + 40, center.y, 50)).not.toBeNull();
  });

  it('future 不會被選到', () => {
    const future = tree.leaves.find((l) => l.state === 'future')!;
    expect(future.date > '2026-10-20').toBe(true);
    const center = leafCenter(future);
    expect(hitTestLeaf([future], center.x, center.y)).toBeNull();
  });
});
