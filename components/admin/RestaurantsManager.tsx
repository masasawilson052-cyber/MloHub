import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { RestaurantEntity } from '../../db/types';
import { RestaurantDetailAdmin } from './RestaurantDetailAdmin';

import { useTheme } from '../../context/ThemeContext';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

type RestaurantFilter = 'ALL' | 'LAUNCH_REVIEW' | 'BASIC_SELLER' | 'VERIFIED' | 'SUSPENDED' | 'ARCHIVED';

interface RestaurantsManagerProps {
  restaurants: RestaurantEntity[];
  onSuspend: (restaurantId: string, reason: string) => Promise<void>;
  onReactivate: (restaurantId: string) => Promise<void>;
  onUpgradeToVerified?: (
    restaurantId: string,
    docs: { tinNumber: string; businessLicenseNumber: string }
  ) => Promise<void>;
  onDelete?: (restaurantId: string) => Promise<void>;
  onArchive?: (restaurantId: string, reason: string) => Promise<void>;
  onUnarchive?: (restaurantId: string) => Promise<void>;
  onApproveLaunch?: (restaurantId: string) => Promise<void>;
  onRequestLaunchCorrections?: (restaurantId: string, reason: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const RestaurantsManager: React.FC<RestaurantsManagerProps> = ({
  restaurants,
  onSuspend,
  onReactivate,
  onUpgradeToVerified,
  onDelete,
  onArchive,
  onUnarchive,
  onApproveLaunch,
  onRequestLaunchCorrections,
  language = 'en',
}) => {
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [filter, setFilter] = useState<RestaurantFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRestaurant, setActiveRestaurant] = useState<RestaurantEntity | null>(null);

  const isRestaurantArchived = (r: RestaurantEntity) => {
    return !!((r as any).archivedAt || (r as any).archived_at);
  };

  const archivedCount = restaurants.filter(isRestaurantArchived).length;
  const activeRestaurants = restaurants.filter((r) => !isRestaurantArchived(r));

  const allCount = activeRestaurants.length;
  const launchReviewCount = activeRestaurants.filter((r) => r.launchStatus === 'GO_LIVE_REVIEW').length;
  const basicCount = activeRestaurants.filter((r) => r.sellerTier === 'BASIC_SELLER' && !r.isSuspended).length;
  const verifiedCount = activeRestaurants.filter(
    (r) => (r.sellerTier === 'VERIFIED_RESTAURANT' || r.sellerTier === 'VERIFIED_SELLER') && !r.isSuspended
  ).length;
  const suspendedCount = activeRestaurants.filter((r) => r.isSuspended || r.verificationStatus === 'SUSPENDED').length;

  const filtered = restaurants.filter((r) => {
    const isArchived = isRestaurantArchived(r);
    const isSuspended = !!r.isSuspended || r.verificationStatus === 'SUSPENDED';
    const isVerified = r.sellerTier === 'VERIFIED_RESTAURANT' || r.sellerTier === 'VERIFIED_SELLER';

    if (filter === 'ARCHIVED') {
      if (!isArchived) return false;
    } else {
      if (isArchived) return false;
      if (filter === 'LAUNCH_REVIEW' && r.launchStatus !== 'GO_LIVE_REVIEW') return false;
      if (filter === 'BASIC_SELLER' && (isVerified || isSuspended)) return false;
      if (filter === 'VERIFIED' && (!isVerified || isSuspended)) return false;
      if (filter === 'SUSPENDED' && !isSuspended) return false;
    }

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      (r.name || '').toLowerCase().includes(query) ||
      (r.ownerName && r.ownerName.toLowerCase().includes(query)) ||
      (r.neighborhood || '').toLowerCase().includes(query) ||
      (r.cuisine || '').toLowerCase().includes(query)
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.appBackground }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Usimamizi wa Migahawa na Wauzaji' : 'Restaurants & Vendors Directory'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Oversee live food spots, enforce quality standards, manage suspensions, and review tax tiers.
          </Text>
        </View>
      </View>

      {/* Filters & Search */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPills}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { backgroundColor: colors.card, borderColor: colors.border },
              filter === 'ALL' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('ALL')}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: colors.textSecondary },
                filter === 'ALL' && styles.filterPillTextActive,
              ]}
            >
              All ({allCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { backgroundColor: colors.card, borderColor: colors.border },
              filter === 'LAUNCH_REVIEW' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('LAUNCH_REVIEW')}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: colors.textSecondary },
                filter === 'LAUNCH_REVIEW' && styles.filterPillTextActive,
              ]}
            >
              Launch Review ({launchReviewCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { backgroundColor: colors.card, borderColor: colors.border },
              filter === 'VERIFIED' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('VERIFIED')}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: colors.textSecondary },
                filter === 'VERIFIED' && styles.filterPillTextActive,
              ]}
            >
              Verified ({verifiedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { backgroundColor: colors.card, borderColor: colors.border },
              filter === 'BASIC_SELLER' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('BASIC_SELLER')}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: colors.textSecondary },
                filter === 'BASIC_SELLER' && styles.filterPillTextActive,
              ]}
            >
              Basic Sellers ({basicCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { backgroundColor: colors.card, borderColor: colors.border },
              filter === 'SUSPENDED' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('SUSPENDED')}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: colors.textSecondary },
                filter === 'SUSPENDED' && styles.filterPillTextActive,
              ]}
            >
              Suspended ({suspendedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { backgroundColor: colors.card, borderColor: colors.border },
              filter === 'ARCHIVED' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('ARCHIVED')}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: colors.textSecondary },
                filter === 'ARCHIVED' && styles.filterPillTextActive,
              ]}
            >
              Archived ({archivedCount})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search name, owner, neighborhood..."
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Grid of Restaurant Cards */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Restaurants Found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>No spots match the selected criteria.</Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filtered.map((r) => {
              const isArchived = isRestaurantArchived(r);
              const isSuspended = !!r.isSuspended || r.verificationStatus === 'SUSPENDED';
              const isVerified = r.sellerTier === 'VERIFIED_RESTAURANT' || r.sellerTier === 'VERIFIED_SELLER';

              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isSuspended && styles.cardSuspended,
                    isArchived && { borderColor: colors.danger, opacity: 0.85 },
                  ]}
                  onPress={() => setActiveRestaurant(r)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleArea}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        {r.cuisine} • {r.neighborhood}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.tierBadge,
                        isArchived
                          ? { backgroundColor: colors.dangerSoft }
                          : isSuspended
                          ? styles.badgeSuspended
                          : isVerified
                          ? styles.badgeVerified
                          : styles.badgeBasic,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tierBadgeText,
                          isArchived && { color: colors.danger },
                        ]}
                      >
                        {isArchived ? 'ARCHIVED' : isSuspended ? 'SUSPENDED' : isVerified ? 'VERIFIED' : 'BASIC'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.metaRow}>
                      <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {r.ownerName || 'Owner on file'} ({r.ownerPhone || r.phone || '-'})
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="star" size={13} color="#f59e0b" />
                      <Text style={styles.metaText}>
                        {r.rating} ({r.reviewsCount || 0} reviews)
                      </Text>
                    </View>
                    {r.tinNumber && (
                      <View style={styles.metaRow}>
                        <Ionicons name="document-text-outline" size={13} color="#059669" />
                        <Text style={styles.metaText}>TIN: {r.tinNumber}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.openIndicatorRow}>
                      <View style={[styles.statusDot, r.isOpen ? styles.dotOpen : styles.dotClosed]} />
                      <Text style={styles.openText}>{r.isOpen ? 'Open Now' : 'Closed'}</Text>
                    </View>
                    <View style={styles.inspectAction}>
                      <Text style={styles.inspectText}>Manage</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <RestaurantDetailAdmin
        restaurant={activeRestaurant}
        visible={!!activeRestaurant}
        onClose={() => setActiveRestaurant(null)}
        onSuspend={onSuspend}
        onReactivate={onReactivate}
        onUpgradeToVerified={onUpgradeToVerified}
        onDelete={onDelete}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
        onApproveLaunch={onApproveLaunch}
        onRequestLaunchCorrections={onRequestLaunchCorrections}
        language={language}
      />
    </View>
  );
};


const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
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
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 220,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    padding: 0,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: 300,
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardSuspended: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  cardTitleArea: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  badgeBasic: {
    backgroundColor: colors.infoSoft,
  },
  badgeVerified: {
    backgroundColor: colors.successSoft,
  },
  badgeSuspended: {
    backgroundColor: colors.dangerSoft,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  cardBody: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 8,
  },
  openIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOpen: {
    backgroundColor: '#10b981',
  },
  dotClosed: {
    backgroundColor: colors.textMuted,
  },
  openText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  inspectAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inspectText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
let styles = createStyles(lightColors);
