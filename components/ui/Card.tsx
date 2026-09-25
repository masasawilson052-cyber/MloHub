import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: keyof typeof Spacing;
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  variant = 'outlined',
  padding = 'md',
  accessibilityLabel,
}) => {
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.cardElevated,
          borderWidth: 1,
          borderColor: colors.border,
          ...(!isDark
            ? (Platform.select({
                web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' } as any,
                default: {
                  shadowColor: colors.textPrimary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                },
              }) || {})
            : {}),
        };
      case 'flat':
        return {
          backgroundColor: colors.surfaceMuted,
          borderWidth: 0,
        };
      case 'outlined':
      default:
        return {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        };
    }
  };

  const containerStyles = [
    styles.base,
    getVariantStyle(),
    { padding: Spacing[padding] },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyles}
        onPress={onPress}
        activeOpacity={0.85}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyles}>{children}</View>;
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
});
let styles = createStyles(lightColors);
