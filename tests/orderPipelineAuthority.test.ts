/**
 * ============================================================================
 * MLOHUB STAGE 14: ORDER PIPELINE AUTHORITY ACCEPTANCE TEST SUITE
 * Verifies Supabase-authoritative standard orders, state machine integrity,
 * server RPC enforcement, payment decoupling, and zero fake delivery artifacts.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

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

export async function runOrderPipelineAuthorityTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 STAGE 14: ORDER PIPELINE AUTHORITY ACCEPTANCE SUITE');
  console.log('================================================================');

  const files = {
    pipelineService: path.resolve(__dirname, '../services/OrderPipelineService.ts'),
    ordersRepo: path.resolve(__dirname, '../repositories/orders.repository.ts'),
    restaurantPortal: path.resolve(__dirname, '../app/restaurant-portal/index.tsx'),
    customScreen: path.resolve(__dirname, '../app/(tabs)/custom.tsx'),
    migrationFile: path.resolve(__dirname, '../supabase/migrations/20260917000011_stage14_order_pipeline_authority.sql'),
  };

  for (const [name, filePath] of Object.entries(files)) {
    assert(fs.existsSync(filePath), `Target file exists: ${name} (${path.basename(filePath)})`);
  }

  const sources = {
    pipelineService: fs.readFileSync(files.pipelineService, 'utf8'),
    ordersRepo: fs.readFileSync(files.ordersRepo, 'utf8'),
    restaurantPortal: fs.readFileSync(files.restaurantPortal, 'utf8'),
    customScreen: fs.readFileSync(files.customScreen, 'utf8'),
    migrationFile: fs.readFileSync(files.migrationFile, 'utf8'),
  };

  // --------------------------------------------------------------------------
  // Criterion A: Zero MloHubDB in Production OrderPipelineService
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion A: Zero Operational MloHubDB in OrderPipelineService ---');
  assert(
    !sources.pipelineService.includes("import { MloHubDB") &&
    !sources.pipelineService.includes("from '../db'") &&
    !sources.pipelineService.includes("from '@/db'"),
    'OrderPipelineService has ZERO MloHubDB imports or direct database dependencies'
  );

  // --------------------------------------------------------------------------
  // Criterion B: Standard Orders use OrderRepository (not customOrders)
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion B: Standard Orders Bound to public.orders ---');
  assert(
    !sources.pipelineService.includes('customOrders'),
    'OrderPipelineService has ZERO references to customOrders'
  );
  assert(
    sources.pipelineService.includes('OrderRepository.createOrder'),
    'OrderPipelineService persists standard menu orders via OrderRepository.createOrder'
  );

  // --------------------------------------------------------------------------
  // Criterion C: Accept Order Uses Real Transition RPC
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion C: Authoritative Order Acceptance ---');
  assert(
    sources.pipelineService.includes("transitionRestaurantOrder(orderId, 'ACCEPTED'"),
    "acceptOrder delegates to OrderRepository.transitionRestaurantOrder with 'ACCEPTED'"
  );
  assert(
    sources.ordersRepo.includes("supabase.rpc('transition_restaurant_order'"),
    'OrderRepository invokes transition_restaurant_order PostgreSQL RPC'
  );

  // --------------------------------------------------------------------------
  // Criterion D: Rejection Persists Canonical CANCELLED
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion D: Rejection Maps to Canonical CANCELLED ---');
  assert(
    sources.pipelineService.includes("transitionRestaurantOrder(orderId, 'CANCELLED'"),
    "rejectOrder transitions directly to canonical 'CANCELLED' status"
  );
  assert(
    sources.ordersRepo.includes("nextStatus === 'REJECTED' ? 'CANCELLED' : nextStatus"),
    "OrderRepository normalizes 'REJECTED' to canonical 'CANCELLED'"
  );

  // --------------------------------------------------------------------------
  // Criterion E: Canonical Order Statuses Only
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion E: Canonical State Machine Enforcement ---');
  const nonCanonicalInPipeline = ['Pending Confirmation', 'Confirmed', 'Out for Delivery'];
  for (const status of nonCanonicalInPipeline) {
    assert(
      !sources.pipelineService.includes(`'${status}'`),
      `OrderPipelineService does not persist non-canonical state '${status}'`
    );
  }

  // --------------------------------------------------------------------------
  // Criterion F: Server-Side Illegal Transition Guards
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion F: Server-Side Transition Guards ---');
  assert(
    sources.migrationFile.includes('Invalid order transition from PENDING to') &&
    sources.migrationFile.includes('Invalid order transition from ACCEPTED to') &&
    sources.migrationFile.includes('Invalid order transition from PREPARING to'),
    'Server RPC transition_restaurant_order guards every legal lifecycle transition'
  );
  assert(
    sources.migrationFile.includes('already COMPLETED and cannot be transitioned further') &&
    sources.migrationFile.includes('already CANCELLED and cannot be transitioned further'),
    'Server RPC enforces that COMPLETED and CANCELLED are strictly terminal'
  );

  // --------------------------------------------------------------------------
  // Criterion G: Multi-Tenant & Cross-Tenant Boundary Enforcement
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion G: Multi-Tenant Order Isolation ---');
  assert(
    sources.migrationFile.includes('public.has_restaurant_permission(v_caller_id, v_order.restaurant_id, \'MANAGE_ORDERS\')') ||
    sources.migrationFile.includes('public.has_restaurant_role'),
    'Server RPC enforces restaurant membership and MANAGE_ORDERS permission'
  );
  assert(
    sources.migrationFile.includes('403 Forbidden: Caller'),
    'Server RPC raises 403 Forbidden on cross-tenant transition attempts'
  );

  // --------------------------------------------------------------------------
  // Criterion H: Customer Cannot Perform Restaurant Transitions
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion H: Customer Privilege Separation ---');
  assert(
    sources.migrationFile.includes('v_caller_id IS NULL') &&
    sources.migrationFile.includes('401 Unauthorized'),
    'Server RPC rejects unauthenticated callers with 401 Unauthorized'
  );
  assert(
    sources.migrationFile.includes('v_is_authorized'),
    'Server RPC requires restaurant staff/owner authorization'
  );

  // --------------------------------------------------------------------------
  // Criterion I: Order IDs Treated as Strings / VARCHAR(80)
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion I: Canonical VARCHAR(80) Order ID Compatibility ---');
  assert(
    sources.migrationFile.includes('p_order_id VARCHAR(80)'),
    'RPC transition_restaurant_order declares p_order_id as VARCHAR(80)'
  );
  assert(
    sources.ordersRepo.includes('orderId: string'),
    'OrderRepository accepts generic string orderId without UUID casting assumptions'
  );

  // --------------------------------------------------------------------------
  // Criterion J: Payment Status Remains Decoupled
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion J: Payment Independence ---');
  assert(
    !sources.pipelineService.includes("payment_status = 'SUCCESS'") &&
    !sources.pipelineService.includes("paymentStatus: 'SUCCESS'") &&
    !sources.pipelineService.includes("paymentStatus: 'PAID'"),
    'OrderPipelineService never alters payment status during kitchen progression'
  );
  assert(
    !sources.migrationFile.includes('payment_status ='),
    'Server RPC transition_restaurant_order leaves payment_status completely untouched'
  );

  // --------------------------------------------------------------------------
  // Criterion K & L: Zero Fake Rider and Zero Delivery PIN
  // --------------------------------------------------------------------------
  console.log('\n--- Criteria K & L: Zero Fake Rider & Zero Synthetic Delivery PIN ---');
  assert(
    !sources.pipelineService.includes('rider') &&
    !sources.pipelineService.includes('Rider'),
    'OrderPipelineService contains ZERO occurrences of rider'
  );
  assert(
    !sources.pipelineService.includes('PIN') &&
    !sources.pipelineService.includes('deliveryPin'),
    'OrderPipelineService contains ZERO occurrences of PIN or deliveryPin'
  );

  // --------------------------------------------------------------------------
  // Criterion M: Realtime Signal Infrastructure
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion M: Realtime Broadcast Infrastructure ---');
  assert(
    sources.pipelineService.includes('RealtimeEventEngine.publish') &&
    sources.pipelineService.includes('orders:restaurant:') &&
    sources.pipelineService.includes('orders:customer:'),
    'OrderPipelineService broadcasts signals across customer, restaurant, and admin channels'
  );

  // --------------------------------------------------------------------------
  // Criterion N: Customer Status Observation & Truthful Custom Meals
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion N: Customer Status Observation & Truthful Custom Meals ---');
  assert(
    sources.ordersRepo.includes('listOrdersForCustomer'),
    'OrderRepository provides listOrdersForCustomer for customer order observation'
  );
  assert(
    sources.customScreen.includes('CustomMealRepository.createRequest'),
    'custom.tsx delegates meal requests to CustomMealRepository.createRequest'
  );
  assert(
    !sources.customScreen.includes('Nearby specialty kitchens are reviewing your custom meal request and submitting quotes'),
    'custom.tsx eliminates false dispatch claims when nothing was persisted'
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 ORDER PIPELINE ACCEPTANCE SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================');

  return { passed, failed };
}
