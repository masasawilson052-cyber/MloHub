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
import { Order, BranchDeliveryZone, CustomerSavedAddress } from '../../types/domain';
import { BranchOperationsRepository } from '../../repositories/branchOperations.repository';
import { CustomerAddressesRepository } from '../../repositories/customerAddresses.repository';
import { useCustomerLocation } from '../../context/CustomerLocationContext';
import { PaymentCheckoutModal } from '../PaymentCheckoutModal';
import { DeliveryQuoteApi, DeliveryQuoteResult } from '../../services/api/DeliveryQuoteApi';
import { MOBILE_MONEY_METHODS } from '../../constants/paymentMethods';
import { PaymentProviderLogo } from '../payments/PaymentProviderLogo';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

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
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
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
    minimumOrderValueTzs,
  } = useCart();

  const [step, setStep] = useState<CheckoutStep>('REVIEW');
  const [fulfillment, setFulfillment] = useState<'Delivery' | 'Takeaway' | 'Dine-In'>('Delivery');
  const { location: customerLocation, openLocationSelector } = useCustomerLocation();
  const [savedAddresses, setSavedAddresses] = useState<CustomerSavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(customerLocation.savedAddressId || null);
  const [deliveryAddress, setDeliveryAddress] = useState(
    customerLocation.addressLine
      ? `${customerLocation.addressLine}${customerLocation.landmark ? ` (${customerLocation.landmark})` : ''}${customerLocation.serviceAreaName ? `, ${customerLocation.serviceAreaName}` : ''}`
      : (user?.location || '')
  );
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

  // Load customer saved addresses
  useEffect(() => {
    let isMounted = true;
    if (visible && user?.id) {
      CustomerAddressesRepository.list(user.id)
        .then((addrs) => {
          if (!isMounted) return;
          setSavedAddresses(addrs);
          if (!deliveryAddress && addrs.length > 0) {
            const def = addrs.find((a) => a.isDefault) || addrs[0];
            setSelectedAddressId(def.id);
            setDeliveryAddress(
              `${def.streetAddress}${def.deliveryInstructions ? ` (${def.deliveryInstructions})` : ''}${def.areaName ? `, ${def.areaName}` : ''}`
            );
          }
        })
        .catch((err) => console.warn('OrderReviewModal: Failed to load saved addresses', err));
    }
    return () => {
      isMounted = false;
    };
  }, [visible, user?.id]);

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
              // If customer location matches a zone name, auto-select it
              if (customerLocation.serviceAreaName) {
                const match = zones.find(
                  (z) => z.zoneName.toLowerCase() === customerLocation.serviceAreaName?.toLowerCase()
                );
                if (match) return match;
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
  }, [visible, fulfillment, effectiveBranchId, customerLocation.serviceAreaName]);

  useEffect(() => {
    if (!deliveryAddress && customerLocation.addressLine) {
      setDeliveryAddress(
        `${customerLocation.addressLine}${customerLocation.landmark ? ` (${customerLocation.landmark})` : ''}${customerLocation.serviceAreaName ? `, ${customerLocation.serviceAreaName}` : ''}`
      );
    }
    if (user?.phone && !payerPhone) {
      setPayerPhone(user.phone);
    }
  }, [user, customerLocation]);

  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuoteResult | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isOutsideDeliveryRange, setIsOutsideDeliveryRange] = useState(false);

  const destinationCoords = React.useMemo(() => {
    if (selectedAddressId) {
      const selected = savedAddresses.find((a) => a.id === selectedAddressId);
      if (selected?.latitude != null && selected?.longitude != null) {
        return { latitude: selected.latitude, longitude: selected.longitude };
      }
    }
    if (customerLocation.latitude != null && customerLocation.longitude != null) {
      return { latitude: customerLocation.latitude, longitude: customerLocation.longitude };
    }
    return null;
  }, [selectedAddressId, savedAddresses, customerLocation.latitude, customerLocation.longitude]);

  // Debounced route-based delivery quote calculation
  useEffect(() => {
    let isMounted = true;
    if (visible && fulfillment === 'Delivery' && effectiveBranchId) {
      if (destinationCoords) {
        setIsLoadingQuote(true);
        setQuoteError(null);
        setIsOutsideDeliveryRange(false);

        const timer = setTimeout(async () => {
          try {
            const quote = await DeliveryQuoteApi.getQuote({
              branchId: effectiveBranchId,
              destinationLatitude: destinationCoords.latitude,
              destinationLongitude: destinationCoords.longitude,
            });
            if (!isMounted) return;
            setDeliveryQuote(quote);
            setIsOutsideDeliveryRange(false);
            setQuoteError(null);
          } catch (err: any) {
            if (!isMounted) return;
            console.warn('[OrderReviewModal] Quote error:', err);
            const isOutside =
              err?.code === 'OUTSIDE_DELIVERY_RANGE' ||
              (err?.message && err.message.includes('OUTSIDE_DELIVERY_RANGE'));
            if (isOutside) {
              setIsOutsideDeliveryRange(true);
              setQuoteError(
                err?.message ||
                  'The delivery location is outside the maximum delivery radius for this branch.'
              );
            } else {
              setQuoteError(err?.message || 'Could not compute delivery quote.');
            }
            setDeliveryQuote(null);
          } finally {
            if (isMounted) setIsLoadingQuote(false);
          }
        }, 350);

        return () => {
          clearTimeout(timer);
        };
      } else {
        setDeliveryQuote(null);
        setIsLoadingQuote(false);
      }
    } else {
      setDeliveryQuote(null);
      setIsOutsideDeliveryRange(false);
      setQuoteError(null);
      setIsLoadingQuote(false);
    }
    return () => {
      isMounted = false;
    };
  }, [visible, fulfillment, effectiveBranchId, destinationCoords]);

  const currentQuote = React.useMemo(() => {
    let fee = 0;
    if (fulfillment === 'Delivery') {
      if (deliveryQuote) {
        fee = deliveryQuote.deliveryFeeTzs;
      } else if (selectedDeliveryZone) {
        fee = selectedDeliveryZone.feeTzs;
      }
    }
    return getOrderQuote(fulfillment, fee);
  }, [getOrderQuote, fulfillment, deliveryQuote, selectedDeliveryZone]);

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

    // Enforce platform minimum order value for all orders
    const platformMin = minimumOrderValueTzs || 2000;
    if (currentQuote.subtotalTzs < platformMin) {
      Alert.alert(
        'Minimum Order Required',
        `The platform minimum order subtotal is TZS ${platformMin.toLocaleString()}. Your current subtotal is TZS ${currentQuote.subtotalTzs.toLocaleString()}.`
      );
      return;
    }

    if (fulfillment === 'Delivery') {
      if (isOutsideDeliveryRange) {
        Alert.alert(
          'Outside Delivery Range',
          quoteError || 'The delivery location is outside the maximum delivery radius for this branch. Please choose Takeaway or Dine-In.'
        );
        return;
      }
      if (!deliveryAddress.trim()) {
        Alert.alert(
          'Delivery Address Required',
          'Please enter a delivery address for your order.'
        );
        return;
      }
      if (!deliveryQuote && !selectedDeliveryZone) {
        Alert.alert(
          'Delivery Route Calculation Required',
          'Please set your delivery location on the map to compute your driving route and delivery fee.'
        );
        return;
      }
      if (selectedDeliveryZone) {
        const zoneMin = selectedDeliveryZone.minimumOrderTzs || 0;
        const effectiveMinimum = Math.max(platformMin, zoneMin);
        if (currentQuote.subtotalTzs < effectiveMinimum) {
          Alert.alert(
            'Minimum Order Required',
            `The minimum order for ${selectedDeliveryZone.zoneName} is TZS ${effectiveMinimum.toLocaleString()}. Your current subtotal is TZS ${currentQuote.subtotalTzs.toLocaleString()}.`
          );
          return;
        }
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
          selected_modifiers: it.rpcModifiersPayload || null,
          selectedModifiers: it.selectedModifiers || null,
          special_instructions: it.notes || undefined,
        })),
        diningOption: fulfillment,
        deliveryAddress: fulfillment === 'Delivery' ? deliveryAddress.trim() : undefined,
        deliveryQuoteId: fulfillment === 'Delivery' ? (deliveryQuote?.id || undefined) : undefined,
        deliveryZoneId: fulfillment === 'Delivery' ? (selectedDeliveryZone?.id || undefined) : undefined,
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

  const handlePaymentVerified = (payment: PaymentTransactionEntity) => {
    // Verified in background by server - clear cart, keep modal on SUCCESS screen until Continue
    clearCart();
  };

  const handleFlowComplete = (payment: PaymentTransactionEntity) => {
    setShowPaymentModal(false);
    clearCart();
    setStep('CONFIRMED');
  };

  const handlePaymentSuccess = (payment: PaymentTransactionEntity) => {
    clearCart();
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
                <Ionicons name="close" size={22} color={colors.textPrimary} />
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
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.inputLabel}>
                          Delivery Address ({customerLocation.cityName || 'Tanzania'})
                        </Text>
                        <TouchableOpacity onPress={openLocationSelector}>
                          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                            📍 Change Location
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Saved Addresses quick pills */}
                      {savedAddresses.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {savedAddresses.map((addr) => {
                            const isSelected = selectedAddressId === addr.id;
                            return (
                              <TouchableOpacity
                                key={addr.id}
                                style={[
                                  styles.pillBtn,
                                  isSelected && styles.pillBtnActive,
                                  { paddingHorizontal: 10, paddingVertical: 5 },
                                ]}
                                onPress={() => {
                                  setSelectedAddressId(addr.id);
                                  setDeliveryAddress(
                                    `${addr.streetAddress}${addr.deliveryInstructions ? ` (${addr.deliveryInstructions})` : ''}${addr.areaName ? `, ${addr.areaName}` : ''}`
                                  );
                                  if (addr.areaName && deliveryZones.length > 0) {
                                    const matched = deliveryZones.find(
                                      (z) =>
                                        z.zoneName.toLowerCase() === addr.areaName?.toLowerCase() ||
                                        (z.supportedWards &&
                                          z.supportedWards.some((w) => w.toLowerCase() === addr.areaName?.toLowerCase()))
                                    );
                                    if (matched) setSelectedDeliveryZone(matched);
                                  }
                                }}
                              >
                                <Text style={[styles.pillText, isSelected && styles.pillTextActive, { fontSize: 12 }]}>
                                  {addr.label === 'HOME' ? '🏠 Home' : addr.label === 'WORK' ? '🏢 Work' : `📍 ${addr.label || 'Saved'}`}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      <TextInput
                        style={styles.textInput}
                        value={deliveryAddress}
                        onChangeText={(txt) => {
                          setDeliveryAddress(txt);
                          setSelectedAddressId(null);
                        }}
                        placeholder="e.g. Street name, House/Flat number, Landmark"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Route & Delivery Pricing</Text>
                      {isLoadingQuote ? (
                        <View style={[styles.routeQuoteCard, { borderColor: colors.border, backgroundColor: colors.surfaceInteractive }]}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={[styles.routeQuoteText, { color: colors.textSecondary }]}>
                            Calculating live driving route & transit fee...
                          </Text>
                        </View>
                      ) : isOutsideDeliveryRange ? (
                        <View style={[styles.routeQuoteCard, { borderColor: colors.danger, backgroundColor: colors.dangerSoft || '#FEE2E2' }]}>
                          <Ionicons name="warning-outline" size={20} color={colors.danger} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>
                              Outside Delivery Radius
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.danger, marginTop: 2 }}>
                              {quoteError || 'Selected destination exceeds the maximum delivery radius for this branch. Please choose Takeaway or Dine-In.'}
                            </Text>
                          </View>
                        </View>
                      ) : deliveryQuote ? (
                        <View style={[styles.routeQuoteCard, { borderColor: colors.primary, backgroundColor: colors.surfaceInteractive }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name="navigate-circle" size={24} color={colors.primary} />
                              <View>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                                  {DeliveryQuoteApi.formatDistance(deliveryQuote.distanceMeters)} • {DeliveryQuoteApi.formatDuration(deliveryQuote.durationSeconds)}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                  Route verified by server
                                  {deliveryQuote.isProvisional ? ' (Standard Rate)' : ''}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: colors.primary }}>
                              TZS {deliveryQuote.deliveryFeeTzs.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      ) : !destinationCoords ? (
                        <TouchableOpacity
                          style={[styles.routeQuoteCard, { borderColor: colors.border, backgroundColor: colors.surfaceHover }]}
                          onPress={openLocationSelector}
                        >
                          <Ionicons name="location-outline" size={20} color={colors.primary} />
                          <Text style={[styles.routeQuoteText, { color: colors.primary, fontWeight: '600' }]}>
                            Pin your exact location on map to calculate delivery route & fee
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Delivery Area</Text>
                      {isLoadingZones ? (
                        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Loading delivery areas...</Text>
                        </View>
                      ) : zoneLoadError ? (
                        <Text style={{ fontSize: 12, color: colors.danger, marginVertical: 4 }}>{zoneLoadError}</Text>
                      ) : deliveryZones.length === 0 ? (
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginVertical: 4 }}>
                          {deliveryQuote ? 'Delivery available via verified route pricing.' : 'No delivery areas found for this branch. Please choose Takeaway or Dine-In.'}
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
                  {MOBILE_MONEY_METHODS.map((pm) => (
                    <TouchableOpacity
                      key={pm.id}
                      style={[
                        styles.pmCard,
                        selectedMethod === pm.id && styles.pmCardSelected,
                      ]}
                      onPress={() => setSelectedMethod(pm.id as PaymentMethodCode)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={pm.displayName}
                    >
                      <PaymentProviderLogo methodCode={pm.id} size={45} />
                      <Text
                        style={[
                          styles.pmLabel,
                          selectedMethod === pm.id && styles.pmLabelSelected,
                        ]}
                      >
                        {pm.displayName}
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
                  {fulfillment === 'Delivery' && !deliveryQuote && !selectedDeliveryZone ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                      Set location or area to calculate delivery fee
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
                    color={colors.primaryDark}
                  />
                </View>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
                  {pricingDisclaimer || 'Estimate — final total is revalidated by the restaurant branch.'}
                </Text>
              </View>
            </ScrollView>
          )}

          {step === 'PROCESSING' && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.processingTitle}>Creating Order...</Text>
              <Text style={styles.processingSub}>
                Securing order with {restaurantName || 'the kitchen'}
              </Text>
            </View>
          )}

          {step === 'CONFIRMED' && (
            <View style={styles.confirmedContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-sharp" size={40} color={colors.success} />
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
          onPaymentVerified={handlePaymentVerified}
          onFlowComplete={handleFlowComplete}
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 40, 30, 0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.card,
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
    borderBottomColor: colors.divider,
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
    backgroundColor: colors.surfaceInteractive,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.Label,
    color: colors.textMuted,
    marginBottom: Spacing.xs,
  },
  restaurantName: {
    ...Typography.H2,
    color: colors.textPrimary,
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
    backgroundColor: colors.card,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  pillBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pillTextActive: {
    color: colors.onPrimary,
  },
  inputGroup: {
    marginTop: Spacing.sm,
  },
  inputLabel: {
    ...Typography.Caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemSummaryQty: {
    width: 28,
    fontWeight: '700',
    color: colors.primary,
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
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    minHeight: 60,
    backgroundColor: colors.card,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pmCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pmEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  pmLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pmLabelSelected: {
    color: colors.primary,
  },
  billCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textSecondary,
  },
  billTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
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
    borderTopColor: colors.divider,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmedTitle: {
    ...Typography.Display,
    fontSize: 24,
    color: colors.primary,
  },
  confirmedRestaurant: {
    ...Typography.H3,
    color: colors.textSecondary,
    marginTop: 4,
  },
  orderIdPill: {
    backgroundColor: colors.primarySoft,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.full,
    marginTop: Spacing.sm,
  },
  orderIdText: {
    fontWeight: '700',
    color: colors.primary,
    fontSize: 14,
  },
  confirmedMessage: {
    ...Typography.Body,
    textAlign: 'center',
    color: colors.textSecondary,
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
    borderColor: colors.divider,
    backgroundColor: colors.surfaceInteractive,
  },
  zoneCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  zoneName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  zoneNameSelected: {
    color: colors.primary,
  },
  zoneDetails: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  zoneFee: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  zoneFeeSelected: {
    color: colors.primary,
  },
  routeQuoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginTop: 4,
    gap: 8,
  },
  routeQuoteText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
let styles = createStyles(lightColors);
