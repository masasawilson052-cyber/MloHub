import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import {
  MerchantPayoutDestination,
  MerchantPayout,
  MerchantSettlement,
  RefundRequest,
  FinancialDispute,
  PayoutDestinationType,
  RestaurantFinancialSummary,
} from '../../types/domain';
import { RestaurantRole } from '../../types/auth';
import { PayoutsRepository } from '../../repositories/payouts.repository';
import { RefundsDisputesPanel } from './RefundsDisputesPanel';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface EarningsRecord {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  grossAmountTzs: number;
  platformFeeTzs: number;
  refundTzs?: number;
  netPayoutTzs: number;
  paymentStatus: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  paymentProvider?: string;
}

export type FinanceSection = 'OVERVIEW' | 'TRANSACTIONS' | 'SETTLEMENTS' | 'PAYOUTS' | 'REFUNDS_DISPUTES';
export type DateFilterPreset = 'TODAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM';

export interface EarningsOverviewProps {
  restaurantId?: string;
  summary?: RestaurantFinancialSummary;
  transactions?: EarningsRecord[];
  settlements?: MerchantSettlement[];
  payouts?: MerchantPayout[];
  destinations?: MerchantPayoutDestination[];
  refunds?: RefundRequest[];
  disputes?: FinancialDispute[];
  userRole?: RestaurantRole;
  onRefresh?: () => Promise<void>;
  onDateFilterChange?: (preset: DateFilterPreset, from?: string, to?: string) => void;
  // Compatibility props
  todayGrossTzs?: number;
  todayNetTzs?: number;
  weekGrossTzs?: number;
  monthGrossTzs?: number;
  language?: 'en' | 'sw';
}

