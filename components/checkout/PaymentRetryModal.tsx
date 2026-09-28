import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { PaymentRepository } from '../../repositories/payments.repository';
import { Order, Payment } from '../../types/domain';
import { formatTzs } from '../../utils/formatters';
import { normalizeTanzaniaPhone, isValidTanzaniaPhone, formatTanzaniaPhoneDisplay } from '../../utils/phone';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import {
  MOBILE_MONEY_METHODS,
  MobileMoneyMethodConfig,
  getMobileMoneyMethodConfig,
  detectCarrierFromPhone,
  PAYMENT_SECURITY_PIN_NOTICE_EN,
  PAYMENT_SECURITY_PIN_NOTICE_SW,
} from '../../constants/paymentMethods';
import { PaymentMethodCard } from '../payments/PaymentMethodCard';
import { generatePaymentAttemptId } from '../payments/paymentFlow';

let colors: ThemeColors = lightColors;

interface PaymentRetryModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onPaymentSuccess?: () => void;
}

export const PaymentRetryModal: React.FC<PaymentRetryModalProps> = ({
  visible,
  order,
  onClose,
  onPaymentSuccess,
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);
  const { language } = useLanguage();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [selectedMethod, setSelectedMethod] = useState<MobileMoneyMethodConfig>(
    MOBILE_MONEY_METHODS[0]
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && order) {
      setErrorMessage(null);
      const initialPhone = order.customerPhone || user?.phone || '';
      setPhoneNumber(initialPhone);
      setSelectedMethod(MOBILE_MONEY_METHODS[0]);
    }
  }, [visible, order, user?.phone]);

  if (!visible || !order) return null;

  const handlePay = async () => {
    setErrorMessage(null);

    const trimmedPhone = phoneNumber.trim();
    if (!trimmedPhone) {
      setErrorMessage(
        language === 'sw'
          ? 'Tafadhali weka namba ya simu ya malipo.'
          : 'Please enter a mobile money phone number.'
      );
      return;
    }

    const normalizedPhone = normalizeTanzaniaPhone(trimmedPhone);
    if (!normalizedPhone || !isValidTanzaniaPhone(trimmedPhone)) {
      setErrorMessage(
        language === 'sw'
          ? 'Namba ya simu si sahihi. Weka namba ya Tanzania mfano: 07XXXXXXXX au +255XXXXXXXXX.'
          : 'Invalid phone number. Please enter a valid Tanzania phone (e.g. 07XXXXXXXX or +255XXXXXXXXX).'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const existingPayments = await PaymentRepository.getByOrderId(order.id).catch(() => []);
      const isAlreadyPaid =
        existingPayments.some(
          (p: Payment) => p.status === 'SUCCESS' || (p.status as any) === 'PAID' || (p.status as any) === 'COMPLETED'
        ) || order.paymentStatus === 'SUCCESS' || (order.paymentStatus as any) === 'PAID';

      if (isAlreadyPaid) {
        Alert.alert(
          language === 'sw' ? 'Agizo Limekwishalipwa' : 'Order Already Paid',
          language === 'sw'
            ? 'Malipo ya agizo hili tayari yamethibitishwa. Hakuna haja ya kulipa tena.'
            : 'This order has already been successfully paid. No additional payment is required.',
          [
            {
              text: language === 'sw' ? 'Sawa' : 'OK',
              onPress: () => {
                onClose();
                if (onPaymentSuccess) onPaymentSuccess();
              },
            },
          ]
        );
        return;
      }

      const attemptId = generatePaymentAttemptId();
      const idempotencyKey = `order_retry_${order.id}_${attemptId}`;

      const result = await PaymentRepository.createForOrder({
        orderId: order.id,
        methodCode: selectedMethod.id,
        payerPhone: normalizedPhone,
        idempotencyKey,
      });

      if (!result.success) {
        throw new Error(result.error || 'Payment request was not accepted by payment gateway.');
      }

      Alert.alert(
        language === 'sw' ? 'Ombi la Malipo Limetumwa' : 'Payment Prompt Sent',
        language === 'sw'
          ? `Ombi la malipo la ${formatTzs(order.totalTzs)} limetumwa kwenye namba ${formatTanzaniaPhoneDisplay(normalizedPhone)} kupitia ${selectedMethod.displayName}.\n\n${selectedMethod.ussdGuidanceSw}\n\nUsalama: MloHub haitakuomba au kuhifadhi PIN yako ya mtandao wa simu.`
          : `A payment prompt of ${formatTzs(order.totalTzs)} was sent to ${formatTanzaniaPhoneDisplay(normalizedPhone)} via ${selectedMethod.displayName}.\n\n${selectedMethod.ussdGuidanceEn}\n\nSecurity Notice: MloHub will never ask for or store your mobile-money PIN.`,
        [
          {
            text: language === 'sw' ? 'Sawa, Nimeelewa' : 'OK, Understood',
            onPress: () => {
              onClose();
              if (onPaymentSuccess) onPaymentSuccess();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Payment retry error:', err);
      setErrorMessage(err.message || 'Payment initiation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, isLargeScreen && styles.largeSheet]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {language === 'sw' ? 'Kamilisha Malipo' : 'Complete Order Payment'}
              </Text>
              <Text style={styles.subtitle}>
                #{order.orderNumber || order.id} • {order.restaurantName || 'Restaurant'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Amount Due Card */}
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>
                {language === 'sw' ? 'Kiasi Kinacholipwa' : 'Total Amount Due'}
              </Text>
              <Text style={styles.amountValue}>{formatTzs(order.totalTzs)}</Text>
            </View>

            {/* Provider Selection */}
            <Text style={styles.sectionLabel}>
              {language === 'sw' ? 'Chagua Mtandao wa Malipo' : 'Select Mobile Money Provider'}
            </Text>
            <View style={styles.providersList} accessibilityRole="radiogroup">
              {MOBILE_MONEY_METHODS.map((provider) => (
                <PaymentMethodCard
                  key={provider.id}
                  method={provider}
                  selected={selectedMethod.id === provider.id}
                  onSelect={(p) => setSelectedMethod(p)}
                  disabled={isSubmitting}
                />
              ))}
            </View>

            {/* Phone Number Input */}
            <Text style={styles.sectionLabel}>
              {language === 'sw' ? 'Namba ya Simu ya Malipo' : 'Payment Phone Number'}
            </Text>
            <View
              style={[
                styles.phoneInputContainer,
                {
                  backgroundColor: colors.surfaceInteractive,
                  borderColor: errorMessage ? colors.danger : colors.border,
                },
              ]}
            >
              <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={styles.phoneIcon} />
              <TextInput
                style={[styles.phoneInput, { color: colors.text }]}
                value={phoneNumber}
                onChangeText={(val) => {
                  setPhoneNumber(val);
                  setErrorMessage(null);
                }}
                placeholder="0754 000 000 au +255..."
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                editable={!isSubmitting}
                maxLength={16}
              />
            </View>

            {/* PIN Security Notice */}
            <View style={styles.securityBox}>
              <Ionicons name="shield-checkmark" size={16} color={colors.success} />
              <Text style={styles.securityText}>
                {language === 'sw' ? PAYMENT_SECURITY_PIN_NOTICE_SW : PAYMENT_SECURITY_PIN_NOTICE_EN}
              </Text>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: isSubmitting ? 0.6 : 1 },
              ]}
              onPress={handlePay}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="phone-portrait-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    {language === 'sw' ? 'Tuma Ombi la Malipo' : 'Request Payment Prompt'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                {language === 'sw' ? 'Lipa Baadaye' : 'Pay Later'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: Radii.xxl,
      borderTopRightRadius: Radii.xxl,
      maxHeight: '90%',
      paddingBottom: 24,
      ...Shadows.lg,
    },
    largeSheet: {
      maxWidth: 520,
      alignSelf: 'center',
      borderRadius: Radii.xxl,
      marginBottom: 'auto',
      marginTop: 'auto',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceHover,
    },
    scroll: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
    },
    amountCard: {
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    amountLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    amountValue: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.primary,
      marginTop: 4,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    providersList: {
      marginBottom: Spacing.md,
    },
    phoneInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    phoneIcon: {
      marginRight: Spacing.sm,
    },
    phoneInput: {
      flex: 1,
      height: 48,
      fontSize: 15,
      fontWeight: '600',
    },
    securityBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    securityText: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.text,
      flex: 1,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.dangerSoft || '#FEE2E2',
      borderRadius: Radii.md,
      padding: Spacing.sm,
      marginBottom: Spacing.md,
    },
    errorText: {
      fontSize: 13,
      color: colors.danger,
      flex: 1,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      borderRadius: Radii.lg,
      marginBottom: Spacing.sm,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    cancelBtn: {
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
