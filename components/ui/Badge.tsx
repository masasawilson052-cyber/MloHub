import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'accent';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  style,
  textStyle,
  size = 'md',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  const getColors = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'success':
        return { bg: colors.successSoft, text: colors.success, border: 'transparent' };
      case 'warning':
        return { bg: colors.warningSoft, text: colors.warning, border: 'transparent' };
      case 'error':
        return { bg: colors.dangerSoft, text: colors.danger, border: 'transparent' };
      case 'info':
        return { bg: colors.infoSoft, text: colors.info, border: 'transparent' };
      case 'primary':
      case 'accent':
        return { bg: colors.primarySoft, text: colors.primary, border: 'transparent' };
      case 'neutral':
      default:
        return { bg: colors.surfaceInteractive, text: colors.textSecondary, border: colors.border };
    }
  };

  const { bg, text, border } = getColors();

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        { backgroundColor: bg, borderColor: border || bg },
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: text },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  sizeSm: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
  },
  sizeMd: {
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
    lineHeight: 14,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
  },
});
let styles = createStyles(lightColors);
