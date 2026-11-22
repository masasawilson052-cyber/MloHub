import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, formatItemCount } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useFeeRules } from '../../hooks/useFeeRules';
import { OrderService } from '../../services/OrderService';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PaymentMethodCode, PaymentTransactionEntity } from '../../db/types';
import { Order } from '../../types/domain';
import { useCustomerLocation } from '../../context/CustomerLocationContext';
import { PaymentCheckoutModal } from '../PaymentCheckoutModal';
import { generatePaymentAttemptId } from '../payments/paymentFlow';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { FulfillmentSelector, FulfillmentType } from './FulfillmentSelector';
import { DeliveryMinimumNudge } from './DeliveryMinimumNudge';
import { CheckoutSignInPanel } from './CheckoutSignInPanel';
import { CheckoutErrorBanner } from './CheckoutErrorBanner';
import { FeeBreakdown } from './FeeBreakdown';
import { OrderConfirmationView } from './OrderConfirmationView';
import { CheckoutAddressSection } from './CheckoutAddressSection';
import { CheckoutItemsList } from './CheckoutItemsList';
import { CheckoutPaymentMethodSection } from './CheckoutPaymentMethodSection';
import { createOrderReviewStyles } from './orderReviewStyles';
import { useCheckoutDeliveryZones } from '../../hooks/useCheckoutDeliveryZones';
import { useOrderDeliveryQuote } from '../../hooks/useOrderDeliveryQuote';
import { useCustomerAddressSync } from '../../hooks/useCustomerAddressSync';
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
  const styles = createOrderReviewStyles(colors);
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
    totalItems,
    deliveryPricingMode,
  } = useCart();

  const [step, setStep] = useState<CheckoutStep>('REVIEW');
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('Delivery');
  const { location: customerLocation, openLocationSelector } = useCustomerLocation();

  const {
    savedAddresses,
    selectedAddressId,
    setSelectedAddressId,
    deliveryAddress,
    setDeliveryAddress,
    destinationCoords,
  } = useCustomerAddressSync({
    visible,
    userId: user?.id,
    initialLocation: user?.location || '',
    customerLocation,
  });

  const [payerPhone, setPayerPhone] = useState(user?.phone || '');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodCode>('MPESA');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string>('');
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showSignInPanel, setShowSignInPanel] = useState(false);

  // Double-tap & idempotency defense
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const paymentAttemptIdRef = useRef<string>(generatePaymentAttemptId());

  const effectiveBranchId = branchId || (items.length > 0 ? items[0].branchId : null);

  // Load branch delivery zones
  const {
    deliveryZones,
    isLoadingZones,
    selectedDeliveryZone,
    setSelectedDeliveryZone,
  } = useCheckoutDeliveryZones({
    visible,
    fulfillment,
    effectiveBranchId,
    serviceAreaName: customerLocation.serviceAreaName,
  });

  useEffect(() => {
    if (user?.phone && !payerPhone) {
      setPayerPhone(user.phone);
    }
  }, [user]);

  // Debounced route-based delivery quote calculation
  const {
    deliveryQuote,
    isLoadingQuote,
    quoteError,
    isOutsideDeliveryRange,
  } = useOrderDeliveryQuote({
    visible,
    fulfillment,
    effectiveBranchId,
    destinationCoords,
  });

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
        deliveryQuoteId: fulfillment === 'Delivery' ? deliveryQuote?.id : undefined,
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
              {step === 'CONFIRMED' ? t('checkoutConfirmedTitle') : t('checkoutReviewTitle')}
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
                <Text style={styles.sectionLabel}>{t('checkoutRestaurantSection')}</Text>
                <Text style={styles.restaurantName}>{restaurantName || 'Restaurant'}</Text>
                {isVerifiedRestaurant ? (
                  <Badge label={t('verifiedKitchen')} variant="success" size="sm" style={styles.verifiedBadge} />
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
                    {/* Delivery Minimum Nudge */}
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

                    <CheckoutAddressSection
                      colors={colors}
                      customerLocation={customerLocation}
                      openLocationSelector={openLocationSelector}
                      savedAddresses={savedAddresses}
                      selectedAddressId={selectedAddressId}
                      onSelectSavedAddress={(addr) => {
                        setSelectedAddressId(addr.id);
                        setDeliveryAddress(
                          `${addr.streetAddress}${addr.deliveryInstructions ? ` (${addr.deliveryInstructions})` : ''}${addr.areaName ? `, ${addr.areaName}` : ''}`
                        );
                      }}
                      deliveryAddress={deliveryAddress}
                      onChangeDeliveryAddress={(txt) => {
                        setDeliveryAddress(txt);
                        setSelectedAddressId(null);
                      }}
                      isLoadingQuote={isLoadingQuote}
                      isOutsideDeliveryRange={isOutsideDeliveryRange}
                      quoteError={quoteError}
                      deliveryQuote={deliveryQuote}
                      destinationCoords={destinationCoords}
                      deliveryPricingMode={deliveryPricingMode}
                      deliveryZones={deliveryZones}
                      isLoadingZones={isLoadingZones}
                      selectedDeliveryZone={selectedDeliveryZone}
                      onSelectDeliveryZone={setSelectedDeliveryZone}
                    />
                  </>
                )}
              </View>

              {/* Items Summary */}
              <CheckoutItemsList
                colors={colors}
                items={items}
                totalItems={totalItems}
              />

              {/* Payment Methods */}
              <CheckoutPaymentMethodSection
                colors={colors}
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
                payerPhone={payerPhone}
                onChangePayerPhone={setPayerPhone}
              />

              {/* Bill Breakdown */}
              <View style={styles.billCard}>
                <FeeBreakdown
                  subtotalTzs={currentQuote.subtotalTzs}
                  deliveryFeeTzs={
                    fulfillment === 'Delivery'
                      ? (deliveryQuote || selectedDeliveryZone ? currentQuote.deliveryFeeTzs : undefined)
                      : 0
                  }
                  serviceFeeTzs={currentQuote.serviceFeeTzs}
                  totalTzs={currentQuote.totalTzs}
                  showDisclaimer={true}
                  disclaimerText={t('checkoutPricingDisclaimer')}
                />
              </View>
            </ScrollView>
          )}

          {step === 'PROCESSING' && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.processingTitle}>{t('checkoutCreatingOrder')}</Text>
              <Text style={styles.processingSub}>
                {t('checkoutSecuringOrder').replace('{restaurant}', restaurantName || 'the kitchen')}
              </Text>
            </View>
          )}

          {step === 'CONFIRMED' && (
            <OrderConfirmationView
              orderNumber={confirmedOrderNumber || confirmedOrderId}
              restaurantName={restaurantName || 'Restaurant'}
              items={items.map((it) => ({
                dishName: it.dishName, quantity: it.quantity, priceTzs: it.priceTzs, selectedModifiers: it.selectedModifiers,
              }))}
              foodSubtotalTzs={createdOrder?.subtotalTzs ?? currentQuote.subtotalTzs}
              deliveryFeeTzs={createdOrder?.deliveryFeeTzs ?? currentQuote.deliveryFeeTzs}
              serviceFeeTzs={createdOrder?.serviceFeeTzs ?? currentQuote.serviceFeeTzs}
              totalPaidTzs={createdOrder?.totalTzs ?? currentQuote.totalTzs}
              fulfillmentType={fulfillment}
              estimatedPrepMinutes={createdOrder?.estimatedPrepMinutes ?? null}
              estimatedDeliveryMinutes={deliveryQuote?.durationSeconds ? Math.ceil(deliveryQuote.durationSeconds / 60) : selectedDeliveryZone?.estimatedDeliveryMinutes ?? null}
              status="ACCEPTED"
              onTrackOrder={handleFinish}
              onHome={onClose}
            />
          )}

          {/* Footer Actions */}
          {step === 'REVIEW' && (
            <View style={styles.footer}>
              <Button
                title={
                  isDeliveryUnderMinimum
                    ? `${t('deliveryMinimumNotMet')}`
                    : `${t('checkoutContinuePayment')} (${formatItemCount(totalItems, language)})`
                }
                onPress={handleProceedToPayment}
                variant="primary"
                size="lg"
                fullWidth={true}
                disabled={isSubmitting || isDeliveryUnderMinimum}
              />
            </View>
          )}
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
