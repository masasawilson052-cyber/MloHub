import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { HeroSearchBar } from '../../components/discovery/HeroSearchBar';
import { DishCard } from '../../components/discovery/DishCard';
import { DishCardSkeleton } from '../../components/discovery/DishCardSkeleton';
import { DiscoveryFilters } from '../../components/discovery/DiscoveryFilters';
import { NoResultsView } from '../../components/discovery/NoResultsView';
import { GoogleMapView } from '../../components/GoogleMapView';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DiscoveryService } from '../../services/DiscoveryService';
import { DishDiscoveryResult, DiscoveryQuery, DiscoverySort } from '../../types/discovery';
import { AnalyticsService } from '../../services/AnalyticsService';
import { useMloHubDB } from '../../context/DbContext';

export default function ExploreScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{
    q?: string;
    budget?: string;
    dist?: string;
    openNow?: string;
    neighborhood?: string;
    mode?: string;
  }>();

  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const { restaurants } = useMloHubDB();

  const [viewMode, setViewMode] = useState<'list' | 'map'>(params.mode === 'map' ? 'map' : 'list');
  const [searchQuery, setSearchQuery] = useState(params.q || '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<DiscoverySort>('RECOMMENDED');

  const initialNeighborhood = params.neighborhood || profile?.location || user?.location || undefined;

  // Filter State
  const [filters, setFilters] = useState<DiscoveryQuery>({
    query: params.q || '',
    maxPriceTzs: params.budget ? Number(params.budget) : undefined,
    maxDistanceKm: params.dist ? Number(params.dist) : 5,
    openNow: params.openNow === 'true',
    neighborhood: initialNeighborhood,
    availableOnly: true,
  });

  // Results State
  const [results, setResults] = useState<DishDiscoveryResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [similarDishes, setSimilarDishes] = useState<DishDiscoveryResult[]>([]);
  const [comparedDishes, setComparedDishes] = useState<DishDiscoveryResult[]>([]);

  const activeFilterCount =
    (filters.maxPriceTzs ? 1 : 0) +
    (filters.maxDistanceKm && filters.maxDistanceKm < 20 ? 1 : 0) +
    (filters.openNow ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.neighborhood && filters.neighborhood !== 'All' ? 1 : 0);

  const executeSearch = useCallback(async (currentFilters: DiscoveryQuery, sortMode: DiscoverySort) => {
    setIsLoading(true);
    try {
      const response = await DiscoveryService.searchDishes({
        ...currentFilters,
        sortBy: sortMode,
        limit: 30,
      });

      setResults(response.results);
      setTotalCount(response.totalCount);

      AnalyticsService.trackEvent('SEARCH_COMPLETED', {
        query: currentFilters.query,
        neighborhood: currentFilters.neighborhood,
        resultCount: response.totalCount,
        sortMode,
      });

      if (response.totalCount === 0 && currentFilters.query) {
        AnalyticsService.trackEvent('SEARCH_NO_RESULTS', {
          query: currentFilters.query,
          filterValue: currentFilters.maxPriceTzs,
        });
        const similar = await DiscoveryService.getSimilarDishes(currentFilters.query, currentFilters.maxPriceTzs);
        setSimilarDishes(similar);
      } else {
        setSimilarDishes([]);
      }
    } catch (err) {
      console.error('ExploreScreen: Discovery query failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Run search when query, filters, or sort change
  useEffect(() => {
    executeSearch({ ...filters, query: searchQuery }, activeSort);
  }, [searchQuery, filters, activeSort, executeSearch]);

  const handleClearFilters = () => {
    setFilters({
      query: '',
      maxPriceTzs: undefined,
      maxDistanceKm: 10,
      openNow: false,
      neighborhood: undefined,
      availableOnly: true,
    });
    setSearchQuery('');
  };

  const toggleCompare = (dish: DishDiscoveryResult) => {
    setComparedDishes((prev) => {
      const exists = prev.some((d) => d.menuItemId === dish.menuItemId);
      if (exists) return prev.filter((d) => d.menuItemId !== dish.menuItemId);
      if (prev.length >= 4) {
        alert('You can compare up to 4 dishes at a time.');
        return prev;
      }
      return [...prev, dish];
    });
  };

  const handleOpenCompare = () => {
    if (comparedDishes.length >= 2) {
      router.push({
        pathname: '/compare' as any,
        params: {
          dishes: JSON.stringify(comparedDishes),
        },
      });
    }
  };

  const sortOptions: { id: DiscoverySort; label: string }[] = [
    { id: 'RECOMMENDED', label: '✨ Recommended' },
    { id: 'NEAREST', label: '📍 Nearest' },
    { id: 'CHEAPEST', label: '💰 Cheapest' },
    { id: 'HIGHEST_RATED', label: '★ Top Rated' },
    { id: 'FRESHEST', label: '✓ Freshest' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.container, isLargeScreen && styles.largeScreenContainer]}>
        {/* Top Search & Filter Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBarCol}>
            <HeroSearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={language === 'sw' ? 'Tafuta chakula, bei, mgahawa...' : 'Search dish, price, restaurant...'}
              onToggleFilters={() => setFiltersOpen(!filtersOpen)}
              activeFilterCount={activeFilterCount}
              filtersOpen={filtersOpen}
              onSelectSuggestion={(sug) => setSearchQuery(sug.text)}
            />
          </View>

          {/* View Toggle (List vs Map) */}
          <TouchableOpacity
            style={styles.modeToggleBtn}
            onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            accessibilityRole="button"
            accessibilityLabel="Toggle list or map view"
          >
            <Ionicons
              name={viewMode === 'list' ? 'map-outline' : 'list-outline'}
              size={20}
              color={Colors.primaryDark}
            />
          </TouchableOpacity>
        </View>

        {/* Collapsible Filter Panel */}
        {filtersOpen ? (
          <DiscoveryFilters
            filters={filters}
            onChangeFilters={setFilters}
            onClearFilters={handleClearFilters}
            activeCount={activeFilterCount}
          />
        ) : null}

        {/* Results Metadata & Sort Bar */}
        <View style={styles.metaRow}>
          <Text style={styles.resultsCount}>
            {isLoading ? 'Searching dishes...' : `${totalCount} ${totalCount === 1 ? 'dish' : 'dishes'} found`}
          </Text>

          {/* Sort Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChipsScroll}>
            {sortOptions.map((s) => {
              const isSelected = activeSort === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sortChip, isSelected && styles.sortChipActive]}
                  onPress={() => setActiveSort(s.id)}
                >
                  <Text style={[styles.sortChipText, isSelected && styles.sortChipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Content Area */}
        {viewMode === 'map' ? (
          <View style={styles.mapContainer}>
            <GoogleMapView restaurants={restaurants as any} height={500} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View>
                <DishCardSkeleton />
                <DishCardSkeleton />
                <DishCardSkeleton />
              </View>
            ) : results.length > 0 ? (
              results.map((dish) => (
                <DishCard
                  key={`${dish.menuItemId}-${dish.branchId}`}
                  dish={dish}
                  onToggleCompare={toggleCompare}
                  isCompared={comparedDishes.some((d) => d.menuItemId === dish.menuItemId)}
                />
              ))
            ) : (
              <NoResultsView
                queryText={searchQuery}
                maxBudget={filters.maxPriceTzs}
                maxDistanceKm={filters.maxDistanceKm}
                onIncreaseBudget={() =>
                  setFilters({ ...filters, maxPriceTzs: (filters.maxPriceTzs || 10000) + 5000 })
                }
                onExpandDistance={() => setFilters({ ...filters, maxDistanceKm: 10 })}
                onClearFilters={handleClearFilters}
                similarDishes={similarDishes}
              />
            )}
          </ScrollView>
        )}

        {/* FLOATING COMPARE BAR */}
        {comparedDishes.length >= 2 ? (
          <View style={styles.floatingCompareBar}>
            <View style={styles.floatingCompareLeft}>
              <Text style={styles.floatingCompareEmoji}>⚖️</Text>
              <Text style={styles.floatingCompareText}>
                {comparedDishes.length} {comparedDishes.length === 1 ? 'Dish' : 'Dishes'} Selected
              </Text>
            </View>
            <TouchableOpacity style={styles.floatingCompareBtn} onPress={handleOpenCompare}>
              <Text style={styles.floatingCompareBtnText}>Compare Now ➔</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  largeScreenContainer: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  searchBarCol: {
    flex: 1,
  },
  modeToggleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: 8,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.muted,
  },
  sortChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    backgroundColor: '#edf2ee',
    borderWidth: 1,
    borderColor: '#dce4dd',
  },
  sortChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.muted,
  },
  sortChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  scrollList: {
    paddingBottom: 80,
  },
  mapContainer: {
    flex: 1,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  floatingCompareBar: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.primaryDark,
    borderRadius: Radii.full,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.lg,
    zIndex: 1000,
  },
  floatingCompareLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingCompareEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  floatingCompareText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  floatingCompareBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  floatingCompareBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
});
