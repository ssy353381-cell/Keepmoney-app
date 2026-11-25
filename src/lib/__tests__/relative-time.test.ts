import { formatLastUsed } from '@/lib/relative-time';

// 全部用當地時間建立，避免時區影響結果
const now = new Date(2026, 10, 25, 15, 30);

describe('formatLastUsed', () => {
  it('null 代表還沒用過', () => {
    expect(formatLastUsed(null, now)).toBe('還沒用過');
  });

  it('無法解析的字串視為還沒用過', () => {
    expect(formatLastUsed('abc', now)).toBe('還沒用過');
  });

  it('今天顯示時間', () => {
    expect(formatLastUsed(new Date(2026, 10, 25, 9, 5).toISOString(), now)).toBe('今天 09:05');
  });

  it('昨天', () => {
    expect(formatLastUsed(new Date(2026, 10, 24, 23, 59).toISOString(), now)).toBe('昨天');
  });

  it('更早顯示 M/D', () => {
    expect(formatLastUsed(new Date(2026, 9, 3, 12, 0).toISOString(), now)).toBe('10/3');
  });

  it('跨年加上年份', () => {
    expect(formatLastUsed(new Date(2025, 11, 31, 12, 0).toISOString(), now)).toBe('2025/12/31');
  });

  it('跨年的昨天（元旦看除夕）仍是昨天', () => {
    const newYear = new Date(2027, 0, 1, 8, 0);
    expect(formatLastUsed(new Date(2026, 11, 31, 20, 0).toISOString(), newYear)).toBe('昨天');
  });
});
