import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Header } from '../../components/Header';
import { HeroSearchBar } from '../../components/discovery/HeroSearchBar';
import { DishCard } from '../../components/discovery/DishCard';
import { DishCardSkeleton } from '../../components/discovery/DishCardSkeleton';
import { CustomMealBanner } from '../../components/CustomMealBanner';
import { LocationModal } from '../../components/LocationModal';
import { ReservationModal } from '../../components/ReservationModal';
import { RestaurantCard } from '../../components/RestaurantCard';
import { ServiceCard } from '../../components/ServiceCard';
import { Restaurant } from '../../types/domain';
import { EmptyState } from '../../components/ui/EmptyState';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { DiscoveryService } from '../../services/DiscoveryService';
import { DishDiscoveryResult } from '../../types/discovery';
import { AnalyticsService } from '../../services/AnalyticsService';
import { useCart } from '../../context/CartContext';
import { FloatingCartButton } from '../../components/cart/FloatingCartButton';
import { CartDrawer } from '../../components/cart/CartDrawer';
import { OrderReviewModal } from '../../components/checkout/OrderReviewModal';

export default function HomeScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const { restaurants: dbRestaurants, favorites, toggleFavorite, loading } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuickBudget, setSelectedQuickBudget] = useState<number | undefined>(undefined);
  const [selectedQuickDistance, setSelectedQuickDistance] = useState<number | undefined>(undefined);
  const [isOpenNowOnly, setIsOpenNowOnly] = useState(false);

  // Discovery Dishes State
  const [popularDishes, setPopularDishes] = useState<DishDiscoveryResult[]>([]);
  const [recommendedDishes, setRecommendedDishes] = useState<DishDiscoveryResult[]>([]);
  const [isLoadingDishes, setIsLoadingDishes] = useState(true);
  const [comparedDishes, setComparedDishes] = useState<DishDiscoveryResult[]>([]);

  // Location
  const profileLocation = profile?.location || user?.location || '';
  const [currentLocation, setCurrentLocation] = useState(profileLocation);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    if (profileLocation && !currentLocation) {
      setCurrentLocation(profileLocation);
    }
  }, [profileLocation]);

  // Reservation Modal
  const [selectedReserveRestaurant, setSelectedReserveRestaurant] = useState<Restaurant | null>(null);

  // Cart & Order Review Modal State
  const { isCartOpen, setIsCartOpen } = useCart();
  const [isOrderReviewOpen, setIsOrderReviewOpen] = useState(false);

  // Load Popular and Recommended Dishes on Mount / Location Change
  useEffect(() => {
    let isMounted = true;
    setIsLoadingDishes(true);

    Promise.all([
      DiscoveryService.getPopularDishes({ neighborhood: currentLocation }),
      DiscoveryService.getRecommendedDishes({ neighborhood: currentLocation }),
    ])
      .then(([pop, rec]) => {
        if (isMounted) {
          setPopularDishes(pop);
          setRecommendedDishes(rec);
          setIsLoadingDishes(false);
        }
      })
      .catch((err) => {
        console.warn('HomeScreen: Failed to load discovery dishes:', err);
        if (isMounted) setIsLoadingDishes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentLocation]);

  const handleSearchSubmit = () => {
    AnalyticsService.trackEvent('SEARCH_STARTED', {
      query: searchQuery,
      neighborhood: currentLocation,
      filterValue: selectedQuickBudget,
    });

    router.push({
      pathname: '/(tabs)/explore',
      params: {
        q: searchQuery,
        budget: selectedQuickBudget ? String(selectedQuickBudget) : undefined,
        dist: selectedQuickDistance ? String(selectedQuickDistance) : undefined,
        openNow: isOpenNowOnly ? 'true' : undefined,
        neighborhood: currentLocation,
      },
    });
  };

  const toggleCompare = (dish: DishDiscoveryResult) => {
    setComparedDishes((prev) => {
      const exists = prev.some((d) => d.menuItemId === dish.menuItemId);
      if (exists) {
        return prev.filter((d) => d.menuItemId !== dish.menuItemId);
      }
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

  const quickFilterKeys = [
    { id: 'b-10k', label: '≤ 10K TZS', budget: 10000 },
    { id: 'b-12k', label: '≤ 12K TZS', budget: 12000 },
    { id: 'd-3km', label: '≤ 3 km', distance: 3 },
    { id: 'd-5km', label: '≤ 5 km', distance: 5 },
    { id: 'open', label: 'Open Now', openNow: true },
  ];

  const handleQuickFilterPress = (item: typeof quickFilterKeys[0]) => {
    if (item.budget) {
      setSelectedQuickBudget((prev) => (prev === item.budget ? undefined : item.budget));
    }
    if (item.distance) {
      setSelectedQuickDistance((prev) => (prev === item.distance ? undefined : item.distance));
    }
    if (item.openNow) {
      setIsOpenNowOnly((prev) => !prev);
    }
  };

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <Header
        location={currentLocation}
        onOpenLocation={() => setIsLocationModalOpen(true)}
        onOpenProfile={() => router.push('/(tabs)/profile')}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.largeScreenContainer]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO FOOD DISCOVERY SECTION */}
        <View style={styles.heroSection}>
          <View style={styles.eyebrowBadge}>
            <View style={styles.pulsingDot} />
            <Text style={styles.eyebrowText}>
              {language === 'sw' ? 'UGUNDUZI WA CHAKULA KWANZA' : 'FOOD-FIRST DISCOVERY'}
            </Text>
          </View>

          <Text style={styles.heroHeading}>
            {language === 'sw' ? 'Ungependa Kula Nini Leo?' : 'What do you want to eat?'}
          </Text>

          <Text style={styles.heroSub}>
            {language === 'sw'
              ? 'Tafuta vyakula halisi, bei zilizothibitishwa, na umbali kutoka ulipo Dar es Salaam.'
              : 'Discover real dishes, verified prices, and exact distance across Dar es Salaam.'}
          </Text>

          {/* Hero Search Bar */}
          <View style={styles.searchBarWrapper}>
            <HeroSearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={handleSearchSubmit}
              placeholder={language === 'sw' ? 'Tafuta chakula (mf. Chicken Biryani, Chipsi Kuku)...' : 'Search food (e.g. Chicken Biryani, Chipsi Kuku)...'}
              onSelectSuggestion={(sug) => {
                setSearchQuery(sug.text);
                router.push({
                  pathname: '/(tabs)/explore',
                  params: { q: sug.text, neighborhood: currentLocation },
                });
              }}
            />
          </View>

          {/* Quick Filter Chips */}
          <View style={styles.quickChipsRow}>
            {quickFilterKeys.map((f) => {
              const isSelected =
                (f.budget && selectedQuickBudget === f.budget) ||
                (f.distance && selectedQuickDistance === f.distance) ||
                (f.openNow && isOpenNowOnly);

              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.quickChip, isSelected && styles.quickChipActive]}
                  onPress={() => handleQuickFilterPress(f)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.quickChipText, isSelected && styles.quickChipTextActive]}>
                    {isSelected ? '✓ ' : ''}{f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SECTION 1: POPULAR DISHES NEAR YOU */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>
              {language === 'sw' ? 'INAYOPENDWA ZAIDI' : 'POPULAR DISHES NEARBY'}
            </Text>
            <Text style={styles.sectionTitle}>
              {language === 'sw'
                ? (currentLocation ? `Vyakula Maarufu ${currentLocation}` : 'Vyakula Maarufu')
                : (currentLocation ? `Popular in ${currentLocation}` : 'Popular Dishes')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/explore', params: { neighborhood: currentLocation || undefined } })}>
            <Text style={styles.seeAllText}>{language === 'sw' ? 'Ona Zaidi →' : 'See All →'}</Text>
          </TouchableOpacity>
        </View>

        {isLoadingDishes ? (
          <View>
            <DishCardSkeleton />
            <DishCardSkeleton />
          </View>
        ) : popularDishes.length > 0 ? (
          popularDishes.slice(0, 4).map((dish) => (
            <DishCard
              key={dish.menuItemId}
              dish={dish}
              onToggleCompare={toggleCompare}
              isCompared={comparedDishes.some((d) => d.menuItemId === dish.menuItemId)}
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              {currentLocation ? `No dishes found near ${currentLocation}.` : 'No dishes found.'}
            </Text>
          </View>
        )}

        {/* CUSTOM MEAL FEATURE BANNER */}
        <CustomMealBanner onStartRequest={() => router.push('/(tabs)/custom')} />

        {/* SECTION 2: MORE DISHES NEARBY */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>
              {language === 'sw' ? 'VYAKULA VINGINE KARIBU' : 'MORE DISHES NEARBY'}
            </Text>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? 'Chakula Chenye Ubora wa Juu' : 'Top Quality & Freshness'}
            </Text>
          </View>
        </View>

        {isLoadingDishes ? (
          <DishCardSkeleton />
        ) : recommendedDishes.length > 0 ? (
          recommendedDishes.slice(0, 4).map((dish) => (
            <DishCard
              key={dish.menuItemId}
              dish={dish}
              onToggleCompare={toggleCompare}
              isCompared={comparedDishes.some((d) => d.menuItemId === dish.menuItemId)}
            />
          ))
        ) : null}

        {/* SECTION 3: FEATURED RESTAURANTS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>{t('popularEyebrow')}</Text>
            <Text style={styles.sectionTitle}>{t('popularTitle')}</Text>
          </View>
        </View>

        {loading ? (
          <DishCardSkeleton />
        ) : dbRestaurants && dbRestaurants.length > 0 ? (
          dbRestaurants.slice(0, 3).map((restaurant) => (
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
          <EmptyState
            title={language === 'sw' ? 'Hakuna migahawa kwa sasa' : 'No restaurants available'}
            message={language === 'sw' ? 'Migahawa itaonekana hapa mara itakapopatikana.' : 'Restaurants will appear here once available.'}
            icon="restaurant-outline"
          />
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

      {/* FLOATING COMPARE BAR (Appears when 2+ dishes selected) */}
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

      {/* Floating Cart Button (Presents when user has items in cart) */}
      <FloatingCartButton />

      {/* Slide-in Cart Drawer */}
      <CartDrawer
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => setIsOrderReviewOpen(true)}
      />

      {/* Order Review & Placement Modal */}
      <OrderReviewModal
        visible={isOrderReviewOpen}
        onClose={() => setIsOrderReviewOpen(false)}
        onOrderConfirmed={(orderId) => {
          router.push('/(tabs)/bookings');
        }}
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
    paddingBottom: 80,
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
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#cce3d3',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  heroHeading: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
    lineHeight: 30,
    marginBottom: Spacing.xs,
  },
  heroSub: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  searchBarWrapper: {
    marginBottom: Spacing.sm,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: '#f1f5f2',
    borderWidth: 1,
    borderColor: '#e2e7e3',
  },
  quickChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
  },
  quickChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    paddingBottom: 2,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyCardText: {
    color: Colors.muted,
    fontSize: 13,
  },
  whySection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  whyHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  whyGrid: {
    gap: Spacing.sm,
  },
  whyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  whyIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  whyIconText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '800',
  },
  whyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  whyCardDesc: {
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 16,
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
