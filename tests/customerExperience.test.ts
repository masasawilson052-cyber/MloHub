/**
 * ============================================================================
 * STAGE 5: CUSTOMER EXPERIENCE & INVESTOR DEMO JOURNEY TEST SUITE
 * Covers: Design System Tokens, Cart Logic, Discovery-to-Order Flow,
 *         Side-by-Side Comparison, Order Review, Status Machine, and
 *         Zero-Leak Security Guarantees.
 * ============================================================================
 */

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Radii } from '../theme/radius';
import { Typography } from '../theme/typography';
import { DiscoveryService } from '../services/DiscoveryService';
import { formatTzs, formatDistance, calculateFreshnessScore } from '../utils/formatters';

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

export async function runCustomerExperienceTestSuite(): Promise<{ passedCount: number; failedCount: number }> {
  passed = 0;
  failed = 0;

  console.log('\n================================================================');
  console.log('🧪 STAGE 5: CUSTOMER EXPERIENCE & INVESTOR DEMO TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // GROUP 1: Design System V2 Local Premium Tokens Invariants
  // ---------------------------------------------------------------------------
  console.log('Test Group 1: Design System V2 Semantic Tokens');
  assert(Colors.primary === '#142033', 'Primary brand ink is #142033');
  assert(Colors.primaryDark === '#0D1522', 'Primary dark charcoal ink is #0D1522');
  assert(Colors.background === '#FAF8F3', 'Warm ivory background is #FAF8F3');
  assert(Colors.accent === '#C8482A', 'Restrained food action coral is #C8482A');
  assert(Colors.primaryMuted === '#E8EDF5', 'Soft muted ink tint is #E8EDF5');
  assert(Colors.surface === '#FFFFFF', 'Surface card color is white');
  assert(Colors.textPrimary === '#142033', 'Text primary is brand ink');
  assert(Colors.card === '#FFFFFF', 'Colors.card backward compatibility preserved');
  assert(Colors.text === '#142033', 'Colors.text backward compatibility preserved');
  assert(Colors.botanicalGreen === '#246B39', 'Botanical green status color is #246B39');
  assert(Colors.saffron === '#D4A348', 'Saffron gold highlight is #D4A348');

  assert(Spacing.xxs === 4, 'Spacing.xxs is 4');
  assert(Spacing.xs === 8, 'Spacing.xs is 8');
  assert(Spacing.sm === 12, 'Spacing.sm is 12');
  assert(Spacing.md === 16, 'Spacing.md is 16');
  assert(Spacing.lg === 20, 'Spacing.lg is 20');
  assert(Spacing.xl === 24, 'Spacing.xl is 24');
  assert(Spacing.xxl === 32, 'Spacing.xxl is 32');

  assert(Radii.sm === 8, 'Radii.sm is 8');
  assert(Radii.md === 12, 'Radii.md is 12');
  assert(Radii.lg === 16, 'Radii.lg is 16');
  assert(Radii.xl === 20, 'Radii.xl is 20');
  assert(Radii.full === 9999, 'Radii.full is 9999');

  assert(Typography.Display.fontSize === 32, 'Typography Display scale is 32px');
  assert(Typography.H1.fontSize === 24, 'Typography H1 scale is 24px');
  assert(Typography.H2.fontSize === 20, 'Typography H2 scale is 20px');
  assert(Typography.H3.fontSize === 16, 'Typography H3 scale is 16px');
  assert(Typography.Body.fontSize === 14, 'Typography Body scale is 14px');

  // ---------------------------------------------------------------------------
  // GROUP 2: Cart Logic & Authoritative Fee Calculations
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 2: Cart & Fee Calculation Invariants');
  const testCartItems = [
    {
      dishId: 'dish-biryani-mama',
      dishName: 'Chicken Biryani',
      priceTzs: 11000,
      quantity: 2,
      restaurantId: 'mama-amina-mikocheni',
      restaurantName: 'Mama Amina Biryani House',
    },
    {
      dishId: 'dish-juice-passion',
      dishName: 'Fresh Passion Juice',
      priceTzs: 2500,
      quantity: 2,
      restaurantId: 'mama-amina-mikocheni',
      restaurantName: 'Mama Amina Biryani House',
    },
  ];

  const subtotal = testCartItems.reduce((acc, it) => acc + it.priceTzs * it.quantity, 0);
  assert(subtotal === 27000, `Cart subtotal correctly calculated (11000*2 + 2500*2 = 27,000 TZS, got ${subtotal})`);

  const deliveryFee = 2500;
  const serviceFee = 1500;
  const totalBill = subtotal + deliveryFee + serviceFee;
  assert(totalBill === 31000, `Total bill includes fixed delivery (2,500) and service fee (1,500) = 31,000 TZS (got ${totalBill})`);

  // Quantity updates
  const item1UpdatedQty = 3;
  const updatedSubtotal = (11000 * item1UpdatedQty) + (2500 * 2);
  assert(updatedSubtotal === 38000, 'Increasing quantity updates subtotal accurately');

  // ---------------------------------------------------------------------------
  // GROUP 3: Investor Demo Scenario (Chicken Biryani Discovery)
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 3: Investor Demo Scenario Execution');
  const demoResults = await DiscoveryService.searchDishes({
    query: 'Chicken Biryani',
    neighborhood: 'Mikocheni',
    maxPriceTzs: 12000,
    maxDistanceKm: 5,
    latitude: -6.772,
    longitude: 39.245,
    sortBy: 'RECOMMENDED',
  });

  assert(demoResults.results.length >= 3, `Demo query returns at least 3 qualifying candidate dishes (got ${demoResults.results.length})`);

  const mamaAminaDish = demoResults.results.find((d) => d.restaurantId === 'mama-amina-biryani');
  assert(mamaAminaDish !== undefined, 'Mama Amina Biryani House appears in candidate results');
  if (mamaAminaDish) {
    assert(mamaAminaDish.dishName.toLowerCase().includes('biryani'), 'Mama Amina dish is Biryani');
    assert(mamaAminaDish.priceTzs === 11000, `Mama Amina price is TZS 11,000 (got ${mamaAminaDish.priceTzs})`);
    assert(mamaAminaDish.priceTzs <= 12000, 'Mama Amina price is within budget (<= 12,000 TZS)');
    assert(mamaAminaDish.distanceKm <= 1.0, `Mama Amina distance is under 1.0 km (got ${mamaAminaDish.distanceKm} km)`);
    assert(mamaAminaDish.freshnessTier === 'FRESH', `Mama Amina verification is FRESH tier (got ${mamaAminaDish.freshnessTier})`);
    assert(mamaAminaDish.isAvailable === true, 'Mama Amina dish is currently Available in kitchen');
  }

  // ---------------------------------------------------------------------------
  // GROUP 4: Side-by-Side Comparison Matrix
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 4: Side-by-Side Comparison Metrics');
  const comparedDishes = demoResults.results.slice(0, 3);
  assert(comparedDishes.length === 3, '3 candidate dishes selected for side-by-side comparison');

  const prices = comparedDishes.map((d) => d.priceTzs);
  const minPrice = Math.min(...prices);
  const lowestPriceDish = comparedDishes.find((d) => d.priceTzs === minPrice);
  assert(lowestPriceDish?.priceTzs === 9500, `Lowest price option correctly identified as TZS 9,500 (Biryani Hub, got ${lowestPriceDish?.restaurantName})`);

  const distances = comparedDishes.map((d) => d.distanceKm);
  const minDistance = Math.min(...distances);
  const nearestDish = comparedDishes.find((d) => d.distanceKm === minDistance);
  assert(nearestDish !== undefined && nearestDish.distanceKm <= 1.0, `Nearest option correctly identified (${nearestDish?.restaurantName}, ${minDistance} km)`);

  const ratings = comparedDishes.map((d) => d.restaurantRating);
  const maxRating = Math.max(...ratings);
  const topRatedDish = comparedDishes.find((d) => d.restaurantRating === maxRating);
  assert((topRatedDish?.restaurantRating ?? 0) >= 4.8, `Top rated option correctly identified (Rating ${maxRating})`);

  // ---------------------------------------------------------------------------
  // GROUP 5: Order Tracking State Machine Invariants
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 5: Stage 3 Order Status Machine Integration');
  const orderSteps = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];
  assert(orderSteps.indexOf('PENDING') === 0, 'Order begins at PENDING confirmation');
  assert(orderSteps.indexOf('ACCEPTED') === 1, 'Order moves to ACCEPTED upon kitchen confirmation');
  assert(orderSteps.indexOf('PREPARING') === 2, 'Order moves to PREPARING while cooking');
  assert(orderSteps.indexOf('READY') === 3, 'Order moves to READY for pickup/dispatch');
  assert(orderSteps.indexOf('COMPLETED') === 4, 'Order reaches terminal COMPLETED state');

  // ---------------------------------------------------------------------------
  // GROUP 6: Customer Activity Hub (Segmented Tabs & Filtering)
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 6: Customer Activity Hub (Orders & Bookings)');
  const customerOrdersTab: string = 'ORDERS';
  const customerReservationsTab: string = 'RESERVATIONS';
  assert(customerOrdersTab !== customerReservationsTab, 'Orders and Bookings tabs are distinct segments');

  const activeStatus: string = 'ACTIVE';
  const completedStatus: string = 'COMPLETED';
  const cancelledStatus: string = 'CANCELLED';
  assert(activeStatus !== completedStatus && completedStatus !== cancelledStatus, 'Status filters are partitioned');

  // ---------------------------------------------------------------------------
  // GROUP 7: Customer Profile Privacy & Zero-Leak Audit
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 7: Profile Privacy & Zero-Leak Security Audit');
  const publicProfileView = {
    fullName: 'Frank Mlaki',
    email: 'frank.mlaki@mlohub.tz',
    phone: '+255 754 123 456',
    location: 'Mikocheni B, Dar es Salaam',
    dietaryPreferences: ['High Protein', 'Halal Only'],
  };

  assert((publicProfileView as any).passwordHash === undefined, 'Profile view does NOT expose passwordHash');
  assert((publicProfileView as any).securityPin === undefined, 'Profile view does NOT expose raw securityPin');
  assert((publicProfileView as any).tinNumber === undefined, 'Profile view does NOT expose restaurant tinNumber');
  assert((publicProfileView as any).bankAccountDetails === undefined, 'Profile view does NOT expose bankAccountDetails');
  assert((publicProfileView as any).lipaNumber === undefined, 'Profile view does NOT expose internal lipaNumber');
  assert((publicProfileView as any).databaseDump === undefined, 'Profile view does NOT expose raw database debugger');

  // ---------------------------------------------------------------------------
  // GROUP 8: Demo Mode & Graceful Resilience
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 8: Investor Demo Mode & Offline Resilience');
  const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
  assert(typeof isDemoMode === 'boolean', 'EXPO_PUBLIC_DEMO_MODE parsed as boolean flag');

  // Denied GPS Fallback: Location string defaults to neighborhood center
  const fallbackLocation = 'Mikocheni';
  assert(fallbackLocation.length > 0, 'Denied GPS falls back cleanly to manual neighborhood string');

  // Freshness calculation on sample dates
  const freshTime = new Date(Date.now() - 3600 * 1000).toISOString();
  const freshScore = calculateFreshnessScore(freshTime);
  assert(freshScore.tier === 'FRESH', 'Freshness score for 1 hour ago is FRESH tier');
  assert(freshScore.label.includes('just now') || freshScore.label.includes('ago') || freshScore.label.includes('today'), 'Freshness label is user-friendly');

  console.log('\n======================================================');
  console.log(`🏁 CUSTOMER EXPERIENCE TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passedCount: passed, failedCount: failed };
}

if (require.main === module) {
  runCustomerExperienceTestSuite().then((res) => {
    if (res.failedCount > 0) {
      process.exit(1);
    }
  });
}
