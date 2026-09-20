import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
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

export interface PaymentCheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  onPaymentSuccess: (payment: PaymentTransactionEntity) => void;
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
  title,
  restaurantName,
  restaurantId,
  orderId,
  reservationId,
  customMealRequestId,
  quoteId,
  paymentTypeOverride,
  authoritativeReservationDeposit,
  amountTzs,
  isReservation = false,
  deliveryFee = 0,
  serviceFee = 1500,
  guestCount = '2',
  itemDescription,
  initialMethodCode = 'MPESA',
  initialPhone,
}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { restaurants } = useMloHubDB();
  const currentRestaurant = restaurants.find((r) => r.id === restaurantId);

  // Payment Options State
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodCode>(initialMethodCode);
  const [payerPhone, setPayerPhone] = useState(initialPhone || user?.phone || '');

  // Checkout Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [initiationResult, setInitiationResult] = useState<PaymentInitiationResult | null>(null);
  const [showUssdPrompt, setShowUssdPrompt] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(120);
  const [paymentSuccessData, setPaymentSuccessData] = useState<PaymentTransactionEntity | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  // Auto-fill phone when user changes
  useEffect(() => {
    if (initialPhone) {
      setPayerPhone(initialPhone);
    } else if (user?.phone) {
      setPayerPhone(user.phone);
    }
  }, [initialPhone, user?.phone]);

  useEffect(() => {
    if (initialMethodCode) {
      setSelectedMethod(initialMethodCode);
    }
  }, [initialMethodCode]);

  // Real-time status polling & AppState listener during USSD prompt
  useEffect(() => {
    let timer: any = null;
    let pollInterval: any = null;

    if (showUssdPrompt && initiationResult?.paymentId) {
      setCountdownSeconds(120);
      setGatewayError(null);

      timer = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Status polling every 3.5s
      pollInterval = setInterval(async () => {
        if (!initiationResult?.paymentId) return;
        try {
          const payment = await PaymentApi.getPaymentStatus(initiationResult.paymentId);
          if (payment?.status === 'PAID') {
            clearInterval(pollInterval);
            clearInterval(timer);
            setShowUssdPrompt(false);
            setPaymentSuccessData(payment);
            onPaymentSuccess(payment);
          } else if (payment?.status === 'FAILED') {
            clearInterval(pollInterval);
            clearInterval(timer);
            setGatewayError(payment.failureReason || 'Malipo yamekataliwa.');
          }
        } catch {
          // Polling retry
        }
      }, 3500);

      // Instant status check on app resume (when returning from telecom popup)
      const sub = AppState.addEventListener('change', async (nextState) => {
        if (nextState === 'active' && initiationResult?.paymentId) {
          try {
            const payment = await PaymentApi.getPaymentStatus(initiationResult.paymentId);
            if (payment?.status === 'PAID') {
              clearInterval(pollInterval);
              clearInterval(timer);
              setShowUssdPrompt(false);
              setPaymentSuccessData(payment);
              onPaymentSuccess(payment);
            }
          } catch {}
        }
      });

      return () => {
        if (timer) clearInterval(timer);
        if (pollInterval) clearInterval(pollInterval);
        sub.remove();
      };
    }
  }, [showUssdPrompt, initiationResult?.paymentId]);

  if (!visible) return null;

  // Calculation breakdown
  const isCustomMeal = !!customMealRequestId;
  const subtotal = Math.max(0, amountTzs);
  const currentDelivery = isReservation ? 0 : deliveryFee;
  const currentServiceFee = isReservation ? 0 : serviceFee;
  const totalBill = isReservation ? subtotal : (subtotal + currentDelivery + currentServiceFee);

  const payableAmount = totalBill;
  const remainingBalance = 0;
  const paymentType: PaymentType = paymentTypeOverride || (
    isReservation
      ? 'RESERVATION_DEPOSIT_50'
      : isCustomMeal
        ? 'CUSTOM_MEAL_FULL'
        : 'ORDER_FULL'
  );

  const paymentMethods: { code: PaymentMethodCode; name: string; icon: string; badge: string; color: string }[] = [
    { code: 'MPESA', name: 'Vodacom M-Pesa', icon: 'phone-portrait', badge: '*150*00#', color: '#e60000' },
    { code: 'AIRTEL_MONEY', name: 'Airtel Money', icon: 'phone-portrait', badge: '*150*60#', color: '#ff0000' },
    { code: 'MIXX_BY_YAS', name: 'Mixx by Yas', icon: 'phone-portrait', badge: '*150*01#', color: '#002f6c' },
    { code: 'HALOPESA', name: 'HaloPesa', icon: 'phone-portrait', badge: '*150*88#', color: '#ff6600' },
  ];

  // 1. Handle Initiate Payment
  const handleInitiatePayment = async () => {
    try {
      if (!user?.id) {
        setGatewayError(
          language === 'sw'
            ? 'Tafadhali ingia kwenye akaunti kabla ya kulipa.'
            : 'Please sign in before making a payment.'
        );
        return;
      }

      if (!payerPhone.trim()) {
        setGatewayError(
          language === 'sw'
            ? 'Tafadhali weka nambari ya simu ya malipo.'
            : 'Please enter your mobile money phone number.'
        );
        return;
      }

      setIsProcessing(true);
      setGatewayError(null);

      const targetIdentifier = orderId || reservationId || customMealRequestId || quoteId || Date.now().toString();

      const res = await PaymentApi.createPayment({
        orderId,
        reservationId,
        customMealRequestId,
        quoteId,
        methodCode: selectedMethod,
        paymentType,
        payerPhone: payerPhone.trim(),
        idempotencyKey: `${user.id}:${targetIdentifier}:${selectedMethod}`,
      });

      setInitiationResult(res);

      if (!res.success) {
        setGatewayError(
          res.error || 'Unable to initiate payment.'
        );
        return;
      }

      setShowUssdPrompt(true);
    } catch (error: any) {
      setGatewayError(
        error?.message || 'Payment initiation failed.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModalClose = () => {
    setShowUssdPrompt(false);
    setInitiationResult(null);
    setPaymentSuccessData(null);
    setGatewayError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleModalClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTag}>🔒 SECURE MOBILE MONEY CHECKOUT</Text>
              <Text style={styles.headerTitle}>
                {title || (isReservation ? (language === 'sw' ? 'Malipo ya Amana ya Meza' : 'Table Reservation Deposit') : isCustomMeal ? (language === 'sw' ? 'Malipo ya Chakula Maalum' : 'Custom Meal Payment') : (language === 'sw' ? 'Malipo ya Chakula' : 'Online Meal Checkout'))}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleModalClose}>
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {!paymentSuccessData ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* 1. RESTAURANT & ORDER SUMMARY CARD */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <Text style={styles.restaurantName}>🍽️ {restaurantName}</Text>
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>
                      {isReservation
                        ? `🪑 ${guestCount} ${language === 'sw' ? 'Wageni' : 'Guests'}`
                        : isCustomMeal
                        ? '🍲 Custom Meal'
                        : '🍲 Advance Order'}
                    </Text>
                  </View>
                </View>
                {itemDescription ? (
                  <Text style={styles.itemDesc} numberOfLines={2}>{itemDescription}</Text>
                ) : null}

                <View style={styles.divider} />

                {/* Price Line Items */}
                {isReservation ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      {language === 'sw' ? 'Amana ya Meza Inayotakiwa Sasa:' : 'Reservation Deposit Due Now:'}
                    </Text>
                    <Text style={styles.priceVal}>TZS {subtotal.toLocaleString()}</Text>
                  </View>
                ) : isCustomMeal ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      {language === 'sw' ? 'Bei ya Chakula Maalum:' : 'Custom Meal Agreed Price:'}
                    </Text>
                    <Text style={styles.priceVal}>TZS {subtotal.toLocaleString()}</Text>
                  </View>
                ) : (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{language === 'sw' ? 'Jumla ya Chakula:' : 'Food Subtotal:'}</Text>
                    <Text style={styles.priceVal}>TZS {subtotal.toLocaleString()}</Text>
                  </View>
                )}

                {!isReservation && currentDelivery > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{language === 'sw' ? 'Gharama ya Usafiri:' : 'Delivery Fee:'}</Text>
                    <Text style={styles.priceVal}>TZS {currentDelivery.toLocaleString()}</Text>
                  </View>
                )}

                {!isReservation && currentServiceFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{language === 'sw' ? 'Ada ya Huduma (Platform):' : 'Service / Platform Fee:'}</Text>
                    <Text style={styles.priceVal}>TZS {currentServiceFee.toLocaleString()}</Text>
                  </View>
                )}

                <View style={[styles.priceRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e0e0e0' }]}>
                  <Text style={styles.totalLabel}>
                    {isReservation
                      ? (language === 'sw' ? 'Amana Inayolipwa Sasa:' : 'Deposit Due Now:')
                      : (language === 'sw' ? 'Jumla Kuu:' : 'Total Bill:')}
                  </Text>
                  <Text style={styles.totalVal}>TZS {totalBill.toLocaleString()}</Text>
                </View>
              </View>

              {/* 2. TABLE RESERVATION NOTICE */}
              {isReservation && (
                <View style={styles.depositSection}>
                  <View style={styles.balanceNoticeBox}>
                    <Text style={styles.balanceNoticeText}>
                      💡 {language === 'sw'
                        ? `Unalipa amana ya uhakika ya TZS ${payableAmount.toLocaleString()} sasa ili kufunga meza. Baki yoyote ya mlo italipwa mgahawani.`
                        : `You are paying an authoritative reservation deposit of TZS ${payableAmount.toLocaleString()} now to secure your table.`}
                    </Text>
                  </View>
                </View>
              )}

              {/* RESTAURANT LIPA NAMBA NOTICE */}
              {((currentRestaurant?.lipaNumbers && currentRestaurant.lipaNumbers.length > 0) || currentRestaurant?.lipaNumber) && (
                <View style={{ marginBottom: 12, padding: 10, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="storefront" size={16} color="#15803d" />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534' }}>
                      🏪 Lipa Namba za Mgahawa Huu:
                    </Text>
                  </View>
                  {currentRestaurant?.lipaNumbers && currentRestaurant.lipaNumbers.length > 0 ? (
                    currentRestaurant.lipaNumbers.map((l, idx) => (
                      <Text key={idx} style={{ fontSize: 11.5, color: '#15803d', fontWeight: '700' }}>
                        • {l.provider}: <Text style={{ fontWeight: '900', color: '#0f172a' }}>{l.number}</Text>
                      </Text>
                    ))
                  ) : (
                    <Text style={{ fontSize: 11.5, color: '#15803d', fontWeight: '700' }}>
                      • {currentRestaurant?.lipaProvider || 'Till'}: <Text style={{ fontWeight: '900', color: '#0f172a' }}>{currentRestaurant?.lipaNumber}</Text>
                    </Text>
                  )}
                  <Text style={{ fontSize: 10, color: '#166534', marginTop: 2 }}>
                    Unaweza kulipia pia moja kwa moja kupitia Lipa Namba yoyote hapo juu.
                  </Text>
                </View>
              )}

              {/* 3. PAYMENT METHOD SELECTOR (TANZANIA MOBILE MONEY) */}
              <View style={styles.methodsSection}>
                <Text style={styles.sectionHeading}>
                  {language === 'sw' ? 'Chagua Njia ya Malipo:' : 'Select Payment Method:'}
                </Text>

                <View style={styles.methodsGrid}>
                  {paymentMethods.map((m) => {
                    const isSelected = selectedMethod === m.code;
                    return (
                      <TouchableOpacity
                        key={m.code}
                        style={[
                          styles.methodCard,
                          isSelected && styles.methodCardActive,
                          { borderColor: isSelected ? m.color : Colors.border },
                        ]}
                        onPress={() => setSelectedMethod(m.code)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.methodHeader}>
                          <Ionicons name={m.icon as any} size={18} color={isSelected ? m.color : Colors.muted} />
                          <View style={[styles.methodBadge, { backgroundColor: isSelected ? m.color : '#f0f0f0' }]}>
                            <Text style={[styles.methodBadgeText, { color: isSelected ? '#ffffff' : '#666666' }]}>
                              {m.badge}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.methodName, isSelected && { color: m.color, fontWeight: '800' }]}>
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 4. PAYER PHONE INPUT */}
              <View style={styles.phoneSection}>
                <Text style={styles.sectionHeading}>
                    {language === 'sw' ? 'Nambari ya Simu ya Malipo (Tanzania):' : 'Mobile Money Phone Number:'}
                  </Text>
                  <View style={styles.phoneInputWrap}>
                    <Text style={styles.phonePrefix}>🇹🇿 +255</Text>
                    <TextInput
                      style={styles.phoneInput}
                      value={payerPhone.replace('+255', '').trim()}
                      onChangeText={(val) => setPayerPhone(`+255 ${val.trim()}`)}
                      placeholder="7XXXXXXXX"
                      keyboardType="phone-pad"
                    />
                  </View>
                  <Text style={styles.phoneHelp}>
                    {language === 'sw'
                      ? 'Utapokea ujumbe wa USSD kwenye simu yako kuthibitisha namba ya siri (PIN).'
                      : 'You will receive a USSD push notification on your phone to confirm your PIN.'}
                  </Text>
                </View>

              {/* 5. PAY BUTTON */}
              <TouchableOpacity
                style={styles.payBtn}
                onPress={handleInitiatePayment}
                disabled={isProcessing}
                activeOpacity={0.88}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#ffffff" />
                    <Text style={styles.payBtnText}>
                      {language === 'sw'
                        ? `Lipa TZS ${payableAmount.toLocaleString()} Sasa →`
                        : `Pay TZS ${payableAmount.toLocaleString()} via ${(paymentMethods.find((m) => m.code === selectedMethod)?.name || selectedMethod)} →`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* PAYMENT SUCCESS SCREEN */
            <View style={styles.successContainer}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark-circle" size={56} color="#113a26" />
              </View>
              <Text style={styles.successTitle}>
                {language === 'sw' ? 'Malipo Yamethibitishwa!' : 'Payment Verified & Confirmed!'}
              </Text>
              <Text style={styles.successSubtitle}>
                {language === 'sw'
                  ? `Malipo yako ya TZS ${paymentSuccessData.amountTzs.toLocaleString()} yamepokelewa kupitia ${paymentSuccessData.paymentMethod}.`
                  : `Your payment of TZS ${paymentSuccessData.amountTzs.toLocaleString()} was successfully verified via ${paymentSuccessData.paymentMethod}.`}
              </Text>

              <View style={styles.receiptBox}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Transaction Ref:</Text>
                  <Text style={styles.receiptVal}>{paymentSuccessData.providerReference}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Restaurant:</Text>
                  <Text style={styles.receiptVal}>{paymentSuccessData.restaurantName}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Amount Paid:</Text>
                  <Text style={[styles.receiptVal, { color: '#113a26', fontWeight: '900' }]}>
                    TZS {paymentSuccessData.amountTzs.toLocaleString()}
                  </Text>
                </View>
                {paymentSuccessData.paymentType === 'RESERVATION_DEPOSIT_50' && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Status:</Text>
                    <Text style={[styles.receiptVal, { color: '#b45309' }]}>50% Deposit Paid (Table Locked)</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={handleModalClose}>
                <Text style={styles.doneBtnText}>
                  {language === 'sw' ? 'Nimemaliza' : 'Done & Return to App'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AUTHENTIC MOBILE MONEY USSD PUSH SCREEN */}
          {showUssdPrompt && initiationResult && (
            <View style={styles.ussdOverlay}>
              <View style={styles.ussdDialog}>
                <View style={styles.ussdHeader}>
                  <View style={styles.ussdCarrierIconBox}>
                    <Ionicons name="phone-portrait" size={24} color="#10b981" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.ussdCarrierTitle}>
                      {language === 'sw' ? 'Angalia Simu Yako' : 'Check Your Phone'}
                    </Text>
                    <Text style={styles.ussdCodeTag}>
                      {initiationResult.carrierName} • {initiationResult.ussdCode}
                    </Text>
                  </View>
                  <View style={styles.countdownBadge}>
                    <Text style={styles.countdownText}>{countdownSeconds}s</Text>
                  </View>
                </View>

                <Text style={styles.ussdMessage}>
                  {language === 'sw'
                    ? `Ombi la malipo la TZS ${initiationResult.amountTzs.toLocaleString()} limetumwa kwenda ${payerPhone}. Tafadhali weka PIN yako ya ${initiationResult.carrierName} kwenye simu yako kukamilisha.`
                    : `A payment prompt of TZS ${initiationResult.amountTzs.toLocaleString()} was sent to ${payerPhone}. Please enter your ${initiationResult.carrierName} PIN on your phone to complete.`}
                </Text>

                {/* Security Trust Notice */}
                <View style={styles.securityNoticeBox}>
                  <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                  <Text style={styles.securityNoticeText}>
                    {language === 'sw'
                      ? 'Usalama wa Mteja: MloHub haitakuomba au kuhifadhi PIN yako ya mtandao wa simu ndani ya app. Weka PIN tu kwenye ujumbe rasmi wa mtandao wako.'
                      : 'Customer Security: MloHub will never ask for or store your mobile money PIN in the app. Enter your PIN exclusively on your telecom prompt.'}
                  </Text>
                </View>

                {/* USSD Fallback Notice */}
                <View style={styles.fallbackNoticeBox}>
                  <Ionicons name="help-circle-outline" size={15} color="#94a3b8" />
                  <Text style={styles.fallbackNoticeText}>
                    {language === 'sw'
                      ? `Hukuona ujumbe? Piga ${initiationResult.ussdCode} kwenye simu yako kukamilisha malipo.`
                      : `Didn't see the prompt? Dial ${initiationResult.ussdCode} on your phone to approve.`}
                  </Text>
                </View>

                {/* Real-time Waiting Spinner */}
                <View style={styles.waitingContainer}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={styles.waitingText}>
                    {language === 'sw'
                      ? 'Inasubiri uthibitisho wa mtandao wa simu...'
                      : 'Waiting for mobile carrier confirmation...'}
                  </Text>
                </View>

                {gatewayError && (
                  <View style={styles.errorAlert}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorAlertText}>{gatewayError}</Text>
                  </View>
                )}

                <View style={styles.ussdActions}>
                  <TouchableOpacity
                    style={styles.ussdCancelBtn}
                    onPress={() => setShowUssdPrompt(false)}
                  >
                    <Text style={styles.ussdCancelText}>
                      {language === 'sw' ? 'Funga Dirisha' : 'Cancel & Close'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '92%',
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
    borderBottomColor: Colors.border,
  },
  headerTag: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#113a26',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.card,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  badgePill: {
    backgroundColor: '#eaf4ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#113a26',
  },
  itemDesc: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.muted,
  },
  priceVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  totalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#113a26',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  depositSection: {
    gap: 8,
  },
  depositOptionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  depositPill: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  depositPillActive: {
    borderColor: '#113a26',
    backgroundColor: '#f5faf6',
  },
  depositPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  depositPillTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  depositPillTitleActive: {
    color: '#113a26',
  },
  depositPillAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#113a26',
    marginTop: 4,
  },
  depositPillSub: {
    fontSize: 9.5,
    color: Colors.muted,
    marginTop: 2,
  },
  balanceNoticeBox: {
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  balanceNoticeText: {
    fontSize: 11,
    color: '#92400e',
    lineHeight: 16,
  },
  methodsSection: {
    gap: 8,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  methodCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: 10,
    borderWidth: 1.5,
    gap: 4,
  },
  methodCardActive: {
    backgroundColor: '#f5faf6',
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  methodBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  methodName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  phoneSection: {
    gap: 6,
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
  },
  phonePrefix: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginRight: 6,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  phoneHelp: {
    fontSize: 10.5,
    color: Colors.muted,
    fontStyle: 'italic',
  },
  payBtn: {
    backgroundColor: '#113a26',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radii.xl,
    marginTop: 10,
    ...Shadows.md,
  },
  payBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  successContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: 12,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eaf4ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#113a26',
  },
  successSubtitle: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  receiptBox: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    marginTop: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptLabel: {
    fontSize: 11,
    color: Colors.muted,
  },
  receiptVal: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  doneBtn: {
    backgroundColor: '#113a26',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: Radii.xl,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  ussdOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  ussdDialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1e293b',
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    gap: 12,
    ...Shadows.lg,
  },
  ussdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ussdCarrierIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ussdCarrierTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
  },
  ussdCodeTag: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  countdownBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#334155',
  },
  countdownText: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 13,
  },
  ussdMessage: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  securityNoticeBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: Radii.md,
    padding: 10,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#86efac',
    lineHeight: 15,
  },
  fallbackNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: Radii.md,
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  fallbackNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  waitingText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  errorAlert: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: Radii.md,
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  errorAlertText: {
    flex: 1,
    fontSize: 11.5,
    color: '#f87171',
  },
  sandboxBar: {
    backgroundColor: '#0f172a',
    borderRadius: Radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  sandboxBarLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  sandboxBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sandboxApproveBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: Radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sandboxRejectBtn: {
    flex: 1,
    backgroundColor: '#b91c1c',
    borderRadius: Radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sandboxBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  ussdActions: {
    marginTop: 4,
  },
  ussdCancelBtn: {
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  ussdCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
});
