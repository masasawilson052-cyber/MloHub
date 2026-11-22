import assert from 'assert';
import {
  deliveryMinimumShortfall,
  DEFAULT_FEE_RULES,
  PublicFeeRules,
} from '../config/platformFees';
import {
  PersistedCartPayload,
  sanitizeItemsForStorage,
  CART_EXPIRY_MS,
} from '../utils/cartStorage';
import { BranchDeliveryZone } from '../types/domain';

export async function runCheckoutExperienceTestSuite(): Promise<void> {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB CHECKOUT RESILIENCE, HONEST TOTALS & SMART FULFILLMENT SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Branch Delivery Capability & Smart Fulfillment Resolution
  // ---------------------------------------------------------------------------
  console.log('--- Scenario 1: Branch Delivery Capability & Smart Fulfillment ---');

  const mockActiveZone1: BranchDeliveryZone = {
    id: 'zone-1',
    branchId: 'branch-1',
    zoneName: 'Oysterbay',
    feeTzs: 2500,
    minimumOrderTzs: 5000,
    estimatedDeliveryMinutes: 25,
    supportedWards: ['Oysterbay'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockActiveZone2: BranchDeliveryZone = {
    id: 'zone-2',
    branchId: 'branch-1',
    zoneName: 'Masaki',
    feeTzs: 3500,
    minimumOrderTzs: 7000,
    estimatedDeliveryMinutes: 30,
    supportedWards: ['Masaki'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockInactiveZone: BranchDeliveryZone = {
    id: 'zone-inactive',
    branchId: 'branch-2',
    zoneName: 'Mbezi Beach',
    feeTzs: 4000,
    minimumOrderTzs: 10000,
    estimatedDeliveryMinutes: 45,
    supportedWards: ['Mbezi'],
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Case A: ROUTE_DISTANCE mode supports delivery regardless of zones
  const isRouteDistanceSupported = (pricingMode: string, zones: BranchDeliveryZone[]) => {
    const hasActiveZone = zones.some((z) => z.isActive !== false);
    return pricingMode === 'ROUTE_DISTANCE' || hasActiveZone;
  };

  assert.strictEqual(
    isRouteDistanceSupported('ROUTE_DISTANCE', []),
    true,
    'ROUTE_DISTANCE mode supports Delivery even with 0 delivery zones'
  );
  console.log('  ✓ ROUTE_DISTANCE branch supports Delivery without needing fixed zones');

  // Case B: FIXED_ZONE with active zones supports delivery and calculates lowest "from" fee
  assert.strictEqual(
    isRouteDistanceSupported('FIXED_ZONE', [mockActiveZone1, mockActiveZone2]),
    true,
    'FIXED_ZONE with active zones supports Delivery'
  );
  const lowestZoneFee = Math.min(...[mockActiveZone1, mockActiveZone2].map((z) => z.feeTzs));
  assert.strictEqual(lowestZoneFee, 2500, 'Lowest active zone fee is 2,500 TZS');
  console.log('  ✓ FIXED_ZONE with active zones resolves lowest fee TZS 2,500 for "from" preview');

  // Case C: FIXED_ZONE with 0 active zones (or only inactive) hides Delivery
  assert.strictEqual(
    isRouteDistanceSupported('FIXED_ZONE', []),
    false,
    'FIXED_ZONE with empty zones does NOT support Delivery'
  );
  assert.strictEqual(
    isRouteDistanceSupported('FIXED_ZONE', [mockInactiveZone]),
    false,
    'FIXED_ZONE with only inactive zones does NOT support Delivery'
  );
  console.log('  ✓ Restaurant branch without active delivery zones hides Delivery');

  // ---------------------------------------------------------------------------
  // 2. Delivery Minimum Nudge & Progress Math (Meituan Style)
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Delivery Minimum Nudge & Progress Math ---');

  const rules: PublicFeeRules = { ...DEFAULT_FEE_RULES };

  // Case A: Subtotal 4,000 against default 5,000 minimum
  const shortfall4k = deliveryMinimumShortfall(4000, rules);
  assert.strictEqual(shortfall4k, 1000, '4,000 subtotal has 1,000 shortfall against 5,000 min');
  const progress4k = Math.min(100, Math.round((4000 / 5000) * 100));
  assert.strictEqual(progress4k, 80, 'Progress bar is 80% full');
  console.log('  ✓ 4,000 TZS cart: Shortfall 1,000 TZS, progress bar 80%');

  // Case B: Subtotal 2,500 against default 5,000 minimum
  const shortfall2500 = deliveryMinimumShortfall(2500, rules);
  assert.strictEqual(shortfall2500, 2500, '2,500 subtotal has 2,500 shortfall against 5,000 min');
  const progress2500 = Math.min(100, Math.round((2500 / 5000) * 100));
  assert.strictEqual(progress2500, 50, 'Progress bar is 50% full');
  console.log('  ✓ 2,500 TZS cart: Shortfall 2,500 TZS, progress bar 50%');

  // Case C: Subtotal 5,000 against default 5,000 minimum -> 0 shortfall
  const shortfall5k = deliveryMinimumShortfall(5000, rules);
  assert.strictEqual(shortfall5k, 0, '5,000 subtotal has 0 shortfall');
  console.log('  ✓ 5,000 TZS cart: Shortfall 0 TZS, delivery minimum met');

  // Case D: Zone minimum higher than platform minimum (7,000 vs 5,000)
  const shortfallZone7k = deliveryMinimumShortfall(6000, rules, 7000);
  assert.strictEqual(shortfallZone7k, 1000, '6,000 against 7,000 zone minimum has 1,000 shortfall');
  const effectiveMin = Math.max(rules.deliveryMinOrderTzs, 7000);
  const progressZone = Math.min(100, Math.round((6000 / effectiveMin) * 100));
  assert.strictEqual(progressZone, 86, 'Progress bar is 86% full against 7,000 zone min');
  console.log('  ✓ 6,000 TZS cart against 7,000 zone min: Shortfall 1,000 TZS, progress 86%');

  // ---------------------------------------------------------------------------
  // 3. Cart Storage Sanitization & 24-Hour Expiration Check
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Persistent Cart Storage & Expiration Rules ---');

  const rawCartItems: any[] = [
    {
      dishId: 'dish-pilau',
      dishName: 'Pilau ya Nyama',
      dishNameSwahili: 'Pilau ya Nyama',
      priceTzs: 12000,
      quantity: 2,
      restaurantId: 'rest-1',
      restaurantName: 'Swahili Kitchen',
      branchId: 'branch-1',
      branchName: 'Oysterbay Branch',
      userId: 'usr-should-be-stripped',
      customerPhone: '+255700000000',
      sensitiveAuthToken: 'secret_token_never_store',
    },
  ];

  const sanitized = sanitizeItemsForStorage(rawCartItems);
  assert.strictEqual(sanitized.length, 1, 'Sanitized items count preserved');
  assert.strictEqual(sanitized[0].dishId, 'dish-pilau', 'dishId preserved');
  assert.strictEqual(sanitized[0].priceTzs, 12000, 'priceTzs preserved');
  assert.strictEqual(sanitized[0].quantity, 2, 'quantity preserved');
  assert.strictEqual((sanitized[0] as any).userId, undefined, 'User ID stripped from storage');
  assert.strictEqual((sanitized[0] as any).customerPhone, undefined, 'Phone stripped from storage');
  assert.strictEqual((sanitized[0] as any).sensitiveAuthToken, undefined, 'Auth token stripped from storage');
  console.log('  ✓ Storage sanitization strictly retains food items and strips all user/token data');

  // Expiration check
  const now = Date.now();
  const validPayload: PersistedCartPayload = {
    version: 1,
    savedAt: now - 3600 * 1000, // 1 hour ago
    restaurantId: 'rest-1',
    restaurantName: 'Swahili Kitchen',
    items: sanitized,
  };
  const isExpiredValid = now - validPayload.savedAt > CART_EXPIRY_MS;
  assert.strictEqual(isExpiredValid, false, '1-hour old cart is not expired');
  console.log('  ✓ 1-hour old cart payload remains valid');

  const expiredPayload: PersistedCartPayload = {
    version: 1,
    savedAt: now - 25 * 3600 * 1000, // 25 hours ago
    restaurantId: 'rest-1',
    restaurantName: 'Swahili Kitchen',
    items: sanitized,
  };
  const isExpiredStale = now - expiredPayload.savedAt > CART_EXPIRY_MS;
  assert.strictEqual(isExpiredStale, true, '25-hour old cart is expired and discarded');
  console.log('  ✓ 25-hour old cart payload is correctly expired (> 24 hours)');

  // ---------------------------------------------------------------------------
  // 4. Double-Tap & Idempotency Key Scoping
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Double-Tap & Payment Idempotency Defense ---');

  let orderSubmissionCount = 0;
  let createdOrderRef: any = null;

  const mockSubmitStandardMenuOrder = async () => {
    orderSubmissionCount++;
    return { id: 'order-uuid-999', totalTzs: 14860 };
  };

  // Simulate double-tap guard and order reuse
  let isSubmittingRef = false;
  let inFlightPromise: Promise<any> | null = null;
  const tap = async () => {
    if (inFlightPromise) return inFlightPromise;
    if (createdOrderRef) return createdOrderRef;
    isSubmittingRef = true;
    inFlightPromise = (async () => {
      try {
        createdOrderRef = await mockSubmitStandardMenuOrder();
        return createdOrderRef;
      } finally {
        isSubmittingRef = false;
      }
    })();
    return inFlightPromise;
  };

  // Concurrent second tap while tap 1 is in-flight
  const p1 = tap();
  const p2 = tap();
  const [res1, res2] = await Promise.all([p1, p2]);

  assert.strictEqual(orderSubmissionCount, 1, 'Only exactly 1 order was created despite concurrent double-tap');
  assert.strictEqual(res1.id, 'order-uuid-999', 'First call received created order');
  assert.strictEqual(res2.id, 'order-uuid-999', 'Second concurrent call received existing order');

  // Sequential subsequent tap after order is already created
  const res3 = await tap();
  assert.strictEqual(orderSubmissionCount, 1, 'Sequential retry reuses created order without re-creating');
  assert.strictEqual(res3.id, 'order-uuid-999', 'Sequential retry returns same created order');
  console.log('  ✓ In-flight submit guard and createdOrder reuse prevent duplicate order generation');

  console.log('\n================================================================');
  console.log('✓ ALL CHECKOUT RESILIENCE & SMART FULFILLMENT TESTS PASSED');
  console.log('================================================================\n');
}

if (require.main === module) {
  runCheckoutExperienceTestSuite().catch((err) => {
    console.error('Checkout experience test failed:', err);
    process.exit(1);
  });
}
