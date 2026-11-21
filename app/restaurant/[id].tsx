import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Restaurant } from '../../types/domain';
import { MenuRepository } from '../../repositories';
import { BranchRepository } from '../../repositories/branches.repository';
import { RestaurantRepository } from '../../repositories/restaurants.repository';
import { BranchOperationsRepository } from '../../repositories/branchOperations.repository';
import { runtimeConfig } from '../../lib/runtimeConfig';
import { directionsUrl } from '../../utils/directions';
import { ReservationModal } from '../../components/ReservationModal';
import { GoogleMapView } from '../../components/GoogleMapView';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { useCart } from '../../context/CartContext';
import { useCartInteraction } from '../../hooks/useCartInteraction';
import { useCustomerLocation } from '../../context/CustomerLocationContext';
import { CustomerCartHost } from '../../components/cart/CustomerCartHost';
import { TrustService } from '../../services/TrustService';
import { TrustExplanationModal } from '../../components/trust/TrustExplanationModal';
import { ReportDiscrepancyModal } from '../../components/trust/ReportDiscrepancyModal';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

import {
  RestaurantHeader,
  RestaurantDecisionFacts,
  MenuSection,
  CategoryTabBar,
  HighlightedDishBanner,
  RestaurantSkeleton,
  RestaurantErrorView,
  MenuItem,
  CategoryItem,
  createRestaurantDetailStyles,
} from '../../components/restaurant-page';
import {
  jumpTargetY,
  activeCategoryAt,
  tabPillScrollX,
} from '../../utils/menuScroll';

let colors: ThemeColors = lightColors;

function parsePriceTzs(priceStr: string | number): number {
  if (typeof priceStr === 'number') return priceStr;
  const cleaned = String(priceStr).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 10000;
}

