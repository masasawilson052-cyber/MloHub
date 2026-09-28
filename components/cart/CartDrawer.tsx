import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Button } from '../ui/Button';
import { PriceText } from '../ui/PriceText';
import { EmptyState } from '../ui/EmptyState';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface CartDrawerProps {
  visible: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  visible,
  onClose,
  onProceedToCheckout,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const {
    items,
    restaurantName,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotalTzs,
    deliveryFeeTzs,
    serviceFeeTzs,
    totalBillTzs,
    totalItems,
  } = useCart();
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
        />
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Your Meal Order</Text>
              {restaurantName ? (
                <Text style={styles.restaurantSub} numberOfLines={1}>
                  {restaurantName}
                </Text>
              ) : null}
            </View>
            <View style={styles.headerActions}>
              {items.length > 0 ? (
                <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close cart"
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {items.length === 0 ? (
            <EmptyState
              title="Your cart is empty"
              message="Discover flavorful dishes near you and add them to your meal order."
              icon="cart-outline"
              actionTitle="Discover Food"
              onAction={onClose}
              style={styles.emptyState}
            />
          ) : (
            <>
              {/* Item List */}
              <ScrollView
                style={styles.itemList}
                contentContainerStyle={styles.itemListContent}
                showsVerticalScrollIndicator={false}
              >
                {items.map((item) => {
                  const lineId = item.cartLineId || item.dishId;
                  const hasValidImage = Boolean(
                    item.imageUrl && item.imageUrl.trim().length > 0 && !brokenImages[lineId]
                  );
                  return (
                    <View key={lineId} style={styles.itemRow}>
                      <View style={styles.itemThumbWrap}>
                        {hasValidImage ? (
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.itemThumbImage}
                            resizeMode="cover"
                            onError={() =>
                              setBrokenImages((prev) => ({ ...prev, [lineId]: true }))
                            }
                          />
                        ) : (
                          <View style={styles.itemThumbPlaceholder}>
                            <Ionicons
                              name="restaurant-outline"
                              size={20}
                              color={colors.textMuted}
                            />
                          </View>
                        )}
                      </View>

                      <View style={styles.itemDetails}>
                        <Text style={styles.dishName}>{item.dishName}</Text>
                        {item.dishNameSwahili ? (
                          <Text style={styles.dishSwahili}>{item.dishNameSwahili}</Text>
                        ) : null}
                        {item.selectedModifiers && item.selectedModifiers.length > 0 ? (
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                            + {item.selectedModifiers.map((m) => m.option_name).join(', ')}
                          </Text>
                        ) : null}
                        {item.notes ? (
                          <Text style={{ fontSize: 11, fontStyle: 'italic', color: colors.textSecondary, marginTop: 2 }}>
                            Note: {item.notes}
                          </Text>
                        ) : null}
                        <PriceText
                          amountTzs={item.priceTzs}
                          size="sm"
                          color={colors.primary}
                          style={styles.itemPrice}
                        />
                      </View>

                      {/* Quantity Controls */}
                      <View style={styles.qtyContainer}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateQuantity(lineId, item.quantity - 1)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Decrease quantity of ${item.dishName}`}
                        >
                          <Ionicons
                            name={item.quantity === 1 ? 'trash-outline' : 'remove'}
                            size={16}
                            color={item.quantity === 1 ? colors.error : colors.primaryDark}
                          />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateQuantity(lineId, item.quantity + 1)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Increase quantity of ${item.dishName}`}
                        >
                          <Ionicons name="add" size={16} color={colors.primaryDark} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Fee Breakdown & Checkout Footer */}
              <View style={styles.footer}>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Subtotal ({totalItems} items)</Text>
                  <PriceText amountTzs={subtotalTzs} size="sm" />
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Standard Delivery</Text>
                  <PriceText amountTzs={deliveryFeeTzs} size="sm" />
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Platform Service Fee</Text>
                  <PriceText amountTzs={serviceFeeTzs} size="sm" />
                </View>
                <View style={[styles.feeRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Bill</Text>
                  <PriceText amountTzs={totalBillTzs} size="lg" color={colors.primaryDark} />
                </View>

                <Button
                  title={`Proceed to Review (${totalItems} ${totalItems === 1 ? 'item' : 'items'})`}
                  onPress={() => {
                    onClose();
                    onProceedToCheckout();
                  }}
                  variant="primary"
                  size="lg"
                  fullWidth={true}
                  style={styles.checkoutBtn}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 40, 30, 0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    ...Typography.H2,
  },
  restaurantSub: {
    ...Typography.Caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  emptyState: {
    paddingVertical: Spacing.xxxl,
  },
  itemList: {
    maxHeight: 320,
  },
  itemListContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemThumbImage: {
    width: '100%',
    height: '100%',
  },
  itemThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  itemDetails: {
    flex: 1,
    marginRight: Spacing.md,
  },
  dishName: {
    ...Typography.BodyMedium,
    fontWeight: '600',
  },
  dishSwahili: {
    ...Typography.Caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  itemPrice: {
    marginTop: 4,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceInteractive,
    borderRadius: Radii.full,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feeLabel: {
    ...Typography.Body,
    color: colors.textSecondary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: Spacing.xs,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  totalLabel: {
    ...Typography.H3,
    fontWeight: '700',
  },
  checkoutBtn: {
    marginTop: Spacing.xs,
  },
});
let styles = createStyles(lightColors);
