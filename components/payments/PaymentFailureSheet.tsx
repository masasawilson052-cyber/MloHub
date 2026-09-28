import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ClassifiedPaymentFailure } from './paymentFlow';

export interface PaymentFailureSheetProps {
  failure: ClassifiedPaymentFailure;
  onRetry: () => void;
  onChangeMethod: () => void;
  onCancel: () => void;
  isRetrying?: boolean;
}

export const PaymentFailureSheet: React.FC<PaymentFailureSheetProps> = ({
  failure,
  onRetry,
  onChangeMethod,
  onCancel,
  isRetrying = false,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();

  const title =
    failure.code === 'INSUFFICIENT_FUNDS'
      ? language === 'sw'
        ? 'Salio Halitoshi'
        : 'Insufficient Balance'
      : failure.code === 'CUSTOMER_CANCELLED'
      ? language === 'sw'
        ? 'Malipo Yameghairiwa'
        : 'Payment Declined'
      : failure.code === 'EXPIRED'
      ? language === 'sw'
        ? 'Muda Umekwisha'
        : 'Payment Timed Out'
      : language === 'sw'
      ? 'Malipo Hayajakamilika'
      : 'Payment Unsuccessful';

  const message = language === 'sw' ? failure.messageSw : failure.messageEn;
  const suggestedAction =
    language === 'sw' ? failure.suggestedActionSw : failure.suggestedActionEn;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.dangerSoft || '#FEE2E2',
          },
        ]}
      >
        <Ionicons name="alert-circle" size={36} color={colors.danger} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message}
      </Text>

      {suggestedAction ? (
        <View
          style={[
            styles.hintBox,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={[styles.hintText, { color: colors.text }]}>
            {suggestedAction}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {failure.canRetry && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={onRetry}
            disabled={isRetrying}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>
              {language === 'sw' ? 'Jaribu Tena' : 'Try Again'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceHover,
            },
          ]}
          onPress={onChangeMethod}
          activeOpacity={0.8}
        >
          <Ionicons name="wallet-outline" size={18} color={colors.text} />
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
            {language === 'sw' ? 'Chagua Njia Nyingine' : 'Choose Another Method'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onCancel}
          activeOpacity={0.6}
        >
          <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
            {language === 'sw' ? 'Ghairi Malipo' : 'Cancel Payment'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
  },
  hintText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
