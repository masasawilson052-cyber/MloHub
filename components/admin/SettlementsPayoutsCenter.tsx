import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SettlementsRepository } from '../../repositories/settlements.repository';
import { PayoutsRepository } from '../../repositories/payouts.repository';
import { MerchantSettlement, MerchantPayout } from '../../types/domain';
import { formatTzs } from '../../config/platformFees';

interface SettlementsPayoutsCenterProps {
  language?: 'en' | 'sw';
}

export const SettlementsPayoutsCenter: React.FC<SettlementsPayoutsCenterProps> = ({
  language = 'en',
}) => {
  const { colors } = useTheme();
  const [viewMode, setViewMode] = useState<'SETTLEMENTS' | 'PAYOUTS'>('SETTLEMENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [settlements, setSettlements] = useState<MerchantSettlement[]>([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settleList, payoutList] = await Promise.all([
        SettlementsRepository.listAll(100),
        PayoutsRepository.listAll(100),
      ]);
      setSettlements(settleList);
      setPayouts(payoutList);
    } catch (e) {
      console.warn('Failed to load settlements/payouts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSettlements = settlements.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.id.toLowerCase().includes(q) ||
      (s.restaurantId && s.restaurantId.toLowerCase().includes(q)) ||
      (s.reference && s.reference.toLowerCase().includes(q)) ||
      s.status.toLowerCase().includes(q)
    );
  });

  const filteredPayouts = payouts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.id.toLowerCase().includes(q) ||
      (p.restaurantId && p.restaurantId.toLowerCase().includes(q)) ||
      (p.providerReference && p.providerReference.toLowerCase().includes(q)) ||
      p.status.toLowerCase().includes(q)
    );
  });

  const totalGrossVolume = settlements.reduce((acc, s) => acc + Number(s.grossSalesTzs || 0), 0);
  const totalNetPayable = settlements.reduce((acc, s) => acc + Number(s.netPayableTzs || 0), 0);
  const totalCommission = settlements.reduce((acc, s) => acc + Number(s.platformFeesTzs || 0), 0);
  const totalDisbursedPayouts = payouts
    .filter((p) => p.status === 'SUCCESS' || (p.status as string) === 'COMPLETED')
    .reduce((acc, p) => acc + Number(p.amountTzs || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        >
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Summary Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Gross Sales Settled</Text>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{formatTzs(totalGrossVolume)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Platform aggregate</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Platform Commission</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatTzs(totalCommission)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Retained fees</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Net Payable</Text>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{formatTzs(totalNetPayable)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Due to food spots</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Disbursed Volume</Text>
          <Text style={[styles.kpiValue, { color: colors.success }]}>{formatTzs(totalDisbursedPayouts)}</Text>
          <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Completed via M-Pesa / Tigo</Text>
        </View>
      </View>

      {/* View Switcher & Search */}
      <View style={styles.controlsRow}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              viewMode === 'SETTLEMENTS' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setViewMode('SETTLEMENTS')}
          >
            <Text
              style={[
                styles.toggleText,
                { color: colors.textSecondary },
                viewMode === 'SETTLEMENTS' && { color: '#FFFFFF', fontWeight: '700' },
              ]}
            >
              Settlement Batches ({settlements.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              viewMode === 'PAYOUTS' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setViewMode('PAYOUTS')}
          >
            <Text
              style={[
                styles.toggleText,
                { color: colors.textSecondary },
                viewMode === 'PAYOUTS' && { color: '#FFFFFF', fontWeight: '700' },
              ]}
            >
              Disbursement Payouts ({payouts.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search restaurant, ID, reference..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading financial settlements...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
          {viewMode === 'SETTLEMENTS' ? (
            filteredSettlements.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="documents-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Settlement Batches</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Settlements are automatically computed based on verified order completions and ledger postings.
                </Text>
              </View>
            ) : (
              filteredSettlements.map((s) => (
                <View
                  key={s.id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                      <Text style={[styles.colLabel, { color: colors.textMuted }]}>Platform Fee (10%)</Text>
                      <Text style={[styles.colVal, { color: colors.primary }]}>{formatTzs(s.platformFeesTzs)}</Text>
                    </View>
                    <View style={styles.gridCol}>
                      <Text style={[styles.colLabel, { color: colors.textMuted }]}>Refund Deductions</Text>
                      <Text style={[styles.colVal, { color: colors.danger }]}>{formatTzs(s.refundAdjustmentsTzs)}</Text>
                    </View>
                  </View>

                  <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>
                      Period: {new Date(s.periodStart).toLocaleDateString()} - {new Date(s.periodEnd).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>
                      Ref: {s.reference || s.id}
                    </Text>
                  </View>
                </View>
              ))
            )
          ) : filteredPayouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Payout Disbursements</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                Approved net payables trigger provider payout requests to merchant mobile money accounts.
              </Text>
            </View>
          ) : (
            filteredPayouts.map((p) => (
              <View
                key={p.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.headerLeft}>
                    <View
                      style={[
                        styles.statusBadge,
                        p.status === 'SUCCESS' || (p.status as string) === 'COMPLETED'
                          ? { backgroundColor: colors.successSoft }
                          : p.status === 'FAILED'
                          ? { backgroundColor: colors.dangerSoft }
                          : { backgroundColor: colors.warningSoft },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          p.status === 'SUCCESS' || (p.status as string) === 'COMPLETED'
                            ? { color: colors.success }
                            : p.status === 'FAILED'
                            ? { color: colors.danger }
                            : { color: colors.warning },
                        ]}
                      >
                        {p.status}
                      </Text>
                    </View>
                    <Text style={[styles.restId, { color: colors.textPrimary }]}>
                      Destination: {p.destinationPhone || (p as any).maskedIdentifierSnapshot || 'Configured Phone'}
                    </Text>
                  </View>

                  <Text style={[styles.netAmount, { color: colors.textPrimary }]}>
                    {formatTzs(p.amountTzs)}
                  </Text>
                </View>

                <View style={styles.cardGrid}>
                  <View style={styles.gridCol}>
                    <Text style={[styles.colLabel, { color: colors.textMuted }]}>Provider</Text>
                    <Text style={[styles.colVal, { color: colors.textPrimary }]}>{p.provider || 'Mobile Money'}</Text>
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={[styles.colLabel, { color: colors.textMuted }]}>Provider Reference</Text>
                    <Text style={[styles.colVal, { color: colors.textPrimary }]}>{p.providerReference || 'Pending'}</Text>
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={[styles.colLabel, { color: colors.textMuted }]}>Disbursed At</Text>
                    <Text style={[styles.colVal, { color: colors.textPrimary }]}>
                      {p.completedAt ? new Date(p.completedAt).toLocaleString() : 'Processing'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
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
    fontWeight: '700',
  },
  netAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardGrid: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  gridCol: {
    flex: 1,
    minWidth: 120,
  },
  colLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  colVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 11,
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
    maxWidth: 420,
    textAlign: 'center',
  },
});
