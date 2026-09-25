import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type AppCardVariant =
  | 'default'
  | 'raised'
  | 'interactive'
  | 'critical'
  | 'highlight';

export interface AppCardProps {
  children: React.ReactNode;
  variant?: AppCardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  variant = 'default',
  onPress,
  style,
  padding = 18,
}) => {
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'raised':
        return {
          backgroundColor: colors.cardElevated,
          borderColor: colors.borderStrong,
        };
      case 'interactive':
        return {
          backgroundColor: colors.card,
          borderColor: colors.border,
        };
      case 'critical':
        return {
          backgroundColor: colors.dangerSoft,
          borderColor: colors.danger,
        };
      case 'highlight':
        return {
          backgroundColor: colors.primary,
          borderColor: colors.primaryHover,
        };
      case 'default':
      default:
        return {
          backgroundColor: colors.card,
          borderColor: colors.border,
        };
    }
  };

  const shadowStyle: ViewStyle = !isDark
    ? Platform.select({
        web: {
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        } as any,
        default: {
          shadowColor: colors.textPrimary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2,
        },
      }) || {}
    : {};

  const combinedStyle = [
    styles.card,
    { padding },
    getVariantStyle(),
    shadowStyle,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={combinedStyle}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={combinedStyle}>{children}</View>;
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
  },
});
let styles = createStyles(lightColors);
