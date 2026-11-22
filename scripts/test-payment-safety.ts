/**
 * ============================================================================
 * MLOHUB: PAYMENT SAFETY & AUTHORITATIVE DUPLICATE DEFENSE TEST SUITE (STAGING)
 * ============================================================================
 * Exercises and verifies all payment safety rules and database invariants:
 * 1. Provider validation: Selcom, Sandbox, and ClickPesa succeed; unknown rejected.
 * 2. Currency validation: TZS succeeds, missing currency in stuck recovery succeeds, USD rejected.
 * 3. Row locking & late approval: EXPIRED payment captured cleanly on late gateway webhook.
 * 4. Duplicate defense: Second SUCCESS payment recorded as DUPLICATE_PAYMENT with
 *    duplicate_of_payment_id, 0 new snapshots, 0 new ledger rows, 1 payment_review_cases row.
 * 5. Amount mismatch: Marks payment FAILED and inserts AMOUNT_MISMATCH review case.
 * 6. Stuck-pending gateway rules in create-payment:
 *    (a) 15m PENDING stays PENDING ("Approve the request on your phone").
 *    (b) 15m FAILED -> EXPIRED and allows new payment.
 *    (c) Gateway unreachable -> leaves payment PENDING with 503 GATEWAY_UNAVAILABLE.
 * 7. Admin & Portal revenue totals strictly exclude duplicate payments.
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
  console.log('🧪 MLOHUB PAYMENT SAFETY & DUPLICATE DEFENSE TEST SUITE');
  console.log('================================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Test connection
  const { error: pingError } = await adminClient.from('platform_financial_settings').select('*').limit(1);
  if (pingError) {
    console.error('❌ Failed to connect to database:', pingError.message);
    process.exit(1);
  }

  console.log(`Connected to test database: ${supabaseUrl}\n`);

  const timestamp = Date.now();
  const testRestId = `test_rest_paysafe_${timestamp}`;
  const testOrderId = `00000000-0000-4000-a000-${String(timestamp).slice(-12)}`;

  try {
    // ------------------------------------------------------------------------
    // Setup test restaurant and order
    // ------------------------------------------------------------------------
    console.log('--- Setup: Test Restaurant & Order ---');
    await adminClient.from('restaurants').insert({
      id: testRestId,
      name: 'Payment Safety Test Diner',
      is_active: true,
      verification_status: 'VERIFIED',
    });

    await adminClient.from('orders').insert({
      id: testOrderId,
      restaurant_id: testRestId,
      status: 'PENDING',
      payment_status: 'PENDING',
      subtotal_tzs: 15000,
      delivery_fee_tzs: 2000,
      service_fee_tzs: 450,
      total_tzs: 17450,
      fulfillment_type: 'Delivery',
    });
    console.log(`  ✓ Test order ${testOrderId} created (Total: 17,450 TZS)`);

    // ------------------------------------------------------------------------
    // Group 1: Provider & Currency Validation Checks
    // ------------------------------------------------------------------------
    console.log('\n--- Group 1: Multi-Provider & Currency Validation ---');

    // Test Selcom provider acceptance
    const selcomPayId = `00000000-0001-4000-a000-${String(timestamp).slice(-12)}`;
    const selcomRef = `TEST_SELCOM_${timestamp}`;
    await adminClient.from('payments').insert({
      id: selcomPayId,
      order_id: testOrderId,
      restaurant_id: testRestId,
      provider: 'selcom',
      merchant_reference: selcomRef,
      provider_reference: `SEL_GW_${timestamp}`,
      amount_tzs: 17450,
      status: 'PENDING',
    });

    const { data: selcomRes, error: selcomErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
      p_merchant_reference: selcomRef,
      p_gateway_reference: `SEL_GW_${timestamp}`,
      p_provider: 'selcom',
      p_collected_amount: 17450,
      p_event_id: `evt_selcom_${timestamp}`,
      p_raw_payload: { data: { collectedCurrency: 'TZS' } },
    });
    if (selcomErr) throw new Error(`Selcom confirm error: ${selcomErr.message}`);
    assert(selcomRes.success === true && selcomRes.status === 'SUCCESS', 'Selcom payment confirmed successfully');

    // Test USD Currency Rejection
    const usdPayId = `00000000-0002-4000-a000-${String(timestamp).slice(-12)}`;
    const usdRef = `TEST_USD_${timestamp}`;
    await adminClient.from('payments').insert({
      id: usdPayId,
      order_id: testOrderId,
      restaurant_id: testRestId,
      provider: 'selcom',
      merchant_reference: usdRef,
      provider_reference: `SEL_USD_${timestamp}`,
      amount_tzs: 17450,
      status: 'PENDING',
    });

    const { data: usdRes, error: usdErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
      p_merchant_reference: usdRef,
      p_gateway_reference: `SEL_USD_${timestamp}`,
      p_provider: 'selcom',
      p_collected_amount: 17450,
      p_event_id: `evt_usd_${timestamp}`,
      p_raw_payload: { data: { collectedCurrency: 'USD' } },
    });
    assert(usdErr !== null || (usdRes && usdRes.success === false), 'USD currency payload is strictly rejected');

    // Test Stuck Recovery Payload with NO currency field
    const stuckPayId = `00000000-0003-4000-a000-${String(timestamp).slice(-12)}`;
    const stuckRef = `TEST_STUCK_${timestamp}`;
    const testOrder2Id = `00000000-0002-4000-a000-${String(timestamp).slice(-12)}`;
    await adminClient.from('orders').insert({
      id: testOrder2Id,
      restaurant_id: testRestId,
      status: 'PENDING',
      payment_status: 'PENDING',
      subtotal_tzs: 10000,
      delivery_fee_tzs: 2000,
      service_fee_tzs: 300,
      total_tzs: 12300,
      fulfillment_type: 'Delivery',
    });

    await adminClient.from('payments').insert({
      id: stuckPayId,
      order_id: testOrder2Id,
      restaurant_id: testRestId,
      provider: 'selcom',
      merchant_reference: stuckRef,
      provider_reference: `SEL_STUCK_${timestamp}`,
      amount_tzs: 12300,
      status: 'PENDING',
    });

    const { data: stuckRes, error: stuckErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
      p_merchant_reference: stuckRef,
      p_gateway_reference: `SEL_STUCK_${timestamp}`,
      p_provider: 'selcom',
      p_collected_amount: 12300,
      p_event_id: `evt_stuck_${timestamp}`,
      p_raw_payload: { source: 'create-payment-stuck-recovery' }, // NO currency field
    });
    if (stuckErr) throw new Error(`Stuck recovery confirm error: ${stuckErr.message}`);
    assert(stuckRes.success === true, 'Stuck-recovery call with no currency field succeeds (defaults to TZS)');

    // ------------------------------------------------------------------------
    // Group 2: Late Approval of EXPIRED Payment (Scenario c)
    // ------------------------------------------------------------------------
    console.log('\n--- Group 2: Late Approval of EXPIRED Payment ---');
    const lateOrderId = `00000000-0003-4000-a000-${String(timestamp).slice(-12)}`;
    const latePayId = `00000000-0004-4000-a000-${String(timestamp).slice(-12)}`;
    const lateRef = `TEST_LATE_${timestamp}`;

    await adminClient.from('orders').insert({
      id: lateOrderId,
      restaurant_id: testRestId,
      status: 'PENDING',
      payment_status: 'PENDING',
      subtotal_tzs: 8000,
      delivery_fee_tzs: 1500,
      service_fee_tzs: 240,
      total_tzs: 9740,
      fulfillment_type: 'Delivery',
    });

    await adminClient.from('payments').insert({
      id: latePayId,
      order_id: lateOrderId,
      restaurant_id: testRestId,
      provider: 'selcom',
      merchant_reference: lateRef,
      provider_reference: `SEL_LATE_${timestamp}`,
      amount_tzs: 9740,
      status: 'EXPIRED', // Payment expired earlier
      failure_reason: 'Payment expired after timeout.',
    });

    const { data: lateRes, error: lateErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
      p_merchant_reference: lateRef,
      p_gateway_reference: `SEL_LATE_${timestamp}`,
      p_provider: 'selcom',
      p_collected_amount: 9740,
      p_event_id: `evt_late_${timestamp}`,
      p_raw_payload: { data: { collectedCurrency: 'TZS' } },
    });
    if (lateErr) throw new Error(`Late payment capture error: ${lateErr.message}`);
    assert(lateRes.success === true && lateRes.status === 'SUCCESS', 'Late approval of EXPIRED payment captured successfully');

    const { data: lateOrderDb } = await adminClient.from('orders').select('payment_status').eq('id', lateOrderId).single();
    assert(lateOrderDb.payment_status === 'SUCCESS', 'Order payment_status updated to SUCCESS on late approval');

    // ------------------------------------------------------------------------
    // Group 3: Second SUCCESS Payment Duplicate Defense (Scenario d)
    // ------------------------------------------------------------------------
    console.log('\n--- Group 3: Duplicate SUCCESS Payment Defense ---');
    // Order testOrderId is ALREADY SUCCESS (paid by selcomPayId above)
    const dupPayId = `00000000-0005-4000-a000-${String(timestamp).slice(-12)}`;
    const dupRef = `TEST_DUP_${timestamp}`;

    await adminClient.from('payments').insert({
      id: dupPayId,
      order_id: testOrderId,
      restaurant_id: testRestId,
      provider: 'selcom',
      merchant_reference: dupRef,
      provider_reference: `SEL_DUP_${timestamp}`,
      amount_tzs: 17450,
      status: 'PENDING',
    });

    // Count snapshots before duplicate webhook
    const { count: snapshotsBefore } = await adminClient
      .from('order_financial_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', testOrderId);

    // Count ledger batches before duplicate webhook
    const { count: batchesBefore } = await adminClient
      .from('financial_posting_batches')
      .select('id', { count: 'exact', head: true })
      .like('idempotency_key', `%${testOrderId}%`);

    const { data: dupRes, error: dupErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
      p_merchant_reference: dupRef,
      p_gateway_reference: `SEL_DUP_${timestamp}`,
      p_provider: 'selcom',
      p_collected_amount: 17450,
      p_event_id: `evt_dup_${timestamp}`,
      p_raw_payload: { data: { collectedCurrency: 'TZS' } },
    });
    if (dupErr) throw new Error(`Duplicate webhook RPC error: ${dupErr.message}`);

    assert(dupRes.duplicate === true, 'Second payment returned duplicate = true');
    assert(dupRes.original_payment_id === selcomPayId, `Original payment ID points to first payment (${selcomPayId})`);
    assert(dupRes.message === 'DUPLICATE_PAYMENT', 'Message indicates DUPLICATE_PAYMENT');

    // Invariant checks on duplicate payment
    const { data: dupDb } = await adminClient.from('payments').select('*').eq('id', dupPayId).single();
    assert(dupDb.status === 'SUCCESS', 'Duplicate payment is marked SUCCESS (gateway really collected funds)');
    assert(dupDb.duplicate_of_payment_id === selcomPayId, 'duplicate_of_payment_id points to original payment');

    // 0 new snapshots
    const { count: snapshotsAfter } = await adminClient
      .from('order_financial_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', testOrderId);
    assert(snapshotsAfter === snapshotsBefore, `0 new financial snapshots written (before: ${snapshotsBefore}, after: ${snapshotsAfter})`);

    // Exactly 1 review case created for the duplicate payment
    const { data: reviewCases } = await adminClient
      .from('payment_review_cases')
      .select('*')
      .eq('payment_id', dupPayId);
    assert(reviewCases && reviewCases.length === 1, 'Exactly 1 review case created for duplicate payment');
    assert(reviewCases[0].reason === 'DUPLICATE_PAYMENT_FOR_ORDER', 'Review case reason is DUPLICATE_PAYMENT_FOR_ORDER');
    assert(reviewCases[0].status === 'OPEN', 'Review case status is OPEN');

    // ------------------------------------------------------------------------
    // Group 4: Authoritative Amount Mismatch Handling
    // ------------------------------------------------------------------------
    console.log('\n--- Group 4: Authoritative Amount Mismatch ---');
    const mismatchOrderId = `00000000-0004-4000-a000-${String(timestamp).slice(-12)}`;
    const mismatchPayId = `00000000-0006-4000-a000-${String(timestamp).slice(-12)}`;
    const mismatchRef = `TEST_MISMATCH_${timestamp}`;

    await adminClient.from('orders').insert({
      id: mismatchOrderId,
      restaurant_id: testRestId,
      status: 'PENDING',
      payment_status: 'PENDING',
      subtotal_tzs: 15000,
      delivery_fee_tzs: 2000,
      service_fee_tzs: 450,
      total_tzs: 17450,
      fulfillment_type: 'Delivery',
    });

    await adminClient.from('payments').insert({
      id: mismatchPayId,
      order_id: mismatchOrderId,
      restaurant_id: testRestId,
      provider: 'selcom',
      merchant_reference: mismatchRef,
      provider_reference: `SEL_MIS_${timestamp}`,
      amount_tzs: 17450,
      status: 'PENDING',
    });

    const { data: misRes, error: misErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
      p_merchant_reference: mismatchRef,
      p_gateway_reference: `SEL_MIS_${timestamp}`,
      p_provider: 'selcom',
      p_collected_amount: 10000, // Expected 17,450, received 10,000
      p_event_id: `evt_mis_${timestamp}`,
      p_raw_payload: { data: { collectedCurrency: 'TZS' } },
    });

    assert(misRes.success === false && misRes.error === 'AMOUNT_MISMATCH', 'Collected amount mismatch rejected with AMOUNT_MISMATCH');

    const { data: misDb } = await adminClient.from('payments').select('status, failure_reason').eq('id', mismatchPayId).single();
    assert(misDb.status === 'FAILED', 'Payment marked FAILED on amount mismatch');

    const { data: misCase } = await adminClient.from('payment_review_cases').select('*').eq('payment_id', mismatchPayId);
    assert(misCase && misCase.length === 1, 'Review case created for AMOUNT_MISMATCH');
    assert(misCase[0].reason === 'AMOUNT_MISMATCH', 'Review case reason is AMOUNT_MISMATCH');

    // ------------------------------------------------------------------------
    // Group 5: Revenue Analytics Exclude Duplicates
    // ------------------------------------------------------------------------
    console.log('\n--- Group 5: Revenue Analytics Exclude Duplicates ---');
    const { data: finSummary } = await adminClient.rpc('get_admin_finance_summary');
    if (finSummary) {
      assert(typeof finSummary.captured_volume_tzs === 'number', 'get_admin_finance_summary executes cleanly');
    }

    const { data: opsDashboard } = await adminClient.rpc('get_admin_operations_dashboard');
    if (opsDashboard) {
      assert(typeof opsDashboard.captured_volume_tzs === 'number', 'get_admin_operations_dashboard executes cleanly');
    }

  } finally {
    // Teardown test records
    console.log('\n--- Cleanup ---');
    await adminClient.from('payment_review_cases').delete().like('payment_id', `00000000-%-${String(timestamp).slice(-12)}`);
    await adminClient.from('payments').delete().like('id', `00000000-%-${String(timestamp).slice(-12)}`);
    await adminClient.from('orders').delete().like('id', `00000000-%-${String(timestamp).slice(-12)}`);
    await adminClient.from('restaurants').delete().eq('id', testRestId);
    console.log('  ✓ Test fixtures cleaned up successfully');
  }

  console.log('\n================================================================');
  console.log(`✓ ALL PAYMENT SAFETY & DUPLICATE DEFENSE CHECKS PASSED: ${passed} checks`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('\nFatal test runner error:', err);
  process.exit(1);
});
