import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { OrderPipelineService } from '../../services/OrderPipelineService';
import { RealtimeEventEngine } from '../../db/realtime/eventEngine';
import { RealtimeService } from '../../services/RealtimeService';
import { RestaurantEntity } from '../../db/types';
import { resolvePortalAccess } from '../../db/auth/guards';
import { RestaurantRole } from '../../types/auth';
import {
  Order,
  OrderStatus,
  MenuItem,
  MenuCategory,
  Reservation,
  ReservationStatus,
  RestaurantBranch,
  Payment,
  Review,
  BranchOperationalMode,
} from '../../types/domain';
import { runtimeConfig } from '../../lib/runtimeConfig';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  RestaurantRepository,
  BranchRepository,
  MenuRepository,
  OrderRepository,
  ReservationRepository,
  PaymentRepository,
  ReviewRepository,
  RestaurantMemberRepository,
  CustomMealRepository,
  RestaurantCustomMealSettingsRepository,
  ReviewResponsesRepository,
  BranchOperationsRepository,
} from '../../repositories';

import {
  RestaurantPortalHeader,
  RealtimeStatus,
  RestaurantSidebar,
  RestaurantMobileNav,
  RestaurantTab,
  RESTAURANT_NAV_ITEMS,
  DashboardOverview,
  DashboardMetrics,
  AttentionAlert,
  IncomingOrdersPanel,
  KitchenBoard,
  CustomMealQuotesPanel,
  MenuManager,
  MenuItemEditor,
  BranchPriceOverride,
  CategoryManager,
  ReservationManager,
  EarningsOverview,
  EarningsRecord,
  ReviewsPanel,
  AnalyticsPanel,
  DiscoveryAnalyticsData,
  StaffManager,
  StaffMember,
  RestaurantSettings,
  OperatingOverride,
} from '../../components/restaurant';

