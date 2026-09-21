import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface SearchQueryRow {
  query: string;
  count: number;
}

interface ZeroResultRow {
  ward_name: string | null;
  query: string;
  count: number;
}

interface PlatformAnalyticsProps {
  language?: 'en' | 'sw';
}

export const PlatformAnalytics: React.FC<PlatformAnalyticsProps> = ({
  language = 'en',
}) => {
  const [loading, setLoading] = useState(true);
  const [totalSearches, setTotalSearches] = useState(0);
  const [zeroResultCount, setZeroResultCount] = useState(0);
  const [topSearches, setTopSearches] = useState<SearchQueryRow[]>([]);
  const [supplyGaps, setSupplyGaps] = useState<ZeroResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      setLoading(true);
      setError(null);

      if (!isSupabaseConfigured()) {
        setError('Analytics unavailable: Supabase is not configured.');
        setLoading(false);
        return;
      }

      try {
        // Total search count (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [searchRes, zeroRes, topRes, gapRes] = await Promise.all([
          // Total search events
          supabase
            .from('search_analytics_events')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo),

          // Zero-result searches
          supabase
            .from('zero_result_events')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo),

          // Top 10 searched queries
          supabase
            .from('search_analytics_events')
            .select('query')
            .gte('created_at', thirtyDaysAgo)
            .not('query', 'is', null)
            .limit(500),

          // Zero-result events with ward/neighborhood context
          supabase
            .from('zero_result_events')
            .select('query, ward_name')
            .gte('created_at', thirtyDaysAgo)
            .not('query', 'is', null)
            .limit(500),
        ]);

        if (cancelled) return;

        setTotalSearches(searchRes.count ?? 0);
        setZeroResultCount(zeroRes.count ?? 0);

        // Aggregate top queries client-side
        const queryCounts: Record<string, number> = {};
        (searchRes.data || topRes.data || []).forEach((row: any) => {
          const q = (row.query || '').toLowerCase().trim();
          if (q) queryCounts[q] = (queryCounts[q] || 0) + 1;
        });
        const sortedQueries = Object.entries(queryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([query, count]) => ({ query, count }));
        setTopSearches(sortedQueries);

        // Aggregate supply gaps by ward
        const wardGaps: Record<string, { queries: Record<string, number>; ward: string }> = {};
        (gapRes.data || []).forEach((row: any) => {
          const ward = row.ward_name || 'Unknown Area';
          const q = (row.query || '').toLowerCase().trim();
          if (!wardGaps[ward]) wardGaps[ward] = { queries: {}, ward };
          if (q) wardGaps[ward].queries[q] = (wardGaps[ward].queries[q] || 0) + 1;
        });
        const gapList: ZeroResultRow[] = Object.values(wardGaps)
          .map(({ ward, queries }) => {
            const topQuery = Object.entries(queries).sort((a, b) => b[1] - a[1])[0];
            return topQuery
              ? { ward_name: ward, query: topQuery[0], count: topQuery[1] }
              : null;
          })
          .filter(Boolean) as ZeroResultRow[];
        gapList.sort((a, b) => b.count - a.count);
        setSupplyGaps(gapList.slice(0, 6));
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAnalytics();
    return () => { cancelled = true; };
  }, []);

  const zeroResultPct = totalSearches > 0
    ? Math.round((zeroResultCount / totalSearches) * 100)
    : 0;
  const successPct = 100 - zeroResultPct;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.title}>
          {language === 'sw' ? 'Takwimu za Utafutaji na Mahitaji' : 'Food Discovery & Search Demand Analytics'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'sw'
            ? 'Data ya maswali ya utafutaji, matokeo bora, na maeneo yenye upungufu wa wauzaji.'
            : 'Live data from search_analytics_events — dish-level queries, match rates, and neighborhood supply gaps.'}
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading search telemetry…</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={32} color="#b91c1c" />
          <Text style={styles.errorTitle}>Analytics Unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <>
          {/* Discovery Funnel KPIs */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{totalSearches.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>
                {language === 'sw' ? 'Maswali ya Utafutaji' : 'Dish Search Queries'}
              </Text>
              <Text style={styles.kpiSub}>
                {language === 'sw' ? 'Siku 30 zilizopita' : 'Past 30 days'}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: '#0284c7' }]}>{successPct}%</Text>
              <Text style={styles.kpiLabel}>
                {language === 'sw' ? 'Kiwango cha Mafanikio' : 'Search Success Rate'}
              </Text>
              <Text style={styles.kpiSub}>
                {language === 'sw' ? 'Matokeo yaliyopatikana' : 'Queries with results'}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: zeroResultPct > 20 ? '#dc2626' : '#f59e0b' }]}>
                {zeroResultPct}%
              </Text>
              <Text style={styles.kpiLabel}>
                {language === 'sw' ? 'Matokeo Sifuri' : 'Zero-Result Rate'}
              </Text>
              <Text style={styles.kpiSub}>
                {language === 'sw' ? 'Upungufu wa bidhaa' : 'Supply gap signal'}
              </Text>
            </View>
          </View>

          {/* Top Dish Searches */}
          {topSearches.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>
                {language === 'sw' ? 'Maswali Yanayoongoza' : 'Top Searched Dishes'}
              </Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 3 }]}>
                    {language === 'sw' ? 'Swali la Utafutaji' : 'Search Query'}
                  </Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>
                    {language === 'sw' ? 'Idadi' : 'Count'}
                  </Text>
                </View>
                {topSearches.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tdBold, { flex: 3 }]}>{item.query}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                      {item.count.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Ionicons name="search-outline" size={40} color="#94a3b8" />
              <Text style={styles.emptyStateTitle}>
                {language === 'sw' ? 'Hakuna Data ya Utafutaji' : 'No Search Data Yet'}
              </Text>
              <Text style={styles.emptyStateText}>
                {language === 'sw'
                  ? 'Data itaonekana baada ya wateja kuanza kutumia mfumo.'
                  : 'Search analytics will appear here once customers start searching on the platform.'}
              </Text>
            </View>
          )}

          {/* Supply vs Demand Gaps */}
          {supplyGaps.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.gapHeader}>
                <View>
                  <Text style={styles.cardTitle}>
                    {language === 'sw' ? 'Maeneo yenye Upungufu wa Wauzaji' : 'Neighborhood Supply vs Demand Gaps'}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {language === 'sw'
                      ? 'Utafutaji usiopatikana kwa eneo — fursa za uuzaji.'
                      : 'Zero-result searches by ward — vendor recruitment opportunities.'}
                  </Text>
                </View>
                <View style={styles.onboardingOpportunityPill}>
                  <Text style={styles.opportunityText}>Vendor Recruitment</Text>
                </View>
              </View>

              <View style={styles.gapGrid}>
                {supplyGaps.map((gap, idx) => (
                  <View key={idx} style={styles.gapCard}>
                    <View style={styles.gapTop}>
                      <Text style={styles.gapNeighborhood}>{gap.ward_name || 'Unknown'}</Text>
                      <View style={styles.demandPill}>
                        <Text style={styles.demandScoreText}>{gap.count} misses</Text>
                      </View>
                    </View>
                    <Text style={styles.gapDish}>
                      {language === 'sw' ? 'Mahitaji yasiyofikiwa: ' : 'Unmet demand: '}
                      {gap.query}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
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
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: Spacing.sm,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b91c1c',
  },
  errorText: {
    fontSize: 13,
    color: '#7f1d1d',
    textAlign: 'center',
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
    textTransform: 'capitalize',
  },
  td: {
    fontSize: 12,
    color: '#475569',
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
    minWidth: 240,
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
    textTransform: 'capitalize',
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
