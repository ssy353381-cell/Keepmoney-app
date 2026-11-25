import type { DayItem } from '@/lib/daily-summary';

/**
 * 一片葉子的形狀（本地座標）：葉柄底部在 (0,0)，葉尖在 (0,-100)，
 * 最寬約 ±40（約在 45% 高度）。一天一片葉，當天每一筆收支畫成一條側脈。
 */

export type Vein = {
  d: string;
  side: -1 | 1;
  kind: 'expense' | 'income';
  dashed: boolean;
  itemId: string;
  /** 長度比例（0.35～1），金額最大的那筆是 1 */
  ratio: number;
  /** 側脈終點（本地座標） */
  end: { x: number; y: number };
};

export type LeafShape = { outline: string; stem: string; midrib: string; veins: Vein[] };

// 外框是兩段三次貝茲曲線（右半邊與其左右鏡像）
const RIGHT = { c1: [52, -18], c2: [56, -66], end: [0, -100] } as const;

/** 葉子的高度（本地座標） */
export const LEAF_HEIGHT = 100;

export function leafOutlinePath(): string {
  const { c1, c2, end } = RIGHT;
  return (
    `M0,0 C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${end[0]},${end[1]} ` +
    `C${-c2[0]},${c2[1]} ${-c1[0]},${c1[1]} 0,0 Z`
  );
}

// 預先取樣右半邊外框：heights[i] 是高度比例（0～1），widths[i] 是該處半寬
const SAMPLES = 128;
const heights: number[] = [];
const widths: number[] = [];
for (let i = 0; i <= SAMPLES; i++) {
  const u = i / SAMPLES;
  const a = 3 * (1 - u) * (1 - u) * u;
  const b = 3 * (1 - u) * u * u;
  const c = u * u * u;
  widths.push(a * RIGHT.c1[0] + b * RIGHT.c2[0] + c * RIGHT.end[0]);
  heights.push(-(a * RIGHT.c1[1] + b * RIGHT.c2[1] + c * RIGHT.end[1]) / LEAF_HEIGHT);
}

/** t=0 葉柄、t=1 葉尖，回傳該高度的半寬（與外框一致） */
export function leafHalfWidth(t: number): number {
  if (t <= 0 || t >= 1) {
    return 0;
  }
  // 高度隨取樣點遞增，找到 t 落在哪一段後線性內插
  let low = 0;
  let high = SAMPLES;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (heights[mid] <= t) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const span = heights[high] - heights[low];
  const k = span > 0 ? (t - heights[low]) / span : 0;
  return widths[low] + (widths[high] - widths[low]) * k;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

const FIRST_VEIN_T = 0.18;
const LAST_VEIN_T = 0.82;

export function buildLeaf(items: DayItem[]): LeafShape {
  const maxAmount = items.reduce((max, item) => Math.max(max, item.amount), 0);
  const veins: Vein[] = items.map((item, index) => {
    const t =
      items.length === 1
        ? 0.5
        : FIRST_VEIN_T + ((LAST_VEIN_T - FIRST_VEIN_T) * index) / (items.length - 1);
    const side: -1 | 1 = index % 2 === 0 ? 1 : -1;
    const ratio = maxAmount > 0 ? 0.35 + 0.65 * Math.sqrt(item.amount / maxAmount) : 0.35;
    const startY = -LEAF_HEIGHT * t;
    const endY = startY - ratio * 14;
    // 終點不能超出外框：用終點高度的半寬再限制一次
    const endT = Math.min(0.97, -endY / LEAF_HEIGHT);
    const reach = Math.min(ratio * leafHalfWidth(t), leafHalfWidth(endT)) * 0.9;
    const endX = side * reach;
    // 控制點讓脈先橫向再往葉尖彎
    const controlX = endX * 0.55;
    const controlY = startY - ratio * 3;
    return {
      d: `M0,${round(startY)} Q${round(controlX)},${round(controlY)} ${round(endX)},${round(endY)}`,
      side,
      kind: item.type,
      dashed: item.needsReview === true,
      itemId: item.id,
      ratio,
      end: { x: round(endX), y: round(endY) },
    };
  });

  return {
    outline: leafOutlinePath(),
    stem: 'M0,16 Q2,8 0,0',
    midrib: 'M0,0 L0,-94',
    veins,
  };
}
