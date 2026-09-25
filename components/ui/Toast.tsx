import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Shadows } from '../../theme/shadows';
import { ZIndex } from '../../theme/zIndex';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 4000,
  onDismiss,
  actionText,
  onAction,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  if (!visible) return null;

  const tone = {
    success: { icon: 'checkmark-circle' as const, color: colors.success },
    error: { icon: 'alert-circle' as const, color: colors.danger },
    warning: { icon: 'warning' as const, color: colors.warning },
    info: { icon: 'information-circle' as const, color: colors.info },
  }[type];

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View
        style={[
          styles.content,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.borderStrong,
          },
        ]}
      >
        <Ionicons name={tone.icon} size={20} color={tone.color} />
        <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={2}>
          {message}
        </Text>
        {actionText && onAction ? (
          <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: colors.primary }]}>{actionText}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: ZIndex.toast,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.xl,
    gap: Spacing.xs + 2,
    maxWidth: 500,
    width: '100%',
    ...Shadows.lg,
  },
  message: {
    ...Typography.bodySmall,
    flex: 1,
    fontWeight: '600',
  },
  actionBtn: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  actionText: {
    ...Typography.labelLarge,
    fontWeight: '700',
  },
});
let styles = createStyles(lightColors);
