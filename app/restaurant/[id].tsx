import React, { useState, useMemo, useEffect } from 'react';
import { MenuRepository } from '../../repositories';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Linking,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Restaurant } from '../../types/domain';
import { ReservationModal } from '../../components/ReservationModal';
import { GoogleMapView } from '../../components/GoogleMapView';
import { Colors, Spacing, Radii, Shadows } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { useCart } from '../../context/CartContext';
import { FloatingCartButton } from '../../components/cart/FloatingCartButton';
import { CartDrawer } from '../../components/cart/CartDrawer';
import { OrderReviewModal } from '../../components/checkout/OrderReviewModal';
import { FreshnessBadge } from '../../components/ui/FreshnessBadge';
import { Badge } from '../../components/ui/Badge';
import { PriceText } from '../../components/ui/PriceText';
import { TrustService } from '../../services/TrustService';
import { TrustExplanationModal } from '../../components/trust/TrustExplanationModal';
import { ReportDiscrepancyModal } from '../../components/trust/ReportDiscrepancyModal';

function parsePriceTzs(priceStr: string | number): number {
  if (typeof priceStr === 'number') return priceStr;
  const cleaned = priceStr.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 10000;
}

export default function RestaurantDetailScreen() {
  const { id, highlightDishId } = useLocalSearchParams<{ id: string; highlightDishId?: string }>();
  const router = useRouter();
  const { t, language } = useLanguage();
  const { restaurants, favorites, toggleFavorite, loading } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const { addToCart, items, isCartOpen, setIsCartOpen } = useCart();
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isOrderReviewOpen, setIsOrderReviewOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showTrustModal, setShowTrustModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const matched = restaurants.find((r) => r.id === id);
  const restaurant: any = matched;

  const [dbMenuItems, setDbMenuItems] = useState<any[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (id) {
      setIsMenuLoading(true);
      MenuRepository.listItems(id)
        .then((items: any) => {
          if (isMounted) {
            setDbMenuItems(items);
            setIsMenuLoading(false);
          }
        })
        .catch((err: any) => {
          console.warn('RestaurantDetail: Failed to fetch live menu items:', err);
          if (isMounted) setIsMenuLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [id]);

  const menuItems = useMemo(() => {
    if (dbMenuItems && dbMenuItems.length > 0) {
      return dbMenuItems.map((item) => ({
        id: item.id,
        name: language === 'sw' && item.nameSw ? item.nameSw : (item.nameEn || item.name),
        desc: language === 'sw' && item.descriptionSw ? item.descriptionSw : (item.description || ''),
        price: `TZS ${item.basePrice.toLocaleString()}`,
        priceNum: item.basePrice,
        popular: (item as any).isPopular ?? (item as any).popular ?? false,
        category: item.categoryName || item.category || 'Dishes',
        imageUrl: item.imageUrl,
        photoUrl: item.imageUrl,
      }));
    }
    return (restaurant?.menu as any[]) || [];
  }, [dbMenuItems, restaurant?.menu, language]);

  const isFavorite = restaurant ? favorites.includes(restaurant.id) : false;
  const highlightedItem = highlightDishId ? menuItems.find((m: any) => m.id === highlightDishId) : null;
  const coverImage = restaurant?.coverImageUrl || (restaurant as any)?.foodSpotPhotos?.[0];
  const isBasicSeller = (restaurant as any)?.sellerTier === 'BASIC_SELLER';

  const restaurantAssessment = useMemo(() => {
    return TrustService.computeRestaurantTrust({
      restaurantId: restaurant?.id || '',
      restaurantName: restaurant?.name || '',
      isVerified: (restaurant as any)?.isVerified ?? false,
      verificationStatus: (restaurant as any)?.verificationStatus ?? 'PENDING_VERIFICATION',
      totalOrders: (restaurant as any)?.totalOrders ?? 0,
      completedOrders: (restaurant as any)?.completedOrders ?? 0,
      menuLastVerifiedAt: (restaurant as any)?.menuUpdatedAt || new Date().toISOString(),
    });
  }, [restaurant]);

  // Extract Categories
  const categories = useMemo(() => {
    const cats = ['All'];
    menuItems.forEach((m: any) => {
      let cat = (m as any).category;
      if (!cat) {
        const lower = ((m as any).name || '').toLowerCase();
        if (lower.includes('biryani') || lower.includes('pilau')) cat = 'Biryani & Rice';
        else if (lower.includes('kuku') || lower.includes('choma') || lower.includes('meat') || lower.includes('beef') || lower.includes('mshikaki')) cat = 'Grills & Meat';
        else if (lower.includes('juice') || lower.includes('tea') || lower.includes('chai') || lower.includes('soda')) cat = 'Drinks';
        else cat = 'Dishes';
      }
      if (!cats.includes(cat)) cats.push(cat);
    });
    return cats;
  }, [menuItems]);

  // Filter Menu
  const filteredMenu = useMemo(() => {
    if (selectedCategory === 'All') return menuItems;
    return menuItems.filter((m: any) => {
      let cat = (m as any).category;
      if (!cat) {
        const lower = ((m as any).name || '').toLowerCase();
        if (lower.includes('biryani') || lower.includes('pilau')) cat = 'Biryani & Rice';
        else if (lower.includes('kuku') || lower.includes('choma') || lower.includes('meat') || lower.includes('beef') || lower.includes('mshikaki')) cat = 'Grills & Meat';
        else if (lower.includes('juice') || lower.includes('tea') || lower.includes('chai') || lower.includes('soda')) cat = 'Drinks';
        else cat = 'Dishes';
      }
      return cat === selectedCategory;
    });
  }, [menuItems, selectedCategory]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 12, color: Colors.muted }}>
            {language === 'sw' ? 'Inapakia mkahawa...' : 'Loading restaurant...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🍽️</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' }}>
            {language === 'sw' ? 'Mkahawa Haujapatikana' : 'Restaurant Not Found'}
          </Text>
          <Text style={{ fontSize: 14, color: Colors.muted, textAlign: 'center', marginBottom: 24 }}>
            {language === 'sw'
              ? 'Mkahawa unaoutafuta haupo au umefungwa kwa sasa.'
              : 'The restaurant you are looking for does not exist or is currently unavailable.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radii.md }}
            onPress={() => router.back()}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {language === 'sw' ? 'Rudi Nyuma' : 'Go Back'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleOpenGoogleMaps = () => {
    const lat = restaurant.lat;
    const lng = restaurant.lng;
    const label = encodeURIComponent(restaurant.name + ', Dar es Salaam');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`,
    });

    Linking.openURL(url || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
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

        <Text style={styles.topTitle} numberOfLines={1}>
          {restaurant.name}
        </Text>

        <TouchableOpacity
          style={styles.favBtn}
          onPress={() => toggleFavorite(restaurant.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={isFavorite ? Colors.error : Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Visual */}
        <View
          style={[
            styles.visualBanner,
            { backgroundColor: restaurant.bgGradient ? restaurant.bgGradient[0] : '#113a26' },
          ]}
        >
          {coverImage && (
            <Image
              source={{ uri: coverImage }}
              style={[StyleSheet.absoluteFillObject, { opacity: 0.65 }]}
              resizeMode="cover"
            />
          )}
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>{restaurant.emoji || '🍲'}</Text>
          </View>
        </View>

        {/* Restaurant Header */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <Badge
              label={
                isBasicSeller
                  ? language === 'sw' ? 'MAMA LISHE' : 'COMMUNITY KITCHEN'
                  : language === 'sw' ? 'MGAHAWA ULIOHAKIKISHWA' : 'VERIFIED RESTAURANT'
              }
              variant={isBasicSeller ? 'neutral' : 'success'}
              size="sm"
            />
            <View style={[styles.openBadge, !restaurant.isOpen && styles.closedBadge]}>
              <Text style={[styles.openText, !restaurant.isOpen && styles.closedText]}>
                {restaurant.isOpen ? t('openBadge') : t('closedBadge')}
              </Text>
            </View>
          </View>

          <Text style={styles.name}>{restaurant.name}</Text>
          <Text style={styles.cuisine}>{restaurant.cuisine} • {restaurant.address}</Text>

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricStar}>★ {restaurant.rating}</Text>
              <Text style={styles.metricSub}>
                {restaurant.reviews} {language === 'sw' ? 'maoni' : 'reviews'}
              </Text>
            </View>
            <Text style={styles.divider}>|</Text>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>⏱ {restaurant.time}</Text>
              <Text style={styles.metricSub}>
                {language === 'sw' ? 'Muda wa kupika' : 'Prep time'}
              </Text>
            </View>
            <Text style={styles.divider}>|</Text>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>📍 {restaurant.distance}</Text>
              <Text style={styles.metricSub}>
                {language === 'sw' ? 'Kutoka hapa' : 'From you'}
              </Text>
            </View>
          </View>

          {/* Action CTAs */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.bookTableBtn}
              onPress={() => setIsReserveModalOpen(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} style={{ marginRight: 6 }} />
              <Text style={styles.bookTableText}>{t('reserveBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.customMealBtn}
              onPress={() => router.push('/(tabs)/custom')}
              activeOpacity={0.85}
            >
              <Ionicons name="flame-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.customMealText}>
                {language === 'sw' ? 'Mlo Maalum' : 'Custom Dish'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Why You Can Trust This Listing */}
        <View style={styles.trustCardSection}>
          <View style={styles.trustCardHeader}>
            <View style={styles.trustTitleRow}>
              <Text style={styles.trustShieldIcon}>🛡️</Text>
              <Text style={styles.trustTitleText}>
                {language === 'sw' ? 'Kwanini Unaweza Kuamini Wasifu Huu' : 'Why You Can Trust This Listing'}
              </Text>
            </View>
            <View
              style={[
                styles.trustSummaryPill,
                restaurantAssessment.badgeTone === 'positive' && styles.trustPillPositive,
                restaurantAssessment.badgeTone === 'warning' && styles.trustPillWarning,
              ]}
            >
              <Text style={styles.trustSummaryPillText}>
                {restaurantAssessment.summaryBadge}
              </Text>
            </View>
          </View>

          <View style={styles.trustGrid}>
            <View style={styles.trustMetricCol}>
              <Text style={styles.trustMetricLabel}>
                {language === 'sw' ? 'Usajili wa Kisheria' : 'Legal Verification'}
              </Text>
              <Text style={styles.trustMetricVal}>
                {restaurantAssessment.legalVerificationStatus === 'VERIFIED' ? '✓ BRELA & TIN' : 'Pending'}
              </Text>
            </View>
            <View style={styles.trustMetricCol}>
              <Text style={styles.trustMetricLabel}>
                {language === 'sw' ? 'Utekelezaji wa Oda' : 'Order Reliability'}
              </Text>
              <Text style={styles.trustMetricVal}>
                {restaurantAssessment.isLowSample
                  ? 'New Partner'
                  : `${Math.round(restaurantAssessment.bayesianReliabilityRate * 100)}% Fulfilled`}
              </Text>
            </View>
          </View>

          <View style={styles.trustActionsRow}>
            <TouchableOpacity
              style={styles.trustExplainBtn}
              onPress={() => setShowTrustModal(true)}
              accessibilityRole="button"
              accessibilityLabel="View trust details"
            >
              <Text style={styles.trustExplainBtnText}>
                {language === 'sw' ? 'Maelezo Zaidi' : 'How Trust is Calculated'} ›
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.trustReportBtn}
              onPress={() => setShowReportModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Report discrepancy"
            >
              <Text style={styles.trustReportBtnText}>
                ⚠️ {language === 'sw' ? 'Ripoti Bei / Menyu' : 'Report Error'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Highlighted Dish from Discovery (Target Intent) */}
        {highlightedItem ? (
          <View style={styles.highlightedSection}>
            <View style={styles.highlightedHeaderRow}>
              <Text style={styles.highlightedEyebrow}>
                {language === 'sw' ? 'CHAKULA ULICHOTAFUTA' : 'YOU SEARCHED FOR THIS DISH'}
              </Text>
              <FreshnessBadge tier="FRESH" label="Verified 2h ago" size="sm" />
            </View>
            <View style={styles.highlightedCard}>
              <View style={styles.highlightedLeft}>
                <Text style={styles.highlightedName}>{highlightedItem.name}</Text>
                <Text style={styles.highlightedDesc}>{highlightedItem.desc}</Text>
                <Text style={styles.highlightedPrice}>{highlightedItem.price}</Text>
              </View>
              <TouchableOpacity
                style={styles.addHighlightedBtn}
                onPress={() =>
                  addToCart({
                    dishId: highlightedItem.id,
                    dishName: highlightedItem.name,
                    restaurantId: restaurant.id,
                    restaurantName: restaurant.name,
                    priceTzs: parsePriceTzs(highlightedItem.price),
                    imageUrl: coverImage,
                  })
                }
                activeOpacity={0.85}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Add ${highlightedItem.name} to meal order`}
              >
                <Text style={styles.addHighlightedBtnText}>+ Add to Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Category Navigation Pills */}
        <View style={styles.categorySection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsRow}>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.8}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter menu by ${cat}`}
                >
                  <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Menu Items List */}
        <View style={styles.menuSection}>
          <Text style={styles.menuHeading}>
            {selectedCategory === 'All'
              ? language === 'sw' ? 'Vyakula Vinavyopatikana' : 'Available Menu'
              : selectedCategory}
          </Text>

          <View style={styles.menuList}>
            {filteredMenu.map((item) => {
              const inCart = items.find((i) => i.dishId === item.id);
              const priceVal = parsePriceTzs(item.price);

              return (
                <View key={item.id} style={styles.menuCard}>
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuTitleRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {item.popular && (
                        <View style={styles.popBadge}>
                          <Text style={styles.popBadgeText}>{t('topPickBadge')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                    <PriceText amountTzs={priceVal} size="sm" color={Colors.primary} style={styles.itemPriceText} />
                  </View>

                  <TouchableOpacity
                    style={[styles.menuAddBtn, inCart && styles.menuAddBtnInCart]}
                    onPress={() =>
                      addToCart({
                        dishId: item.id,
                        dishName: item.name,
                        restaurantId: restaurant.id,
                        restaurantName: restaurant.name,
                        priceTzs: priceVal,
                        imageUrl: coverImage,
                      })
                    }
                    activeOpacity={0.85}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name} to meal order`}
                  >
                    <Text style={[styles.menuAddBtnText, inCart && styles.menuAddBtnTextInCart]}>
                      {inCart ? `✓ ${inCart.quantity}` : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* GOOGLE MAPS LOCATION & DIRECTIONS SECTION */}
        <View style={styles.mapSectionCard}>
          <View style={styles.mapSectionHeader}>
            <View>
              <Text style={styles.mapSectionEyebrow}>
                {language === 'sw' ? 'ENEO NA MAELEKEZO' : 'LOCATION & DIRECTIONS'}
              </Text>
              <Text style={styles.mapSectionTitle}>
                {language === 'sw' ? 'Ramani ya Google Maps' : 'Google Maps Location'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.openMapsHeaderBtn}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate-outline" size={14} color={Colors.white} />
              <Text style={styles.openMapsHeaderText}>
                {language === 'sw' ? 'Elekea Huko' : 'Directions'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.mapAddressText}>📍 {restaurant.address}</Text>

          {/* Interactive Map Component */}
          <View style={styles.mapWrap}>
            <GoogleMapView
              restaurants={[restaurant as any]}
              selectedRestaurantId={restaurant.id}
              height={200}
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Cart Button */}
      <FloatingCartButton />

      {/* Cart Drawer */}
      <CartDrawer
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => setIsOrderReviewOpen(true)}
      />

      {/* Order Review & Checkout Modal */}
      <OrderReviewModal
        visible={isOrderReviewOpen}
        onClose={() => setIsOrderReviewOpen(false)}
        onOrderConfirmed={() => router.push('/(tabs)/bookings')}
      />

      {/* Reservation Modal */}
      <ReservationModal
        visible={isReserveModalOpen}
        restaurant={restaurant as any}
        onClose={() => setIsReserveModalOpen(false)}
      />

      {/* Trust Details Modal */}
      <TrustExplanationModal
        visible={showTrustModal}
        onClose={() => setShowTrustModal(false)}
        restaurantAssessment={restaurantAssessment}
        onOpenReportModal={() => setShowReportModal(true)}
      />

      {/* Discrepancy Reporting Modal */}
      <ReportDiscrepancyModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        dishName={restaurant.name + ' Listing'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  largeScreenContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  visualBanner: {
    height: 180,
    width: '100%',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  emojiCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -32,
    ...Shadows.md,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  emoji: {
    fontSize: 32,
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    paddingTop: 40,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  openBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  closedBadge: {
    backgroundColor: Colors.surfaceSecondary,
  },
  openText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  closedText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  cuisine: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricStar: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metricSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    color: Colors.border,
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  bookTableBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTableText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  customMealBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customMealText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  highlightedSection: {
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: '#FFFBEB',
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  highlightedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  highlightedEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  highlightedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginTop: 4,
  },
  highlightedLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  highlightedName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  highlightedDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  highlightedPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 4,
  },
  addHighlightedBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.sm,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
  },
  addHighlightedBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  categorySection: {
    marginVertical: Spacing.sm,
  },
  categoryPillsRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.white,
  },
  menuSection: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  menuHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  menuList: {
    gap: Spacing.sm,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  menuItemLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  popBadge: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.full,
    marginLeft: 6,
  },
  popBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accentDark,
  },
  itemDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemPriceText: {
    marginTop: 4,
  },
  menuAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.sm,
    backgroundColor: Colors.primary,
  },
  menuAddBtnInCart: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  menuAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  menuAddBtnTextInCart: {
    color: Colors.primaryDark,
  },
  mapSectionCard: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginTop: Spacing.lg,
  },
  mapSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  mapSectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  mapSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  openMapsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  openMapsHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
    marginLeft: 4,
  },
  mapAddressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  mapWrap: {
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  trustCardSection: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trustCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
    gap: 6,
  },
  trustTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustShieldIcon: {
    fontSize: 16,
  },
  trustTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  trustSummaryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    backgroundColor: '#E2E8F0',
  },
  trustSummaryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  trustGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  trustMetricCol: {
    flex: 1,
  },
  trustMetricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  trustMetricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  trustActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  trustExplainBtn: {
    paddingVertical: 4,
  },
  trustExplainBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  trustReportBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.sm,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  trustReportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  trustPillPositive: {
    backgroundColor: '#DCFCE7',
  },
  trustPillWarning: {
    backgroundColor: '#FEF3C7',
  },
});
