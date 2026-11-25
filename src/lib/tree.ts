import { calendarDays, isFutureDate, type Month } from '@/lib/date';
import type { DaySummary } from '@/lib/daily-summary';

/** 一個月＝一棵樹，每週一根樹枝，每天一片葉子。畫布 viewBox 為 0 0 360 440 */

export const TREE_WIDTH = 360;
export const TREE_HEIGHT = 440;

export type LeafPlacement = {
  date: string;
  /** 葉柄底部（離樹枝約 6px） */
  x: number;
  y: number;
  /** 接在樹枝上的點（畫小葉柄用） */
  attachX: number;
  attachY: number;
  /** 順時針角度，0 是葉尖朝正上方 */
  rotation: number;
  /** 葉子的縮放（葉長約為 100 × scale 像素） */
  scale: number;
  /** leaf：有記帳的葉子；bud：今天或過去沒記帳的小芽；future：今天之後，不畫也不能點 */
  state: 'leaf' | 'bud' | 'future';
  isToday: boolean;
  summary: DaySummary | null;
};

export type TreeShape = {
  width: 360;
  height: 440;
  trunk: string;
  /** 樹枝中心線（二次曲線），給測試與點擊用 */
  branches: string[];
  /** 樹枝的填色外形：靠樹幹粗、枝尖細 */
  branchOutlines: string[];
  /** 樹幹頂端的短小枝（純裝飾，用線條畫） */
  twigs: string[];
  leaves: LeafPlacement[];
};

const TRUNK_X = 180;
/** 第一週（最下面）與最後一週（最上面）樹枝接在樹幹的高度 */
const FIRST_BRANCH_Y = 405;
const LAST_BRANCH_Y = 120;
const BRANCH_REACH = 142;
/** 枝尖比枝根高多少：越上面的枝越往上翹 */
const MIN_RISE = 30;
const MAX_RISE = 70;
/** 枝的半寬：枝根 3、枝尖 1（線寬 6 → 2） */
const ROOT_HALF_WIDTH = 3;
const TIP_HALF_WIDTH = 1;
/** 一週裡第一天與最後一天在樹枝上的位置（0 是樹幹、1 是枝尖） */
const FIRST_DAY_AT = 0.18;
const LAST_DAY_AT = 0.98;
/** 葉柄底部離樹枝的距離 */
const STEM_OFFSET = 6;
const ABOVE_ROTATION = 35;
const BELOW_ROTATION = 125;

const BUD_SCALE = 0.13;
const MIN_LEAF_SCALE = 0.24;
const LEAF_SCALE_RANGE = 0.1;

/** 樹幹：底部半寬 12 並向外擴成樹根，頂端半寬 3，兩側略成 S 形、不完全對稱 */
const TRUNK_PATH =
  'M164,438 Q171,432 168,416 C164,340 173,240 177,100 L183,100 ' +
  'C190,240 196,330 192,416 Q190,432 199,438 Z';

/** 樹幹頂端的裝飾小枝 */
const TWIGS = ['M180,106 Q190,92 206,80', 'M179,114 Q168,100 156,92'];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 二次貝茲曲線上 t 處的點 */
function quadPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  };
}

/** 二次貝茲曲線上 t 處的單位切線 */
function quadTangent(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  t: number,
): { x: number; y: number } {
  const x = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const y = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** 往上那一側的單位法線 */
function upNormal(tangent: { x: number; y: number }, side: 1 | -1): { x: number; y: number } {
  return side > 0 ? { x: tangent.y, y: -tangent.x } : { x: -tangent.y, y: tangent.x };
}

/** 沿著樹枝取樣、依寬度變化做成填色多邊形 */
function branchOutline(p0: [number, number], p1: [number, number], p2: [number, number]): string {
  const steps = 10;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = quadPoint(p0, p1, p2, t);
    const n = upNormal(quadTangent(p0, p1, p2, t), 1);
    const half = ROOT_HALF_WIDTH + (TIP_HALF_WIDTH - ROOT_HALF_WIDTH) * t;
    left.push(`${round(point.x + n.x * half)},${round(point.y + n.y * half)}`);
    right.push(`${round(point.x - n.x * half)},${round(point.y - n.y * half)}`);
  }
  return `M${left.join(' L')} L${right.reverse().join(' L')} Z`;
}

/** 葉子的重量：支出與收入加總後取平方根，避免一筆大額把其他葉子都壓得很小 */
function dayWeight(day: DaySummary): number {
  return Math.sqrt(day.expense + day.income);
}

