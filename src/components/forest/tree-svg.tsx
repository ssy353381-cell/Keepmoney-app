import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

import { LeafGlyph } from '@/components/forest/leaf-svg';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import type { DaySummary } from '@/lib/daily-summary';
import type { Month } from '@/lib/date';
import { buildLeaf, leafOutlinePath, type LeafShape } from '@/lib/leaf';
import { dailyReference, leafColor, spendingRatio } from '@/lib/leaf-color';
import { daysInMonth } from '@/lib/date';
import { buildTree, hitTestLeaf, TREE_HEIGHT, TREE_WIDTH } from '@/lib/tree';

type TreeSvgProps = {
  month: Month;
  /** 有記帳的日子（可以包含整年，只會用到這個月的） */
  days: Map<string, DaySummary>;
  today: string;
  /** 每月總預算；沒有設定傳 null */
  monthBudget: number | null;
  onPressDay: (date: string) => void;
};

const BUD_PATH = leafOutlinePath();

/** 一個月的樹：每週一根樹枝，每天一片葉子；點葉子（或小芽）看那一天 */
export function TreeSvg({ month, days, today, monthBudget, onPressDay }: TreeSvgProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [width, setWidth] = useState(0);

  const tree = useMemo(() => buildTree(month, days, today), [month, days, today]);

  // 每片葉子的形狀與顏色（同一個月用同一個每日參考額，顏色才能互相比較）
  const drawn = useMemo(() => {
    const expenses = tree.leaves.map((l) => l.summary?.expense ?? 0);
    const reference = dailyReference(monthBudget, daysInMonth(month), expenses);
    return new Map<string, { shape: LeafShape; color: string }>(
      tree.leaves
        .filter((l) => l.state === 'leaf' && l.summary)
        .map((l) => [
          l.date,
          {
            shape: buildLeaf(l.summary?.items ?? []),
            color: leafColor(spendingRatio(l.summary?.expense ?? 0, reference), scheme),
          },
        ]),
    );
  }, [tree, monthBudget, month, scheme]);

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const scale = width / TREE_WIDTH;
  const recordedCount = tree.leaves.filter((l) => l.summary !== null).length;

  // 點樹上任一處：換算回 viewBox 座標，交給最近的葉子
  function onPressTree(event: GestureResponderEvent) {
    const { locationX, locationY } = event.nativeEvent;
    const hit = hitTestLeaf(tree.leaves, locationX / scale, locationY / scale);
    if (hit) {
      onPressDay(hit.date);
    }
  }
  const height = width * (TREE_HEIGHT / TREE_WIDTH);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {width > 0 && (
        <View style={{ width, height }}>
          <Svg width={width} height={height} viewBox={`0 0 ${TREE_WIDTH} ${TREE_HEIGHT}`}>
            {tree.branchOutlines.map((d, i) => (
              <Path key={i} d={d} fill={theme.trunk} />
            ))}
            {tree.twigs.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={theme.trunk}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
            ))}
            <Path d={tree.trunk} fill={theme.trunk} />
            {tree.leaves.map((placement) => {
              if (placement.state === 'future') {
                return null;
              }
              const transform = `translate(${placement.x} ${placement.y}) rotate(${placement.rotation}) scale(${placement.scale})`;
              const stem = (
                <Path
                  d={`M${placement.attachX},${placement.attachY} L${placement.x},${placement.y}`}
                  stroke={theme.trunk}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                />
              );
              const ring = placement.isToday && (
                <G transform={transform}>
                  <Ellipse
                    cx={0}
                    cy={-50}
                    rx={46}
                    ry={62}
                    fill="none"
                    stroke={theme.tint}
                    strokeWidth={1.5 / placement.scale}
                  />
                </G>
              );
              if (placement.state === 'bud') {
                return (
                  <G key={placement.date}>
                    {stem}
                    <G transform={transform}>
                      <Path d={BUD_PATH} fill={theme.bud} />
                    </G>
                    {ring}
                  </G>
                );
              }
              const leaf = drawn.get(placement.date);
              return (
                <G key={placement.date}>
                  {stem}
                  {leaf && (
                    <LeafGlyph
                      shape={leaf.shape}
                      color={leaf.color}
                      x={placement.x}
                      y={placement.y}
                      rotation={placement.rotation}
                      scale={placement.scale}
                      lineWidth={0.9}
                    />
                  )}
                  {ring}
                </G>
              );
            })}
          </Svg>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${month.month}月的樹，共 ${recordedCount} 天有記錄，點葉子看那一天的明細`}
            onPress={onPressTree}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
  },
});
