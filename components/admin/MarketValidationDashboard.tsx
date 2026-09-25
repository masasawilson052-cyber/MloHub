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

import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface MarketValidationDashboardProps {
  language?: 'en' | 'sw';
}

export const MarketValidationDashboard: React.FC<MarketValidationDashboardProps> = ({
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
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
          <Text style={[styles.kpiVal, { color: colors.danger }]}>{criticalGapsCount}</Text>
          <Text style={styles.kpiLabel}>Critical Supply Gaps</Text>
          <Text style={styles.kpiSub}>High demand, near-zero supply</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: colors.warning }]}>{highGapsCount}</Text>
          <Text style={styles.kpiLabel}>High Demand Alerts</Text>
          <Text style={styles.kpiSub}>Frequent zero-result searches</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: colors.success }]}>
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
            <Text style={[styles.stepNum, { color: colors.success }]}>{funnelReport.ordersCompleted}</Text>
            <Text style={[styles.stepName, { color: colors.success }]}>Orders</Text>
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
                  <Text style={[styles.metricValText, { color: colors.danger }]}>
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground,
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
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  demoBadge: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.warning,
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
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSecondary,
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
    backgroundColor: colors.surfaceInteractive,
    minWidth: 70,
  },
  funnelStepSuccess: {
    backgroundColor: colors.successSoft,
  },
  stepNum: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  stepName: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepArrow: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '700',
  },
  funnelInsightBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: colors.infoSoft,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.info,
  },
  funnelInsightText: {
    fontSize: 13,
    color: colors.info,
    lineHeight: 18,
  },
  filterSection: {
    gap: Spacing.sm,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.onPrimary,
  },
  gapsList: {
    gap: Spacing.md,
  },
  gapCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  gapCardCritical: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  gapCardHigh: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
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
    color: colors.textPrimary,
  },
  wardText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  urgencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: colors.divider,
  },
  urgencyCritical: {
    backgroundColor: colors.dangerSoft,
  },
  urgencyHigh: {
    backgroundColor: colors.warningSoft,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  urgencyTextCritical: {
    color: colors.danger,
  },
  urgencyTextHigh: {
    color: colors.warning,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: colors.appBackground,
    padding: Spacing.sm,
    borderRadius: Radii.sm,
  },
  metricBox: {
    flex: 1,
  },
  metricValText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricLabelText: {
    fontSize: 10,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  actionText: {
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1,
  },
});
let styles = createStyles(lightColors);
