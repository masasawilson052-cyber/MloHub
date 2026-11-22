import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../../theme/palettes';
import { Translations } from '../../../context/LanguageContext';
import { formatTzs } from '../../../config/platformFees';

export interface FeeRulesExampleProps {
  colors: ThemeColors;
  t: (key: keyof Translations) => string;
  subtotal: number;
  serviceFee: number;
  commission: number;
  restaurantPayout: number;
}

export const FeeRulesExample: React.FC<FeeRulesExampleProps> = ({
  colors,
  t,
  subtotal,
  serviceFee,
  commission,
  restaurantPayout,
}) => {
  const styles = createStyles(colors);

  return (
    <View style={[styles.exampleCard, { backgroundColor: colors.surfaceInteractive, borderColor: colors.border }]}>
      <View style={styles.exampleHeader}>
        <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
        <Text style={[styles.exampleTitle, { color: colors.textPrimary }]}>
          {t('feeRulesLiveExampleTitle')}
        </Text>
      </View>
      <Text style={[styles.fieldHint, { color: colors.textMuted, marginBottom: 10 }]}>
        Sample order calculation for a delivery order:
      </Text>

      <View style={styles.exampleRow}>
        <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>{t('feeRulesExampleSubtotal')}:</Text>
        <Text style={[styles.exampleVal, { color: colors.textPrimary }]}>{formatTzs(subtotal)}</Text>
      </View>
      <View style={styles.exampleRow}>
        <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>{t('feeRulesExampleServiceFee')}:</Text>
        <Text style={[styles.exampleVal, { color: colors.success }]}>+{formatTzs(serviceFee)}</Text>
      </View>
      <View style={styles.exampleRow}>
        <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>{t('feeRulesExampleCommission')}:</Text>
        <Text style={[styles.exampleVal, { color: colors.danger }]}>-{formatTzs(commission)}</Text>
      </View>
      <View style={[styles.exampleRow, styles.exampleHighlightRow]}>
        <Text style={[styles.exampleLabelHighlight, { color: colors.textPrimary }]}>{t('feeRulesExamplePayout')}:</Text>
        <Text style={[styles.exampleValHighlight, { color: colors.primary }]}>{formatTzs(restaurantPayout)}</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    exampleCard: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 14,
      marginTop: 14,
      marginBottom: 10,
    },
    exampleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    exampleTitle: {
      fontSize: 13,
      fontWeight: '700',
    },
    exampleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
    },
    exampleLabel: {
      fontSize: 13,
    },
    exampleVal: {
      fontSize: 13,
      fontWeight: '600',
    },
    exampleHighlightRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 6,
      paddingTop: 8,
    },
    exampleLabelHighlight: {
      fontSize: 13.5,
      fontWeight: '700',
    },
    exampleValHighlight: {
      fontSize: 15,
      fontWeight: '800',
    },
    fieldHint: {
      fontSize: 11,
      marginTop: 3,
    },
  });
