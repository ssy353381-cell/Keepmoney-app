import Svg, { G, Path } from 'react-native-svg';

import type { DayItem } from '@/lib/daily-summary';
import { MIDRIB_COLORS, VEIN_COLORS } from '@/lib/leaf-color';
import { buildLeaf, type LeafShape } from '@/lib/leaf';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type LeafGlyphProps = {
  shape: LeafShape;
  /** 葉面顏色 */
  color: string;
  /** 本地座標下的位置（葉柄底部）、順時針角度與縮放 */
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
  /** 脈的線寬，單位是 G 外面（Svg 畫布）的座標；會依縮放換算成葉子的本地座標 */
  lineWidth?: number;
};

/** 在 Svg 裡畫一片葉子（給樹與大葉子共用的 G） */
export function LeafGlyph({
  shape,
  color,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
  lineWidth = 1.5,
}: LeafGlyphProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const veinColors = VEIN_COLORS[scheme];
  const local = scale > 0 ? lineWidth / scale : lineWidth;

  return (
    <G transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
      <Path d={shape.stem} stroke={theme.leafOutline} strokeWidth={local * 1.4} fill="none" />
      <Path
        d={shape.outline}
        fill={color}
        stroke={theme.leafOutline}
        strokeWidth={local * 0.8}
        strokeLinejoin="round"
      />
      <Path d={shape.midrib} stroke={MIDRIB_COLORS[scheme]} strokeWidth={local} fill="none" />
      {shape.veins.map((vein) => (
        <Path
          key={vein.itemId}
          d={vein.d}
          stroke={veinColors[vein.kind]}
          strokeWidth={local}
          strokeLinecap="round"
          strokeDasharray={vein.dashed ? [local * 3, local * 2.5] : undefined}
          fill="none"
        />
      ))}
    </G>
  );
}

type LeafSvgProps = {
  items: DayItem[];
  color: string;
  /** 整張圖的高度（像素） */
  size: number;
};

// 本地座標的可見範圍：x ±50、y 從葉尖到葉柄下方一小段
const VIEW = { x: -50, y: -108, width: 100, height: 128 };

/** 單獨畫一片大葉子：葉上每一條側脈是當天的一筆支出（實線）或收入（金色） */
export function LeafSvg({ items, color, size }: LeafSvgProps) {
  const shape = buildLeaf(items);
  const width = (size * VIEW.width) / VIEW.height;
  return (
    <Svg
      width={width}
      height={size}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      accessibilityLabel={`一片葉子，共 ${items.length} 條紋路`}>
      <LeafGlyph shape={shape} color={color} lineWidth={1.4} />
    </Svg>
  );
}
