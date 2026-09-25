import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type BannerVariant = 'info' | 'warning' | 'error' | 'success' | 'violet' | 'saffron';

export interface BannerProps {
  title?: string;
  message: string;
  variant?: BannerVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  actionText?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const Banner: React.FC<BannerProps> = ({
  title,
  message,
  variant = 'info',
  icon,
  actionText,
  onActionPress,
  style,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  const getTheme = () => {
    switch (variant) {
      case 'warning':
      case 'saffron':
        return {
          bg: colors.warningSoft,
          border: colors.warning,
          color: colors.warning,
          defaultIcon: 'warning-outline' as const,
        };
      case 'error':
        return {
          bg: colors.dangerSoft,
          border: colors.danger,
          color: colors.danger,
          defaultIcon: 'alert-circle-outline' as const,
        };
      case 'success':
        return {
          bg: colors.successSoft,
          border: colors.success,
          color: colors.success,
          defaultIcon: 'checkmark-circle-outline' as const,
        };
      case 'violet':
        return {
          bg: colors.primarySoft,
          border: colors.primary,
          color: colors.primary,
          defaultIcon: 'sparkles-outline' as const,
        };
      case 'info':
      default:
        return {
          bg: colors.infoSoft,
          border: colors.info,
          color: colors.info,
          defaultIcon: 'information-circle-outline' as const,
        };
    }
  };

  const theme = getTheme();
  const iconName = icon || theme.defaultIcon;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bg, borderColor: theme.border },
        style,
      ]}
      accessible={true}
      accessibilityRole="alert"
    >
      <Ionicons name={iconName} size={20} color={theme.color} style={styles.icon} />
      <View style={styles.content}>
        {title ? <Text style={[styles.title, { color: theme.color }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
        {actionText && onActionPress ? (
          <TouchableOpacity onPress={onActionPress} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: theme.color }]}>{actionText} →</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
    marginVertical: Spacing.xs,
  },
  icon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    ...Typography.bodySmall,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: Spacing.xs,
  },
  actionText: {
    ...Typography.labelLarge,
    fontWeight: '700',
  },
});
let styles = createStyles(lightColors);
