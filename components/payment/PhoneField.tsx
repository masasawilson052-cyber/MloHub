import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import {
  MobileMoneyMethodConfig,
  getMobileMoneyMethodConfig,
} from '../../constants/paymentMethods';
import {
  detectWalletFromPhone,
  getUssdFallbackCode,
} from '../../config/mobileNetworkPrefixes';
import {
  formatAsYouTypeTanzaniaPhone,
  isValidLocalTanzaniaPhone,
} from '../../utils/phone';

export interface PhoneFieldProps {
  colors: ThemeColors;
  selectedMethod: MobileMoneyMethodConfig;
  payerPhone: string;
  onChangePhone: (formattedPhone: string) => void;
  onSelectMethod: (method: MobileMoneyMethodConfig) => void;
  onChangeMethodClick: () => void;
  onSubmit: () => void;
  onBack: () => void;
  phoneError: string | null;
  totalBill: number;
}

export const PhoneField: React.FC<PhoneFieldProps> = ({
  colors,
  selectedMethod,
  payerPhone,
  onChangePhone,
  onSelectMethod,
  onChangeMethodClick,
  onSubmit,
  onBack,
  phoneError,
  totalBill,
}) => {
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // TCRA intelligent wallet detection
  const detectedWalletCode = useMemo(() => {
    return detectWalletFromPhone(payerPhone);
  }, [payerPhone]);

  const detectedWalletConfig = useMemo(() => {
    return detectedWalletCode ? getMobileMoneyMethodConfig(detectedWalletCode) : undefined;
  }, [detectedWalletCode]);

  const showSuggestionPill =
    detectedWalletConfig && detectedWalletConfig.id !== selectedMethod.id;

  const handleTextChange = (text: string) => {
    const formatted = formatAsYouTypeTanzaniaPhone(text);
    onChangePhone(formatted);

    // If auto-detected wallet matches a valid carrier, optionally auto-suggest
    const newDetected = detectWalletFromPhone(formatted);
    if (newDetected && newDetected !== selectedMethod.id) {
      const cfg = getMobileMoneyMethodConfig(newDetected);
      if (cfg) {
        onSelectMethod(cfg);
      }
    }
  };

  const ussdCode = getUssdFallbackCode(selectedMethod.id);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>{t('paymentStepPhone')}</Text>
      <Text style={styles.sectionSubtitle}>
        {t('paymentPhoneSub')
          .replace('{amount}', totalBill.toLocaleString())
          .replace('{carrier}', selectedMethod.displayName)}
      </Text>

      {/* Selected Method Pill & Change Link */}
      <View style={styles.selectedMethodBadge}>
        <View style={styles.badgeLeft}>
          <Text style={styles.selectedMethodText}>
            {selectedMethod.carrierName} {ussdCode ? `(${ussdCode})` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onChangeMethodClick}>
          <Text style={[styles.changeMethodLink, { color: colors.primary }]}>
            {t('paymentChange')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Wallet Recommendation Pill (TCRA based, overridable) */}
      {showSuggestionPill && detectedWalletConfig && (
        <TouchableOpacity
          style={styles.suggestionPill}
          onPress={() => onSelectMethod(detectedWalletConfig)}
        >
          <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
          <Text style={styles.suggestionText}>
            {t('paymentWalletSuggested').replace('{wallet}', detectedWalletConfig.displayName)}
          </Text>
          <Text style={[styles.switchLink, { color: colors.primary }]}>
            {t('paymentChange')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Phone Number Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>{t('paymentPhoneLabel')}</Text>
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
          onChangeText={handleTextChange}
          placeholder="07XX XXX XXX"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          maxLength={12} // "07XX XXX XXX" is 12 chars with spaces
          autoFocus
        />
        {phoneError ? (
          <Text style={styles.errorHelperText}>{phoneError}</Text>
        ) : (
          <Text style={styles.phoneHint}>
            {payerPhone.trim() ? payerPhone.trim() : ''}
          </Text>
        )}
      </View>

      {/* Security PIN Notice */}
      <View style={styles.securityBox}>
        <Ionicons name="shield-checkmark" size={16} color={colors.success} />
        <Text style={styles.securityText}>
          {t('paymentSecurityPinNotice')}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border }]}
          onPress={onBack}
        >
          <Text style={[styles.backBtnText, { color: colors.text }]}>
            {t('paymentBack')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { flex: 1, backgroundColor: colors.primary }]}
          onPress={onSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionBtnText}>
            {t('paymentRequestPrompt')}
          </Text>
          <Ionicons name="phone-portrait-outline" size={18} color={colors.onPrimary || '#FFFFFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
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
    selectedMethodBadge: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedMethodText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
    },
    changeMethodLink: {
      fontSize: 13,
      fontWeight: '700',
    },
    suggestionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'flex-start',
    },
    suggestionText: {
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    switchLink: {
      fontSize: 11.5,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    inputContainer: {
      marginTop: 2,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    phoneInput: {
      height: 48,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      fontSize: 17,
      fontWeight: '600',
      borderWidth: 1,
      letterSpacing: 0.8,
    },
    errorHelperText: {
      fontSize: 12,
      color: colors.danger,
      marginTop: 4,
      fontWeight: '500',
    },
    phoneHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
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
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    backBtn: {
      paddingVertical: 12,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    primaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radii.md,
      gap: 8,
    },
    primaryActionBtnText: {
      fontSize: 14.5,
      fontWeight: '700',
      color: colors.onPrimary || '#FFFFFF',
    },
  });
