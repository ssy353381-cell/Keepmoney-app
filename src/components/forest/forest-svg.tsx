import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import type { MonthSummaryLite } from '@/lib/daily-summary';
import {
  buildForest,
  FOREST_CELL_HEIGHT,
  FOREST_CELL_WIDTH,
  FOREST_COLUMNS,
  FOREST_HEIGHT,
  FOREST_WIDTH,
  type ForestTree,
} from '@/lib/forest';
import { formatMoney } from '@/lib/money';

type ForestSvgProps = {
  year: number;
  months: MonthSummaryLite[];
  today: string;
  monthBudget: number | null;
  onPressMonth: (month: number) => void;
};

function describeTree(tree: ForestTree): string {
  if (tree.state === 'sapling') {
    return `${tree.label}，還沒到`;
  }
  if (tree.state === 'empty') {
    return `${tree.label}，沒有記錄`;
  }
  return `${tree.label}，支出 ${formatMoney(tree.expense)}`;
}

/** 一整年的森林：12 棵樹依月份排列，點某棵樹進到那個月 */
export function ForestSvg({ year, months, today, monthBudget, onPressMonth }: ForestSvgProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [width, setWidth] = useState(0);

  const forest = useMemo(
    () => buildForest(year, months, today, scheme, monthBudget),
    [year, months, today, scheme, monthBudget],
  );

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const scale = width / FOREST_WIDTH;
  const height = FOREST_HEIGHT * scale;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {width > 0 && (
        <View style={{ width, height }}>
          <Svg width={width} height={height} viewBox={`0 0 ${FOREST_WIDTH} ${FOREST_HEIGHT}`}>
            {forest.map((tree) => (
              <TreeGlyph key={tree.month} tree={tree} groundColor={theme.backgroundSelected} />
            ))}
          </Svg>
          {forest.map((tree, index) => {
            const column = index % FOREST_COLUMNS;
            const row = Math.floor(index / FOREST_COLUMNS);
            return (
              <Pressable
                key={tree.month}
                accessibilityRole="button"
                accessibilityLabel={describeTree(tree)}
                onPress={() => onPressMonth(tree.month)}
                style={[
                  styles.cell,
                  {
                    left: column * FOREST_CELL_WIDTH * scale,
                    top: row * FOREST_CELL_HEIGHT * scale,
                    width: FOREST_CELL_WIDTH * scale,
                    height: FOREST_CELL_HEIGHT * scale,
                  },
                ]}>
                <View
                  style={[
                    styles.label,
                    { top: (tree.baseY - row * FOREST_CELL_HEIGHT + 6) * scale },
                  ]}>
                  <ThemedText type="smallBold">{tree.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {tree.state === 'sapling' ? '' : formatMoney(tree.expense)}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TreeGlyph({ tree, groundColor }: { tree: ForestTree; groundColor: string }) {
  const theme = useTheme();
  return (
    <>
      <Ellipse cx={tree.cx} cy={tree.baseY + 1} rx={26} ry={4} fill={groundColor} />
      <Path d={tree.trunk} fill={theme.trunk} />
      {tree.canopy.map((dot, i) => (
        <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.color} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
  },
  cell: {
    position: 'absolute',
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
