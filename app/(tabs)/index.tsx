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
import { useRouter } from 'expo-router';

import { Header } from '../../components/Header';
import { SearchBar } from '../../components/SearchBar';
import { ServiceCard } from '../../components/ServiceCard';
import { RestaurantCard } from '../../components/RestaurantCard';
import { CustomMealBanner } from '../../components/CustomMealBanner';
import { LocationModal } from '../../components/LocationModal';
import { ReservationModal } from '../../components/ReservationModal';
import { RESTAURANTS, Restaurant } from '../../constants/data';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';

export default function HomeScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { restaurants: dbRestaurants, favorites, toggleFavorite } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState('Nearby');

  // Location
  const [currentLocation, setCurrentLocation] = useState('Dar es Salaam');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Reservation Modal
  const [selectedReserveRestaurant, setSelectedReserveRestaurant] = useState<Restaurant | null>(null);

  const toggleFilter = (filterKey: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterKey) ? prev.filter((f) => f !== filterKey) : [...prev, filterKey]
    );
  };

  const services = [
    {
      id: 'Nearby',
      label: t('serviceNearbyLabel'),
      detail: t('serviceNearbyDetail'),
      icon: '📍',
    },
    {
      id: 'Compare',
      label: t('serviceCompareLabel'),
      detail: t('serviceCompareDetail'),
      icon: '💰',
    },
    {
      id: 'Reservations',
      label: t('serviceReserveLabel'),
      detail: t('serviceReserveDetail'),
      icon: '🪑',
    },
    {
      id: 'Top Rated',
      label: t('serviceTopRatedLabel'),
      detail: t('serviceTopRatedDetail'),
      icon: '★',
    },
  ];

  const quickFilterKeys = [
    { id: 'Within 3 km', label: t('filterWithin3km') },
    { id: 'Open now', label: t('filterOpenNow') },
    { id: 'Rating 4.0+', label: t('filterRating4') },
    { id: 'Budget', label: t('filterBudget') },
  ];

  const whyBenefits = [
    {
      id: 'b1',
      title: t('why1Title'),
      desc: t('why1Desc'),
      icon: '✓',
    },
    {
      id: 'b2',
      title: t('why2Title'),
      desc: t('why2Desc'),
      icon: '★',
    },
    {
      id: 'b3',
      title: t('why3Title'),
      desc: t('why3Desc'),
      icon: '♨',
    },
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
          r.tags.some((item) => item.toLowerCase().includes(q))
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

    if (selectedService === 'Nearby') {
      list.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (selectedService === 'Top Rated') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (selectedService === 'Compare') {
      list.sort((a, b) => a.minPrice - b.minPrice);
    }

    return list;
  }, [dbRestaurants, searchQuery, activeFilters, selectedService]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <Header
        location={currentLocation}
        favoriteCount={favorites.length}
        onOpenLocation={() => setIsLocationModalOpen(true)}
        onOpenProfile={() => router.push('/(tabs)/profile')}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <View style={styles.eyebrowBadge}>
            <View style={styles.pulsingDot} />
            <Text style={styles.eyebrowText}>{t('eyebrowHero')}</Text>
          </View>

          <Text style={styles.heroHeading}>
            {t('heroHeading1')}{'\n'}
            <Text style={styles.heroHeadingGreen}>{t('heroHeading2')}</Text>
          </Text>

          <Text style={styles.heroSub}>{t('heroSub')}</Text>

          {/* Search Bar & Filter Toggle */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            filtersOpen={filtersOpen}
            activeFilterCount={activeFilters.length}
            onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          />

          {/* Filter Pills Panel */}
          {filtersOpen && (
            <View style={styles.filterPillsContainer}>
              <Text style={styles.filterLabel}>{t('filterTitle')}</Text>
              <View style={styles.filterChipsRow}>
                {quickFilterKeys.map((f) => {
                  const isSelected = activeFilters.includes(f.id);
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      onPress={() => toggleFilter(f.id)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                        {isSelected ? '✓ ' : ''}{f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {activeFilters.length > 0 && (
                  <TouchableOpacity onPress={() => setActiveFilters([])}>
                    <Text style={styles.resetFiltersText}>{t('resetFilters')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Trust Stats */}
          <View style={styles.trustRow}>
            <Text style={styles.trustItem}>{t('statsRestaurants')}</Text>
            <Text style={styles.trustDot}>•</Text>
            <Text style={styles.trustItem}><Text style={styles.trustOrange}>★</Text> {t('statsRating')}</Text>
            <Text style={styles.trustDot}>•</Text>
            <Text style={styles.trustItem}><Text style={styles.trustGreen}>✓</Text> {t('statsPrices')}</Text>
          </View>
        </View>

        {/* 4 SERVICE SHORTCUTS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>{t('exploreEyebrow')}</Text>
          <Text style={styles.sectionTitle}>{t('exploreTitle')}</Text>
        </View>

        <View style={styles.serviceGrid}>
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              id={s.id}
              label={s.label}
              detail={s.detail}
              icon={s.icon}
              isSelected={selectedService === s.id}
              onPress={() => {
                setSelectedService(s.id);
                if (s.id === 'Reservations') {
                  const r = RESTAURANTS[0];
                  if (r) setSelectedReserveRestaurant(r);
                }
              }}
            />
          ))}
        </View>

        {/* CUSTOM MEAL FEATURE BANNER */}
        <CustomMealBanner onStartRequest={() => router.push('/(tabs)/custom')} />

        {/* POPULAR RESTAURANTS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>{t('popularEyebrow')}</Text>
            <Text style={styles.sectionTitle}>{t('popularTitle')}</Text>
          </View>
          <Text style={styles.countText}>
            {filteredRestaurants.length} {t('placesCount')}
          </Text>
        </View>

        {filteredRestaurants.length > 0 ? (
          filteredRestaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant as any}
              isFavorite={favorites.includes(restaurant.id)}
              onToggleFavorite={() => toggleFavorite(restaurant.id)}
              onViewMenu={() => router.push(`/restaurant/${restaurant.id}`)}
              onReserve={() => setSelectedReserveRestaurant(restaurant as any)}
            />
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>{t('noRestaurantsTitle')}</Text>
            <Text style={styles.emptyMsg}>{t('noRestaurantsMsg')}</Text>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setSearchQuery('');
                setActiveFilters([]);
              }}
            >
              <Text style={styles.clearBtnText}>{t('clearFilters')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WHY MLOHUB */}
        <View style={styles.whySection}>
          <Text style={styles.sectionEyebrow}>{t('whyEyebrow')}</Text>
          <Text style={styles.whyHeading}>{t('whyHeading')}</Text>

          <View style={styles.whyGrid}>
            {whyBenefits.map((b) => (
              <View key={b.id} style={styles.whyCard}>
                <View style={styles.whyIconBadge}>
                  <Text style={styles.whyIconText}>{b.icon}</Text>
                </View>
                <Text style={styles.whyCardTitle}>{b.title}</Text>
                <Text style={styles.whyCardDesc}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Location Modal */}
      <LocationModal
        visible={isLocationModalOpen}
        selectedLocation={currentLocation}
        onSelect={setCurrentLocation}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* Table Reservation Modal */}
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
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  largeScreenContainer: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    marginBottom: Spacing.xl,
  },
  eyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    marginBottom: Spacing.sm,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
  },
  eyebrowText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  heroHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    lineHeight: 34,
    marginBottom: Spacing.xs,
  },
  heroHeadingGreen: {
    color: Colors.primaryLight,
    fontStyle: 'italic',
  },
  heroSub: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 19,
    marginBottom: Spacing.lg,
  },
  filterPillsContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.subtle,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  filterChipTextSelected: {
    color: Colors.white,
    fontWeight: '800',
  },
  resetFiltersText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.accent,
    marginLeft: 6,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.md,
  },
  trustItem: {
    fontSize: 11,
    color: Colors.muted,
  },
  trustOrange: {
    fontWeight: '800',
    color: Colors.accent,
  },
  trustGreen: {
    fontWeight: '800',
    color: Colors.primary,
  },
  trustDot: {
    color: Colors.subtle,
    fontSize: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emptyBox: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  emptyMsg: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  clearBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radii.lg,
  },
  clearBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  whySection: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  whyHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginVertical: Spacing.xs,
  },
  whyGrid: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  whyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: Radii.xl,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  whyIconBadge: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  whyIconText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 12,
  },
  whyCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  whyCardDesc: {
    fontSize: 11,
    color: Colors.muted,
    lineHeight: 16,
  },
});
