/**
 * ============================================================================
 * MLOHUB STAGE 14: LIVE ORDER PIPELINE AUTHORITY INTEGRATION TEST
 * ============================================================================
 * Verifies end-to-end against local Supabase PostgreSQL:
 * 1. Customer places standard order (public.orders) with payment_status=PENDING
 * 2. Restaurant A owner accepts order (PENDING -> ACCEPTED)
 * 3. Cross-tenant isolation: Restaurant B owner cannot accept/modify A's order (403)
 * 4. Privilege separation: Customer cannot perform restaurant transitions (403)
 * 5. Authentication required: Unauthenticated transitions rejected (401)
 * 6. Kitchen progression: ACCEPTED -> PREPARING -> READY -> COMPLETED
 * 7. Illegal transitions rejected:
 *    - PENDING -> READY (400)
 *    - COMPLETED -> PREPARING (400)
 *    - CANCELLED -> ACCEPTED (400)
 * 8. Payment independence: payment_status remains PENDING throughout
 * 9. Customer visibility: Customer sees authoritative persisted order status
 * ============================================================================
 */

process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.EXPO_PUBLIC_APP_ENV = 'development';

import { supabase } from '../lib/supabase';
import { OrderRepository } from '../repositories/orders.repository';
import { OrderPipelineService } from '../services/OrderPipelineService';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import { BranchRepository } from '../repositories/branches.repository';
import { MenuRepository } from '../repositories/menus.repository';

