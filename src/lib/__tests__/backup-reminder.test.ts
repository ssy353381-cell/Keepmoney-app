import { backupReminder, daysSince } from '@/lib/backup-reminder';

describe('daysSince', () => {
  it('沒有紀錄回傳 null', () => {
    expect(daysSince(null, '2026-11-26')).toBeNull();
  });

  it('同一天是 0，隔天是 1', () => {
    expect(daysSince('2026-11-26', '2026-11-26')).toBe(0);
    expect(daysSince('2026-11-25', '2026-11-26')).toBe(1);
  });

  it('跨月、跨年、閏年都算對', () => {
    expect(daysSince('2026-10-27', '2026-11-26')).toBe(30);
    expect(daysSince('2025-12-31', '2026-01-02')).toBe(2);
    expect(daysSince('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysSince('2025-11-26', '2026-11-26')).toBe(365);
  });

  it('跨夏令時間切換不會差一天', () => {
    expect(daysSince('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysSince('2026-10-30', '2026-11-02')).toBe(3);
  });

  it('日期比今天晚當作 0 天，格式錯誤回傳 null', () => {
    expect(daysSince('2026-12-01', '2026-11-26')).toBe(0);
    expect(daysSince('not-a-date', '2026-11-26')).toBeNull();
    expect(daysSince('2026-02-30', '2026-11-26')).toBeNull();
  });
});

describe('backupReminder', () => {
  it('還沒備份過', () => {
    expect(backupReminder(null, '2026-11-26')).toEqual({ text: '還沒有備份過', overdue: true });
  });

  it('今天已備份', () => {
    expect(backupReminder('2026-11-26', '2026-11-26')).toEqual({
      text: '今天已備份',
      overdue: false,
    });
  });

  it('30 天內不算逾期，第 31 天起逾期', () => {
    expect(backupReminder('2026-11-25', '2026-11-26')).toEqual({
      text: '上次備份：1 天前',
      overdue: false,
    });
    expect(backupReminder('2026-10-27', '2026-11-26')).toEqual({
      text: '上次備份：30 天前',
      overdue: false,
    });
    expect(backupReminder('2026-10-26', '2026-11-26')).toEqual({
      text: '上次備份：31 天前',
      overdue: true,
    });
  });
});
