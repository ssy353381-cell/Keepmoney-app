import { addDays, toDateString } from '@/lib/date';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 金鑰「上次使用」的顯示文字（依裝置當地時間）：還沒用過、今天 HH:mm、昨天、M/D（跨年加年份） */
export function formatLastUsed(iso: string | null, now: Date): string {
  if (!iso) {
    return '還沒用過';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '還沒用過';
  }
  const today = toDateString(now);
  const day = toDateString(date);
  if (day === today) {
    return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (day === addDays(today, -1)) {
    return '昨天';
  }
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? monthDay : `${date.getFullYear()}/${monthDay}`;
}
