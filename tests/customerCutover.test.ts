/**
 * ============================================================================
 * MLOHUB REPAIR PACK 3D ACCEPTANCE TEST SUITE
 * Customer Runtime Cutover & Real Data Verification
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { OrderService } from '../services/OrderService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

export async function runCustomerCutoverTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 PACK 3D: CUSTOMER RUNTIME CUTOVER ACCEPTANCE SUITE');
  console.log('================================================================');

  const files = {
    index: path.resolve(__dirname, '../app/(tabs)/index.tsx'),
    explore: path.resolve(__dirname, '../app/(tabs)/explore.tsx'),
    bookings: path.resolve(__dirname, '../app/(tabs)/bookings.tsx'),
    orders: path.resolve(__dirname, '../app/(tabs)/orders.tsx'),
    custom: path.resolve(__dirname, '../app/(tabs)/custom.tsx'),
    profile: path.resolve(__dirname, '../app/(tabs)/profile.tsx'),
    restaurantDetail: path.resolve(__dirname, '../app/restaurant/[id].tsx'),
    reservationModal: path.resolve(__dirname, '../components/ReservationModal.tsx'),
    paymentCheckoutModal: path.resolve(__dirname, '../components/PaymentCheckoutModal.tsx'),
    orderReviewModal: path.resolve(__dirname, '../components/checkout/OrderReviewModal.tsx'),
  };

  // Verify all files exist
  for (const [name, filePath] of Object.entries(files)) {
    assert(fs.existsSync(filePath), `Target file exists: ${name} (${path.basename(filePath)})`);
  }

  const sources = {
    index: fs.readFileSync(files.index, 'utf8'),
    explore: fs.readFileSync(files.explore, 'utf8'),
    bookings: fs.readFileSync(files.bookings, 'utf8'),
    orders: fs.readFileSync(files.orders, 'utf8'),
    custom: fs.readFileSync(files.custom, 'utf8'),
    profile: fs.readFileSync(files.profile, 'utf8'),
    restaurantDetail: fs.readFileSync(files.restaurantDetail, 'utf8'),
    reservationModal: fs.readFileSync(files.reservationModal, 'utf8'),
    paymentCheckoutModal: fs.readFileSync(files.paymentCheckoutModal, 'utf8'),
    orderReviewModal: fs.readFileSync(files.orderReviewModal, 'utf8'),
  };

  // ==========================================================================
  // Criterion A: app/(tabs)/index.tsx
  // ==========================================================================
  console.log('\n  --- Criterion A: HomeScreen Production Cutover ---');
  assert(
    !sources.index.includes("import { RESTAURANTS") && !sources.index.includes("from '../../constants/data'"),
    'Criterion A1: index.tsx does not import RESTAURANTS from constants/data'
  );
  assert(
    !sources.index.includes(': RESTAURANTS'),
    'Criterion A2: index.tsx does not fallback to RESTAURANTS constant'
  );
  assert(
    sources.index.includes('EmptyState') && sources.index.includes('dbRestaurants.slice(0, 3)'),
    'Criterion A3: index.tsx renders real dbRestaurants and honest EmptyState'
  );

  // ==========================================================================
  // Criterion B: app/(tabs)/explore.tsx
  // ==========================================================================
  console.log('\n  --- Criterion B: ExploreScreen Production Cutover ---');
  assert(
    !sources.explore.includes("import { RESTAURANTS") && !sources.explore.includes("from '../../constants/data'"),
    'Criterion B1: explore.tsx does not import RESTAURANTS from constants/data'
  );
  assert(
    sources.explore.includes('restaurants={restaurants as any}'),
    'Criterion B2: explore.tsx passes real restaurants from DbContext to GoogleMapView'
  );

  // ==========================================================================
  // Criterion C: app/(tabs)/bookings.tsx
  // ==========================================================================
  console.log('\n  --- Criterion C: BookingsScreen Production Cutover ---');
  assert(
    !sources.bookings.includes('sampleOrders =') && !sources.bookings.includes('sampleReservations ='),
    'Criterion C1: bookings.tsx contains zero sampleOrders or sampleReservations'
  );
  assert(
    !sources.bookings.includes('RESTAURANTS.slice'),
    'Criterion C2: bookings.tsx does not use RESTAURANTS.slice'
  );
  assert(
    sources.bookings.includes('filteredReservations'),
    'Criterion C3: bookings.tsx filters real reservations with status segmentation'
  );
  assert(
    sources.bookings.includes('cancelReservation'),
    'Criterion C4: bookings.tsx calls cancelReservation from DbContext'
  );

  // ==========================================================================
  // Criterion D: app/(tabs)/custom.tsx
  // ==========================================================================
  console.log('\n  --- Criterion D: CustomMealScreen Production Cutover ---');
  assert(
    sources.custom.includes("import { useAuth } from '../../context/AuthContext'"),
    'Criterion D1: custom.tsx uses useAuth() for user identity'
  );
  assert(
    !sources.custom.includes("useState('Zanzibar Spiced Beef Pilau") && !sources.custom.includes("useState('Mikocheni, Dar es Salaam')"),
    'Criterion D2: custom.tsx does not default to hardcoded meal or location'
  );
  assert(
    sources.custom.includes('placeholder="e.g. Mikocheni B, Mtaa wa Chuo"'),
    'Criterion D3: custom.tsx uses updated neutral placeholder'
  );
  assert(
    sources.custom.includes('!location.trim()'),
    'Criterion D4: custom.tsx validates location requirement'
  );

  // ==========================================================================
  // Criterion E: app/(tabs)/profile.tsx
  // ==========================================================================
  console.log('\n  --- Criterion E: ProfileScreen Production Cutover ---');
  assert(
    !sources.profile.includes("'Frank Mlaki'") &&
    !sources.profile.includes("'frank.mlaki@mlohub.tz'") &&
    !sources.profile.includes("'+255 754 123 456'") &&
    !sources.profile.includes("'Mikocheni B, Dar es Salaam'"),
    'Criterion E1: profile.tsx contains no hardcoded Frank Mlaki demo values'
  );
  assert(
    sources.profile.includes('useEffect(() => {\n    if (user) {'),
    'Criterion E2: profile.tsx syncs state authentically from active authenticated user'
  );

  // ==========================================================================
  // Criterion F: app/restaurant/[id].tsx
  // ==========================================================================
  console.log('\n  --- Criterion F: RestaurantDetailScreen Production Cutover ---');
  assert(
    !sources.restaurantDetail.includes("import { RESTAURANTS") && !sources.restaurantDetail.includes("from '../../constants/data'"),
    'Criterion F1: restaurant/[id].tsx does not import RESTAURANTS from constants/data'
  );
  assert(
    !sources.restaurantDetail.includes('RESTAURANTS[0]'),
    'Criterion F2: restaurant/[id].tsx never silently falls back to RESTAURANTS[0]'
  );
  assert(
    sources.restaurantDetail.includes('Mkahawa Haujapatikana') || sources.restaurantDetail.includes('Restaurant Not Found'),
    'Criterion F3: restaurant/[id].tsx renders honest Restaurant Not Found state'
  );

  // ==========================================================================
  // Criterion G: components/ReservationModal.tsx
  // ==========================================================================
  console.log('\n  --- Criterion G: ReservationModal Production Cutover ---');
  assert(
    !sources.reservationModal.includes("'usr-frank'"),
    'Criterion G1: ReservationModal.tsx does not fall back to usr-frank'
  );
  assert(
    sources.reservationModal.includes('if (!user?.id)'),
    'Criterion G2: ReservationModal.tsx requires authenticated user before reserving'
  );

  // ==========================================================================
  // Criterion H: components/PaymentCheckoutModal.tsx
  // ==========================================================================
  console.log('\n  --- Criterion H: PaymentCheckoutModal Production Cutover ---');
  assert(
    !sources.paymentCheckoutModal.includes("'+255 754 123 456'"),
    'Criterion H1: PaymentCheckoutModal.tsx does not default payerPhone to demo number'
  );
  assert(
    sources.paymentCheckoutModal.includes('placeholder="7XXXXXXXX"'),
    'Criterion H2: PaymentCheckoutModal.tsx uses neutral placeholder'
  );
  assert(
    sources.paymentCheckoutModal.includes('!payerPhone.trim()'),
    'Criterion H3: PaymentCheckoutModal.tsx validates payer phone prior to initiation'
  );

  // ==========================================================================
  // Criterion I: components/checkout/OrderReviewModal.tsx
  // ==========================================================================
  console.log('\n  --- Criterion I: OrderReviewModal Production Cutover ---');
  assert(
    !sources.orderReviewModal.includes('createCustomOrder'),
    'Criterion I1: OrderReviewModal.tsx does not use createCustomOrder for cart orders'
  );
  assert(
    sources.orderReviewModal.includes('OrderService.submitStandardMenuOrder'),
    'Criterion I2: OrderReviewModal.tsx submits standard menu orders via OrderService'
  );
  assert(
    sources.orderReviewModal.includes('if (!user?.id)'),
    'Criterion I3: OrderReviewModal.tsx requires authenticated user before order placement'
  );

  // ==========================================================================
  // Criterion J: Forbidden Terms Global Negative Audit
  // ==========================================================================
  console.log('\n  --- Criterion J: Global Forbidden Patterns Negative Audit ---');
  const forbiddenPatterns = [
    { pattern: 'usr-frank', name: 'Mock user ID usr-frank' },
    { pattern: 'Frank Mlaki', name: 'Mock user name Frank Mlaki' },
    { pattern: 'frank.mlaki@mlohub.tz', name: 'Mock email frank.mlaki@mlohub.tz' },
    { pattern: '+255 754 123 456', name: 'Mock phone +255 754 123 456' },
    { pattern: '754 123 456', name: 'Mock phone digits 754 123 456' },
    { pattern: 'Mikocheni B, Dar es Salaam', name: 'Mock address Mikocheni B, Dar es Salaam' },
    { pattern: 'RESTAURANTS[0]', name: 'Static array index RESTAURANTS[0]' },
  ];

  for (const [fileName, src] of Object.entries(sources)) {
    for (const { pattern, name } of forbiddenPatterns) {
      const found = src.includes(pattern);
      assert(!found, `Forbidden check: ${fileName} does not contain ${name}`);
    }
  }

  // ==========================================================================
  // Criterion K: OrderService Functionality Validation
  // ==========================================================================
  console.log('\n  --- Criterion K: OrderService Execution Validation ---');
  const quote = OrderService.quoteOrder({
    items: [
      { unitPriceTzs: 12000, quantity: 2 },
      { unitPriceTzs: 3500, quantity: 1 },
    ],
    diningOption: 'Delivery',
  });
  assert(quote.subtotalTzs === 27500, 'OrderService quote calculates accurate subtotal (27500 TZS)');
  assert(quote.deliveryFeeTzs === 2500, 'OrderService quote calculates delivery fee (2500 TZS)');
  assert(quote.serviceFeeTzs === 1500, 'OrderService quote calculates service fee (1500 TZS)');
  assert(quote.totalTzs === 31500, 'OrderService quote calculates total fee (31500 TZS)');

  // ==========================================================================
  // Criterion L: Pack 3D.1 Standard Order Visibility Acceptance Tests
  // ==========================================================================
  console.log('\n  --- Criterion L: Pack 3D.1 Standard Order Visibility ---');
  const auxFiles = {
    domainTypes: path.resolve(__dirname, '../types/domain.ts'),
    ordersRepo: path.resolve(__dirname, '../repositories/orders.repository.ts'),
    dbContext: path.resolve(__dirname, '../context/DbContext.tsx'),
  };
  const auxSources = {
    domainTypes: fs.readFileSync(auxFiles.domainTypes, 'utf8'),
    ordersRepo: fs.readFileSync(auxFiles.ordersRepo, 'utf8'),
    dbContext: fs.readFileSync(auxFiles.dbContext, 'utf8'),
  };

  assert(
    auxSources.domainTypes.includes('restaurantName?: string;'),
    'Criterion L1: types/domain.ts defines restaurantName on Order interface'
  );

  assert(
    auxSources.ordersRepo.includes('listByCustomer') &&
    auxSources.ordersRepo.includes("select('*, order_items(*), restaurants(name)')"),
    'Criterion L2: OrderRepository provides listByCustomer and joins restaurants(name)'
  );

  assert(
    auxSources.dbContext.includes("import { OrderRepository } from '../repositories/orders.repository'") &&
    auxSources.dbContext.includes('orders: Order[];'),
    'Criterion L3: DbContext exports orders: Order[] backed by OrderRepository'
  );

  assert(
    auxSources.dbContext.includes('OrderRepository.listByCustomer(authUser.id)'),
    'Criterion L4: DbContext queries standard orders using authenticated user ID'
  );

  assert(
    sources.orders.includes('OrderRepository') &&
    sources.bookings.includes('useMloHubDB()'),
    'Criterion L5: Dedicated orders.tsx consumes OrderRepository and bookings.tsx consumes useMloHubDB()'
  );

  assert(
    sources.orders.includes('SegmentedControl') &&
    sources.bookings.includes('filteredReservations'),
    'Criterion L6: orders.tsx segments active/past orders and bookings.tsx segments reservation statuses'
  );

  assert(
    sources.orders.includes('estimatedPrepMinutes'),
    'Criterion L7: orders.tsx embeds preparation minutes and kitchen progression'
  );

  assert(
    sources.orderReviewModal.includes('setConfirmedOrderId(order.id)') &&
    sources.orderReviewModal.includes('setConfirmedOrderNumber(order.orderNumber || order.id)'),
    'Criterion L8: OrderReviewModal preserves canonical order.id for confirmedOrderId'
  );

  console.log('======================================================');
  console.log(`🏁 PACK 3D & 3D.1 SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}
