import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { SearchBar } from '../../components/SearchBar';
import { RestaurantCard } from '../../components/RestaurantCard';
import { ReservationModal } from '../../components/ReservationModal';
import { GoogleMapView } from '../../components/GoogleMapView';
import { RESTAURANTS, Restaurant } from '../../constants/data';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';

export default function ExploreScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { t, language } = useLanguage();
  const { restaurants: dbRestaurants, favorites, toggleFavorite } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [viewMode, setViewMode] = useState<'list' | 'map'>(mode === 'map' ? 'map' : 'list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [sortBy, setSortBy] = useState<'rating' | 'distance' | 'price'>('rating');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedReserveRestaurant, setSelectedReserveRestaurant] = useState<Restaurant | null>(null);

  const cuisineCategories = [
    { id: 'All', label: language === 'sw' ? '⭐ Wote' : '⭐ All' },
    { id: 'biryani', label: language === 'sw' ? '👑 Biryani' : '👑 Biryani' },
    { id: 'mchemsho', label: language === 'sw' ? '🍲 Mchemsho' : '🍲 Mchemsho' },
    { id: 'nyama_choma', label: language === 'sw' ? '🥩 Nyama Choma' : '🥩 Nyama Choma' },
    { id: 'traditional', label: language === 'sw' ? '🥘 Asili / Swahili' : '🥘 Traditional' },
    { id: 'vegetarian', label: language === 'sw' ? '🌿 Afya / Veg' : '🌿 Healthy / Veg' },
  ];

  const filteredRestaurants = useMemo(() => {
    const baseList = dbRestaurants && dbRestaurants.length > 0 ? dbRestaurants : RESTAURANTS;
    let list = [...baseList];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.neighborhood.toLowerCase().includes(q) ||
          (r.specialistBadge && r.specialistBadge.toLowerCase().includes(q)) ||
          r.tags.some((item) => item.toLowerCase().includes(q))
      );
    }

    if (selectedCuisine !== 'All') {
      list = list.filter(
        (r) =>
          r.specialistCategory === selectedCuisine ||
          r.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase()) ||
          r.tags.some((t) => t.toLowerCase().includes(selectedCuisine.toLowerCase()))
      );
    }

    if (activeFilters.includes('Within 3 km')) {
      list = list.filter((r) => r.distanceKm <= 3.0);
    }
    if (activeFilters.includes('Open now')) {
      list = list.filter((r) => r.isOpen);
    }
    if (activeFilters.includes('Rating 4.0+')) {
      list = list.filter((r) => r.rating >= 4.0);
    }
    if (activeFilters.includes('Budget')) {
      list = list.filter((r) => r.budgetTier === 'budget' || r.minPrice <= 6000);
    }

    if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'distance') {
      list.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (sortBy === 'price') {
      list.sort((a, b) => a.minPrice - b.minPrice);
    }

    return list;
  }, [searchQuery, selectedCuisine, sortBy, activeFilters]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.container, isLargeScreen && styles.largeScreenContainer]}>
        {/* Header with View Toggle */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('explorePageEyebrow')}</Text>
            <Text style={styles.title}>{t('explorePageTitle')}</Text>
          </View>

          {/* List vs Map View Mode Toggle */}
          <View style={styles.viewModeToggleWrap}>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="list"
                size={14}
                color={viewMode === 'list' ? '#ffffff' : Colors.muted}
              />
              <Text
                style={[
                  styles.viewModeBtnText,
                  viewMode === 'list' && styles.viewModeBtnTextActive,
                ]}
              >
                {language === 'sw' ? 'Orodha' : 'List'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'map' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('map')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="map"
                size={14}
                color={viewMode === 'map' ? '#ffffff' : Colors.muted}
              />
              <Text
                style={[
                  styles.viewModeBtnText,
                  viewMode === 'map' && styles.viewModeBtnTextActive,
                ]}
              >
                {language === 'sw' ? 'Ramani' : 'Map'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            filtersOpen={filtersOpen}
            activeFilterCount={activeFilters.length}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />
        </View>

        {/* Category Pills */}
        <View style={styles.categoryWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryContent}
          >
            {cuisineCategories.map((cat) => {
              const isSelected = selectedCuisine === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, isSelected && styles.catPillSelected]}
                  onPress={() => setSelectedCuisine(cat.id)}
                >
                  <Text style={[styles.catPillText, isSelected && styles.catPillTextSelected]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* MAIN BODY: LIST VIEW OR GOOGLE MAP VIEW */}
        {viewMode === 'map' ? (
          <ScrollView
            contentContainerStyle={styles.mapScrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <GoogleMapView
              restaurants={filteredRestaurants as any}
              onSelectRestaurant={(restaurant) => router.push(`/restaurant/${restaurant.id}`)}
              onOpenReservation={(restaurant) => setSelectedReserveRestaurant(restaurant as any)}
            />
          </ScrollView>
        ) : (
          <>
            {/* Sort Bar */}
            <View style={styles.sortBar}>
              <Text style={styles.sortLabel}>{t('sortBy')}</Text>
              <View style={styles.sortButtons}>
                {(['rating', 'distance', 'price'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}
                    onPress={() => setSortBy(s)}
                  >
                    <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>
                      {s === 'rating' ? t('sortTopRated') : s === 'distance' ? t('sortDistance') : t('sortPrice')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Restaurant List */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
              {filteredRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant as any}
                  isFavorite={favorites.includes(restaurant.id)}
                  onToggleFavorite={() => toggleFavorite(restaurant.id)}
                  onViewMenu={() => router.push(`/restaurant/${restaurant.id}`)}
                  onReserve={() => setSelectedReserveRestaurant(restaurant as any)}
                />
              ))}
            </ScrollView>
          </>
        )}
      </View>

      <ReservationModal
        visible={selectedReserveRestaurant !== null}
        restaurant={selectedReserveRestaurant as any}
        onClose={() => setSelectedReserveRestaurant(null)}
      />
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
  },
  largeScreenContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  viewModeToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
  },
  viewModeBtnActive: {
    backgroundColor: Colors.primary,
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
  },
  viewModeBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  categoryWrap: {
    marginBottom: Spacing.xs,
  },
  categoryContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  catPill: {
    backgroundColor: Colors.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catPillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
  },
  catPillTextSelected: {
    color: Colors.white,
    fontWeight: '800',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  sortLabel: {
    fontSize: 11,
    color: Colors.subtle,
    fontWeight: '700',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sortBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sortBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryLight,
  },
  sortBtnText: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    gap: Spacing.md,
  },
  mapScrollContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
});
