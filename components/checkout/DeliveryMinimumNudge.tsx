import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { deliveryMinimumShortfall, formatTzs, PublicFeeRules } from '../../config/platformFees';

export interface DeliveryMinimumNudgeProps {
  colors: ThemeColors;
  language: 'en' | 'sw';
  subtotalTzs: number;
  feeRules: PublicFeeRules;
  zoneMinimumTzs?: number;
  takeawayAvailable?: boolean;
  onBackToMenu: () => void;
  onSwitchToTakeaway: () => void;
}

export const DeliveryMinimumNudge: React.FC<DeliveryMinimumNudgeProps> = ({
  colors,
  language,
  subtotalTzs,
  feeRules,
  zoneMinimumTzs,
  takeawayAvailable = true,
  onBackToMenu,
  onSwitchToTakeaway,
}) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  const shortfallTzs = useMemo(() => {
    return deliveryMinimumShortfall(subtotalTzs, feeRules, zoneMinimumTzs);
  }, [subtotalTzs, feeRules, zoneMinimumTzs]);

  const effectiveMinimum = useMemo(() => {
    return Math.max(feeRules.deliveryMinOrderTzs, zoneMinimumTzs || 0);
  }, [feeRules.deliveryMinOrderTzs, zoneMinimumTzs]);

  const progressPct = useMemo(() => {
    if (effectiveMinimum <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((subtotalTzs / effectiveMinimum) * 100)));
  }, [subtotalTzs, effectiveMinimum]);

  if (shortfallTzs <= 0) {
    return null;
  }

  const nudgeTitle = language === 'sw'
    ? `Ongeza ${formatTzs(shortfallTzs)} zaidi ili uletewe`
    : `Add ${formatTzs(shortfallTzs)} more for delivery`;

  const nudgeSub = language === 'sw'
    ? `Kiwango cha chini: ${formatTzs(effectiveMinimum)} • Sasa: ${formatTzs(subtotalTzs)} (${progressPct}%)`
    : `Delivery minimum: ${formatTzs(effectiveMinimum)} • Current: ${formatTzs(subtotalTzs)} (${progressPct}%)`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="cart-outline" size={18} color={colors.warning} />
        <Text style={styles.title}>{nudgeTitle}</Text>
      </View>
      <Text style={styles.subtext}>{nudgeSub}</Text>

      {/* Progress Bar (Subtotal / Effective Minimum) */}
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${progressPct}%` }]} />
      </View>

      {/* Quick Action CTAs */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.menuBtn} onPress={onBackToMenu}>
          <Ionicons name="restaurant-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.menuBtnText}>
            {language === 'sw' ? 'Rudi kwenye Menyu' : 'Back to Menu'}
          </Text>
        </TouchableOpacity>

        {takeawayAvailable && (
          <TouchableOpacity style={styles.takeawayBtn} onPress={onSwitchToTakeaway}>
            <Ionicons name="bag-handle-outline" size={14} color={colors.onPrimary} style={{ marginRight: 4 }} />
            <Text style={styles.takeawayBtnText}>
              {language === 'sw' ? 'Badili iwe ya Kuchukua' : 'Switch to Takeaway'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: Radii.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    title: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    subtext: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: 10,
    },
    bar: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: 3,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    menuBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.card,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    takeawayBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.primary,
      borderRadius: Radii.sm,
    },
    takeawayBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
