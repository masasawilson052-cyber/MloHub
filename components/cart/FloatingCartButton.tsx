import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { PriceText } from '../ui/PriceText';

export const FloatingCartButton: React.FC = () => {
  const { totalItems, subtotalTzs, setIsCartOpen } = useCart();

  if (totalItems === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setIsCartOpen(true)}
        activeOpacity={0.88}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`View cart with ${totalItems} items totaling ${subtotalTzs} Tanzanian Shillings`}
      >
        <View style={styles.left}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{totalItems}</Text>
          </View>
          <Text style={styles.viewCartText}>View Meal Order</Text>
        </View>

        <View style={styles.right}>
          <PriceText
            amountTzs={subtotalTzs}
            size="sm"
            color={Colors.white}
            style={styles.price}
          />
          <Ionicons name="arrow-forward" size={16} color={Colors.white} style={styles.arrow} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 95 : 75,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 99,
    maxWidth: 600,
    alignSelf: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryDark,
    borderRadius: Radii.xl,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    backgroundColor: Colors.accent,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  countText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  viewCartText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontWeight: '700',
  },
  arrow: {
    marginLeft: 6,
  },
});
