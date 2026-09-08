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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  PaymentGatewayService,
  PaymentInitiationResult,
  ClickPesaWebhookPayload,
} from '../services/PaymentGatewayService';
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
  amountTzs: number;
  isReservation?: boolean;
  deliveryFee?: number;
  serviceFee?: number;
  guestCount?: string;
  itemDescription?: string;
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
  amountTzs,
  isReservation = false,
  deliveryFee = 0,
  serviceFee = 1500,
  guestCount = '2',
  itemDescription,
}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  // Payment Options State
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodCode>('MPESA');
  const [depositOption, setDepositOption] = useState<'deposit_50' | 'full_100'>('deposit_50');
  const [payerPhone, setPayerPhone] = useState(user?.phone || '+255 754 123 456');

  // Checkout Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [initiationResult, setInitiationResult] = useState<PaymentInitiationResult | null>(null);
  const [showUssdPrompt, setShowUssdPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('••••');
  const [isWebhookSimulating, setIsWebhookSimulating] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<PaymentTransactionEntity | null>(null);

  // Auto-fill phone when user changes
  useEffect(() => {
    if (user?.phone) {
      setPayerPhone(user.phone);
    }
  }, [user?.phone]);

  if (!visible) return null;

  // Calculation breakdown
  const subtotal = Math.max(0, amountTzs);
  const currentDelivery = isReservation ? 0 : deliveryFee;
  const currentServiceFee = isReservation ? 0 : serviceFee;
  const totalBill = subtotal + currentDelivery + currentServiceFee;

  let payableAmount = totalBill;
  let remainingBalance = 0;
  const paymentType: PaymentType = isReservation
    ? depositOption === 'deposit_50'
      ? 'RESERVATION_DEPOSIT_50'
      : 'RESERVATION_FULL_100'
    : 'ORDER_FULL';

  if (isReservation) {
    if (depositOption === 'deposit_50') {
      payableAmount = Math.round(totalBill * 0.5);
      remainingBalance = totalBill - payableAmount;
    } else {
      payableAmount = totalBill;
      remainingBalance = 0;
    }
  }

  const paymentMethods: { code: PaymentMethodCode; name: string; icon: string; badge: string; color: string }[] = [
    { code: 'MPESA', name: 'Vodacom M-Pesa', icon: 'phone-portrait', badge: '*150*00#', color: '#e60000' },
    { code: 'AIRTEL_MONEY', name: 'Airtel Money', icon: 'phone-portrait', badge: '*150*60#', color: '#ff0000' },
    { code: 'MIXX_BY_YAS', name: 'Mixx by Yas (Tigo)', icon: 'phone-portrait', badge: '*150*01#', color: '#002f6c' },
    { code: 'HALOPESA', name: 'HaloPesa', icon: 'phone-portrait', badge: '*150*88#', color: '#ff6600' },
    { code: 'CARD', name: 'Visa / Mastercard', icon: 'card', badge: 'ClickPesa Card', color: '#1a1f71' },
    ...(!isReservation
      ? [{ code: 'CASH_ON_DELIVERY' as PaymentMethodCode, name: 'Cash on Delivery', icon: 'cash', badge: 'Pay at Door', color: '#2e7d32' }]
      : []),
  ];

  // 1. Handle Initiate ClickPesa Payment
  const handleInitiatePayment = async () => {
    try {
      setIsProcessing(true);
      const res = await PaymentGatewayService.initiatePayment({
        userId: user?.id || 'usr-frank',
        orderId,
        reservationId,
        restaurantId,
        restaurantName,
        amountTzs: subtotal,
        deliveryFee: currentDelivery,
        serviceFee: currentServiceFee,
        discount: 0,
        provider: 'CLICKPESA',
        methodCode: selectedMethod,
        paymentType,
        payerPhone,
      });

      setInitiationResult(res);
      setIsProcessing(false);

      if (selectedMethod === 'CASH_ON_DELIVERY') {
        // Direct cash order confirmation
        const cashPayment: PaymentTransactionEntity = {
          id: res.paymentId,
          userId: user?.id || 'usr-frank',
          orderId,
          restaurantId,
          restaurantName,
          provider: 'CASH',
          providerReference: res.providerReference,
          amountTzs: payableAmount,
          currency: 'TZS',
          paymentMethod: 'Cash on Delivery',
          methodCode: 'CASH_ON_DELIVERY',
          status: 'PAID',
          paymentType: 'ORDER_FULL',
          payerPhone,
          createdAt: new Date().toISOString(),
        };
        setPaymentSuccessData(cashPayment);
        onPaymentSuccess(cashPayment);
      } else {
        // Show USSD Push prompt simulation overlay
        setShowUssdPrompt(true);
      }
    } catch (e) {
      setIsProcessing(false);
      console.error('Payment initiation error', e);
    }
  };

  // 2. Simulate User entering PIN on phone -> ClickPesa webhook confirmed
  const handleAuthorizeUssdPayment = async () => {
    if (!initiationResult) return;
    try {
      setIsWebhookSimulating(true);

      // Construct ClickPesa verified webhook payload
      const webhookPayload: ClickPesaWebhookPayload = {
        eventId: `cp_evt_${Date.now()}`,
        eventType: 'payment.success',
        providerReference: initiationResult.providerReference,
        paymentId: initiationResult.paymentId,
        orderId,
        reservationId,
        amount: initiationResult.paidAmountTzs,
        currency: 'TZS',
        method: selectedMethod,
        payerPhone,
        channel: 'USSD_PUSH',
        timestamp: new Date().toISOString(),
      };

      const webhookResponse = await PaymentGatewayService.processWebhook(webhookPayload, 'mlohub_cp_sec_993847291048_prod');

      setIsWebhookSimulating(false);
      setShowUssdPrompt(false);

      if (webhookResponse.success && webhookResponse.payment) {
        setPaymentSuccessData(webhookResponse.payment);
        onPaymentSuccess(webhookResponse.payment);
      }
    } catch (e) {
      setIsWebhookSimulating(false);
      console.error('Webhook error', e);
    }
  };

  const handleModalClose = () => {
    setShowUssdPrompt(false);
    setInitiationResult(null);
    setPaymentSuccessData(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleModalClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTag}>🔒 CLICKPESA ONLINE CHECKOUT</Text>
              <Text style={styles.headerTitle}>
                {title || (isReservation ? (language === 'sw' ? 'Malipo ya Amana ya Meza' : 'Table Reservation Deposit') : (language === 'sw' ? 'Malipo ya Chakula' : 'Online Meal Checkout'))}
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
                      {isReservation ? `🪑 ${guestCount} ${language === 'sw' ? 'Wageni' : 'Guests'}` : '🍲 Advance Order'}
                    </Text>
                  </View>
                </View>
                {itemDescription ? (
                  <Text style={styles.itemDesc} numberOfLines={2}>{itemDescription}</Text>
                ) : null}

                <View style={styles.divider} />

                {/* Price Line Items */}
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{isReservation ? (language === 'sw' ? 'Makadirio ya Chakula:' : 'Estimated Bill Subtotal:') : (language === 'sw' ? 'Jumla ya Chakula:' : 'Food Subtotal:')}</Text>
                  <Text style={styles.priceVal}>TZS {subtotal.toLocaleString()}</Text>
                </View>

                {!isReservation && currentDelivery > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{language === 'sw' ? 'Gharama ya Usafiri:' : 'Delivery Fee:'}</Text>
                    <Text style={styles.priceVal}>TZS {currentDelivery.toLocaleString()}</Text>
                  </View>
                )}

                {!isReservation && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{language === 'sw' ? 'Ada ya Huduma (Platform):' : 'Service / Platform Fee:'}</Text>
                    <Text style={styles.priceVal}>TZS {currentServiceFee.toLocaleString()}</Text>
                  </View>
                )}

                <View style={[styles.priceRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e0e0e0' }]}>
                  <Text style={styles.totalLabel}>{language === 'sw' ? 'Jumla Kuu:' : 'Total Bill:'}</Text>
                  <Text style={styles.totalVal}>TZS {totalBill.toLocaleString()}</Text>
                </View>
              </View>

              {/* 2. TABLE RESERVATION 50% DEPOSIT SELECTOR */}
              {isReservation && (
                <View style={styles.depositSection}>
                  <Text style={styles.sectionHeading}>
                    {language === 'sw' ? 'Chaguo la Malipo ya Meza:' : 'Reservation Payment Option:'}
                  </Text>
                  <View style={styles.depositOptionRow}>
                    <TouchableOpacity
                      style={[styles.depositPill, depositOption === 'deposit_50' && styles.depositPillActive]}
                      onPress={() => setDepositOption('deposit_50')}
                      activeOpacity={0.85}
                    >
                      <View style={styles.depositPillHeader}>
                        <Ionicons
                          name={depositOption === 'deposit_50' ? 'radio-button-on' : 'radio-button-off'}
                          size={16}
                          color={depositOption === 'deposit_50' ? '#113a26' : Colors.muted}
                        />
                        <Text style={[styles.depositPillTitle, depositOption === 'deposit_50' && styles.depositPillTitleActive]}>
                          50% Deposit (Amana)
                        </Text>
                      </View>
                      <Text style={styles.depositPillAmount}>
                        TZS {Math.round(totalBill * 0.5).toLocaleString()}
                      </Text>
                      <Text style={styles.depositPillSub}>
                        {language === 'sw' ? 'Kiwango cha chini cha kuhifadhi meza' : 'Minimum required to lock table'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.depositPill, depositOption === 'full_100' && styles.depositPillActive]}
                      onPress={() => setDepositOption('full_100')}
                      activeOpacity={0.85}
                    >
                      <View style={styles.depositPillHeader}>
                        <Ionicons
                          name={depositOption === 'full_100' ? 'radio-button-on' : 'radio-button-off'}
                          size={16}
                          color={depositOption === 'full_100' ? '#113a26' : Colors.muted}
                        />
                        <Text style={[styles.depositPillTitle, depositOption === 'full_100' && styles.depositPillTitleActive]}>
                          100% Full Bill
                        </Text>
                      </View>
                      <Text style={styles.depositPillAmount}>
                        TZS {totalBill.toLocaleString()}
                      </Text>
                      <Text style={styles.depositPillSub}>
                        {language === 'sw' ? 'Lipa bili yote mapema' : 'Pay complete bill in advance'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {depositOption === 'deposit_50' && (
                    <View style={styles.balanceNoticeBox}>
                      <Text style={styles.balanceNoticeText}>
                        💡 {language === 'sw'
                          ? `Unalipa amana ya TZS ${payableAmount.toLocaleString()} sasa. Baki ya TZS ${remainingBalance.toLocaleString()} utalipa mgahawani baada ya mlo.`
                          : `You pay TZS ${payableAmount.toLocaleString()} deposit now. Remaining balance of TZS ${remainingBalance.toLocaleString()} will be settled at the restaurant.`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* 3. PAYMENT METHOD SELECTOR (TANZANIA MOBILE MONEY & CARD) */}
              <View style={styles.methodsSection}>
                <Text style={styles.sectionHeading}>
                  {language === 'sw' ? 'Chagua Njia ya Malipo (ClickPesa):' : 'Select Payment Method (ClickPesa):'}
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
              {selectedMethod !== 'CARD' && selectedMethod !== 'CASH_ON_DELIVERY' && (
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
                      placeholder="754 123 456"
                      keyboardType="phone-pad"
                    />
                  </View>
                  <Text style={styles.phoneHelp}>
                    {language === 'sw'
                      ? 'Utapokea ujumbe wa USSD kwenye simu yako kuthibitisha namba ya siri (PIN).'
                      : 'You will receive a USSD push notification on your phone to confirm your PIN.'}
                  </Text>
                </View>
              )}

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
                        ? `Lipa TZS ${payableAmount.toLocaleString()} ${selectedMethod === 'CASH_ON_DELIVERY' ? 'kwa Fedha Taslimu' : 'Sasa'} →`
                        : `Pay TZS ${payableAmount.toLocaleString()} via ${PaymentGatewayService.getCarrierInfo(selectedMethod).name} →`}
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

          {/* SIMULATED USSD PUSH PROMPT OVERLAY */}
          {showUssdPrompt && initiationResult?.simulatedUssdPrompt && (
            <View style={styles.ussdOverlay}>
              <View style={styles.ussdDialog}>
                <View style={styles.ussdHeader}>
                  <Text style={styles.ussdCarrierTitle}>
                    📲 {initiationResult.simulatedUssdPrompt.carrierName} USSD Push
                  </Text>
                  <Text style={styles.ussdCodeTag}>{initiationResult.simulatedUssdPrompt.ussdString}</Text>
                </View>

                <Text style={styles.ussdMessage}>
                  {initiationResult.simulatedUssdPrompt.promptMessage}
                </Text>

                <View style={styles.pinBox}>
                  <Text style={styles.pinLabel}>Enter PIN:</Text>
                  <TextInput
                    style={styles.pinInput}
                    secureTextEntry
                    maxLength={4}
                    value={pinInput}
                    onChangeText={setPinInput}
                  />
                </View>

                <View style={styles.ussdActions}>
                  <TouchableOpacity
                    style={styles.ussdCancelBtn}
                    onPress={() => setShowUssdPrompt(false)}
                  >
                    <Text style={styles.ussdCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.ussdConfirmBtn}
                    onPress={handleAuthorizeUssdPayment}
                    disabled={isWebhookSimulating}
                  >
                    {isWebhookSimulating ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.ussdConfirmText}>Authorize Payment →</Text>
                    )}
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
    ...StyleSheet.absoluteFillObject,
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ussdCarrierTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  ussdCodeTag: {
    backgroundColor: '#334155',
    color: '#94a3b8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    fontSize: 10,
    fontWeight: '700',
  },
  ussdMessage: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  pinBox: {
    backgroundColor: '#0f172a',
    borderRadius: Radii.md,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
  },
  pinInput: {
    backgroundColor: '#334155',
    color: '#ffffff',
    borderRadius: Radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '800',
    width: 80,
    textAlign: 'center',
  },
  ussdActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  ussdCancelBtn: {
    flex: 1,
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
  ussdConfirmBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  ussdConfirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});
