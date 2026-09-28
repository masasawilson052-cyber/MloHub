import React, { useEffect, useMemo, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { useCartInteraction } from '../../hooks/useCartInteraction';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { PriceText } from '../ui/PriceText';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors } from '../../theme/palettes';

export interface FloatingCartButtonProps {
  showWhenEmpty?: boolean;
  bottomOffset?: number;
}

export const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({
  showWhenEmpty = true,
  bottomOffset,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, bottomOffset),
    [colors, bottomOffset]
  );
  const { totalItems, subtotalTzs, setIsCartOpen } = useCart();
  const { registerCartTarget, pulseVersion } = useCartInteraction();

  const cartTargetRef = useRef<View | null>(null);
  const pulseScale = useSharedValue(1);
  const lastPulseRef = useRef(pulseVersion);

  const isVisible = totalItems > 0 || showWhenEmpty;

  useEffect(() => {
    if (!isVisible) return;
    const unregister = registerCartTarget(cartTargetRef);
    return unregister;
  }, [isVisible, registerCartTarget]);

  useEffect(() => {
    if (pulseVersion > lastPulseRef.current) {
      lastPulseRef.current = pulseVersion;
      pulseScale.value = withSequence(
        withSpring(1.14, { damping: 10, stiffness: 260 }),
        withSpring(1, { damping: 12, stiffness: 220 })
      );
    }
  }, [pulseVersion, pulseScale]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (!isVisible) {
    return null;
  }

  const isEmpty = totalItems === 0;

  return (
    <View style={styles.anchorWrapper} pointerEvents="box-none">
      <View style={styles.dockRow} pointerEvents="box-none">
        {!isEmpty && (
          <TouchableOpacity
            style={styles.summaryPanel}
            onPress={() => setIsCartOpen(true)}
            activeOpacity={0.88}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`View cart with ${totalItems} items totaling ${subtotalTzs} Tanzanian Shillings`}
          >
            <View style={styles.summaryLeft}>
              <Text style={styles.viewCartText} numberOfLines={1}>
                View Meal Order
              </Text>
            </View>

            <View style={styles.summaryRight}>
              <PriceText
                amountTzs={subtotalTzs}
                size="sm"
                color={colors.onPrimary}
                style={styles.price}
              />
              <Ionicons
                name="arrow-forward"
                size={16}
                color={colors.onPrimary}
                style={styles.arrow}
              />
            </View>
          </TouchableOpacity>
        )}

        <Animated.View style={animatedPulseStyle}>
          <View ref={cartTargetRef} collapsable={false}>
            <TouchableOpacity
              style={styles.cartIconAnchor}
              onPress={() => setIsCartOpen(true)}
              activeOpacity={0.86}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={
                isEmpty
                  ? 'Open empty meal cart'
                  : `Open meal cart with ${totalItems} items`
              }
            >
              <Ionicons
                name={isEmpty ? 'cart-outline' : 'cart'}
                size={23}
                color={colors.onPrimary}
              />
              {isEmpty ? (
                <View style={styles.emptyStatusDot} />
              ) : (
                <View style={styles.cartCountBadge}>
                  <Text style={styles.countText}>
                    {totalItems > 99 ? '99+' : totalItems}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors, bottomOffset?: number) => {
  const resolvedBottom =
    typeof bottomOffset === 'number'
      ? bottomOffset
      : Platform.OS === 'ios'
      ? 95
      : 75;

  return StyleSheet.create({
    anchorWrapper: {
      position: 'absolute',
      bottom: resolvedBottom,
      left: Spacing.md,
      right: Spacing.md,
      zIndex: 99,
      alignItems: 'flex-end',
    },
    dockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      width: '100%',
      maxWidth: 600,
    },
    summaryPanel: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryDark,
      borderRadius: Radii.xl,
      paddingVertical: 12,
      paddingHorizontal: Spacing.md,
      marginRight: Spacing.sm,
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.md,
    },
    summaryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      marginRight: Spacing.sm,
    },
    viewCartText: {
      color: colors.onPrimary,
      fontWeight: '600',
      fontSize: 15,
    },
    summaryRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    price: {
      fontWeight: '700',
    },
    arrow: {
      marginLeft: 6,
    },
    cartIconAnchor: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.md,
    },
    emptyStatusDot: {
      position: 'absolute',
      top: 11,
      right: 11,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
    },
    cartCountBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 5,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
    },
    countText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 11,
    },
  });
};
