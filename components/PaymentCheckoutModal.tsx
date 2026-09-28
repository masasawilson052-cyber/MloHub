import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useMloHubDB } from '../context/DbContext';
import {
  PaymentApi,
  PaymentInitiationResult,
} from '../services/api/PaymentApi';
import {
  PaymentMethodCode,
  PaymentType,
  PaymentTransactionEntity,
} from '../db/types';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, lightColors } from '../theme/palettes';
import {
  MOBILE_MONEY_METHODS,
  MobileMoneyMethodConfig,
  getMobileMoneyMethodConfig,
  detectCarrierFromPhone,
  PAYMENT_SECURITY_PIN_NOTICE_EN,
  PAYMENT_SECURITY_PIN_NOTICE_SW,
} from '../constants/paymentMethods';
import {
  PaymentFlowStep,
  ClassifiedPaymentFailure,
  classifyPaymentFailure,
  generatePaymentAttemptId,
  generatePaymentIdempotencyKey,
} from './payments/paymentFlow';
import { PaymentMethodCard } from './payments/PaymentMethodCard';
import { PaymentProgressIndicator } from './payments/PaymentProgressIndicator';
import { PaymentFailureSheet } from './payments/PaymentFailureSheet';
import { normalizeTanzaniaPhone, isValidTanzaniaPhone, formatTanzaniaPhoneDisplay } from '../utils/phone';

let colors: ThemeColors = lightColors;

export interface PaymentCheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  onPaymentSuccess?: (payment: PaymentTransactionEntity) => void;
  onPaymentVerified?: (payment: PaymentTransactionEntity) => void;
  onFlowComplete?: (payment: PaymentTransactionEntity) => void;
  title?: string;
  restaurantName: string;
  restaurantId: string;
  orderId?: string;
  reservationId?: string;
  customMealRequestId?: string;
  quoteId?: string;
  paymentTypeOverride?: PaymentType;
  authoritativeReservationDeposit?: boolean;
  amountTzs: number;
  isReservation?: boolean;
  deliveryFee?: number;
  serviceFee?: number;
  guestCount?: string;
  itemDescription?: string;
  initialMethodCode?: PaymentMethodCode;
  initialPhone?: string;
}

