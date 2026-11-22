import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';

export interface CheckoutErrorBannerProps {
  colors: ThemeColors;
  message: string | null;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'info';
}

export const CheckoutErrorBanner: React.FC<CheckoutErrorBannerProps> = ({
  colors,
  message,
  onDismiss,
  variant = 'error',
}) => {
  if (!message) return null;

  const isWarning = variant === 'warning';
  const isInfo = variant === 'info';

  const bgColor = isWarning
    ? colors.warningSoft || '#FEF3C7'
    : isInfo
    ? colors.surfaceInteractive
    : colors.dangerSoft || '#FEE2E2';

  const borderColor = isWarning
    ? colors.warning
    : isInfo
    ? colors.primary
    : colors.danger;

  const textColor = isWarning
    ? colors.textPrimary
    : isInfo
    ? colors.textPrimary
    : colors.danger;

  const iconName: keyof typeof Ionicons.glyphMap = isWarning
    ? 'warning-outline'
    : isInfo
    ? 'information-circle-outline'
    : 'alert-circle-outline';

  const iconColor = isWarning
    ? colors.warning
    : isInfo
    ? colors.primary
    : colors.danger;

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      <Ionicons name={iconName} size={18} color={iconColor} style={styles.icon} />
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
        >
          <Ionicons name="close" size={16} color={textColor} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: 8,
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 2,
    flexShrink: 0,
  },
});
