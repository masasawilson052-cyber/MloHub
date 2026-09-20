import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';

export interface DiscoveryAnalyticsData {
  menuFreshnessPercentage: number;
  averageOrderValueTzs: number;
  topOrderedDishes?: { name: string; ordersCount: number }[];
  lostOpportunities: { dishName: string; reason: string }[];
}

export interface AnalyticsPanelProps {
  data: DiscoveryAnalyticsData;
  language?: 'en' | 'sw';
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  data,
  language = 'en',
}) => {
  const topDishes = data.topOrderedDishes || [];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Telemetry Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroLeft}>
          <Ionicons name="stats-chart" size={24} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {language === 'sw' ? 'Takwimu za Uendeshaji' : 'Operational & Demand Telemetry'}
            </Text>
            <Text style={styles.heroSub}>
              {language === 'sw'
                ? 'Takwimu halisi za mauzo na upatikanaji wa vyakula kutoka jikoni kwako.'
                : 'Real-time performance metrics derived directly from your order fulfillment and dish availability.'}
            </Text>
          </View>
        </View>
      </View>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Average Order Value</Text>
          <Text style={styles.kpiValue}>{formatTzs(data.averageOrderValueTzs)}</Text>
          <Text style={styles.kpiSub}>Dine-in, takeaway & delivery combined</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Menu Freshness Score</Text>
          <Text style={[styles.kpiValue, { color: Colors.primary }]}>
            {data.menuFreshnessPercentage}%
          </Text>
          <Text style={styles.kpiSub}>Verified within the last 24–48 hours</Text>
        </View>
      </View>

      {/* Unavailable Items / Stock Alerts Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? 'Vyakula Visivyopatikana' : 'Unavailable Menu Items'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Vyakula vilivyotiwa alama ya kutopatikana kwa wateja hivi sasa'
                : 'Dishes currently marked unavailable or out of stock in your active menu'}
            </Text>
          </View>
        </View>

        <View style={styles.lostList}>
          {data.lostOpportunities.length === 0 ? (
            <Text style={[styles.lostReason, { paddingVertical: Spacing.sm }]}>
              {language === 'sw'
                ? 'Vyakula vyote vinapatikana kwa sasa.'
                : 'All menu dishes are currently active and available to diners.'}
            </Text>
          ) : (
            data.lostOpportunities.map((opp, idx) => (
              <View key={idx} style={styles.lostRow}>
                <View style={styles.lostLeft}>
                  <Text style={styles.lostDishName}>{opp.dishName}</Text>
                  <Text style={styles.lostReason}>{opp.reason}</Text>
                </View>
                <View style={styles.lostBadge}>
                  <Text style={styles.lostBadgeText}>Out of stock</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Top Ordered Dishes Breakdown */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="trending-up-outline" size={20} color={Colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? 'Vyakula Vinavyoagizwa Zaidi' : 'Top Ordered Dishes'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Vyakula maarufu kulingana na idadi ya maagizo yaliyothibitishwa'
                : 'Most frequently ordered items based on fulfilled customer orders'}
            </Text>
          </View>
        </View>

        <View style={styles.topDishesList}>
          {topDishes.length === 0 ? (
            <Text style={[styles.lostReason, { paddingVertical: Spacing.sm }]}>
              {language === 'sw'
                ? 'Bado hakuna maagizo ya vyakula yaliyorekodiwa.'
                : 'No dish orders recorded yet.'}
            </Text>
          ) : (
            topDishes.map((d, index) => (
              <View key={index} style={styles.topDishRow}>
                <View style={styles.rankPill}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={styles.dishNameCol}>
                  <Text style={styles.dishNameText}>{d.name}</Text>
                </View>
                <View style={styles.orderConversionBadge}>
                  <Text style={styles.orderConversionText}>{d.ordersCount} orders</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  heroBanner: {
    backgroundColor: '#FFFDF5',
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
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
    color: '#92400E',
  },
  heroSub: {
    ...Typography.Caption,
    color: '#B45309',
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  kpiCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flex: 1,
    minWidth: 240,
    ...Shadows.sm,
  },
  kpiLabel: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  kpiValue: {
    ...Typography.H1,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginVertical: 4,
  },
  kpiSub: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    color: Colors.textPrimary,
  },
  sectionSub: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  lostList: {
    gap: 8,
  },
  lostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  lostLeft: {
    gap: 2,
  },
  lostDishName: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: '#991B1B',
  },
  lostReason: {
    ...Typography.Caption,
    color: '#B91C1C',
  },
  lostBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  lostBadgeText: {
    ...Typography.Caption,
    color: Colors.white,
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
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
  },
  rankPill: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  rankText: {
    ...Typography.Caption,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  dishNameCol: {
    flex: 1,
  },
  dishNameText: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dishSearchSub: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  orderConversionBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  orderConversionText: {
    ...Typography.Caption,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
});
