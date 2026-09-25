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
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { PaymentRepository } from '../../repositories/payments.repository';
import { Order } from '../../types/domain';
import { formatTzs } from '../../utils/formatters';
import { normalizeTanzaniaPhone, isValidTanzaniaPhone, formatTanzaniaPhoneDisplay } from '../../utils/phone';
import { Button } from '../ui/Button';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

type PaymentMethodCode = 'MPESA' | 'AIRTEL_MONEY' | 'MIXX_BY_YAS' | 'HALOPESA';

interface PaymentProviderOption {
  id: PaymentMethodCode;
  name: string;
  shortName: string;
  emoji: string;
  badgeBg: string;
  badgeTextColor: string;
}

const PAYMENT_PROVIDERS: PaymentProviderOption[] = [
  {
    id: 'MPESA',
    name: 'Vodacom M-Pesa',
    shortName: 'M-Pesa',
    emoji: '🟢',
    badgeBg: '#DCFCE7',
    badgeTextColor: '#15803D',
  },
  {
    id: 'AIRTEL_MONEY',
    name: 'Airtel Money',
    shortName: 'Airtel',
    emoji: '🔴',
    badgeBg: '#FEE2E2',
    badgeTextColor: '#B91C1C',
  },
  {
    id: 'MIXX_BY_YAS',
    name: 'Mixx by Yas',
    shortName: 'Mixx',
    emoji: '🔵',
    badgeBg: '#E0F2FE',
    badgeTextColor: '#0369A1',
  },
  {
    id: 'HALOPESA',
    name: 'Halotel HaloPesa',
    shortName: 'HaloPesa',
    emoji: '🟠',
    badgeBg: '#FFEDD5',
    badgeTextColor: '#C2410C',
  },
];

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
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { language } = useLanguage();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [selectedProvider, setSelectedProvider] = useState<PaymentMethodCode>('MPESA');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && order) {
      setErrorMessage(null);
      const initialPhone = order.customerPhone || user?.phone || '';
      setPhoneNumber(initialPhone);
      setSelectedProvider('MPESA');
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

    setIsSubmitting(true);
    try {
      const attemptId = `retry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const idempotencyKey = `order_payment_${order.id}_${attemptId}`;

      const result = await PaymentRepository.createForOrder({
        orderId: order.id,
        methodCode: selectedProvider,
        payerPhone: normalizedPhone,
        idempotencyKey,
      });

      if (!result.success) {
        throw new Error(result.error || 'Payment request was not accepted by payment gateway.');
      }

      const providerObj = PAYMENT_PROVIDERS.find((p) => p.id === selectedProvider);
      Alert.alert(
        language === 'sw' ? 'Ombi la Malipo Limetumwa' : 'Payment Prompt Sent',
        language === 'sw'
          ? `Ombi la malipo la ${formatTzs(order.totalTzs)} limetumwa kwenye namba ${formatTanzaniaPhoneDisplay(normalizedPhone)} kupitia ${providerObj?.name || 'Mobile Money'}.\n\nTafadhali angalia simu yako na uweke namba yako ya siri (PIN) ili kuidhinisha malipo.`
          : `A payment prompt of ${formatTzs(order.totalTzs)} was sent to ${formatTanzaniaPhoneDisplay(normalizedPhone)} via ${providerObj?.name || 'Mobile Money'}.\n\nPlease check your phone and enter your mobile money PIN to authorize the payment.`,
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

  const selectedProviderObj = PAYMENT_PROVIDERS.find((p) => p.id === selectedProvider);

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
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownText}>
                  {language === 'sw' ? 'Vyakula' : 'Items'}: {formatTzs(order.subtotalTzs)}
                </Text>
                <Text style={styles.breakdownDot}>•</Text>
                <Text style={styles.breakdownText}>
                  {language === 'sw' ? 'Huduma' : 'Service'}: {formatTzs(order.serviceFeeTzs)}
                </Text>
                {order.deliveryFeeTzs > 0 && (
                  <>
                    <Text style={styles.breakdownDot}>•</Text>
                    <Text style={styles.breakdownText}>
                      {language === 'sw' ? 'Usafiri' : 'Delivery'}: {formatTzs(order.deliveryFeeTzs)}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Provider Selection */}
            <Text style={styles.sectionHeading}>
              {language === 'sw' ? 'Chagua Njia ya Malipo' : 'Select Mobile Money Provider'}
            </Text>
            <View style={styles.providersGrid}>
              {PAYMENT_PROVIDERS.map((provider) => {
                const isSelected = selectedProvider === provider.id;
                return (
                  <TouchableOpacity
                    key={provider.id}
                    style={[styles.providerCard, isSelected && styles.providerCardSelected]}
                    onPress={() => setSelectedProvider(provider.id)}
                    activeOpacity={0.8}
                    disabled={isSubmitting}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={styles.providerCardHeader}>
                      <Text style={styles.providerEmoji}>{provider.emoji}</Text>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInnerDot} />}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.providerName,
                        isSelected && styles.providerNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {provider.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Phone Number Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {language === 'sw'
                  ? `Namba ya Simu (${selectedProviderObj?.shortName || 'Simu'})`
                  : `Mobile Money Phone (${selectedProviderObj?.shortName || 'Mobile'})`}
              </Text>
              <View style={styles.phoneInputContainer}>
                <View style={styles.phonePrefixBox}>
                  <Text style={styles.phonePrefixText}>🇹🇿 +255</Text>
                </View>
                <TextInput
                  style={styles.phoneTextInput}
                  value={phoneNumber}
                  onChangeText={(val) => {
                    setPhoneNumber(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="07XXXXXXXX au 7XXXXXXXX"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="phone-pad"
                  editable={!isSubmitting}
                  autoCapitalize="none"
                />
              </View>
              <Text style={styles.inputHelp}>
                {language === 'sw'
                  ? 'Weka namba iliyosajiliwa na mtandao uliouchagua kupokea ujumbe wa idhini ya PIN.'
                  : 'Enter the registered mobile money phone to receive the USSD PIN authorization prompt.'}
              </Text>
            </View>

            {/* Instructions Notice */}
            <View style={styles.noticeCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>
                  {language === 'sw' ? 'Jinsi Malipo Yanavyofanya Kazi' : 'How It Works'}
                </Text>
                <Text style={styles.noticeBody}>
                  {language === 'sw'
                    ? 'Baada ya kubonyeza kitufe hapa chini, utapokea ujumbe mfupi (USSD push) kwenye simu yako ukiomba kuweka namba yako ya siri (PIN). Malipo yatakamilika mara moja.'
                    : 'After initiating, an automated USSD prompt will pop up on your mobile handset asking for your PIN to authorize the transaction via ClickPesa.'}
                </Text>
              </View>
            </View>

            {/* Pay Button */}
            <View style={styles.actionButtons}>
              <Button
                title={
                  isSubmitting
                    ? (language === 'sw' ? 'Inatuma ombi...' : 'Sending Prompt...')
                    : (language === 'sw'
                        ? `Lipa ${formatTzs(order.totalTzs)} kupitia ${selectedProviderObj?.shortName || 'Simu'}`
                        : `Pay ${formatTzs(order.totalTzs)} via ${selectedProviderObj?.shortName || 'Mobile'}`)
                }
                onPress={handlePay}
                variant="primary"
                size="lg"
                fullWidth={true}
                disabled={isSubmitting}
                loading={isSubmitting}
              />
              <Button
                title={language === 'sw' ? 'Ghairi' : 'Cancel'}
                onPress={onClose}
                variant="ghost"
                size="md"
                fullWidth={true}
                disabled={isSubmitting}
                style={{ marginTop: Spacing.sm }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  largeSheet: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    borderRadius: Radii.xl,
    marginVertical: 40,
    maxHeight: '85%',
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    padding: Spacing.lg,
  },
  amountCard: {
    backgroundColor: colors.appBackground,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  amountLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  breakdownText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  breakdownDot: {
    fontSize: 12,
    color: colors.textMuted,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  providersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  providerCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: Radii.md,
    padding: 12,
    justifyContent: 'space-between',
  },
  providerCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.successSoft,
  },
  providerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  providerEmoji: {
    fontSize: 18,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  providerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  providerNameSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: Radii.md,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  phonePrefixBox: {
    backgroundColor: colors.surfaceInteractive,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputHelp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.success,
    padding: Spacing.md,
    gap: 10,
    marginBottom: Spacing.lg,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 2,
  },
  noticeBody: {
    fontSize: 12,
    color: colors.success,
    lineHeight: 18,
  },
  actionButtons: {
    paddingBottom: Spacing.lg,
  },
});
let styles = createStyles(lightColors);