export const EarningsOverview: React.FC<EarningsOverviewProps> = ({
  restaurantId = '',
  summary,
  transactions = [],
  settlements = [],
  payouts = [],
  destinations = [],
  refunds = [],
  disputes = [],
  userRole = 'OWNER',
  onRefresh,
  onDateFilterChange,
  todayGrossTzs = 0,
  todayNetTzs,
  weekGrossTzs = 0,
  monthGrossTzs = 0,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const [activeSection, setActiveSection] = useState<FinanceSection>('OVERVIEW');
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('TODAY');
  const [txFilter, setTxFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING'>('ALL');

  // Destination modal state
  const [isAddDestModalVisible, setIsAddDestModalVisible] = useState(false);
  const [destType, setDestType] = useState<PayoutDestinationType>('MOBILE_MONEY');
  const [provider, setProvider] = useState('M-Pesa');
  const [accountName, setAccountName] = useState('');
  const [rawAccountIdentifier, setRawAccountIdentifier] = useState('');
  const [isDefaultDest, setIsDefaultDest] = useState(false);
  const [isSavingDest, setIsSavingDest] = useState(false);

  // High-risk replacement confirmation modal state
  const [replacingDest, setReplacingDest] = useState<MerchantPayoutDestination | null>(null);

  const isOwnerOrFinance = userRole === 'OWNER' || userRole === 'MANAGER';

  // Authoritative figures from summary (never guess percentages)
  const availableToSettle = summary ? summary.restaurantPayable - summary.settledAmount : (todayNetTzs ?? todayGrossTzs);
  const pendingAmount = summary ? summary.pendingAmount : 0;
  const settledAmount = summary ? summary.settledAmount : 0;
  const grossFoodSales = summary ? summary.grossFoodSales : todayGrossTzs;
  const platformCommission = summary
    ? summary.platformCommission
    : Math.max(0, todayGrossTzs - (todayNetTzs ?? todayGrossTzs));
  const refundDeductions = summary ? summary.refundDeductions : 0;
  const adjustments = summary ? summary.adjustments : 0;
  const deliveryShare = summary ? summary.deliveryRestaurantShare : 0;
  const netPayable = summary ? summary.restaurantPayable : (todayNetTzs ?? todayGrossTzs);

  const handleDateFilterSelect = (preset: DateFilterPreset) => {
    setDateFilter(preset);
    if (onDateFilterChange) {
      const now = new Date();
      let fromDate: Date;
      if (preset === 'TODAY') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (preset === '7_DAYS') {
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (preset === '30_DAYS') {
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }
      onDateFilterChange(preset, fromDate.toISOString(), now.toISOString());
    }
  };

  // Export CSV Statement
  const handleExportStatement = async () => {
    const headers = [
      'Date',
      'Order Reference',
      'Gross (TZS)',
      'Platform Commission (TZS)',
      'Refund (TZS)',
      'Adjustment (TZS)',
      'Net Payable (TZS)',
      'Settlement Status',
      'Payout Status',
    ];

    const rows = transactions.map((t) => [
      new Date(t.createdAt).toISOString().split('T')[0],
      t.orderNumber,
      t.grossAmountTzs,
      t.platformFeeTzs,
      t.refundTzs || 0,
      0,
      t.netPayoutTzs,
      t.paymentStatus === 'SUCCESS' ? 'CAPTURED' : 'PENDING',
      t.paymentStatus,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    try {
      await Share.share({
        title: `MloHub Merchant Statement - ${restaurantId || 'Store'}`,
        message: csvContent,
      });
    } catch {
      Alert.alert(
        language === 'sw' ? 'Taarifa ya Mauzo (CSV)' : 'Merchant Statement (CSV)',
        csvContent.slice(0, 400) + '...'
      );
    }
  };

  // Handle Save Destination
  const handleSaveDestination = async () => {
    if (!accountName.trim() || !rawAccountIdentifier.trim()) {
      Alert.alert(
        language === 'sw' ? 'Hitilafu' : 'Validation Error',
        language === 'sw' ? 'Tafadhali jaza taarifa zote za akaunti.' : 'Please enter all account details.'
      );
      return;
    }

    try {
      setIsSavingDest(true);
      const res = await PayoutsRepository.addPayoutDestination({
        restaurantId,
        destinationType: destType,
        provider,
        rawAccountIdentifier: rawAccountIdentifier.trim(),
        accountName: accountName.trim(),
        isDefault: isDefaultDest,
      });

      if (res.success) {
        Alert.alert(
          language === 'sw' ? 'Akaunti Imehifadhiwa' : 'Destination Saved',
          language === 'sw'
            ? 'Akaunti ya malipo imehifadhiwa kwa usalama na seva.'
            : 'Payout destination securely verified and registered server-side.'
        );
        setIsAddDestModalVisible(false);
        setAccountName('');
        setRawAccountIdentifier('');
        setIsDefaultDest(false);
        if (onRefresh) await onRefresh();
      } else {
        Alert.alert('Error', res.error || 'Failed to save payout destination');
      }
    } finally {
      setIsSavingDest(false);
    }
  };

  // Handle Set Default
  const handleSetDefault = async (destId: string) => {
    const res = await PayoutsRepository.setDefaultDestination(restaurantId, destId);
    if (res.success) {
      if (onRefresh) await onRefresh();
    } else {
      Alert.alert('Error', res.error || 'Failed to set default destination');
    }
  };

  // Handle Disable
  const handleDisable = async (destId: string) => {
    Alert.alert(
      language === 'sw' ? 'Zima Akaunti' : 'Disable Destination',
      language === 'sw' ? 'Una uhakika unataka kuzima akaunti hii ya malipo?' : 'Are you sure you want to disable this payout destination?',
      [
        { text: language === 'sw' ? 'Ghairi' : 'Cancel', style: 'cancel' },
        {
          text: language === 'sw' ? 'Zima' : 'Disable',
          style: 'destructive',
          onPress: async () => {
            const res = await PayoutsRepository.disableDestination(restaurantId, destId);
            if (res.success && onRefresh) await onRefresh();
          },
        },
      ]
    );
  };

  // Handle Replace (High Risk Action)
  const handleConfirmReplace = async () => {
    if (!replacingDest) return;
    setReplacingDest(null);
    setIsAddDestModalVisible(true);
  };

  const filteredTx = useMemo(() => {
    if (txFilter === 'ALL') return transactions;
    return transactions.filter((t) => t.paymentStatus === txFilter);
  }, [transactions, txFilter]);

  const getSettlementBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge label={language === 'sw' ? 'Imelipwa' : 'Paid'} variant="success" size="sm" />;
      case 'APPROVED':
        return <Badge label={language === 'sw' ? 'Imeidhinishwa' : 'Approved'} variant="info" size="sm" />;
      case 'PAYOUT_PENDING':
      case 'PROCESSING':
        return <Badge label={language === 'sw' ? 'Inashughulikiwa' : 'Processing'} variant="warning" size="sm" />;
      case 'FAILED':
        return <Badge label={language === 'sw' ? 'Imeshindwa' : 'Failed'} variant="error" size="sm" />;
      default:
        return <Badge label={status} variant="neutral" size="sm" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* 5-Section Finance Header Tabs */}
      <View style={styles.sectionTabsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabsScroll}>
          <TouchableOpacity
            style={[styles.sectionTabBtn, activeSection === 'OVERVIEW' && styles.sectionTabBtnActive]}
            onPress={() => setActiveSection('OVERVIEW')}
            activeOpacity={0.8}
          >
            <Ionicons name="pie-chart-outline" size={16} color={activeSection === 'OVERVIEW' ? colors.primary : colors.textMuted} />
            <Text style={[styles.sectionTabText, activeSection === 'OVERVIEW' && styles.sectionTabTextActive]}>
              {language === 'sw' ? 'Muhtasari' : 'Overview'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionTabBtn, activeSection === 'TRANSACTIONS' && styles.sectionTabBtnActive]}
            onPress={() => setActiveSection('TRANSACTIONS')}
            activeOpacity={0.8}
          >
            <Ionicons name="receipt-outline" size={16} color={activeSection === 'TRANSACTIONS' ? colors.primary : colors.textMuted} />
            <Text style={[styles.sectionTabText, activeSection === 'TRANSACTIONS' && styles.sectionTabTextActive]}>
              {language === 'sw' ? `Miamala (${transactions.length})` : `Transactions (${transactions.length})`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionTabBtn, activeSection === 'SETTLEMENTS' && styles.sectionTabBtnActive]}
            onPress={() => setActiveSection('SETTLEMENTS')}
            activeOpacity={0.8}
          >
            <Ionicons name="briefcase-outline" size={16} color={activeSection === 'SETTLEMENTS' ? colors.primary : colors.textMuted} />
            <Text style={[styles.sectionTabText, activeSection === 'SETTLEMENTS' && styles.sectionTabTextActive]}>
              {language === 'sw' ? `Marekebisho (${settlements.length})` : `Settlements (${settlements.length})`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionTabBtn, activeSection === 'PAYOUTS' && styles.sectionTabBtnActive]}
            onPress={() => setActiveSection('PAYOUTS')}
            activeOpacity={0.8}
          >
            <Ionicons name="card-outline" size={16} color={activeSection === 'PAYOUTS' ? colors.primary : colors.textMuted} />
            <Text style={[styles.sectionTabText, activeSection === 'PAYOUTS' && styles.sectionTabTextActive]}>
              {language === 'sw' ? 'Malipo & Akaunti' : 'Payouts & Destinations'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionTabBtn, activeSection === 'REFUNDS_DISPUTES' && styles.sectionTabBtnActive]}
            onPress={() => setActiveSection('REFUNDS_DISPUTES')}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-outline" size={16} color={activeSection === 'REFUNDS_DISPUTES' ? colors.primary : colors.textMuted} />
            <Text style={[styles.sectionTabText, activeSection === 'REFUNDS_DISPUTES' && styles.sectionTabTextActive]}>
              {language === 'sw' ? 'Marejesho & Migogoro' : 'Refunds & Disputes'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ========================================================================= */}
      {/* SECTION 1: OVERVIEW                                                       */}
      {/* ========================================================================= */}
      {activeSection === 'OVERVIEW' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          {/* Date Filter & Export Action Row */}
          <View style={styles.topControlRow}>
            <View style={styles.filterChipGroup}>
              {(['TODAY', '7_DAYS', '30_DAYS', 'CUSTOM'] as const).map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetChip, dateFilter === preset && styles.presetChipActive]}
                  onPress={() => handleDateFilterSelect(preset)}
                >
                  <Text style={[styles.presetChipText, dateFilter === preset && styles.presetChipTextActive]}>
                    {preset === 'TODAY'
                      ? language === 'sw' ? 'Leo' : 'Today'
                      : preset === '7_DAYS'
                      ? language === 'sw' ? 'Siku 7' : '7 Days'
                      : preset === '30_DAYS'
                      ? language === 'sw' ? 'Siku 30' : '30 Days'
                      : language === 'sw' ? 'Desturi' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.exportBtn} onPress={handleExportStatement} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={styles.exportBtnText}>{language === 'sw' ? 'Pakua Taarifa (CSV)' : 'Export Statement (CSV)'}</Text>
            </TouchableOpacity>
          </View>

          {/* 3 Main Header Settlement Status Cards */}
          <View style={styles.mainMetricsRow}>
            {/* Card 1: AVAILABLE TO SETTLE */}
            <View style={[styles.metricCard, { borderTopColor: colors.success }]}>
              <Text style={styles.metricLabel}>{language === 'sw' ? 'INAYOPATIKANA KUHAMISHWA' : 'AVAILABLE TO SETTLE'}</Text>
              <Text style={[styles.metricVal, { color: colors.success }]}>{formatTzs(availableToSettle)}</Text>
              <Text style={styles.metricSub}>{language === 'sw' ? 'Kiasi kilichothibitishwa jikoni' : 'Reconciled orders clear for disbursement'}</Text>
            </View>

            {/* Card 2: PENDING */}
            <View style={[styles.metricCard, { borderTopColor: colors.warning }]}>
              <Text style={styles.metricLabel}>{language === 'sw' ? 'INASUBIRI KUKAGULIWA' : 'PENDING'}</Text>
              <Text style={[styles.metricVal, { color: colors.warning }]}>{formatTzs(pendingAmount)}</Text>
              <Text style={styles.metricSub}>{language === 'sw' ? 'Oda zilizopo kwenye maandalizi' : 'Active kitchen fulfillment & escrow clearing'}</Text>
            </View>

            {/* Card 3: NEXT PAYOUT / PAID OUT */}
            <View style={[styles.metricCard, { borderTopColor: colors.info }]}>
              <Text style={styles.metricLabel}>{language === 'sw' ? 'MALIPO YALIYOTUMWA' : 'NEXT PAYOUT'}</Text>
              <Text style={[styles.metricVal, { color: colors.info }]}>{formatTzs(settledAmount)}</Text>
              <Text style={styles.metricSub}>{language === 'sw' ? 'Kiasi kilichotolewa kwenye akaunti' : 'Disbursed to merchant payout destination'}</Text>
            </View>
          </View>

          {/* Authoritative Financial Breakdown Table */}
          <View style={styles.breakdownCard}>
            <Text style={styles.cardSectionHeading}>
              {language === 'sw' ? 'Mchanganuo Rasmi wa Kifedha' : 'Authoritative Financial Breakdown'}
            </Text>
            <Text style={styles.cardSectionSub}>
              {language === 'sw'
                ? 'Hesabu hizi zinatokana na jedwali rasmi la kumbukumbu ya mauzo na makato.'
                : 'Directly aggregated from immutable order ledger snapshots and adjustments.'}
            </Text>

            <View style={styles.breakdownTable}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{language === 'sw' ? 'Mauzo ya Vyakula (Gross)' : 'Gross Food Sales'}</Text>
                <Text style={styles.breakdownValue}>{formatTzs(grossFoodSales)}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{language === 'sw' ? 'Makato ya Jukwaa (Commission)' : 'Platform Commission'}</Text>
                <Text style={[styles.breakdownValue, { color: colors.textMuted }]}>-{formatTzs(platformCommission)}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{language === 'sw' ? 'Marejesho ya Fedha' : 'Customer Refunds Deductions'}</Text>
                <Text style={[styles.breakdownValue, { color: colors.danger }]}>-{formatTzs(refundDeductions)}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{language === 'sw' ? 'Marekebisho ya Kifedha' : 'Financial Adjustments'}</Text>
                <Text style={[styles.breakdownValue, { color: colors.warning }]}>-{formatTzs(adjustments)}</Text>
              </View>

              {deliveryShare > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{language === 'sw' ? 'Mapato ya Usafirishaji (Mgahawa)' : 'Restaurant Delivery Share'}</Text>
                  <Text style={[styles.breakdownValue, { color: colors.success }]}>+{formatTzs(deliveryShare)}</Text>
                </View>
              )}

              <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                <Text style={styles.breakdownTotalLabel}>{language === 'sw' ? 'Kiasi Halisi Kinacholipwa' : 'Net Restaurant Payable'}</Text>
                <Text style={styles.breakdownTotalValue}>{formatTzs(netPayable)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: TRANSACTIONS                                                   */}
      {/* ========================================================================= */}
      {activeSection === 'TRANSACTIONS' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          {/* Sub-filter chips */}
          <View style={styles.txFilterRow}>
            {(['ALL', 'SUCCESS', 'PENDING'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.presetChip, txFilter === f && styles.presetChipActive]}
                onPress={() => setTxFilter(f)}
              >
                <Text style={[styles.presetChipText, txFilter === f && styles.presetChipTextActive]}>
                  {f === 'ALL' ? 'All Orders' : f === 'SUCCESS' ? 'Successful' : 'Pending'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredTx.length === 0 ? (
            <EmptyState
              title={language === 'sw' ? 'Hakuna Miamala' : 'No payment activity yet.'}
              message={
                language === 'sw'
                  ? 'Miamala ya maagizo itatokea hapa baada ya wateja kukamilisha malipo.'
                  : 'Customer payments and fee breakdowns will be tracked here.'
              }
              icon="receipt-outline"
            />
          ) : (
            filteredTx.map((tx) => (
              <View key={tx.orderId} style={styles.txCard}>
                <View style={styles.txCardHeader}>
                  <View>
                    <Text style={styles.txOrderNum}>Order #{tx.orderNumber}</Text>
                    <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge
                      label={tx.paymentStatus === 'SUCCESS' ? 'Payment successful' : tx.paymentStatus}
                      variant={tx.paymentStatus === 'SUCCESS' ? 'success' : 'warning'}
                      size="sm"
                    />
                    <Text style={styles.txProviderTag}>{tx.paymentProvider || 'Mobile Money'}</Text>
                  </View>
                </View>

                <View style={styles.txAmountsGrid}>
                  <View>
                    <Text style={styles.txAmtLabel}>Gross</Text>
                    <Text style={styles.txAmtVal}>{formatTzs(tx.grossAmountTzs)}</Text>
                  </View>
                  <View>
                    <Text style={styles.txAmtLabel}>Platform Fee</Text>
                    <Text style={[styles.txAmtVal, { color: colors.textMuted }]}>-{formatTzs(tx.platformFeeTzs)}</Text>
                  </View>
                  {(tx.refundTzs || 0) > 0 && (
                    <View>
                      <Text style={styles.txAmtLabel}>Refund</Text>
                      <Text style={[styles.txAmtVal, { color: colors.danger }]}>-{formatTzs(tx.refundTzs || 0)}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.txAmtLabel}>Restaurant Net</Text>
                    <Text style={[styles.txAmtVal, { color: colors.success, fontWeight: '700' }]}>{formatTzs(tx.netPayoutTzs)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: SETTLEMENTS                                                    */}
      {/* ========================================================================= */}
      {activeSection === 'SETTLEMENTS' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          {settlements.length === 0 ? (
            <EmptyState
              title={language === 'sw' ? 'Hakuna Taarifa ya Marekebisho' : 'No Settlements Calculated'}
              message={
                language === 'sw'
                  ? 'Marekebisho rasmi ya uhasibu yanayotayarishwa na jukwaa yataonekana hapa.'
                  : 'Reconciled settlement periods prepared by platform finance will appear here.'
              }
              icon="briefcase-outline"
            />
          ) : (
            settlements.map((s) => (
              <View key={s.id} style={styles.settlementCard}>
                <View style={styles.settlementHeader}>
                  <View>
                    <Text style={styles.settlementRef}>Ref: {s.reference}</Text>
                    <Text style={styles.settlementPeriod}>
                      {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                    </Text>
                  </View>
                  {getSettlementBadge(s.status)}
                </View>

                <View style={styles.txAmountsGrid}>
                  <View>
                    <Text style={styles.txAmtLabel}>Gross</Text>
                    <Text style={styles.txAmtVal}>{formatTzs(Number(s.grossSalesTzs))}</Text>
                  </View>
                  <View>
                    <Text style={styles.txAmtLabel}>Commission</Text>
                    <Text style={[styles.txAmtVal, { color: colors.textMuted }]}>-{formatTzs(Number(s.platformFeesTzs))}</Text>
                  </View>
                  <View>
                    <Text style={styles.txAmtLabel}>Adjustments</Text>
                    <Text style={[styles.txAmtVal, { color: colors.warning }]}>
                      -{formatTzs(Number(s.refundAdjustmentsTzs) + Number(s.disputeAdjustmentsTzs) + Number(s.otherAdjustmentsTzs))}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.txAmtLabel}>Net Payable</Text>
                    <Text style={[styles.txAmtVal, { color: colors.success, fontWeight: '700' }]}>{formatTzs(Number(s.netPayableTzs))}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: PAYOUTS & DESTINATIONS                                         */}
      {/* ========================================================================= */}
      {activeSection === 'PAYOUTS' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          {/* Top Destination Management Header */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.cardSectionHeading}>
                {language === 'sw' ? 'Akaunti za Kupokelea Malipo' : 'Payout Receiving Destinations'}
              </Text>
              <Text style={styles.cardSectionSub}>
                {language === 'sw'
                  ? 'Namba za simu au benki zilizothibitishwa kwa ajili ya kuhamishiwa fedha za mauzo.'
                  : 'Masked mobile money and bank destination accounts authorized for automated payouts.'}
              </Text>
            </View>

            {isOwnerOrFinance && (
              <TouchableOpacity
                style={styles.addDestBtn}
                onPress={() => setIsAddDestModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={16} color={colors.onPrimary} />
                <Text style={styles.addDestBtnText}>{language === 'sw' ? 'Ongeza Akaunti' : 'Add Destination'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Destinations List */}
          {destinations.length === 0 ? (
            <View style={styles.noDestCard}>
              <Ionicons name="warning-outline" size={28} color={colors.warning} />
              <Text style={styles.noDestTitle}>{language === 'sw' ? 'Hakuna Akaunti ya Malipo' : 'No Payout Destination Registered'}</Text>
              <Text style={styles.noDestSub}>
                {language === 'sw'
                  ? 'Ongeza namba ya M-Pesa, Airtel Money, au akaunti ya benki ili kupokea fedha zako za mauzo.'
                  : 'Add a verified mobile money or bank account to receive automated settlements.'}
              </Text>
            </View>
          ) : (
            destinations.map((d) => (
              <View key={d.id} style={styles.destCard}>
                <View style={styles.destLeft}>
                  <View style={styles.destIconCircle}>
                    <Ionicons
                      name={d.destinationType === 'MOBILE_MONEY' ? 'phone-portrait-outline' : 'business-outline'}
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.destProviderName}>{d.provider}</Text>
                      {d.isDefault && <Badge label={language === 'sw' ? 'Kuu' : 'Default'} variant="info" size="sm" />}
                      <Badge
                        label={d.verificationStatus === 'VERIFIED' ? 'Verified ✓' : d.verificationStatus}
                        variant={d.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}
                        size="sm"
                      />
                    </View>
                    <Text style={styles.destMaskedNumber}>{d.maskedAccountIdentifier}</Text>
                    <Text style={styles.destAccountName}>{d.accountName}</Text>
                  </View>
                </View>

                {isOwnerOrFinance && (
                  <View style={styles.destActions}>
                    {!d.isDefault && d.verificationStatus === 'VERIFIED' && (
                      <TouchableOpacity style={styles.destActionBtn} onPress={() => handleSetDefault(d.id)}>
                        <Text style={styles.destActionText}>{language === 'sw' ? 'Weka Kuu' : 'Set Default'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.destActionBtn} onPress={() => setReplacingDest(d)}>
                      <Text style={styles.destActionText}>{language === 'sw' ? 'Badilisha' : 'Replace'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.destActionBtn, { borderColor: colors.danger }]} onPress={() => handleDisable(d.id)}>
                      <Text style={[styles.destActionText, { color: colors.danger }]}>{language === 'sw' ? 'Zima' : 'Disable'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}

          {/* Historical Payouts Section */}
          <Text style={[styles.cardSectionHeading, { marginTop: Spacing.lg }]}>
            {language === 'sw' ? 'Kumbukumbu ya Malipo Yaliyotumwa' : 'Disbursement History'}
          </Text>

          {payouts.length === 0 ? (
            <EmptyState
              title={language === 'sw' ? 'Hakuna Malipo Yaliyotumwa' : 'Zero Historical Payouts'}
              message={
                language === 'sw'
                  ? 'Historia ya malipo yaliyotumwa kwenye simu au benki itaonekana hapa.'
                  : 'Completed provider disbursements will be logged here.'
              }
              icon="card-outline"
            />
          ) : (
            payouts.map((p) => (
              <View key={p.id} style={styles.payoutCard}>
                <View style={styles.payoutTop}>
                  <View>
                    <Text style={styles.payoutId}>Payout #{p.id.slice(0, 8)}</Text>
                    <Text style={styles.payoutDestInfo}>
                      {p.providerSnapshot} • {p.maskedIdentifierSnapshot} ({p.accountNameSnapshot})
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.payoutAmount}>{formatTzs(Number(p.amountTzs))}</Text>
                    <Badge label={p.status} variant={p.status === 'COMPLETED' ? 'success' : 'warning'} size="sm" />
                  </View>
                </View>
                <Text style={styles.payoutDate}>
                  {new Date(p.requestedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: REFUNDS & DISPUTES                                             */}
      {/* ========================================================================= */}
      {activeSection === 'REFUNDS_DISPUTES' && (
        <RefundsDisputesPanel
          refunds={refunds}
          disputes={disputes}
          onRefresh={onRefresh}
          language={language}
        />
      )}

      {/* Add Payout Destination Modal */}
      {isAddDestModalVisible && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setIsAddDestModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {language === 'sw' ? 'Ongeza Akaunti ya Malipo' : 'Add Payout Destination'}
                </Text>
                <TouchableOpacity onPress={() => setIsAddDestModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                {language === 'sw'
                  ? 'Akaunti hii itathibitishwa na kuhifadhiwa kwa usalama kwenye seva.'
                  : 'This payout destination will be verified and stored server-side with strict encryption.'}
              </Text>

              {/* Destination Type Toggle */}
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, destType === 'MOBILE_MONEY' && styles.typeBtnActive]}
                  onPress={() => {
                    setDestType('MOBILE_MONEY');
                    setProvider('M-Pesa');
                  }}
                >
                  <Text style={[styles.typeBtnText, destType === 'MOBILE_MONEY' && styles.typeBtnTextActive]}>
                    Mobile Money
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeBtn, destType === 'BANK_ACCOUNT' && styles.typeBtnActive]}
                  onPress={() => {
                    setDestType('BANK_ACCOUNT');
                    setProvider('CRDB Bank');
                  }}
                >
                  <Text style={[styles.typeBtnText, destType === 'BANK_ACCOUNT' && styles.typeBtnTextActive]}>
                    Bank Account
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Provider Field */}
              <Text style={styles.inputLabel}>{destType === 'MOBILE_MONEY' ? 'Operator' : 'Bank Name'}</Text>
              <TextInput
                style={styles.textInput}
                value={provider}
                onChangeText={setProvider}
                placeholder={destType === 'MOBILE_MONEY' ? 'M-Pesa / Airtel Money / Tigo Pesa' : 'CRDB / NMB / Stanbic'}
                placeholderTextColor={colors.textMuted}
              />

              {/* Account Identifier */}
              <Text style={styles.inputLabel}>
                {destType === 'MOBILE_MONEY' ? 'Phone Number (+255...)' : 'Account Number'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={rawAccountIdentifier}
                onChangeText={setRawAccountIdentifier}
                placeholder={destType === 'MOBILE_MONEY' ? '+255712345678' : '015012345678'}
                placeholderTextColor={colors.textMuted}
                keyboardType={destType === 'MOBILE_MONEY' ? 'phone-pad' : 'numeric'}
              />

              {/* Account Name */}
              <Text style={styles.inputLabel}>{language === 'sw' ? 'Jina Lililosajiliwa la Akaunti' : 'Registered Account Name'}</Text>
              <TextInput
                style={styles.textInput}
                value={accountName}
                onChangeText={setAccountName}
                placeholder={language === 'sw' ? 'Jina la mmiliki au biashara' : 'Legal merchant / owner name'}
                placeholderTextColor={colors.textMuted}
              />

              {/* Set As Default Checkbox */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsDefaultDest(!isDefaultDest)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isDefaultDest ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isDefaultDest ? colors.primary : colors.textMuted}
                />
                <Text style={styles.checkboxLabel}>
                  {language === 'sw' ? 'Weka kama akaunti kuu ya kupokea malipo' : 'Set as primary default destination'}
                </Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsAddDestModalVisible(false)}
                  disabled={isSavingDest}
                >
                  <Text style={styles.cancelBtnText}>{language === 'sw' ? 'Ghairi' : 'Cancel'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleSaveDestination}
                  disabled={isSavingDest}
                >
                  {isSavingDest ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.confirmBtnText}>{language === 'sw' ? 'Hifadhi Akaunti' : 'Save Destination'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* High-Risk Replace Confirmation Modal */}
      {replacingDest && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setReplacingDest(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="warning" size={24} color={colors.warning} />
                  <Text style={styles.modalTitle}>{language === 'sw' ? 'Tahadhari ya Kusalimisha' : 'High-Risk Action'}</Text>
                </View>
                <TouchableOpacity onPress={() => setReplacingDest(null)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                {language === 'sw'
                  ? `Kubadilisha akaunti ya malipo ya "${replacingDest.provider} (${replacingDest.maskedAccountIdentifier})" kutahitaji uthibitisho na kutaelekeza malipo yote yajayo kwenye akaunti mpya.`
                  : `Replacing payout destination "${replacingDest.provider} (${replacingDest.maskedAccountIdentifier})" will redirect all future automated settlements. You will be prompted to register the new destination.`}
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setReplacingDest(null)}>
                  <Text style={styles.cancelBtnText}>{language === 'sw' ? 'Ghairi' : 'Cancel'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.warning }]} onPress={handleConfirmReplace}>
                  <Text style={[styles.confirmBtnText, { color: colors.white }]}>
                    {language === 'sw' ? 'Endelea Kubadilisha' : 'Proceed to Replace'}
                  </Text>
                </TouchableOpacity>
              </View>
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
      padding: Spacing.md,
      maxWidth: 1050,
      width: '100%',
      alignSelf: 'center',
    },
    sectionTabsRow: {
      marginBottom: Spacing.md,
    },
    sectionTabsScroll: {
      gap: Spacing.sm,
    },
    sectionTabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTabBtnActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    sectionTabText: {
      fontSize: Typography.Caption.fontSize,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    sectionTabTextActive: {
      color: colors.primary,
    },
    scrollList: {
      gap: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    topControlRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    filterChipGroup: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    presetChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: Radii.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    presetChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    presetChipTextActive: {
      color: colors.onPrimary,
    },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    exportBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    mainMetricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    metricCard: {
      flex: 1,
      minWidth: 220,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 4,
      padding: Spacing.md,
      ...Shadows.sm,
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricVal: {
      fontSize: Typography.H2.fontSize,
      fontWeight: '800',
      marginVertical: 4,
    },
    metricSub: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    breakdownCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.lg,
      ...Shadows.sm,
    },
    cardSectionHeading: {
      fontSize: Typography.H3.fontSize,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardSectionSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: Spacing.md,
    },
    breakdownTable: {
      gap: Spacing.sm,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    breakdownLabel: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    breakdownValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    breakdownTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      marginTop: Spacing.xs,
      paddingTop: Spacing.sm,
    },
    breakdownTotalLabel: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    breakdownTotalValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.success,
    },
    txFilterRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    txCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...Shadows.sm,
    },
    txCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    txOrderNum: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    txDate: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    txProviderTag: {
      fontSize: 11,
      color: colors.textMuted,
    },
    txAmountsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    txAmtLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    txAmtVal: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: 2,
    },
    settlementCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...Shadows.sm,
    },
    settlementHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settlementRef: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    settlementPeriod: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    addDestBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: Radii.md,
      backgroundColor: colors.primary,
    },
    addDestBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    noDestCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: Spacing.lg,
      alignItems: 'center',
      gap: Spacing.xs,
    },
    noDestTitle: {
      fontSize: Typography.bodyLarge.fontSize,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4,
    },
    noDestSub: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 420,
    },
    destCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      ...Shadows.sm,
    },
    destLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    destIconCircle: {
      width: 44,
      height: 44,
      borderRadius: Radii.full,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    destProviderName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    destMaskedNumber: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 2,
    },
    destAccountName: {
      fontSize: 12,
      color: colors.textMuted,
    },
    destActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    destActionBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    destActionText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    payoutCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.xs,
      ...Shadows.sm,
    },
    payoutTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    payoutId: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    payoutDestInfo: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    payoutAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    payoutDate: {
      fontSize: 11,
      color: colors.textMuted,
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
      maxWidth: 480,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      ...Shadows.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    modalTitle: {
      fontSize: Typography.H3.fontSize,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: Spacing.md,
      lineHeight: 18,
    },
    typeSelectorRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    typeBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    typeBtnActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    typeBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    typeBtnTextActive: {
      color: colors.primary,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
      marginTop: Spacing.xs,
    },
    textInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      padding: Spacing.sm,
      fontSize: 14,
      color: colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    checkboxLabel: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    cancelBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    confirmBtn: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: Radii.md,
      backgroundColor: colors.primary,
    },
    confirmBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onPrimary,
    },
  });

let styles = createStyles(lightColors);
