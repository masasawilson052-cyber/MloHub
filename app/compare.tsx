import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { DishDiscoveryResult } from '../types/discovery';
import { formatTzs, formatDistance, formatFreshnessBadge } from '../utils/formatters';
import { useCart } from '../context/CartContext';
import { FloatingCartButton } from '../components/cart/FloatingCartButton';
import { CartDrawer } from '../components/cart/CartDrawer';
import { OrderReviewModal } from '../components/checkout/OrderReviewModal';
import { FreshnessBadge } from '../components/ui/FreshnessBadge';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

export default function CompareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dishes?: string }>();
  const { width } = useWindowDimensions();
  const { addToCart, items, isCartOpen, setIsCartOpen } = useCart();
  const [isOrderReviewOpen, setIsOrderReviewOpen] = useState(false);

  let dishes: DishDiscoveryResult[] = [];
  try {
    if (params.dishes) {
      dishes = JSON.parse(params.dishes);
    }
  } catch {
    dishes = [];
  }

  // Calculate Best-in-Class Metrics
  const bestMetrics = useMemo(() => {
    if (dishes.length === 0) return { minPrice: 0, minDistance: 0, maxRating: 0 };
    const minPrice = Math.min(...dishes.map((d) => d.priceTzs));
    const minDistance = Math.min(...dishes.map((d) => d.distanceKm));
    const maxRating = Math.max(...dishes.map((d) => d.restaurantRating));
    return { minPrice, minDistance, maxRating };
  }, [dishes]);

  const handleOpenRestaurant = (dish: DishDiscoveryResult) => {
    router.push({
      pathname: '/restaurant/[id]',
      params: {
        id: dish.restaurantId,
        highlightDishId: dish.menuItemId,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dish Quality & Price Comparison</Text>
        <View style={{ width: 40 }} />
      </View>

      {dishes.length === 0 ? (
        <EmptyState
          title="No dishes selected"
          message="Tap '+ Compare' on any 2–4 dishes in search results to compare prices, distance, ratings, and kitchen freshness side-by-side."
          icon="git-compare-outline"
          actionTitle="Browse Dishes"
          onAction={() => router.push('/(tabs)/explore')}
          style={styles.emptyContainer}
        />
      ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          <View style={styles.introHeader}>
            <Text style={styles.subtitle}>
              Comparing {dishes.length} candidate options side-by-side:
            </Text>
            <Text style={styles.noteText}>
              All prices and freshness timestamps verified directly with kitchen managers.
            </Text>
          </View>

          {/* Horizontal Comparison Columns */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columnsContainer}>
            {dishes.map((dish) => {
              const inCart = items.find((i) => i.dishId === dish.menuItemId);
              const isBestPrice = dish.priceTzs === bestMetrics.minPrice;
              const isNearest = dish.distanceKm === bestMetrics.minDistance;
              const isTopRated = dish.restaurantRating === bestMetrics.maxRating;

              return (
                <View key={dish.menuItemId} style={styles.columnCard}>
                  {/* Dish Image */}
                  <View style={styles.imageBox}>
                    {dish.imageUrl ? (
                      <Image source={{ uri: dish.imageUrl }} style={styles.dishImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.imgPlaceholder}>
                        <Text style={styles.imgPlaceholderText}>🍲</Text>
                      </View>
                    )}

                    {/* Best-in-Class Pill */}
                    {isBestPrice ? (
                      <View style={styles.bestPriceBadge}>
                        <Text style={styles.bestBadgeText}>Best Price</Text>
                      </View>
                    ) : isNearest ? (
                      <View style={styles.nearestBadge}>
                        <Text style={styles.bestBadgeText}>Closest</Text>
                      </View>
                    ) : isTopRated ? (
                      <View style={styles.topRatedBadge}>
                        <Text style={styles.bestBadgeText}>Top Rated</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Dish Name */}
                  <Text style={styles.dishName} numberOfLines={2}>
                    {dish.dishName}
                  </Text>
                  {dish.dishNameSw && dish.dishNameSw !== dish.dishName ? (
                    <Text style={styles.dishNameSw} numberOfLines={1}>
                      {dish.dishNameSw}
                    </Text>
                  ) : null}

                  {/* Restaurant & Neighborhood */}
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {dish.restaurantName}
                  </Text>
                  <Text style={styles.neighborhood} numberOfLines={1}>
                    📍 {dish.neighborhood}
                  </Text>

                  {/* Comparison Metrics Table */}
                  <View style={styles.metricsTable}>
                    {/* Price Row */}
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Price</Text>
                      <Text style={[styles.priceValue, isBestPrice && styles.priceValueHighlight]}>
                        {formatTzs(dish.priceTzs)}
                      </Text>
                    </View>

                    {/* Distance Row */}
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Distance</Text>
                      <Text style={[styles.metricValue, isNearest && styles.metricValueHighlight]}>
                        {formatDistance(dish.distanceKm)}
                      </Text>
                    </View>

                    {/* Rating Row */}
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Rating</Text>
                      <Text style={[styles.metricValue, isTopRated && styles.metricValueHighlight]}>
                        ★ {dish.restaurantRating.toFixed(1)} ({dish.reviewCount})
                      </Text>
                    </View>

                    {/* Availability Row */}
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Availability</Text>
                      <Text style={[styles.metricValue, { color: dish.isAvailable ? '#047857' : '#b91c1c' }]}>
                        {dish.isAvailable ? '✓ In Stock' : 'Sold Out'}
                      </Text>
                    </View>

                    {/* Freshness Row */}
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Freshness</Text>
                      <FreshnessBadge tier={dish.freshnessTier} label={dish.freshnessLabel} size="sm" />
                    </View>
                  </View>

                  {/* Add to Cart CTA */}
                  <TouchableOpacity
                    style={[styles.addBtn, inCart && styles.addBtnInCart]}
                    onPress={() =>
                      addToCart({
                        dishId: dish.menuItemId,
                        dishName: dish.dishName,
                        dishNameSwahili: dish.dishNameSw,
                        restaurantId: dish.restaurantId,
                        restaurantName: dish.restaurantName,
                        branchId: dish.branchId,
                        branchName: dish.branchName,
                        priceTzs: dish.priceTzs,
                        imageUrl: dish.imageUrl,
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.addBtnText, inCart && styles.addBtnTextInCart]}>
                      {inCart ? `✓ In Order (${inCart.quantity})` : '+ Add to Order'}
                    </Text>
                  </TouchableOpacity>

                  {/* View in Restaurant Link */}
                  <TouchableOpacity
                    style={styles.viewRestBtn}
                    onPress={() => handleOpenRestaurant(dish)}
                  >
                    <Text style={styles.viewRestBtnText}>View Full Menu →</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </ScrollView>
      )}

      {/* Floating Cart Button */}
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
        onOrderConfirmed={() => router.push('/(tabs)/bookings')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyContainer: {
    marginTop: 60,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  introHeader: {
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  columnsContainer: {
    flexDirection: 'row',
    paddingBottom: Spacing.lg,
  },
  columnCard: {
    width: 260,
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    marginRight: Spacing.md,
    ...Shadows.sm,
  },
  imageBox: {
    height: 130,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: '#edf2ee',
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  dishImg: {
    width: '100%',
    height: '100%',
  },
  imgPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgPlaceholderText: {
    fontSize: 36,
  },
  bestPriceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#047857',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  nearestBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  topRatedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#d97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  bestBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  dishName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    minHeight: 40,
  },
  dishNameSw: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 1,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  neighborhood: {
    fontSize: 11,
    color: Colors.subtle,
    marginBottom: Spacing.sm,
  },
  metricsTable: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  metricValueHighlight: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  priceValueHighlight: {
    color: '#047857',
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  addBtnInCart: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  addBtnTextInCart: {
    color: Colors.primaryDark,
  },
  viewRestBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  viewRestBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