export function buildTree(month: Month, days: Map<string, DaySummary>, today: string): TreeShape {
  const cells = calendarDays(month);
  const weekCount = cells.length / 7;

  let maxWeight = 0;
  for (const cell of cells) {
    const day = cell ? days.get(cell) : undefined;
    if (day && day.count > 0) {
      maxWeight = Math.max(maxWeight, dayWeight(day));
    }
  }

  const branches: string[] = [];
  const branchOutlines: string[] = [];
  const leaves: LeafPlacement[] = [];

  for (let week = 0; week < weekCount; week++) {
    const side = week % 2 === 0 ? 1 : -1;
    const progress = weekCount === 1 ? 0 : week / (weekCount - 1);
    const baseY = FIRST_BRANCH_Y - (FIRST_BRANCH_Y - LAST_BRANCH_Y) * progress;
    const rise = MIN_RISE + (MAX_RISE - MIN_RISE) * progress;
    const start: [number, number] = [TRUNK_X, baseY];
    const control: [number, number] = [TRUNK_X + side * BRANCH_REACH * 0.55, baseY - rise * 0.15];
    const end: [number, number] = [TRUNK_X + side * BRANCH_REACH, baseY - rise];
    branches.push(
      `M${start[0]},${round(start[1])} Q${round(control[0])},${round(control[1])} ${round(end[0])},${round(end[1])}`,
    );

    branchOutlines.push(branchOutline(start, control, end));

    for (let weekday = 0; weekday < 7; weekday++) {
      const date = cells[week * 7 + weekday];
      if (!date) {
        continue;
      }
      const at = FIRST_DAY_AT + ((LAST_DAY_AT - FIRST_DAY_AT) * weekday) / 6;
      const point = quadPoint(start, control, end, at);
      // 單數日（1、3、5…號）長在枝上方朝外上，雙數日在枝下方朝外下像垂下的葉子
      const above = Number(date.slice(8)) % 2 === 1;
      const normal = upNormal(quadTangent(start, control, end, at), side);
      const dir = above ? 1 : -1;
      const rotation = side * (above ? ABOVE_ROTATION : BELOW_ROTATION);
      const baseX = point.x + normal.x * STEM_OFFSET * dir;
      const y = point.y + normal.y * STEM_OFFSET * dir;

      const summary = days.get(date) ?? null;
      const hasRecord = summary !== null && summary.count > 0;
      const future = isFutureDate(date, today);
      const state: LeafPlacement['state'] = future ? 'future' : hasRecord ? 'leaf' : 'bud';
      const relative = hasRecord && maxWeight > 0 ? dayWeight(summary) / maxWeight : 0;
      const scale =
        state === 'leaf'
          ? MIN_LEAF_SCALE + LEAF_SCALE_RANGE * relative
          : state === 'bud'
            ? BUD_SCALE
            : 0;

      leaves.push({
        date,
        x: round(baseX),
        y: round(y),
        attachX: round(point.x),
        attachY: round(point.y),
        rotation,
        scale: round(scale * 1000) / 1000,
        state,
        isToday: date === today,
        summary: hasRecord ? summary : null,
      });
    }
  }

  return {
    width: TREE_WIDTH,
    height: TREE_HEIGHT,
    trunk: TRUNK_PATH,
    branches,
    branchOutlines,
    twigs: TWIGS,
    leaves,
  };
}

/** 葉子中心（葉柄位置沿 rotation 方向往外 scale*50） */
export function leafCenter(leaf: LeafPlacement): { x: number; y: number } {
  const rad = (leaf.rotation * Math.PI) / 180;
  return {
    x: leaf.x + Math.sin(rad) * 50 * leaf.scale,
    y: leaf.y - Math.cos(rad) * 50 * leaf.scale,
  };
}

/** 點擊位置（viewBox 座標）最近的葉子或小芽；future 不會被選到，太遠回傳 null */
export function hitTestLeaf(
  leaves: LeafPlacement[],
  x: number,
  y: number,
  maxDistance = 28,
): LeafPlacement | null {
  let best: LeafPlacement | null = null;
  let bestDistance = maxDistance;
  for (const leaf of leaves) {
    if (leaf.state === 'future') {
      continue;
    }
    const center = leafCenter(leaf);
    const distance = Math.hypot(center.x - x, center.y - y);
    if (distance <= bestDistance) {
      best = leaf;
      bestDistance = distance;
    }
  }
  return best;
}