export default function RestaurantPortalScreen() {
  const router = useRouter();
  const {
    user: authUser,
    isAuthLoading,
    memberships,
    activeRestaurant: authActiveRestaurant,
    activeWorkspace,
    switchWorkspace,
  } = useAuth();

  const access = resolvePortalAccess({
    isAuthLoading,
    user: authUser,
    memberships,
    activeRestaurant: authActiveRestaurant,
    activeWorkspace,
  });

  if (access.status === 'LOADING') {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.gateSubtitle}>Inapakia mfumo wa mgahawa...</Text>
      </SafeAreaView>
    );
  }

  if (access.status === 'UNAUTHENTICATED') {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Ionicons name="lock-closed-outline" size={54} color={Colors.primary} />
          <Text style={styles.gateTitle}>Kuingia Kunahitajika</Text>
          <Text style={styles.gateSubtitle}>
            Unatakiwa kuingia kwenye akaunti yako ya mgahawa ili kufikia ukurasa huu.
          </Text>
          <TouchableOpacity
            style={styles.gatePrimaryBtn}
            onPress={() => router.replace('/auth')}
          >
            <Text style={styles.gatePrimaryBtnText}>Ingia / Jisajili</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gateSecondaryBtnText}>Rudi Mwanzo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (access.status === 'DENIED') {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Ionicons name="shield-outline" size={54} color="#ef4444" />
          <Text style={styles.gateTitle}>Hakuna Idhini</Text>
          <Text style={styles.gateSubtitle}>
            Akaunti hii imesajiliwa kama mteja pekee. Ukurasa huu ni wa wamiliki na wasimamizi wa migahawa pekee.
          </Text>
          <TouchableOpacity
            style={styles.gatePrimaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gatePrimaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/(tabs)/profile')}
          >
            <Text style={styles.gateSecondaryBtnText}>Tazama Profaili Yangu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (access.status === 'CUSTOMER_WORKSPACE') {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Ionicons name="storefront-outline" size={54} color={Colors.primary} />
          <Text style={styles.gateTitle}>Mazingira ya Mteja</Text>
          <Text style={styles.gateSubtitle}>
            Kwa sasa upo kwenye akaunti ya mteja. Ili kuona na kusimamia jikoni, badilisha mazingira yako kuwa ya usimamizi wa mgahawa.
          </Text>
          {(access.availableRestaurants || []).map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.gatePrimaryBtn, { marginBottom: 8 }]}
              onPress={async () => {
                try {
                  await switchWorkspace('RESTAURANT_OWNER', r.id);
                } catch (e: any) {
                  Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili mazingira.');
                }
              }}
            >
              <Text style={styles.gatePrimaryBtnText}>Simamia {r.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gateSecondaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (access.status === 'AWAITING_ASSIGNMENT' || !access.restaurant) {
    return (
      <SafeAreaView style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Ionicons name="restaurant-outline" size={54} color={Colors.primary} />
          <Text style={styles.gateTitle}>Inasubiri Kuunganishwa na Mgahawa</Text>
          <Text style={styles.gateSubtitle}>
            Akaunti yako haijaunganishwa na mgahawa wowote uliothibitishwa bado. Wasiliana na msimamizi au sajili mgahawa wako.
          </Text>
          <TouchableOpacity
            style={styles.gatePrimaryBtn}
            onPress={() => router.replace('/auth/register-restaurant')}
          >
            <Text style={styles.gatePrimaryBtnText}>Sajili Mgahawa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gateSecondaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.gateSecondaryBtnText}>Rudi Nyumbani</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <RestaurantPortalContent
      key={access.restaurant.id}
      initialRestaurant={access.restaurant}
    />
  );
}

function mapDomainRestaurantToEntity(rest: any): RestaurantEntity {
  return {
    id: rest.id,
    ownerId: rest.ownerId || '',
    sellerTier: rest.sellerTier || 'BASIC_SELLER',
    name: rest.name,
    slug: rest.slug || rest.name.toLowerCase().replace(/\s+/g, '-'),
    cuisine: rest.cuisine || 'Local',
    description: rest.description,
    rating: Number(rest.rating) || 0,
    reviewsCount: rest.reviewsCount || 0,
    minPrice: rest.minPriceTzs ?? rest.minPrice ?? 0,
    maxPrice: rest.maxPriceTzs ?? rest.maxPrice ?? 0,
    address: rest.address || '',
    neighborhood: rest.neighborhood || '',
    regionCity: rest.regionCity || '',
    distanceKm: Number(rest.distanceKm) || 0,
    estimatedPrepTimeMinutes: rest.estimatedPrepTimeMinutes || 20,
    isOpen: rest.isOpen ?? false,
    isVerified: rest.isVerified ?? false,
    verificationStatus: rest.verificationStatus || 'PENDING_VERIFICATION',
    logoUrl: rest.logoUrl,
    coverImageUrl: rest.coverImageUrl,
    emoji: rest.emoji || '🍲',
    specialty: rest.specialty || rest.cuisine || '',
    tags: rest.tags || [],
    menu: [],
    createdAt: rest.createdAt || new Date().toISOString(),
    updatedAt: rest.updatedAt || new Date().toISOString(),
  };
}

function RestaurantPortalContent({ initialRestaurant }: { initialRestaurant: RestaurantEntity }) {
  const router = useRouter();
  const { language } = useLanguage();
  const { user: authUser, memberships, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 900;

  // 1. Workspace State
  const [activeRestaurant, setActiveRestaurant] = useState<RestaurantEntity>(initialRestaurant);
  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [domainOrders, setDomainOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [customMealInvitations, setCustomMealInvitations] = useState<any[]>([]);
  const [branchPrices, setBranchPrices] = useState<{ branchId: string; menuItemId: string; priceTzs: number }[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('LIVE');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestLoadError, setRequestLoadError] = useState<string | null>(null);

  // 2. Determine User Role for this Restaurant - STRICT: Derived ONLY from public.restaurant_members!
  const userMembership = useMemo(() => {
    return (memberships || []).find(
      (m: any) => m.restaurantId === activeRestaurant.id && (m.status === 'ACTIVE' || m.isActive !== false)
    );
  }, [memberships, activeRestaurant.id]);

  const userRole: RestaurantRole = useMemo(() => {
    if (userMembership?.role) return userMembership.role as RestaurantRole;
    if (runtimeConfig.allowLocalDataFallbacks) {
      if (activeRestaurant.ownerId && authUser?.id && activeRestaurant.ownerId === authUser.id) {
        return 'OWNER';
      }
      return 'OWNER';
    }
    return 'STAFF';
  }, [userMembership, activeRestaurant.ownerId, authUser?.id]);

  // 3. Determine Allowed Tabs
  const allowedTabs = useMemo(() => {
    return RESTAURANT_NAV_ITEMS.filter((item) => item.allowedRoles.includes(userRole)).map((item) => item.id);
  }, [userRole]);

  // 4. Navigation State
  const initialTab: RestaurantTab = allowedTabs.includes('overview')
    ? 'overview'
    : allowedTabs.includes('kitchen')
    ? 'kitchen'
    : allowedTabs[0] || 'orders';

  const [activeTab, setActiveTab] = useState<RestaurantTab>(initialTab);

  // 5. Menu Modals State
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isCategoryManagerVisible, setIsCategoryManagerVisible] = useState(false);

  // 6. loadRestaurantWorkspace - Authoritative Supabase Workspace Loader
  const loadRestaurantWorkspace = useCallback(async () => {
    try {
      if (runtimeConfig.allowLocalDataFallbacks && !isSupabaseConfigured()) {
        const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
        const dbRest = DemoAuthAdapter.resolveActiveRestaurant(activeRestaurant.id);
        if (dbRest) setActiveRestaurant(dbRest);
        const restBranches = (dbRest as any)?.branches || [];
        setBranches(restBranches);
        if (restBranches.length > 0 && !selectedBranchId) {
          setSelectedBranchId(restBranches[0].id);
        }
        setMenuItems((dbRest?.menu || []) as any);
        return;
      }

      const [
        fetchedRest,
        fetchedBranches,
        fetchedCategories,
        fetchedItems,
        fetchedOrders,
        fetchedReservations,
        fetchedPayments,
        fetchedReviews,
        fetchedStaff,
        fetchedCustomMeals,
      ] = await Promise.all([
        RestaurantRepository.getById(activeRestaurant.id).catch(() => null),
        BranchRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        MenuRepository.listCategories(activeRestaurant.id).catch(() => []),
        MenuRepository.listItems(activeRestaurant.id).catch(() => []),
        OrderRepository.listOrdersForRestaurant(activeRestaurant.id).catch(() => []),
        ReservationRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        PaymentRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        ReviewRepository.listForRestaurant(activeRestaurant.id).catch(() => []),
        RestaurantMemberRepository.listByRestaurant(activeRestaurant.id).catch(() => []),
        CustomMealRepository.listInvitedRequestsForRestaurant(activeRestaurant.id).then((items) => { setRequestLoadError(null); return items; }).catch((error) => { setRequestLoadError(error.message || 'Could not load food requests. Refresh to retry.'); return null; }),
      ]);

      if (fetchedRest) {
        setActiveRestaurant(mapDomainRestaurantToEntity(fetchedRest));
      }
      setBranches(fetchedBranches);
      if (fetchedBranches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(fetchedBranches[0].id);
      }
      setCategories(fetchedCategories);
      setMenuItems(fetchedItems);
      setDomainOrders(fetchedOrders);
      setReservations(fetchedReservations);
      setPayments(fetchedPayments);
      setReviews(fetchedReviews);
      setStaffList(fetchedStaff);
      if (fetchedCustomMeals) setCustomMealInvitations(fetchedCustomMeals);

      if (selectedBranchId || fetchedBranches.length > 0) {
        const branchToQuery = selectedBranchId || fetchedBranches[0].id;
        const prices = await MenuRepository.listBranchPrices(branchToQuery).catch(() => []);
        setBranchPrices(prices);
      }
    } catch (err) {
      console.warn('[RestaurantPortal] Error loading workspace:', err);
    }
  }, [activeRestaurant.id, selectedBranchId]);

  useEffect(() => {
    loadRestaurantWorkspace();
  }, [loadRestaurantWorkspace]);

  // 7. Realtime Listener
  useEffect(() => {
    let isMounted = true;

    const handleRealtimeEvent = () => {
      if (isMounted) {
        loadRestaurantWorkspace();
      }
    };

    const unsubscribeStatus = RealtimeService.onStatusChange((status) => {
      if (isMounted) {
        setRealtimeStatus(status.state === 'LIVE' ? 'LIVE' : 'OFFLINE');
      }
    });

    const unsubscribeResync = RealtimeService.registerResyncCallback(`rest_portal_${activeRestaurant.id}`, () => {
      if (isMounted) {
        loadRestaurantWorkspace();
      }
    });

    const unsubscribeOrders = RealtimeEventEngine.subscribe('orders:*', handleRealtimeEvent);
    const unsubscribeRestaurant = RealtimeService.subscribeToRestaurantOrders(activeRestaurant.id, () => handleRealtimeEvent());
    const unsubscribeMenu = RealtimeService.subscribeToMenu(activeRestaurant.id, () => handleRealtimeEvent());
    const unsubscribeReservations = RealtimeService.subscribeToReservations(activeRestaurant.id, () => handleRealtimeEvent());
    const unsubscribeCustomMeals = RealtimeService.subscribeToCustomMeals(activeRestaurant.id, () => handleRealtimeEvent());

    return () => {
      isMounted = false;
      unsubscribeStatus();
      unsubscribeResync();
      unsubscribeOrders();
      unsubscribeRestaurant();
      unsubscribeMenu();
      unsubscribeReservations();
      unsubscribeCustomMeals();
    };
  }, [activeRestaurant.id, loadRestaurantWorkspace]);

  // 8. Order Filtering
  const pendingOrders = useMemo(() => domainOrders.filter((o) => o.status === 'PENDING'), [domainOrders]);
  const kitchenOrders = useMemo(
    () => domainOrders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING' || o.status === 'READY'),
    [domainOrders]
  );

  // 9. Branch Overrides
  const branchOverrides: BranchPriceOverride[] = useMemo(() => {
    return branches.map((b) => {
      const override = branchPrices.find((bp) => bp.branchId === b.id && bp.menuItemId === editingItem?.id);
      return {
        branchId: b.id,
        branchName: b.name,
        customPriceTzs: override?.priceTzs,
      };
    });
  }, [branches, branchPrices, editingItem?.id]);

  // 10. Attention Alerts Feed
  const alerts: AttentionAlert[] = useMemo(() => {
    const list: AttentionAlert[] = [];

    if (pendingOrders.length > 0) {
      list.push({
        id: 'alert-pending-orders',
        type: 'ORDER',
        severity: 'HIGH',
        title: language === 'sw' ? 'Oda Mpya Zinazosubiri' : 'Pending Incoming Orders',
        description:
          language === 'sw'
            ? `Kuna oda ${pendingOrders.length} zinahitaji kukubaliwa mara moja jikoni.`
            : `You have ${pendingOrders.length} order(s) waiting for kitchen acceptance.`,
        actionLabel: language === 'sw' ? 'Tazama Oda' : 'Review Orders',
        targetTab: 'orders',
      });
    }

    const itemsNeedingVerification = menuItems.filter((item) => {
      const updatedMs = new Date(item.updatedAt).getTime();
      const diffDays = (Date.now() - updatedMs) / (1000 * 60 * 60 * 24);
      return diffDays > 7;
    });

    if (itemsNeedingVerification.length > 0) {
      list.push({
        id: 'alert-verify-menu',
        type: 'VERIFICATION',
        severity: 'MEDIUM',
        title: language === 'sw' ? 'Thibitisha Bei za Menyu' : 'Price Verification Overdue',
        description:
          language === 'sw'
            ? `Vyakula ${itemsNeedingVerification.length} havijathibitishwa kwa zaidi ya siku 7. Vithibitishe kupata nafasi ya kwanza discovery.`
            : `${itemsNeedingVerification.length} dish(es) have unverified prices. Verify now to maintain top discovery ranking.`,
        actionLabel: language === 'sw' ? 'Thibitisha Menyu' : 'Verify Menu',
        targetTab: 'menu',
      });
    }

    const unavailableItems = menuItems.filter((m) => !m.isAvailable);
    if (unavailableItems.length > 0) {
      list.push({
        id: 'alert-stock',
        type: 'STOCK',
        severity: 'INFO',
        title: language === 'sw' ? 'Vyakula Vilivyoisha' : 'Unavailable Menu Items',
        description:
          language === 'sw'
            ? `Vyakula ${unavailableItems.length} vimewekwa kuwa havipatikani.`
            : `${unavailableItems.length} menu items are currently marked sold out.`,
        actionLabel: language === 'sw' ? 'Sasisha Upatikanaji' : 'Manage Stock',
        targetTab: 'menu',
      });
    }

    return list;
  }, [pendingOrders.length, menuItems, language]);

  // 11. Financial Totals & Metrics strictly from public.payments
  const financialTotals = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = todayStart - 30 * 24 * 60 * 60 * 1000;

    let todayGross = 0;
    let todayNet = 0;
    let weekGross = 0;
    let monthGross = 0;

    for (const p of payments) {
      // Only SUCCESS counts as revenue; REFUNDED, FAILED, PENDING, CANCELLED do NOT count as retained revenue
      if (p.status === 'SUCCESS') {
        const pTime = new Date(p.createdAt).getTime();
        const gross = p.amountTzs || 0;
        const net = p.netRestaurantPayoutTzs || (gross - (p.platformCommissionTzs || 0));

        if (pTime >= todayStart) {
          todayGross += gross;
          todayNet += net;
        }
        if (pTime >= sevenDaysAgo) {
          weekGross += gross;
        }
        if (pTime >= thirtyDaysAgo) {
          monthGross += gross;
        }
      }
    }

    return { todayGross, todayNet, weekGross, monthGross };
  }, [payments]);

  // Dashboard Metrics
  const metrics: DashboardMetrics = useMemo(() => {
    const cookingCount = domainOrders.filter((o) => o.status === 'PREPARING').length;
    const unavailableCount = menuItems.filter((m) => !m.isAvailable).length;
    const needingVerifyCount = menuItems.filter((item) => {
      const diffDays = (Date.now() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 7;
    }).length;

    const todayDateStr = new Date().toISOString().split('T')[0];
    const reservationsToday = reservations.filter((r) => r.reservationDate === todayDateStr && r.status !== 'CANCELLED').length;

    return {
      openOrdersCount: pendingOrders.length,
      cookingOrdersCount: cookingCount,
      reservationsTodayCount: reservationsToday,
      itemsNeedingVerificationCount: needingVerifyCount,
      unavailableItemsCount: unavailableCount,
      todaySalesTzs: financialTotals.todayGross,
      averageRating: activeRestaurant.rating || 0,
      totalReviewsCount: reviews.length || activeRestaurant.reviewsCount || 0,
    };
  }, [domainOrders, pendingOrders.length, menuItems, reservations, reviews.length, activeRestaurant, financialTotals.todayGross]);

  // 12. Financial Transactions strictly from public.payments (no completed order fallback)
  const earningsTransactions: EarningsRecord[] = useMemo(() => {
    return payments.map((p) => {
      return {
        orderId: p.orderId || p.id,
        orderNumber: p.orderId ? `MLO-${p.orderId.slice(-4)}` : p.id.slice(0, 8),
        createdAt: p.createdAt,
        grossAmountTzs: p.amountTzs || 0,
        platformFeeTzs: p.platformCommissionTzs || 0,
        netPayoutTzs: p.netRestaurantPayoutTzs || (p.amountTzs - (p.platformCommissionTzs || 0)),
        paymentStatus: p.status,
        paymentProvider: p.provider || 'Mobile Money',
      };
    });
  }, [payments]);

  // 13. Discovery Analytics Data
  const discoveryAnalytics: DiscoveryAnalyticsData = useMemo(() => {
    const verifiedRatio = menuItems.length > 0
      ? Math.round(
          (menuItems.filter((m) => {
            const diffDays = (Date.now() - new Date(m.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
            return diffDays <= 7;
          }).length / menuItems.length) * 100
        )
      : 100;

    const completedOrders = domainOrders.filter((o) => o.status === 'COMPLETED');
    const aov = completedOrders.length > 0
      ? Math.round(completedOrders.reduce((s, o) => s + o.totalTzs, 0) / completedOrders.length)
      : 0;

    const dishCounts = new Map<string, number>();
    domainOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const count = dishCounts.get(item.itemNameSnapshot) || 0;
        dishCounts.set(item.itemNameSnapshot, count + (item.quantity || 1));
      });
    });

    const topDishes = Array.from(dishCounts.entries())
      .map(([name, ordersCount]) => ({
        name,
        ordersCount,
      }))
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5);

    const lostOpp = menuItems
      .filter((m) => !m.isAvailable)
      .slice(0, 3)
      .map((m) => ({
        dishName: m.name,
        reason: 'Marked unavailable / out of stock',
      }));

    return {
      menuFreshnessPercentage: verifiedRatio,
      averageOrderValueTzs: aov,
      topOrderedDishes: topDishes,
      lostOpportunities: lostOpp,
    };
  }, [menuItems, domainOrders]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadRestaurantWorkspace();
      setRealtimeStatus('LIVE');
    } catch {
      setRealtimeStatus('OFFLINE');
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRestaurantWorkspace]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Hitilafu', e?.message || 'Imeshindikana kutoka.');
    }
  }, [logout, router]);

  // Order Handlers
  const handleAcceptOrder = useCallback(
    async (orderId: string, estimatedPrepMinutes: number) => {
      try {
        await OrderPipelineService.acceptOrder(orderId, estimatedPrepMinutes, activeRestaurant.id);
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kukubali agizo.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleRejectOrder = useCallback(
    async (orderId: string, reason: string) => {
      try {
        await OrderPipelineService.rejectOrder(orderId, reason);
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kusitisha agizo.');
      }
    },
    [loadRestaurantWorkspace]
  );

  const handleAdvanceKitchenStatus = useCallback(
    async (orderId: string, nextStatus: OrderStatus) => {
      try {
        await OrderPipelineService.updateFulfillmentStatus(orderId, nextStatus);
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kusasisha hali ya jikoni.');
      }
    },
    [loadRestaurantWorkspace]
  );

  // Menu Handlers
  const handleToggleAvailability = useCallback(
    async (itemId: string, isAvailable: boolean) => {
      try {
        await MenuRepository.setAvailability(itemId, isAvailable);
        RealtimeEventEngine.publish('menu:updated', {
          restaurantId: activeRestaurant.id,
          data: { itemId, isAvailable },
        });
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili upatikanaji.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleBulkSetAvailability = useCallback(
    async (itemIds: string[], isAvailable: boolean) => {
      try {
        await MenuRepository.bulkSetAvailability(itemIds, isAvailable);
        RealtimeEventEngine.publish('menu:updated', {
          restaurantId: activeRestaurant.id,
          data: { bulk: true, isAvailable },
        });
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili upatikanaji kwa wingi.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleVerifyFullMenu = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      for (const item of menuItems) {
        await MenuRepository.updateItem(item.id, { updatedAt: now });
      }
      RealtimeEventEngine.publish('menu:updated', {
        restaurantId: activeRestaurant.id,
        data: { verifiedAt: now },
      });
      await loadRestaurantWorkspace();
      Alert.alert(
        language === 'sw' ? 'Menyu Imethibitishwa!' : 'Menu Verified!',
        language === 'sw'
          ? 'Bei na upatikanaji wote sasa ni FRESH na vinapewa kipaumbele kwenye utafutaji.'
          : 'All prices and availability are marked FRESH. Your dishes now rank higher in discovery.'
      );
    } catch (e: any) {
      Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuthibitisha menyu.');
    }
  }, [activeRestaurant.id, menuItems, loadRestaurantWorkspace, language]);

  const handleVerifySingleDish = useCallback(
    async (itemId: string) => {
      try {
        const item = menuItems.find((m) => m.id === itemId);
        if (item) {
          await MenuRepository.verifyPrice(itemId, item.priceTzs, authUser?.id || 'staff');
          RealtimeEventEngine.publish('menu:updated', {
            restaurantId: activeRestaurant.id,
            data: { itemId, verifiedAt: new Date().toISOString() },
          });
          await loadRestaurantWorkspace();
        }
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuthibitisha chakula.');
      }
    },
    [activeRestaurant.id, authUser?.id, menuItems, loadRestaurantWorkspace]
  );

  const handleSaveMenuItem = useCallback(
    async (savedItem: Partial<MenuItem>, overrides?: BranchPriceOverride[]) => {
      try {
        let targetItemId: string;
        if (editingItem) {
          targetItemId = editingItem.id;
          await MenuRepository.updateItem(editingItem.id, savedItem);
        } else {
          const created = await MenuRepository.createItem({
            ...savedItem,
            restaurantId: activeRestaurant.id,
          });
          targetItemId = created.id;
        }

        if (overrides && overrides.length > 0) {
          for (const ov of overrides) {
            if (ov.customPriceTzs !== undefined) {
              await MenuRepository.setBranchPrice(ov.branchId, targetItemId, ov.customPriceTzs);
            }
          }
        }

        RealtimeEventEngine.publish('menu:updated', { restaurantId: activeRestaurant.id });
        await loadRestaurantWorkspace();
        setIsEditorVisible(false);
        setEditingItem(null);
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuhifadhi chakula.');
        throw e;
      }
    },
    [activeRestaurant.id, editingItem, loadRestaurantWorkspace]
  );

  const handleArchiveDish = useCallback(
    async (itemId: string) => {
      try {
        await MenuRepository.archiveItem(itemId);
        RealtimeEventEngine.publish('menu:updated', { restaurantId: activeRestaurant.id });
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuondoa chakula.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  // Category Handlers
  const handleAddCategory = useCallback(
    async (nameEn: string, nameSw?: string) => {
      try {
        await MenuRepository.createCategory({
          restaurantId: activeRestaurant.id,
          nameEn,
          nameSw,
        });
        await loadRestaurantWorkspace();
        Alert.alert('Category Added', `${nameEn} has been added.`);
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuongeza kategoria.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleArchiveCategory = useCallback(
    async (categoryId: string) => {
      try {
        await MenuRepository.archiveCategory(categoryId);
        await loadRestaurantWorkspace();
        Alert.alert('Category Archived', 'Category has been archived.');
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuweka kategoria kwenye kumbukumbu.');
      }
    },
    [loadRestaurantWorkspace]
  );

  // Reservation Handlers
  const handleUpdateReservationStatus = useCallback(
    async (resId: string, nextStatus: ReservationStatus) => {
      try {
        if (nextStatus === 'CONFIRMED') {
          await ReservationRepository.restaurantDecide({
            reservationId: resId,
            decision: 'ACCEPT',
          });
        } else if (nextStatus === 'REJECTED') {
          await ReservationRepository.restaurantDecide({
            reservationId: resId,
            decision: 'REJECT',
            rejectionReason: 'RESTAURANT_UNABLE_TO_ACCOMMODATE',
          });
        } else if (nextStatus === 'SEATED' || nextStatus === 'COMPLETED' || nextStatus === 'NO_SHOW') {
          await ReservationRepository.transitionAttendance(resId, nextStatus);
        } else if (nextStatus === 'CANCELLED') {
          await ReservationRepository.cancelSecure(resId, 'Cancelled by restaurant operator');
        }
        await loadRestaurantWorkspace();
        Alert.alert('Reservation Updated', `Reservation marked as ${nextStatus}.`);
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kusasisha meza.');
      }
    },
    [loadRestaurantWorkspace]
  );

  // Review Handlers
  const handleRespondToReview = useCallback(
    async (reviewId: string, responseText: string) => {
      const trimmed = responseText?.trim();
      if (!trimmed) {
        Alert.alert('Validation Error', 'Response text cannot be empty.');
        return;
      }
      try {
        await ReviewResponsesRepository.respond(reviewId, trimmed);
        await loadRestaurantWorkspace();
        Alert.alert('Response Posted', 'Your response to the customer was saved.');
      } catch (e: any) {
        Alert.alert('Response Error', e?.message || 'Failed to submit response.');
      }
    },
    [loadRestaurantWorkspace]
  );

  // Staff Handlers with Last-Owner Protection
  const handleInviteStaff = useCallback(
    async (email: string, role: RestaurantRole, fullName: string) => {
      try {
        await RestaurantMemberRepository.inviteMember(activeRestaurant.id, email, role, fullName);
        await loadRestaurantWorkspace();
        Alert.alert('Mwaliko Umetumwa', `Mwaliko umetumwa kwa ${email} kama ${role}.`);
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kualika mfanyakazi.');
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const handleChangeStaffRole = useCallback(
    async (membershipId: string, newRole: RestaurantRole) => {
      const target = staffList.find((m) => m.id === membershipId);
      if (target && target.role === 'OWNER' && newRole !== 'OWNER') {
        const activeOwners = staffList.filter((m) => m.role === 'OWNER' && m.isActive);
        if (activeOwners.length <= 1) {
          Alert.alert(
            'Ulinzi wa Mmiliki',
            'Huwezi kubadilisha jukumu la mmiliki wa pekee wa mgahawa huu.'
          );
          return;
        }
      }
      try {
        await RestaurantMemberRepository.updateRole(activeRestaurant.id, membershipId, newRole);
        await loadRestaurantWorkspace();
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kubadili jukumu.');
      }
    },
    [activeRestaurant.id, staffList, loadRestaurantWorkspace]
  );

  const handleDeactivateStaff = useCallback(
    async (membershipId: string) => {
      const target = staffList.find((m) => m.id === membershipId);
      if (target && target.role === 'OWNER') {
        const activeOwners = staffList.filter((m) => m.role === 'OWNER' && m.isActive);
        if (activeOwners.length <= 1) {
          Alert.alert(
            'Ulinzi wa Mmiliki',
            'Huwezi kumwondoa mmiliki wa pekee wa mgahawa huu. Lazima ateuliwe mmiliki mwingine kwanza.'
          );
          return;
        }
      }
      try {
        await RestaurantMemberRepository.deactivateMember(activeRestaurant.id, membershipId);
        await loadRestaurantWorkspace();
        Alert.alert('Staff Removed', 'Team member has been removed.');
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuondoa mfanyakazi.');
      }
    },
    [activeRestaurant.id, staffList, loadRestaurantWorkspace]
  );

  // Settings Handlers
  const handleSaveProfile = useCallback(
    async (updates: Partial<RestaurantEntity>) => {
      try {
        await RestaurantRepository.update(activeRestaurant.id, updates as any);
        await loadRestaurantWorkspace();
        Alert.alert('Profile Saved', 'Restaurant profile details updated.');
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kuhifadhi maelezo.');
        throw e;
      }
    },
    [activeRestaurant.id, loadRestaurantWorkspace]
  );

  const hasActiveBranch = branches.some((b) => b.isActive);
  const hasValidMenuItem = menuItems.some(
    (m: any) => ((m.basePrice && m.basePrice > 0) || (m.priceTzs && m.priceTzs > 0)) && (m.isAvailable ?? true)
  );
  const hasConfiguredHours = branches.some(
    (b: any) => b.openingHours && Object.keys(b.openingHours).length > 0
  );
  const isPublishPrerequisitesMet = hasActiveBranch && hasValidMenuItem;
  const canPublish = isPublishPrerequisitesMet;

  const handleUpdateOperatingStatus = useCallback(
    async (status: OperatingOverride) => {
      if (!selectedBranchId) {
        Alert.alert(
          language === 'sw' ? 'Chagua Tawi' : 'Select Branch',
          language === 'sw'
            ? 'Tafadhali chagua au sajili tawi kwanza kabla ya kubadili hali ya uendeshaji.'
            : 'Select a branch before changing operating status.'
        );
        return;
      }
      try {
        const mode = status as BranchOperationalMode;
        await BranchOperationsRepository.setBranchOperationalMode(selectedBranchId, mode);
        await loadRestaurantWorkspace();
        Alert.alert(
          language === 'sw' ? 'Hali Imesasishwa' : 'Operating Status Updated',
          language === 'sw'
            ? `Hali ya jikoni ya tawi sasa ni: ${status}`
            : `Branch kitchen operational mode set to: ${status}.`
        );
      } catch (e: any) {
        Alert.alert('Hitilafu', e?.message || 'Imeshindikana kusasisha hali ya kufungua.');
      }
    },
    [selectedBranchId, loadRestaurantWorkspace, language]
  );

  const handlePublishRestaurant = useCallback(async () => {
    if (!hasActiveBranch) {
      Alert.alert(
        language === 'sw' ? 'Tawi Linahitajika' : 'Active Branch Required',
        language === 'sw'
          ? 'Mgahawa lazima uwe na angalau tawi 1 hai kabla ya kuzinduliwa.'
          : 'Your restaurant must have at least one active branch before publishing.'
      );
      return;
    }
    if (!hasValidMenuItem) {
      Alert.alert(
        language === 'sw' ? 'Chakula Kinahitajika' : 'Valid Menu Item Required',
        language === 'sw'
          ? 'Mgahawa lazima uwe na angalau chakula 1 chenye bei halali kabla ya kuzinduliwa.'
          : 'Your restaurant must have at least one available menu item with price > 0 before publishing.'
      );
      return;
    }
    try {
      await RestaurantRepository.publishRestaurant(activeRestaurant.id);
      await loadRestaurantWorkspace();
      Alert.alert(
        language === 'sw' ? 'Mgahawa Umezinduliwa!' : 'Restaurant Published!',
        language === 'sw'
          ? 'Hongera! Mgahawa wako sasa unaonekana kwa wateja wote mtandaoni.'
          : 'Congratulations! Your restaurant is now live and discoverable to customers.'
      );
    } catch (err: any) {
      Alert.alert(
        language === 'sw' ? 'Hauwezi Kuzindua' : 'Cannot Publish',
        err.message || 'Prerequisites not met. Please ensure you have added a branch and a menu item with price.'
      );
    }
  }, [activeRestaurant.id, hasActiveBranch, hasValidMenuItem, loadRestaurantWorkspace, language]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 1. Header Bar */}
      <RestaurantPortalHeader
        restaurant={activeRestaurant}
        userRoleLabel={userRole}
        realtimeStatus={realtimeStatus}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
        branches={branches}
        activeBranchId={selectedBranchId}
        onSelectBranch={setSelectedBranchId}
      />

      {/* Publication Warning Banner for Unpublished Restaurants */}
      {activeRestaurant.isPublished === false && (
        <View style={styles.publishBanner}>
          <View style={styles.publishBannerContent}>
            <Ionicons name="alert-circle" size={24} color="#b45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.publishBannerTitle}>
                {language === 'sw' ? 'Usajili Haujakamilika / Mgahawa Haujazinduliwa' : 'Setup Incomplete / Unpublished'}
              </Text>
              <Text style={styles.publishBannerSub}>
                {!hasActiveBranch
                  ? (language === 'sw' ? '⚠️ Hatua ya lazima: Ongeza angalau tawi 1 hai kwenye Mipangilio kabla ya kuzindua.' : '⚠️ Action required: Add at least 1 active branch in Settings before publishing.')
                  : !hasValidMenuItem
                  ? (language === 'sw' ? '⚠️ Hatua ya lazima: Weka angalau chakula 1 chenye bei > 0 kwenye Menyu kabla ya kuzindua.' : '⚠️ Action required: Add at least 1 menu item with price > 0 before publishing.')
                  : (language === 'sw' ? 'Vigezo vyote vimekamilika! Bonyeza hapa kulia kuzindua mgahawa.' : 'All prerequisites met! Click on the right to publish your restaurant.')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.publishActionBtn, !isPublishPrerequisitesMet && { opacity: 0.5, backgroundColor: '#94a3b8' }]}
              onPress={handlePublishRestaurant}
              disabled={!isPublishPrerequisitesMet}
              activeOpacity={0.85}
            >
              <Text style={styles.publishActionBtnText}>
                {language === 'sw' ? 'Zindua Mgahawa' : 'Publish Restaurant'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. Main Workspace Layout */}
      <View style={styles.workspaceRow}>
        {/* Desktop Sidebar */}
        {isLargeScreen && (
          <View style={styles.sidebarWrapper}>
            <RestaurantSidebar
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              userRole={userRole}
              orderBadgeCount={pendingOrders.length}
              kitchenBadgeCount={kitchenOrders.length}
              language={language as any}
            />
          </View>
        )}

        {/* Content Viewport */}
        <View style={styles.viewport}>
          {/* Mobile Tab Bar */}
          {!isLargeScreen && (
            <RestaurantMobileNav
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              userRole={userRole}
              orderBadgeCount={pendingOrders.length}
              kitchenBadgeCount={kitchenOrders.length}
              language={language as any}
            />
          )}

          {/* Tab Views */}
          <View style={styles.tabContentArea}>
            {activeTab === 'overview' && (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* 5-Point Setup Checklist Card (Task 26) */}
                <View style={styles.setupCard}>
                  <View style={styles.setupCardHeader}>
                    <Text style={styles.setupCardTitle}>
                      {language === 'sw' ? 'Hatua za Usanidi wa Mgahawa' : 'Restaurant Setup Progress'}
                    </Text>
                    <Text style={styles.setupCardStepText}>
                      {[true, hasActiveBranch, hasConfiguredHours, hasValidMenuItem, activeRestaurant.isPublished].filter(Boolean).length} / 5 {language === 'sw' ? 'zimekamilika' : 'completed'}
                    </Text>
                  </View>
                  <View style={styles.setupChecklist}>
                    <View style={styles.setupItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                      <Text style={styles.setupItemTextDone}>
                        {language === 'sw' ? 'Ombi la mgahawa limeidhinishwa na msimamizi' : 'Application approved by platform admin'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.setupItem}
                      onPress={() => setActiveTab('settings')}
                    >
                      <Ionicons
                        name={hasActiveBranch ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={hasActiveBranch ? "#16a34a" : "#94a3b8"}
                      />
                      <Text style={[styles.setupItemText, hasActiveBranch && styles.setupItemTextDone]}>
                        {language === 'sw' ? 'Ongeza angalau tawi 1 la biashara' : 'Add at least one operating branch'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.setupItem}
                      onPress={() => setActiveTab('settings')}
                    >
                      <Ionicons
                        name={hasConfiguredHours ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={hasConfiguredHours ? "#16a34a" : "#94a3b8"}
                      />
                      <Text style={[styles.setupItemText, hasConfiguredHours && styles.setupItemTextDone]}>
                        {language === 'sw' ? 'Sanidi masaa ya kazi ya tawi' : 'Configure branch operating hours'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.setupItem}
                      onPress={() => setActiveTab('menu')}
                    >
                      <Ionicons
                        name={hasValidMenuItem ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={hasValidMenuItem ? "#16a34a" : "#94a3b8"}
                      />
                      <Text style={[styles.setupItemText, hasValidMenuItem && styles.setupItemTextDone]}>
                        {language === 'sw' ? 'Weka angalau chakula 1 chenye bei halali kwenye menyu' : 'Add at least one menu item with valid price'}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.setupItem}>
                      <Ionicons
                        name={activeRestaurant.isPublished ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={activeRestaurant.isPublished ? "#16a34a" : "#94a3b8"}
                      />
                      <Text style={[styles.setupItemText, activeRestaurant.isPublished && styles.setupItemTextDone]}>
                        {language === 'sw' ? 'Tayari kuzindua / Mgahawa umezinduliwa mtandaoni' : 'Ready to publish / Live online'}
                      </Text>
                    </View>
                  </View>
                </View>

                <DashboardOverview
                  restaurantName={activeRestaurant.name}
                  metrics={metrics}
                  alerts={alerts}
                  onNavigateTab={setActiveTab}
                  onQuickVerifyMenu={handleVerifyFullMenu}
                  language={language as any}
                />
              </ScrollView>
            )}

            {activeTab === 'orders' && (
              <IncomingOrdersPanel
                orders={domainOrders}
                onAcceptOrder={handleAcceptOrder}
                onRejectOrder={handleRejectOrder}
                onUpdateStatus={async (orderId, nextStatus) => {
                  await handleAdvanceKitchenStatus(orderId, nextStatus);
                }}
                language={language as any}
              />
            )}

            {activeTab === 'kitchen' && (
              <KitchenBoard
                orders={kitchenOrders}
                onAdvanceStatus={handleAdvanceKitchenStatus}
                language={language as any}
              />
            )}

            {activeTab === 'custom-meals' && (
              <View>
              {requestLoadError && <Text accessibilityRole="alert" style={{ color: '#b91c1c', padding: 12 }}>{requestLoadError}</Text>}
              <CustomMealQuotesPanel
                requests={customMealInvitations.map((inv: any) => ({
                  ...inv.request,
                  status: inv.invitation.status === 'QUOTED' ? 'QUOTE_SUBMITTED' : inv.request.status,
                }))}
                onSubmitQuote={async (requestId, quote) => {
                  const targetInv = customMealInvitations.find((inv: any) => inv.request?.id === requestId);
                  const mealTitle =
                    targetInv?.request?.dishName ||
                    targetInv?.request?.title ||
                    'Custom Meal Preparation';
                  await CustomMealRepository.submitStructuredQuote({
                    requestId,
                    restaurantId: activeRestaurant.id,
                    branchId: selectedBranchId || undefined,
                    items: [
                      {
                        name: mealTitle,
                        quantity: 1,
                        unitPriceTzs: quote.priceTzs,
                      },
                    ],
                    deliveryFeeTzs: quote.deliveryFeeTzs || 0,
                    estimatedPrepMinutes: quote.prepMinutes,
                    promisedReadyAt: new Date(Date.now() + quote.prepMinutes * 60 * 1000).toISOString(),
                    fulfillmentMode: (targetInv?.request?.fulfillmentMode as any) || 'PICKUP',
                    restaurantNote: quote.message,
                    dietaryAcknowledged: true,
                    allergyAcknowledged: true,
                    validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                  });
                  await loadRestaurantWorkspace();
                }}
                onWithdrawQuote={async (requestId) => {
                  await CustomMealRepository.declineInvitation(
                    requestId,
                    activeRestaurant.id,
                    'TOO_BUSY',
                    'Quote withdrawn by kitchen.'
                  );
                  await loadRestaurantWorkspace();
                }}
                language={language as any}
              />
              </View>
            )}

            {activeTab === 'menu' && (
              <MenuManager
                items={menuItems}
                categories={categories}
                onAddNewDish={() => {
                  setEditingItem(null);
                  setIsEditorVisible(true);
                }}
                onEditDish={(item) => {
                  setEditingItem(item);
                  setIsEditorVisible(true);
                }}
                onArchiveDish={handleArchiveDish}
                onToggleAvailability={handleToggleAvailability}
                onBulkSetAvailability={handleBulkSetAvailability}
                onVerifyFullMenu={handleVerifyFullMenu}
                onVerifySingleDish={handleVerifySingleDish}
                onOpenCategoriesManager={() => setIsCategoryManagerVisible(true)}
                language={language as any}
              />
            )}

            {activeTab === 'reservations' && (
              <ReservationManager
                reservations={reservations}
                onUpdateStatus={handleUpdateReservationStatus}
                language={language as any}
              />
            )}

            {activeTab === 'reviews' && (
              <ReviewsPanel
                reviews={reviews}
                averageRating={activeRestaurant.rating || 0}
                onRespondToReview={handleRespondToReview}
                language={language as any}
              />
            )}

            {activeTab === 'earnings' && (
              <EarningsOverview
                todayGrossTzs={financialTotals.todayGross}
                todayNetTzs={financialTotals.todayNet}
                weekGrossTzs={financialTotals.weekGross}
                monthGrossTzs={financialTotals.monthGross}
                transactions={earningsTransactions}
                language={language as any}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel
                data={discoveryAnalytics}
                language={language as any}
              />
            )}

            {activeTab === 'staff' && (
              <StaffManager
                staffList={staffList}
                currentUserId={authUser?.id || ''}
                onInviteStaff={runtimeConfig.isDemo ? handleInviteStaff : undefined}
                onChangeRole={handleChangeStaffRole}
                onDeactivateStaff={handleDeactivateStaff}
                language={language as any}
              />
            )}

            {activeTab === 'settings' && (
              <RestaurantSettings
                restaurant={activeRestaurant}
                branches={branches}
                selectedBranchId={selectedBranchId}
                onSaveProfile={handleSaveProfile}
                onUpdateOperatingStatus={handleUpdateOperatingStatus}
                onBranchUpdated={loadRestaurantWorkspace}
                language={language as any}
              />
            )}
          </View>
        </View>
      </View>

      {/* Root Modals */}
      <MenuItemEditor
        key={`${editingItem?.id || 'new'}-${isEditorVisible}`}
        visible={isEditorVisible}
        item={editingItem}
        restaurantId={activeRestaurant.id}
        categories={categories}
        branches={branches}
        branchOverrides={branchOverrides}
        onSave={handleSaveMenuItem}
        onClose={() => {
          setIsEditorVisible(false);
          setEditingItem(null);
        }}
        language={language as any}
      />

      <CategoryManager
        visible={isCategoryManagerVisible}
        categories={categories}
        onAddCategory={handleAddCategory}
        onArchiveCategory={handleArchiveCategory}
        onClose={() => setIsCategoryManagerVisible(false)}
        language={language as any}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  workspaceRow: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarWrapper: {
    width: 250,
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    backgroundColor: '#0b1120',
  },
  viewport: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#0f172a',
  },
  tabContentArea: {
    flex: 1,
  },
  gateContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  gateCard: {
    backgroundColor: '#1e293b',
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    ...Shadows.md,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  gateSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  gatePrimaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radii.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  gatePrimaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  gateSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radii.md,
    width: '100%',
    alignItems: 'center',
  },
  gateSecondaryBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  publishBanner: {
    backgroundColor: '#fef3c7',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  publishBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  publishBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  publishBannerSub: {
    fontSize: 11.5,
    color: '#b45309',
    marginTop: 2,
  },
  publishActionBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
    ...Shadows.sm,
  },
  publishActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  setupCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  setupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  setupCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.brandInk,
  },
  setupCardStepText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  setupChecklist: {
    gap: 8,
  },
  setupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setupItemText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  setupItemTextDone: {
    fontSize: 12,
    color: Colors.brandInk,
    fontWeight: '600',
  },
});
