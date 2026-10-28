import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type ProgressTone = 'normal' | 'warning' | 'danger';

/** 依使用比例決定狀態：80% 以上提醒、超過 100% 警示 */
export function progressTone(ratio: number): ProgressTone {
  if (ratio > 1) return 'danger';
  if (ratio >= 0.8) return 'warning';
  return 'normal';
}

/**
 * 進度條（預算用）。底軌是填色同色系的淺色，整條都看得出狀態；
 * 狀態一定要搭配文字說明，不能只靠顏色。
 */
export function ProgressBar({
  ratio,
  tone = progressTone(ratio),
}: {
  ratio: number;
  tone?: ProgressTone;
}) {
  const theme = useTheme();
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const colors = {
    normal: [theme.tint, theme.tintSubtle],
    warning: [theme.warning, theme.warningSubtle],
    danger: [theme.danger, theme.dangerSubtle],
  }[tone];

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={[styles.track, { backgroundColor: colors[1] }]}>
      {clamped > 0 && (
        <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: colors[0] }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
