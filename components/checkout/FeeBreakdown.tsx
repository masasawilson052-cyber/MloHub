import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFeeRules } from '../../hooks/useFeeRules';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { formatTzs } from '../../utils/formatters';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';

export interface FeeBreakdownProps {
  foodSubtotalTzs?: number;
  subtotalTzs?: number;
  deliveryFeeTzs?: number | null;
  serviceFeeTzs?: number | null;
  discountTzs?: number | null;
  totalTzs: number;
  fulfillmentType?: string;
  hideDeliveryFee?: boolean;
  deliveryFeePending?: boolean;
  deliveryFromFeeTzs?: number | null;
  containerStyle?: ViewStyle;
  isRestaurantView?: boolean;
  restaurantDeliveryFeeLabel?: boolean;
  compact?: boolean;
  showDisclaimer?: boolean;
  disclaimerText?: string;
}

export const FeeBreakdown: React.FC<FeeBreakdownProps> = ({
  foodSubtotalTzs,
  subtotalTzs,
  deliveryFeeTzs,
  serviceFeeTzs,
  discountTzs,
  totalTzs,
  fulfillmentType = 'Delivery',
  hideDeliveryFee = false,
  deliveryFeePending = false,
  deliveryFromFeeTzs,
  containerStyle,
  restaurantDeliveryFeeLabel = false,
  compact = false,
  showDisclaimer = false,
  disclaimerText,
}) => {
  const effectiveSubtotal = foodSubtotalTzs ?? subtotalTzs ?? 0;
  const { colors } = useTheme();
  const { language, t } = useLanguage();
  const { feeRules } = useFeeRules();

  const [showServiceInfo, setShowServiceInfo] = useState(false);

  // Dynamic service fee explanation built from authoritative feeRules (never hard-coded 3%, 200, 500)
  const servicePct = (feeRules.serviceFeeBps / 100);
  const minTzs = feeRules.serviceFeeMinTzs.toLocaleString();
  const maxTzs = feeRules.serviceFeeMaxTzs.toLocaleString();

  const serviceFeeExplanation = language === 'sw'
    ? `${servicePct}% (kiwango cha chini TZS ${minTzs}, cha juu TZS ${maxTzs}). Husaidia kuendesha MloHub: malipo, huduma na usalama.`
    : `${servicePct}% (min TZS ${minTzs}, max TZS ${maxTzs}). Helps keep MloHub running: payments, support and safety.`;

  const isDelivery = fulfillmentType === 'Delivery';
  const showDeliveryRow = !hideDeliveryFee && isDelivery;
  const effectiveServiceFee = typeof serviceFeeTzs === 'number' ? serviceFeeTzs : 0;
  const effectiveDiscount = typeof discountTzs === 'number' ? discountTzs : 0;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* 1. Food Subtotal */}
      <View style={[styles.row, compact && styles.compactRow]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t('feeBreakdownFoodSubtotal')}
        </Text>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {formatTzs(effectiveSubtotal)}
        </Text>
      </View>

      {/* 2. Delivery Fee */}
      {showDeliveryRow && (
        <View style={[styles.row, compact && styles.compactRow]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {restaurantDeliveryFeeLabel
              ? t('feeBreakdownDeliveryFeePaidToYou')
              : t('feeBreakdownDeliveryFee')}
          </Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>
            {deliveryFeePending
              ? deliveryFromFeeTzs
                ? t('deliveryFromX').replace('{amount}', formatTzs(deliveryFromFeeTzs))
                : t('deliveryFeeAtCheckout')
              : typeof deliveryFeeTzs === 'number'
              ? deliveryFeeTzs === 0
                ? (language === 'sw' ? 'Bure' : 'Free')
                : formatTzs(deliveryFeeTzs)
              : t('deliveryFeeAtCheckout')}
          </Text>
        </View>
      )}

      {/* 3. Service Fee (with interactive info explaining dynamic rule) */}
      <View style={[styles.row, compact && styles.compactRow]}>
        <View style={styles.labelWithInfo}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('feeBreakdownServiceFee')}
          </Text>
          <TouchableOpacity
            onPress={() => setShowServiceInfo(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('feeBreakdownServiceFeeTooltipTitle')}
            style={styles.infoIconBtn}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {effectiveServiceFee > 0 ? formatTzs(effectiveServiceFee) : 'TZS 0'}
        </Text>
      </View>

      {/* 4. Discount (when promos/discounts applied) */}
      {effectiveDiscount > 0 && (
        <View style={[styles.row, compact && styles.compactRow]}>
          <Text style={[styles.label, { color: colors.success }]}>
            {t('feeBreakdownDiscount')}
          </Text>
          <Text style={[styles.value, { color: colors.success, fontWeight: '700' }]}>
            -{formatTzs(effectiveDiscount)}
          </Text>
        </View>
      )}

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* 5. Authoritative Total */}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>
          {t('feeBreakdownTotal')}
        </Text>
        <Text style={[styles.totalValue, { color: colors.primary }]}>
          {formatTzs(totalTzs)}
        </Text>
      </View>

      {showDisclaimer && (
        <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
          {disclaimerText || t('checkoutPricingDisclaimer')}
        </Text>
      )}

      {/* Service Fee Info Dialog / Modal */}
      <Modal
        visible={showServiceInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowServiceInfo(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowServiceInfo(false)}
        >
          <View
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {t('feeBreakdownServiceFeeTooltipTitle')}
              </Text>
            </View>

            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              {serviceFeeExplanation}
            </Text>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowServiceInfo(false)}
              accessibilityRole="button"
            >
              <Text style={[styles.modalCloseText, { color: colors.onPrimary }]}>
                {language === 'sw' ? 'Nimeelewa' : 'Got it'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  compactRow: {
    paddingVertical: 2,
  },
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoIconBtn: {
    padding: 2,
  },
  label: {
    fontSize: 13.5,
  },
  value: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  totalRow: {
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  disclaimerText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modalIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  modalCloseBtn: {
    borderRadius: Radii.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
