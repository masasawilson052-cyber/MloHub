import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';
import { FeeBreakdown } from './FeeBreakdown';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { formatTzs } from '../../utils/formatters';

export interface OrderConfirmationItem {
  dishName: string;
  quantity: number;
  priceTzs: number;
  selectedModifiers?: any[];
}

export interface OrderConfirmationViewProps {
  orderNumber: string;
  restaurantName: string;
  items: OrderConfirmationItem[];
  foodSubtotalTzs: number;
  deliveryFeeTzs?: number;
  serviceFeeTzs?: number;
  totalPaidTzs: number;
  fulfillmentType?: string;
  estimatedPrepMinutes?: number | null;
  estimatedDeliveryMinutes?: number | null;
  status?: string;
  onTrackOrder: () => void;
  onClose?: () => void;
  onHome?: () => void;
}

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  orderNumber,
  restaurantName,
  items,
  foodSubtotalTzs,
  deliveryFeeTzs = 0,
  serviceFeeTzs = 0,
  totalPaidTzs,
  fulfillmentType = 'Delivery',
  estimatedPrepMinutes,
  estimatedDeliveryMinutes,
  status = 'CONFIRMED',
  onTrackOrder,
  onClose,
  onHome,
}) => {
  const handleClose = onHome || onClose || (() => {});
  const { colors } = useTheme();
  const { language, t } = useLanguage();

  // Authoritative estimated time: prep minutes + delivery minutes.
  // Strictly null if neither exists — NEVER hard-coded "30-45".
  const prep = typeof estimatedPrepMinutes === 'number' && estimatedPrepMinutes > 0 ? estimatedPrepMinutes : 0;
  const deliv = fulfillmentType === 'Delivery' && typeof estimatedDeliveryMinutes === 'number' && estimatedDeliveryMinutes > 0 ? estimatedDeliveryMinutes : 0;
  const totalEstimatedMins = prep + deliv > 0 ? prep + deliv : null;

  // WhatsApp share message: order number, restaurant, items, total and status only (no private data)
  const handleShareWhatsApp = async () => {
    const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://mlohub.expo.app';
    const itemsSummary = items.map((i) => `${i.quantity}x ${i.dishName}`).join(', ');

    const text = language === 'sw'
      ? `Agizo la MloHub: ${orderNumber}\nMgahawa: ${restaurantName}\nVyakula: ${itemsSummary}\nJumla Iliyolipwa: ${formatTzs(totalPaidTzs)}\nHali: Imethibitishwa\nFuatilia hapa: ${appUrl}/(tabs)/orders`
      : `MloHub Order: ${orderNumber}\nRestaurant: ${restaurantName}\nItems: ${itemsSummary}\nTotal Paid: ${formatTzs(totalPaidTzs)}\nStatus: Confirmed\nTrack at: ${appUrl}/(tabs)/orders`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
      } else {
        await Share.share({ message: text });
      }
    } catch {
      await Share.share({ message: text });
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Success Hero Badge */}
      <View style={styles.heroSection}>
        <View style={[styles.successCircle, { backgroundColor: colors.successSoft || '#DCFCE7' }]}>
          <Ionicons name="checkmark-sharp" size={44} color={colors.success} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('orderConfirmedTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('orderConfirmedSubtitle')}
        </Text>
      </View>

      {/* 2. Order ID & Restaurant Banner */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
              {t('orderNumberLabel')}
            </Text>
            <Text style={[styles.orderNumber, { color: colors.primary }]}>
              {orderNumber}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.successSoft || '#DCFCE7' }]}>
            <Text style={[styles.statusBadgeText, { color: colors.success }]}>
              {status}
            </Text>
          </View>
        </View>

        <View style={styles.restaurantRow}>
          <Ionicons name="restaurant-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.restaurantName, { color: colors.textPrimary }]}>
            {restaurantName}
          </Text>
        </View>

        {/* Estimated Time (shown ONLY when prep or delivery time really exists) */}
        {totalEstimatedMins !== null && (
          <View style={[styles.estTimeRow, { backgroundColor: colors.surfaceInteractive }]}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={[styles.estTimeText, { color: colors.textPrimary }]}>
              {t('orderEstimatedTimeLabel')}: ~{totalEstimatedMins} {language === 'sw' ? 'dakika' : 'mins'}
            </Text>
          </View>
        )}
      </View>

      {/* 3. Items Summary */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {t('orderItemsLabel')} ({items.length})
        </Text>
        <View style={styles.itemsList}>
          {items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={[styles.itemQty, { color: colors.primary }]}>
                {item.quantity}x
              </Text>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                  {item.dishName}
                </Text>
                {Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                  <Text style={[styles.itemModifiers, { color: colors.textSecondary }]}>
                    {item.selectedModifiers.map((m: any) => m.name || m.option_name || '').filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
              <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>
                {formatTzs(item.priceTzs * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        {/* 4. Complete Authoritative Fee Breakdown */}
        <FeeBreakdown
          foodSubtotalTzs={foodSubtotalTzs}
          deliveryFeeTzs={deliveryFeeTzs}
          serviceFeeTzs={serviceFeeTzs}
          totalTzs={totalPaidTzs}
          fulfillmentType={fulfillmentType}
          compact={true}
          containerStyle={styles.feeBreakdownWrap}
        />
      </View>

      {/* 5. Clear Next Step Guidance */}
      <View style={[styles.nextStepBox, { backgroundColor: colors.surfaceInteractive, borderColor: colors.border }]}>
        <View style={[styles.nextStepIconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="flame" size={20} color={colors.primary} />
        </View>
        <View style={styles.nextStepContent}>
          <Text style={[styles.nextStepTitle, { color: colors.textPrimary }]}>
            {t('orderNextStepLabel')}
          </Text>
          <Text style={[styles.nextStepDesc, { color: colors.textSecondary }]}>
            {t('orderNextStepDesc')}
          </Text>
        </View>
      </View>

      {/* 6. Primary Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          title={t('orderTrackButton')}
          onPress={onTrackOrder}
          variant="primary"
          size="lg"
          fullWidth={true}
          icon={<Ionicons name="navigate" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />}
        />

        <TouchableOpacity
          style={[styles.whatsappBtn, { borderColor: '#25D366' }]}
          onPress={handleShareWhatsApp}
          accessibilityRole="button"
          accessibilityLabel={t('orderShareWhatsAppButton')}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={styles.whatsappText}>
            {t('orderShareWhatsAppButton')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClose}
          accessibilityRole="button"
        >
          <Text style={[styles.closeText, { color: colors.textSecondary }]}>
            {t('checkoutBackHome')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    gap: Spacing.md,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
  },
  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  metaLabel: {
    fontSize: 11.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '700',
  },
  estTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radii.md,
    marginTop: Spacing.sm,
  },
  estTimeText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  itemsList: {
    gap: 8,
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemQty: {
    fontSize: 13.5,
    fontWeight: '700',
    width: 26,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  itemModifiers: {
    fontSize: 11.5,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  feeBreakdownWrap: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  nextStepBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  nextStepIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  nextStepDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  actionButtons: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: Radii.md,
    paddingVertical: 12,
  },
  whatsappText: {
    color: '#25D366',
    fontSize: 14.5,
    fontWeight: '700',
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  closeText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
});