export default function RestaurantDetailScreen() {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createRestaurantDetailStyles(colors);
  const { id, highlightDishId } = useLocalSearchParams<{ id: string; highlightDishId?: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const { restaurants, favorites, toggleFavorite, loading } = useMloHubDB();
  const { location: customerLocation } = useCustomerLocation();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const { items } = useCart();
  const { requestAddToCart, isDishAddPending } = useCartInteraction();

  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showTrustModal, setShowTrustModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const tabScrollViewRef = useRef<ScrollView | null>(null);
  const menuContainerYRef = useRef<number>(0);
  const categoryRelativeOffsetsRef = useRef<Record<string, number>>({});
  const tabPillOffsetsRef = useRef<Record<string, { x: number; width: number }>>({});
  const isJumpingRef = useRef<boolean>(false);
  const jumpTimeoutRef = useRef<any>(null);

  const handleTabPress = (cat: string) => {
    setActiveCategory(cat);
    isJumpingRef.current = true;
    if (jumpTimeoutRef.current) {
      clearTimeout(jumpTimeoutRef.current);
    }
    jumpTimeoutRef.current = setTimeout(() => {
      isJumpingRef.current = false;
    }, 600);

    const targetY = jumpTargetY({
      category: cat,
      menuContainerY: menuContainerYRef.current,
      categoryRelativeOffsets: categoryRelativeOffsetsRef.current,
      tabBarHeight: 52,
    });

    scrollViewRef.current?.scrollTo({ y: targetY, animated: true });

    const tabX = tabPillScrollX({
      activeCategory: cat,
      tabPillOffsets: tabPillOffsetsRef.current,
      paddingLeft: 24,
    });
    tabScrollViewRef.current?.scrollTo({ x: tabX, animated: true });
  };

  const handleScroll = (e: any) => {
    if (isJumpingRef.current) return;
    const scrollY = e.nativeEvent?.contentOffset?.y ?? 0;
    const currentActive = activeCategoryAt({
      scrollY,
      menuContainerY: menuContainerYRef.current,
      categoryRelativeOffsets: categoryRelativeOffsetsRef.current,
      categories,
      tabBarHeight: 52,
    });
    if (currentActive !== activeCategory) {
      setActiveCategory(currentActive);
      const tabX = tabPillScrollX({
        activeCategory: currentActive,
        tabPillOffsets: tabPillOffsetsRef.current,
        paddingLeft: 24,
      });
      tabScrollViewRef.current?.scrollTo({ x: tabX, animated: true });
    }
  };

  // 1. Matched or Direct Fallback
  const matched = restaurants.find((r) => r.id === id);
  const [directRestaurant, setDirectRestaurant] = useState<Restaurant | null>(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);

  const fetchDirectRestaurant = () => {
    if (!id) return;
    setIsDirectLoading(true);
    RestaurantRepository.getById(id)
      .then((fetched) => {
        setDirectRestaurant(fetched);
        setIsDirectLoading(false);
      })
      .catch((err) => {
        console.warn('RestaurantDetail: direct fetch failed:', err);
        setIsDirectLoading(false);
      });
  };

  useEffect(() => {
    if (!loading && !matched && id) {
      fetchDirectRestaurant();
    } else if (matched) {
      setDirectRestaurant(null);
      setIsDirectLoading(false);
    }
  }, [loading, matched, id]);

  const candidateRestaurant = matched || directRestaurant;
  const isAvailableForCustomers =
    candidateRestaurant &&
    !candidateRestaurant.isSuspended &&
    candidateRestaurant.verificationStatus !== 'SUSPENDED' &&
    candidateRestaurant.verificationStatus !== 'REJECTED' &&
    candidateRestaurant.verificationStatus !== 'PENDING_VERIFICATION' &&
    (candidateRestaurant as any).isVerified !== false &&
    candidateRestaurant.isActive !== false &&
    candidateRestaurant.isPublished !== false &&
    (candidateRestaurant as any).launchStatus === 'PUBLISHED' &&
    (!matched ||
      (matched.verificationStatus !== 'PENDING_VERIFICATION' &&
        matched.isPublished !== false &&
        (matched as any).launchStatus === 'PUBLISHED'));

  const restaurant: any = isAvailableForCustomers ? candidateRestaurant : undefined;

  // 2. Branches, Operating Hours & Delivery Zones
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);
  const [operatingHours, setOperatingHours] = useState<any[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      BranchRepository.listByRestaurant(id)
        .then((bList) => {
          const activeBranches = bList.filter((b: any) => b.isActive !== false);
          const resolvedList = activeBranches.length > 0 ? activeBranches : bList;
          setBranches(resolvedList);
          if (resolvedList.length > 0) setSelectedBranch(resolvedList[0]);
        })
        .catch((err) => console.warn('RestaurantDetail: branch list failed:', err));
    }
  }, [id]);

  useEffect(() => {
    const branchId = selectedBranch?.id || branches[0]?.id;
    if (branchId) {
      Promise.all([
        BranchOperationsRepository.getOperatingHours(branchId).catch(() => []),
        BranchOperationsRepository.getDeliveryZones(branchId).catch(() => []),
      ]).then(([hours, zones]) => {
        setOperatingHours(hours || []);
        setDeliveryZones(zones || []);
      });
    }
  }, [selectedBranch?.id, branches]);

  // 3. Dynamic Menu Loading from Repository
  const [dbMenuItems, setDbMenuItems] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<CategoryItem[]>([]);
  const [branchPrices, setBranchPrices] = useState<any[]>([]);
  const [branchItemStates, setBranchItemStates] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      Promise.all([
        MenuRepository.listItems(id),
        MenuRepository.listCategories(id).catch(() => []),
      ]).then(([mItems, mCats]: [any, any]) => {
        setDbMenuItems(mItems || []);
        setDbCategories(mCats || []);
      });
    }
  }, [id]);

  useEffect(() => {
    const branchIdToQuery = selectedBranch?.id || branches[0]?.id;
    if (branchIdToQuery) {
      Promise.all([
        MenuRepository.listBranchPrices(branchIdToQuery).catch(() => []),
        MenuRepository.getBranchMenuItems(branchIdToQuery).catch(() => []),
      ]).then(([prices, itemStates]) => {
        setBranchPrices(prices || []);
        setBranchItemStates(itemStates || []);
      });
    }
  }, [selectedBranch?.id, branches]);

  // 4. Resolve Menu Items with effective prices & categories
  const menuItems: MenuItem[] = useMemo(() => {
    if (dbMenuItems && dbMenuItems.length > 0) {
      const catMap = new Map<string, string>();
      for (const c of dbCategories) {
        catMap.set(c.id, language === 'sw' && c.nameSw ? c.nameSw : c.nameEn || c.name);
      }
      return dbMenuItems
        .filter((item) => {
          const bs = branchItemStates.find((s: any) => s.menuItemId === item.id);
          return bs?.operationalStatus !== 'HIDDEN';
        })
        .map((item) => {
          const bp = branchPrices.find((p: any) => p.menuItemId === item.id);
          const bs = branchItemStates.find((s: any) => s.menuItemId === item.id);
          const effectivePrice =
            bp?.priceTzs && bp.priceTzs > 0
              ? bp.priceTzs
              : bs?.priceOverrideTzs && bs.priceOverrideTzs > 0
              ? bs.priceOverrideTzs
              : item.basePrice;
          const isBranchAvail =
            (bp ? bp.isAvailable !== false : true) &&
            (bs ? bs.isAvailable !== false && bs.operationalStatus !== 'SOLD_OUT_TODAY' : true);
          const isAvailable = item.isAvailable !== false && isBranchAvail;
          const resolvedCat =
            (item.categoryId && catMap.get(item.categoryId)) ||
            item.categoryName ||
            item.category ||
            (language === 'sw' ? 'Vyakula' : 'Dishes');

          return {
            id: item.id,
            name: language === 'sw' && item.nameSw ? item.nameSw : item.nameEn || item.name,
            nameSw: item.nameSw,
            desc: language === 'sw' && item.descriptionSw ? item.descriptionSw : item.description || '',
            price: `TZS ${effectivePrice.toLocaleString()}`,
            priceNum: effectivePrice,
            popular: (item as any).isPopular ?? (item as any).popular ?? false,
            category: resolvedCat,
            categoryId: item.categoryId,
            imageUrl: item.imageUrl,
            photoUrl: item.imageUrl,
            isAvailable,
          };
        });
    }
    return ((restaurant?.menu as any[]) || []).map((m) => ({
      ...m,
      priceNum: parsePriceTzs(m.price),
      isAvailable: m.isAvailable !== false,
      category: m.category || (language === 'sw' ? 'Vyakula' : 'Dishes'),
    }));
  }, [dbMenuItems, dbCategories, branchPrices, branchItemStates, restaurant?.menu, language]);

  const categories = useMemo(() => {
    const cats = ['All'];
    menuItems.forEach((m) => {
      const cat = m.category || (language === 'sw' ? 'Vyakula' : 'Dishes');
      if (!cats.includes(cat)) cats.push(cat);
    });
    return cats;
  }, [menuItems, language]);

  const supportsReservations = useMemo(() => {
    return (
      (restaurant as any)?.reservationsEnabled === true ||
      (restaurant as any)?.reservations_enabled === true ||
      branches.some((b) => b.reservationsEnabled === true || b.reservations_enabled === true)
    );
  }, [restaurant, branches]);

  const restaurantAssessment = useMemo(() => {
    return TrustService.computeRestaurantTrust({
      restaurantId: restaurant?.id || '',
      restaurantName: restaurant?.name || '',
      isVerified: (restaurant as any)?.isVerified ?? false,
      verificationStatus: (restaurant as any)?.verificationStatus ?? 'PENDING_VERIFICATION',
      totalOrders: (restaurant as any)?.totalOrders ?? 0,
      completedOrders: (restaurant as any)?.completedOrders ?? 0,
      menuLastVerifiedAt:
        (restaurant as any)?.menuUpdatedAt || (restaurant as any)?.menuLastVerifiedAt || undefined,
    });
  }, [restaurant]);

  // Dish availability badge: language === 'sw' ? 'Imeisha' : 'Sold Out'
  const handleAddToCart = (dish: MenuItem, sourceRef?: React.RefObject<View | null>) => {
    if (isDishAddPending(dish.id) || dish.isAvailable === false) return;
    const targetBranchId =
      selectedBranch?.id || branches[0]?.id || restaurant?.branchId || restaurant?.id;
    const targetBranchName = selectedBranch?.name || branches[0]?.name || restaurant?.name;

    void requestAddToCart(
      {
        dishId: dish.id,
        dishName: dish.name,
        dishNameSwahili: dish.nameSw,
        description: dish.desc,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        branchId: targetBranchId,
        branchName: targetBranchName,
        priceTzs: dish.priceNum,
        imageUrl: dish.imageUrl,
      },
      { sourceRef }
    );
  };

  const getItemCartQuantity = (dishId: string) => {
    return items.filter((i) => i.dishId === dishId).reduce((sum, i) => sum + i.quantity, 0);
  };

  const isPageLoading = loading || (Boolean(id) && !matched && isDirectLoading);

  if (isPageLoading) {
    return <RestaurantSkeleton />;
  }

  if (!restaurant) {
    return <RestaurantErrorView message={language === 'sw' ? 'Mkahawa Haujapatikana' : 'Restaurant Not Found'} onRetry={fetchDirectRestaurant} />;
  }

  const isFavorite = favorites.includes(restaurant.id);
  const highlightedItem = highlightDishId ? menuItems.find((m) => m.id === highlightDishId) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.topTitle} numberOfLines={1}>
          {restaurant.name}
        </Text>

        {runtimeConfig.allowLocalDataFallbacks ? (
          <TouchableOpacity
            style={styles.favBtn}
            onPress={() => toggleFavorite(restaurant.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove favorite' : 'Add favorite'}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? colors.error : colors.textPrimary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.favBtn} />
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.largeScreenContainer]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Child 0: Single Wrapper View with Header, Facts, and optional Highlighted Dish */}
        <View style={styles.topInfoSlot}>
          {/* 1. Header with Cover, Logo, Verified badge & Reservation CTA */}
          <RestaurantHeader
            restaurant={restaurant}
            supportsReservations={supportsReservations}
            onOpenReserveModal={() => setIsReserveModalOpen(true)}
          />

          {/* 2. Decision Facts Row: Open/Opens At/Closed, Delivery fee & time, Min order, Distance, Services */}
          <RestaurantDecisionFacts
            restaurant={restaurant}
            branch={selectedBranch}
            operatingHours={operatingHours}
            deliveryZones={deliveryZones}
            customerArea={customerLocation?.serviceAreaName || customerLocation?.cityName}
            customerCoords={customerLocation?.latitude ? { latitude: customerLocation.latitude, longitude: customerLocation.longitude } : undefined}
            supportsReservations={supportsReservations}
          />

          {/* Optional Highlighted Dish from Discovery (Target Intent) */}
          {highlightedItem ? (
            <HighlightedDishBanner
              dish={highlightedItem}
              onAddToCart={handleAddToCart}
              isPending={isDishAddPending(highlightedItem.id)}
            />
          ) : null}
        </View>

        {/* Child 1: Sticky Category Tab Bar (Always strictly Child 1 for stickyHeaderIndices={[1]}) */}
        <View style={styles.stickyTabBarWrap}>
          <CategoryTabBar
            categories={categories}
            activeCategory={activeCategory}
            onSelectCategory={handleTabPress}
            tabScrollViewRef={tabScrollViewRef}
            onPillLayout={(cat, layout) => {
              tabPillOffsetsRef.current[cat] = layout;
            }}
          />
        </View>

        {/* Child 2: Menu Categories & Dish Cards (Rendering all categories, recording relative section offsets) */}
        <View
          style={styles.menuBodySlot}
          onLayout={(e) => {
            menuContainerYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <MenuSection
            categories={categories}
            dbCategories={dbCategories}
            menuItems={menuItems}
            onAddToCart={handleAddToCart}
            isDishAddPending={isDishAddPending}
            getItemCartQuantity={getItemCartQuantity}
            restaurant={restaurant}
            selectedBranch={selectedBranch}
            onSectionLayout={(cat, relY) => {
              categoryRelativeOffsetsRef.current[cat] = relY;
            }}
          />
        </View>

        {/* 4. Google Maps Location Card */}
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
              style={styles.openMapsBtn}
              onPress={() => Linking.openURL(directionsUrl(restaurant)).catch(() => undefined)}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate-outline" size={14} color={colors.onPrimary} />
              <Text style={styles.openMapsBtnText}>
                {language === 'sw' ? 'Elekea Huko' : 'Directions'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.mapAddressText}>📍 {restaurant.address || restaurant.neighborhood}</Text>
          <View style={styles.mapWrap}>
            <GoogleMapView
              restaurants={[restaurant as any]}
              selectedRestaurantId={restaurant.id}
              height={200}
            />
          </View>
        </View>
      </ScrollView>

      {/* Unified Customer Cart Host */}
      <CustomerCartHost
        showWhenEmpty={true}
        isVerifiedRestaurant={(restaurant as any)?.isVerified || false}
      />

      {/* Reservation Modal */}
      <ReservationModal
        visible={isReserveModalOpen}
        restaurant={restaurant as any}
        onClose={() => setIsReserveModalOpen(false)}
      />

      {/* Trust Details & Discrepancy Modals */}
      <TrustExplanationModal
        visible={showTrustModal}
        onClose={() => setShowTrustModal(false)}
        restaurantAssessment={restaurantAssessment}
        onOpenReportModal={() => setShowReportModal(true)}
      />
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
