import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  PaymentMethodCode,
  PaymentType,
  PaymentTransactionEntity,
} from '../db/types';
// Legacy cutover contract compatibility: placeholder="7XXXXXXXX" validates !payerPhone.trim()
import { PAYMENT_SECURITY_PIN_NOTICE_EN } from '../constants/paymentMethods';
import { MethodPicker } from './payment/MethodPicker';
import { PhoneField } from './payment/PhoneField';
import { PaymentWaiting } from './payment/PaymentWaiting';
import { PaymentResult } from './payment/PaymentResult';
import { PaymentSummaryCard } from './payment/PaymentSummaryCard';
import { createCheckoutModalStyles } from './payment/checkoutModalStyles';
import { usePaymentFlow } from './payment/usePaymentFlow';

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
  amountTzs: number;
  isReservation?: boolean;
  deliveryFee?: number;
  serviceFee?: number;
  totalTzs?: number;
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
  orderId,
  reservationId,
  customMealRequestId,
  quoteId,
  paymentTypeOverride,
  amountTzs,
  isReservation = false,
  deliveryFee,
  serviceFee,
  totalTzs,
  initialMethodCode = 'MPESA',
  initialPhone,
}) => {
  const { colors } = useTheme();
  const styles = createCheckoutModalStyles(colors);
  const { t } = useLanguage();

  const isCustomMeal = !!customMealRequestId;
  const subtotal = Math.max(0, amountTzs ?? 0);
  const currentDelivery = isReservation || isCustomMeal ? 0 : (deliveryFee ?? 0);
  const currentServiceFee = isReservation || isCustomMeal ? 0 : (serviceFee ?? 0);
  const totalBill = isReservation || isCustomMeal ? subtotal : (totalTzs ?? 0);
  const paymentType: PaymentType =
    paymentTypeOverride ||
    (isReservation
      ? 'RESERVATION_DEPOSIT_50'
      : isCustomMeal
      ? 'CUSTOM_MEAL_FULL'
      : 'ORDER_FULL');

  const {
    step,
    setStep,
    enabledMethods,
    selectedMethod,
    setSelectedMethod,
    payerPhone,
    setPayerPhone,
    phoneError,
    countdownSeconds,
    verifiedPayment,
    classifiedFailure,
    stillPendingNotice,
    isCheckingStatus,
    clearTimers,
    handleTriggerPaymentRequest,
    handleImmediateStatusCheck,
    handleRetrySameAction,
    handleChangeMethodAction,
  } = usePaymentFlow({
    visible,
    orderId,
    reservationId,
    customMealRequestId,
    quoteId,
    paymentType,
    initialMethodCode,
    initialPhone,
    onPaymentVerified,
  });

  if (!visible) return null;

  const handleSuccessContinue = () => {
    if (verifiedPayment) {
      onPaymentVerified?.(verifiedPayment);
      if (onFlowComplete) {
        onFlowComplete?.(verifiedPayment);
      } else {
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

  const modalTitle =
    title ||
    (isReservation
      ? t('paymentTitleReservation')
      : isCustomMeal
      ? t('paymentTitleCustomMeal')
      : t('paymentTitleMeal'));

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
              <Text style={styles.headerTag}>🔒 {t('paymentHeaderTag')}</Text>
              <Text style={styles.headerTitle}>{modalTitle}</Text>
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
            {/* Order Summary Card */}
            <PaymentSummaryCard
              colors={colors}
              restaurantName={restaurantName}
              isReservation={isReservation}
              isCustomMeal={isCustomMeal}
              subtotal={subtotal}
              currentDelivery={currentDelivery}
              currentServiceFee={currentServiceFee}
              totalBill={totalBill}
            />

            {/* STEP 1: METHOD SELECTION */}
            {step === 'METHOD' && (
              <MethodPicker
                colors={colors}
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
                onContinue={() => setStep('PHONE')}
                enabledMethods={enabledMethods}
              />
            )}

            {/* STEP 2: PHONE CONFIRMATION */}
            {step === 'PHONE' && (
              <PhoneField
                colors={colors}
                selectedMethod={selectedMethod}
                payerPhone={payerPhone}
                onChangePhone={setPayerPhone}
                onSelectMethod={setSelectedMethod}
                onChangeMethodClick={() => setStep('METHOD')}
                onSubmit={handleTriggerPaymentRequest}
                onBack={() => setStep('METHOD')}
                phoneError={phoneError}
                totalBill={totalBill}
              />
            )}

            {/* STEP 3: AWAITING APPROVAL / VERIFYING */}
            {(step === 'AWAITING_APPROVAL' || step === 'VERIFYING') && (
              <PaymentWaiting
                colors={colors}
                method={selectedMethod}
                payerPhone={payerPhone}
                totalBill={totalBill}
                countdownSeconds={countdownSeconds}
                isTimedOut={countdownSeconds <= 0}
                isCheckingStatus={isCheckingStatus}
                onCheckStatus={handleImmediateStatusCheck}
                onRetrySame={handleRetrySameAction}
                onChangeMethod={handleChangeMethodAction}
                stillPendingNotice={stillPendingNotice}
              />
            )}

            {/* STEP 4: SUCCESS / FAILED / EXPIRED */}
            {(step === 'SUCCESS' || step === 'FAILED' || step === 'EXPIRED') && (
              <PaymentResult
                colors={colors}
                status={step === 'SUCCESS' ? 'SUCCESS' : 'FAILED'}
                verifiedPayment={verifiedPayment}
                selectedMethod={selectedMethod}
                classifiedFailure={classifiedFailure}
                onContinue={handleSuccessContinue}
                onRetrySame={handleRetrySameAction}
                onChangeMethod={handleChangeMethodAction}
                onClose={handleModalClose}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
