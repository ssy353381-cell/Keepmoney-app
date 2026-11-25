import { dailyReference, leafColor, spendingRatio } from '@/lib/leaf-color';

describe('dailyReference', () => {
  it('有總預算：預算除以當月天數', () => {
    expect(dailyReference(31000, 31, [5, 6])).toBe(1000);
  });

  it('沒有預算：有支出那幾天的中位數（忽略 0）', () => {
    expect(dailyReference(null, 30, [0, 100, 300, 200, 0])).toBe(200);
    expect(dailyReference(null, 30, [100, 200, 300, 400])).toBe(250);
  });

  it('預算為 0 視為沒有預算', () => {
    expect(dailyReference(0, 30, [100])).toBe(100);
  });

  it('都沒有回傳 null', () => {
    expect(dailyReference(null, 30, [])).toBeNull();
    expect(dailyReference(null, 30, [0, 0])).toBeNull();
  });
});

describe('spendingRatio', () => {
  it('支出除以參考額', () => {
    expect(spendingRatio(150, 100)).toBe(1.5);
    expect(spendingRatio(0, 100)).toBe(0);
  });

  it('參考額為 null 或 0 回傳 0', () => {
    expect(spendingRatio(100, null)).toBe(0);
    expect(spendingRatio(100, 0)).toBe(0);
  });
});

describe('leafColor', () => {
  it('色票節點', () => {
    expect(leafColor(0, 'light')).toBe('#7BC950');
    expect(leafColor(1, 'light')).toBe('#B9C93A');
    expect(leafColor(1.5, 'light')).toBe('#E8963A');
    expect(leafColor(2, 'light')).toBe('#D9583B');
  });

  it('小於 0 當成 0、大於 2 維持紅色', () => {
    expect(leafColor(-1, 'light')).toBe('#7BC950');
    expect(leafColor(5, 'light')).toBe('#D9583B');
    expect(leafColor(Number.NaN, 'light')).toBe('#7BC950');
  });

  it('節點之間線性內插', () => {
    // 0 與 1 的中點：(7B+B9)/2=9A、(C9+C9)/2=C9、(50+3A)/2=45
    expect(leafColor(0.5, 'light')).toBe('#9AC945');
  });

  it('一律回傳 #RRGGBB，亮暗色不同', () => {
    for (const ratio of [0, 0.3, 1.2, 1.8, 3]) {
      expect(leafColor(ratio, 'light')).toMatch(/^#[0-9A-F]{6}$/);
      expect(leafColor(ratio, 'dark')).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(leafColor(0, 'dark')).not.toBe(leafColor(0, 'light'));
  });
});
