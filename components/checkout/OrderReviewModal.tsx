import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, formatItemCount } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useFeeRules } from '../../hooks/useFeeRules';
import { OrderService } from '../../services/OrderService';
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
import { generatePaymentAttemptId } from '../payments/paymentFlow';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { FulfillmentSelector, FulfillmentType } from './FulfillmentSelector';
import { DeliveryMinimumNudge } from './DeliveryMinimumNudge';
import { CheckoutSignInPanel } from './CheckoutSignInPanel';
import { CheckoutErrorBanner } from './CheckoutErrorBanner';
import { deliveryMinimumShortfall } from '../../config/platformFees';

let colors: ThemeColors = lightColors;

export interface OrderReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onOrderConfirmed: (orderId: string) => void;
  isVerifiedRestaurant?: boolean;
}

type CheckoutStep = 'REVIEW' | 'PROCESSING' | 'CONFIRMED';

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  visible,
  onClose,
  onOrderConfirmed,
  isVerifiedRestaurant = false,
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { feeRules } = useFeeRules();

  const {
    items,
    restaurantId,
    restaurantName,
    branchId,
    clearCart,
    getOrderQuote,
    pricingDisclaimer,
    totalItems,
    deliveryPricingMode,
    supportsDelivery,
  } = useCart();

  const [step, setStep] = useState<CheckoutStep>('REVIEW');
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('Delivery');
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
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showSignInPanel, setShowSignInPanel] = useState(false);

  // Double-tap & idempotency defense
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const paymentAttemptIdRef = useRef<string>(generatePaymentAttemptId());

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

  // Load branch delivery zones
  useEffect(() => {
    let isMounted = true;
    if (visible && fulfillment === 'Delivery' && effectiveBranchId) {
      setIsLoadingZones(true);
      BranchOperationsRepository.getDeliveryZones(effectiveBranchId)
        .then((zones) => {
          if (!isMounted) return;
          setDeliveryZones(zones);
          if (zones.length > 0) {
            setSelectedDeliveryZone((prev) => {
              if (prev && zones.some((z) => z.id === prev.id)) {
                return zones.find((z) => z.id === prev.id) || zones[0];
              }
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
        .catch(() => {
          if (!isMounted) return;
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

  const destinationCoords = useMemo(() => {
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
    if (visible && fulfillment === 'Delivery' && effectiveBranchId && destinationCoords) {
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
      setIsOutsideDeliveryRange(false);
      setQuoteError(null);
      setIsLoadingQuote(false);
    }
    return () => {
      isMounted = false;
    };
  }, [visible, fulfillment, effectiveBranchId, destinationCoords]);

  const currentQuote = useMemo(() => {
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

  // Delivery shortfall calculation using config/platformFees.ts
  const deliveryShortfall = useMemo(() => {
    if (fulfillment !== 'Delivery') return 0;
    return deliveryMinimumShortfall(
      currentQuote.subtotalTzs,
      feeRules,
      selectedDeliveryZone?.minimumOrderTzs
    );
  }, [fulfillment, currentQuote.subtotalTzs, feeRules, selectedDeliveryZone]);

  const isDeliveryUnderMinimum = fulfillment === 'Delivery' && deliveryShortfall > 0;

  if (!visible) return null;

  const handleProceedToPayment = async () => {
    setCheckoutError(null);

    // 1. Authenticated user required before order placement
    if (!user?.id) {
      setShowSignInPanel(true);
      return;
    }

    if (!effectiveBranchId) {
      setCheckoutError(t('branchRequired'));
      return;
    }

    // 2. Minimum order verification
    if (isDeliveryUnderMinimum) {
      setCheckoutError(t('deliveryMinimumNotMet'));
      return;
    }

    // 3. Delivery constraints
    if (fulfillment === 'Delivery') {
      if (isOutsideDeliveryRange) {
        setCheckoutError(quoteError || t('deliveryRangeExceeded'));
        return;
      }
      if (!deliveryAddress.trim()) {
        setCheckoutError(t('deliveryAddressRequired'));
        return;
      }
      if (!deliveryQuote && !selectedDeliveryZone) {
        setCheckoutError('Please set your delivery location on the map to compute your driving route and delivery fee.');
        return;
      }
    }

    if (!payerPhone.trim()) {
      setCheckoutError(t('phoneRequired'));
      return;
    }

    // Double-tap protection: check in-flight submission ref
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // If an order was already created for this checkout attempt, reuse it directly
    if (createdOrder) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setShowPaymentModal(true);
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
      setCheckoutError(err?.message || t('orderFailed'));
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handlePaymentVerified = (_payment: PaymentTransactionEntity) => {
    clearCart();
  };

  const handleFlowComplete = (_payment: PaymentTransactionEntity) => {
    setShowPaymentModal(false);
    clearCart();
    setStep('CONFIRMED');
  };

  const handlePaymentClose = () => {
    setShowPaymentModal(false);
    // User closed payment incomplete; generate a fresh payment attempt ID for subsequent retry
    paymentAttemptIdRef.current = generatePaymentAttemptId();
    setCheckoutError(t('paymentIncomplete'));
  };

  const handleFinish = () => {
    onOrderConfirmed(confirmedOrderId);
    setStep('REVIEW');
    setCreatedOrder(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
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
              {/* Inline Error Banner */}
              <CheckoutErrorBanner
                colors={colors}
                message={checkoutError}
                onDismiss={() => setCheckoutError(null)}
              />

              {/* Inline Sign-In / Quick Sign-Up Panel */}
              {showSignInPanel && !user?.id && (
                <CheckoutSignInPanel
                  colors={colors}
                  onSuccess={() => setShowSignInPanel(false)}
                  onCancel={() => setShowSignInPanel(false)}
                />
              )}

              {/* Restaurant Banner */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Restaurant</Text>
                <Text style={styles.restaurantName}>{restaurantName || 'Restaurant'}</Text>
                {isVerifiedRestaurant ? (
                  <Badge label="Verified Kitchen" variant="success" size="sm" style={styles.verifiedBadge} />
                ) : null}
              </View>

              {/* Smart Fulfillment Selector */}
              <View style={styles.sectionCard}>
                <FulfillmentSelector
                  colors={colors}
                  language={language}
                  pricingMode={deliveryPricingMode}
                  deliveryZones={deliveryZones}
                  selectedFulfillment={fulfillment}
                  onSelectFulfillment={setFulfillment}
                  disabled={isSubmitting}
                />

                {fulfillment === 'Delivery' && (
                  <>
                    {/* Delivery Minimum Nudge (Meituan Style) */}
                    <DeliveryMinimumNudge
                      colors={colors}
                      language={language}
                      subtotalTzs={currentQuote.subtotalTzs}
                      feeRules={feeRules}
                      zoneMinimumTzs={selectedDeliveryZone?.minimumOrderTzs}
                      takeawayAvailable={true}
                      onBackToMenu={onClose}
                      onSwitchToTakeaway={() => setFulfillment('Takeaway')}
                    />

                    <View style={styles.inputGroup}>
                      <View style={styles.addressHeaderRow}>
                        <Text style={styles.inputLabel}>
                          Delivery Address ({customerLocation.cityName || 'Tanzania'})
                        </Text>
                        <TouchableOpacity onPress={openLocationSelector}>
                          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                            📍 Change Location
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {savedAddresses.length > 0 && (
                        <View style={styles.savedAddrsRow}>
                          {savedAddresses.map((addr) => {
                            const isSelected = selectedAddressId === addr.id;
                            return (
                              <TouchableOpacity
                                key={addr.id}
                                style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                                onPress={() => {
                                  setSelectedAddressId(addr.id);
                                  setDeliveryAddress(
                                    `${addr.streetAddress}${addr.deliveryInstructions ? ` (${addr.deliveryInstructions})` : ''}${addr.areaName ? `, ${addr.areaName}` : ''}`
                                  );
                                }}
                              >
                                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
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
                        placeholderTextColor={colors.inputPlaceholder}
                      />
                    </View>

                    {/* Route quote card */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Route & Delivery Pricing</Text>
                      {isLoadingQuote ? (
                        <View style={[styles.routeQuoteCard, { borderColor: colors.border }]}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={[styles.routeQuoteText, { color: colors.textSecondary }]}>
                            Calculating live driving route & transit fee...
                          </Text>
                        </View>
                      ) : isOutsideDeliveryRange ? (
                        <View style={[styles.routeQuoteCard, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
                          <Ionicons name="warning-outline" size={20} color={colors.danger} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>
                              Outside Delivery Radius
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.danger, marginTop: 2 }}>
                              {quoteError || t('deliveryRangeExceeded')}
                            </Text>
                          </View>
                        </View>
                      ) : deliveryQuote ? (
                        <View style={[styles.routeQuoteCard, { borderColor: colors.primary, backgroundColor: colors.surfaceInteractive }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name="navigate-circle" size={24} color={colors.primary} />
                              <View>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                                  {DeliveryQuoteApi.formatDistance(deliveryQuote.distanceMeters)} • {DeliveryQuoteApi.formatDuration(deliveryQuote.durationSeconds)}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                  Route verified by server
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: colors.primary }}>
                              TZS {deliveryQuote.deliveryFeeTzs.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      ) : !destinationCoords ? (
                        <TouchableOpacity style={[styles.routeQuoteCard, { borderColor: colors.border }]} onPress={openLocationSelector}>
                          <Ionicons name="location-outline" size={20} color={colors.primary} />
                          <Text style={[styles.routeQuoteText, { color: colors.primary, fontWeight: '600' }]}>
                            Pin your exact location on map to calculate delivery route & fee
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Delivery zones if FIXED_ZONE */}
                    {deliveryPricingMode === 'FIXED_ZONE' && deliveryZones.length > 0 && (
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Delivery Area</Text>
                        {isLoadingZones ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <View style={{ gap: 6, marginTop: 4 }}>
                            {deliveryZones.map((zone) => {
                              const isSelected = selectedDeliveryZone?.id === zone.id;
                              return (
                                <TouchableOpacity
                                  key={zone.id}
                                  style={[styles.zoneCard, isSelected && styles.zoneCardSelected]}
                                  onPress={() => setSelectedDeliveryZone(zone)}
                                >
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={[styles.zoneName, isSelected && styles.zoneNameSelected]}>{zone.zoneName}</Text>
                                      <Text style={styles.zoneDetails}>
                                        Est. {zone.estimatedDeliveryMinutes} mins
                                        {zone.minimumOrderTzs > 0 ? ` • Min. TZS ${zone.minimumOrderTzs.toLocaleString()}` : ''}
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
                    )}
                  </>
                )}
              </View>

              {/* Items Summary */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>
                  {language === 'sw' ? 'Vitu Vilivyochaguliwa' : 'Items Ordered'} ({formatItemCount(totalItems, language)})
                </Text>
                {items.map((it) => (
                  <View key={it.dishId} style={styles.itemSummaryRow}>
                    <Text style={styles.itemSummaryQty}>{it.quantity}x</Text>
                    <Text style={styles.itemSummaryName} numberOfLines={1}>{it.dishName}</Text>
                    <PriceText amountTzs={it.priceTzs * it.quantity} size="sm" />
                  </View>
                ))}
              </View>

              {/* Payment Methods */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Payment Method (Mobile Money & Bank)</Text>
                <View style={styles.paymentMethodsGrid}>
                  {MOBILE_MONEY_METHODS.map((pm) => (
                    <TouchableOpacity
                      key={pm.id}
                      style={[styles.pmCard, selectedMethod === pm.id && styles.pmCardSelected]}
                      onPress={() => setSelectedMethod(pm.id as PaymentMethodCode)}
                    >
                      <PaymentProviderLogo methodCode={pm.id} size={45} />
                      <Text style={[styles.pmLabel, selectedMethod === pm.id && styles.pmLabelSelected]}>
                        {pm.displayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Account / Phone Number</Text>
                  <TextInput
                    style={styles.textInput}
                    value={payerPhone}
                    onChangeText={setPayerPhone}
                    keyboardType="phone-pad"
                    placeholder="+255 7XX XXX XXX"
                    placeholderTextColor={colors.inputPlaceholder}
                  />
                </View>
              </View>

              {/* Bill Breakdown */}
              <View style={styles.billCard}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>
                    {language === 'sw' ? 'Jumla ya Chakula' : 'Estimated Subtotal'}
                  </Text>
                  <PriceText amountTzs={currentQuote.subtotalTzs} size="sm" />
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>
                    {language === 'sw' ? 'Gharama ya Kuletewa' : 'Estimated Delivery Fee'}
                  </Text>
                  {fulfillment === 'Delivery' && !deliveryQuote && !selectedDeliveryZone ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                      Set location to calculate delivery fee
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
                  <Text style={styles.billTotalLabel}>{t('estimatedTotal')}</Text>
                  <PriceText amountTzs={currentQuote.totalTzs} size="lg" color={colors.primaryDark} />
                </View>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
                  {pricingDisclaimer}
                </Text>
              </View>
            </ScrollView>
          )}

          {step === 'PROCESSING' && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.processingTitle}>Creating Order...</Text>
              <Text style={styles.processingSub}>Securing order with {restaurantName || 'the kitchen'}</Text>
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
              <Text style={styles.confirmedMessage}>Your order is awaiting restaurant acceptance.</Text>
            </View>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            {step === 'REVIEW' && (
              <Button
                title={
                  isDeliveryUnderMinimum
                    ? `${t('deliveryMinimumNotMet')}`
                    : `Continue to Secure Payment (${formatItemCount(totalItems, language)})`
                }
                onPress={handleProceedToPayment}
                variant="primary"
                size="lg"
                fullWidth={true}
                disabled={isSubmitting || isDeliveryUnderMinimum}
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
          totalTzs={createdOrder.totalTzs}
          initialMethodCode={selectedMethod}
          initialPhone={payerPhone}
        />
      )}
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    inputGroup: {
      marginTop: Spacing.sm,
    },
    addressHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    savedAddrsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    pillBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: colors.card,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    pillTextActive: {
      color: colors.onPrimary,
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
  });
