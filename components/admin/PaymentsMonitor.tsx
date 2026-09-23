import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { PaymentTransactionEntity } from '../../db/types';
import { formatTzs } from '../../config/platformFees';

interface PaymentsMonitorProps {
  payments: PaymentTransactionEntity[];
  language?: 'en' | 'sw';
}

type PaymentFilter = 'ALL' | 'CAPTURED' | 'PENDING' | 'FAILED' | 'REFUNDED';

export const PaymentsMonitor: React.FC<PaymentsMonitorProps> = ({
  payments,
  language = 'en',
}) => {
  const { colors } = useTheme();
  const [statusFilter, setStatusFilter] = useState<PaymentFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentTransactionEntity | null>(null);

  // Volume and counts calculations (authoritative)
  const attemptedVolume = payments.reduce((acc, p) => acc + (p.amountTzs || 0), 0);

  const capturedPayments = payments.filter(
    (p) =>
      p.status === 'PAID' ||
      p.status === 'success' ||
      p.status === 'SUCCESS' ||
      p.status === 'CAPTURED'
  );
  const capturedVolume = capturedPayments.reduce((acc, p) => acc + (p.amountTzs || 0), 0);

  const pendingPayments = payments.filter(
    (p) =>
      p.status === 'PENDING' ||
      p.status === 'pending' ||
      p.status === 'AWAITING_PAYMENT' ||
      p.status === 'PROCESSING'
  );

  const failedPayments = payments.filter(
    (p) =>
      p.status === 'FAILED' ||
      p.status === 'failed' ||
      p.status === 'CANCELLED'
  );

  const refundedPayments = payments.filter(
    (p) => p.status === 'REFUNDED'
  );

  const filtered = payments.filter((pay) => {
    const isCaptured =
      pay.status === 'PAID' ||
      pay.status === 'success' ||
      pay.status === 'SUCCESS' ||
      pay.status === 'CAPTURED';
    const isPending =
      pay.status === 'PENDING' ||
      pay.status === 'pending' ||
      pay.status === 'AWAITING_PAYMENT' ||
      pay.status === 'PROCESSING';
    const isFailed =
      pay.status === 'FAILED' ||
      pay.status === 'failed' ||
      pay.status === 'CANCELLED';
    const isRefunded = pay.status === 'REFUNDED';

    if (statusFilter === 'CAPTURED' && !isCaptured) return false;
    if (statusFilter === 'PENDING' && !isPending) return false;
    if (statusFilter === 'FAILED' && !isFailed) return false;
    if (statusFilter === 'REFUNDED' && !isRefunded) return false;

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      pay.id.toLowerCase().includes(query) ||
      (pay.providerReference && pay.providerReference.toLowerCase().includes(query)) ||
      (pay.restaurantName && pay.restaurantName.toLowerCase().includes(query)) ||
      (pay.payerPhone && pay.payerPhone.includes(query)) ||
      (pay.paymentMethod && pay.paymentMethod.toLowerCase().includes(query))
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Usimamizi wa Miamala ya Malipo' : 'Payments Supervision & Gateway Monitor'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Real-time surveillance of payment captures, mobile money references, refunds, and reconciliation health.
          </Text>
        </View>
      </View>

      {/* Financial Volume KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Captured Volume</Text>
          <Text style={[styles.kpiValue, { color: colors.success }]}>{formatTzs(capturedVolume)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>
            {capturedPayments.length} successful transactions
          </Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Attempted Volume</Text>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{formatTzs(attemptedVolume)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>
            {payments.length} total intents initiated
          </Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Pending Reconcile</Text>
          <Text style={[styles.kpiValue, { color: pendingPayments.length > 0 ? colors.warning : colors.textPrimary }]}>
            {pendingPayments.length}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Awaiting provider callback</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Refunded</Text>
          <Text style={[styles.kpiValue, { color: colors.info }]}>{refundedPayments.length}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Separated from failed attempts</Text>
        </View>
      </View>

      {/* Filter Tabs & Search */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPills}>
          {(
            [
              { key: 'ALL', label: `All (${payments.length})` },
              { key: 'CAPTURED', label: `Captured (${capturedPayments.length})` },
              { key: 'PENDING', label: `Pending (${pendingPayments.length})` },
              { key: 'FAILED', label: `Failed (${failedPayments.length})` },
              { key: 'REFUNDED', label: `Refunded (${refundedPayments.length})` },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.pill,
                { backgroundColor: colors.surface, borderColor: colors.border },
                statusFilter === tab.key && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.textSecondary },
                  statusFilter === tab.key && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={14} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search ref, restaurant, phone..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Payments List */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Transactions Recorded</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              No payment records match the selected filter.
            </Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filtered.map((pay) => {
              const isPaid =
                pay.status === 'PAID' ||
                pay.status === 'success' ||
                pay.status === 'SUCCESS' ||
                pay.status === 'CAPTURED';
              const isRefunded = pay.status === 'REFUNDED';
              const isFailed =
                pay.status === 'FAILED' ||
                pay.status === 'failed' ||
                pay.status === 'CANCELLED';

              const badgeBg = isPaid
                ? colors.successSoft
                : isRefunded
                ? colors.infoSoft
                : isFailed
                ? colors.dangerSoft
                : colors.warningSoft;

              const badgeColor = isPaid
                ? colors.success
                : isRefunded
                ? colors.info
                : isFailed
                ? colors.danger
                : colors.warning;

              const label = isPaid ? 'CAPTURED' : isRefunded ? 'REFUNDED' : isFailed ? 'FAILED' : 'PENDING';

              return (
                <TouchableOpacity
                  key={pay.id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setSelectedPayment(pay)}
                >
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={[styles.providerRef, { color: colors.textPrimary }]}>
                        {pay.providerReference || pay.id}
                      </Text>
                      <Text style={[styles.restaurantName, { color: colors.textSecondary }]}>
                        {pay.restaurantName}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.statusBadgeText, { color: badgeColor }]}>{label}</Text>
                    </View>
                  </View>

                  <View style={styles.cardMain}>
                    <View style={styles.amountRow}>
                      <Text style={[styles.amountLabel, { color: colors.textMuted }]}>Gross Amount:</Text>
                      <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
                        {formatTzs(pay.amountTzs)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
                    <View style={styles.methodInfo}>
                      <Ionicons name="phone-portrait-outline" size={13} color={colors.textMuted} />
                      <Text style={[styles.methodText, { color: colors.textSecondary }]}>
                        {pay.paymentMethod} {pay.payerPhone ? `• ${pay.payerPhone}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.dateText, { color: colors.textMuted }]}>
                      {new Date(pay.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Transaction Detail Modal */}
      {selectedPayment && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Transaction Detail</Text>
                <TouchableOpacity onPress={() => setSelectedPayment(null)}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Payment ID:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{selectedPayment.id}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Order ID:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{selectedPayment.orderId || 'N/A'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Restaurant:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{selectedPayment.restaurantName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Provider Ref:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                    {selectedPayment.providerReference || 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Gross Amount:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary, fontWeight: '800' }]}>
                    {formatTzs(selectedPayment.amountTzs)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Method:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{selectedPayment.paymentMethod}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary, fontWeight: '700' }]}>
                    {selectedPayment.status}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Created At:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                    {new Date(selectedPayment.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.primary }]}
                onPress={() => setSelectedPayment(null)}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  headerRow: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    maxWidth: 700,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 11,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    width: 260,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
  },
  listContainer: {
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  providerRef: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  restaurantName: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMain: {
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountLabel: {
    fontSize: 12,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  methodText: {
    fontSize: 11,
  },
  dateText: {
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailGrid: {
    gap: 10,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailVal: {
    fontSize: 13,
  },
  closeBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
