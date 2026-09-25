import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { Badge } from '../ui/Badge';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface EarningsRecord {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  grossAmountTzs: number;
  platformFeeTzs: number;
  netPayoutTzs: number;
  paymentStatus: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  paymentProvider?: string;
}

export interface EarningsOverviewProps {
  todayGrossTzs: number;
  todayNetTzs?: number;
  weekGrossTzs: number;
  monthGrossTzs: number;
  transactions: EarningsRecord[];
  language?: 'en' | 'sw';
}

export const EarningsOverview: React.FC<EarningsOverviewProps> = ({
  todayGrossTzs,
  todayNetTzs,
  weekGrossTzs,
  monthGrossTzs,
  transactions,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING'>('ALL');

  const todayNet = todayNetTzs !== undefined
    ? todayNetTzs
    : transactions
        .filter((tx) => tx.paymentStatus === 'SUCCESS')
        .reduce((sum, tx) => sum + tx.netPayoutTzs, 0);

  const filteredTx = transactions.filter((tx) => {
    if (filter === 'ALL') return true;
    return tx.paymentStatus === filter;
  });

  const getStatusBadge = (status: EarningsRecord['paymentStatus']) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge label="Payment successful ✓" variant="success" size="sm" />;
      case 'PROCESSING':
        return <Badge label="Processing" variant="info" size="sm" />;
      case 'PENDING':
        return <Badge label="Pending" variant="warning" size="sm" />;
      case 'FAILED':
        return <Badge label="Failed" variant="error" size="sm" />;
      case 'CANCELLED':
        return <Badge label="Cancelled" variant="error" size="sm" />;
      case 'REFUNDED':
        return <Badge label="Refunded" variant="neutral" size="sm" />;
      default:
        return <Badge label={status} variant="neutral" size="sm" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Financial Overview Cards */}
      <View style={styles.metricsGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Today's Net Revenue</Text>
          <Text style={styles.summaryValue}>{formatTzs(todayNet)}</Text>
          <Text style={styles.summarySub}>Gross: {formatTzs(todayGrossTzs)}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Week (Gross)</Text>
          <Text style={styles.summaryValue}>{formatTzs(weekGrossTzs)}</Text>
          <Text style={styles.summarySub}>Direct kitchen order volume</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Month (Gross)</Text>
          <Text style={styles.summaryValue}>{formatTzs(monthGrossTzs)}</Text>
          <Text style={styles.summarySub}>Monthly sales total</Text>
        </View>
      </View>

      {/* Payout & Settlement Info Banner */}
      <View style={styles.payoutNoticeBanner}>
        <View style={styles.payoutNoticeLeft}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primaryDark} />
          <View>
            <Text style={styles.payoutNoticeTitle}>Restaurant Earnings & Settlement Records</Text>
            <Text style={styles.payoutNoticeSub}>
              Disbursements are settled based on reconciled customer order payments. Recorded transactions display verified payment and escrow status; payouts depend on partner provider clearance.
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'SUCCESS', 'PENDING'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterChip, filter === tab && styles.filterChipActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterChipText, filter === tab && styles.filterChipTextActive]}>
              {tab === 'ALL' ? 'All Payments' : tab === 'SUCCESS' ? 'Successful Payments' : 'Pending Payments'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions Table */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tableList}>
        {filteredTx.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No payment activity yet.</Text>
          </View>
        ) : (
          filteredTx.map((tx) => (
            <View key={tx.orderId} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txOrderNum}>#{tx.orderNumber}</Text>
                <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
              </View>

              <View style={styles.txMiddle}>
                <Text style={styles.txMethod}>
                  {tx.paymentProvider ? `📱 ${tx.paymentProvider}` : '📱 Mobile Money'}
                </Text>
                {getStatusBadge(tx.paymentStatus)}
              </View>

              <View style={styles.txRight}>
                <Text style={styles.txNetPrice}>{formatTzs(tx.netPayoutTzs)}</Text>
                <Text style={styles.txGross}>Gross: {formatTzs(tx.grossAmountTzs)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.card,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    flex: 1,
    minWidth: 240,
    ...Shadows.sm,
  },
  summaryLabel: {
    fontSize: Typography.Caption.fontSize,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: Typography.H2.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  summarySub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  payoutNoticeBanner: {
    backgroundColor: colors.infoSoft,
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.info,
  },
  payoutNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  payoutNoticeTitle: {
    fontSize: Typography.BodyMedium.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  payoutNoticeSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: Typography.Caption.fontSize,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  tableList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptyText: {
    fontSize: Typography.BodyMedium.fontSize,
    color: colors.textMuted,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    ...Shadows.sm,
  },
  txLeft: {
    minWidth: 120,
  },
  txOrderNum: {
    fontSize: Typography.BodyMedium.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  txDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  txMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  txMethod: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  txRight: {
    alignItems: 'flex-end',
    minWidth: 110,
  },
  txNetPrice: {
    fontSize: Typography.BodyMedium.fontSize,
    fontWeight: '700',
    color: colors.success, // Emerald/Green for net payout
  },
  txGross: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
});
let styles = createStyles(lightColors);