export const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  visible,
  onClose,
  onPaymentSuccess,
  onPaymentVerified,
  onFlowComplete,
  title,
  restaurantName,
  restaurantId,
  orderId,
  reservationId,
  customMealRequestId,
  quoteId,
  paymentTypeOverride,
  amountTzs,
  isReservation = false,
  deliveryFee = 0,
  serviceFee = 1500,
  guestCount = '2',
  itemDescription,
  initialMethodCode = 'MPESA',
  initialPhone,
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);
  const { language } = useLanguage();
  const { user } = useAuth();
  const { restaurants } = useMloHubDB();

  // State Machine
  const [step, setStep] = useState<PaymentFlowStep>('METHOD');
  const [selectedMethod, setSelectedMethod] = useState<MobileMoneyMethodConfig>(
    getMobileMoneyMethodConfig(initialMethodCode) || MOBILE_MONEY_METHODS[0]
  );
  const [payerPhone, setPayerPhone] = useState(
    initialPhone || user?.phone || ''
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Attempt & Polling
  const [currentAttemptId, setCurrentAttemptId] = useState<string>(generatePaymentAttemptId());
  const [initiationResult, setInitiationResult] = useState<PaymentInitiationResult | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(120);
  const [classifiedFailure, setClassifiedFailure] = useState<ClassifiedPaymentFailure | null>(null);
  const [verifiedPayment, setVerifiedPayment] = useState<PaymentTransactionEntity | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  // Calculation breakdown
  const isCustomMeal = !!customMealRequestId;
  const subtotal = Math.max(0, amountTzs);
  const currentDelivery = isReservation ? 0 : deliveryFee;
  const currentServiceFee = isReservation ? 0 : serviceFee;
  const totalBill = isReservation ? subtotal : subtotal + currentDelivery + currentServiceFee;
  const paymentType: PaymentType =
    paymentTypeOverride ||
    (isReservation
      ? 'RESERVATION_DEPOSIT_50'
      : isCustomMeal
      ? 'CUSTOM_MEAL_FULL'
      : 'ORDER_FULL');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep('METHOD');
      setSelectedMethod(getMobileMoneyMethodConfig(initialMethodCode) || MOBILE_MONEY_METHODS[0]);
      setPayerPhone(initialPhone || user?.phone || '');
      setPhoneError(null);
      setInitiationResult(null);
      setClassifiedFailure(null);
      setVerifiedPayment(null);
      setCurrentAttemptId(generatePaymentAttemptId());
    } else {
      clearTimers();
    }
  }, [visible, initialMethodCode, initialPhone, user?.phone]);

  const clearTimers = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Polling during AWAITING_APPROVAL and VERIFYING
  useEffect(() => {
    const isPollingStep = step === 'AWAITING_APPROVAL' || step === 'VERIFYING';
    if (!visible || !isPollingStep || !initiationResult?.paymentId) return;

    if (step === 'AWAITING_APPROVAL' && !countdownTimerRef.current) {
      setCountdownSeconds(120);

      countdownTimerRef.current = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearTimers();
            setStep('EXPIRED');
            setClassifiedFailure(
              classifyPaymentFailure(
                language === 'sw'
                  ? 'Muda wa kuthibitisha malipo umekwisha.'
                  : 'Payment confirmation timed out.',
                'EXPIRED'
              )
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Polling function
    const checkStatus = async () => {
      if (!initiationResult?.paymentId) return;
      try {
        const payment = await PaymentApi.getPaymentStatus(initiationResult.paymentId);
        if (payment?.status === 'PAID') {
          clearTimers();
          setVerifiedPayment(payment);
          setStep('SUCCESS');
          onPaymentVerified?.(payment);
          return;
        }

        if (payment?.status === 'PROCESSING') {
          if (step !== 'VERIFYING') {
            setStep('VERIFYING');
          }
          return;
        }

        if (payment?.status === 'FAILED' || payment?.status === 'CANCELLED') {
          clearTimers();
          setStep('FAILED');
          setClassifiedFailure(
            classifyPaymentFailure(
              payment.failureReason || 'Payment rejected.',
              payment.status
            )
          );
        }
      } catch {
        // Polling retry
      }
    };

    pollIntervalRef.current = setInterval(checkStatus, 3200);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkStatus();
      }
    });

    return () => {
      clearTimers();
      appStateSub.remove();
    };
  }, [step, initiationResult?.paymentId, visible, language, clearTimers, onPaymentVerified]);

  if (!visible) return null;

  // STEP 1 -> STEP 2
  const handleProceedToPhone = () => {
    setStep('PHONE');
  };

  // STEP 2 -> STEP 3 (Trigger Push)
  const handleTriggerPaymentRequest = async () => {
    if (!payerPhone.trim()) {
      setPhoneError(
        language === 'sw'
          ? 'Tafadhali weka namba ya simu ya malipo.'
          : 'Please enter a payment phone number.'
      );
      return;
    }

    const trimmed = payerPhone.trim();
    if (!isValidTanzaniaPhone(trimmed)) {
      setPhoneError(
        language === 'sw'
          ? 'Tafadhali weka namba sahihi ya Tanzania (mfano: 0712 000 000 au +255 712 000 000).'
          : 'Please enter a valid Tanzanian mobile number (e.g. 0712 000 000 or +255 712 000 000).'
      );
      return;
    }

    setPhoneError(null);
    setStep('REQUESTING');

    const attemptId = generatePaymentAttemptId();
    setCurrentAttemptId(attemptId);

    const targetIdentifier =
      orderId || reservationId || customMealRequestId || quoteId || `cart_${Date.now()}`;
    const idempotencyKey = generatePaymentIdempotencyKey(
      user?.id || 'guest',
      targetIdentifier,
      attemptId
    );

    try {
      const res = await PaymentApi.createPayment({
        orderId,
        reservationId,
        customMealRequestId,
        quoteId,
        methodCode: selectedMethod.id,
        paymentType,
        payerPhone: normalizeTanzaniaPhone(trimmed) || trimmed,
        idempotencyKey,
      });

      setInitiationResult(res);

      if (!res.success) {
        setStep('FAILED');
        setClassifiedFailure(
          classifyPaymentFailure(res.error || 'Payment initiation failed.', 'FAILED')
        );
        return;
      }

      setStep('AWAITING_APPROVAL');
    } catch (err: any) {
      setStep('FAILED');
      setClassifiedFailure(
        classifyPaymentFailure(err?.message || 'Payment network error.', 'NETWORK_ERROR')
      );
    }
  };

  // RETRY ACTION
  const handleRetryCurrentMethod = () => {
    handleTriggerPaymentRequest();
  };

  // CHANGE METHOD ACTION
  const handleChangeMethod = () => {
    clearTimers();
    setStep('METHOD');
    setClassifiedFailure(null);
  };

  // USER COMPLETES FLOW ON SUCCESS SCREEN
  const handleSuccessContinue = () => {
    if (verifiedPayment) {
      if (onFlowComplete) {
        onFlowComplete?.(verifiedPayment);
      } else {
        // Legacy compatibility only.
        onPaymentSuccess?.(verifiedPayment);
      }
    }

    clearTimers();
    onClose();
  };

  const handleModalClose = () => {
    clearTimers();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleModalClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTag}>
                🔒 {language === 'sw' ? 'MALIPO SALAMA YA SIMU' : 'SECURE MOBILE MONEY CHECKOUT'}
              </Text>
              <Text style={styles.headerTitle}>
                {title ||
                  (isReservation
                    ? language === 'sw'
                      ? 'Malipo ya Amana ya Meza'
                      : 'Table Reservation Deposit'
                    : isCustomMeal
                    ? language === 'sw'
                      ? 'Malipo ya Chakula Maalum'
                      : 'Custom Meal Payment'
                    : language === 'sw'
                    ? 'Malipo ya Chakula'
                    : 'Online Meal Checkout')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleModalClose}
              accessibilityLabel="Close payment checkout"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. ORDER & AMOUNT SUMMARY CARD */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <Text style={styles.restaurantName}>🍽️ {restaurantName}</Text>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>
                    {isReservation
                      ? `🪑 ${guestCount} ${language === 'sw' ? 'Wageni' : 'Guests'}`
                      : isCustomMeal
                      ? '🍲 Custom Meal'
                      : '🍲 Standard Order'}
                  </Text>
                </View>
              </View>
              {itemDescription ? (
                <Text style={styles.itemDesc} numberOfLines={2}>
                  {itemDescription}
                </Text>
              ) : null}

              <View style={styles.divider} />

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  {isReservation
                    ? language === 'sw'
                      ? 'Amana Inayotakiwa Sasa:'
                      : 'Reservation Deposit Due Now:'
                    : language === 'sw'
                    ? 'Jumla ya Chakula:'
                    : 'Food Subtotal:'}
                </Text>
                <Text style={styles.priceVal}>TZS {subtotal.toLocaleString()}</Text>
              </View>

              {!isReservation && currentDelivery > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    {language === 'sw' ? 'Gharama ya Usafiri:' : 'Delivery Fee:'}
                  </Text>
                  <Text style={styles.priceVal}>TZS {currentDelivery.toLocaleString()}</Text>
                </View>
              )}

              {!isReservation && currentServiceFee > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    {language === 'sw' ? 'Ada ya Huduma:' : 'Platform Service Fee:'}
                  </Text>
                  <Text style={styles.priceVal}>TZS {currentServiceFee.toLocaleString()}</Text>
                </View>
              )}

              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>
                  {isReservation
                    ? language === 'sw'
                      ? 'Amana Inayolipwa Sasa:'
                      : 'Deposit Due Now:'
                    : language === 'sw'
                    ? 'Jumla Kuu:'
                    : 'Total Payable:'}
                </Text>
                <Text style={styles.totalVal}>TZS {totalBill.toLocaleString()}</Text>
              </View>
            </View>

            {/* STATE: METHOD SELECTION */}
            {step === 'METHOD' && (
              <View style={styles.stepSection}>
                <Text style={styles.sectionHeading}>
                  {language === 'sw' ? '1. Chagua Mtandao wa Malipo' : '1. Select Payment Method'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {language === 'sw'
                    ? 'Chagua mtandao wa simu utakaoutumia kulipia agizo hili.'
                    : 'Choose your Tanzanian mobile-money provider.'}
                </Text>

                <View style={styles.methodsList} accessibilityRole="radiogroup">
                  {MOBILE_MONEY_METHODS.map((method) => (
                    <PaymentMethodCard
                      key={method.id}
                      method={method}
                      selected={selectedMethod.id === method.id}
                      onSelect={(m) => {
                        setSelectedMethod(m);
                      }}
                    />
                  ))}
                </View>

                {/* Strict PIN Security Notice */}
                <View style={styles.securityBox}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                  <Text style={styles.securityText}>
                    {language === 'sw' ? PAYMENT_SECURITY_PIN_NOTICE_SW : PAYMENT_SECURITY_PIN_NOTICE_EN}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                  onPress={handleProceedToPhone}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryActionBtnText}>
                    {language === 'sw' ? 'Endelea na Nambari ya Simu' : 'Continue to Phone Confirmation'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.textOnPrimary} />
                </TouchableOpacity>
              </View>
            )}

            {/* STATE: PHONE CONFIRMATION */}
            {step === 'PHONE' && (
              <View style={styles.stepSection}>
                <Text style={styles.sectionHeading}>
                  {language === 'sw' ? '2. Hakiki Nambari ya Simu' : '2. Confirm Phone Number'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {language === 'sw'
                    ? `Ombi la malipo ya TZS ${totalBill.toLocaleString()} litatumwa kwenye nambari hii ya ${selectedMethod.displayName}.`
                    : `A push prompt of TZS ${totalBill.toLocaleString()} will be sent to this ${selectedMethod.displayName} phone.`}
                </Text>

                <View style={styles.selectedMethodBadge}>
                  <Text style={styles.selectedMethodText}>
                    {selectedMethod.carrierName} ({selectedMethod.ussdCode})
                  </Text>
                  <TouchableOpacity onPress={handleChangeMethod}>
                    <Text style={[styles.changeMethodLink, { color: colors.primary }]}>
                      {language === 'sw' ? 'Badili' : 'Change'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    {language === 'sw' ? 'Nambari ya Simu (M-Pesa / Tigo / Airtel / HaloPesa):' : 'Mobile Money Phone Number:'}
                  </Text>
                  <TextInput
                    style={[
                      styles.phoneInput,
                      {
                        backgroundColor: colors.surfaceInteractive,
                        color: colors.text,
                        borderColor: phoneError ? colors.danger : colors.border,
                      },
                    ]}
                    value={payerPhone}
                    onChangeText={(val) => {
                      setPayerPhone(val);
                      setPhoneError(null);
                    }}
                    placeholder="7XXXXXXXX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    autoFocus
                  />
                  {phoneError ? (
                    <Text style={styles.errorHelperText}>{phoneError}</Text>
                  ) : (
                    <Text style={styles.phoneHint}>
                      {payerPhone.trim() ? formatTanzaniaPhoneDisplay(payerPhone.trim()) : ''}
                    </Text>
                  )}
                </View>

                {/* Strict PIN Security Notice */}
                <View style={styles.securityBox}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                  <Text style={styles.securityText}>
                    {language === 'sw' ? PAYMENT_SECURITY_PIN_NOTICE_SW : PAYMENT_SECURITY_PIN_NOTICE_EN}
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.backBtn, { borderColor: colors.border }]}
                    onPress={handleChangeMethod}
                  >
                    <Text style={[styles.backBtnText, { color: colors.text }]}>
                      {language === 'sw' ? 'Rudi Nyuma' : 'Back'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { flex: 1, backgroundColor: colors.primary }]}
                    onPress={handleTriggerPaymentRequest}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionBtnText}>
                      {language === 'sw' ? 'Tuma Ombi la Malipo' : 'Request USSD Prompt'}
                    </Text>
                    <Ionicons name="phone-portrait-outline" size={18} color={colors.textOnPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STATE: REQUESTING / SENDING */}
            {step === 'REQUESTING' && (
              <View style={styles.centerSection}>
                <PaymentProgressIndicator size={72} status="WAITING" />
                <Text style={styles.statusTitle}>
                  {language === 'sw' ? 'Inatuma Ombi la Malipo...' : 'Dispatching Payment Request...'}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {language === 'sw'
                    ? `Tafadhali subiri wakati mtandao wa ${selectedMethod.displayName} unawasiliana na simu yako...`
                    : `Please wait while connecting with ${selectedMethod.displayName} network...`}
                </Text>
              </View>
            )}

            {/* STATE: AWAITING APPROVAL & VERIFYING */}
            {(step === 'AWAITING_APPROVAL' || step === 'VERIFYING') && (
              <View style={styles.ussdCard}>
                <View style={styles.ussdCardHeader}>
                  <PaymentProgressIndicator size={56} status="WAITING" />
                  <View style={styles.ussdHeaderInfo}>
                    <Text style={styles.ussdTitle}>
                      {language === 'sw' ? 'Angalia Simu Yako' : 'Check Your Phone'}
                    </Text>
                    <Text style={styles.carrierTag}>
                      {selectedMethod.carrierName} • {selectedMethod.ussdCode}
                    </Text>
                  </View>
                  <View style={[styles.countdownBadge, { backgroundColor: colors.surfaceHover }]}>
                    <Ionicons name="time-outline" size={14} color={colors.primary} />
                    <Text style={[styles.countdownText, { color: colors.primary }]}>
                      {countdownSeconds}s
                    </Text>
                  </View>
                </View>

                <Text style={styles.ussdInstructions}>
                  {language === 'sw'
                    ? `Ombi la malipo la TZS ${totalBill.toLocaleString()} limetumwa kwenda ${payerPhone}. ${selectedMethod.ussdGuidanceSw}`
                    : `A payment prompt of TZS ${totalBill.toLocaleString()} was sent to ${payerPhone}. ${selectedMethod.ussdGuidanceEn}`}
                </Text>

                {/* USSD Fallback Notice */}
                <View style={[styles.fallbackBox, { backgroundColor: colors.surfaceInteractive }]}>
                  <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
                    {language === 'sw'
                      ? `Hukuona ujumbe? Piga ${selectedMethod.ussdCode} kwenye simu yako kukamilisha malipo haya moja kwa moja.`
                      : `Didn't receive the prompt? Dial ${selectedMethod.ussdCode} on your phone to approve directly.`}
                  </Text>
                </View>

                {/* Strict PIN Security Notice */}
                <View style={styles.securityBox}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                  <Text style={styles.securityText}>
                    {language === 'sw' ? PAYMENT_SECURITY_PIN_NOTICE_SW : PAYMENT_SECURITY_PIN_NOTICE_EN}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
                  onPress={handleChangeMethod}
                >
                  <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                    {language === 'sw' ? 'Ghairi au Badili Njia' : 'Cancel or Change Method'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STATE: SUCCESS (Persistent until customer taps continue) */}
            {step === 'SUCCESS' && verifiedPayment && (
              <View style={styles.successCard}>
                <View style={[styles.successIconBox, { backgroundColor: colors.successSoft || colors.surfaceHover }]}>
                  <Ionicons name="checkmark-circle" size={54} color={colors.success} />
                </View>
                <Text style={styles.successTitle}>
                  {language === 'sw' ? 'Malipo Yamethibitishwa!' : 'Payment Verified!'}
                </Text>
                <Text style={styles.successSubtitle}>
                  {language === 'sw'
                    ? 'Muamala wako umekamilika na kupokelewa na jikoni.'
                    : 'Your transaction was successfully processed by the payment network.'}
                </Text>

                {/* Verified Server Receipt */}
                <View style={[styles.receiptBox, { backgroundColor: colors.surfaceInteractive, borderColor: colors.border }]}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{language === 'sw' ? 'Kiasi Kilicholipwa:' : 'Amount Paid:'}</Text>
                    <Text style={[styles.receiptVal, { color: colors.success, fontWeight: '800' }]}>
                      TZS {verifiedPayment.amountTzs.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{language === 'sw' ? 'Kumbukumbu ya Malipo:' : 'Reference / Token:'}</Text>
                    <Text style={styles.receiptVal}>{verifiedPayment.providerReference || verifiedPayment.id}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{language === 'sw' ? 'Mtandao:' : 'Carrier Method:'}</Text>
                    <Text style={styles.receiptVal}>{selectedMethod.displayName}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{language === 'sw' ? 'Muda:' : 'Timestamp:'}</Text>
                    <Text style={styles.receiptVal}>
                      {new Date(verifiedPayment.confirmedAt || verifiedPayment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>

                {/* Persistent Continue CTA Button */}
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={handleSuccessContinue}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryActionBtnText}>
                    {language === 'sw' ? 'Endelea Kwenye Agizo Lako' : 'Continue to Order Confirmation'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.textOnPrimary} />
                </TouchableOpacity>
              </View>
            )}

            {/* STATE: FAILED OR EXPIRED */}
            {(step === 'FAILED' || step === 'EXPIRED') && classifiedFailure && (
              <PaymentFailureSheet
                failure={classifiedFailure}
                onRetry={handleRetryCurrentMethod}
                onChangeMethod={handleChangeMethod}
                onCancel={handleModalClose}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalBox: {
      backgroundColor: colors.appBackground,
      borderTopLeftRadius: Radii.xxl,
      borderTopRightRadius: Radii.xxl,
      maxHeight: '94%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      ...Shadows.lg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTag: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.success,
      letterSpacing: 0.8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
      borderRadius: Radii.full,
      backgroundColor: colors.card,
    },
    scrollContent: {
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      gap: 16,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    restaurantName: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      flex: 1,
    },
    badgePill: {
      backgroundColor: colors.surfaceHover,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    badgePillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    itemDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 10,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 3,
    },
    priceLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    priceVal: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    totalRow: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    totalLabel: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    totalVal: {
      fontSize: 17,
      fontWeight: '900',
      color: colors.primary,
    },
    stepSection: {
      gap: 12,
    },
    sectionHeading: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    methodsList: {
      marginTop: 4,
    },
    securityBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 4,
    },
    securityText: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.text,
      flex: 1,
    },
    primaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 6,
    },
    primaryActionBtnText: {
      color: colors.textOnPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    selectedMethodBadge: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectedMethodText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    changeMethodLink: {
      fontSize: 13,
      fontWeight: '700',
    },
    inputContainer: {
      gap: 6,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    phoneInput: {
      height: 48,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 14,
      fontSize: 15,
      fontWeight: '600',
    },
    errorHelperText: {
      fontSize: 12,
      color: colors.danger,
    },
    phoneHint: {
      fontSize: 12,
      color: colors.textMuted,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    backBtn: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backBtnText: {
      fontSize: 14,
      fontWeight: '600',
    },
    centerSection: {
      paddingVertical: 36,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    statusTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    statusSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    ussdCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    ussdCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    ussdHeaderInfo: {
      flex: 1,
    },
    ussdTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    carrierTag: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 2,
    },
    countdownBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    countdownText: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: 'monospace',
    },
    ussdInstructions: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    fallbackBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: 10,
    },
    fallbackText: {
      fontSize: 12,
      lineHeight: 17,
      flex: 1,
    },
    secondaryActionBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1,
    },
    secondaryActionBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    successCard: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    successIconBox: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.text,
      marginBottom: 6,
    },
    successSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 18,
    },
    receiptBox: {
      width: '100%',
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      gap: 8,
    },
    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    receiptLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    receiptVal: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
  });
