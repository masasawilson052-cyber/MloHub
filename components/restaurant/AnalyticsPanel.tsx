import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import {
  AnalyticsService,
  RestaurantAnalyticsReport,
} from '../../services/AnalyticsService';
import {
  Order,
  Payment,
  MenuItem,
  RestaurantBranch,
  RestaurantFinancialSummary,
} from '../../types/domain';

let colors: ThemeColors = lightColors;

export type AnalyticsDatePreset = 'TODAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM';

export interface DiscoveryAnalyticsData {
  menuFreshnessPercentage: number;
  averageOrderValueTzs: number;
  topOrderedDishes?: { name: string; ordersCount: number; revenueTzs?: number }[];
  lostOpportunities: { dishName: string; reason: string }[];
  hasOrderData?: boolean;
  hasDiscoveryData?: boolean;
  operational?: RestaurantAnalyticsReport['operational'];
  commercial?: RestaurantAnalyticsReport['commercial'];
  discovery?: RestaurantAnalyticsReport['discovery'];
  lowConvertingDishes?: RestaurantAnalyticsReport['lowConvertingDishes'];
  unavailableItemDemand?: RestaurantAnalyticsReport['unavailableItemDemand'];
  branchPerformance?: RestaurantAnalyticsReport['branchPerformance'];
}

