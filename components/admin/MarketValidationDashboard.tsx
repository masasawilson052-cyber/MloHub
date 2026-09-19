/**
 * Stage 11: Market Validation & Demand Intelligence Dashboard
 * Displays privacy-coarsened search demand, zero-result hotspots,
 * supply gap rankings, and discovery conversion funnels for platform operators.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { SupplyGapService } from '../../services/SupplyGapService';
import { SupplyGapMetric, ConversionFunnelReport } from '../../types/analytics';

interface MarketValidationDashboardProps {
  language?: 'en' | 'sw';
}

export const MarketValidationDashboard: React.FC<MarketValidationDashboardProps> = ({
  language = 'en',
}) => {
  const [selectedWard, setSelectedWard] = useState<string>('ALL');

  const supplyGaps: SupplyGapMetric[] = useMemo(() => {
    return SupplyGapService.computeSupplyGaps();
  }, []);

  const funnelReport: ConversionFunnelReport = useMemo(() => {
    return SupplyGapService.getFunnelReport();
  }, []);

  const wards = useMemo(() => {
    const set = new Set<string>();
    supplyGaps.forEach((g) => set.add(g.wardName));
    return ['ALL', ...Array.from(set)];
  }, [supplyGaps]);

  const filteredGaps = useMemo(() => {
    if (selectedWard === 'ALL') return supplyGaps;
    return supplyGaps.filter((g) => g.wardName === selectedWard);
  }, [supplyGaps, selectedWard]);

  const criticalGapsCount = supplyGaps.filter((g) => g.urgencyLevel === 'CRITICAL').length;
  const highGapsCount = supplyGaps.filter((g) => g.urgencyLevel === 'HIGH').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header & Demo Indicator */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>
            {language === 'sw'
              ? 'Uchambuzi wa Mahitaji na Mapengo ya Soko'
              : 'Market Validation & Food Demand Intelligence'}
          </Text>
          <Text style={styles.subtitle}>
            Privacy-coarsened search signals and zero-result tracking across Dar es Salaam wards.
          </Text>
        </View>

        {funnelReport.isFixtureData || supplyGaps.some((g) => g.isFixtureData) ? (
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>DEMO FIXTURE DATA</Text>
          </View>
        ) : null}
      </View>

      {/* Summary KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{funnelReport.totalSearches.toLocaleString()}</Text>
          <Text style={styles.kpiLabel}>Searches Analyzed</Text>
          <Text style={styles.kpiSub}>Past 7 days (Ward coarsened)</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: '#B91C1C' }]}>{criticalGapsCount}</Text>
          <Text style={styles.kpiLabel}>Critical Supply Gaps</Text>
          <Text style={styles.kpiSub}>High demand, near-zero supply</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: '#D97706' }]}>{highGapsCount}</Text>
          <Text style={styles.kpiLabel}>High Demand Alerts</Text>
          <Text style={styles.kpiSub}>Frequent zero-result searches</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: '#16A34A' }]}>
            {Math.round(funnelReport.clickToOrderRate * 100)}%
          </Text>
          <Text style={styles.kpiLabel}>Click-to-Order Conversion</Text>
          <Text style={styles.kpiSub}>From discovery to checkout</Text>
        </View>
      </View>

      {/* Conversion Funnel Breakdown */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          {language === 'sw' ? 'Mfuatano wa Ugunduzi (Funnel)' : 'Discovery Conversion Funnel'}
        </Text>
        <Text style={styles.sectionSub}>
          Customer progression from search execution to completed order.
        </Text>

        <View style={styles.funnelStepsRow}>
          <View style={styles.funnelStep}>
            <Text style={styles.stepNum}>{funnelReport.totalSearches}</Text>
            <Text style={styles.stepName}>Searches</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>

          <View style={styles.funnelStep}>
            <Text style={styles.stepNum}>{funnelReport.dishImpressions}</Text>
            <Text style={styles.stepName}>Impressions</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>

          <View style={styles.funnelStep}>
            <Text style={styles.stepNum}>{funnelReport.dishClicks}</Text>
            <Text style={styles.stepName}>Dish Clicks</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>

          <View style={styles.funnelStep}>
            <Text style={styles.stepNum}>{funnelReport.restaurantViews}</Text>
            <Text style={styles.stepName}>Store Views</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>

          <View style={styles.funnelStep}>
            <Text style={styles.stepNum}>{funnelReport.cartAdditions}</Text>
            <Text style={styles.stepName}>Cart Adds</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>

          <View style={[styles.funnelStep, styles.funnelStepSuccess]}>
            <Text style={[styles.stepNum, { color: '#15803D' }]}>{funnelReport.ordersCompleted}</Text>
            <Text style={[styles.stepName, { color: '#15803D' }]}>Orders</Text>
          </View>
        </View>

        <View style={styles.funnelInsightBox}>
          <Text style={styles.funnelInsightText}>
            💡 <Text style={{ fontWeight: '700' }}>Primary Friction Point:</Text>{' '}
            {funnelReport.funnelDropoffStage}
          </Text>
        </View>
      </View>

      {/* Ward Filter Pills */}
      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Filter Demand by Ward / Neighborhood:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {wards.map((w) => {
            const isSelected = selectedWard === w;
            return (
              <TouchableOpacity
                key={w}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => setSelectedWard(w)}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {w === 'ALL' ? 'All Wards' : w}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Unmet Food Demand Table / Cards */}
      <View style={styles.gapsList}>
        <Text style={styles.sectionTitle}>
          {language === 'sw' ? 'Mapengo ya Ugavi Yanayohitaji Migahawa' : 'Unmet Food Demand & Supply Gaps'}
        </Text>
        <Text style={styles.sectionSub}>
          Ranked by Supply Gap Index: Demand × (1 + Zero Result Rate) ÷ (Suppliers + 1)
        </Text>

        {filteredGaps.map((gap) => {
          const isCritical = gap.urgencyLevel === 'CRITICAL';
          const isHigh = gap.urgencyLevel === 'HIGH';

          return (
            <View
              key={gap.id}
              style={[
                styles.gapCard,
                isCritical && styles.gapCardCritical,
                isHigh && styles.gapCardHigh,
              ]}
            >
              <View style={styles.gapHeader}>
                <View>
                  <Text style={styles.dishQueryText}>{gap.categoryOrDish}</Text>
                  <Text style={styles.wardText}>📍 {gap.wardName}</Text>
                </View>

                <View
                  style={[
                    styles.urgencyPill,
                    isCritical && styles.urgencyCritical,
                    isHigh && styles.urgencyHigh,
                  ]}
                >
                  <Text
                    style={[
                      styles.urgencyText,
                      isCritical && styles.urgencyTextCritical,
                      isHigh && styles.urgencyTextHigh,
                    ]}
                  >
                    {gap.urgencyLevel} GAP (Index: {gap.supplyGapIndex})
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValText}>{gap.searchDemandScore}</Text>
                  <Text style={styles.metricLabelText}>Searches</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={[styles.metricValText, { color: '#B91C1C' }]}>
                    {gap.zeroResultCount} ({Math.round(gap.zeroResultRate * 100)}%)
                  </Text>
                  <Text style={styles.metricLabelText}>Zero Results</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValText}>{gap.verifiedServingRestaurants}</Text>
                  <Text style={styles.metricLabelText}>Verified Vendors</Text>
                </View>
              </View>

              <View style={styles.actionBox}>
                <Text style={styles.actionLabel}>Target Action:</Text>
                <Text style={styles.actionText}>{gap.recommendedAction}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  demoBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  funnelStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    flexWrap: 'wrap',
    gap: 8,
  },
  funnelStep: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
    backgroundColor: '#F1F5F9',
    minWidth: 70,
  },
  funnelStepSuccess: {
    backgroundColor: '#DCFCE7',
  },
  stepNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepName: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  stepArrow: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '700',
  },
  funnelInsightBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: '#EFF6FF',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  funnelInsightText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  filterSection: {
    gap: Spacing.sm,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  gapsList: {
    gap: Spacing.md,
  },
  gapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  gapCardCritical: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  gapCardHigh: {
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  gapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  dishQueryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  wardText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  urgencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: '#E2E8F0',
  },
  urgencyCritical: {
    backgroundColor: '#FEE2E2',
  },
  urgencyHigh: {
    backgroundColor: '#FEF3C7',
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  urgencyTextCritical: {
    color: '#B91C1C',
  },
  urgencyTextHigh: {
    color: '#B45309',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: '#F8FAFC',
    padding: Spacing.sm,
    borderRadius: Radii.sm,
  },
  metricBox: {
    flex: 1,
  },
  metricValText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricLabelText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  actionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  actionText: {
    fontSize: 12,
    color: '#0F172A',
    flex: 1,
  },
});
