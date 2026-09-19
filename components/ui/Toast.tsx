import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Shadows } from '../../theme/shadows';
import { ZIndex } from '../../theme/zIndex';

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

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={20} color={Colors.botanicalGreen} />;
      case 'error':
        return <Ionicons name="alert-circle" size={20} color={Colors.error} />;
      case 'warning':
        return <Ionicons name="warning" size={20} color={Colors.warning} />;
      case 'info':
      default:
        return <Ionicons name="information-circle" size={20} color={Colors.info} />;
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.content}>
        {getIcon()}
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {actionText && onAction ? (
          <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
            <Text style={styles.actionText}>{actionText}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: Colors.brandInk,
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
    color: Colors.white,
    flex: 1,
    fontWeight: '500',
  },
  actionBtn: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  actionText: {
    ...Typography.labelLarge,
    color: Colors.saffron,
    fontWeight: '700',
  },
});
