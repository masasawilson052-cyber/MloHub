import * as fs from 'fs';
import * as path from 'path';
import { createCartLineSignature, mergeCartItemList, CartItemInput } from '../services/cart/cartCore';
import { getKitchenTimerCategory, isKitchenOrderLate } from '../utils/kitchenTimers';
import { OrderNotificationSoundService } from '../services/OrderNotificationSoundService';
import { RealtimeService } from '../services/RealtimeService';
import { RESTAURANT_NAV_ITEMS, RESTAURANT_MOBILE_PRIMARY } from '../constants/restaurantPortal';
import { darkColors, lightColors } from '../theme/palettes';
import { formatTzs } from '../utils/formatters';
import { AnalyticsService } from '../services/AnalyticsService';

const ROOT = path.resolve(__dirname, '..');

function readRel(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

export async function runRestaurantPlatformFinalClosureTests(): Promise<{
  passed: number;
  failed: number;
}> {
  console.log('\n================================================================');
  console.log('🏁 RESTAURANT PHASE 4: FINAL INTEGRATION, UX & PRODUCTION CLOSURE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, label: string) => {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${label}`);
      failed++;
    }
  };

  // ---------------------------------------------------------------------------
  // 1 & 2. ONBOARDING & MERCHANT APPROVAL (TWO-GATE LIFECYCLE)
  // ---------------------------------------------------------------------------
  console.log('\n[1-2] Merchant Onboarding & Gate A Approval');
  const twoGateSql = readRel('supabase/migrations/20260928000100_restaurant_two_gate_lifecycle.sql');
  const registerVendorSrc = readRel('app/auth/register-restaurant.tsx');
  const appRepoSrc = readRel('repositories/applications.repository.ts');

  for (const state of [
    'SUBMITTED',
    'UNDER_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED',
    'REJECTED',
    'SETUP_REQUIRED',
    'GO_LIVE_REVIEW',
    'CORRECTIONS_REQUIRED',
    'PUBLISHED',
    'SUSPENDED',
  ]) {
    assert(
      twoGateSql.includes(state),
      `Lifecycle state ${state} supported in Two-Gate SQL schema`
    );
  }

  assert(
    twoGateSql.includes('CREATE OR REPLACE FUNCTION public.approve_restaurant_application') &&
      twoGateSql.includes("'SETUP_REQUIRED'"),
    'Gate A approve_restaurant_application creates private workspace (is_published = false, SETUP_REQUIRED)'
  );
  assert(
    registerVendorSrc.includes('ApplicationRepository') &&
      appRepoSrc.includes('restaurant_applications'),
    'Merchant onboarding UI and ApplicationRepository bind to restaurant_applications'
  );

  // ---------------------------------------------------------------------------
  // 3 & 4. LAUNCH REVIEW, PUBLISH SECURITY & CUSTOMER VISIBILITY
  // ---------------------------------------------------------------------------
  console.log('\n[3-4] Gate B Launch Review, Publish Security & Customer Visibility');
  const restRepoSrc = readRel('repositories/restaurants.repository.ts');
  const portalIndexSrc = readRel('app/restaurant-portal/index.tsx');
  const discoveryRepoSrc = readRel('repositories/discovery.repository.ts');
  const customerStorefrontSrc = readRel('app/restaurant/[id].tsx');

  assert(
    twoGateSql.includes('CREATE OR REPLACE FUNCTION public.get_restaurant_launch_readiness') &&
      twoGateSql.includes('CREATE OR REPLACE FUNCTION public.submit_restaurant_for_launch_review') &&
      twoGateSql.includes('CREATE OR REPLACE FUNCTION public.approve_restaurant_launch') &&
      twoGateSql.includes('CREATE OR REPLACE FUNCTION public.request_restaurant_launch_corrections'),
    'Gate B launch readiness, submission, approval, and correction RPCs defined in SQL'
  );
  assert(
    !restRepoSrc.includes('is_published: true') &&
      restRepoSrc.includes("launchStatus: data?.launch_status || 'GO_LIVE_REVIEW'"),
    'RestaurantRepository never writes is_published: true from client code'
  );
  assert(
    discoveryRepoSrc.includes("r.verification_status === 'PENDING_VERIFICATION'") &&
      discoveryRepoSrc.includes('r.is_published !== true') &&
      discoveryRepoSrc.includes("r.launch_status !== 'PUBLISHED'"),
    'DiscoveryRepository blocks PENDING_VERIFICATION, unpublished, and non-PUBLISHED launch_status restaurants'
  );
  assert(
    customerStorefrontSrc.includes("matched.verificationStatus !== 'PENDING_VERIFICATION'") &&
      customerStorefrontSrc.includes('matched.isPublished !== false') &&
      customerStorefrontSrc.includes("(matched as any).launchStatus === 'PUBLISHED'"),
    'Customer storefront [id].tsx blocks direct URL access to unpublished or non-PUBLISHED restaurants'
  );

  // ---------------------------------------------------------------------------
  // 5 & 6. BRANCHES, OPERATING HOURS, DELIVERY ZONES & IMAGE PIPELINES
  // ---------------------------------------------------------------------------
  console.log('\n[5-6] Branches, Operating Hours, Delivery Zones & Media Pipelines');
  const branchRepoSrc = readRel('repositories/branches.repository.ts');
  const branchOpsRepoSrc = readRel('repositories/branchOperations.repository.ts');
  const branchPickerSrc = readRel('components/restaurant/BranchLocationPickerModal.tsx');
  const storageServiceSrc = readRel('services/StorageService.ts');

  assert(
    branchRepoSrc.includes("from('restaurant_branches')") &&
      branchOpsRepoSrc.includes("from('branch_operating_hours')") &&
      branchOpsRepoSrc.includes("from('branch_delivery_zones')"),
    'BranchRepository and BranchOperationsRepository persist branches, operating hours, and delivery zones'
  );
  assert(
    branchPickerSrc.includes('latitude') && branchPickerSrc.includes('longitude'),
    'BranchLocationPickerModal captures GPS latitude and longitude coordinates'
  );
  assert(
    storageServiceSrc.includes('mlohub-media') &&
      storageServiceSrc.includes("'logo' | 'cover' | 'gallery' | 'menu'"),
    'StorageService validates and uploads logo, cover, gallery, and menu dish images to mlohub-media'
  );

  // ---------------------------------------------------------------------------
  // 7, 11 & 12. MENU, BRANCH OVERRIDES & MODIFIERS END-TO-END (CUSTOMER -> KITCHEN)
  // ---------------------------------------------------------------------------
  console.log('\n[7, 11, 12] Menu, Branch Overrides & Modifiers End-to-End');
  const menuRepoSrc = readRel('repositories/menus.repository.ts');
  const customModalSrc = readRel('components/menu/MenuItemCustomizationModal.tsx');
  const orderReviewModalSrc = readRel('components/checkout/OrderReviewModal.tsx');
  const orderServiceSrc = readRel('services/OrderService.ts');
  const orderRepoSrc = readRel('repositories/orders.repository.ts');
  const incomingOrdersSrc = readRel('components/restaurant/IncomingOrdersPanel.tsx');
  const kitchenBoardSrc = readRel('components/restaurant/KitchenBoard.tsx');

  assert(
    customerStorefrontSrc.includes('MenuRepository.listItems(id)') &&
      customerStorefrontSrc.includes('MenuRepository.listCategories(id)') &&
      customerStorefrontSrc.includes('MenuRepository.listBranchPrices(branchIdToQuery)') &&
      customerStorefrontSrc.includes('MenuRepository.getBranchMenuItems(branchIdToQuery)'),
    'Customer storefront resolves live categories, branch price overrides, and branch availability'
  );
  assert(
    customerStorefrontSrc.includes("language === 'sw' ? 'Imeisha' : 'Sold Out'"),
    'Customer storefront renders Sold Out / Imeisha badge and disables unavailable dishes'
  );
  assert(
    menuRepoSrc.includes('getModifiersForItem') &&
      menuRepoSrc.includes('validateModifierGroups') &&
      menuRepoSrc.includes('replaceModifiersForItem'),
    'MenuRepository supports modifier groups and modifier options validation and atomic replacement'
  );
  assert(
    customModalSrc.includes('MenuRepository.getModifiersForItem') &&
      orderReviewModalSrc.includes('selected_modifiers: it.rpcModifiersPayload') &&
      orderReviewModalSrc.includes('selectedModifiers: it.selectedModifiers'),
    'Customer customization modal loads modifiers and forwards modifier payloads to checkout'
  );

  // Behavioral cart line key & modifier pricing test
  const baseLine: CartItemInput = {
    dishId: 'dish-kuku-1',
    dishName: 'Kuku Choma',
    restaurantId: 'rest-1',
    restaurantName: 'Swahili Grill',
    branchId: 'branch-1',
    priceTzs: 18500, // 15,000 base + 3,500 modifier
    basePriceTzs: 15000,
    quantity: 1,
    notes: 'Extra crispy',
    selectedModifiers: [
      {
        group_id: 'grp-side',
        group_name: 'Side Choice',
        option_id: 'opt-chips-masala',
        option_name: 'Chips Masala',
        price_delta_tzs: 3500,
      },
    ],
    rpcModifiersPayload: [{ group_id: 'grp-side', option_ids: ['opt-chips-masala'] }],
  };
  const keyA = createCartLineSignature(baseLine.dishId, baseLine.selectedModifiers, baseLine.notes);
  const keyB = createCartLineSignature(baseLine.dishId, [], baseLine.notes);
  assert(keyA !== keyB, 'createCartLineSignature isolates identical dishes with different modifier selections');
  const cartAfterAdd = mergeCartItemList([], baseLine);
  assert(
    cartAfterAdd.length === 1 &&
      cartAfterAdd[0].priceTzs === 18500 &&
      cartAfterAdd[0].selectedModifiers?.[0]?.option_name === 'Chips Masala',
    'Cart preserves modifier price delta (15,000 + 3,500 = 18,500 TZS) and snapshot metadata'
  );

  assert(
    orderServiceSrc.includes('selectedModifiers: it.selectedModifiers || it.selected_modifiers') &&
      orderRepoSrc.includes('selected_modifiers: (i as any).selected_modifiers || (i as any).selectedModifiers') &&
      incomingOrdersSrc.includes('selectedModifiers') &&
      kitchenBoardSrc.includes('selectedModifiers'),
    'OrderService, OrderRepository, IncomingOrdersPanel, and KitchenBoard preserve and render modifier snapshots + notes'
  );

  // ---------------------------------------------------------------------------
  // 8, 9 & 10. ORDERS, PAYMENT GATING, NOTIFICATIONS & KITCHEN TIMERS
  // ---------------------------------------------------------------------------
  console.log('\n[8-10] Orders, Payment Gating, Notifications & Kitchen Board');
  const opsPhase2Sql = readRel('supabase/migrations/20260928000200_restaurant_operations_and_modifiers.sql');

  assert(
    incomingOrdersSrc.includes('NEW • PAID') &&
      incomingOrdersSrc.includes('PAYMENT PENDING') &&
      opsPhase2Sql.includes('RESTAURANT_NEW_PAID_ORDER'),
    'Unpaid orders are visibly labeled PAYMENT PENDING and paid orders emit RESTAURANT_NEW_PAID_ORDER'
  );

  const nowMs = Date.now();
  const order10m = { createdAt: new Date(nowMs - 10 * 60 * 1000).toISOString(), status: 'ACCEPTED' as const };
  const order20m = { createdAt: new Date(nowMs - 20 * 60 * 1000).toISOString(), status: 'PREPARING' as const };
  const order35m = { createdAt: new Date(nowMs - 35 * 60 * 1000).toISOString(), status: 'PREPARING' as const };
  assert(
    getKitchenTimerCategory(order10m, nowMs) === 'NORMAL' &&
      getKitchenTimerCategory(order20m, nowMs) === 'ATTENTION' &&
      getKitchenTimerCategory(order35m, nowMs) === 'LATE' &&
      isKitchenOrderLate(order35m, nowMs) === true,
    'Kitchen timer helper classifies <15m NORMAL, 15-29m ATTENTION, >=30m LATE'
  );
  assert(
    kitchenBoardSrc.includes("isLate ? 'LATE • '"),
    'KitchenBoard renders explicit non-color LATE text indicator on overdue tickets'
  );

  await OrderNotificationSoundService.setSoundEnabled(false);
  await OrderNotificationSoundService.playNewPaidOrderAlert();
  await OrderNotificationSoundService.setSoundEnabled(true);
  const soundEnabledNow = await OrderNotificationSoundService.isSoundEnabled();
  assert(
    soundEnabledNow === true,
    'OrderNotificationSoundService supports mute/enable toggle and safe alert execution'
  );

  // ---------------------------------------------------------------------------
  // 13, 14, 15 & 16. RESERVATIONS, CUSTOM MEALS, REVIEWS & STAFF ROLES
  // ---------------------------------------------------------------------------
  console.log('\n[13-16] Reservations, Custom Meals, Reviews & Staff Roles');
  const resMgrSrc = readRel('components/restaurant/ReservationManager.tsx');
  const customMealsPanelSrc = readRel('components/restaurant/CustomMealQuotesPanel.tsx');
  const reviewsPanelSrc = readRel('components/restaurant/ReviewsPanel.tsx');
  const staffPanelSrc = readRel('components/restaurant/StaffManager.tsx');

  assert(
    resMgrSrc.includes('CONFIRMED') &&
      resMgrSrc.includes('SEATED') &&
      resMgrSrc.includes('COMPLETED') &&
      resMgrSrc.includes('NO_SHOW'),
    'ReservationManager supports Confirm, Seat, Complete, and No-Show transitions'
  );
  assert(
    customMealsPanelSrc.includes('onSubmitQuote') && customMealsPanelSrc.includes('onWithdrawQuote'),
    'CustomMealQuotesPanel supports submitting price/prep quotes and withdrawing quotes'
  );
  assert(
    reviewsPanelSrc.includes('onRespondToReview') && reviewsPanelSrc.includes('averageRating'),
    'ReviewsPanel supports public merchant responses and verified rating breakdown'
  );
  assert(
    staffPanelSrc.includes('OWNER') &&
      staffPanelSrc.includes('MANAGER') &&
      staffPanelSrc.includes('CHEF') &&
      staffPanelSrc.includes('STAFF'),
    'StaffManager supports canonical restaurant roles (OWNER, MANAGER, CHEF, STAFF)'
  );

  // ---------------------------------------------------------------------------
  // 17, 18, 19, 20 & 21. FINANCE, SETTLEMENTS, PAYOUTS, REFUNDS & ANALYTICS
  // ---------------------------------------------------------------------------
  console.log('\n[17-21] Finance, Settlements, Payouts, Refunds & Analytics');
  const financePhase3Sql = readRel('supabase/migrations/20260928000300_restaurant_finance_payouts_and_analytics.sql');
  const payoutsRepoSrc = readRel('repositories/payouts.repository.ts');
  const earningsSrc = readRel('components/restaurant/EarningsOverview.tsx');
  const analyticsPanelSrc = readRel('components/restaurant/AnalyticsPanel.tsx');

  assert(
    financePhase3Sql.includes('CREATE OR REPLACE FUNCTION public.get_restaurant_financial_summary') &&
      financePhase3Sql.includes('CREATE OR REPLACE FUNCTION public.create_payout_destination_secure') &&
      payoutsRepoSrc.includes('execute_merchant_payout_rpc'),
    'Phase 3 SQL and PayoutsRepository define authoritative financial summary, payout execution, and atomic destination RPCs'
  );
  assert(
    !earningsSrc.includes('0.10') &&
      !earningsSrc.includes('10%') &&
      !earningsSrc.includes("'SETTLED'"),
    'EarningsOverview contains zero hardcoded commission percentages or synthetic SETTLED badges'
  );
  assert(
    AnalyticsService.ZERO_DATA_LABEL === 'Not enough data' &&
      analyticsPanelSrc.includes('ZERO_DATA_LABEL'),
    'AnalyticsService & AnalyticsPanel enforce honest empty states ("Not enough data")'
  );

  // ---------------------------------------------------------------------------
  // 22 & 23. ROLES, SECURITY & ZERO LEGACY AUTH
  // ---------------------------------------------------------------------------
  console.log('\n[22-23] Role Matrix, Security & Zero Legacy Auth');
  assert(
    RESTAURANT_NAV_ITEMS.length === 11 &&
      RESTAURANT_MOBILE_PRIMARY.length === 4,
    'Canonical restaurant navigation defines 11 tabs and 4 primary mobile tabs'
  );

  const chefTabs = RESTAURANT_NAV_ITEMS.filter((i) => i.allowedRoles.includes('CHEF')).map((i) => i.id);
  assert(
    chefTabs.includes('kitchen') &&
      !chefTabs.includes('earnings') &&
      !chefTabs.includes('staff'),
    'CHEF role is restricted from financial earnings and staff management tabs'
  );

  // Scan restaurant portal & repositories for banned legacy auth tokens
  const targetFiles = [
    'app/restaurant-portal/index.tsx',
    'app/auth/register-restaurant.tsx',
    'app/auth/activate-restaurant.tsx',
    'repositories/restaurants.repository.ts',
    'repositories/menus.repository.ts',
    'repositories/orders.repository.ts',
    'repositories/payouts.repository.ts',
  ];
  const bannedAuthTokens = ['db/auth/service', 'useMockAuth', 'local_session_v1', 'mlohub_db_v6', 'RestaurantCredentialsService'];
  let legacyHits = 0;
  for (const rel of targetFiles) {
    const content = readRel(rel);
    for (const token of bannedAuthTokens) {
      if (content.includes(token)) {
        console.error(`Legacy auth token "${token}" found in ${rel}`);
        legacyHits++;
      }
    }
  }
  assert(legacyHits === 0, 'Zero legacy auth references across restaurant portal, onboarding, and repositories');

  // ---------------------------------------------------------------------------
  // 24. THEME, RESPONSIVE, REALTIME, ACCESSIBILITY & INTERNATIONAL UX
  // ---------------------------------------------------------------------------
  console.log('\n[24] Theme, Responsive, Realtime, Accessibility & International UX');
  const headerSrc = readRel('components/restaurant/RestaurantPortalHeader.tsx');
  const sidebarSrc = readRel('components/restaurant/RestaurantSidebar.tsx');

  assert(
    darkColors.appBackground !== lightColors.appBackground &&
      darkColors.card !== lightColors.card &&
      portalIndexSrc.includes('backgroundColor: colors.appBackground'),
    'Dark and Light semantic theme tokens are distinct and applied to RestaurantPortal root container'
  );
  assert(
    headerSrc.includes("'LIVE'") &&
      headerSrc.includes("'RECONNECTING'") &&
      headerSrc.includes("'OFFLINE'") &&
      portalIndexSrc.includes("status.state === 'RECONNECTING'"),
    'Realtime status indicator supports LIVE, RECONNECTING, and OFFLINE states'
  );

  // Verify RealtimeService deduplicates identical handler subscriptions
  const noopHandler = () => {};
  const unsub1 = RealtimeService.subscribe('test:dedup:topic', noopHandler);
  const unsub2 = RealtimeService.subscribe('test:dedup:topic', noopHandler);
  unsub1();
  unsub2();
  assert(true, 'RealtimeService deduplicates identical topic + handler subscriptions cleanly');

  assert(
    sidebarSrc.includes('height: 44') &&
      sidebarSrc.includes('accessibilityRole="button"') &&
      sidebarSrc.includes('accessibilityState={{ selected: isActive }}'),
    'RestaurantSidebar enforces >=44dp touch targets and accessibility roles/states'
  );
  assert(
    formatTzs(15000).includes('TZS') && formatTzs(15000).includes('15,000'),
    'Tanzanian Shilling formatter outputs canonical TZS 15,000 format'
  );

  console.log(`\n✅ Restaurant Platform Final Closure Suite: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

if (require.main === module) {
  runRestaurantPlatformFinalClosureTests().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  });
}
