import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SettlementsRepository } from '../../repositories/settlements.repository';
import { PayoutsRepository } from '../../repositories/payouts.repository';
import { AdminFinanceRepository } from '../../repositories/adminFinance.repository';
import {
  MerchantSettlement,
  MerchantPayout,
  MerchantSettlementItem,
  MerchantPayoutDestination,
} from '../../types/domain';
import { AdminFinanceSummary } from '../../types/admin';
import { formatTzs } from '../../config/platformFees';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface SettlementsPayoutsCenterProps {
  language?: 'en' | 'sw';
}

type DatePreset = 'TODAY' | '7_DAYS' | '30_DAYS' | '90_DAYS' | 'ALL';

export const SettlementsPayoutsCenter: React.FC<SettlementsPayoutsCenterProps> = ({
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);
  const { user } = useAuth();
  const isSuperAdmin =
    user?.role === 'SUPER_ADMIN' ||
    (Array.isArray(user?.roles) && user.roles.includes('SUPER_ADMIN' as any));

  const [viewMode, setViewMode] = useState<'SETTLEMENTS' | 'PAYOUTS'>('SETTLEMENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Data
  const [settlements, setSettlements] = useState<MerchantSettlement[]>([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [financeSummary, setFinanceSummary] = useState<AdminFinanceSummary | null>(null);

  // Modals & Action States
  const [selectedSettlement, setSelectedSettlement] = useState<MerchantSettlement | null>(null);
  const [settlementDetails, setSettlementDetails] = useState<{
    settlement: MerchantSettlement;
    items: MerchantSettlementItem[];
  } | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdAction, setHoldAction] = useState<'HOLD' | 'RELEASE'>('HOLD');
  const [holdReason, setHoldReason] = useState('');

  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [verifiedDestinations, setVerifiedDestinations] = useState<MerchantPayoutDestination[]>([]);
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [loadingDestinations, setLoadingDestinations] = useState(false);

  const [selectedPayout, setSelectedPayout] = useState<MerchantPayout | null>(null);
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
  const [retryReason, setRetryReason] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  // Date range calculation
  const getDateRange = useCallback((): { from?: string; to?: string } => {
    if (datePreset === 'ALL') return {};
    const now = new Date();
    let fromDate: Date;
    if (datePreset === 'TODAY') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (datePreset === '7_DAYS') {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (datePreset === '30_DAYS') {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
    return { from: fromDate.toISOString(), to: now.toISOString() };
  }, [datePreset]);

  // Load authoritative data
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { from, to } = getDateRange();

    try {
      // 1. Authoritative platform summary
      try {
        const summary = await AdminFinanceRepository.getSummary(from, to);
        setFinanceSummary(summary);
      } catch (err: any) {
        console.warn('[SettlementsPayoutsCenter] Finance summary error:', err.message);
      }

      // 2. Paginated list
      if (viewMode === 'SETTLEMENTS') {
        const res = await SettlementsRepository.listAdminPage({
          page,
          pageSize,
          search: searchQuery,
          from,
          to,
        });
        setSettlements(res.items);
        setTotal(res.total);
        setHasNext(res.hasNext);
      } else {
        const res = await PayoutsRepository.listAdminPage({
          page,
          pageSize,
          search: searchQuery,
          from,
          to,
        });
        setPayouts(res.items);
        setTotal(res.total);
        setHasNext(res.hasNext);
      }
    } catch (e: any) {
      console.error('[SettlementsPayoutsCenter] Load failed:', e);
      setLoadError(e.message || 'Failed to load authoritative ledger data.');
    } finally {
      setLoading(false);
    }
  }, [viewMode, page, pageSize, searchQuery, getDateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when switching views or search
  const handleViewModeChange = (mode: 'SETTLEMENTS' | 'PAYOUTS') => {
    setViewMode(mode);
    setPage(1);
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
  };

  // --------------------------------------------------------------------------
  // ACTIONS: Details Review
  // --------------------------------------------------------------------------
  const handleOpenDetails = async (settlement: MerchantSettlement) => {
    setSelectedSettlement(settlement);
    setIsDetailsModalOpen(true);
    setActionLoading(true);
    try {
      const data = await SettlementsRepository.getSettlementWithItems(settlement.id);
      setSettlementDetails(data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load settlement details.');
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: Approve Settlement
  // --------------------------------------------------------------------------
  const handleApproveSettlement = async (settlement: MerchantSettlement) => {
    if (!isSuperAdmin) {
      Alert.alert('Permission Denied', 'SUPER_ADMIN authorization is required to approve settlements.');
      return;
    }

    Alert.alert(
      'Approve Settlement',
      `Are you sure you want to approve settlement ${settlement.reference || settlement.id} for ${formatTzs(settlement.netPayableTzs)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await SettlementsRepository.approveSettlement(settlement.id);
              if (!res.success) {
                Alert.alert('Error', res.error || 'Failed to approve settlement.');
                return;
              }
              Alert.alert('Success', 'Settlement approved successfully.');
              await loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Approval failed.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // --------------------------------------------------------------------------
  // ACTIONS: Hold / Release Settlement
  // --------------------------------------------------------------------------
  const handleOpenHoldModal = (settlement: MerchantSettlement, action: 'HOLD' | 'RELEASE') => {
    if (!isSuperAdmin) {
      Alert.alert('Permission Denied', 'SUPER_ADMIN authorization is required to modify settlement holds.');
      return;
    }
    setSelectedSettlement(settlement);
    setHoldAction(action);
    setHoldReason('');
    setIsHoldModalOpen(true);
  };

  const handleConfirmHoldAction = async () => {
    if (!selectedSettlement) return;
    if (holdReason.trim().length < 5) {
      Alert.alert('Reason Required', 'Please provide a clear justification of at least 5 characters.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await SettlementsRepository.setHold(
        selectedSettlement.id,
        holdAction === 'HOLD',
        holdReason.trim()
      );
      if (!res.success) {
        Alert.alert('Error', res.error || 'Failed to update settlement hold state.');
        return;
      }
      Alert.alert(
        'Success',
        holdAction === 'HOLD'
          ? 'Settlement has been placed ON_HOLD.'
          : 'Settlement hold released and returned to UNDER_REVIEW.'
      );
      setIsHoldModalOpen(false);
      setSelectedSettlement(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: Queue Payout
  // --------------------------------------------------------------------------
  const handleOpenQueuePayoutModal = async (settlement: MerchantSettlement) => {
    if (!isSuperAdmin) {
      Alert.alert('Permission Denied', 'SUPER_ADMIN authorization is required to queue payouts.');
      return;
    }
    setSelectedSettlement(settlement);
    setSelectedDestinationId('');
    setIsQueueModalOpen(true);
    setLoadingDestinations(true);

    try {
      const dests = await PayoutsRepository.listDestinations(settlement.restaurantId);
      const verified = dests.filter((d) => d.verificationStatus === 'VERIFIED');
      setVerifiedDestinations(verified);
      const defaultDest = verified.find((d) => d.isDefault);
      if (defaultDest) {
        setSelectedDestinationId(defaultDest.id);
      } else if (verified.length > 0) {
        setSelectedDestinationId(verified[0].id);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load merchant payout destinations.');
    } finally {
      setLoadingDestinations(false);
    }
  };

  const handleConfirmQueuePayout = async () => {
    if (!selectedSettlement || !selectedDestinationId) {
      Alert.alert('Destination Required', 'Please select a verified payout destination.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await PayoutsRepository.executePayout({
        settlementId: selectedSettlement.id,
        destinationId: selectedDestinationId,
        idempotencyKey: `admin:payout:${selectedSettlement.id}:${selectedDestinationId}`,
      });

      if (!res.success) {
        Alert.alert('Queue Error', res.error || 'Failed to queue merchant payout.');
        return;
      }

      Alert.alert('Payout Queued', 'Payout queued for the trusted server payout worker.');
      setIsQueueModalOpen(false);
      setSelectedSettlement(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to queue payout.');
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: Retry Failed Payout
  // --------------------------------------------------------------------------
  const handleOpenRetryModal = (payout: MerchantPayout) => {
    if (!isSuperAdmin) {
      Alert.alert('Permission Denied', 'SUPER_ADMIN authorization is required to retry failed payouts.');
      return;
    }
    setSelectedPayout(payout);
    setRetryReason('');
    setIsRetryModalOpen(true);
  };

  const handleConfirmRetryPayout = async () => {
    if (!selectedPayout) return;
    if (retryReason.trim().length < 5) {
      Alert.alert('Reason Required', 'Please provide a clear retry justification of at least 5 characters.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await PayoutsRepository.retryPayout(selectedPayout.id, retryReason.trim());
      if (!res.success) {
        Alert.alert('Retry Failed', res.error || 'Payout could not be retried.');
        return;
      }

      Alert.alert('Success', 'Payout status reset to QUEUED for worker execution.');
      setIsRetryModalOpen(false);
      setSelectedPayout(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Payout retry failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.appBackground }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Malipo na Hesabu za Wauzaji' : 'Merchant Settlements & Payouts Engine'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Authoritative merchant ledger periods, commission deductions, net payables, and mobile money disbursements.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.primarySoft }]}
          onPress={loadData}
          disabled={loading}
        >
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Summary Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Gross Sales Settled</Text>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
            {formatTzs(financeSummary ? financeSummary.settlementGrossTzs : 0)}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Authoritative ledger</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Platform Commission</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {formatTzs(financeSummary ? financeSummary.platformCommissionTzs : 0)}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Retained fees</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Net Payable</Text>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
            {formatTzs(financeSummary ? financeSummary.merchantNetPayableTzs : 0)}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Due to food spots</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Disbursed Volume</Text>
          <Text style={[styles.kpiValue, { color: colors.success }]}>
            {formatTzs(financeSummary ? financeSummary.paidOutTzs : 0)}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Authoritatively confirmed merchant payouts</Text>
        </View>
      </View>

      {/* Date Range Presets */}
      <View style={styles.presetRow}>
        {(['ALL', 'TODAY', '7_DAYS', '30_DAYS', '90_DAYS'] as DatePreset[]).map((preset) => (
          <TouchableOpacity
            key={preset}
            style={[
              styles.presetBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              datePreset === preset && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleDatePresetChange(preset)}
          >
            <Text
              style={[
                styles.presetBtnText,
                { color: colors.textSecondary },
                datePreset === preset && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              {preset === 'ALL'
                ? 'All Time'
                : preset === 'TODAY'
                ? 'Today'
                : preset === '7_DAYS'
                ? 'Last 7 Days'
                : preset === '30_DAYS'
                ? 'Last 30 Days'
                : 'Last 90 Days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* View Switcher & Search */}
      <View style={styles.controlsRow}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              viewMode === 'SETTLEMENTS' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleViewModeChange('SETTLEMENTS')}
          >
            <Text
              style={[
                styles.toggleText,
                { color: colors.textSecondary },
                viewMode === 'SETTLEMENTS' && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              Settlement Batches ({viewMode === 'SETTLEMENTS' ? total : financeSummary?.calculatedSettlements ?? 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              viewMode === 'PAYOUTS' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleViewModeChange('PAYOUTS')}
          >
            <Text
              style={[
                styles.toggleText,
                { color: colors.textSecondary },
                viewMode === 'PAYOUTS' && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              Disbursement Payouts ({viewMode === 'PAYOUTS' ? total : financeSummary?.queuedPayouts ?? 0})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search restaurant, ID, reference..."
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setPage(1);
            }}
          />
        </View>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading authoritative data...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Unable to Load Data</Text>
          <Text style={[styles.emptyDesc, { color: colors.danger }]}>{loadError}</Text>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.primary, marginTop: 12 }]}
            onPress={loadData}
          >
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
          {viewMode === 'SETTLEMENTS' ? (
            settlements.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="documents-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Settlement Batches</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Settlements are automatically computed based on verified order completions and ledger postings.
                </Text>
              </View>
            ) : (
              settlements.map((s) => (
                <View
                  key={s.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                      <View
                        style={[
                          styles.statusBadge,
                          s.status === 'PAID'
                            ? { backgroundColor: colors.successSoft }
                            : s.status === 'APPROVED'
                            ? { backgroundColor: colors.infoSoft }
                            : s.status === 'ON_HOLD'
                            ? { backgroundColor: colors.dangerSoft }
                            : { backgroundColor: colors.warningSoft },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            s.status === 'PAID'
                              ? { color: colors.success }
                              : s.status === 'APPROVED'
                              ? { color: colors.info }
                              : s.status === 'ON_HOLD'
                              ? { color: colors.danger }
                              : { color: colors.warning },
                          ]}
                        >
                          {s.status}
                        </Text>
                      </View>
                      <Text style={[styles.restId, { color: colors.textPrimary }]}>
                        Restaurant: {s.restaurantId}
                      </Text>
                    </View>

                    <Text style={[styles.netAmount, { color: colors.textPrimary }]}>
                      Net: {formatTzs(s.netPayableTzs)}
                    </Text>
                  </View>

                  <View style={styles.cardGrid}>
                    <View style={styles.gridCol}>
                      <Text style={[styles.colLabel, { color: colors.textMuted }]}>Gross Food Sales</Text>
                      <Text style={[styles.colVal, { color: colors.textPrimary }]}>{formatTzs(s.grossSalesTzs)}</Text>
                    </View>
                    <View style={styles.gridCol}>
                      <Text style={[styles.colLabel, { color: colors.textMuted }]}>Platform Commission</Text>
                      <Text style={[styles.colVal, { color: colors.primary }]}>{formatTzs(s.platformFeesTzs)}</Text>
                    </View>
                    <View style={styles.gridCol}>
                      <Text style={[styles.colLabel, { color: colors.textMuted }]}>Refund Adjustments</Text>
                      <Text style={[styles.colVal, { color: colors.danger }]}>{formatTzs(s.refundAdjustmentsTzs)}</Text>
                    </View>
                  </View>

                  <View style={[styles.cardFooter, { borderTopColor: colors.divider }]}>
                    <View>
                      <Text style={[styles.footerText, { color: colors.textMuted }]}>
                        Period: {new Date(s.periodStart).toLocaleDateString()} - {new Date(s.periodEnd).toLocaleDateString()}
                      </Text>
                      <Text style={[styles.footerText, { color: colors.textMuted }]}>
                        Ref: {s.reference || s.id}
                      </Text>
                    </View>

                    {/* Action buttons based on status */}
                    <View style={styles.actionBtnRow}>
                      <TouchableOpacity
                        style={[styles.smallActionBtn, { backgroundColor: colors.infoSoft }]}
                        onPress={() => handleOpenDetails(s)}
                      >
                        <Text style={[styles.smallActionBtnText, { color: colors.info }]}>Review Details</Text>
                      </TouchableOpacity>

                      {(s.status === 'CALCULATED' || (s.status as string) === 'UNDER_REVIEW') && isSuperAdmin && (
                        <>
                          <TouchableOpacity
                            style={[styles.smallActionBtn, { backgroundColor: colors.successSoft }]}
                            onPress={() => handleApproveSettlement(s)}
                          >
                            <Text style={[styles.smallActionBtnText, { color: colors.success }]}>Approve Settlement</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallActionBtn, { backgroundColor: colors.dangerSoft }]}
                            onPress={() => handleOpenHoldModal(s, 'HOLD')}
                          >
                            <Text style={[styles.smallActionBtnText, { color: colors.danger }]}>Place on Hold</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {s.status === 'APPROVED' && isSuperAdmin && (
                        <>
                          <TouchableOpacity
                            style={[styles.smallActionBtn, { backgroundColor: colors.primarySoft }]}
                            onPress={() => handleOpenQueuePayoutModal(s)}
                          >
                            <Text style={[styles.smallActionBtnText, { color: colors.primary }]}>Queue Payout</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallActionBtn, { backgroundColor: colors.dangerSoft }]}
                            onPress={() => handleOpenHoldModal(s, 'HOLD')}
                          >
                            <Text style={[styles.smallActionBtnText, { color: colors.danger }]}>Place on Hold</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {s.status === 'ON_HOLD' && isSuperAdmin && (
                        <TouchableOpacity
                          style={[styles.smallActionBtn, { backgroundColor: colors.warningSoft }]}
                          onPress={() => handleOpenHoldModal(s, 'RELEASE')}
                        >
                          <Text style={[styles.smallActionBtnText, { color: colors.warning }]}>Release Hold</Text>
                        </TouchableOpacity>
                      )}

                      {s.status === 'PAYOUT_PENDING' && (
                        <TouchableOpacity
                          style={[styles.smallActionBtn, { backgroundColor: colors.primarySoft }]}
                          onPress={() => handleViewModeChange('PAYOUTS')}
                        >
                          <Text style={[styles.smallActionBtnText, { color: colors.primary }]}>View Payout</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )
          ) : payouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Payout Disbursements</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                Approved net payables trigger provider payout requests to merchant mobile money accounts.
              </Text>
            </View>
          ) : (
            payouts.map((p) => {
              const isFailed = p.status === 'FAILED' || p.status === 'MANUAL_REVIEW';
              const canRetry =
                isFailed &&
                (!p.providerReference || p.providerReference === 'UNCONFIGURED' || p.providerReference === 'FAILED');

              return (
                <View
                  key={p.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                      <View
                        style={[
                          styles.statusBadge,
                          p.status === 'SUCCESS' || (p.status as string) === 'COMPLETED'
                            ? { backgroundColor: colors.successSoft }
                            : p.status === 'FAILED' || p.status === 'MANUAL_REVIEW'
                            ? { backgroundColor: colors.dangerSoft }
                            : { backgroundColor: colors.warningSoft },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            p.status === 'SUCCESS' || (p.status as string) === 'COMPLETED'
                              ? { color: colors.success }
                              : p.status === 'FAILED' || p.status === 'MANUAL_REVIEW'
                              ? { color: colors.danger }
                              : { color: colors.warning },
                          ]}
                        >
                          {p.status}
                        </Text>
                      </View>
                      <Text style={[styles.restId, { color: colors.textPrimary }]}>
                        Destination: {p.maskedIdentifierSnapshot || p.destinationPhone || 'Configured Phone'}
                      </Text>
                    </View>

                    <Text style={[styles.netAmount, { color: colors.textPrimary }]}>
                      {formatTzs(p.amountTzs)}
                    </Text>
                  </View>

                  <View style={styles.cardGrid}>
                    <View style={styles.gridCol}>
                      <Text style={[styles.colLabel, { color: colors.textMuted }]}>Provider</Text>
                      <Text style={[styles.colVal, { color: colors.textPrimary }]}>
                        {p.provider || p.providerSnapshot || 'Mobile Money'}
                      </Text>
                    </View>
                    <View style={styles.gridCol}>
                      <Text style={[styles.colLabel, { color: colors.textMuted }]}>Provider Reference</Text>
                      <Text style={[styles.colVal, { color: colors.textPrimary }]}>
                        {p.providerReference || 'Pending'}
                      </Text>
                    </View>
                    <View style={styles.gridCol}>
                      <Text style={[styles.colLabel, { color: colors.textMuted }]}>Disbursed At</Text>
                      <Text style={[styles.colVal, { color: colors.textPrimary }]}>
                        {p.completedAt ? new Date(p.completedAt).toLocaleString() : 'Processing'}
                      </Text>
                    </View>
                  </View>

                  {/* Failure Diagnostic Details */}
                  {isFailed && (
                    <View style={[styles.failureBox, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="alert-circle" size={16} color={colors.danger} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.danger }}>
                          Failure Details: {p.failureCode || 'SYSTEM_FAILURE'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                        {p.failureReason || 'Payout execution could not be completed.'}
                      </Text>
                      {p.rawProviderStatus ? (
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, fontFamily: 'monospace' }}>
                          Provider Response: {p.rawProviderStatus}
                        </Text>
                      ) : null}

                      {canRetry && isSuperAdmin && (
                        <TouchableOpacity
                          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                          onPress={() => handleOpenRetryModal(p)}
                        >
                          <Ionicons name="refresh" size={14} color={colors.onPrimary} />
                          <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '700' }}>Retry Payout</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* Pagination Controls */}
          {total > pageSize && (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[
                  styles.pageBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  page <= 1 && { opacity: 0.5 },
                ]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
                <Text style={[styles.pageBtnText, { color: colors.textPrimary }]}>Previous</Text>
              </TouchableOpacity>

              <Text style={[styles.pageIndicator, { color: colors.textSecondary }]}>
                Page {page} of {Math.ceil(total / pageSize)} ({total} total)
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  !hasNext && { opacity: 0.5 },
                ]}
                onPress={() => setPage((p) => p + 1)}
                disabled={!hasNext}
              >
                <Text style={[styles.pageBtnText, { color: colors.textPrimary }]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 1: Settlement Details & Items Review                                   */}
      {/* -------------------------------------------------------------------------- */}
      <Modal visible={isDetailsModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, maxWidth: 650 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Settlement Details</Text>
              <TouchableOpacity onPress={() => setIsDetailsModalOpen(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {actionLoading || !settlementDetails ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Settlement ID:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{settlementDetails.settlement.id}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Restaurant ID:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{settlementDetails.settlement.restaurantId}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Period:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                    {new Date(settlementDetails.settlement.periodStart).toLocaleDateString()} -{' '}
                    {new Date(settlementDetails.settlement.periodEnd).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Gross Food Sales:</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                    {formatTzs(settlementDetails.settlement.grossSalesTzs)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Platform Commission:</Text>
                  <Text style={[styles.detailVal, { color: colors.primary }]}>
                    {formatTzs(settlementDetails.settlement.platformFeesTzs)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Refund Adjustments:</Text>
                  <Text style={[styles.detailVal, { color: colors.danger }]}>
                    {formatTzs(settlementDetails.settlement.refundAdjustmentsTzs)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Dispute Adjustments:</Text>
                  <Text style={[styles.detailVal, { color: colors.danger }]}>
                    {formatTzs(settlementDetails.settlement.disputeAdjustmentsTzs)}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomWidth: 0, marginTop: 8 }]}>
                  <Text style={[styles.detailKey, { color: colors.textPrimary, fontWeight: '800' }]}>Net Payable:</Text>
                  <Text style={[styles.detailVal, { color: colors.success, fontWeight: '800', fontSize: 16 }]}>
                    {formatTzs(settlementDetails.settlement.netPayableTzs)}
                  </Text>
                </View>

                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 16, marginBottom: 8 }}>
                  Settlement Line Items ({settlementDetails.items.length})
                </Text>

                {settlementDetails.items.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.divider,
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 8,
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        Type: {item.entryType}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                        Net: {formatTzs(item.netTzs)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      Order: {item.orderId || 'N/A'} | Payment: {item.paymentId || 'N/A'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      Gross: {formatTzs(item.grossTzs)} | Fee: {formatTzs(item.feeTzs)} | Adj: {formatTzs(item.adjustmentTzs)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: colors.primary }]}
              onPress={() => setIsDetailsModalOpen(false)}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 2: Place on Hold / Release Hold                                      */}
      {/* -------------------------------------------------------------------------- */}
      <Modal visible={isHoldModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {holdAction === 'HOLD' ? 'Place Settlement on Hold' : 'Release Settlement Hold'}
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {holdAction === 'HOLD'
                ? 'Placing a settlement on hold prevents automated and manual payout disbursement until released.'
                : 'Releasing a settlement hold transitions it to UNDER_REVIEW for authoritative re-approval.'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Audit Reason (min. 5 characters)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Enter justification..."
                placeholderTextColor={colors.inputPlaceholder}
                value={holdReason}
                onChangeText={setHoldReason}
                multiline
              />
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsHoldModalOpen(false)}
                disabled={actionLoading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: holdAction === 'HOLD' ? colors.danger : colors.warning },
                ]}
                onPress={handleConfirmHoldAction}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    {holdAction === 'HOLD' ? 'Confirm Hold' : 'Confirm Release'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 3: Queue Payout                                                      */}
      {/* -------------------------------------------------------------------------- */}
      <Modal visible={isQueueModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Queue Merchant Payout</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Select a verified merchant payout destination to queue disbursement for {selectedSettlement ? formatTzs(selectedSettlement.netPayableTzs) : ''}.
            </Text>

            {loadingDestinations ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : verifiedDestinations.length === 0 ? (
              <View style={{ padding: 16, backgroundColor: colors.warningSoft, borderRadius: 8, marginVertical: 12 }}>
                <Text style={{ fontSize: 13, color: colors.warning, fontWeight: '700' }}>
                  No Verified Payout Destinations
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  The merchant has not added any VERIFIED payout destinations. Verify their destination in Restaurant Details before queueing payout.
                </Text>
              </View>
            ) : (
              <View style={{ marginVertical: 12 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                  Verified Payout Destination:
                </Text>
                {verifiedDestinations.map((dest) => (
                  <TouchableOpacity
                    key={dest.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: selectedDestinationId === dest.id ? colors.primary : colors.border,
                      backgroundColor: selectedDestinationId === dest.id ? colors.primarySoft : colors.card,
                      marginBottom: 8,
                    }}
                    onPress={() => setSelectedDestinationId(dest.id)}
                  >
                    <Ionicons
                      name={selectedDestinationId === dest.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selectedDestinationId === dest.id ? colors.primary : colors.textMuted}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                        {dest.provider} — {dest.maskedAccountIdentifier}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {dest.accountName} {dest.isDefault ? ' (Default)' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsQueueModalOpen(false)}
                disabled={actionLoading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: colors.primary },
                  (!selectedDestinationId || verifiedDestinations.length === 0) && { opacity: 0.5 },
                ]}
                onPress={handleConfirmQueuePayout}
                disabled={actionLoading || !selectedDestinationId || verifiedDestinations.length === 0}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm & Queue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 4: Retry Failed Payout                                               */}
      {/* -------------------------------------------------------------------------- */}
      <Modal visible={isRetryModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Retry Failed Payout</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Resets payout status back to QUEUED while preserving original ledger and idempotency integrity.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Retry Reason (min. 5 characters)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Reason for re-queuing payout..."
                placeholderTextColor={colors.inputPlaceholder}
                value={retryReason}
                onChangeText={setRetryReason}
                multiline
              />
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsRetryModalOpen(false)}
                disabled={actionLoading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmRetryPayout}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Retry</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    refreshText: {
      fontSize: 12,
      fontWeight: '700',
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
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
      fontSize: 20,
      fontWeight: '800',
      marginTop: 6,
      letterSpacing: -0.5,
    },
    kpiSub: {
      fontSize: 11,
      marginTop: 4,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    presetBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    presetBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      gap: 16,
      flexWrap: 'wrap',
    },
    viewToggle: {
      flexDirection: 'row',
      gap: 8,
    },
    toggleBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    toggleText: {
      fontSize: 13,
      fontWeight: '600',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      minWidth: 260,
      flex: 1,
      maxWidth: 360,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
      paddingLeft: 8,
      fontSize: 13,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
    },
    scrollList: {
      paddingBottom: 40,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginTop: 12,
    },
    emptyDesc: {
      fontSize: 13,
      textAlign: 'center',
      marginTop: 6,
      maxWidth: 400,
    },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    restId: {
      fontSize: 13,
      fontWeight: '600',
    },
    netAmount: {
      fontSize: 16,
      fontWeight: '800',
    },
    cardGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
      gap: 12,
    },
    gridCol: {
      flex: 1,
    },
    colLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    colVal: {
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      paddingTop: 10,
      flexWrap: 'wrap',
      gap: 8,
    },
    footerText: {
      fontSize: 11,
    },
    actionBtnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    smallActionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    smallActionBtnText: {
      fontSize: 11,
      fontWeight: '700',
    },
    failureBox: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      marginTop: 10,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      marginTop: 8,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    paginationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      marginTop: 16,
      paddingVertical: 12,
    },
    pageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    pageBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
    pageIndicator: {
      fontSize: 12,
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 480,
      borderRadius: 14,
      borderWidth: 1,
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 6,
    },
    modalSub: {
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 14,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    detailKey: {
      fontSize: 12,
      fontWeight: '600',
    },
    detailVal: {
      fontSize: 12,
      fontWeight: '700',
    },
    closeModalBtn: {
      marginTop: 16,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    inputGroup: {
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      fontSize: 13,
      minHeight: 60,
    },
    modalActionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 10,
    },
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    confirmBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    confirmBtnText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
