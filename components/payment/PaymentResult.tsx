import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { PaymentTransactionEntity } from '../../db/types';
import { MobileMoneyMethodConfig } from '../../constants/paymentMethods';
import { ClassifiedPaymentFailure } from '../payments/paymentFlow';
import { PaymentFailureSheet } from '../payments/PaymentFailureSheet';

export interface PaymentResultProps {
  colors: ThemeColors;
  status: 'SUCCESS' | 'FAILED' | 'EXPIRED';
  verifiedPayment: PaymentTransactionEntity | null;
  selectedMethod: MobileMoneyMethodConfig;
  classifiedFailure: ClassifiedPaymentFailure | null;
  onContinue: () => void;
  onRetrySame: () => void;
  onChangeMethod: () => void;
  onClose: () => void;
}

export const PaymentResult: React.FC<PaymentResultProps> = ({
  colors,
  status,
  verifiedPayment,
  selectedMethod,
  classifiedFailure,
  onContinue,
  onRetrySame,
  onChangeMethod,
  onClose,
}) => {
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (status === 'SUCCESS' && verifiedPayment) {
    const formattedTime = new Date(
      verifiedPayment.confirmedAt || verifiedPayment.createdAt
    ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.successCard}>
        <View style={[styles.successIconBox, { backgroundColor: colors.successSoft || colors.surfaceHover }]}>
          <Ionicons name="checkmark-circle" size={54} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>{t('paymentSuccessTitle')}</Text>
        <Text style={styles.successSubtitle}>
          {t('paymentSuccessSubtitle')}
        </Text>

        {/* Verified Server Receipt */}
        <View style={[styles.receiptBox, { backgroundColor: colors.surfaceInteractive, borderColor: colors.border }]}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('paymentReceiptAmount')}</Text>
            <Text style={[styles.receiptVal, { color: colors.success, fontWeight: '800' }]}>
              TZS {verifiedPayment.amountTzs.toLocaleString()}
            </Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('paymentReceiptRef')}</Text>
            <Text style={styles.receiptVal}>
              {verifiedPayment.providerReference || verifiedPayment.id}
            </Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('paymentReceiptCarrier')}</Text>
            <Text style={styles.receiptVal}>{selectedMethod.displayName}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('paymentReceiptTime')}</Text>
            <Text style={styles.receiptVal}>{formattedTime}</Text>
          </View>
        </View>

        {/* Continue CTA Button */}
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
          onPress={onContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionBtnText}>
            {t('paymentContinueOrder')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onPrimary || '#FFFFFF'} />
        </TouchableOpacity>
      </View>
    );
  }

  if (classifiedFailure) {
    return (
      <PaymentFailureSheet
        failure={classifiedFailure}
        onRetry={onRetrySame}
        onChangeMethod={onChangeMethod}
        onCancel={onClose}
      />
    );
  }

  return null;
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    successCard: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
      gap: 12,
    },
    successIconBox: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
    },
    successSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: Spacing.sm,
    },
    receiptBox: {
      width: '100%',
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.md,
      gap: 10,
      marginVertical: 6,
    },
    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    receiptLabel: {
      fontSize: 12.5,
      color: colors.textSecondary,
    },
    receiptVal: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    primaryActionBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: Radii.md,
      gap: 8,
      marginTop: 4,
    },
    primaryActionBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.onPrimary || '#FFFFFF',
    },
  });
