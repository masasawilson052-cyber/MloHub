import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';

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
  const getTheme = () => {
    switch (variant) {
      case 'warning':
        return {
          bg: Colors.warningLight,
          border: Colors.warning,
          color: Colors.warningDark,
          defaultIcon: 'warning-outline' as const,
        };
      case 'error':
        return {
          bg: Colors.errorLight,
          border: Colors.error,
          color: Colors.error,
          defaultIcon: 'alert-circle-outline' as const,
        };
      case 'success':
        return {
          bg: Colors.botanicalGreenLight,
          border: Colors.botanicalGreen,
          color: Colors.botanicalGreen,
          defaultIcon: 'checkmark-circle-outline' as const,
        };
      case 'violet':
        return {
          bg: Colors.violetLight,
          border: Colors.mutedViolet,
          color: Colors.mutedViolet,
          defaultIcon: 'sparkles-outline' as const,
        };
      case 'saffron':
        return {
          bg: Colors.saffronLight,
          border: Colors.saffron,
          color: Colors.saffronDark,
          defaultIcon: 'star-outline' as const,
        };
      case 'info':
      default:
        return {
          bg: Colors.infoLight,
          border: Colors.info,
          color: Colors.info,
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
        <Text style={styles.message}>{message}</Text>
        {actionText && onActionPress ? (
          <TouchableOpacity onPress={onActionPress} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: theme.color }]}>{actionText} →</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    color: Colors.textSecondary,
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
