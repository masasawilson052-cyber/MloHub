/**
 * ============================================================================
 * MLOHUB: DATABASE FEE ENGINE & DYNAMIC COMMISSION TEST SUITE (STAGING ONLY)
 * ============================================================================
 * Exercises and verifies all database fee rules:
 * 1. Exact integer customer service fee (3%, min 200, max 500, nearest 10).
 * 2. TZS 0 service fee for Takeaway, Pickup, Dine-In, Reservation.
 * 3. Custom meal get_platform_service_fee 1-arg & 2-arg overloads.
 * 4. Commission resolution precedence:
 *    (a) Dine-in -> 0 ('DINE_IN')
 *    (b) Free window (<30 days) -> 0 ('NEW_RESTAURANT_FREE_MONTH')
 *    (c) Active merchant policy -> delivery rate / LEAST(policy, takeaway) ('MERCHANT_POLICY')
 *    (d) Defaults -> Delivery 800 bps, Takeaway 500 bps ('DEFAULT'), Unknown ('UNKNOWN_TYPE')
 * 5. Delivery minimum order enforcement (TZS 5,000) rejecting TZS 4,000 order.
 * 6. Full sandbox payment capture flow writing order_financial_snapshots with commission_reason.
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
  console.log('🧪 MLOHUB DATABASE FEE ENGINE & COMMISSION RESOLUTION TEST SUITE');
  console.log('================================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

  // 1. Production Safeguards
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify connection
  const { data: pingData, error: pingError } = await adminClient.from('platform_financial_settings').select('*').limit(1);
  if (pingError) {
    console.error('❌ Failed to connect to database or query platform_financial_settings:', pingError.message);
    process.exit(1);
  }

  console.log(`Connected to database: ${supabaseUrl}`);

  // --------------------------------------------------------------------------
  // Group 1: Exact Integer Service Fee Math (compute_service_fee_tzs)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 1: Exact Integer Service Fee Math ---');

  const testCases = [
    { subtotal: 3000, type: 'Delivery', expected: 200, label: '3,000 TZS delivery -> min clamp 200' },
    { subtotal: 5000, type: 'Delivery', expected: 200, label: '5,000 TZS delivery -> min clamp 200' },
    { subtotal: 12000, type: 'Delivery', expected: 360, label: '12,000 TZS delivery -> 360' },
    { subtotal: 12345, type: 'Delivery', expected: 370, label: '12,345 TZS delivery -> 370 (half-up)' },
    { subtotal: 16000, type: 'Delivery', expected: 480, label: '16,000 TZS delivery -> 480' },
    { subtotal: 16500, type: 'Delivery', expected: 500, label: '16,500 TZS delivery -> 500 (nearest 10)' },
    { subtotal: 20000, type: 'Delivery', expected: 500, label: '20,000 TZS delivery -> max clamp 500' },
    { subtotal: 30000, type: 'Delivery', expected: 500, label: '30,000 TZS delivery -> max clamp 500' },
    { subtotal: 12000, type: 'Takeaway', expected: 0, label: 'Takeaway -> 0 TZS fee' },
    { subtotal: 12000, type: 'Pickup', expected: 0, label: 'Pickup -> 0 TZS fee' },
    { subtotal: 12000, type: 'Dine-In', expected: 0, label: 'Dine-In -> 0 TZS fee' },
    { subtotal: 12000, type: 'Reservation', expected: 0, label: 'Reservation -> 0 TZS fee' },
    { subtotal: 0, type: 'Delivery', expected: 0, label: '0 TZS subtotal -> 0 TZS fee' },
    { subtotal: -500, type: 'Delivery', expected: 0, label: 'Negative subtotal -> 0 TZS fee' },
  ];

  for (const tc of testCases) {
    const { data: fee, error: feeErr } = await adminClient.rpc('compute_service_fee_tzs', {
      p_subtotal_tzs: tc.subtotal,
      p_fulfillment_type: tc.type,
    });
    if (feeErr) throw new Error(`compute_service_fee_tzs RPC error: ${feeErr.message}`);
    assert(fee === tc.expected, `${tc.label} (got ${fee}, expected ${tc.expected})`);
  }

  // --------------------------------------------------------------------------
  // Group 1b: Custom Meal Service Fee Function Overloads (get_platform_service_fee)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 1b: Custom Meal Service Fee Overloads ---');

  const { data: cmFeeDefault, error: cmErr1 } = await adminClient.rpc('get_platform_service_fee', { p_subtotal_tzs: 12000 });
  if (cmErr1) throw new Error(`get_platform_service_fee(12000) error: ${cmErr1.message}`);
  assert(cmFeeDefault === 360, `get_platform_service_fee(12000) default -> 360 (got ${cmFeeDefault})`);

  const { data: cmFeeDeliv, error: cmErr2 } = await adminClient.rpc('get_platform_service_fee', { p_subtotal_tzs: 16500, p_fulfillment_type: 'Delivery' });
  if (cmErr2) throw new Error(`get_platform_service_fee(16500, Delivery) error: ${cmErr2.message}`);
  assert(cmFeeDeliv === 500, `get_platform_service_fee(16500, Delivery) -> 500 (got ${cmFeeDeliv})`);

  const { data: cmFeePickup, error: cmErr3 } = await adminClient.rpc('get_platform_service_fee', { p_subtotal_tzs: 16500, p_fulfillment_type: 'Pickup' });
  if (cmErr3) throw new Error(`get_platform_service_fee(16500, Pickup) error: ${cmErr3.message}`);
  assert(cmFeePickup === 0, `get_platform_service_fee(16500, Pickup) -> 0 (got ${cmFeePickup})`);

  const { data: cmFeeTakeaway, error: cmErr4 } = await adminClient.rpc('get_platform_service_fee', { p_subtotal_tzs: 16500, p_fulfillment_type: 'Takeaway' });
  if (cmErr4) throw new Error(`get_platform_service_fee(16500, Takeaway) error: ${cmErr4.message}`);
  assert(cmFeeTakeaway === 0, `get_platform_service_fee(16500, Takeaway) -> 0 (got ${cmFeeTakeaway})`);

  // --------------------------------------------------------------------------
  // Group 2: Public Fee Rules Read RPC (get_public_fee_rules)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 2: Public Fee Rules Read RPC ---');

  const { data: publicRules, error: rulesErr } = await adminClient.rpc('get_public_fee_rules');
  if (rulesErr) throw new Error(`get_public_fee_rules RPC error: ${rulesErr.message}`);

  assert(publicRules.service_fee_bps === 300, 'Public rules: service_fee_bps is 300 (3%)');
  assert(publicRules.service_fee_min_tzs === 200, 'Public rules: service_fee_min_tzs is 200');
  assert(publicRules.service_fee_max_tzs === 500, 'Public rules: service_fee_max_tzs is 500');
  assert(publicRules.delivery_min_order_tzs === 5000, 'Public rules: delivery_min_order_tzs is 5,000');
  assert(publicRules.minimum_order_value_tzs === 2000, 'Public rules: minimum_order_value_tzs is 2,000');
  assert(publicRules.commission_bps_delivery === undefined, 'Public rules: commission rates are omitted (not public)');

  // --------------------------------------------------------------------------
  // Group 3: Commission Resolution Precedence (resolve_commission_bps)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 3: Commission Resolution Precedence ---');

  // Find or create a dedicated test restaurant
  const testRestId = `test_rest_fees_${Date.now()}`;
  const now = new Date();

  // Create test restaurant
  const { error: insRestErr } = await adminClient.from('restaurants').insert({
    id: testRestId,
    name: 'Fee Rules Test Kitchen',
    slug: `fee-rules-test-${Date.now()}`,
    cuisine: 'Swahili & Grill',
    address: 'Mikocheni B',
    neighborhood: 'Mikocheni',
    is_active: true,
    is_published: true,
    is_verified: true,
    verification_status: 'VERIFIED',
    launch_status: 'PUBLISHED',
  });
  if (insRestErr) throw new Error(`Failed to create test restaurant: ${insRestErr.message}`);

  try {
    // 3a. Dine-In precedence: Dine-In ALWAYS gets 0 bps, reason 'DINE_IN'
    const { data: resDineIn } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Dine-In',
      p_at: now.toISOString(),
    });
    assert(resDineIn[0].bps === 0, 'Dine-in commission is 0 bps');
    assert(resDineIn[0].reason === 'DINE_IN', 'Dine-in reason is DINE_IN');

    // 3b. Free window precedence: launched 10 days ago (within 30-day window)
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
    await adminClient.from('restaurants').update({ launched_at: tenDaysAgo.toISOString() }).eq('id', testRestId);

    const { data: resPromoDelivery } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Delivery',
      p_at: now.toISOString(),
    });
    assert(resPromoDelivery[0].bps === 0, '10-day-old restaurant delivery commission is 0 bps (free month)');
    assert(resPromoDelivery[0].reason === 'NEW_RESTAURANT_FREE_MONTH', 'Reason is NEW_RESTAURANT_FREE_MONTH');

    const { data: resPromoTakeaway } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Takeaway',
      p_at: now.toISOString(),
    });
    assert(resPromoTakeaway[0].bps === 0, '10-day-old restaurant takeaway commission is 0 bps (free month)');
    assert(resPromoTakeaway[0].reason === 'NEW_RESTAURANT_FREE_MONTH', 'Reason is NEW_RESTAURANT_FREE_MONTH');

    // 3c. Defaults: launched 40 days ago (outside 30-day window, no policy)
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 3600 * 1000);
    await adminClient.from('restaurants').update({ launched_at: fortyDaysAgo.toISOString() }).eq('id', testRestId);

    const { data: resDefDelivery } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Delivery',
      p_at: now.toISOString(),
    });
    assert(resDefDelivery[0].bps === 800, '40-day-old restaurant delivery commission is 800 bps (8%)');
    assert(resDefDelivery[0].reason === 'DEFAULT', 'Reason is DEFAULT');

    const { data: resDefTakeaway } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Takeaway',
      p_at: now.toISOString(),
    });
    assert(resDefTakeaway[0].bps === 500, '40-day-old restaurant takeaway commission is 500 bps (5%)');
    assert(resDefTakeaway[0].reason === 'DEFAULT', 'Reason is DEFAULT');

    const { data: resDefPickup } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Pickup',
      p_at: now.toISOString(),
    });
    assert(resDefPickup[0].bps === 500, 'Pickup fulfillment commission maps to takeaway 500 bps (5%)');
    assert(resDefPickup[0].reason === 'DEFAULT', 'Reason is DEFAULT');

    const { data: resUnknown } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Catering',
      p_at: now.toISOString(),
    });
    assert(resUnknown[0].bps === 800, 'Unknown order type defaults safely to delivery rate 800 bps');
    assert(resUnknown[0].reason === 'UNKNOWN_TYPE', 'Reason is UNKNOWN_TYPE');

    // 3d. Merchant Policy Override
    // Add custom policy: 1,200 bps (12%)
    const { data: policy, error: polErr } = await adminClient.from('merchant_fee_policies').insert({
      restaurant_id: testRestId,
      commission_basis_points: 1200,
      commission_fixed_tzs: 0,
      effective_from: fortyDaysAgo.toISOString(),
    }).select().single();
    if (polErr) throw new Error(`Failed to create test merchant fee policy: ${polErr.message}`);

    const { data: resPolicyDelivery } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Delivery',
      p_at: now.toISOString(),
    });
    assert(resPolicyDelivery[0].bps === 1200, 'Active merchant policy overrides delivery commission to 1,200 bps (12%)');
    assert(resPolicyDelivery[0].reason === 'MERCHANT_POLICY', 'Reason is MERCHANT_POLICY');

    const { data: resPolicyTakeaway } = await adminClient.rpc('resolve_commission_bps', {
      p_restaurant_id: testRestId,
      p_fulfillment_type: 'Takeaway',
      p_at: now.toISOString(),
    });
    assert(
      resPolicyTakeaway[0].bps === 500,
      'Takeaway under 1,200 bps merchant policy caps at LEAST(policy, takeaway default) = 500 bps'
    );
    assert(resPolicyTakeaway[0].reason === 'MERCHANT_POLICY', 'Reason is MERCHANT_POLICY');

    // Delete test policy
    await adminClient.from('merchant_fee_policies').delete().eq('id', policy.id);

    // ------------------------------------------------------------------------
    // Group 4: Delivery Minimum Order Rejection in create_order_secure
    // ------------------------------------------------------------------------
    console.log('\n--- Group 4: Delivery Minimum Order Rejection ---');

    // Create temporary customer user so auth.uid() is valid
    const custEmail = `fee_tester_${Date.now()}@mlohub.test`;
    const custPass = 'TestPass123!Safe';
    const { data: custAuth, error: custAuthErr } = await adminClient.auth.admin.createUser({
      email: custEmail,
      password: custPass,
      email_confirm: true,
      user_metadata: { full_name: 'Fee Customer', role: 'CUSTOMER' },
    });
    if (custAuthErr) throw new Error(`Failed to create test customer: ${custAuthErr.message}`);

    await adminClient.from('profiles').upsert({
      id: custAuth.user.id,
      full_name: 'Fee Customer',
      role: 'CUSTOMER',
      roles: ['CUSTOMER'],
      account_type: 'CUSTOMER',
      is_active: true,
    });

    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || serviceRoleKey;
    const customerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErr } = await customerClient.auth.signInWithPassword({
      email: custEmail,
      password: custPass,
    });
    if (signInErr) throw new Error(`Customer sign-in failed: ${signInErr.message}`);

    try {
      const { data: existingBranch } = await adminClient
        .from('restaurant_branches')
        .select('id, restaurant_id')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (existingBranch) {
        let testItemId = `item_fee_test_${Date.now()}`;
        await adminClient.from('menu_items').insert({
          id: testItemId,
          restaurant_id: existingBranch.restaurant_id,
          name_en: 'Small Chai Test',
          name_sw: 'Chai Ndogo Test',
          price_tzs: 4000,
          is_available: true,
          is_archived: false,
        });

        // Insert valid delivery quote for customer
        const { data: testQuote } = await adminClient.from('delivery_quotes').insert({
          user_id: custAuth.user.id,
          branch_id: existingBranch.id,
          pickup_latitude: -6.77,
          pickup_longitude: 39.24,
          destination_latitude: -6.78,
          destination_longitude: 39.25,
          distance_meters: 2000,
          duration_seconds: 600,
          delivery_fee_tzs: 2500,
          pricing_config: {},
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }).select().single();

        // Check if branch has an active delivery zone
        const { data: testZone } = await adminClient.from('branch_delivery_zones')
          .select('id')
          .eq('branch_id', existingBranch.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        // Attempt delivery order of 4,000 TZS
        const { error: orderErr } = await customerClient.rpc('create_order_secure', {
          p_branch_id: existingBranch.id,
          p_items: [{ menu_item_id: testItemId, quantity: 1 }],
          p_fulfillment_type: 'Delivery',
          p_delivery_address: 'Mikocheni A',
          p_delivery_quote_id: testQuote?.id,
          p_delivery_zone_id: testZone?.id,
        });

        assert(Boolean(orderErr), 'Delivery order with 4,000 TZS subtotal was strictly rejected');
        assert(
          Boolean(orderErr?.message.includes('MIN_ORDER_DELIVERY:5000')),
          `Error message includes MIN_ORDER_DELIVERY:5000 (${orderErr?.message})`
        );

        // Clean up temporary menu item and quote
        await adminClient.from('menu_items').delete().eq('id', testItemId);
        if (testQuote) {
          await adminClient.from('delivery_quotes').delete().eq('id', testQuote.id);
        }
      }
    } finally {
      // Clean up customer
      await adminClient.from('profiles').delete().eq('id', custAuth.user.id);
      await adminClient.auth.admin.deleteUser(custAuth.user.id);
    }

    // ------------------------------------------------------------------------
    // Group 5: Full Sandbox Payment Capture Writing Financial Snapshot
    // ------------------------------------------------------------------------
    console.log('\n--- Group 5: Full Payment Capture Snapshot Verification ---');

    // Create a standalone order directly in public.orders for 40-day-old restaurant
    const testOrderId = `ord_fee_test_${Date.now()}`;
    const foodSubtotal = 12000;
    const serviceFee = 360;
    const deliveryFee = 2500;
    const grandTotal = foodSubtotal + serviceFee + deliveryFee;

    const { error: insOrderErr } = await adminClient.from('orders').insert({
      id: testOrderId,
      order_number: `MLO-TEST-${Date.now()}`,
      restaurant_id: testRestId,
      subtotal_tzs: foodSubtotal,
      service_fee_tzs: serviceFee,
      delivery_fee_tzs: deliveryFee,
      total_tzs: grandTotal,
      dining_option: 'Delivery',
      status: 'PENDING',
      payment_status: 'PENDING',
    });
    if (insOrderErr) throw new Error(`Failed to insert test order: ${insOrderErr.message}`);

    const testPayId = `pay_fee_test_${Date.now()}`;
    const testMerchantRef = `mref_${Date.now()}`;
    const testGatewayRef = `gwref_${Date.now()}`;

    const { error: insPayErr } = await adminClient.from('payments').insert({
      id: testPayId,
      order_id: testOrderId,
      amount_tzs: grandTotal,
      provider: 'SANDBOX',
      merchant_reference: testMerchantRef,
      provider_reference: testGatewayRef,
      status: 'PENDING',
    });
    if (insPayErr) throw new Error(`Failed to insert test payment: ${insPayErr.message}`);

    // Capture payment through normal sandbox webhook / confirmation RPC
    const { data: captureResult, error: capErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
      p_merchant_reference: testMerchantRef,
      p_gateway_reference: testGatewayRef,
      p_provider: 'SANDBOX',
      p_collected_amount: grandTotal,
      p_event_id: `evt_${Date.now()}`,
      p_raw_payload: { status: 'SUCCESS', test: true },
    });
    if (capErr) throw new Error(`confirm_payment_webhook_rpc error: ${capErr.message}`);
    assert(captureResult?.success === true, 'confirm_payment_webhook_rpc completed successfully');

    // Query immutable financial snapshot
    const { data: snapshot, error: snapErr } = await adminClient
      .from('order_financial_snapshots')
      .select('*')
      .eq('order_id', testOrderId)
      .single();

    if (snapErr) throw new Error(`Failed to query order_financial_snapshots: ${snapErr.message}`);

    assert(snapshot.gross_food_sales_tzs === foodSubtotal, `Snapshot food sales is ${foodSubtotal}`);
    assert(snapshot.customer_service_fee_tzs === serviceFee, `Snapshot service fee is ${serviceFee}`);
    assert(snapshot.commission_basis_points_snapshot === 800, 'Snapshot commission basis points is 800 (8%)');
    assert(snapshot.platform_commission_tzs === 960, `Snapshot commission is 960 TZS (12,000 * 8% = 960)`);
    assert(snapshot.commission_reason === 'DEFAULT', `Snapshot commission_reason recorded as 'DEFAULT' (${snapshot.commission_reason})`);

    // Clean up test order and payment records
    await adminClient.from('order_financial_snapshots').delete().eq('order_id', testOrderId);
    await adminClient.from('financial_ledger_entries').delete().eq('entity_id', testOrderId);
    await adminClient.from('payments').delete().eq('id', testPayId);
    await adminClient.from('orders').delete().eq('id', testOrderId);

  } finally {
    // Teardown test restaurant
    await adminClient.from('restaurants').delete().eq('id', testRestId);
  }

  console.log('\n================================================================');
  console.log(`✓ ALL FEE ENGINE AND COMMISSION RESOLUTION CHECKS PASSED: ${passed} checks`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\nFatal test runner error:', err);
  process.exit(1);
});
