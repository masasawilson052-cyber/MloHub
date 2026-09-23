import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { RefundsRepository } from '../../repositories/refunds.repository';
import { DisputesRepository } from '../../repositories/disputes.repository';
import { RefundRequest, FinancialDispute, RefundResponsibility } from '../../types/domain';
import { formatTzs } from '../../config/platformFees';

interface RefundsDisputesCenterProps {
  language?: 'en' | 'sw';
}

type FilterTab = 'ALL' | 'REQUESTED' | 'APPROVED' | 'COMPLETED' | 'FAILED' | 'DISPUTES';

export const RefundsDisputesCenter: React.FC<RefundsDisputesCenterProps> = ({
  language = 'en',
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || (Array.isArray(user?.roles) && user.roles.includes('SUPER_ADMIN' as any));
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [disputes, setDisputes] = useState<FinancialDispute[]>([]);
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<FinancialDispute | null>(null);

  // Approval modal state
  const [isApproving, setIsApproving] = useState(false);
  const [approvalResponsibility, setApprovalResponsibility] = useState<RefundResponsibility>('RESTAURANT');
  const [approvalAmount, setApprovalAmount] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [refList, dispList] = await Promise.all([
        RefundsRepository.listAll(100),
        DisputesRepository.listAll(100),
      ]);
      setRefunds(refList);
      setDisputes(dispList);
    } catch (e) {
      console.warn('Failed to load refunds/disputes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenApproveModal = (refund: RefundRequest) => {
    if (!isSuperAdmin) {
      Alert.alert('Permission Denied', 'Super Admin authorization required to approve financial refunds.');
      return;
    }
    setSelectedRefund(refund);
    setApprovalAmount(refund.requestedAmountTzs);
    setApprovalResponsibility('RESTAURANT');
    setIsApproving(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedRefund) return;
    try {
      const amt = BigInt(approvalAmount.replace(/[^0-9]/g, '') || selectedRefund.requestedAmountTzs);
      const res = await RefundsRepository.approveRefund({
        refundRequestId: selectedRefund.id,
        approvedAmountTzs: amt,
        responsibility: approvalResponsibility,
      });

      if (!res.success) {
        Alert.alert('Approval Error', res.error || 'Failed to approve refund.');
        return;
      }

      Alert.alert('Refund Approved', `Refund ${selectedRefund.id} approved successfully.`);
      setIsApproving(false);
      setSelectedRefund(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unexpected failure.');
    }
  };

  // Filtered lists
  const filteredRefunds = refunds.filter((r) => {
    if (activeTab === 'REQUESTED' && r.status !== 'REQUESTED' && (r.status as string) !== 'PENDING') return false;
    if (activeTab === 'APPROVED' && r.status !== 'APPROVED') return false;
    if (activeTab === 'COMPLETED' && r.status !== 'REFUNDED' && (r.status as string) !== 'COMPLETED') return false;
    if (activeTab === 'FAILED' && r.status !== 'FAILED') return false;
    if (activeTab === 'DISPUTES') return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      r.id.toLowerCase().includes(q) ||
      (r.orderId && r.orderId.toLowerCase().includes(q)) ||
      (r.reasonCode && r.reasonCode.toLowerCase().includes(q)) ||
      (r.reasonDetail && r.reasonDetail.toLowerCase().includes(q)) ||
      (r.restaurantId && r.restaurantId.toLowerCase().includes(q))
    );
  });

  const filteredDisputes = disputes.filter((d) => {
    if (activeTab !== 'ALL' && activeTab !== 'DISPUTES') return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      d.id.toLowerCase().includes(q) ||
      (d.reasonCode && d.reasonCode.toLowerCase().includes(q)) ||
      (d.description && d.description.toLowerCase().includes(q)) ||
      (d.restaurantId && d.restaurantId.toLowerCase().includes(q))
    );
  });

  const requestedCount = refunds.filter((r) => r.status === 'REQUESTED' || (r.status as string) === 'PENDING').length;
  const approvedCount = refunds.filter((r) => r.status === 'APPROVED').length;
  const completedCount = refunds.filter((r) => r.status === 'REFUNDED' || (r.status as string) === 'COMPLETED').length;
  const failedCount = refunds.filter((r) => r.status === 'FAILED').length;
  const disputesCount = disputes.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Kituo cha Marejesho na Migogoro' : 'Refunds & Financial Disputes Center'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Canonical financial remediation, customer refund authorization, and merchant liability allocation.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.primarySoft }]}
          onPress={loadData}
        >
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Action Required</Text>
          <Text style={[styles.kpiValue, { color: requestedCount > 0 ? '#EA580C' : colors.textPrimary }]}>
            {requestedCount}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Pending authorization</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Approved & Queue</Text>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{approvedCount}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Awaiting provider execution</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Completed Volume</Text>
          <Text style={[styles.kpiValue, { color: colors.success }]}>{completedCount}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Successfully settled</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Active Disputes</Text>
          <Text style={[styles.kpiValue, { color: disputesCount > 0 ? colors.danger : colors.textPrimary }]}>
            {disputesCount}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Merchant claims</Text>
        </View>
      </View>

      {/* Filter Tabs & Search */}
      <View style={styles.controlsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {(
            [
              { key: 'ALL', label: `All (${refunds.length + disputes.length})` },
              { key: 'REQUESTED', label: `Requested (${requestedCount})` },
              { key: 'APPROVED', label: `Approved (${approvedCount})` },
              { key: 'COMPLETED', label: `Completed (${completedCount})` },
              { key: 'FAILED', label: `Failed (${failedCount})` },
              { key: 'DISPUTES', label: `Disputes (${disputesCount})` },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabPill,
                { backgroundColor: colors.surface, borderColor: colors.border },
                activeTab === tab.key && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  activeTab === tab.key && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search refund ID, order, reason..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Main Content List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading financial records...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
          {activeTab !== 'DISPUTES' &&
            filteredRefunds.map((ref) => {
              const isPending = ref.status === 'REQUESTED' || (ref.status as string) === 'PENDING';
              const isDone = ref.status === 'REFUNDED' || (ref.status as string) === 'COMPLETED';
              return (
                <View
                  key={ref.id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.badgeGroup}>
                      <View
                        style={[
                          styles.statusBadge,
                          isDone
                            ? { backgroundColor: colors.successSoft }
                            : ref.status === 'FAILED'
                            ? { backgroundColor: colors.dangerSoft }
                            : isPending
                            ? { backgroundColor: colors.warningSoft }
                            : { backgroundColor: colors.infoSoft },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            isDone
                              ? { color: colors.success }
                              : ref.status === 'FAILED'
                              ? { color: colors.danger }
                              : isPending
                              ? { color: colors.warning }
                              : { color: colors.info },
                          ]}
                        >
                          {ref.status}
                        </Text>
                      </View>

                      {ref.responsibility && (
                        <View style={[styles.respBadge, { backgroundColor: colors.badgeBg }]}>
                          <Text style={[styles.respText, { color: colors.textSecondary }]}>
                            {ref.responsibility}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.amountText, { color: colors.textPrimary }]}>
                      {formatTzs(ref.requestedAmountTzs)}
                    </Text>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={[styles.reasonTitle, { color: colors.textPrimary }]}>
                      Reason: <Text style={{ fontWeight: '400' }}>{ref.reasonCode}</Text>
                    </Text>
                    {ref.reasonDetail ? (
                      <Text style={[styles.reasonDetail, { color: colors.textSecondary }]}>
                        {ref.reasonDetail}
                      </Text>
                    ) : null}

                    <View style={styles.metaRow}>
                      <Text style={[styles.metaItem, { color: colors.textMuted }]}>
                        Order: {ref.orderId || 'N/A'}
                      </Text>
                      <Text style={[styles.metaItem, { color: colors.textMuted }]}>
                        Requested: {new Date(ref.requestedAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
                    <Text style={[styles.idText, { color: colors.textMuted }]}>ID: {ref.id}</Text>

                    {isPending && (
                      isSuperAdmin ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                          onPress={() => handleOpenApproveModal(ref)}
                        >
                          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.actionBtnText}>Approve Refund</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                          <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>
                            Super Admin authorization required to approve financial refunds.
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                </View>
              );
            })}

          {(activeTab === 'ALL' || activeTab === 'DISPUTES') &&
            filteredDisputes.map((disp) => (
              <View
                key={disp.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.danger, borderLeftWidth: 4 },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: colors.dangerSoft }]}>
                    <Text style={[styles.statusText, { color: colors.danger }]}>
                      DISPUTE: {disp.status}
                    </Text>
                  </View>
                  <Text style={[styles.amountText, { color: colors.textPrimary }]}>
                    {formatTzs(disp.disputedAmountTzs)}
                  </Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={[styles.reasonTitle, { color: colors.textPrimary }]}>
                    Type: <Text style={{ fontWeight: '400' }}>{disp.disputeType}</Text>
                  </Text>
                  <Text style={[styles.reasonDetail, { color: colors.textSecondary }]}>
                    {disp.description}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaItem, { color: colors.textMuted }]}>
                      Restaurant: {disp.restaurantId}
                    </Text>
                    <Text style={[styles.metaItem, { color: colors.textMuted }]}>
                      Opened: {new Date(disp.openedAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

          {filteredRefunds.length === 0 && filteredDisputes.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Records in This View</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                No refund claims or financial disputes match the active filter criteria.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Approval Confirmation Modal */}
      <Modal visible={isApproving} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Authorize Customer Refund</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Authorizing this refund records an immutable adjustment and triggers gateway disbursement.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Approved Amount (TZS)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                value={approvalAmount}
                onChangeText={setApprovalAmount}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Financial Liability Allocation</Text>
              <View style={styles.respRow}>
                {(['RESTAURANT', 'PLATFORM', 'CUSTOMER'] as RefundResponsibility[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.respPill,
                      { backgroundColor: colors.badgeBg, borderColor: colors.border },
                      approvalResponsibility === r && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setApprovalResponsibility(r)}
                  >
                    <Text
                      style={[
                        styles.respPillText,
                        { color: colors.textSecondary },
                        approvalResponsibility === r && { color: '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsApproving(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmApproval}
              >
                <Text style={styles.confirmBtnText}>Confirm Authorization</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 26,
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
  tabScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  tabText: {
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
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  scrollList: {
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  respBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  respText: {
    fontSize: 10,
    fontWeight: '700',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardBody: {
    marginBottom: 12,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  reasonDetail: {
    fontSize: 12,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  idText: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
  emptyDesc: {
    fontSize: 13,
    marginTop: 4,
    maxWidth: 400,
    textAlign: 'center',
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
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    marginBottom: 20,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  respRow: {
    flexDirection: 'row',
    gap: 8,
  },
  respPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  respPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
