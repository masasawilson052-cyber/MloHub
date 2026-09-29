import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { PaymentTransactionEntity, PaymentGatewayProvider } from '../../db/types';
import { Payment } from '../../types/domain';
import { AdminFinanceSummary } from '../../types/admin';
import { PaymentRepository } from '../../repositories/payments.repository';
import { AdminFinanceRepository } from '../../repositories/adminFinance.repository';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatTzs } from '../../config/platformFees';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface PaymentsMonitorProps {
  payments?: PaymentTransactionEntity[];
  language?: 'en' | 'sw';
}

type PaymentFilter = 'ALL' | 'CAPTURED' | 'PENDING' | 'FAILED' | 'REFUNDED';
type ProviderFilter = 'ALL' | 'SELCOM' | 'CLICKPESA' | 'PESAPAL' | 'SANDBOX' | 'UNKNOWN';
type DateRangeFilter = 'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS' | '90_DAYS';

export const PaymentsMonitor: React.FC<PaymentsMonitorProps> = ({
  payments: initialPaymentsFallback = [],
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  // Filter & Pagination State
  const [statusFilter, setStatusFilter] = useState<PaymentFilter>('ALL');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Data & Summary State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [summary, setSummary] = useState<AdminFinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detail Modal & Action State
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [reconcileOutcome, setReconcileOutcome] = useState<{
    paymentId: string;
    outcome?: string;
    reason?: string;
    error?: string;
  } | null>(null);

  // Calculate ISO date strings based on preset
  const getDateRangeBounds = (range: DateRangeFilter) => {
    if (range === 'ALL') return { from: undefined, to: undefined };
    const now = new Date();
    const fromDate = new Date();
    if (range === 'TODAY') {
      fromDate.setHours(0, 0, 0, 0);
    } else if (range === '7_DAYS') {
      fromDate.setDate(now.getDate() - 7);
    } else if (range === '30_DAYS') {
      fromDate.setDate(now.getDate() - 30);
    } else if (range === '90_DAYS') {
      fromDate.setDate(now.getDate() - 90);
    }
    return { from: fromDate.toISOString(), to: now.toISOString() };
  };

  // Fetch paginated payments and finance summary
  const loadPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const { from, to } = getDateRangeBounds(dateRange);

      const [summaryData, pageResult] = await Promise.all([
        AdminFinanceRepository.getSummary(from, to).catch((err) => {
          console.warn('[PaymentsMonitor] Failed to load finance summary:', err?.message);
          return null;
        }),
        PaymentRepository.listAdminPage({
          page,
          pageSize,
          status: statusFilter,
          provider: providerFilter !== 'ALL' ? providerFilter : undefined,
          from,
          to,
          search: searchQuery.trim() || undefined,
        }).catch((err) => {
          console.warn('[PaymentsMonitor] listAdminPage fallback:', err?.message);
          return null;
        }),
      ]);

      if (summaryData) {
        setSummary(summaryData);
      }

      if (pageResult) {
        setPayments(pageResult.items);
        setTotalCount(pageResult.total);
        setHasNext(pageResult.hasNext);
      } else if (initialPaymentsFallback.length > 0) {
        // Local fallback for offline/test environments
        const fallbackItems: Payment[] = initialPaymentsFallback.map((p) => ({
          id: p.id,
          orderId: p.orderId,
          reservationId: p.reservationId,
          customerId: p.userId,
          restaurantId: p.restaurantId,
          provider: p.provider,
          externalReference: p.providerReference,
          providerTransactionId: p.providerTransactionId,
          amountTzs: p.amountTzs,
          platformCommissionTzs: 0,
          netRestaurantPayoutTzs: p.amountTzs,
          currency: 'TZS',
          paymentMethod: p.paymentMethod,
          phoneNumber: p.payerPhone || '',
          status: (p.status as any) || 'PENDING',
          idempotencyKey: p.idempotencyKey,
          webhookVerified: false,
          paidAt: p.paidAt,
          refundedAt: p.refundedAt,
          merchantReference: p.merchantReference,
          failureReason: p.failureReason,
          metadata: p.metadata,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt || p.createdAt,
        }));
        setPayments(fallbackItems);
        setTotalCount(fallbackItems.length);
        setHasNext(false);
      }
    } catch (error: any) {
      console.error('[PaymentsMonitor] Error loading payments:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [page, statusFilter, providerFilter, dateRange, searchQuery, initialPaymentsFallback]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Handle single payment reconciliation via server Edge Function
  const handleReconcilePayment = async (paymentId: string) => {
    if (!isSupabaseConfigured()) {
      Alert.alert('Configuration Error', 'Supabase is not configured.');
      return;
    }

    setReconcilingId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-payments', {
        body: { paymentId },
      });

      if (error) {
        console.error('[PaymentsMonitor] Reconciliation error:', error.message);
        setReconcileOutcome({
          paymentId,
          error: error.message || 'Payment reconciliation request failed.',
        });
        Alert.alert(
          'Reconciliation Failed',
          error.message || 'Reconciliation edge function returned an error.'
        );
        return;
      }

      if (data?.success) {
        const outcome = data.outcome || data.results?.[0]?.outcome || 'UNKNOWN';
        const reason = data.reason || data.results?.[0]?.reason || 'Reconciliation completed by gateway inquiry.';
        setReconcileOutcome({
          paymentId,
          outcome,
          reason,
        });

        // Authoritative reload: client NEVER mutates payment status directly
        await loadPayments(true);

        // Update selected payment if currently open in modal
        if (selectedPayment && selectedPayment.id === paymentId) {
          const fresh = await PaymentRepository.getById(paymentId).catch(() => null);
          if (fresh) setSelectedPayment(fresh);
        }

        Alert.alert('Reconciliation Result', `Outcome: ${outcome}\n${reason}`);
      } else {
        const errorMsg = data?.message || data?.error || 'Reconciliation failed.';
        setReconcileOutcome({
          paymentId,
          error: errorMsg,
        });
        Alert.alert('Reconciliation Incomplete', errorMsg);
      }
    } catch (err: any) {
      console.error('[PaymentsMonitor] reconcile exception:', err);
      setReconcileOutcome({
        paymentId,
        error: err?.message || 'Unexpected reconciliation error.',
      });
      Alert.alert('Error', err?.message || 'Failed to communicate with reconciliation service.');
    } finally {
      setReconcilingId(null);
    }
  };

  // KPIs from server summary (fallback to local calculation if summary is null)
  const capturedVolume = summary?.capturedVolumeTzs ?? 0;
  const attemptedVolume = summary?.attemptedVolumeTzs ?? 0;
  const pendingCount = summary?.pendingPayments ?? 0;
  const refundedVolume = summary?.refundedVolumeTzs ?? 0;
  const failedCount = summary?.failedPayments ?? 0;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <View style={[styles.container, { backgroundColor: colors.appBackground }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Usimamizi wa Miamala ya Malipo' : 'Payments Supervision & Gateway Monitor'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Real-time surveillance of gateway callbacks, provider references, mobile money captures, and authoritative reconciliation.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => loadPayments(true)}
          disabled={isRefreshing || loading}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh" size={16} color={colors.textPrimary} />
          )}
          <Text style={[styles.refreshBtnText, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Sasisha' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Financial Volume KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Captured Volume</Text>
          <Text style={[styles.kpiValue, { color: colors.success }]}>{formatTzs(capturedVolume)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Authoritative gateway capture</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Attempted Volume</Text>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{formatTzs(attemptedVolume)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Total gross intents initiated</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Pending Reconcile</Text>
          <Text style={[styles.kpiValue, { color: pendingCount > 0 ? colors.warning : colors.textPrimary }]}>
            {pendingCount}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Awaiting provider callback</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Refunded Volume</Text>
          <Text style={[styles.kpiValue, { color: colors.info }]}>{formatTzs(refundedVolume)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Reversals separated from failures</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Failed Attempts</Text>
          <Text style={[styles.kpiValue, { color: failedCount > 0 ? colors.danger : colors.textMuted }]}>
            {failedCount}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Cancelled or gateway rejected</Text>
        </View>
      </View>

      {/* Date Range Selector */}
      <View style={styles.dateRangeRow}>
        <Text style={[styles.filterGroupLabel, { color: colors.textMuted }]}>Period:</Text>
        {(
          [
            { key: 'ALL', label: 'All Time' },
            { key: 'TODAY', label: 'Today' },
            { key: '7_DAYS', label: 'Last 7 Days' },
            { key: '30_DAYS', label: 'Last 30 Days' },
            { key: '90_DAYS', label: 'Last 90 Days' },
          ] as const
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.datePill,
              { backgroundColor: colors.card, borderColor: colors.border },
              dateRange === tab.key && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => {
              setDateRange(tab.key);
              setPage(1);
            }}
          >
            <Text
              style={[
                styles.datePillText,
                { color: colors.textSecondary },
                dateRange === tab.key && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status & Provider Filters + Search */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPills}>
          {(
            [
              { key: 'ALL', label: 'All Status' },
              { key: 'CAPTURED', label: 'Captured' },
              { key: 'PENDING', label: 'Pending' },
              { key: 'FAILED', label: 'Failed' },
              { key: 'REFUNDED', label: 'Refunded' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.pill,
                { backgroundColor: colors.card, borderColor: colors.border },
                statusFilter === tab.key && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.textSecondary },
                  statusFilter === tab.key && { color: colors.onPrimary, fontWeight: '700' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.providerPills}>
          {(
            [
              { key: 'ALL', label: 'All Gateways' },
              { key: 'SELCOM', label: 'Selcom' },
              { key: 'CLICKPESA', label: 'ClickPesa' },
              { key: 'PESAPAL', label: 'Pesapal' },
              { key: 'SANDBOX', label: 'Sandbox' },
              { key: 'UNKNOWN', label: 'Unknown' },
            ] as const
          ).map((prov) => (
            <TouchableOpacity
              key={prov.key}
              style={[
                styles.smallPill,
                { backgroundColor: colors.card, borderColor: colors.border },
                providerFilter === prov.key && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              onPress={() => {
                setProviderFilter(prov.key);
                setPage(1);
              }}
            >
              <Text
                style={[
                  styles.smallPillText,
                  { color: colors.textSecondary },
                  providerFilter === prov.key && { color: colors.onPrimary, fontWeight: '700' },
                ]}
              >
                {prov.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={14} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search ID, ref, phone..."
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={(txt) => {
              setSearchQuery(txt);
              setPage(1);
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Outcome Banner if any recent reconciliation */}
      {reconcileOutcome && (
        <View
          style={[
            styles.outcomeBanner,
            {
              backgroundColor: reconcileOutcome.error ? colors.dangerSoft : colors.infoSoft,
              borderColor: reconcileOutcome.error ? colors.danger : colors.info,
            },
          ]}
        >
          <Ionicons
            name={reconcileOutcome.error ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color={reconcileOutcome.error ? colors.danger : colors.info}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.outcomeBannerTitle,
                { color: reconcileOutcome.error ? colors.danger : colors.info },
              ]}
            >
              {reconcileOutcome.error
                ? `Reconciliation Error (ID: ${reconcileOutcome.paymentId})`
                : `Reconciliation Outcome: ${reconcileOutcome.outcome} (ID: ${reconcileOutcome.paymentId})`}
            </Text>
            <Text style={[styles.outcomeBannerText, { color: colors.textSecondary }]}>
              {reconcileOutcome.error || reconcileOutcome.reason}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReconcileOutcome(null)}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Payments List */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Querying PostgreSQL payments table...
            </Text>
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Transactions Found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              No payment records match the selected status, gateway, or period criteria.
            </Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {payments.map((pay) => {
              const isPaid =
                pay.status === 'SUCCESS' ||
                (pay.status as string) === 'PAID' ||
                (pay.status as string) === 'CAPTURED';
              const isRefunded = pay.status === 'REFUNDED';
              const isFailed =
                pay.status === 'FAILED' ||
                pay.status === 'CANCELLED';
              const isPending = !isPaid && !isRefunded && !isFailed;

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
              const isReconcilingThis = reconcilingId === pay.id;

              return (
                <View
                  key={pay.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedPayment(pay)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.refRow}>
                          <Text style={[styles.providerRef, { color: colors.textPrimary }]}>
                            {pay.externalReference || pay.id}
                          </Text>
                          <View style={[styles.providerTag, { backgroundColor: colors.surfaceHover }]}>
                            <Text style={[styles.providerTagText, { color: colors.textSecondary }]}>
                              {pay.provider || 'UNKNOWN'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.restaurantName, { color: colors.textSecondary }]}>
                          Restaurant: {pay.restaurantId || 'Platform / Direct'}
                        </Text>
                        {pay.orderId ? (
                          <Text style={[styles.orderRef, { color: colors.textMuted }]}>
                            Order: {pay.orderId}
                          </Text>
                        ) : null}
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

                      {pay.merchantReference ? (
                        <Text style={[styles.subRefText, { color: colors.textMuted }]}>
                          Merchant Ref: {pay.merchantReference}
                        </Text>
                      ) : null}

                      {pay.failureReason ? (
                        <View style={[styles.failureBox, { backgroundColor: colors.dangerSoft }]}>
                          <Ionicons name="warning-outline" size={13} color={colors.danger} />
                          <Text style={[styles.failureText, { color: colors.danger }]}>
                            {pay.failureReason}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={[styles.cardFooter, { borderTopColor: colors.divider }]}>
                      <View style={styles.methodInfo}>
                        <Ionicons name="phone-portrait-outline" size={13} color={colors.textMuted} />
                        <Text style={[styles.methodText, { color: colors.textSecondary }]}>
                          {pay.paymentMethod || 'Mobile Money'} {pay.phoneNumber ? `• ${pay.phoneNumber}` : ''}
                        </Text>
                      </View>

                      <View style={styles.dateGroup}>
                        <Text style={[styles.dateText, { color: colors.textMuted }]}>
                          Created: {new Date(pay.createdAt).toLocaleDateString()}
                        </Text>
                        {pay.paidAt && (
                          <Text style={[styles.dateText, { color: colors.success }]}>
                            Paid: {new Date(pay.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Single Payment Reconcile Action Button for PENDING items */}
                  {isPending && (
                    <View style={[styles.actionRow, { borderTopColor: colors.divider }]}>
                      <TouchableOpacity
                        style={[
                          styles.reconcileBtn,
                          { backgroundColor: colors.primary },
                          isReconcilingThis && { opacity: 0.6 },
                        ]}
                        onPress={() => handleReconcilePayment(pay.id)}
                        disabled={isReconcilingThis}
                      >
                        {isReconcilingThis ? (
                          <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                          <Ionicons name="sync-outline" size={14} color={colors.onPrimary} />
                        )}
                        <Text style={[styles.reconcileBtnText, { color: colors.onPrimary }]}>
                          {isReconcilingThis ? 'Querying Gateway...' : 'Reconcile Status'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Pagination Bar */}
        {totalCount > 0 && (
          <View style={[styles.paginationBar, { borderColor: colors.border }]}>
            <Text style={[styles.pageInfoText, { color: colors.textSecondary }]}>
              Page {page} of {totalPages} ({totalCount} total transactions)
            </Text>

            <View style={styles.pageBtnGroup}>
              <TouchableOpacity
                style={[
                  styles.pageBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  page <= 1 && { opacity: 0.4 },
                ]}
                disabled={page <= 1 || loading}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
                <Text style={[styles.pageBtnText, { color: colors.textPrimary }]}>Prev</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pageBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  (!hasNext && page >= totalPages) && { opacity: 0.4 },
                ]}
                disabled={(!hasNext && page >= totalPages) || loading}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={[styles.pageBtnText, { color: colors.textPrimary }]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Transaction Detail Modal */}
      {selectedPayment && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Authoritative Transaction Detail</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Gateway state directly from public.payments table
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedPayment(null)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Payment ID:</Text>
                    <Text style={[styles.detailVal, { color: colors.textPrimary, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }]}>
                      {selectedPayment.id}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Gateway Provider:</Text>
                    <Text style={[styles.detailVal, { color: colors.primary, fontWeight: '700' }]}>
                      {selectedPayment.provider || 'UNKNOWN'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Provider Ref:</Text>
                    <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                      {selectedPayment.externalReference || 'N/A'}
                    </Text>
                  </View>

                  {selectedPayment.merchantReference && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Merchant Ref:</Text>
                      <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                        {selectedPayment.merchantReference}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Order ID:</Text>
                    <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                      {selectedPayment.orderId || 'Direct Platform Transaction'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Restaurant ID:</Text>
                    <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                      {selectedPayment.restaurantId || 'Platform Commission / Fee'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Gross Amount:</Text>
                    <Text style={[styles.detailVal, { color: colors.textPrimary, fontWeight: '800' }]}>
                      {formatTzs(selectedPayment.amountTzs)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Platform Fee:</Text>
                    <Text style={[styles.detailVal, { color: colors.textSecondary }]}>
                      {formatTzs(selectedPayment.platformCommissionTzs || 0)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Net Restaurant:</Text>
                    <Text style={[styles.detailVal, { color: colors.textSecondary }]}>
                      {formatTzs(selectedPayment.netRestaurantPayoutTzs || 0)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Method & Phone:</Text>
                    <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                      {selectedPayment.paymentMethod} {selectedPayment.phoneNumber ? `(${selectedPayment.phoneNumber})` : ''}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Current Status:</Text>
                    <Text style={[styles.detailVal, { color: colors.textPrimary, fontWeight: '800' }]}>
                      {selectedPayment.status}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Created At:</Text>
                    <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                      {new Date(selectedPayment.createdAt).toLocaleString()}
                    </Text>
                  </View>

                  {selectedPayment.paidAt && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Paid At:</Text>
                      <Text style={[styles.detailVal, { color: colors.success, fontWeight: '700' }]}>
                        {new Date(selectedPayment.paidAt).toLocaleString()}
                      </Text>
                    </View>
                  )}

                  {selectedPayment.failureReason && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.danger }]}>Failure Reason:</Text>
                      <Text style={[styles.detailVal, { color: colors.danger }]}>
                        {selectedPayment.failureReason}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Modal Reconcile Button if PENDING */}
                {selectedPayment.status === 'PENDING' && (
                  <TouchableOpacity
                    style={[
                      styles.modalReconcileBtn,
                      { backgroundColor: colors.primary },
                      reconcilingId === selectedPayment.id && { opacity: 0.6 },
                    ]}
                    onPress={() => handleReconcilePayment(selectedPayment.id)}
                    disabled={reconcilingId === selectedPayment.id}
                  >
                    {reconcilingId === selectedPayment.id ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Ionicons name="sync-outline" size={16} color={colors.onPrimary} />
                    )}
                    <Text style={[styles.modalReconcileBtnText, { color: colors.onPrimary }]}>
                      {reconcilingId === selectedPayment.id ? 'Reconciling...' : 'Reconcile with Gateway'}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}
                onPress={() => setSelectedPayment(null)}
              >
                <Text style={[styles.closeBtnText, { color: colors.textPrimary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
      gap: 16,
      flexWrap: 'wrap',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      marginTop: 4,
      maxWidth: 750,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    refreshBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    kpiCard: {
      flex: 1,
      minWidth: 150,
      padding: 14,
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
      fontSize: 20,
      fontWeight: '800',
      marginVertical: 4,
    },
    kpiSub: {
      fontSize: 11,
    },
    dateRangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    filterGroupLabel: {
      fontSize: 12,
      fontWeight: '700',
      marginRight: 4,
    },
    datePill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    datePillText: {
      fontSize: 11,
      fontWeight: '600',
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
      gap: 6,
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
    providerPills: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    smallPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    smallPillText: {
      fontSize: 11,
      fontWeight: '600',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      minWidth: 240,
      maxWidth: 320,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },
    outcomeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 16,
    },
    outcomeBannerTitle: {
      fontSize: 12,
      fontWeight: '700',
    },
    outcomeBannerText: {
      fontSize: 11,
      marginTop: 2,
    },
    listContainer: {
      paddingBottom: 40,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      gap: 12,
    },
    loadingText: {
      fontSize: 13,
      fontWeight: '600',
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
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
      gap: 8,
    },
    refRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    providerRef: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    },
    providerTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    providerTagText: {
      fontSize: 10,
      fontWeight: '700',
    },
    restaurantName: {
      fontSize: 12,
      marginTop: 2,
    },
    orderRef: {
      fontSize: 11,
      marginTop: 2,
      fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
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
    subRefText: {
      fontSize: 11,
      marginTop: 4,
      fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    },
    failureBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      padding: 6,
      borderRadius: 6,
    },
    failureText: {
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 10,
      borderTopWidth: 1,
      flexWrap: 'wrap',
      gap: 8,
    },
    methodInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    methodText: {
      fontSize: 11,
    },
    dateGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dateText: {
      fontSize: 11,
    },
    actionRow: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    reconcileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    reconcileBtnText: {
      fontSize: 12,
      fontWeight: '700',
    },
    paginationBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      flexWrap: 'wrap',
      gap: 12,
    },
    pageInfoText: {
      fontSize: 12,
      fontWeight: '600',
    },
    pageBtnGroup: {
      flexDirection: 'row',
      gap: 8,
    },
    pageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    pageBtnText: {
      fontSize: 12,
      fontWeight: '600',
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
      maxWidth: 520,
      maxHeight: '90%',
      borderRadius: 16,
      borderWidth: 1,
      padding: 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
      gap: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
    },
    modalSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    modalScroll: {
      maxHeight: 400,
    },
    detailGrid: {
      gap: 10,
      marginBottom: 20,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
      gap: 8,
    },
    detailLabel: {
      fontSize: 12,
      minWidth: 120,
    },
    detailVal: {
      fontSize: 13,
      textAlign: 'right',
      flex: 1,
    },
    modalReconcileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 12,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    modalReconcileBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },
    closeBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    closeBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },
  });

let styles = createStyles(lightColors);
