import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { OrderService } from '../../services/OrderService';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Button } from '../ui/Button';
import { PriceText } from '../ui/PriceText';
import { Badge } from '../ui/Badge';
import { PaymentMethodCode, PaymentTransactionEntity } from '../../db/types';
import { Order, BranchDeliveryZone } from '../../types/domain';
import { BranchOperationsRepository } from '../../repositories/branchOperations.repository';
import { PaymentCheckoutModal } from '../PaymentCheckoutModal';

export interface OrderReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onOrderConfirmed: (orderId: string) => void;
  isVerifiedRestaurant?: boolean;
}

type CheckoutStep = 'REVIEW' | 'PROCESSING' | 'CONFIRMED' | 'FAILED';

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  visible,
  onClose,
  onOrderConfirmed,
  isVerifiedRestaurant = false,
}) => {
  const { user } = useAuth();
  const {
    items,
    restaurantId,
    restaurantName,
    branchId,
    clearCart,
    getOrderQuote,
    pricingDisclaimer,
    totalItems,
  } = useCart();

  const [step, setStep] = useState<CheckoutStep>('REVIEW');
  const [fulfillment, setFulfillment] = useState<'Delivery' | 'Takeaway' | 'Dine-In'>('Delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(user?.location || '');
  const [payerPhone, setPayerPhone] = useState(user?.phone || '');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodCode>('MPESA');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string>('');
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string>('');

  const [deliveryZones, setDeliveryZones] = useState<BranchDeliveryZone[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<BranchDeliveryZone | null>(null);
  const [zoneLoadError, setZoneLoadError] = useState<string | null>(null);

  const effectiveBranchId = branchId || (items.length > 0 ? items[0].branchId : null);

  useEffect(() => {
    let isMounted = true;
    if (visible && fulfillment === 'Delivery' && effectiveBranchId) {
      setIsLoadingZones(true);
      setZoneLoadError(null);
      BranchOperationsRepository.getDeliveryZones(effectiveBranchId)
        .then((zones) => {
          if (!isMounted) return;
          setDeliveryZones(zones);
          if (zones.length > 0) {
            setSelectedDeliveryZone((prev) => {
              if (prev && zones.some((z) => z.id === prev.id)) {
                return zones.find((z) => z.id === prev.id) || zones[0];
              }
              return zones[0];
            });
          } else {
            setSelectedDeliveryZone(null);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.warn('Failed to load delivery zones:', err);
          setZoneLoadError('Failed to load delivery zones for this branch.');
          setDeliveryZones([]);
          setSelectedDeliveryZone(null);
        })
        .finally(() => {
          if (isMounted) setIsLoadingZones(false);
        });
    } else if (fulfillment !== 'Delivery') {
      setSelectedDeliveryZone(null);
    }
    return () => {
      isMounted = false;
    };
  }, [visible, fulfillment, effectiveBranchId]);

  useEffect(() => {
    if (user?.location && !deliveryAddress) {
      setDeliveryAddress(user.location);
    }
    if (user?.phone && !payerPhone) {
      setPayerPhone(user.phone);
    }
  }, [user]);

  const currentQuote = React.useMemo(() => {
    const fee = fulfillment === 'Delivery' ? (selectedDeliveryZone?.feeTzs ?? 0) : 0;
    return getOrderQuote(fulfillment, fee);
  }, [getOrderQuote, fulfillment, selectedDeliveryZone]);

  if (!visible) return null;

  const handleProceedToPayment = async () => {
    if (!user?.id) {
      Alert.alert(
        'Sign In Required',
        'Please sign in or register to place your order.'
      );
      return;
    }

    const effectiveBranchId = branchId || (items.length > 0 ? items[0].branchId : null);
    if (!effectiveBranchId) {
      Alert.alert(
        'Branch Selection Required',
        'Please select a specific restaurant branch before continuing to checkout.'
      );
      return;
    }

    if (fulfillment === 'Delivery') {
      if (!deliveryAddress.trim()) {
        Alert.alert(
          'Delivery Address Required',
          'Please enter a delivery address for your order.'
        );
        return;
      }
      if (!selectedDeliveryZone) {
        Alert.alert(
          'Delivery Area Required',
          deliveryZones.length === 0
            ? 'No delivery zones are configured for this branch. Please choose Takeaway or Dine-In.'
            : 'Please select your delivery area to calculate delivery fee and proceed.'
        );
        return;
      }
      if (selectedDeliveryZone.minimumOrderTzs && currentQuote.subtotalTzs < selectedDeliveryZone.minimumOrderTzs) {
        Alert.alert(
          'Minimum Order Required',
          `The minimum order for ${selectedDeliveryZone.zoneName} is TZS ${selectedDeliveryZone.minimumOrderTzs.toLocaleString()}. Your current subtotal is TZS ${currentQuote.subtotalTzs.toLocaleString()}.`
        );
        return;
      }
    }

    if (!payerPhone.trim()) {
      Alert.alert(
        'Phone Number Required',
        'Please enter a contact phone number for mobile money payment.'
      );
      return;
    }

    setStep('PROCESSING');

    try {
      const order = await OrderService.submitStandardMenuOrder({
        userId: user.id,
        customerName: user.fullName,
        customerPhone: payerPhone.trim(),
        restaurantId: restaurantId || '',
        branchId: effectiveBranchId,
        items: items.map((it) => ({
          menuItemId: it.dishId,
          name: it.dishName,
          unitPriceTzs: it.priceTzs,
          quantity: it.quantity,
          totalPriceTzs: it.priceTzs * it.quantity,
        })),
        diningOption: fulfillment,
        deliveryAddress: fulfillment === 'Delivery' ? deliveryAddress.trim() : undefined,
        deliveryZoneId: fulfillment === 'Delivery' ? selectedDeliveryZone?.id : undefined,
        specialInstructions: items.map((it) => it.notes).filter(Boolean).join('; ') || undefined,
      });

      setCreatedOrder(order);
      setConfirmedOrderId(order.id);
      setConfirmedOrderNumber(order.orderNumber || order.id);
      setStep('REVIEW');
      setShowPaymentModal(true);
    } catch (err: any) {
      console.error('Failed to submit standard menu order:', err);
      setStep('REVIEW');
      Alert.alert('Order Placement Failed', err?.message || 'Unable to place order. Please try again.');
    }
  };

  const handlePaymentSuccess = (payment: PaymentTransactionEntity) => {
    setShowPaymentModal(false);
    clearCart();
    setStep('CONFIRMED');
  };

  const handlePaymentClose = () => {
    setShowPaymentModal(false);
    Alert.alert(
      'Payment Incomplete',
      'Payment was not completed. Your order has been registered as PENDING and you can retry payment anytime from your order history.'
    );
  };

  const handleFinish = () => {
    onOrderConfirmed(confirmedOrderId);
    setStep('REVIEW');
    setCreatedOrder(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {step === 'CONFIRMED' ? 'Order Confirmed' : 'Checkout & Review'}
            </Text>
            {step !== 'PROCESSING' ? (
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close checkout"
              >
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {step === 'REVIEW' && (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Restaurant Banner */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Restaurant</Text>
                <Text style={styles.restaurantName}>{restaurantName || 'Restaurant'}</Text>
                {isVerifiedRestaurant ? (
                  <Badge label="Verified Kitchen" variant="success" size="sm" style={styles.verifiedBadge} />
                ) : null}
              </View>

              {/* Fulfillment Option */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Fulfillment Method</Text>
                <View style={styles.pillRow}>
                  {(['Delivery', 'Takeaway', 'Dine-In'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.pillBtn,
                        fulfillment === opt && styles.pillBtnActive,
                      ]}
                      onPress={() => setFulfillment(opt)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={opt}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          fulfillment === opt && styles.pillTextActive,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {fulfillment === 'Delivery' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Delivery Address (Dar es Salaam)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={deliveryAddress}
                        onChangeText={setDeliveryAddress}
                        placeholder="e.g. Street name, House/Flat number, Landmark"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Select Delivery Area / Zone</Text>
                      {isLoadingZones ? (
                        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                          <ActivityIndicator size="small" color={Colors.primary} />
                          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>Loading delivery areas...</Text>
                        </View>
                      ) : zoneLoadError ? (
                        <Text style={{ fontSize: 12, color: Colors.error, marginVertical: 4 }}>{zoneLoadError}</Text>
                      ) : deliveryZones.length === 0 ? (
                        <Text style={{ fontSize: 12, color: Colors.textMuted, marginVertical: 4 }}>
                          No delivery areas found for this branch. Please choose Takeaway or Dine-In.
                        </Text>
                      ) : (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          {deliveryZones.map((zone) => {
                            const isSelected = selectedDeliveryZone?.id === zone.id;
                            return (
                              <TouchableOpacity
                                key={zone.id}
                                style={[
                                  styles.zoneCard,
                                  isSelected && styles.zoneCardSelected,
                                ]}
                                onPress={() => setSelectedDeliveryZone(zone)}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={zone.zoneName}
                              >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.zoneName, isSelected && styles.zoneNameSelected]}>
                                      {zone.zoneName}
                                    </Text>
                                    <Text style={styles.zoneDetails}>
                                      Est. {zone.estimatedDeliveryMinutes} mins
                                      {zone.minimumOrderTzs > 0 ? ` • Min. TZS ${zone.minimumOrderTzs.toLocaleString()}` : ''}
                                      {zone.supportedWards && zone.supportedWards.length > 0 ? ` • ${zone.supportedWards.slice(0, 3).join(', ')}` : ''}
                                    </Text>
                                  </View>
                                  <Text style={[styles.zoneFee, isSelected && styles.zoneFeeSelected]}>
                                    TZS {zone.feeTzs.toLocaleString()}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>

              {/* Order Summary */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Items Ordered ({totalItems})</Text>
                {items.map((it) => (
                  <View key={it.dishId} style={styles.itemSummaryRow}>
                    <Text style={styles.itemSummaryQty}>{it.quantity}x</Text>
                    <Text style={styles.itemSummaryName} numberOfLines={1}>{it.dishName}</Text>
                    <PriceText amountTzs={it.priceTzs * it.quantity} size="sm" />
                  </View>
                ))}
              </View>

              {/* Payment Method */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Payment Method (Mobile Money)</Text>
                <View style={styles.paymentMethodsGrid}>
                  {[
                    { id: 'MPESA', label: 'Vodacom M-Pesa', emoji: '🟢' },
                    { id: 'AIRTEL_MONEY', label: 'Airtel Money', emoji: '🔴' },
                    { id: 'MIXX_BY_YAS', label: 'Mixx by Yas', emoji: '🔵' },
                    { id: 'HALOPESA', label: 'HaloPesa', emoji: '🟠' },
                  ].map((pm) => (
                    <TouchableOpacity
                      key={pm.id}
                      style={[
                        styles.pmCard,
                        selectedMethod === pm.id && styles.pmCardSelected,
                      ]}
                      onPress={() => setSelectedMethod(pm.id as PaymentMethodCode)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={pm.label}
                    >
                      <Text style={styles.pmEmoji}>{pm.emoji}</Text>
                      <Text
                        style={[
                          styles.pmLabel,
                          selectedMethod === pm.id && styles.pmLabelSelected,
                        ]}
                      >
                        {pm.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Money Number</Text>
                  <TextInput
                    style={styles.textInput}
                    value={payerPhone}
                    onChangeText={setPayerPhone}
                    keyboardType="phone-pad"
                    placeholder="+255 7XX XXX XXX"
                  />
                </View>
              </View>

              {/* Bill Breakdown */}
              <View style={styles.billCard}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Estimated Subtotal</Text>
                  <PriceText amountTzs={currentQuote.subtotalTzs} size="sm" />
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Estimated Delivery Fee</Text>
                  {fulfillment === 'Delivery' && !selectedDeliveryZone ? (
                    <Text style={{ fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' }}>
                      Select delivery area to calculate delivery fee
                    </Text>
                  ) : (
                    <PriceText amountTzs={currentQuote.deliveryFeeTzs} size="sm" />
                  )}
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Service Fee</Text>
                  <PriceText amountTzs={currentQuote.serviceFeeTzs} size="sm" />
                </View>
                <View style={[styles.billRow, styles.billTotalRow]}>
                  <Text style={styles.billTotalLabel}>Estimated Total</Text>
                  <PriceText
                    amountTzs={currentQuote.totalTzs}
                    size="lg"
                    color={Colors.primaryDark}
                  />
                </View>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6, textAlign: 'center' }}>
                  {pricingDisclaimer || 'Estimate — final total is revalidated by the restaurant branch.'}
                </Text>
              </View>
            </ScrollView>
          )}

          {step === 'PROCESSING' && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.processingTitle}>Creating Order...</Text>
              <Text style={styles.processingSub}>
                Securing order with {restaurantName || 'the kitchen'}
              </Text>
            </View>
          )}

          {step === 'CONFIRMED' && (
            <View style={styles.confirmedContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-sharp" size={40} color={Colors.success} />
              </View>
              <Text style={styles.confirmedTitle}>Payment Confirmed! ✓</Text>
              <Text style={styles.confirmedRestaurant}>{restaurantName || 'Restaurant'}</Text>
              <View style={styles.orderIdPill}>
                <Text style={styles.orderIdText}>Order #{confirmedOrderNumber || confirmedOrderId}</Text>
              </View>
              <Text style={styles.confirmedMessage}>
                Your order is awaiting restaurant acceptance.
              </Text>
            </View>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            {step === 'REVIEW' && (
              <Button
                title={`Continue to Secure Payment (${totalItems} items)`}
                onPress={handleProceedToPayment}
                variant="primary"
                size="lg"
                fullWidth={true}
              />
            )}
            {step === 'CONFIRMED' && (
              <View style={styles.confirmedBtnCol}>
                <Button
                  title="Track Order in Activity"
                  onPress={handleFinish}
                  variant="primary"
                  size="lg"
                  fullWidth={true}
                  style={styles.trackBtn}
                />
                <Button
                  title="Back to Home"
                  onPress={onClose}
                  variant="ghost"
                  size="md"
                  fullWidth={true}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      {createdOrder && (
        <PaymentCheckoutModal
          visible={showPaymentModal}
          onClose={handlePaymentClose}
          onPaymentSuccess={handlePaymentSuccess}
          restaurantName={restaurantName || 'Restaurant'}
          restaurantId={createdOrder.restaurantId}
          orderId={createdOrder.id}
          amountTzs={createdOrder.subtotalTzs}
          deliveryFee={createdOrder.deliveryFeeTzs}
          serviceFee={createdOrder.serviceFeeTzs}
          initialMethodCode={selectedMethod}
          initialPhone={payerPhone}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 40, 30, 0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    ...Typography.H2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    maxHeight: 460,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.Label,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  restaurantName: {
    ...Typography.H2,
    color: Colors.textPrimary,
  },
  verifiedBadge: {
    marginTop: 6,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  pillBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pillTextActive: {
    color: Colors.white,
  },
  inputGroup: {
    marginTop: Spacing.sm,
  },
  inputLabel: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemSummaryQty: {
    width: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  itemSummaryName: {
    flex: 1,
    ...Typography.BodyMedium,
    marginRight: Spacing.sm,
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  pmCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pmCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  pmEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  pmLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pmLabelSelected: {
    color: Colors.primaryDark,
  },
  billCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  billLabel: {
    ...Typography.Body,
    color: Colors.textSecondary,
  },
  billTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.xs,
    marginTop: 4,
  },
  billTotalLabel: {
    ...Typography.H3,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  processingTitle: {
    ...Typography.H2,
    marginTop: Spacing.md,
  },
  processingSub: {
    ...Typography.Body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  confirmedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmedTitle: {
    ...Typography.Display,
    fontSize: 24,
    color: Colors.primaryDark,
  },
  confirmedRestaurant: {
    ...Typography.H3,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  orderIdPill: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.full,
    marginTop: Spacing.sm,
  },
  orderIdText: {
    fontWeight: '700',
    color: Colors.primaryDark,
    fontSize: 14,
  },
  confirmedMessage: {
    ...Typography.Body,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  confirmedBtnCol: {
    width: '100%',
  },
  trackBtn: {
    marginBottom: Spacing.xs,
  },
  zoneCard: {
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceSecondary,
  },
  zoneCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  zoneName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  zoneNameSelected: {
    color: Colors.primaryDark,
  },
  zoneDetails: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  zoneFee: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  zoneFeeSelected: {
    color: Colors.primaryDark,
  },
});