export interface AnalyticsPanelProps {
  data: DiscoveryAnalyticsData;
  restaurantId?: string;
  orders?: Order[];
  payments?: Payment[];
  menuItems?: MenuItem[];
  branches?: RestaurantBranch[];
  financialSummary?: RestaurantFinancialSummary | null;
  language?: 'en' | 'sw';
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  data,
  restaurantId = '',
  orders,
  payments,
  menuItems,
  branches,
  financialSummary,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('30_DAYS');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (datePreset === 'TODAY') {
      return { fromDate: todayStart.toISOString(), toDate: now.toISOString() };
    }
    if (datePreset === '7_DAYS') {
      const from = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { fromDate: from.toISOString(), toDate: now.toISOString() };
    }
    if (datePreset === '30_DAYS') {
      const from = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { fromDate: from.toISOString(), toDate: now.toISOString() };
    }
    return {
      fromDate: customFrom ? new Date(customFrom).toISOString() : null,
      toDate: customTo ? new Date(customTo).toISOString() : null,
    };
  }, [datePreset, customFrom, customTo]);

  const report: RestaurantAnalyticsReport = useMemo(() => {
    if (orders !== undefined || menuItems !== undefined || branches !== undefined) {
      return AnalyticsService.computeRestaurantAnalytics({
        restaurantId,
        orders: orders || [],
        payments: payments || [],
        menuItems: menuItems || [],
        branches: branches || [],
        financialSummary: financialSummary || null,
        fromDate,
        toDate,
      });
    }

    const hasOrders =
      data.hasOrderData ??
      ((data.topOrderedDishes && data.topOrderedDishes.length > 0) || data.averageOrderValueTzs > 0);

    return {
      hasOrderData: Boolean(hasOrders),
      hasDiscoveryData: Boolean(data.hasDiscoveryData),
      menuFreshnessPercentage: data.menuFreshnessPercentage,
      averageOrderValueTzs: data.averageOrderValueTzs,
      operational: data.operational || {
        totalOrders: hasOrders ? (data.topOrderedDishes || []).reduce((s, d) => s + d.ordersCount, 0) : null,
        acceptanceRatePct: null,
        cancellationRatePct: null,
        avgPrepTimeMinutes: null,
        avgAcceptanceTimeMinutes: null,
        lateOrderRatePct: null,
        soldOutItemRatePct: null,
      },
      commercial: data.commercial || {
        grossFoodSalesTzs: hasOrders && data.averageOrderValueTzs > 0 ? data.averageOrderValueTzs : null,
        netSalesTzs: null,
        averageOrderValueTzs: hasOrders && data.averageOrderValueTzs > 0 ? data.averageOrderValueTzs : null,
        deliveryOrdersCount: 0,
        pickupOrdersCount: 0,
        dineInOrdersCount: 0,
        deliverySharePct: null,
        pickupSharePct: null,
        dineInSharePct: null,
      },
      discovery: data.discovery || {
        searchImpressions: null,
        restaurantViews: null,
        conversionRatePct: null,
      },
      topOrderedDishes: data.topOrderedDishes || [],
      lowConvertingDishes: data.lowConvertingDishes || [],
      unavailableItemDemand:
        data.unavailableItemDemand ||
        (data.lostOpportunities || []).map((l) => ({
          dishName: l.dishName,
          reason: l.reason,
        })),
      lostOpportunities: data.lostOpportunities || [],
      branchPerformance: data.branchPerformance || [],
    };
  }, [
    restaurantId,
    orders,
    payments,
    menuItems,
    branches,
    financialSummary,
    fromDate,
    toDate,
    data,
  ]);

  const fmtPct = (v: number | null | undefined) =>
    AnalyticsService.formatMetric(v, (n) => `${n}%`);
  const fmtMins = (v: number | null | undefined) =>
    AnalyticsService.formatMetric(v, (n) => `${n} min`);
  const fmtMoney = (v: number | null | undefined) =>
    AnalyticsService.formatMetric(v, (n) => formatTzs(n));
  const fmtCount = (v: number | null | undefined) =>
    AnalyticsService.formatMetric(v, (n) => n.toLocaleString());

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Telemetry Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroLeft}>
          <Ionicons name="stats-chart" size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {language === 'sw'
                ? 'Takwimu za Uendeshaji na Biashara'
                : 'Operational, Commercial & Demand Telemetry'}
            </Text>
            <Text style={styles.heroSub}>
              {language === 'sw'
                ? 'Takwimu halisi kutoka kwenye maagizo, malipo, na utafutaji wa wateja bila kubuni namba.'
                : 'Authoritative performance intelligence derived strictly from verified orders, ledger snapshots, and discovery events.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Date Filter Bar */}
      <View style={styles.filterCard}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>
            {language === 'sw' ? 'Kipindi cha Takwimu:' : 'Date Window:'}
          </Text>
          <View style={styles.presetPills}>
            {(
              [
                { id: 'TODAY', label: language === 'sw' ? 'Leo' : 'Today' },
                { id: '7_DAYS', label: language === 'sw' ? 'Siku 7' : '7 days' },
                { id: '30_DAYS', label: language === 'sw' ? 'Siku 30' : '30 days' },
                { id: 'CUSTOM', label: language === 'sw' ? 'Maalum' : 'Custom' },
              ] as { id: AnalyticsDatePreset; label: string }[]
            ).map((preset) => {
              const active = datePreset === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.presetPill, active && styles.presetPillActive]}
                  onPress={() => setDatePreset(preset.id)}
                >
                  <Text style={[styles.presetPillText, active && styles.presetPillTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {datePreset === 'CUSTOM' && (
          <View style={styles.customDateRow}>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateInputLabel}>From (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="2026-09-01"
                placeholderTextColor={colors.textMuted}
                value={customFrom}
                onChangeText={setCustomFrom}
              />
            </View>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateInputLabel}>To (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="2026-09-28"
                placeholderTextColor={colors.textMuted}
                value={customTo}
                onChangeText={setCustomTo}
              />
            </View>
          </View>
        )}
      </View>

      {/* 1. OPERATIONAL METRICS */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="speedometer-outline" size={20} color={colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? '1. Uendeshaji wa Jiko na Oda' : '1. Operational Performance'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Kasi ya kukubali oda, uandaaji, na ufanisi wa upatikanaji wa menyu'
                : 'Order volume, acceptance velocity, prep discipline, and stock reliability'}
            </Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Orders</Text>
            <Text style={styles.kpiValue}>{fmtCount(report.operational.totalOrders)}</Text>
            <Text style={styles.kpiSub}>Orders in selected window</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Acceptance Rate</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {fmtPct(report.operational.acceptanceRatePct)}
            </Text>
            <Text style={styles.kpiSub}>Accepted vs total incoming</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Cancellation Rate</Text>
            <Text style={[styles.kpiValue, { color: colors.danger }]}>
              {fmtPct(report.operational.cancellationRatePct)}
            </Text>
            <Text style={styles.kpiSub}>Cancelled or rejected orders</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Average Prep Time</Text>
            <Text style={styles.kpiValue}>{fmtMins(report.operational.avgPrepTimeMinutes)}</Text>
            <Text style={styles.kpiSub}>Target kitchen preparation time</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Acceptance Time</Text>
            <Text style={styles.kpiValue}>
              {fmtMins(report.operational.avgAcceptanceTimeMinutes)}
            </Text>
            <Text style={styles.kpiSub}>Order paid to kitchen acceptance</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Late Order Rate</Text>
            <Text style={[styles.kpiValue, { color: colors.warning }]}>
              {fmtPct(report.operational.lateOrderRatePct)}
            </Text>
            <Text style={styles.kpiSub}>Exceeded promised prep window</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Sold-Out Item Rate</Text>
            <Text style={styles.kpiValue}>{fmtPct(report.operational.soldOutItemRatePct)}</Text>
            <Text style={styles.kpiSub}>Dishes currently marked 86</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Menu Freshness Score</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {report.menuFreshnessPercentage}%
            </Text>
            <Text style={styles.kpiSub}>Verified within last 7 days</Text>
          </View>
        </View>
      </View>

      {/* 2. COMMERCIAL PERFORMANCE */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="cash-outline" size={20} color={colors.success} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? '2. Utendaji wa Kibiashara' : '2. Commercial Performance'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Mauzo ghafi, mapato halisi, wastani wa oda, na mgawanyo wa huduma'
                : 'Gross food sales, net payable revenue, average order value, and fulfillment mix'}
            </Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Gross Food Sales</Text>
            <Text style={styles.kpiValue}>{fmtMoney(report.commercial.grossFoodSalesTzs)}</Text>
            <Text style={styles.kpiSub}>Before platform commission</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Net Sales</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {fmtMoney(report.commercial.netSalesTzs)}
            </Text>
            <Text style={styles.kpiSub}>Net restaurant entitlement</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Average Order Value</Text>
            <Text style={styles.kpiValue}>{fmtMoney(report.commercial.averageOrderValueTzs)}</Text>
            <Text style={styles.kpiSub}>Completed & paid orders</Text>
          </View>
        </View>

        <View style={styles.subBox}>
          <Text style={styles.subBoxTitle}>
            {language === 'sw'
              ? 'Mgawanyo wa Huduma (Delivery vs Pickup vs Dine-in)'
              : 'Fulfillment Channel Mix (Delivery vs Pickup vs Dine-in)'}
          </Text>
          {!report.hasOrderData ? (
            <Text style={styles.notEnoughDataText}>{AnalyticsService.ZERO_DATA_LABEL}</Text>
          ) : (
            <View style={styles.channelRow}>
              <View style={styles.channelItem}>
                <Text style={styles.channelLabel}>Delivery</Text>
                <Text style={styles.channelValue}>
                  {fmtPct(report.commercial.deliverySharePct)} ({report.commercial.deliveryOrdersCount})
                </Text>
              </View>
              <View style={styles.channelItem}>
                <Text style={styles.channelLabel}>Pickup</Text>
                <Text style={styles.channelValue}>
                  {fmtPct(report.commercial.pickupSharePct)} ({report.commercial.pickupOrdersCount})
                </Text>
              </View>
              <View style={styles.channelItem}>
                <Text style={styles.channelLabel}>Dine-in</Text>
                <Text style={styles.channelValue}>
                  {fmtPct(report.commercial.dineInSharePct)} ({report.commercial.dineInOrdersCount})
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 3. DISCOVERY & CONVERSION */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="compass-outline" size={20} color={colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw'
                ? '3. Ugunduzi na Ushawishi wa Wateja'
                : '3. Discovery & Conversion'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Uonekanaji kwenye utafutaji, kutembelewa kwa ukurasa, na ubadilishaji kuwa oda'
                : 'Search impressions, restaurant profile views, conversion rate, and missed searches'}
            </Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Search Impressions</Text>
            <Text style={styles.kpiValue}>{fmtCount(report.discovery.searchImpressions)}</Text>
            <Text style={styles.kpiSub}>Appearances in diner search</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Restaurant Views</Text>
            <Text style={styles.kpiValue}>{fmtCount(report.discovery.restaurantViews)}</Text>
            <Text style={styles.kpiSub}>Menu & dish detail opens</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Conversion Rate (Views → Orders)</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {fmtPct(report.discovery.conversionRatePct)}
            </Text>
            <Text style={styles.kpiSub}>Views converted into orders</Text>
          </View>
        </View>

        <View style={styles.subBox}>
          <Text style={styles.subBoxTitle}>
            {language === 'sw'
              ? 'Fursa Zilizopotea (Utafutaji Bila Oda)'
              : 'Lost Opportunities (Zero-Order Searches & Stockouts)'}
          </Text>
          {report.lostOpportunities.length === 0 ? (
            <Text style={styles.notEnoughDataText}>{AnalyticsService.ZERO_DATA_LABEL}</Text>
          ) : (
            <View style={styles.lostList}>
              {report.lostOpportunities.map((opp, idx) => (
                <View key={idx} style={styles.lostRow}>
                  <View style={styles.lostLeft}>
                    <Text style={styles.lostDishName}>{opp.dishName}</Text>
                    <Text style={styles.lostReason}>{opp.reason}</Text>
                  </View>
                  <View style={styles.lostBadge}>
                    <Text style={styles.lostBadgeText}>Missed Demand</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* 4. MENU PERFORMANCE */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? '4. Utendaji wa Menyu' : '4. Menu Performance'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Vyakula 5 bora, vyakula vyenye ubadilishaji mdogo, na mahitaji ya vyakula vilivyoisha'
                : 'Top 5 selling dishes, low-converting dishes, and unavailable-item demand'}
            </Text>
          </View>
        </View>

        {/* Top 5 Selling Dishes */}
        <Text style={styles.subSectionHeading}>
          {language === 'sw' ? 'Vyakula 5 Vinavyoongoza kwa Mauzo' : 'Top 5 Selling Dishes'}
        </Text>
        <View style={styles.topDishesList}>
          {report.topOrderedDishes.length === 0 ? (
            <Text style={styles.notEnoughDataText}>{AnalyticsService.ZERO_DATA_LABEL}</Text>
          ) : (
            report.topOrderedDishes.map((d, index) => (
              <View key={index} style={styles.topDishRow}>
                <View style={styles.rankPill}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={styles.dishNameCol}>
                  <Text style={styles.dishNameText}>{d.name}</Text>
                  {typeof d.revenueTzs === 'number' && d.revenueTzs > 0 && (
                    <Text style={styles.dishSearchSub}>{formatTzs(d.revenueTzs)}</Text>
                  )}
                </View>
                <View style={styles.orderConversionBadge}>
                  <Text style={styles.orderConversionText}>{d.ordersCount} orders</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Low-Converting Dishes */}
        <Text style={[styles.subSectionHeading, { marginTop: Spacing.md }]}>
          {language === 'sw'
            ? 'Vyakula Vyenye Ubadilishaji Mdogo (Views Nyingi, Oda Chache)'
            : 'Low-Converting Dishes (High Views, Low Orders)'}
        </Text>
        <View style={styles.topDishesList}>
          {report.lowConvertingDishes.length === 0 ? (
            <Text style={styles.notEnoughDataText}>{AnalyticsService.ZERO_DATA_LABEL}</Text>
          ) : (
            report.lowConvertingDishes.map((d, idx) => (
              <View key={idx} style={styles.topDishRow}>
                <View style={styles.dishNameCol}>
                  <Text style={styles.dishNameText}>{d.name}</Text>
                  <Text style={styles.dishSearchSub}>
                    {d.viewsCount} views • {d.ordersCount} orders
                  </Text>
                </View>
                <View style={[styles.orderConversionBadge, { backgroundColor: colors.warningSoft }]}>
                  <Text style={[styles.orderConversionText, { color: colors.warning }]}>
                    {d.conversionPct}% conv
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Unavailable-Item Demand */}
        <Text style={[styles.subSectionHeading, { marginTop: Spacing.md }]}>
          {language === 'sw'
            ? 'Mahitaji ya Vyakula Visivyopatikana (86 / Sold-Out)'
            : 'Unavailable-Item Demand (86 / Sold-Out)'}
        </Text>
        <View style={styles.lostList}>
          {report.unavailableItemDemand.length === 0 ? (
            <Text style={styles.notEnoughDataText}>{AnalyticsService.ZERO_DATA_LABEL}</Text>
          ) : (
            report.unavailableItemDemand.map((item, idx) => (
              <View key={idx} style={styles.lostRow}>
                <View style={styles.lostLeft}>
                  <Text style={styles.lostDishName}>{item.dishName}</Text>
                  <Text style={styles.lostReason}>{item.reason}</Text>
                </View>
                <View style={styles.lostBadge}>
                  <Text style={styles.lostBadgeText}>
                    {item.missedDemandCount && item.missedDemandCount > 0
                      ? `${item.missedDemandCount} missed views`
                      : 'Out of stock'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* 5. BRANCH PERFORMANCE */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="git-branch-outline" size={20} color={colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw'
                ? '5. Utendaji kwa Kila Tawi'
                : '5. Branch Performance (Multi-Branch)'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Mauzo, kasi ya uandaaji, na kiwango cha kughairiwa kwa kila tawi'
                : 'Sales volume, fulfillment speed, and cancellation rate segmented by branch'}
            </Text>
          </View>
        </View>

        {report.branchPerformance.length === 0 ? (
          <Text style={styles.notEnoughDataText}>{AnalyticsService.ZERO_DATA_LABEL}</Text>
        ) : (
          <View style={styles.branchList}>
            {report.branchPerformance.map((branch) => (
              <View key={branch.branchId} style={styles.branchRow}>
                <View style={styles.branchInfo}>
                  <Text style={styles.branchName}>{branch.branchName}</Text>
                  <Text style={styles.branchSub}>
                    {branch.ordersCount > 0
                      ? `${branch.ordersCount} orders in period`
                      : AnalyticsService.ZERO_DATA_LABEL}
                  </Text>
                </View>
                <View style={styles.branchMetricsRow}>
                  <View style={styles.branchMetricCol}>
                    <Text style={styles.branchMetricLabel}>Sales</Text>
                    <Text style={styles.branchMetricValue}>{fmtMoney(branch.salesTzs)}</Text>
                  </View>
                  <View style={styles.branchMetricCol}>
                    <Text style={styles.branchMetricLabel}>Prep Speed</Text>
                    <Text style={styles.branchMetricValue}>{fmtMins(branch.avgPrepMinutes)}</Text>
                  </View>
                  <View style={styles.branchMetricCol}>
                    <Text style={styles.branchMetricLabel}>Cancel Rate</Text>
                    <Text style={styles.branchMetricValue}>
                      {fmtPct(branch.cancellationRatePct)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: Spacing.md,
      maxWidth: 1000,
      width: '100%',
      alignSelf: 'center',
      gap: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    heroBanner: {
      backgroundColor: colors.warningSoft,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.warning,
      ...Shadows.sm,
    },
    heroLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    heroTitle: {
      ...Typography.H3,
      fontWeight: '800',
      color: colors.warning,
    },
    heroSub: {
      ...Typography.Caption,
      color: colors.warning,
      marginTop: 2,
    },
    filterCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.divider,
      gap: Spacing.sm,
      ...Shadows.sm,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    filterLabel: {
      ...Typography.BodyMedium,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    presetPills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    presetPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    presetPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetPillText: {
      ...Typography.Caption,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    presetPillTextActive: {
      color: colors.onPrimary,
    },
    customDateRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      flexWrap: 'wrap',
      marginTop: Spacing.xs,
    },
    dateInputWrap: {
      flex: 1,
      minWidth: 160,
      gap: 4,
    },
    dateInputLabel: {
      ...Typography.Caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    dateInput: {
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: Radii.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.textPrimary,
      ...Typography.Body,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    kpiCard: {
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.divider,
      flex: 1,
      minWidth: 200,
    },
    kpiLabel: {
      ...Typography.Caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    kpiValue: {
      ...Typography.H2,
      fontWeight: '800',
      color: colors.textPrimary,
      marginVertical: 4,
    },
    kpiSub: {
      ...Typography.Caption,
      color: colors.textMuted,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.divider,
      ...Shadows.sm,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.H3,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sectionSub: {
      ...Typography.Caption,
      color: colors.textSecondary,
      marginTop: 1,
    },
    subSectionHeading: {
      ...Typography.BodyMedium,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    subBox: {
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      gap: Spacing.sm,
    },
    subBoxTitle: {
      ...Typography.BodyMedium,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    notEnoughDataText: {
      ...Typography.Caption,
      color: colors.textMuted,
      fontStyle: 'italic',
      paddingVertical: Spacing.xs,
    },
    channelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    channelItem: {
      flex: 1,
      minWidth: 140,
      backgroundColor: colors.surfaceInteractive,
      padding: Spacing.sm,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    channelLabel: {
      ...Typography.Caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    channelValue: {
      ...Typography.BodyMedium,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 2,
    },
    lostList: {
      gap: 8,
    },
    lostRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.dangerSoft,
      padding: Spacing.sm,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    lostLeft: {
      gap: 2,
      flex: 1,
    },
    lostDishName: {
      ...Typography.BodyMedium,
      fontWeight: '700',
      color: colors.danger,
    },
    lostReason: {
      ...Typography.Caption,
      color: colors.danger,
    },
    lostBadge: {
      backgroundColor: colors.danger,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radii.full,
    },
    lostBadgeText: {
      ...Typography.Caption,
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 11,
    },
    topDishesList: {
      gap: 8,
    },
    topDishRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.sm,
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.md,
    },
    rankPill: {
      width: 28,
      height: 28,
      borderRadius: Radii.full,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    rankText: {
      ...Typography.Caption,
      fontWeight: '800',
      color: colors.primary,
    },
    dishNameCol: {
      flex: 1,
    },
    dishNameText: {
      ...Typography.BodyMedium,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    dishSearchSub: {
      ...Typography.Caption,
      color: colors.textMuted,
    },
    orderConversionBadge: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radii.full,
    },
    orderConversionText: {
      ...Typography.Caption,
      color: colors.primary,
      fontWeight: '700',
    },
    branchList: {
      gap: Spacing.sm,
    },
    branchRow: {
      backgroundColor: colors.surfaceInteractive,
      padding: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
      gap: Spacing.sm,
    },
    branchInfo: {
      gap: 2,
    },
    branchName: {
      ...Typography.BodyMedium,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    branchSub: {
      ...Typography.Caption,
      color: colors.textSecondary,
    },
    branchMetricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    branchMetricCol: {
      flex: 1,
      minWidth: 120,
    },
    branchMetricLabel: {
      ...Typography.Caption,
      color: colors.textSecondary,
    },
    branchMetricValue: {
      ...Typography.BodyMedium,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
    },
  });

let styles = createStyles(lightColors);
