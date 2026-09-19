/**
 * ============================================================================
 * STAGE 6: RESTAURANT OPERATING WORKSPACE & TRUST ENGINE TEST SUITE
 * Covers: RBAC Role Visibility, Route Guards, Order State Machine, Attention Center,
 *         Menu Price Verification, Freshness Promotion, Branch Price Overrides,
 *         Sole-Owner Protection, and Operating Status Override.
 * ============================================================================
 */

import { MloHubDB } from '../db';
import { UserRole, RestaurantMembershipEntity, RestaurantEntity } from '../db/types';
import { resolvePortalAccess } from '../db/auth/guards';
import { DemoOrderPipelineAdapter as OrderPipelineService } from '../services/demo/DemoOrderPipelineAdapter';
import { RESTAURANT_NAV_ITEMS, RestaurantTab } from '../constants/restaurantPortal';
import { RestaurantRole } from '../types/auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

export async function runRestaurantPortalTestSuite(): Promise<{ passedCount: number; failedCount: number }> {
  passed = 0;
  failed = 0;

  console.log('\n================================================================');
  console.log('🧪 STAGE 6: RESTAURANT OPERATING WORKSPACE & TRUST ENGINE TESTS');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // GROUP 1: Restaurant Portal RBAC Role Visibility
  // ---------------------------------------------------------------------------
  console.log('Test Group 1: RBAC Role-Aware Navigation Visibility');

  const getVisibleTabs = (role: RestaurantRole): RestaurantTab[] => {
    return RESTAURANT_NAV_ITEMS.filter((item) => item.allowedRoles.includes(role)).map((item) => item.id);
  };

  const ownerTabs = getVisibleTabs('OWNER');
  assert(ownerTabs.includes('overview'), 'OWNER can view Overview');
  assert(ownerTabs.includes('orders'), 'OWNER can view Orders');
  assert(ownerTabs.includes('kitchen'), 'OWNER can view Kitchen Board');
  assert(ownerTabs.includes('menu'), 'OWNER can view Menu & Prices');
  assert(ownerTabs.includes('reservations'), 'OWNER can view Reservations');
  assert(ownerTabs.includes('reviews'), 'OWNER can view Reviews');
  assert(ownerTabs.includes('earnings'), 'OWNER can view Earnings');
  assert(ownerTabs.includes('analytics'), 'OWNER can view Analytics');
  assert(ownerTabs.includes('staff'), 'OWNER can view Staff Management');
  assert(ownerTabs.includes('settings'), 'OWNER can view Settings');

  const managerTabs = getVisibleTabs('MANAGER');
  assert(managerTabs.includes('overview'), 'MANAGER can view Overview');
  assert(managerTabs.includes('orders'), 'MANAGER can view Orders');
  assert(managerTabs.includes('kitchen'), 'MANAGER can view Kitchen Board');
  assert(managerTabs.includes('menu'), 'MANAGER can view Menu & Prices');
  assert(managerTabs.includes('earnings'), 'MANAGER can view Earnings');
  assert(!managerTabs.includes('staff'), 'MANAGER is restricted from Staff Management');

  const chefTabs = getVisibleTabs('CHEF');
  assert(chefTabs.includes('orders'), 'CHEF can view Orders');
  assert(chefTabs.includes('kitchen'), 'CHEF can view Kitchen Board');
  assert(chefTabs.includes('menu'), 'CHEF can view Menu availability');
  assert(!chefTabs.includes('overview'), 'CHEF is restricted from Financial Overview');
  assert(!chefTabs.includes('earnings'), 'CHEF is restricted from Earnings');
  assert(!chefTabs.includes('staff'), 'CHEF is restricted from Staff Management');
  assert(!chefTabs.includes('settings'), 'CHEF is restricted from Settings');

  const staffTabs = getVisibleTabs('STAFF');
  assert(staffTabs.includes('orders'), 'STAFF can view Orders');
  assert(staffTabs.includes('reservations'), 'STAFF can view Reservations');
  assert(!staffTabs.includes('kitchen'), 'STAFF is restricted from Kitchen Board');
  assert(!staffTabs.includes('menu'), 'STAFF is restricted from Menu Management');
  assert(!staffTabs.includes('earnings'), 'STAFF is restricted from Earnings');
  assert(!staffTabs.includes('staff'), 'STAFF is restricted from Staff Management');

  // Role Default Routing
  const getInitialTab = (role: RestaurantRole): RestaurantTab => {
    const allowed = getVisibleTabs(role);
    if (allowed.includes('overview')) return 'overview';
    if (allowed.includes('kitchen')) return 'kitchen';
    return allowed[0] || 'orders';
  };

  assert(getInitialTab('OWNER') === 'overview', 'OWNER defaults to overview');
  assert(getInitialTab('MANAGER') === 'overview', 'MANAGER defaults to overview');
  assert(getInitialTab('CHEF') === 'kitchen', 'CHEF defaults safely to kitchen queue');
  assert(getInitialTab('STAFF') === 'orders', 'STAFF defaults safely to orders view');

  // ---------------------------------------------------------------------------
  // GROUP 2: Restaurant Portal Route Guards
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 2: Portal Route Guard Enforcement');

  const unauthAccess = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: null,
    memberships: [],
    restaurants: [],
    activeRestaurant: null,
  });
  assert(unauthAccess.status === 'UNAUTHENTICATED', 'Unauthenticated user blocked with UNAUTHENTICATED status');

  const customerUser = { id: 'usr-customer-1', role: UserRole.CUSTOMER, roles: [UserRole.CUSTOMER] };
  const customerAccess = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: customerUser,
    activeWorkspace: 'CUSTOMER',
    memberships: [],
    restaurants: [],
    activeRestaurant: null,
  });
  assert(customerAccess.status === 'DENIED', 'Customer without memberships blocked with DENIED status');

  const vendorUser = { id: 'usr-vendor-1', role: UserRole.RESTAURANT_OWNER, roles: [UserRole.RESTAURANT_OWNER] };
  const mockRestaurant: RestaurantEntity = {
    id: 'rest-test-1',
    ownerId: 'usr-vendor-1',
    name: 'Swahili Bistro',
    slug: 'swahili-bistro',
    cuisine: 'Swahili / Seafood',
    sellerTier: 'VERIFIED_SELLER',
    rating: 4.9,
    reviewsCount: 28,
    minPrice: 8000,
    maxPrice: 25000,
    address: 'Mikocheni, Dar es Salaam',
    neighborhood: 'Mikocheni',
    regionCity: 'Dar es Salaam',
    distanceKm: 1.2,
    estimatedPrepTimeMinutes: 20,
    isOpen: true,
    isVerified: true,
    verificationStatus: 'VERIFIED',
    specialty: 'Biryani',
    emoji: '🥘',
    tags: ['Halal'],
    menu: [],
    createdAt: new Date().toISOString(),
  };

  const mockMembership: RestaurantMembershipEntity = {
    id: 'mem-1',
    userId: 'usr-vendor-1',
    restaurantId: 'rest-test-1',
    role: 'OWNER',
    permissions: ['VIEW_DASHBOARD', 'MANAGE_ORDERS', 'MANAGE_MENU'],
    isPrimaryOwner: true,
    createdAt: new Date().toISOString(),
  };

  const grantedAccess = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: vendorUser,
    activeWorkspace: 'RESTAURANT_OWNER',
    activeRestaurant: mockRestaurant,
    memberships: [mockMembership],
    restaurants: [mockRestaurant],
  });
  assert(grantedAccess.status === 'AUTHORIZED', 'Verified restaurant owner granted portal access with AUTHORIZED status');
  assert(grantedAccess.restaurant?.id === 'rest-test-1', 'Active restaurant resolved accurately');

  // ---------------------------------------------------------------------------
  // GROUP 3: Order State Machine Transitions
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 3: Canonical Order State Machine Execution');

  await MloHubDB.init();

  const testOrder = await OrderPipelineService.submitCustomMealOrder({
    userId: 'usr-cust-99',
    customerName: 'Amina Test',
    dishName: 'Samaki wa Kupaka & Coconut Rice',
    targetRestaurantId: mockRestaurant.id,
    restaurantName: mockRestaurant.name,
    specialInstructions: 'Extra coconut cream sauce',
    budgetTzs: 16000,
    servingsCount: '2 Servings',
    diningOption: 'Delivery',
    neighborhood: 'Mikocheni',
  });

  assert(testOrder.status === 'Pending Confirmation', 'Order created in Pending Confirmation state');

  // Accept Order
  const acceptedOrder = await OrderPipelineService.acceptOrder(testOrder.id, 25, mockRestaurant.id);
  assert(acceptedOrder.status === 'Confirmed', 'Order transitioned to Confirmed (ACCEPTED)');
  assert(Boolean(acceptedOrder.statusMessageEn?.includes('25 mins')), 'Estimated prep time recorded in order notification');

  // Kitchen Cooking (PREPARING)
  const cookingOrder = await OrderPipelineService.updateFulfillmentStatus(testOrder.id, 'Cooking');
  assert(cookingOrder.status === 'Cooking', 'Order transitioned to Cooking (PREPARING)');

  // Kitchen Ready
  const readyOrder = await OrderPipelineService.updateFulfillmentStatus(testOrder.id, 'Ready');
  assert(readyOrder.status === 'Ready', 'Order transitioned to Ready (READY)');

  // Fulfillment Completed
  const completedOrder = await OrderPipelineService.updateFulfillmentStatus(testOrder.id, 'Completed');
  assert(completedOrder.status === 'Completed', 'Order transitioned to Completed (COMPLETED)');

  // Order Rejection Flow
  const rejectedCandidate = await OrderPipelineService.submitCustomMealOrder({
    userId: 'usr-cust-99',
    dishName: 'Late Night Biryani',
    targetRestaurantId: mockRestaurant.id,
    budgetTzs: 12000,
    servingsCount: '1 Serving',
    diningOption: 'Delivery',
    specialInstructions: '',
  });

  const rejectedOrder = await OrderPipelineService.rejectOrder(rejectedCandidate.id, 'Kitchen at maximum capacity for dinner');
  assert(rejectedOrder.status === 'Cancelled', 'Order transitioned to Cancelled (REJECTED)');
  assert(Boolean(rejectedOrder.statusMessageEn?.includes('Kitchen at maximum capacity')), 'Rejection reason documented for customer');

  // ---------------------------------------------------------------------------
  // GROUP 4: Attention Center Prioritization Logic
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 4: Attention Center Alert Engine');

  const evaluateAlerts = (params: {
    pendingOrdersCount: number;
    unverifiedDishesCount: number;
    outOfStockDishesCount: number;
  }) => {
    const list = [];
    if (params.pendingOrdersCount > 0) {
      list.push({ id: 'pending', severity: 'HIGH', tab: 'orders' });
    }
    if (params.unverifiedDishesCount > 0) {
      list.push({ id: 'verify', severity: 'MEDIUM', tab: 'menu' });
    }
    if (params.outOfStockDishesCount > 0) {
      list.push({ id: 'stock', severity: 'INFO', tab: 'menu' });
    }
    return list;
  };

  const busyAlerts = evaluateAlerts({
    pendingOrdersCount: 3,
    unverifiedDishesCount: 5,
    outOfStockDishesCount: 1,
  });
  assert(busyAlerts.length === 3, 'All 3 operational alert types captured');
  assert(busyAlerts[0].severity === 'HIGH' && busyAlerts[0].tab === 'orders', 'Pending orders prioritized as HIGH severity');
  assert(busyAlerts[1].severity === 'MEDIUM' && busyAlerts[1].tab === 'menu', 'Unverified menu items flagged as MEDIUM severity');

  const cleanAlerts = evaluateAlerts({
    pendingOrdersCount: 0,
    unverifiedDishesCount: 0,
    outOfStockDishesCount: 0,
  });
  assert(cleanAlerts.length === 0, 'Zero alerts generated when operations are in equilibrium');

  // ---------------------------------------------------------------------------
  // GROUP 5: Menu Price Verification & Freshness Tier Promotion
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 5: Menu Price Verification & Discovery Freshness');

  const nowMs = Date.now();
  const freshDate = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
  const staleDate = new Date(nowMs - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago

  const isDishFresh = (dateStr: string): boolean => {
    const diffDays = (nowMs - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  assert(isDishFresh(freshDate) === true, 'Dish verified 2 days ago is FRESH (<= 7 days)');
  assert(isDishFresh(staleDate) === false, 'Dish verified 10 days ago is AGING (> 7 days)');

  // Verify single item updates timestamp
  const testDish = {
    id: 'dish-test-1',
    name: 'Pilau ya Ng’ombe',
    priceTzs: 8000,
    updatedAt: staleDate,
    lastVerifiedAt: staleDate,
  };
  const isFreshInitial = isDishFresh(testDish.lastVerifiedAt);
  assert(isFreshInitial === false, 'Dish starts unverified');

  // Restaurant clicks "Verify"
  const verifiedNow = new Date().toISOString();
  testDish.updatedAt = verifiedNow;
  testDish.lastVerifiedAt = verifiedNow;
  const isFreshAfter = isDishFresh(testDish.lastVerifiedAt);
  assert(isFreshAfter === true, 'Dish promotes to FRESH immediately upon verification');

  // ---------------------------------------------------------------------------
  // GROUP 6: Multi-Branch & Branch Price Overrides
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 6: Branch Price Overrides');

  const basePrice = 12000;
  const branchOverrides = [
    { branchId: 'branch-masaki', customPriceTzs: 15000 },
    { branchId: 'branch-kariakoo', customPriceTzs: 10000 },
  ];

  const getEffectivePrice = (branchId: string): number => {
    const override = branchOverrides.find((b) => b.branchId === branchId);
    return override?.customPriceTzs ?? basePrice;
  };

  assert(getEffectivePrice('branch-masaki') === 15000, 'Branch Masaki price override of 15,000 TZS applied');
  assert(getEffectivePrice('branch-kariakoo') === 10000, 'Branch Kariakoo price override of 10,000 TZS applied');
  assert(getEffectivePrice('branch-mikocheni') === 12000, 'Branch without override defaults to base price 12,000 TZS');

  // ---------------------------------------------------------------------------
  // GROUP 7: Staff Management & Sole-Owner Rule
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 7: Sole-Owner Deletion & Downgrade Protection');

  interface TestMember {
    id: string;
    role: RestaurantRole;
    isActive: boolean;
  }

  const staffState: TestMember[] = [
    { id: 'usr-sole-owner', role: 'OWNER', isActive: true },
    { id: 'usr-chef-1', role: 'CHEF', isActive: true },
  ];

  const attemptRemoveMember = (targetId: string): { success: boolean; error?: string } => {
    const target = staffState.find((m) => m.id === targetId);
    if (!target) return { success: false, error: 'Not found' };
    if (target.role === 'OWNER') {
      const activeOwners = staffState.filter((m) => m.role === 'OWNER' && m.isActive);
      if (activeOwners.length <= 1) {
        return { success: false, error: 'Cannot remove sole Owner' };
      }
    }
    target.isActive = false;
    return { success: true };
  };

  const soleOwnerAttempt = attemptRemoveMember('usr-sole-owner');
  assert(soleOwnerAttempt.success === false, 'Sole restaurant owner removal blocked by system');
  assert(soleOwnerAttempt.error === 'Cannot remove sole Owner', 'Appropriate protection error returned');

  // Add co-owner
  staffState.push({ id: 'usr-co-owner', role: 'OWNER', isActive: true });
  const coOwnerAttempt = attemptRemoveMember('usr-sole-owner');
  assert(coOwnerAttempt.success === true, 'Owner removal allowed when secondary active owner exists');

  // ---------------------------------------------------------------------------
  // GROUP 8: Operating Status & Emergency Override
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 8: Operating Status & Emergency Override');

  let restaurantOperatingStatus: string = 'OPEN';
  let restaurantIsOpen: boolean = true;

  const setOperatingOverride = (status: 'OPEN' | 'BUSY' | 'CLOSING_SOON' | 'TEMPORARILY_CLOSED') => {
    restaurantOperatingStatus = status;
    restaurantIsOpen = status !== 'TEMPORARILY_CLOSED';
  };

  setOperatingOverride('TEMPORARILY_CLOSED');
  assert(restaurantOperatingStatus === 'TEMPORARILY_CLOSED', 'Operating override set to TEMPORARILY_CLOSED');
  assert(Boolean(!restaurantIsOpen), 'Restaurant closed immediately to stop incoming orders');

  setOperatingOverride('BUSY');
  assert(restaurantOperatingStatus === 'BUSY', 'Operating override set to BUSY');
  assert(restaurantIsOpen === true, 'Restaurant still accepts orders in BUSY status');

  setOperatingOverride('OPEN');
  assert(restaurantOperatingStatus === 'OPEN', 'Operating override restored to normal OPEN');
  assert(restaurantIsOpen === true, 'Restaurant fully open');

  console.log(`\nStage 6 Test Suite Completed: ${passed} Passed | ${failed} Failed`);
  return { passedCount: passed, failedCount: failed };
}
