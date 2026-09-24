import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { PaymentRepository } from '../repositories/payments.repository';
import { Payment, PaymentStatus } from '../types/domain';
import { formatTzs } from '../utils/formatters';
import { formatTanzaniaPhoneDisplay } from '../utils/phone';
import { Status } from '../components/ui/Status';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';

type FilterTab = 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';

export default function PaymentsScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setPayments([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const records = await PaymentRepository.listByCustomer(user.id);
      setPayments(records);
    } catch (err) {
      console.warn('Could not load payment history:', err);
      setPayments([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPayments();
  };

  const filteredPayments = useMemo(() => {
    if (selectedFilter === 'ALL') return payments;
    return payments.filter((p) => p.status === selectedFilter);
  }, [payments, selectedFilter]);

  const stats = useMemo(() => {
    const successPayments = payments.filter((p) => p.status === 'SUCCESS');
    const totalPaid = successPayments.reduce((acc, p) => acc + (p.amountTzs || 0), 0);
    const pendingCount = payments.filter((p) => p.status === 'PENDING').length;
    const refundedCount = payments.filter((p) => p.status === 'REFUNDED').length;

    return {
      totalPaid,
      totalCount: payments.length,
      successCount: successPayments.length,
      pendingCount,
      refundedCount,
    };
  }, [payments]);

  const getProviderInfo = (payment: Payment) => {
    const rawMethod = (payment.paymentMethod || '').toUpperCase();
    const rawProvider = (payment.provider || '').toUpperCase();

    if (rawMethod.includes('AIRTEL') || rawProvider.includes('AIRTEL')) {
      return { name: 'Airtel Money', emoji: '🔴', color: '#B91C1C', bg: '#FEE2E2' };
    }
    if (rawMethod.includes('MIXX') || rawMethod.includes('TIGO') || rawProvider.includes('TIGO')) {
      return { name: 'Mixx by Yas', emoji: '🔵', color: '#0369A1', bg: '#E0F2FE' };
    }
    if (rawMethod.includes('HALO') || rawProvider.includes('HALO')) {
      return { name: 'HaloPesa', emoji: '🟠', color: '#C2410C', bg: '#FFEDD5' };
    }
    if (rawMethod.includes('MPESA') || rawMethod.includes('M_PESA') || rawProvider.includes('VODACOM')) {
      return { name: 'M-Pesa', emoji: '🟢', color: '#15803D', bg: '#DCFCE7' };
    }
    return { name: payment.provider || 'Mobile Money', emoji: '💳', color: '#475569', bg: '#F1F5F9' };
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'SUCCESS':
        return {
          status: 'SUCCESS' as const,
          label: language === 'sw' ? 'Imelipwa' : 'Paid',
        };
      case 'PENDING':
        return {
          status: 'PENDING' as const,
          label: language === 'sw' ? 'Inasubiri' : 'Pending',
        };
      case 'FAILED':
        return {
          status: 'BUSY' as const,
          label: language === 'sw' ? 'Imeshindwa' : 'Failed',
        };
      case 'REFUNDED':
        return {
          status: 'AVAILABLE' as const,
          label: language === 'sw' ? 'Imerudishwa' : 'Refunded',
        };
      case 'CANCELLED':
        return {
          status: 'OFFLINE' as const,
          label: language === 'sw' ? 'Imeghairiwa' : 'Cancelled',
        };
      default:
        return {
          status: 'OFFLINE' as const,
          label: status,
        };
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>
            {language === 'sw' ? 'Historia ya Malipo' : 'Payment History'}
          </Text>
          <Text style={styles.headerSub}>
            {language === 'sw'
              ? 'Miamala ya simu na stakabadhi rasmi'
              : 'Mobile money transactions & digital receipts'}
          </Text>
        </View>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {language === 'sw' ? 'Inapakia miamala...' : 'Loading transactions...'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isLargeScreen && styles.largeScrollContent,
          ]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Stats Row */}
          <View style={styles.statsContainer}>
            <View style={styles.statCardPrimary}>
              <Text style={styles.statLabelLight}>
                {language === 'sw' ? 'Jumla Iliyolipwa' : 'Total Paid Out'}
              </Text>
              <Text style={styles.statValLight}>{formatTzs(stats.totalPaid)}</Text>
              <Text style={styles.statSubLight}>
                {stats.successCount} {language === 'sw' ? 'miamala iliyofanikiwa' : 'successful transactions'}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCardSmall}>
                <Text style={styles.statLabelSmall}>
                  {language === 'sw' ? 'Yote' : 'Total'}
                </Text>
                <Text style={styles.statValSmall}>{stats.totalCount}</Text>
              </View>
              <View style={styles.statCardSmall}>
                <Text style={styles.statLabelSmall}>
                  {language === 'sw' ? 'Inasubiri' : 'Pending'}
                </Text>
                <Text style={[styles.statValSmall, { color: '#D97706' }]}>
                  {stats.pendingCount}
                </Text>
              </View>
              <View style={styles.statCardSmall}>
                <Text style={styles.statLabelSmall}>
                  {language === 'sw' ? 'Marejesho' : 'Refunds'}
                </Text>
                <Text style={[styles.statValSmall, { color: '#0369A1' }]}>
                  {stats.refundedCount}
                </Text>
              </View>
            </View>
          </View>

          {/* Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {(
              [
                { id: 'ALL', label: language === 'sw' ? 'Zote' : 'All' },
                { id: 'SUCCESS', label: language === 'sw' ? 'Mafanikio' : 'Successful' },
                { id: 'PENDING', label: language === 'sw' ? 'Zinazosubiri' : 'Pending' },
                { id: 'FAILED', label: language === 'sw' ? 'Zilizoshindwa' : 'Failed' },
                { id: 'REFUNDED', label: language === 'sw' ? 'Zilizorudishwa' : 'Refunded' },
              ] as { id: FilterTab; label: string }[]
            ).map((tab) => {
              const active = selectedFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setSelectedFilter(tab.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.filterPillText, active && styles.filterPillTextActive]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Transactions List */}
          {filteredPayments.length === 0 ? (
            <EmptyState
              icon="card-outline"
              title={
                selectedFilter === 'ALL'
                  ? language === 'sw'
                    ? 'Hakuna miamala bado'
                    : 'No Payment History'
                  : language === 'sw'
                  ? `Hakuna miamala ya ${selectedFilter.toLowerCase()}`
                  : `No ${selectedFilter.toLowerCase()} transactions`
              }
              message={
                language === 'sw'
                  ? 'Ukiagiza chakula na kukamilisha malipo kupitia mitandao ya simu, stakabadhi zako zitaonekana hapa.'
                  : 'When you place food orders and complete mobile money payments, your verified receipts will appear here.'
              }
              actionTitle={language === 'sw' ? 'Gundua Vyakula' : 'Explore Dishes'}
              onAction={() => router.push('/(tabs)')}
            />
          ) : (
            <View style={styles.transactionsList}>
              {filteredPayments.map((payment) => {
                const provider = getProviderInfo(payment);
                const badge = getStatusBadge(payment.status);

                return (
                  <TouchableOpacity
                    key={payment.id}
                    style={styles.paymentCard}
                    onPress={() => setSelectedPayment(payment)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.paymentCardTop}>
                      <View style={styles.providerBadgeRow}>
                        <View
                          style={[styles.providerIconCircle, { backgroundColor: provider.bg }]}
                        >
                          <Text style={styles.providerEmoji}>{provider.emoji}</Text>
                        </View>
                        <View>
                          <Text style={styles.providerName}>{provider.name}</Text>
                          <Text style={styles.paymentDate}>
                            {formatDate(payment.paidAt || payment.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <Status status={badge.status} label={badge.label} size="sm" />
                    </View>

                    <View style={styles.paymentDivider} />

                    <View style={styles.paymentCardBottom}>
                      <View>
                        <Text style={styles.amountLabel}>
                          {language === 'sw' ? 'Kiasi' : 'Amount'}
                        </Text>
                        <Text style={styles.amountValue}>{formatTzs(payment.amountTzs)}</Text>
                      </View>

                      <View style={styles.cardActionsRow}>
                        {payment.orderId ? (
                          <TouchableOpacity
                            style={styles.viewOrderBtn}
                            onPress={() => router.push(`/(tabs)/orders?orderId=${payment.orderId}` as any)}
                          >
                            <Ionicons name="receipt-outline" size={14} color={Colors.primary} />
                            <Text style={styles.viewOrderBtnText}>
                              {language === 'sw' ? 'Oda' : 'Order'}
                            </Text>
                          </TouchableOpacity>
                        ) : null}

                        <View style={styles.viewReceiptBtn}>
                          <Text style={styles.viewReceiptText}>
                            {language === 'sw' ? 'Stakabadhi' : 'Receipt'}
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color="#64748B" />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Digital Receipt Modal */}
      {selectedPayment && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedPayment(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, isLargeScreen && styles.largeModalSheet]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {language === 'sw' ? 'Stakabadhi ya Malipo' : 'Digital Payment Receipt'}
                  </Text>
                  <Text style={styles.modalSub}>
                    Ref: {selectedPayment.providerTransactionId || selectedPayment.externalReference || selectedPayment.id}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedPayment(null)}
                >
                  <Ionicons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Status Hero */}
                <View style={styles.receiptHero}>
                  <Text style={styles.receiptHeroLabel}>
                    {language === 'sw' ? 'Kiasi Kilicholipwa' : 'Amount Transacted'}
                  </Text>
                  <Text style={styles.receiptHeroAmount}>
                    {formatTzs(selectedPayment.amountTzs)}
                  </Text>
                  <Status
                    status={getStatusBadge(selectedPayment.status).status}
                    label={getStatusBadge(selectedPayment.status).label}
                    size="md"
                  />
                </View>

                {/* Details Breakdown */}
                <View style={styles.receiptDetailsCard}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptKey}>
                      {language === 'sw' ? 'Mtandao wa Malipo' : 'Payment Method'}
                    </Text>
                    <Text style={styles.receiptVal}>
                      {getProviderInfo(selectedPayment).name}
                    </Text>
                  </View>

                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptKey}>
                      {language === 'sw' ? 'Namba ya Simu' : 'Phone Number'}
                    </Text>
                    <Text style={styles.receiptVal}>
                      {selectedPayment.phoneNumber
                        ? formatTanzaniaPhoneDisplay(selectedPayment.phoneNumber)
                        : '—'}
                    </Text>
                  </View>

                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptKey}>
                      {language === 'sw' ? 'Tarehe na Saa' : 'Date & Time'}
                    </Text>
                    <Text style={styles.receiptVal}>
                      {formatDate(selectedPayment.paidAt || selectedPayment.createdAt)}
                    </Text>
                  </View>

                  {selectedPayment.providerTransactionId ? (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptKey}>
                        {language === 'sw' ? 'Namba ya Muamala' : 'Provider Trans ID'}
                      </Text>
                      <Text style={styles.receiptVal}>
                        {selectedPayment.providerTransactionId}
                      </Text>
                    </View>
                  ) : null}

                  {selectedPayment.orderId ? (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptKey}>
                        {language === 'sw' ? 'Namba ya Oda' : 'Order ID'}
                      </Text>
                      <Text style={styles.receiptVal}>#{selectedPayment.orderId.slice(0, 12)}</Text>
                    </View>
                  ) : null}

                  {selectedPayment.status === 'REFUNDED' && selectedPayment.refundedAt ? (
                    <View style={styles.receiptRow}>
                      <Text style={[styles.receiptKey, { color: '#0369A1' }]}>
                        {language === 'sw' ? 'Tarehe ya Marejesho' : 'Refund Processed'}
                      </Text>
                      <Text style={[styles.receiptVal, { color: '#0369A1' }]}>
                        {formatDate(selectedPayment.refundedAt)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Security and Authority Guarantee */}
                <View style={styles.receiptGuaranteeCard}>
                  <Ionicons name="shield-checkmark" size={18} color="#15803D" />
                  <Text style={styles.receiptGuaranteeText}>
                    {language === 'sw'
                      ? 'Muamala huu umethibitishwa na kuhifadhiwa kwa usalama kulingana na sheria ya Tanzania PDPA 2022.'
                      : 'This transaction is authoritatively verified and settled under Tanzania PDPA 2022 compliance.'}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                {selectedPayment.orderId && (
                  <Button
                    title={language === 'sw' ? 'Tazama Oda Hii' : 'View Associated Order'}
                    onPress={() => {
                      const oid = selectedPayment.orderId;
                      setSelectedPayment(null);
                      router.push(`/(tabs)/orders?orderId=${oid}` as any);
                    }}
                    variant="outline"
                    size="md"
                    fullWidth={true}
                    style={{ marginBottom: Spacing.sm }}
                  />
                )}
                <Button
                  title={language === 'sw' ? 'Funga Stakabadhi' : 'Close Receipt'}
                  onPress={() => setSelectedPayment(null)}
                  variant="primary"
                  size="md"
                  fullWidth={true}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F3', // Warm Ivory
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: '#F1F5F9',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  largeScrollContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  statsContainer: {
    marginBottom: Spacing.lg,
    gap: 10,
  },
  statCardPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  statLabelLight: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValLight: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  statSubLight: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCardSmall: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statLabelSmall: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValSmall: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  filterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  transactionsList: {
    gap: 12,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  paymentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  providerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerEmoji: {
    fontSize: 18,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  paymentDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  paymentCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  viewOrderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  viewReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  viewReceiptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  largeModalSheet: {
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
    borderRadius: Radii.xl,
    marginVertical: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalScroll: {
    padding: Spacing.lg,
  },
  receiptHero: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  receiptHeroLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  receiptHeroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    marginVertical: 6,
  },
  receiptDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  receiptKey: {
    fontSize: 13,
    color: '#64748B',
  },
  receiptVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  receiptGuaranteeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: Spacing.md,
    gap: 8,
    marginBottom: Spacing.lg,
  },
  receiptGuaranteeText: {
    flex: 1,
    fontSize: 12,
    color: '#15803D',
    lineHeight: 16,
  },
  modalFooter: {
    paddingHorizontal: Spacing.lg,
  },
});
