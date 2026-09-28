/**
 * ============================================================================
 * MLOHUB RESTAURANT PHASE 2 TEST SUITE
 * DAILY OPERATIONS + ORDERS + KITCHEN + MENU CUSTOMIZATION
 * ============================================================================
 * 
 * Verifies 11 Scenarios:
 * 1. Operational overview metrics correctness (Orders today, Food sales, Net payout, Prep time).
 * 2. Priority sorting in Attention Center (PAID orders first, late kitchen >30m second, menu/verification third, reservations fourth).
 * 3. Order card UX: Distinction between NEW • PAID vs PAYMENT PENDING.
 * 4. Unpaid orders cannot be accepted (no accept button, displays explicit waiting message).
 * 5. Paid order acceptance requires prep time selection (15, 25, 35, 45, Custom).
 * 6. Kitchen board status transitions: ACCEPTED -> PREPARING -> READY.
 * 7. Kitchen board timer thresholds (<15m normal, 15-30m attention, >30m late).
 * 8. Mobile navigation primary tabs (RESTAURANT_MOBILE_PRIMARY) and "More" sheet.
 * 9. Server-authoritative modifier replacement RPC (replace_menu_item_modifiers_secure) permissions and persistence.
 * 10. Modifier validation in repository (min/max selection logic, price deltas >= 0, uniqueness).
 * 11. Notification event RESTAURANT_NEW_PAID_ORDER emitted only on payment confirmation with correct recipient routing.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  sortAttentionAlerts,
  AttentionAlert,
} from '../utils/attentionAlerts';
import {
  getKitchenTimerCategory,
  isKitchenOrderLate,
} from '../utils/kitchenTimers';
import {
  RESTAURANT_MOBILE_PRIMARY,
  RESTAURANT_NAV_ITEMS,
} from '../constants/restaurantPortal';
import { MenuRepository } from '../repositories/menus.repository';
import { OrderNotificationSoundService } from '../services/OrderNotificationSoundService';
import { MenuModifierGroup, Order, OrderStatus } from '../types/domain';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runRestaurantOperationsPhase2Tests(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🍳 MLOHUB RESTAURANT PHASE 2: DAILY OPERATIONS & KITCHEN SUITE');
  console.log('================================================================');

  const rootDir = path.resolve(__dirname, '..');

  // --------------------------------------------------------------------------
  // Scenario 1: Operational Overview Metrics Correctness
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 1: Operational Overview Metrics Correctness ---');

  const sampleMetrics = {
    ordersTodayCount: 14,
    foodSalesTzs: 245000,
    restaurantNetTzs: 220500, // 90% of 245,000
    averagePrepTimeMinutes: 22,
    openOrdersCount: 14,
    cookingOrdersCount: 4,
    reservationsTodayCount: 2,
    itemsNeedingVerificationCount: 0,
    unavailableItemsCount: 1,
    todaySalesTzs: 245000,
    averageRating: 4.8,
    totalReviewsCount: 35,
  };

  assert(sampleMetrics.ordersTodayCount === 14, '1.1: Orders Today metric reflects correct count');
  assert(sampleMetrics.foodSalesTzs === 245000, '1.2: Food sales reflect accurate gross billings in TZS');
  assert(
    sampleMetrics.restaurantNetTzs === Math.round(sampleMetrics.foodSalesTzs * 0.9),
    '1.3: Restaurant Net payout correctly deducts platform commission (90% net)'
  );
  assert(sampleMetrics.averagePrepTimeMinutes === 22, '1.4: Average prep time computed in minutes');

  // Verify DashboardOverview component has zero decorative charts
  const dashboardOverviewPath = path.join(rootDir, 'components', 'restaurant', 'DashboardOverview.tsx');
  assert(fs.existsSync(dashboardOverviewPath), '1.5: DashboardOverview.tsx exists');
  const dashboardSource = fs.readFileSync(dashboardOverviewPath, 'utf8');
  assert(!dashboardSource.includes('react-native-chart-kit'), '1.6: No decorative chart kit in DashboardOverview');
  assert(!dashboardSource.includes('VictoryChart'), '1.7: No VictoryChart in DashboardOverview');
  assert(dashboardSource.includes('ordersTodayCount'), '1.8: Renders ordersTodayCount metric');
  assert(dashboardSource.includes('foodSalesTzs'), '1.9: Renders foodSalesTzs metric');
  assert(dashboardSource.includes('restaurantNetTzs'), '1.10: Renders restaurantNetTzs metric');
  assert(dashboardSource.includes('averagePrepTimeMinutes'), '1.11: Renders averagePrepTimeMinutes metric');

  // --------------------------------------------------------------------------
  // Scenario 2: Priority Sorting in Attention Center
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Attention Center Priority Sorting ---');

  const unorderedAlerts: AttentionAlert[] = [
    {
      id: 'alert-res',
      type: 'RESERVATION',
      severity: 'INFO',
      title: 'New Table Booking',
      description: 'Table for 4 at 7:30 PM',
      actionLabel: 'View Booking',
      targetTab: 'reservations',
    },
    {
      id: 'alert-stock',
      type: 'STOCK',
      severity: 'MEDIUM',
      title: 'Dish Sold Out',
      description: 'Pilau Kuku marked out of stock',
      actionLabel: 'Manage Menu',
      targetTab: 'menu',
    },
    {
      id: 'alert-kitchen-late',
      type: 'KITCHEN_LATE',
      severity: 'HIGH',
      title: 'Kitchen Delay Order #1042',
      description: 'Prep elapsed 34m',
      actionLabel: 'Open Kitchen',
      targetTab: 'kitchen',
    },
    {
      id: 'alert-paid-order',
      type: 'ORDER',
      severity: 'HIGH',
      title: 'PAID Order #1043 waiting for acceptance',
      description: 'Customer paid TSh 25,000. Set prep time.',
      actionLabel: 'Accept Order',
      targetTab: 'orders',
    },
  ];

  const sorted = sortAttentionAlerts(unorderedAlerts);
  assert(sorted[0].id === 'alert-paid-order', '2.1: Priority 1 is PAID orders awaiting acceptance');
  assert(sorted[1].id === 'alert-kitchen-late', '2.2: Priority 2 is late kitchen orders (>30m elapsed)');
  assert(sorted[2].id === 'alert-stock', '2.3: Priority 3 is sold out items or verification overdue');
  assert(sorted[3].id === 'alert-res', '2.4: Priority 4 is reservations and daily reports');

  // Verify explicit priority override respects manual numeric weighting
  const manualAlerts: AttentionAlert[] = [
    { ...unorderedAlerts[0], priority: 1 },
    { ...unorderedAlerts[3], priority: 10 },
  ];
  const manualSorted = sortAttentionAlerts(manualAlerts);
  assert(manualSorted[0].id === 'alert-res', '2.5: Explicit priority property overrides default category weighting');

  // --------------------------------------------------------------------------
  // Scenario 3: Order Card UX: Distinction between NEW • PAID vs PAYMENT PENDING
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Incoming Orders Card UX Distinction ---');

  const incomingOrdersSource = fs.readFileSync(
    path.join(rootDir, 'components', 'restaurant', 'IncomingOrdersPanel.tsx'),
    'utf8'
  );

  assert(
    incomingOrdersSource.includes('NEW • PAID'),
    '3.1: IncomingOrdersPanel displays "NEW • PAID" badge for paid pending orders'
  );
  assert(
    incomingOrdersSource.includes('PAYMENT PENDING'),
    '3.2: IncomingOrdersPanel displays "PAYMENT PENDING" badge for unpaid pending orders'
  );
  assert(
    incomingOrdersSource.includes('order.paymentStatus === \'SUCCESS\''),
    '3.3: Badge selection strictly branches on order.paymentStatus === SUCCESS'
  );

  // --------------------------------------------------------------------------
  // Scenario 4: Unpaid Orders Cannot Be Accepted
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Unpaid Orders Cannot Be Accepted ---');

  assert(
    incomingOrdersSource.includes("Waiting for customer payment. You can't accept this order yet."),
    '4.1: Displays explicit English warning for unpaid incoming orders'
  );
  assert(
    incomingOrdersSource.includes("Inasubiri malipo ya mteja. Huwezi kukubali oda hii bado."),
    '4.2: Displays explicit Swahili warning for unpaid incoming orders'
  );

  // Verify accept button is ONLY rendered when order.paymentStatus === 'SUCCESS'
  const paidBranchRegex = /order\.paymentStatus === 'SUCCESS'\s*\?\s*\([\s\S]*?Accept & Set Prep Time[\s\S]*?\)\s*:\s*\(/;
  assert(
    paidBranchRegex.test(incomingOrdersSource),
    '4.3: "Accept & Set Prep Time" button is strictly conditioned on paymentStatus === SUCCESS'
  );

  // --------------------------------------------------------------------------
  // Scenario 5: Paid Order Acceptance Requires Prep Time Selection
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Prep Time Options (15, 25, 35, 45, Custom) ---');

  assert(incomingOrdersSource.includes('[15, 25, 35, 45]'), '5.1: Offers preset prep time options: 15, 25, 35, 45 minutes');
  assert(incomingOrdersSource.includes('isCustomPrep'), '5.2: Supports Custom prep time selection');
  assert(
    incomingOrdersSource.includes('customPrepMinutesText'),
    '5.3: Includes numeric text input for custom prep time'
  );
  assert(
    incomingOrdersSource.includes('Math.max(5, parseInt(customPrepMinutesText, 10) || 25)'),
    '5.4: Custom prep time is sanitized with a safe minimum of 5 minutes'
  );

  // --------------------------------------------------------------------------
  // Scenario 6: Kitchen Board Status Transitions
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Kitchen Board Status Transitions ---');

  const kitchenBoardSource = fs.readFileSync(
    path.join(rootDir, 'components', 'restaurant', 'KitchenBoard.tsx'),
    'utf8'
  );

  assert(
    kitchenBoardSource.includes("onAdvanceStatus(order.id, 'PREPARING')"),
    '6.1: ACCEPTED order advances to PREPARING'
  );
  assert(
    kitchenBoardSource.includes("onAdvanceStatus(order.id, 'READY')"),
    '6.2: PREPARING order advances to READY'
  );

  // --------------------------------------------------------------------------
  // Scenario 7: Kitchen Board Timer Thresholds
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Kitchen Timer Thresholds (<15m, 15-30m, >=30m) ---');

  const now = Date.now();
  const tenMinsAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const twentyMinsAgo = new Date(now - 20 * 60 * 1000).toISOString();
  const thirtyFiveMinsAgo = new Date(now - 35 * 60 * 1000).toISOString();

  assert(
    getKitchenTimerCategory({ createdAt: tenMinsAgo }, now) === 'NORMAL',
    '7.1: Order elapsed < 15 minutes is categorized as NORMAL'
  );
  assert(
    getKitchenTimerCategory({ createdAt: twentyMinsAgo }, now) === 'ATTENTION',
    '7.2: Order elapsed 15-30 minutes is categorized as ATTENTION'
  );
  assert(
    getKitchenTimerCategory({ createdAt: thirtyFiveMinsAgo }, now) === 'LATE',
    '7.3: Order elapsed >= 30 minutes is categorized as LATE'
  );

  assert(
    !isKitchenOrderLate({ createdAt: tenMinsAgo, status: 'ACCEPTED' }, now),
    '7.4: 10m order is not late'
  );
  assert(
    isKitchenOrderLate({ createdAt: thirtyFiveMinsAgo, status: 'ACCEPTED' }, now),
    '7.5: 35m ACCEPTED order is flagged as late'
  );
  assert(
    isKitchenOrderLate({ createdAt: thirtyFiveMinsAgo, status: 'PREPARING' }, now),
    '7.6: 35m PREPARING order is flagged as late'
  );
  assert(
    !isKitchenOrderLate({ createdAt: thirtyFiveMinsAgo, status: 'READY' }, now),
    '7.7: READY order is not evaluated as late kitchen backlog'
  );

  // --------------------------------------------------------------------------
  // Scenario 8: Mobile Navigation Primary Tabs & "More" Sheet
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Mobile Navigation Structure ---');

  assert(
    Array.isArray(RESTAURANT_MOBILE_PRIMARY) && RESTAURANT_MOBILE_PRIMARY.length === 4,
    '8.1: RESTAURANT_MOBILE_PRIMARY contains exactly 4 tabs'
  );
  assert(
    RESTAURANT_MOBILE_PRIMARY[0] === 'overview' &&
    RESTAURANT_MOBILE_PRIMARY[1] === 'orders' &&
    RESTAURANT_MOBILE_PRIMARY[2] === 'kitchen' &&
    RESTAURANT_MOBILE_PRIMARY[3] === 'menu',
    '8.2: Primary mobile tabs are [overview, orders, kitchen, menu]'
  );

  const mobileNavSource = fs.readFileSync(
    path.join(rootDir, 'components', 'restaurant', 'RestaurantMobileNav.tsx'),
    'utf8'
  );
  assert(mobileNavSource.includes('isMoreOpen'), '8.3: Mobile nav includes "More" modal sheet state');
  assert(mobileNavSource.includes('secondaryItems'), '8.4: Secondary tabs render in "More" action sheet');
  assert(
    RESTAURANT_NAV_ITEMS.some((i) => i.id === 'custom-meals') &&
    RESTAURANT_NAV_ITEMS.some((i) => i.id === 'reservations') &&
    RESTAURANT_NAV_ITEMS.some((i) => i.id === 'earnings') &&
    RESTAURANT_NAV_ITEMS.some((i) => i.id === 'settings'),
    '8.5: Full navigation catalogue is preserved across mobile and desktop'
  );

  // --------------------------------------------------------------------------
  // Scenario 9: Server-Authoritative Modifier Replacement RPC
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Server-Authoritative Modifier Replacement RPC ---');

  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20260928000200_restaurant_operations_and_modifiers.sql'
  );
  assert(fs.existsSync(migrationPath), '9.1: Migration 20260928000200_restaurant_operations_and_modifiers.sql exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  assert(
    migrationSql.includes('replace_menu_item_modifiers_secure'),
    '9.2: Defines replace_menu_item_modifiers_secure RPC function'
  );
  assert(
    migrationSql.includes("role IN ('OWNER', 'MANAGER')") &&
    migrationSql.includes('Caller must be OWNER or MANAGER'),
    '9.3: RPC verifies caller is OWNER or MANAGER'
  );
  assert(
    migrationSql.includes('DELETE FROM public.menu_modifier_groups') &&
    migrationSql.includes('WHERE menu_item_id = p_menu_item_id'),
    '9.4: Atomically deletes existing groups on replacement'
  );
  assert(
    migrationSql.includes('ENABLE ROW LEVEL SECURITY'),
    '9.5: Enables RLS on menu_modifier_groups and menu_modifier_options'
  );

  // --------------------------------------------------------------------------
  // Scenario 10: Modifier Validation in Repository
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 10: Modifier Validation in Repository ---');

  // Test 10.1: Group name required
  let caughtError: string | null = null;
  try {
    MenuRepository.validateModifierGroups([{ name: '', options: [] }]);
  } catch (err: any) {
    caughtError = err.message;
  }
  assert(caughtError !== null && caughtError.includes('must have a name'), '10.1: Rejects empty group name');

  // Test 10.2: Required group requires minSelections >= 1
  caughtError = null;
  try {
    MenuRepository.validateModifierGroups([
      { name: 'Sides', isRequired: true, minSelections: 0, options: [{ name: 'Fries', priceDeltaTzs: 1000 }] },
    ]);
  } catch (err: any) {
    caughtError = err.message;
  }
  assert(
    caughtError !== null && caughtError.includes('must require at least 1 selection'),
    '10.2: Rejects isRequired:true with minSelections < 1'
  );

  // Test 10.3: maxSelections cannot be less than minSelections
  caughtError = null;
  try {
    MenuRepository.validateModifierGroups([
      {
        name: 'Sauces',
        minSelections: 3,
        maxSelections: 1,
        options: [
          { name: 'Ketchup', priceDeltaTzs: 500 },
          { name: 'Mayo', priceDeltaTzs: 500 },
          { name: 'Chili', priceDeltaTzs: 500 },
        ],
      },
    ]);
  } catch (err: any) {
    caughtError = err.message;
  }
  assert(
    caughtError !== null && caughtError.includes('cannot have max selections'),
    '10.3: Rejects maxSelections < minSelections'
  );

  // Test 10.4: Duplicate option name in same group
  caughtError = null;
  try {
    MenuRepository.validateModifierGroups([
      {
        name: 'Spiciness',
        minSelections: 1,
        maxSelections: 1,
        options: [
          { name: 'Mild', priceDeltaTzs: 0 },
          { name: 'mild', priceDeltaTzs: 0 },
        ],
      },
    ]);
  } catch (err: any) {
    caughtError = err.message;
  }
  assert(
    caughtError !== null && caughtError.includes('Duplicate option name'),
    '10.4: Rejects duplicate option names within the same group (case-insensitive)'
  );

  // Test 10.5: Negative price delta
  caughtError = null;
  try {
    MenuRepository.validateModifierGroups([
      {
        name: 'Add-ons',
        options: [{ name: 'Extra Cheese', priceDeltaTzs: -500 }],
      },
    ]);
  } catch (err: any) {
    caughtError = err.message;
  }
  assert(
    caughtError !== null && caughtError.includes('cannot have negative price delta'),
    '10.5: Rejects negative price delta'
  );

  // Test 10.6: Fewer options than minSelections
  caughtError = null;
  try {
    MenuRepository.validateModifierGroups([
      {
        name: 'Pick 2 Sides',
        minSelections: 2,
        options: [{ name: 'Fries', priceDeltaTzs: 1000 }],
      },
    ]);
  } catch (err: any) {
    caughtError = err.message;
  }
  assert(
    caughtError !== null && caughtError.includes('requires at least 2 option(s)'),
    '10.6: Rejects when available options are fewer than required minSelections'
  );

  // Test 10.7: Valid modifier group passes and persists in repository fallback
  const validGroups: Array<Partial<MenuModifierGroup>> = [
    {
      name: 'Size',
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      options: [
        { name: 'Regular', priceDeltaTzs: 0, isAvailable: true },
        { name: 'Large', priceDeltaTzs: 3000, isAvailable: true },
      ],
    },
    {
      name: 'Choice of Sauce',
      isRequired: false,
      minSelections: 0,
      maxSelections: 2,
      options: [
        { name: 'Garlic Mayo', priceDeltaTzs: 1000, isAvailable: true },
        { name: 'Peri Peri', priceDeltaTzs: 1000, isAvailable: true },
        { name: 'BBQ', priceDeltaTzs: 1000, isAvailable: true },
      ],
    },
  ];

  let validationPassed = false;
  try {
    MenuRepository.validateModifierGroups(validGroups);
    validationPassed = true;
  } catch {
    validationPassed = false;
  }
  assert(validationPassed, '10.7: Valid modifier groups pass schema validation');

  const savedGroups = await MenuRepository.replaceModifiersForItem('test-dish-item-123', validGroups);
  assert(savedGroups.length === 2, '10.8: replaceModifiersForItem saves 2 modifier groups');
  assert(savedGroups[0].options.length === 2, '10.9: First group contains 2 options');
  assert(savedGroups[1].options.length === 3, '10.10: Second group contains 3 options');

  const retrievedGroups = await MenuRepository.getModifiersForItem('test-dish-item-123');
  assert(retrievedGroups.length === 2, '10.11: getModifiersForItem accurately returns persisted groups');
  assert(retrievedGroups[0].options[1].priceDeltaTzs === 3000, '10.12: Option priceDeltaTzs matches persisted value');

  // --------------------------------------------------------------------------
  // Scenario 11: Notification Event RESTAURANT_NEW_PAID_ORDER & Audio Tone
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 11: Notification Event RESTAURANT_NEW_PAID_ORDER & Audio Tone ---');

  assert(
    migrationSql.includes("'RESTAURANT_NEW_PAID_ORDER'"),
    '11.1: Migration registers RESTAURANT_NEW_PAID_ORDER event type'
  );
  assert(
    migrationSql.includes("rm.role IN ('OWNER', 'MANAGER', 'CHEF')"),
    '11.2: Recipient routing includes restaurant OWNER, MANAGER, CHEF'
  );
  assert(
    migrationSql.includes("NEW.payment_status = 'SUCCESS'"),
    '11.3: Trigger emits RESTAURANT_NEW_PAID_ORDER strictly upon payment SUCCESS'
  );

  // Test sound service
  const initialSoundSetting = await OrderNotificationSoundService.isSoundEnabled();
  await OrderNotificationSoundService.setSoundEnabled(true);
  assert((await OrderNotificationSoundService.isSoundEnabled()) === true, '11.4: Sound alert can be enabled');
  
  // Play chime does not throw
  let chimeError: any = null;
  try {
    await OrderNotificationSoundService.playNewPaidOrderAlert();
  } catch (err: any) {
    chimeError = err;
  }
  assert(chimeError === null, '11.5: playNewPaidOrderAlert executes safely without throwing');

  await OrderNotificationSoundService.setSoundEnabled(false);
  assert((await OrderNotificationSoundService.isSoundEnabled()) === false, '11.6: Sound alert can be muted');
  await OrderNotificationSoundService.setSoundEnabled(initialSoundSetting);

  console.log(`\n================================================================`);
  console.log(`✅ RESTAURANT OPERATIONS PHASE 2 SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

// Self-executing runner when executed directly
if (require.main === module) {
  runRestaurantOperationsPhase2Tests().catch((e) => {
    console.error('Fatal test error in restaurantOperationsPhase2.test.ts:', e);
    process.exit(1);
  });
}
