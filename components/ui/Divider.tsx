import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface DividerProps {
  label?: string;
  orientation?: 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
  color?: string;
  marginVertical?: number;
}

export const Divider: React.FC<DividerProps> = ({
  label,
  orientation = 'horizontal',
  style,
  color,
  marginVertical = Spacing.md,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const dividerColor = color || colors.divider;

  if (orientation === 'vertical') {
    return <View style={[styles.vertical, { backgroundColor: dividerColor }, style]} />;
  }

  if (label) {
    return (
      <View style={[styles.labelWrapper, { marginVertical }, style]}>
        <View style={[styles.line, { backgroundColor: dividerColor }]} />
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        <View style={[styles.line, { backgroundColor: dividerColor }]} />
      </View>
    );
  }

  return (
    <View style={[styles.horizontal, { backgroundColor: dividerColor, marginVertical }, style]} />
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  horizontal: {
    height: 1,
    width: '100%',
  },
  vertical: {
    width: 1,
    height: '100%',
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
  },
  label: {
    ...Typography.bodySmall,
    paddingHorizontal: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
let styles = createStyles(lightColors);
