import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { MobileMoneyMethodConfig } from '../../constants/paymentMethods';
import { getUssdFallbackCode } from '../../config/mobileNetworkPrefixes';
import { PaymentProgressIndicator } from '../payments/PaymentProgressIndicator';

export const PAYMENT_PROMPT_SECONDS = 120;

export interface PaymentWaitingProps {
  colors: ThemeColors;
  method: MobileMoneyMethodConfig;
  payerPhone: string;
  totalBill: number;
  countdownSeconds: number;
  isTimedOut: boolean;
  isCheckingStatus: boolean;
  onCheckStatus: () => void;
  onRetrySame: () => void;
  onChangeMethod: () => void;
  stillPendingNotice?: boolean;
}

export const PaymentWaiting: React.FC<PaymentWaitingProps> = ({
  colors,
  method,
  payerPhone,
  totalBill,
  countdownSeconds,
  isTimedOut,
  isCheckingStatus,
  onCheckStatus,
  onRetrySame,
  onChangeMethod,
  stillPendingNotice,
}) => {
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const ussdFallbackCode = getUssdFallbackCode(method.id);

  return (
    <View style={styles.container}>
      {/* 1. Header with Big Amount & Timer */}
      <View style={styles.topCard}>
        <PaymentProgressIndicator size={50} status={isCheckingStatus ? 'VERIFYING' : 'WAITING'} />

        <View style={styles.amountWrap}>
          <Text style={styles.amountLabel}>{t('cartTotal')}</Text>
          <Text style={[styles.bigAmountText, { color: colors.primary }]}>
            TZS {totalBill.toLocaleString()}
          </Text>
        </View>

        {!isTimedOut && (
          <View style={[styles.timerBadge, { backgroundColor: colors.surfaceHover }]}>
            <Ionicons name="time-outline" size={15} color={colors.primary} />
            <Text style={[styles.timerText, { color: colors.primary }]}>
              {countdownSeconds}s
            </Text>
          </View>
        )}
      </View>

      {/* 2. Main Guidance: Check phone & enter PIN */}
      <View style={styles.guidanceBox}>
        <Text style={styles.mainHeading}>
          {isTimedOut ? t('paymentTimedOut') : t('paymentCheckPhone')}
        </Text>
        <Text style={styles.carrierSub}>
          {method.carrierName} • {payerPhone}
        </Text>
        <Text style={styles.instructionsText}>
          {t('paymentPromptSent')
            .replace('{amount}', totalBill.toLocaleString())
            .replace('{phone}', payerPhone)
            .replace('{guidance}', method.ussdGuidanceSw || method.ussdGuidanceEn)}
        </Text>
      </View>

      {/* 3. In-flight Pending Toast Notice */}
      {stillPendingNotice && (
        <View style={[styles.noticeBanner, { backgroundColor: colors.warningSoft || colors.surfaceInteractive }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={[styles.noticeText, { color: colors.text }]}>
            {t('paymentApproveOnPhone')}
          </Text>
        </View>
      )}

      {/* 4. Confirmed USSD Fallback Code Box (hidden if unconfirmed) */}
      {ussdFallbackCode && (
        <View style={[styles.fallbackCard, { backgroundColor: colors.surfaceInteractive }]}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fallbackTitle}>
              {t('paymentUssdFallbackNotice').replace('{code}', ussdFallbackCode)}
            </Text>
          </View>
        </View>
      )}

      {/* 5. Security Notice */}
      <View style={styles.securityBox}>
        <Ionicons name="shield-checkmark" size={16} color={colors.success} />
        <Text style={styles.securityText}>
          {t('paymentSecurityPinNotice')}
        </Text>
      </View>

      {/* 6. Action CTAs */}
      {isTimedOut ? (
        <View style={styles.actionColumn}>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
            onPress={onRetrySame}
            activeOpacity={0.8}
            disabled={isCheckingStatus}
          >
            {isCheckingStatus ? (
              <ActivityIndicator size="small" color={colors.onPrimary || '#FFFFFF'} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color={colors.onPrimary || '#FFFFFF'} />
                <Text style={styles.primaryActionBtnText}>
                  {t('paymentRetrySame')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
            onPress={onChangeMethod}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryActionBtnText, { color: colors.text }]}>
              {t('paymentChangeMethod')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionColumn}>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: colors.success }]}
            onPress={onCheckStatus}
            activeOpacity={0.8}
            disabled={isCheckingStatus}
          >
            {isCheckingStatus ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>
                  {t('paymentIvePaid')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelLinkBtn}
            onPress={onChangeMethod}
          >
            <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>
              {t('paymentChangeMethod')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: 14,
    },
    topCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    amountWrap: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    amountLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    bigAmountText: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    timerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: Radii.full,
      gap: 4,
    },
    timerText: {
      fontSize: 13,
      fontWeight: '800',
    },
    guidanceBox: {
      alignItems: 'center',
      paddingVertical: Spacing.xs,
      gap: 4,
    },
    mainHeading: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    carrierSub: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    instructionsText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 4,
      paddingHorizontal: Spacing.xs,
    },
    noticeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.sm,
      borderRadius: Radii.md,
      gap: 8,
    },
    noticeText: {
      fontSize: 12.5,
      fontWeight: '600',
      flex: 1,
    },
    fallbackCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radii.md,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fallbackTitle: {
      fontSize: 12.5,
      color: colors.text,
      lineHeight: 17,
      fontWeight: '500',
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
    actionColumn: {
      gap: 8,
      marginTop: 4,
    },
    primaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: Radii.md,
      gap: 8,
    },
    primaryActionBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    secondaryActionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    secondaryActionBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    cancelLinkBtn: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    cancelLinkText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
