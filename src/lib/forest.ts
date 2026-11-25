import { daysInMonth } from '@/lib/date';
import type { MonthSummaryLite } from '@/lib/daily-summary';
import { dailyReference, leafColor, spendingRatio } from '@/lib/leaf-color';

/** 一年＝一座森林，12 棵樹依月份排成 3 欄 × 4 列。畫布 viewBox 為 0 0 360 560 */

export const FOREST_WIDTH = 360;
export const FOREST_HEIGHT = 560;
export const FOREST_COLUMNS = 3;
export const FOREST_ROWS = 4;
export const FOREST_CELL_WIDTH = FOREST_WIDTH / FOREST_COLUMNS;
export const FOREST_CELL_HEIGHT = FOREST_HEIGHT / FOREST_ROWS;

/** 每格上方留給樹的高度，下方留給月份與金額文字 */
const TREE_AREA = 96;
const GROUND_OFFSET = 100;
const DOT_RADIUS = 5;
const GOLDEN_ANGLE = 2.399963229728653;

export type ForestTree = {
  month: number;
  /** 樹幹中心 x */
  cx: number;
  /** 樹根（地面）y */
  baseY: number;
  height: number;
  trunk: string;
  canopy: { x: number; y: number; r: number; color: string }[];
  state: 'grown' | 'sapling' | 'empty';
  label: string;
  expense: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function trunkPath(cx: number, baseY: number, trunkHeight: number): string {
  const top = baseY - trunkHeight;
  return (
    `M${round(cx - 3.5)},${round(baseY)} L${round(cx - 1.75)},${round(top)} ` +
    `L${round(cx + 1.75)},${round(top)} L${round(cx + 3.5)},${round(baseY)} Z`
  );
}

export function buildForest(
  year: number,
  months: MonthSummaryLite[],
  today: string,
  scheme: 'light' | 'dark',
  monthBudget: number | null,
): ForestTree[] {
  const [todayYear, todayMonth] = today.split('-').map(Number);
  const todayIndex = todayYear * 12 + todayMonth;

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const summary = months.find((m) => m.month === month);
    const recordedDays = summary?.recordedDays ?? 0;
    const days = summary?.days ?? [];
    const dim = daysInMonth({ year, month });

    const column = index % FOREST_COLUMNS;
    const row = Math.floor(index / FOREST_COLUMNS);
    const cx = column * FOREST_CELL_WIDTH + FOREST_CELL_WIDTH / 2;
    const baseY = row * FOREST_CELL_HEIGHT + GROUND_OFFSET;

    const isFuture = year * 12 + month > todayIndex;
    const state: ForestTree['state'] = isFuture ? 'sapling' : recordedDays > 0 ? 'grown' : 'empty';
    const base = { month, cx, baseY, label: `${month}月`, expense: summary?.expense ?? 0, state };

    if (state === 'sapling') {
      const height = round(TREE_AREA * 0.3);
      const color = leafColor(0, scheme);
      return {
        ...base,
        height,
        trunk: trunkPath(cx, baseY, height * 0.7),
        canopy: [
          { x: round(cx - 5), y: round(baseY - height * 0.7), r: 4, color },
          { x: round(cx + 5), y: round(baseY - height * 0.85), r: 4, color },
        ],
      };
    }

    const height = round(TREE_AREA * (0.5 + (0.5 * recordedDays) / dim));
    if (state === 'empty') {
      return { ...base, height, trunk: trunkPath(cx, baseY, height * 0.7), canopy: [] };
    }

    // 樹冠：每個有記帳的日子一個圓點，用黃金角螺旋排在樹幹頂端的橢圓內
    const trunkHeight = height * 0.5;
    const ry = height * 0.325;
    const rx = Math.min(46, ry * 1.4 + 8);
    const centerY = baseY - height + ry;
    const reference = dailyReference(
      monthBudget,
      dim,
      days.map((d) => d.expense),
    );
    const canopy = days.map((day, i) => {
      const distance = Math.sqrt((i + 0.5) / days.length);
      const angle = i * GOLDEN_ANGLE;
      return {
        x: round(cx + (rx - DOT_RADIUS) * distance * Math.cos(angle)),
        y: round(centerY + (ry - DOT_RADIUS) * distance * Math.sin(angle)),
        r: DOT_RADIUS,
        color: leafColor(spendingRatio(day.expense, reference), scheme),
      };
    });
    return { ...base, height, trunk: trunkPath(cx, baseY, trunkHeight), canopy };
  });
}
