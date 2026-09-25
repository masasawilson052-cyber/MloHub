import React, { useEffect, useState } from 'react';
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
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { PlatformSettingsRepository } from '../../repositories/platformSettings.repository';

import { useTheme } from '../../context/ThemeContext';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

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
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [freshnessFilter, setFreshnessFilter] = useState<'ALL' | 'FRESH' | 'AGING' | 'STALE' | 'NO_CATALOG'>('ALL');
  const [notifiedRestId, setNotifiedRestId] = useState<string | null>(null);
  const [menuMetrics, setMenuMetrics] = useState<Record<string, { activeCount: number; lastUpdated?: string }>>({});
  const [operationalSettings, setOperationalSettings] = useState({
    freshDays: 7,
    recentDays: 14,
    staleDays: 30,
  });

  useEffect(() => {
    let active = true;
    PlatformSettingsRepository.getOperationalSettings()
      .then((settings) => {
        if (active) {
          setOperationalSettings({
            freshDays: settings.freshDays || 7,
            recentDays: settings.recentDays || 14,
            staleDays: settings.staleDays || 30,
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to load operational settings in VerificationCenter:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadMenuCounts = async () => {
      if (!isSupabaseConfigured()) return;
      const { data, error } = await supabase.rpc('get_restaurant_menu_counts');
      if (!error && active) {
        setMenuMetrics((data || []).reduce((result: Record<string, { activeCount: number; lastUpdated?: string }>, row: { restaurant_id: string; active_menu_count: number; last_menu_update?: string }) => {
          result[row.restaurant_id] = { activeCount: Number(row.active_menu_count || 0), lastUpdated: row.last_menu_update };
          return result;
        }, {}));
      }
    };
    loadMenuCounts();
    return () => { active = false; };
  }, [restaurants]);

  // Compute freshness classification for each restaurant
  const classifiedRestaurants = restaurants.map((r) => {
    const metrics = menuMetrics[r.id];
    const updated = metrics?.lastUpdated ? new Date(metrics.lastUpdated).getTime() : new Date(r.createdAt).getTime();
    const daysSince = Math.floor((Date.now() - updated) / (1000 * 60 * 60 * 24));
    const menuCount = metrics?.activeCount ?? 0;

    let status: 'FRESH' | 'RECENT' | 'AGING' | 'STALE' | 'NO_CATALOG' = 'FRESH';
    if (menuCount === 0) {
      status = 'NO_CATALOG';
    } else if (daysSince > operationalSettings.staleDays) {
      status = 'STALE';
    } else if (daysSince > operationalSettings.recentDays) {
      status = 'AGING';
    } else if (daysSince > operationalSettings.freshDays) {
      status = 'RECENT';
    }

    return {
      restaurant: r,
      daysSince,
      status,
      menuCount,
    };
  });

  const noCatalogCount = classifiedRestaurants.filter((c) => c.status === 'NO_CATALOG').length;
  const freshCount = classifiedRestaurants.filter((c) => c.status === 'FRESH' || c.status === 'RECENT').length;
  const agingCount = classifiedRestaurants.filter((c) => c.status === 'AGING').length;
  const staleCount = classifiedRestaurants.filter((c) => c.status === 'STALE').length;

  const filtered = classifiedRestaurants.filter((c) => {
    if (freshnessFilter === 'FRESH') return c.status === 'FRESH' || c.status === 'RECENT';
    if (freshnessFilter === 'AGING') return c.status === 'AGING';
    if (freshnessFilter === 'STALE') return c.status === 'STALE';
    if (freshnessFilter === 'NO_CATALOG') return c.status === 'NO_CATALOG';
    return true;
  });

  const spotsWithCatalog = classifiedRestaurants.filter((c) => c.status !== 'NO_CATALOG');
  const freshCatalogPct = spotsWithCatalog.length > 0
    ? Math.round((freshCount / spotsWithCatalog.length) * 100)
    : 0;


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
          Monitors when each restaurant catalog was last updated.
        </Text>
      </View>

      {/* Freshness Health KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiNumber}>{freshCatalogPct}%</Text>
          <Text style={styles.kpiLabel}>Catalogs Updated &lt; {operationalSettings.recentDays} Days</Text>
          <Text style={styles.kpiSub}>Restaurant-level catalog recency</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNumber, { color: colors.success }]}>{freshCount}</Text>
          <Text style={styles.kpiLabel}>Fresh Spots (&lt; {operationalSettings.freshDays} Days)</Text>
          <Text style={styles.kpiSub}>Catalog updated recently</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNumber, { color: colors.warning }]}>{agingCount}</Text>
          <Text style={styles.kpiLabel}>Aging Spots ({operationalSettings.recentDays}-{operationalSettings.staleDays} Days)</Text>
          <Text style={styles.kpiSub}>Due for review</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={[styles.kpiNumber, { color: colors.danger }]}>{staleCount}</Text>
          <Text style={styles.kpiLabel}>Stale Spots (&gt; {operationalSettings.staleDays} Days)</Text>
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
        <TouchableOpacity
          style={[styles.filterPill, freshnessFilter === 'NO_CATALOG' && styles.filterPillActive]}
          onPress={() => setFreshnessFilter('NO_CATALOG')}
        >
          <Text style={[styles.filterPillText, freshnessFilter === 'NO_CATALOG' && styles.filterPillTextActive]}>
            No Catalog ({noCatalogCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Spots List */}
      <View style={styles.listContainer}>
        {filtered.map((item) => {
          const isNoCatalog = item.status === 'NO_CATALOG';
          const isStale = item.status === 'STALE';
          const isAging = item.status === 'AGING';
          const isFresh = item.status === 'FRESH' || item.status === 'RECENT';

          const badgeBg = isNoCatalog ? colors.surfaceInteractive : isStale ? '#fee2e2' : isAging ? '#fef3c7' : '#dcfce7';
          const badgeColor = isNoCatalog ? colors.textSecondary : isStale ? '#991b1b' : isAging ? '#92400e' : '#166534';

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
                  <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                    {isNoCatalog ? 'NO CATALOG' : item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.spotMetrics}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Last Catalog Verification:</Text>
                  <Text style={styles.metricValue}>
                    {isNoCatalog ? 'No dishes uploaded' : item.daysSince === 0 ? 'Today' : `${item.daysSince} days ago`}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Dishes Listed:</Text>
                  <Text style={styles.metricValue}>
                    {item.menuCount} dishes
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground,
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
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
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
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  kpiNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: colors.textSecondary,
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
  listContainer: {
    gap: Spacing.md,
  },
  spotCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },
  spotSub: {
    fontSize: 12,
    color: colors.textSecondary,
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
    backgroundColor: colors.appBackground,
    padding: Spacing.sm,
    borderRadius: Radii.md,
  },
  metricItem: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
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
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  remindBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
});
let styles = createStyles(lightColors);
