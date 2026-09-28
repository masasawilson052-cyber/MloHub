import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export interface PaymentProgressIndicatorProps {
  size?: number;
  status?: 'WAITING' | 'VERIFYING' | 'SUCCESS';
}

export const PaymentProgressIndicator: React.FC<PaymentProgressIndicatorProps> = ({
  size = 64,
  status = 'WAITING',
}) => {
  const { colors } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      scale.value = 1;
      opacity.value = 1;
      rotation.value = 0;
      return;
    }

    // Pulse animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.4, { duration: 900 })
      ),
      -1,
      true
    );

    // Continuous rotation for spinner feel
    rotation.value = withRepeat(
      withTiming(360, { duration: 2500, easing: Easing.linear }),
      -1,
      false
    );
  }, [shouldReduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const iconName = status === 'SUCCESS' ? 'checkmark' : status === 'VERIFYING' ? 'shield-checkmark-outline' : 'phone-portrait-outline';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer Pulse Ring */}
      {!shouldReduceMotion && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: colors.primary,
            },
            pulseStyle,
          ]}
        />
      )}

      {/* Rotating Accent Ring */}
      {!shouldReduceMotion && (
        <Animated.View
          style={[
            styles.spinRing,
            {
              width: size * 0.85,
              height: size * 0.85,
              borderRadius: (size * 0.85) / 2,
              borderTopColor: colors.primary,
              borderRightColor: 'transparent',
              borderBottomColor: colors.primary,
              borderLeftColor: 'transparent',
            },
            spinStyle,
          ]}
        />
      )}

      {/* Center Icon Box */}
      <View
        style={[
          styles.innerCircle,
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: (size * 0.7) / 2,
            backgroundColor: colors.surfaceInteractive,
          },
        ]}
      >
        <Ionicons
          name={iconName}
          size={Math.round(size * 0.35)}
          color={status === 'SUCCESS' ? colors.success : colors.primary}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  spinRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  innerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
