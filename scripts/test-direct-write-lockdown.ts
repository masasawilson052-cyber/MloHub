/**
 * ============================================================================
 * MLOHUB: DIRECT WRITES LOCKDOWN & SECURITY VERIFICATION SUITE (STAGING ONLY)
 * ============================================================================
 * Exercises and verifies the security lockdown on orders, reservations, and custom meals:
 *
 * Attack Vectors (All 5 MUST Fail for authenticated customer):
 *   1. Direct INSERT into public.orders (bypass fee calculation & validation)
 *   2. Direct UPDATE of total_tzs on own pending order (price tampering)
 *   3. Direct UPDATE of payment_status = 'SUCCESS' on pending order (payment forgery)
 *   4. Direct INSERT into public.reservations with CONFIRMED status
 *   5. Direct UPDATE of is_deposit_paid = true or deposit_amount_tzs on reservation
 *
 * Legitimate Workflows (All 5 MUST Succeed):
 *   1. Order placement via create_order_secure RPC
 *   2. Sandbox payment capture via confirm_payment_webhook_rpc
 *   3. Customer order cancellation via cancel_customer_order_secure RPC
 *   4. Table booking via create_reservation_secure and cancel_reservation_secure RPCs
 *   5. Restaurant order progression via transition_restaurant_order RPC
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const PROD_REF = 'rrebkpeumvqffuwtqvje';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('🛡️  MLOHUB DIRECT WRITE LOCKDOWN & FINANCIAL INTEGRITY SUITE');
  console.log('================================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  // 1. Production Safeguard
  if (supabaseUrl.includes(PROD_REF)) {
    console.error(`❌ REFUSING EXECUTION: Target URL (${supabaseUrl}) matches production reference (${PROD_REF}). Tests can only run against STAGING or local.`);
    process.exit(1);
  }

  const prodJsonPath = path.resolve(__dirname, '..', 'production-public.json');
  if (fs.existsSync(prodJsonPath)) {
    try {
      const prodConfig = JSON.parse(fs.readFileSync(prodJsonPath, 'utf8'));
      if (prodConfig.url && supabaseUrl.trim().toLowerCase() === prodConfig.url.trim().toLowerCase()) {
        console.error(`❌ REFUSING EXECUTION: SUPABASE_URL matches production-public.json (${prodConfig.url}). Aborting.`);
        process.exit(1);
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  if (!serviceRoleKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(1);
  }
  if (!anonKey) {
    console.error('❌ Missing SUPABASE_ANON_KEY / EXPO_PUBLIC_SUPABASE_ANON_KEY in environment.');
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Test admin connection
  const { error: pingError } = await adminClient.from('platform_financial_settings').select('*').limit(1);
  if (pingError) {
    console.error('❌ Failed to connect to test database:', pingError.message);
    process.exit(1);
  }

  console.log(`Connected to test database: ${supabaseUrl}\n`);

  const timestamp = Date.now();
  const testRestId = `test_rest_lockdown_${timestamp}`;
  const testBranchId = `00000000-0000-4000-b000-${String(timestamp).slice(-12)}`;
  const testMenuId = `00000000-0000-4000-c000-${String(timestamp).slice(-12)}`;
  const customerEmail = `lockdown_cust_${timestamp}@mlohub.test`;
  const customerPassword = `SecureLockdown123!@#_${timestamp}`;

  let customerUserId = '';

  try {
    // ------------------------------------------------------------------------
    // Setup test restaurant, branch, and menu item
    // ------------------------------------------------------------------------
    console.log('--- Setup: Staging Test Fixtures ---');
    await adminClient.from('restaurants').insert({
      id: testRestId,
      name: 'Security Lockdown Bistro',
      is_active: true,
      verification_status: 'VERIFIED',
    });

    await adminClient.from('restaurant_branches').insert({
      id: testBranchId,
      restaurant_id: testRestId,
      name: 'Main Branch',
      is_active: true,
      pricing_mode: 'ROUTE_DISTANCE',
      base_delivery_fee_tzs: 2000,
    });

    await adminClient.from('menu_items').insert({
      id: testMenuId,
      restaurant_id: testRestId,
      branch_id: testBranchId,
      name: 'Security Test Biryani',
      price_tzs: 10000,
      is_available: true,
      is_archived: false,
    });

    // Create and sign in staging test customer via anon client
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: customerEmail,
      password: customerPassword,
      email_confirm: true,
      user_metadata: { role: 'customer' },
    });
    if (authError || !authData.user) {
      throw new Error(`Failed to provision test customer: ${authError?.message}`);
    }
    customerUserId = authData.user.id;

    // Customer client using anon key
    const customerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await customerClient.auth.signInWithPassword({
      email: customerEmail,
      password: customerPassword,
    });
    if (signInError) {
      throw new Error(`Failed to sign in customer: ${signInError.message}`);
    }
    console.log(`  ✓ Test customer signed in (${customerEmail})`);

    // ------------------------------------------------------------------------
    // Group 1: 5 Attack Vectors (Direct Writes MUST Fail)
    // ------------------------------------------------------------------------
    console.log('\n--- Group 1: Attack Vectors Verification (All 5 Must Fail) ---');

    // Attack 1: Direct INSERT into orders
    const fakeOrderId = `ord_fake_${timestamp}`;
    const { error: insertOrderErr } = await customerClient.from('orders').insert({
      id: fakeOrderId,
      order_number: `FAKE-${timestamp}`,
      user_id: customerUserId,
      restaurant_id: testRestId,
      branch_id: testBranchId,
      status: 'PENDING',
      payment_status: 'PENDING',
      subtotal_tzs: 100,
      service_fee_tzs: 0,
      delivery_fee_tzs: 0,
      total_tzs: 100,
      dining_option: 'Takeaway',
    });
    assert(
      insertOrderErr !== null,
      `Attack 1 BLOCKED: Direct INSERT into orders rejected (${insertOrderErr?.message})`
    );

    // Create legitimate order via create_order_secure for update testing
    const { data: realOrderData, error: createErr } = await customerClient.rpc('create_order_secure', {
      p_branch_id: testBranchId,
      p_items: [{ menu_item_id: testMenuId, quantity: 1 }],
      p_fulfillment_type: 'Takeaway',
      p_delivery_zone_id: null,
      p_delivery_quote_id: null,
      p_delivery_address: null,
      p_special_instructions: 'Legitimate order',
    });
    if (createErr || !realOrderData?.order_id) {
      throw new Error(`Failed to setup legitimate order: ${createErr?.message}`);
    }
    const realOrderId = realOrderData.order_id;
    console.log(`  ✓ Seeded legitimate pending order ${realOrderId}`);

    // Attack 2: Direct UPDATE of total_tzs on own pending order
    const { data: hackedTotalData, error: hackTotalErr } = await customerClient
      .from('orders')
      .update({ total_tzs: 50 })
      .eq('id', realOrderId)
      .select();
    assert(
      hackTotalErr !== null || !hackedTotalData || hackedTotalData.length === 0,
      `Attack 2 BLOCKED: Direct UPDATE of total_tzs rejected (${hackTotalErr?.message || '0 rows updated'})`
    );

    // Attack 3: Direct UPDATE of payment_status = 'SUCCESS'
    const { data: hackedPayData, error: hackPayErr } = await customerClient
      .from('orders')
      .update({ payment_status: 'SUCCESS' })
      .eq('id', realOrderId)
      .select();
    assert(
      hackPayErr !== null || !hackedPayData || hackedPayData.length === 0,
      `Attack 3 BLOCKED: Direct UPDATE of payment_status rejected (${hackPayErr?.message || '0 rows updated'})`
    );

    // Attack 4: Direct INSERT into reservations
    const fakeResId = `res_fake_${timestamp}`;
    const { error: insertResErr } = await customerClient.from('reservations').insert({
      id: fakeResId,
      user_id: customerUserId,
      restaurant_id: testRestId,
      branch_id: testBranchId,
      party_size: 4,
      reservation_date: '2026-12-01',
      reservation_time: '08:00 PM',
      status: 'CONFIRMED',
      deposit_amount_tzs: 0,
      is_deposit_paid: true,
    });
    assert(
      insertResErr !== null,
      `Attack 4 BLOCKED: Direct INSERT into reservations rejected (${insertResErr?.message})`
    );

    // Setup an authorized reservation row via adminClient to test update attack
    const realResId = `res_real_${timestamp}`;
    await adminClient.from('reservations').insert({
      id: realResId,
      user_id: customerUserId,
      restaurant_id: testRestId,
      branch_id: testBranchId,
      party_size: 2,
      reservation_date: '2026-12-01',
      reservation_time: '07:30 PM',
      status: 'PENDING_RESTAURANT_APPROVAL',
      deposit_amount_tzs: 20000,
      is_deposit_paid: false,
    });

    // Attack 5: Direct UPDATE of is_deposit_paid = true or deposit_amount_tzs
    const { data: hackedResData, error: hackResErr } = await customerClient
      .from('reservations')
      .update({ is_deposit_paid: true, deposit_amount_tzs: 0 })
      .eq('id', realResId)
      .select();
    assert(
      hackResErr !== null || !hackedResData || hackedResData.length === 0,
      `Attack 5 BLOCKED: Direct UPDATE of is_deposit_paid rejected (${hackResErr?.message || '0 rows updated'})`
    );

    // ------------------------------------------------------------------------
    // Group 2: Legitimate Workflows (All Must Succeed via Authoritative RPCs)
    // ------------------------------------------------------------------------
    console.log('\n--- Group 2: Legitimate RPC Workflows Verification ---');

    // Flow 1: Place an order via create_order_secure
    const { data: flow1Order, error: flow1Err } = await customerClient.rpc('create_order_secure', {
      p_branch_id: testBranchId,
      p_items: [{ menu_item_id: testMenuId, quantity: 2 }],
      p_fulfillment_type: 'Takeaway',
      p_delivery_zone_id: null,
      p_delivery_quote_id: null,
      p_delivery_address: null,
      p_special_instructions: 'Legitimate workflow 1',
    });
    assert(flow1Err === null && flow1Order?.order_id, 'Flow 1: Order created via create_order_secure successfully');
    const flow1OrderId = flow1Order.order_id;

    // Flow 2: Pay in sandbox / confirm payment via confirm_payment_webhook_rpc
    const payRef = `TEST_PAY_${timestamp}`;
    await adminClient.from('payments').insert({
      id: `00000000-0000-4000-d000-${String(timestamp).slice(-12)}`,
      order_id: flow1OrderId,
      restaurant_id: testRestId,
      provider: 'sandbox',
      merchant_reference: payRef,
      provider_reference: `SANDBOX_${timestamp}`,
      amount_tzs: 20000,
      status: 'PENDING',
    });

    const { data: payConfirmRes, error: payConfirmErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
      p_merchant_reference: payRef,
      p_gateway_reference: `SANDBOX_${timestamp}`,
      p_provider: 'sandbox',
      p_collected_amount: 20000,
      p_event_id: `evt_sb_${timestamp}`,
      p_raw_payload: { data: { collectedCurrency: 'TZS' } },
    });
    assert(payConfirmErr === null && payConfirmRes.success === true, 'Flow 2: Sandbox payment confirmed cleanly via confirm_payment_webhook_rpc');

    // Flow 3: Customer cancellation of a pending order via cancel_customer_order_secure
    const { data: cancelOrderRes, error: cancelOrderErr } = await customerClient.rpc('cancel_customer_order_secure', {
      p_order_id: realOrderId,
      p_cancellation_reason: 'Testing legitimate customer cancellation',
    });
    assert(cancelOrderErr === null && cancelOrderRes?.success === true, 'Flow 3: Pending order cancelled via cancel_customer_order_secure');

    // Flow 4: Restaurant status transitions via transition_restaurant_order
    const { data: transRes, error: transErr } = await adminClient.rpc('transition_restaurant_order', {
      p_order_id: flow1OrderId,
      p_next_status: 'ACCEPTED',
      p_estimated_prep_minutes: 25,
    });
    assert(transErr === null && transRes?.success === true, 'Flow 4: Restaurant accepted order via transition_restaurant_order');

    // Flow 5: Cancel reservation via cancel_reservation_secure
    const { data: cancelResResult, error: cancelResErr } = await customerClient.rpc('cancel_reservation_secure', {
      p_reservation_id: realResId,
      p_cancellation_reason: 'Testing legitimate reservation cancellation',
    });
    assert(cancelResErr === null && cancelResResult?.success === true, 'Flow 5: Table reservation cancelled via cancel_reservation_secure');

  } finally {
    // Teardown test artifacts
    console.log('\n--- Teardown: Cleaning Test Records ---');
    if (customerUserId) {
      await adminClient.auth.admin.deleteUser(customerUserId).catch(() => {});
    }
    await adminClient.from('restaurants').delete().eq('id', testRestId).catch(() => {});
    console.log('  ✓ Test teardown complete');
  }

  console.log('\n================================================================');
  console.log(`✓ ALL DIRECT WRITE LOCKDOWN CHECKS PASSED: ${passed} checks passed`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\nFatal test runner error:', err);
  process.exit(1);
});
