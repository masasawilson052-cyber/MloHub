import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type StatusBadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary';

export interface StatusBadgeProps {
  label: string;
  tone?: StatusBadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  dot?: boolean;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  tone = 'neutral',
  icon,
  dot = false,
  size = 'sm',
  style,
  textStyle,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  const toneColors = {
    neutral: {
      bg: colors.surfaceInteractive,
      border: colors.border,
      text: colors.textSecondary,
      dot: colors.textMuted,
    },
    success: {
      bg: colors.successSoft,
      border: 'transparent',
      text: colors.success,
      dot: colors.success,
    },
    warning: {
      bg: colors.warningSoft,
      border: 'transparent',
      text: colors.warning,
      dot: colors.warning,
    },
    danger: {
      bg: colors.dangerSoft,
      border: 'transparent',
      text: colors.danger,
      dot: colors.danger,
    },
    info: {
      bg: colors.infoSoft,
      border: 'transparent',
      text: colors.info,
      dot: colors.info,
    },
    primary: {
      bg: colors.primarySoft,
      border: 'transparent',
      text: colors.primary,
      dot: colors.primary,
    },
  }[tone];

  return (
    <View
      style={[
        styles.badge,
        size === 'md' ? styles.badgeMd : styles.badgeSm,
        {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.border,
        },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: toneColors.dot }]} />}
      {icon && (
        <Ionicons
          name={icon}
          size={size === 'md' ? 13 : 11}
          color={toneColors.text}
        />
      )}
      <Text
        style={[
          styles.label,
          size === 'md' ? styles.labelMd : styles.labelSm,
          { color: toneColors.text },
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  labelSm: {
    fontSize: 10,
  },
  labelMd: {
    fontSize: 11,
  },
});
let styles = createStyles(lightColors);
