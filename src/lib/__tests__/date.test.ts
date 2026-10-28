import {
  addDays,
  formatDayHeader,
  isValidDateString,
  monthOf,
  monthRange,
  shiftMonth,
  toDateString,
} from '@/lib/date';

describe('toDateString', () => {
  it('使用當地時間而不是 UTC', () => {
    // 當地時間 2026/10/28 凌晨 1 點，UTC 可能還是 27 日
    expect(toDateString(new Date(2026, 9, 28, 1, 0))).toBe('2026-10-28');
  });
});

describe('monthRange', () => {
  it('回傳當月第一天與最後一天', () => {
    expect(monthRange({ year: 2026, month: 10 })).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
    });
    expect(monthRange({ year: 2028, month: 2 })).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });
});

describe('shiftMonth', () => {
  it('跨年', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('monthOf / addDays', () => {
  it('從日期字串取得月份、加減天數', () => {
    expect(monthOf('2026-10-28')).toEqual({ year: 2026, month: 10 });
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('isValidDateString', () => {
  it('檢查格式與日期是否存在', () => {
    expect(isValidDateString('2026-10-28')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026/10/28')).toBe(false);
  });
});

describe('formatDayHeader', () => {
  it('今天、昨天與其他日期', () => {
    expect(formatDayHeader('2026-10-28', '2026-10-28')).toBe('今天');
    expect(formatDayHeader('2026-10-27', '2026-10-28')).toBe('昨天');
    expect(formatDayHeader('2026-10-20', '2026-10-28')).toBe('10月20日 週二');
  });
});
