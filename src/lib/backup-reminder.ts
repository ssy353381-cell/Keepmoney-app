import { isValidDateString } from '@/lib/date';

/** 超過幾天沒備份就提醒 */
export const BACKUP_OVERDUE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD → 當天的 UTC 午夜毫秒數（只拿來算天數差，避開夏令時間造成的 23／25 小時） */
function dayNumber(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/**
 * 距離上次備份幾天（日期字串 YYYY-MM-DD）。
 * 沒有備份紀錄或日期格式不正確回傳 null；上次備份日期比今天還晚（手機時間被調整）當作 0 天。
 */
export function daysSince(lastBackupAt: string | null, today: string): number | null {
  if (lastBackupAt === null || !isValidDateString(lastBackupAt) || !isValidDateString(today)) {
    return null;
  }
  return Math.max(0, Math.round(dayNumber(today) - dayNumber(lastBackupAt)));
}

/** 備份提醒文字；overdue 為 true 時畫面用警告色 */
export function backupReminder(
  lastBackupAt: string | null,
  today: string,
): { text: string; overdue: boolean } {
  const days = daysSince(lastBackupAt, today);
  if (days === null) {
    return { text: '還沒有備份過', overdue: true };
  }
  if (days === 0) {
    return { text: '今天已備份', overdue: false };
  }
  return { text: `上次備份：${days} 天前`, overdue: days > BACKUP_OVERDUE_DAYS };
}