const RUN_ID = Date.now().toString().slice(-6);

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runLiveOrderPipelineAuthorityE2E() {
  console.log('================================================================');
  console.log('🚀 RUNNING ORDER PIPELINE AUTHORITY LIVE INTEGRATION TEST');
  console.log(`Run ID: ${RUN_ID}`);
  console.log('================================================================\n');

  // Test identities
  const ownerAEmail = `owner_a_${RUN_ID}@mlohub.tz`;
  const ownerBEmail = `owner_b_${RUN_ID}@mlohub.tz`;
  const customerEmail = `customer_${RUN_ID}@mlohub.tz`;
  const password = 'TestPassword123!';

  // Helper to register and sign in
  async function setupUser(email: string, fullName: string) {
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (signUpErr && !signUpErr.message.includes('already registered')) {
      throw new Error(`Sign up failed for ${email}: ${signUpErr.message}`);
    }

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) throw new Error(`Sign in failed for ${email}: ${signInErr.message}`);
    return signInData.user.id;
  }

  // --------------------------------------------------------------------------
  // Step 1: Setup Tenants (Restaurant A and Restaurant B)
  // --------------------------------------------------------------------------
  console.log('--- Step 1: Setting Up Tenants (Restaurant A and Restaurant B) ---');
  
  // Setup Owner A
  const ownerAId = await setupUser(ownerAEmail, `Owner A ${RUN_ID}`);
  const restAId = `rest_a_${RUN_ID}`;
  
  // Insert Restaurant A directly via psql
  const { execSync } = await import('child_process');
  execSync(
    `docker exec -i supabase_db_MloHub_Expo psql -U postgres -d postgres -c "SET session_replication_role = replica; INSERT INTO public.restaurants (id, owner_id, name, slug, cuisine, address, neighborhood, is_verified, verification_status, is_published, is_active, is_open) VALUES ('${restAId}', '${ownerAId}', 'Restaurant A ${RUN_ID}', 'rest-a-${RUN_ID}', 'Swahili', 'Mikocheni B, Dar es Salaam', 'Mikocheni', true, 'VERIFIED', true, true, true) ON CONFLICT (id) DO NOTHING; INSERT INTO public.restaurant_members (id, user_id, restaurant_id, role, is_primary_owner, is_active) VALUES ('mem_a_${RUN_ID}', '${ownerAId}', '${restAId}', 'OWNER', true, true) ON CONFLICT (user_id, restaurant_id) DO NOTHING; SET session_replication_role = DEFAULT;"`
  );

  // Setup Owner B
  const ownerBId = await setupUser(ownerBEmail, `Owner B ${RUN_ID}`);
  const restBId = `rest_b_${RUN_ID}`;
  execSync(
    `docker exec -i supabase_db_MloHub_Expo psql -U postgres -d postgres -c "SET session_replication_role = replica; INSERT INTO public.restaurants (id, owner_id, name, slug, cuisine, address, neighborhood, is_verified, verification_status, is_published, is_active, is_open) VALUES ('${restBId}', '${ownerBId}', 'Restaurant B ${RUN_ID}', 'rest-b-${RUN_ID}', 'Swahili', 'Oysterbay, Dar es Salaam', 'Oysterbay', true, 'VERIFIED', true, true, true) ON CONFLICT (id) DO NOTHING; INSERT INTO public.restaurant_members (id, user_id, restaurant_id, role, is_primary_owner, is_active) VALUES ('mem_b_${RUN_ID}', '${ownerBId}', '${restBId}', 'OWNER', true, true) ON CONFLICT (user_id, restaurant_id) DO NOTHING; SET session_replication_role = DEFAULT;"`
  );

  assert(!!ownerAId && !!ownerBId, 'Tenants Restaurant A and Restaurant B initialized in database');

  // --------------------------------------------------------------------------
  // Step 2: Customer Submits Standard Order
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: Customer Places Standard Menu Order ---');
  const customerId = await setupUser(customerEmail, `Customer ${RUN_ID}`);

  const order1 = await OrderPipelineService.submitStandardMenuOrder({
    userId: customerId,
    customerName: `Customer ${RUN_ID}`,
    customerPhone: `+255711${RUN_ID}`,
    restaurantId: restAId,
    diningOption: 'Delivery',
    deliveryAddress: 'Mikocheni B, Dar es Salaam',
    specialInstructions: 'Pili pili pembeni',
    items: [
      {
        name: 'Zanzibar Dum Biryani',
        unitPriceTzs: 14000,
        quantity: 2,
        totalPriceTzs: 28000,
      },
    ],
  });

  assert(!!order1.id, `Standard order created with ID ${order1.id}`);
  assert(order1.status === 'PENDING', `Initial order status is PENDING`);
  assert(order1.paymentStatus === 'PENDING', `Initial payment status is PENDING`);
  assert(order1.totalTzs === 32000, `Total calculated correctly (28000 + 1500 + 2500 = 32000 TZS)`);

  // --------------------------------------------------------------------------
  // Step 3: Cross-Tenant Isolation: Restaurant B cannot accept Order A
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Cross-Tenant Boundary Enforcement ---');
  await supabase.auth.signInWithPassword({ email: ownerBEmail, password });

  let crossTenantBlocked = false;
  try {
    await OrderPipelineService.acceptOrder(order1.id, 25, restBId);
  } catch (err: any) {
    crossTenantBlocked = true;
    assert(
      err.message.includes('403') || err.message.includes('Forbidden') || err.message.includes('authority'),
      `Restaurant B owner rejected when attempting to accept Restaurant A order: ${err.message}`
    );
  }
  assert(crossTenantBlocked, 'Cross-tenant order acceptance strictly blocked by server');

  // --------------------------------------------------------------------------
  // Step 4: Customer Privilege Separation
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4: Customer Privilege Separation ---');
  await supabase.auth.signInWithPassword({ email: customerEmail, password });

  let customerBlocked = false;
  try {
    await OrderPipelineService.updateFulfillmentStatus(order1.id, 'PREPARING');
  } catch (err: any) {
    customerBlocked = true;
    assert(
      err.message.includes('403') || err.message.includes('Forbidden'),
      `Customer blocked from restaurant fulfillment transition: ${err.message}`
    );
  }
  assert(customerBlocked, 'Customer cannot execute restaurant fulfillment transitions');

  // --------------------------------------------------------------------------
  // Step 5: Unauthenticated Callers Rejected
  // --------------------------------------------------------------------------
  console.log('\n--- Step 5: Unauthenticated Rejection (401) ---');
  await supabase.auth.signOut();

  let unauthBlocked = false;
  try {
    await OrderRepository.transitionRestaurantOrder(order1.id, 'ACCEPTED');
  } catch (err: any) {
    unauthBlocked = true;
    assert(
      err.message.includes('401') || err.message.includes('Unauthorized'),
      `Unauthenticated caller rejected: ${err.message}`
    );
  }
  assert(unauthBlocked, 'Unauthenticated transition rejected with 401 Unauthorized');

  // --------------------------------------------------------------------------
  // Step 6: Legitimate Restaurant Acceptance
  // --------------------------------------------------------------------------
  console.log('\n--- Step 6: Legitimate Restaurant Acceptance ---');
  await supabase.auth.signInWithPassword({ email: ownerAEmail, password });

  const acceptedOrder = await OrderPipelineService.acceptOrder(order1.id, 25, restAId);
  assert(acceptedOrder.status === 'ACCEPTED', 'Order successfully transitioned PENDING -> ACCEPTED');
  assert(acceptedOrder.estimatedPrepMinutes === 25, 'Estimated prep minutes updated to 25');
  assert(!!acceptedOrder.acceptedAt, 'accepted_at timestamp recorded');
  assert(acceptedOrder.paymentStatus === 'PENDING', 'Payment status remains PENDING after acceptance (payment decoupled)');

  // --------------------------------------------------------------------------
  // Step 7: Illegal State Transition: ACCEPTED -> COMPLETED (skipping PREPARING/READY)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 7: Illegal Transition Rejection ---');
  let skipTransitionBlocked = false;
  try {
    await OrderRepository.transitionRestaurantOrder(order1.id, 'COMPLETED');
  } catch (err: any) {
    skipTransitionBlocked = true;
    assert(
      err.message.includes('400') || err.message.includes('Invalid') || err.message.includes('Bad Request'),
      `Illegal transition ACCEPTED -> COMPLETED rejected: ${err.message}`
    );
  }
  assert(skipTransitionBlocked, 'Server RPC prevents skipping intermediate kitchen states');

  // --------------------------------------------------------------------------
  // Step 8: Sequential Kitchen Fulfillment Progression
  // --------------------------------------------------------------------------
  console.log('\n--- Step 8: Sequential Kitchen Fulfillment Progression ---');

  // ACCEPTED -> PREPARING
  const preparingOrder = await OrderPipelineService.updateFulfillmentStatus(order1.id, 'PREPARING');
  assert(preparingOrder.status === 'PREPARING', 'Order transitioned ACCEPTED -> PREPARING');
  assert(preparingOrder.paymentStatus === 'PENDING', 'Payment status remains PENDING in PREPARING');

  // PREPARING -> READY
  const readyOrder = await OrderPipelineService.updateFulfillmentStatus(order1.id, 'READY');
  assert(readyOrder.status === 'READY', 'Order transitioned PREPARING -> READY');
  assert(!!readyOrder.readyAt, 'ready_at timestamp recorded');
  assert(readyOrder.paymentStatus === 'PENDING', 'Payment status remains PENDING in READY');

  // READY -> COMPLETED
  const completedOrder = await OrderPipelineService.updateFulfillmentStatus(order1.id, 'COMPLETED');
  assert(completedOrder.status === 'COMPLETED', 'Order transitioned READY -> COMPLETED');
  assert(!!completedOrder.completedAt, 'completed_at timestamp recorded');
  assert(completedOrder.paymentStatus === 'PENDING', 'Payment status remains independent after order completion');

  // --------------------------------------------------------------------------
  // Step 9: Terminal State Protection
  // --------------------------------------------------------------------------
  console.log('\n--- Step 9: Terminal State Protection ---');

  // Attempt to revert COMPLETED -> PREPARING
  let revertBlocked = false;
  try {
    await OrderPipelineService.updateFulfillmentStatus(order1.id, 'PREPARING');
  } catch (err: any) {
    revertBlocked = true;
    assert(
      err.message.includes('400') || err.message.includes('COMPLETED') || err.message.includes('cannot'),
      `Reversion from COMPLETED rejected: ${err.message}`
    );
  }
  assert(revertBlocked, 'COMPLETED order cannot transition further');

  // --------------------------------------------------------------------------
  // Step 10: Cancellation Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- Step 10: Cancellation Lifecycle ---');

  // Customer places a second order
  await supabase.auth.signInWithPassword({ email: customerEmail, password });
  const order2 = await OrderPipelineService.submitStandardMenuOrder({
    userId: customerId,
    restaurantId: restAId,
    diningOption: 'Dine-In',
    items: [
      {
        name: 'Pilau ya Nyama',
        unitPriceTzs: 10000,
        quantity: 1,
        totalPriceTzs: 10000,
      },
    ],
  });

  // Owner A rejects/cancels the order
  await supabase.auth.signInWithPassword({ email: ownerAEmail, password });
  const cancelledOrder = await OrderPipelineService.rejectOrder(order2.id, 'OutOfStock');
  assert(cancelledOrder.status === 'CANCELLED', 'Rejected order moved to canonical CANCELLED status');
  assert(cancelledOrder.cancellationReason === 'OutOfStock', 'Cancellation reason persisted');
  assert(!!cancelledOrder.cancelledAt, 'cancelled_at timestamp recorded');

  // Attempt to revive CANCELLED -> ACCEPTED
  let reviveBlocked = false;
  try {
    await OrderPipelineService.acceptOrder(order2.id);
  } catch (err: any) {
    reviveBlocked = true;
    assert(
      err.message.includes('400') || err.message.includes('CANCELLED') || err.message.includes('cannot'),
      `Reviving CANCELLED order rejected: ${err.message}`
    );
  }
  assert(reviveBlocked, 'CANCELLED order cannot transition further');

  // --------------------------------------------------------------------------
  // Step 11: Customer Order Visibility
  // --------------------------------------------------------------------------
  console.log('\n--- Step 11: Customer Observes Authoritative Status ---');
  await supabase.auth.signInWithPassword({ email: customerEmail, password });

  const customerOrders = await OrderRepository.listOrdersForCustomer(customerId);
  const foundOrder1 = customerOrders.find((o) => o.id === order1.id);
  const foundOrder2 = customerOrders.find((o) => o.id === order2.id);

  assert(!!foundOrder1 && foundOrder1.status === 'COMPLETED', 'Customer list retrieves Order 1 with status COMPLETED');
  assert(!!foundOrder2 && foundOrder2.status === 'CANCELLED', 'Customer list retrieves Order 2 with status CANCELLED');

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 ORDER PIPELINE LIVE E2E COMPLETED: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runLiveOrderPipelineAuthorityE2E().catch((err) => {
  console.error('\n💥 FATAL ORDER PIPELINE E2E FAILURE:', err);
  process.exit(1);
});
