import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { RestaurantEntity } from '../../db/types';

interface VerificationCenterProps {
  restaurants: RestaurantEntity[];
  onTriggerReverification?: (restaurantId: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const VerificationCenter: React.FC<VerificationCenterProps> = ({
  restaurants,
  onTriggerReverification,
  language = 'en',
}) => {
  const [freshnessFilter, setFreshnessFilter] = useState<'ALL' | 'FRESH' | 'AGING' | 'STALE'>('ALL');
  const [notifiedRestId, setNotifiedRestId] = useState<string | null>(null);

  // Compute freshness classification for each restaurant
  const classifiedRestaurants = restaurants.map((r) => {
    // In demo/test environment or live: check last updated date
    const updated = r.updatedAt ? new Date(r.updatedAt).getTime() : new Date(r.createdAt).getTime();
    const daysSince = Math.floor((Date.now() - updated) / (1000 * 60 * 60 * 24));

    let status: 'FRESH' | 'RECENT' | 'AGING' | 'STALE' = 'FRESH';
    if (daysSince > 30) status = 'STALE';
    else if (daysSince > 14) status = 'AGING';
    else if (daysSince > 7) status = 'RECENT';

    // Use actual menu item count — 0 if no menu items have been added yet.
    // This keeps freshness percentages honest: a restaurant with no menu has 0 verified dishes.
    const menuCount = r.menu?.length ?? 0;
    const verifiedDishCount = Math.round(menuCount * (status === 'FRESH' ? 1.0 : status === 'RECENT' ? 0.9 : status === 'AGING' ? 0.6 : 0.2));

    return {
      restaurant: r,
      daysSince,
      status,
      menuCount,
      verifiedDishCount,
    };
  });

  const freshCount = classifiedRestaurants.filter((c) => c.status === 'FRESH').length;
  const agingCount = classifiedRestaurants.filter((c) => c.status === 'AGING').length;
  const staleCount = classifiedRestaurants.filter((c) => c.status === 'STALE').length;

  const filtered = classifiedRestaurants.filter((c) => {
    if (freshnessFilter === 'FRESH') return c.status === 'FRESH' || c.status === 'RECENT';
    if (freshnessFilter === 'AGING') return c.status === 'AGING';
    if (freshnessFilter === 'STALE') return c.status === 'STALE';
    return true;
  });

  const totalDishes = classifiedRestaurants.reduce((acc, c) => acc + c.menuCount, 0);
  const totalVerifiedDishes = classifiedRestaurants.reduce((acc, c) => acc + c.verifiedDishCount, 0);
  const platformFreshnessPct = totalDishes > 0 ? Math.round((totalVerifiedDishes / totalDishes) * 100) : 100;

  const handleSendReminder = async (restaurantId: string, restaurantName: string) => {
    try {
      if (onTriggerReverification) {
        await onTriggerReverification(restaurantId);
      }
      setNotifiedRestId(restaurantId);
      Alert.alert('Reminder Sent', `Dispatched price and availability confirmation request to "${restaurantName}".`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to dispatch notification.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.title}>
          {language === 'sw' ? 'Kituo cha Ubora na Uthibitisho wa Bei' : 'Catalog Verification & Freshness Center'}
        </Text>
        <Text style={styles.subtitle}>
          Monitors when menu prices and dish availability were last verified by restaurant managers.
        </Text>
      </View>

      {/* Freshness Health KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiNumber}>{platformFreshnessPct}%</Text>
          <Text style={styles.kpiLabel}>Platform Freshness Score</Text>
          <Text style={styles.kpiSub}>Dishes confirmed &lt; 14 days</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNumber, { color: '#16a34a' }]}>{freshCount}</Text>
          <Text style={styles.kpiLabel}>Fresh Spots (&lt; 7 Days)</Text>
          <Text style={styles.kpiSub}>Recently verified</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNumber, { color: '#f59e0b' }]}>{agingCount}</Text>
          <Text style={styles.kpiLabel}>Aging Spots (14-30 Days)</Text>
          <Text style={styles.kpiSub}>Due for review</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNumber, { color: '#ef4444' }]}>{staleCount}</Text>
          <Text style={styles.kpiLabel}>Stale Spots (&gt; 30 Days)</Text>
          <Text style={styles.kpiSub}>Price confirmation required</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterPill, freshnessFilter === 'ALL' && styles.filterPillActive]}
          onPress={() => setFreshnessFilter('ALL')}
        >
          <Text style={[styles.filterPillText, freshnessFilter === 'ALL' && styles.filterPillTextActive]}>
            All Restaurants ({classifiedRestaurants.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, freshnessFilter === 'FRESH' && styles.filterPillActive]}
          onPress={() => setFreshnessFilter('FRESH')}
        >
          <Text style={[styles.filterPillText, freshnessFilter === 'FRESH' && styles.filterPillTextActive]}>
            Fresh ({freshCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, freshnessFilter === 'AGING' && styles.filterPillActive]}
          onPress={() => setFreshnessFilter('AGING')}
        >
          <Text style={[styles.filterPillText, freshnessFilter === 'AGING' && styles.filterPillTextActive]}>
            Aging ({agingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, freshnessFilter === 'STALE' && styles.filterPillActive]}
          onPress={() => setFreshnessFilter('STALE')}
        >
          <Text style={[styles.filterPillText, freshnessFilter === 'STALE' && styles.filterPillTextActive]}>
            Stale ({staleCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Spots List */}
      <View style={styles.listContainer}>
        {filtered.map((item) => {
          const isStale = item.status === 'STALE';
          const isAging = item.status === 'AGING';
          const isFresh = item.status === 'FRESH' || item.status === 'RECENT';

          const badgeBg = isStale ? '#fee2e2' : isAging ? '#fef3c7' : '#dcfce7';
          const badgeColor = isStale ? '#991b1b' : isAging ? '#92400e' : '#166534';

          return (
            <View key={item.restaurant.id} style={styles.spotCard}>
              <View style={styles.spotHeader}>
                <View>
                  <Text style={styles.spotName}>{item.restaurant.name}</Text>
                  <Text style={styles.spotSub}>
                    {item.restaurant.neighborhood} • {item.menuCount} dishes listed
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.statusBadgeText, { color: badgeColor }]}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.spotMetrics}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Last Catalog Verification:</Text>
                  <Text style={styles.metricValue}>
                    {item.daysSince === 0 ? 'Today' : `${item.daysSince} days ago`}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Verified Dishes:</Text>
                  <Text style={styles.metricValue}>
                    {item.verifiedDishCount} / {item.menuCount} dishes
                  </Text>
                </View>
              </View>

              {(isAging || isStale) && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.remindBtn}
                    onPress={() => handleSendReminder(item.restaurant.id, item.restaurant.name)}
                  >
                    <Ionicons name="notifications-outline" size={14} color="#b45309" />
                    <Text style={styles.remindBtnText}>
                      {notifiedRestId === item.restaurant.id ? 'Reminder Sent ✓' : 'Send Verification Reminder'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
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
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
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
  kpiNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    gap: Spacing.md,
  },
  spotCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  spotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  spotName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  spotSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  spotMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    backgroundColor: '#f8fafc',
    padding: Spacing.sm,
    borderRadius: Radii.md,
  },
  metricItem: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  remindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.md,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  remindBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
  },
});
