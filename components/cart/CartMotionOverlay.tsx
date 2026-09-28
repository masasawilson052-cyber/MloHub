import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { Radii, Shadows } from '@/constants/theme';
import { ThemeColors } from '@/theme/palettes';
import {
  MeasuredRect,
  CartFlightFrame,
  CART_FLIGHT_DURATION_MS,
  computeCartFlightFrame,
} from '@/services/cart/cartCore';

export type { MeasuredRect, CartFlightFrame };
export { CART_FLIGHT_DURATION_MS, computeCartFlightFrame };

export interface ActiveCartFlight {
  id: string;
  imageUrl: string;
  quantity: number;
  sourceRect: MeasuredRect;
  targetRect: MeasuredRect;
}

interface CartMotionOverlayProps {
  flight: ActiveCartFlight | null;
  onFlightComplete: (flightId: string) => void;
}

export const CartMotionOverlay: React.FC<CartMotionOverlayProps> = ({
  flight,
  onFlightComplete,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!flight || !flight.imageUrl) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }

    const activeId = flight.id;
    cancelAnimation(progress);
    progress.value = 0;

    progress.value = withTiming(
      1,
      {
        duration: CART_FLIGHT_DURATION_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(onFlightComplete)(activeId);
        }
      }
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [flight, onFlightComplete, progress]);

  const animatedCloneStyle = useAnimatedStyle(() => {
    if (!flight) {
      return {
        opacity: 0,
        transform: [{ translateX: -9999 }, { translateY: -9999 }, { scale: 0.24 }],
      };
    }

    const frame = computeCartFlightFrame(
      progress.value,
      flight.sourceRect,
      flight.targetRect
    );

    return {
      width: flight.sourceRect.width,
      height: flight.sourceRect.height,
      opacity: frame.opacity,
      transform: [
        { translateX: frame.translateX },
        { translateY: frame.translateY },
        { scale: frame.scale },
        { rotateZ: `${frame.rotateDeg}deg` },
      ],
    };
  }, [flight]);

  if (!flight || !flight.imageUrl) {
    return null;
  }

  return (
    <View style={styles.overlayRoot} pointerEvents="none" accessible={false}>
      <Animated.View style={[styles.cloneShell, animatedCloneStyle]}>
        <Animated.Image
          source={{ uri: flight.imageUrl }}
          style={styles.cloneImage}
          resizeMode="cover"
        />
        {flight.quantity > 1 && (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityBadgeText}>×{flight.quantity}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlayRoot: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 9999,
      elevation: 9999,
    },
    cloneShell: {
      position: 'absolute',
      top: 0,
      left: 0,
      borderRadius: Radii.lg,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.card,
      backgroundColor: colors.card,
      ...Shadows.lg,
    },
    cloneImage: {
      width: '100%',
      height: '100%',
    },
    quantityBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: Radii.full,
      borderWidth: 1.5,
      borderColor: colors.card,
    },
    quantityBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textInverse,
    },
  });
