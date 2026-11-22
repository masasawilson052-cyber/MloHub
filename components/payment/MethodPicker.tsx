import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import {
  MOBILE_MONEY_METHODS,
  MobileMoneyMethodConfig,
  MobileMoneyMethodCode,
} from '../../constants/paymentMethods';
import { PaymentMethodCard } from '../payments/PaymentMethodCard';

export interface MethodPickerProps {
  colors: ThemeColors;
  selectedMethod: MobileMoneyMethodConfig;
  onSelectMethod: (method: MobileMoneyMethodConfig) => void;
  onContinue: () => void;
  enabledMethods?: (MobileMoneyMethodCode | string)[];
}

const CANONICAL_METHOD_ORDER: MobileMoneyMethodCode[] = [
  'MPESA',
  'MIXX_BY_YAS',
  'AIRTEL_MONEY',
  'HALOPESA',
  'NMB',
  'CRDB',
];

export const MethodPicker: React.FC<MethodPickerProps> = ({
  colors,
  selectedMethod,
  onSelectMethod,
  onContinue,
  enabledMethods,
}) => {
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const displayedMethods = useMemo(() => {
    // If enabledMethods list is provided, filter strictly to enabled ones
    const activeCodes = enabledMethods && enabledMethods.length > 0
      ? enabledMethods
      : ['MPESA', 'MIXX_BY_YAS', 'AIRTEL_MONEY', 'HALOPESA'];

    const available = MOBILE_MONEY_METHODS.filter((m) =>
      (activeCodes as string[]).includes(m.id)
    );

    // Sort in strict order: M-Pesa, Mixx by Yas, Airtel Money, HaloPesa, then banks
    return available.sort((a, b) => {
      const idxA = CANONICAL_METHOD_ORDER.indexOf(a.id);
      const idxB = CANONICAL_METHOD_ORDER.indexOf(b.id);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  }, [enabledMethods]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>{t('paymentStepMethod')}</Text>
      <Text style={styles.sectionSubtitle}>{t('paymentStepMethodSub')}</Text>

      <View style={styles.methodsList} accessibilityRole="radiogroup">
        {displayedMethods.map((method) => (
          <PaymentMethodCard
            key={method.id}
            method={method}
            selected={selectedMethod.id === method.id}
            onSelect={onSelectMethod}
          />
        ))}
      </View>

      {/* Strict PIN Security Notice */}
      <View style={styles.securityBox}>
        <Ionicons name="shield-checkmark" size={18} color={colors.success} />
        <Text style={styles.securityText}>
          {t('paymentSecurityPinNotice')}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
        onPress={onContinue}
        activeOpacity={0.8}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t('paymentContinuePhone')}
      >
        <Text style={styles.primaryActionBtnText}>
          {t('paymentContinuePhone')}
        </Text>
        <Ionicons name="arrow-forward" size={18} color={colors.onPrimary || '#FFFFFF'} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: 14,
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
      gap: 8,
      marginVertical: 4,
    },
    securityBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: Spacing.sm,
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.sm,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    securityText: {
      flex: 1,
      fontSize: 11.5,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    primaryActionBtn: {
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
