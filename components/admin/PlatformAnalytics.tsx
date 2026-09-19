import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { runtimeConfig } from '../../lib/runtimeConfig';

interface PlatformAnalyticsProps {
  language?: 'en' | 'sw';
}

export const PlatformAnalytics: React.FC<PlatformAnalyticsProps> = ({
  language = 'en',
}) => {
  if (!runtimeConfig.isDemo) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerArea}>
          <Text style={styles.title}>
            {language === 'sw' ? 'Takwimu za Mfumo' : 'Platform Telemetry & Search Analytics'}
          </Text>
          <Text style={styles.subtitle}>
            Analysis of dish-level search queries, Swahili/English synonym performance, and supply gaps across Dar es Salaam.
          </Text>
        </View>

        <View style={styles.emptyStateCard}>
          <Ionicons name="bar-chart-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyStateTitle}>Search Telemetry Unavailable</Text>
          <Text style={styles.emptyStateText}>
            Production search query metrics, synonym match rates, and neighborhood demand analytics require live event-stream ingestion (scheduled for Pack 4). Fabricated analytics are strictly disabled in {runtimeConfig.environmentLabel}.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const topSearches = [
    { query: 'Biryani ya Kuku', count: 1420, growth: '+28%', synonymMatched: 'Chicken Biryani' },
    { query: 'Supu ya Ng\'ombe & Chapati', count: 1180, growth: '+15%', synonymMatched: 'Beef Soup' },
    { query: 'Chips Mayai / Zege', count: 960, growth: '+12%', synonymMatched: 'French Fries Omelette' },
    { query: 'Nyama Choma & Ndizi', count: 870, growth: '+22%', synonymMatched: 'Grilled Meat BBQ' },
    { query: 'Samaki wa Kupaka', count: 640, growth: '+9%', synonymMatched: 'Coconut Fish' },
  ];

  const supplyGaps = [
    { neighborhood: 'Kariakoo', requestedDish: 'Healthy Breakfast / Supu', demandScore: 92, vendorCount: 1 },
    { neighborhood: 'Masaki', requestedDish: 'Authentic Local Pilau / Biryani', demandScore: 88, vendorCount: 2 },
    { neighborhood: 'Mikocheni B', requestedDish: 'Late Night Mishkaki & BBQ', demandScore: 81, vendorCount: 2 },
    { neighborhood: 'Sinza', requestedDish: 'Fresh Seafood / Pweza', demandScore: 74, vendorCount: 1 },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.title}>
          {language === 'sw' ? 'Takwimu za Utafutaji na Mahitaji' : 'Food Discovery & Search Demand Analytics'}
        </Text>
        <Text style={styles.subtitle}>
          Analysis of dish-level search queries, Swahili/English synonym performance, and supply gaps across Dar es Salaam.
        </Text>
      </View>

      {/* Discovery Funnel KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>12,480</Text>
          <Text style={styles.kpiLabel}>Dish Search Queries</Text>
          <Text style={styles.kpiSub}>Past 30 days</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#0284c7' }]}>96.4%</Text>
          <Text style={styles.kpiLabel}>Synonym Match Rate</Text>
          <Text style={styles.kpiSub}>Swahili/English engine</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>24.8%</Text>
          <Text style={styles.kpiLabel}>Search-to-Order CTR</Text>
          <Text style={styles.kpiSub}>Direct food conversion</Text>
        </View>
      </View>

      {/* Top Dish Searches */}
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Top Searched Dishes & Synonyms</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>Search Query</Text>
            <Text style={[styles.th, { flex: 2 }]}>Engine Synonym</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Volume</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Growth</Text>
          </View>
          {topSearches.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tdBold, { flex: 2 }]}>{item.query}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{item.synonymMatched}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{item.count}</Text>
              <Text style={[styles.tdGrowth, { flex: 1, textAlign: 'right' }]}>{item.growth}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Supply vs Demand Gaps */}
      <View style={styles.sectionCard}>
        <View style={styles.gapHeader}>
          <View>
            <Text style={styles.cardTitle}>Neighborhood Supply vs Demand Gaps</Text>
            <Text style={styles.cardSubtitle}>
              Identifies neighborhoods where customers frequently search for specific foods but few vendors are onboarded.
            </Text>
          </View>
          <View style={styles.onboardingOpportunityPill}>
            <Text style={styles.opportunityText}>Vendor Recruitment Focus</Text>
          </View>
        </View>

        <View style={styles.gapGrid}>
          {supplyGaps.map((gap, idx) => (
            <View key={idx} style={styles.gapCard}>
              <View style={styles.gapTop}>
                <Text style={styles.gapNeighborhood}>{gap.neighborhood}</Text>
                <View style={styles.demandPill}>
                  <Text style={styles.demandScoreText}>Demand: {gap.demandScore}/100</Text>
                </View>
              </View>
              <Text style={styles.gapDish}>Unmet Demand: {gap.requestedDish}</Text>
              <View style={styles.gapFooter}>
                <Ionicons name="storefront-outline" size={13} color="#64748b" />
                <Text style={styles.gapVendors}>Only {gap.vendorCount} vendor(s) currently active</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  headerArea: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Shadows.sm,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  table: {
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  tdBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  td: {
    fontSize: 12,
    color: '#475569',
  },
  tdGrowth: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  gapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  onboardingOpportunityPill: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  opportunityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
  },
  gapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gapCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.md,
    gap: 6,
  },
  gapTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gapNeighborhood: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  demandPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  demandScoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  gapDish: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  gapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  gapVendors: {
    fontSize: 11,
    color: '#64748b',
  },
  emptyStateCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: Spacing.xs,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 18,
  },
});
