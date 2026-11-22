import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { useLanguage } from '../../context/LanguageContext';

export interface PaymentSummaryCardProps {
  colors: ThemeColors;
  restaurantName: string;
  isReservation: boolean;
  isCustomMeal: boolean;
  subtotal: number;
  currentDelivery: number;
  currentServiceFee: number;
  totalBill: number;
}

export const PaymentSummaryCard: React.FC<PaymentSummaryCardProps> = ({
  colors,
  restaurantName,
  isReservation,
  isCustomMeal,
  subtotal,
  currentDelivery,
  currentServiceFee,
  totalBill,
}) => {
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <Text style={styles.restaurantName}>🍽️ {restaurantName}</Text>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>
            {isReservation ? '🪑 Reservation' : isCustomMeal ? '🍲 Custom' : '🍲 Order'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>{t('checkoutFoodSubtotal')}:</Text>
        <Text style={styles.priceVal}>TZS {subtotal.toLocaleString()}</Text>
      </View>

      {!isReservation && currentDelivery > 0 && (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{t('checkoutEstimatedDelivery')}:</Text>
          <Text style={styles.priceVal}>TZS {currentDelivery.toLocaleString()}</Text>
        </View>
      )}

      {!isReservation && currentServiceFee > 0 && (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{t('checkoutPlatformServiceFee')}:</Text>
          <Text style={styles.priceVal}>TZS {currentServiceFee.toLocaleString()}</Text>
        </View>
      )}

      <View style={[styles.priceRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>{t('paymentTotalPayable')}</Text>
        <Text style={styles.totalVal}>TZS {totalBill.toLocaleString()}</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    restaurantName: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      flex: 1,
    },
    badgePill: {
      backgroundColor: colors.surfaceHover,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: Radii.full,
    },
    badgePillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 10,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    priceLabel: {
      fontSize: 12.5,
      color: colors.textSecondary,
    },
    priceVal: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    totalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginTop: 4,
    },
    totalLabel: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.text,
    },
    totalVal: {
      fontSize: 17,
      fontWeight: '900',
      color: colors.primary,
    },
  });
