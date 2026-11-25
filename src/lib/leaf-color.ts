/** 葉子的顏色：當天支出相對於「每日參考額」越高，就從嫩綠變黃、橘、紅（秋葉） */

type Scheme = 'light' | 'dark';
type Stop = { ratio: number; color: string };

const STOPS: Record<Scheme, Stop[]> = {
  light: [
    { ratio: 0, color: '#7BC950' },
    { ratio: 1, color: '#B9C93A' },
    { ratio: 1.5, color: '#E8963A' },
    { ratio: 2, color: '#D9583B' },
  ],
  dark: [
    { ratio: 0, color: '#68B340' },
    { ratio: 1, color: '#A6B52F' },
    { ratio: 1.5, color: '#D98530' },
    { ratio: 2, color: '#CC5038' },
  ],
};

/** 葉脈顏色：支出是深綠褐、收入是金色 */
export const VEIN_COLORS: Record<Scheme, { expense: string; income: string }> = {
  light: { expense: '#3F5A2B', income: '#E8B931' },
  dark: { expense: '#1E3512', income: '#F2C94C' },
};

/** 主脈顏色 */
export const MIDRIB_COLORS: Record<Scheme, string> = {
  light: '#4A6B30',
  dark: '#25421A',
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * 每日參考額：有每月總預算就用「預算 ÷ 當月天數」，
 * 沒有就用有支出那幾天的中位數；兩者都沒有回傳 null
 */
export function dailyReference(
  monthBudget: number | null,
  daysInMonth: number,
  dayExpenses: number[],
): number | null {
  if (monthBudget !== null && monthBudget > 0 && daysInMonth > 0) {
    return monthBudget / daysInMonth;
  }
  const nonZero = dayExpenses.filter((amount) => amount > 0);
  return nonZero.length > 0 ? median(nonZero) : null;
}

/** 支出相對參考額的比例；沒有參考額（或為 0）時回傳 0 */
export function spendingRatio(expense: number, reference: number | null): number {
  if (reference === null || reference <= 0 || expense <= 0) {
    return 0;
  }
  return expense / reference;
}

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, '0').toUpperCase();
}

/** 比例對應的葉子顏色（色票之間做 RGB 線性內插），回傳 #RRGGBB */
export function leafColor(ratio: number, scheme: Scheme): string {
  const stops = STOPS[scheme];
  const value = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
  const last = stops[stops.length - 1];
  if (value >= last.ratio) {
    return last.color;
  }
  for (let i = 1; i < stops.length; i++) {
    const to = stops[i];
    if (value <= to.ratio) {
      const from = stops[i - 1];
      const t = (value - from.ratio) / (to.ratio - from.ratio);
      const a = parseHex(from.color);
      const b = parseHex(to.color);
      return `#${[0, 1, 2].map((k) => toHex(a[k] + (b[k] - a[k]) * t)).join('')}`;
    }
  }
  return last.color;
}
