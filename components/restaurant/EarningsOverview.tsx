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
          <Ionicons name="information-circle-outline" size={20} color={Colors.primaryDark} />
          <View>
            <Text style={styles.payoutNoticeTitle}>Automated Mobile Money Payouts</Text>
            <Text style={styles.payoutNoticeSub}>
              Payout disbursements are processed via ClickPesa/Selcom directly to your verified Lipa / Till account. Recorded transactions display real customer payment status.
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

const styles = StyleSheet.create({
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
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flex: 1,
    minWidth: 240,
    ...Shadows.sm,
  },
  summaryLabel: {
    fontSize: Typography.Caption.fontSize,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: Typography.H2.fontSize,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  summarySub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  payoutNoticeBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
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
    color: Colors.textPrimary,
  },
  payoutNoticeSub: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Typography.Caption.fontSize,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyText: {
    fontSize: Typography.BodyMedium.fontSize,
    color: Colors.textMuted,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  txLeft: {
    minWidth: 120,
  },
  txOrderNum: {
    fontSize: Typography.BodyMedium.fontSize,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  txDate: {
    fontSize: 12,
    color: Colors.textMuted,
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
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  txRight: {
    alignItems: 'flex-end',
    minWidth: 110,
  },
  txNetPrice: {
    fontSize: Typography.BodyMedium.fontSize,
    fontWeight: '700',
    color: '#059669', // Emerald/Green for net payout
  },
  txGross: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
