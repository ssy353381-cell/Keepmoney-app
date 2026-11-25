import type { DayItem } from '@/lib/daily-summary';
import { buildLeaf, leafHalfWidth, leafOutlinePath } from '@/lib/leaf';

function items(amounts: number[], type: DayItem['type'] = 'expense'): DayItem[] {
  return amounts.map((amount, i) => ({
    id: `item-${i}`,
    type,
    amount,
    createdAt: `2026-10-28T${String(i % 24).padStart(2, '0')}:00:00+00:00`,
  }));
}

describe('leafHalfWidth', () => {
  it('葉柄與葉尖是 0，中段約在 ±40', () => {
    expect(leafHalfWidth(0)).toBe(0);
    expect(leafHalfWidth(1)).toBe(0);
    expect(leafHalfWidth(0.45)).toBeGreaterThan(38);
    expect(leafHalfWidth(0.45)).toBeLessThan(44);
  });

  it('最寬處在中段，往兩端變窄', () => {
    expect(leafHalfWidth(0.1)).toBeLessThan(leafHalfWidth(0.3));
    expect(leafHalfWidth(0.9)).toBeLessThan(leafHalfWidth(0.6));
  });
});

describe('leafOutlinePath', () => {
  it('是封閉路徑', () => {
    expect(leafOutlinePath()).toMatch(/^M0,0 C.*Z$/);
  });
});

describe('buildLeaf', () => {
  it('0 筆沒有側脈', () => {
    const leaf = buildLeaf([]);
    expect(leaf.veins).toEqual([]);
    expect(leaf.outline).toBe(leafOutlinePath());
    expect(leaf.midrib).toBeTruthy();
    expect(leaf.stem).toBeTruthy();
  });

  it('1 筆放在中間、第一筆在右邊', () => {
    const leaf = buildLeaf(items([100]));
    expect(leaf.veins).toHaveLength(1);
    expect(leaf.veins[0].side).toBe(1);
    expect(leaf.veins[0].d.startsWith('M0,-50 Q')).toBe(true);
    expect(leaf.veins[0].ratio).toBe(1);
  });

  it('多筆左右交錯，由葉柄往葉尖排開', () => {
    const leaf = buildLeaf(items([10, 20, 30, 40, 50]));
    expect(leaf.veins.map((v) => v.side)).toEqual([1, -1, 1, -1, 1]);
    const startYs = leaf.veins.map((v) => Number(v.d.split(/[M, ]/)[2]));
    expect(startYs[0]).toBeCloseTo(-18, 5);
    expect(startYs[4]).toBeCloseTo(-82, 5);
    for (let i = 1; i < startYs.length; i++) {
      expect(startYs[i]).toBeLessThan(startYs[i - 1]);
    }
  });

  it('金額最大那筆的長度比例最大，其他都較短但至少 0.35', () => {
    const leaf = buildLeaf(items([10, 400, 90]));
    const ratios = leaf.veins.map((v) => v.ratio);
    expect(ratios[1]).toBe(1);
    expect(ratios[0]).toBeGreaterThanOrEqual(0.35);
    expect(ratios[0]).toBeLessThan(ratios[2]);
    expect(ratios[2]).toBeLessThan(ratios[1]);
  });

  it('側脈終點都在葉子半寬以內', () => {
    for (const count of [1, 2, 8, 30]) {
      const amounts = Array.from({ length: count }, (_, i) => (i + 1) * 37);
      const leaf = buildLeaf(items(amounts));
      expect(leaf.veins).toHaveLength(count);
      leaf.veins.forEach((vein, i) => {
        const t = count === 1 ? 0.5 : 0.18 + (0.64 * i) / (count - 1);
        expect(Math.abs(vein.end.x)).toBeLessThanOrEqual(leafHalfWidth(t) + 1e-6);
        const endT = -vein.end.y / 100;
        expect(Math.abs(vein.end.x)).toBeLessThanOrEqual(leafHalfWidth(endT) + 1e-6);
        expect(vein.end.y).toBeGreaterThan(-100);
      });
    }
  });

  it('30 筆不會爆掉，間距自動縮小', () => {
    const leaf = buildLeaf(items(Array.from({ length: 30 }, () => 50)));
    expect(leaf.veins).toHaveLength(30);
    const ys = leaf.veins.map((v) => Number(v.d.split(/[M, ]/)[2]));
    expect(ys[0] - ys[29]).toBeCloseTo(64, 5);
  });

  it('收入、待確認的標記帶到側脈上', () => {
    const leaf = buildLeaf([
      { id: 'a', type: 'income', amount: 10, createdAt: '2026-10-28T01:00:00Z' },
      {
        id: 'b',
        type: 'expense',
        amount: 10,
        createdAt: '2026-10-28T02:00:00Z',
        needsReview: true,
      },
    ]);
    expect(leaf.veins.map((v) => v.kind)).toEqual(['income', 'expense']);
    expect(leaf.veins.map((v) => v.dashed)).toEqual([false, true]);
    expect(leaf.veins.map((v) => v.itemId)).toEqual(['a', 'b']);
  });
});
