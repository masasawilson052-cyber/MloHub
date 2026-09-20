import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { PaymentTransactionEntity } from '../../db/types';
import { formatTzs } from '../../config/platformFees';
import { runtimeConfig } from '../../lib/runtimeConfig';

interface PaymentsMonitorProps {
  payments: PaymentTransactionEntity[];
  language?: 'en' | 'sw';
}

export const PaymentsMonitor: React.FC<PaymentsMonitorProps> = ({
  payments,
  language = 'en',
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = payments.filter((pay) => {
    const isSuccess = pay.status === 'PAID' || pay.status === 'success';
    const isPending = pay.status === 'PENDING' || pay.status === 'pending' || pay.status === 'AWAITING_PAYMENT';
    const isFailed = pay.status === 'FAILED' || pay.status === 'failed';

    if (statusFilter === 'SUCCESS' && !isSuccess) return false;
    if (statusFilter === 'PENDING' && !isPending) return false;
    if (statusFilter === 'FAILED' && !isFailed) return false;

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      pay.id.toLowerCase().includes(query) ||
      pay.providerReference.toLowerCase().includes(query) ||
      pay.restaurantName.toLowerCase().includes(query) ||
      (pay.payerPhone && pay.payerPhone.includes(query)) ||
      pay.paymentMethod.toLowerCase().includes(query)
    );
  });

  const totalVolume = payments.reduce((acc, p) => acc + (p.amountTzs || 0), 0);
  const successPayments = payments.filter((p) => p.status === 'PAID' || p.status === 'success');
  const successVolume = successPayments.reduce((acc, p) => acc + (p.amountTzs || 0), 0);
  const pendingCount = payments.filter((p) => p.status === 'PENDING' || p.status === 'pending' || p.status === 'AWAITING_PAYMENT').length;
  const failedCount = payments.filter((p) => p.status === 'FAILED' || p.status === 'failed').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>
            {language === 'sw' ? 'Usimamizi wa Miamala ya Malipo' : 'Payments Supervision & Gateway Monitor'}
          </Text>
          <Text style={styles.subtitle}>
            Read-only surveillance of mobile money transactions, payment references, and gateway health.
          </Text>
        </View>
      </View>

      {/* Security & Gateway Notice Banner */}
      <View style={styles.noticeBanner}>
        <Ionicons name="shield-checkmark" size={20} color="#0369a1" />
        <View style={styles.noticeTextArea}>
          <Text style={styles.noticeTitle}>Server-Driven Zero-Trust Financial Ledger</Text>
          <Text style={styles.noticeBody}>
            Authoritative amount locking, HMAC-SHA256 webhook signatures, and append-only payment events. Transactions are immutable.
          </Text>
        </View>
        <View style={styles.simulatedPill}>
          <Text style={styles.simulatedText}>
            {runtimeConfig.isProduction ? 'GATEWAY: PRODUCTION' : 'GATEWAY: SANDBOX / PILOT'}
          </Text>
        </View>
      </View>

      {/* Financial KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{formatTzs(totalVolume)}</Text>
          <Text style={styles.kpiLabel}>Total Transaction Volume</Text>
          <Text style={styles.kpiSub}>{payments.length} transactions initiated</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{formatTzs(successVolume)}</Text>
          <Text style={styles.kpiLabel}>Captured Volume</Text>
          <Text style={styles.kpiSub}>{successPayments.length} successful payments</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{pendingCount}</Text>
          <Text style={styles.kpiLabel}>Awaiting Verification</Text>
          <Text style={styles.kpiSub}>Pending carrier confirmation</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#ef4444' }]}>{failedCount}</Text>
          <Text style={styles.kpiLabel}>Failed / Cancelled</Text>
          <Text style={styles.kpiSub}>Timeout or insufficient funds</Text>
        </View>
      </View>

      {/* Filters & Search */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPills}>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'ALL' && styles.pillActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text style={[styles.pillText, statusFilter === 'ALL' && styles.pillTextActive]}>
              All ({payments.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'SUCCESS' && styles.pillActive]}
            onPress={() => setStatusFilter('SUCCESS')}
          >
            <Text style={[styles.pillText, statusFilter === 'SUCCESS' && styles.pillTextActive]}>
              Settled ({successPayments.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'PENDING' && styles.pillActive]}
            onPress={() => setStatusFilter('PENDING')}
          >
            <Text style={[styles.pillText, statusFilter === 'PENDING' && styles.pillTextActive]}>
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'FAILED' && styles.pillActive]}
            onPress={() => setStatusFilter('FAILED')}
          >
            <Text style={[styles.pillText, statusFilter === 'FAILED' && styles.pillTextActive]}>
              Failed ({failedCount})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ref, restaurant, phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Payments List */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Transactions Recorded</Text>
            <Text style={styles.emptySubtitle}>No payment records match the selected filter.</Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filtered.map((pay) => {
              const isPaid = pay.status === 'PAID' || pay.status === 'success';
              const isFailed = pay.status === 'FAILED' || pay.status === 'failed';

              return (
                <View key={pay.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.providerRef}>{pay.providerReference || pay.id}</Text>
                      <Text style={styles.restaurantName}>{pay.restaurantName}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isPaid
                          ? styles.statusSuccess
                          : isFailed
                          ? styles.statusFailed
                          : styles.statusPending,
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {isPaid ? 'SUCCESS' : isFailed ? 'FAILED' : 'PENDING'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardMain}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Gross Amount:</Text>
                      <Text style={styles.amountValue}>{formatTzs(pay.amountTzs)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Platform Comm (10%):</Text>
                      <Text style={styles.commValue}>{formatTzs(Math.round(pay.amountTzs * 0.1))}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.methodInfo}>
                      <Ionicons name="phone-portrait-outline" size={13} color="#64748b" />
                      <Text style={styles.methodText}>
                        {pay.paymentMethod} {pay.payerPhone ? `• ${pay.payerPhone}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      {new Date(pay.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  noticeTextArea: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
  },
  noticeBody: {
    fontSize: 12,
    color: '#0c4a6e',
    lineHeight: 16,
    marginTop: 2,
  },
  simulatedPill: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  simulatedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Shadows.sm,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 220,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    padding: 0,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: 300,
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  providerRef: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  restaurantName: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  statusSuccess: {
    backgroundColor: '#dcfce7',
  },
  statusPending: {
    backgroundColor: '#ffedd5',
  },
  statusFailed: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
  cardMain: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    padding: Spacing.sm,
    gap: 4,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  commValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  methodText: {
    fontSize: 11,
    color: '#475569',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
