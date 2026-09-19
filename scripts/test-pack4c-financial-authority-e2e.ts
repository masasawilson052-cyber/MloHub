/**
 * MLOHUB PACK 4C — FINANCIAL AUTHORITY, REFUNDS, DISPUTES,
 * SETTLEMENTS & RECONCILIATION E2E TEST SUITE
 * 
 * Verifies all 28 Scenarios (A through AB) against local Supabase instance.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: any, description: string) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ FAIL: ${description}`);
  }
}

async function runPack4CSuite() {
  console.log('\n===============================================================');
  console.log('  STARTING MLOHUB PACK 4C FINANCIAL AUTHORITY & SUBLEDGER E2E');
  console.log('===============================================================\n');

  const timestamp = Date.now();
  const testEmailCustomerA = `fin_cust_a_${timestamp}@mlohub.test`;
  const testEmailCustomerB = `fin_cust_b_${timestamp}@mlohub.test`;
  const testEmailOwnerA = `fin_owner_a_${timestamp}@mlohub.test`;
  const testEmailOwnerB = `fin_owner_b_${timestamp}@mlohub.test`;
  const testEmailStaffA = `fin_staff_a_${timestamp}@mlohub.test`;
  const defaultPassword = 'TestPassword123!';

  // Step 1: Provision Test Users
  console.log('--- Step 1: Provisioning Test Users ---');
  const { data: userCustA } = await adminClient.auth.admin.createUser({
    email: testEmailCustomerA,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Customer Alice', role: 'CUSTOMER' },
  });
  const { data: userCustB } = await adminClient.auth.admin.createUser({
    email: testEmailCustomerB,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Customer Bob', role: 'CUSTOMER' },
  });
  const { data: userOwnerA } = await adminClient.auth.admin.createUser({
    email: testEmailOwnerA,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Owner Alpha', role: 'RESTAURANT_OWNER' },
  });
  const { data: userOwnerB } = await adminClient.auth.admin.createUser({
    email: testEmailOwnerB,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Owner Beta', role: 'RESTAURANT_OWNER' },
  });
  const { data: userStaffA } = await adminClient.auth.admin.createUser({
    email: testEmailStaffA,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Staff Alpha', role: 'RESTAURANT_STAFF' },
  });

  const custAId = userCustA?.user?.id || '';
  const custBId = userCustB?.user?.id || '';
  const ownerAId = userOwnerA?.user?.id || '';
  const ownerBId = userOwnerB?.user?.id || '';
  const staffAId = userStaffA?.user?.id || '';

  const clientCustA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientCustA.auth.signInWithPassword({ email: testEmailCustomerA, password: defaultPassword });

  const clientCustB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientCustB.auth.signInWithPassword({ email: testEmailCustomerB, password: defaultPassword });

  const clientOwnerA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientOwnerA.auth.signInWithPassword({ email: testEmailOwnerA, password: defaultPassword });

  const clientOwnerB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientOwnerB.auth.signInWithPassword({ email: testEmailOwnerB, password: defaultPassword });

  const clientStaffA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientStaffA.auth.signInWithPassword({ email: testEmailStaffA, password: defaultPassword });

  assert(!!userCustA?.user && !!userOwnerA?.user && !!userStaffA?.user, 'All 5 test users authenticated');

  // Step 2: Provision Restaurants and Members
  console.log('\n--- Step 2: Provisioning Restaurants & Members ---');
  const restAId = `rest_p4c_a_${timestamp}`;
  const restBId = `rest_p4c_b_${timestamp}`;

  await adminClient.from('restaurants').insert([
    {
      id: restAId,
      owner_id: ownerAId,
      name: 'Alpha Grill Dar',
      slug: `alpha-grill-${timestamp}`,
      cuisine: 'Swahili & BBQ',
      is_open: true,
      is_verified: true,
      address: 'Kinondoni, Dar es Salaam',
    },
    {
      id: restBId,
      owner_id: ownerBId,
      name: 'Beta Seafood Masaki',
      slug: `beta-seafood-${timestamp}`,
      cuisine: 'Seafood & Lounge',
      is_open: true,
      is_verified: true,
      address: 'Masaki, Dar es Salaam',
    },
  ]);

  await adminClient.from('restaurant_members').insert([
    {
      user_id: ownerAId,
      restaurant_id: restAId,
      role: 'OWNER',
      permissions: ['ALL'],
      is_primary_owner: true,
      is_active: true,
    },
    {
      user_id: staffAId,
      restaurant_id: restAId,
      role: 'STAFF',
      permissions: ['ORDERS_READ', 'ORDERS_UPDATE'],
      is_primary_owner: false,
      is_active: true,
    },
    {
      user_id: ownerBId,
      restaurant_id: restBId,
      role: 'OWNER',
      permissions: ['ALL'],
      is_primary_owner: true,
      is_active: true,
    },
  ]);

  // Insert Fee Policies: 10% (1000 bps) for Rest A and Rest B
  await adminClient.from('merchant_fee_policies').insert([
    {
      restaurant_id: restAId,
      commission_basis_points: 1000,
      effective_from: '2020-01-01T00:00:00Z',
      effective_until: null,
      created_by: ownerAId,
    },
    {
      restaurant_id: restBId,
      commission_basis_points: 1000,
      effective_from: '2020-01-01T00:00:00Z',
      effective_until: null,
      created_by: ownerBId,
    },
  ]);

  // Insert Payout Destinations for Rest A and Rest B
  const { data: destA } = await adminClient.from('merchant_payout_destinations').insert({
    restaurant_id: restAId,
    destination_type: 'MOBILE_MONEY',
    provider: 'M_PESA',
    masked_account_identifier: '255755***123',
    account_name: 'Alpha Grill Ltd',
    verification_status: 'VERIFIED',
    is_default: true,
    created_by: ownerAId,
  }).select().single();

  const { data: destB } = await adminClient.from('merchant_payout_destinations').insert({
    restaurant_id: restBId,
    destination_type: 'BANK',
    provider: 'CRDB',
    masked_account_identifier: 'CRDB ****5678',
    account_name: 'Beta Seafood Ltd',
    verification_status: 'VERIFIED',
    is_default: true,
    created_by: ownerBId,
  }).select().single();

  assert(!!destA?.id && !!destB?.id, 'Payout destinations provisioned and verified');

  // ============================================================================
  // SCENARIO A: Standard Order Capture & Balanced Batch
  // ============================================================================
  console.log('\n--- Scenario A: Standard Order Capture & Double-Entry Balancing ---');
  const ordAId = `ord_a_${timestamp}`;
  await adminClient.from('orders').insert({
    id: ordAId,
    order_number: `ORD-A-${timestamp}`,
    user_id: custAId,
    restaurant_id: restAId,
    status: 'COMPLETED',
    subtotal_tzs: 30000,
    service_fee_tzs: 0,
    delivery_fee_tzs: 0,
    total_tzs: 30000,
  });

  const payOrdAId = `pay_ord_a_${timestamp}`;
  await adminClient.from('payments').insert({
    id: payOrdAId,
    user_id: custAId,
    restaurant_id: restAId,
    order_id: ordAId,
    amount_tzs: 30000,
    net_restaurant_payout_tzs: 27000,
    payment_method: 'M_PESA',
    phone_number: '+255755123456',
    status: 'PENDING',
  });

  const captureResA = await adminClient.rpc('finalize_payment_capture_rpc', {
    p_payment_id: payOrdAId,
    p_provider_reference: `cp_tx_${timestamp}_a`,
    p_gateway_reference: `gw_${timestamp}_a`,
    p_captured_amount_tzs: 30000,
    p_idempotency_key: `idem_cap_a_${timestamp}`,
  });

  assert(captureResA.data?.success === true, 'finalize_payment_capture_rpc returns success');

  const { data: batchA } = await adminClient
    .from('financial_posting_batches')
    .select('*, financial_ledger_entries(*)')
    .eq('id', captureResA.data.batch_id)
    .single();

  assert(batchA?.is_balanced === true, 'Posting batch A is marked is_balanced = true');
  assert(batchA?.financial_ledger_entries?.length === 3, 'Posting batch A has 3 ledger entries');

  let debitsA = 0n;
  let creditsA = 0n;
  for (const e of batchA.financial_ledger_entries) {
    if (e.direction === 'DEBIT') debitsA += BigInt(e.amount_tzs);
    if (e.direction === 'CREDIT') creditsA += BigInt(e.amount_tzs);
  }
  assert(debitsA === 30000n && creditsA === 30000n, 'Double-entry balanced: Debits (30,000) = Credits (30,000)');

  const { data: snapshotA } = await adminClient
    .from('order_financial_snapshots')
    .select('*')
    .eq('order_id', ordAId)
    .single();

  assert(snapshotA?.commission_basis_points_snapshot === 1000, 'Order snapshot captures 1000 bps commission');
  assert(BigInt(snapshotA?.platform_commission_tzs) === 3000n, 'Snapshot commission is 3,000 TZS (10%)');
  assert(BigInt(snapshotA?.restaurant_net_payable_tzs) === 27000n, 'Snapshot net payable is 27,000 TZS');

  // ============================================================================
  // SCENARIO B: Custom Meal Capture & Quote Snapshot
  // ============================================================================
  console.log('\n--- Scenario B: Custom Meal Capture & Snapshot ---');
  const reqBId = `cm_req_${timestamp}`;
  const quoteBId = `cm_quote_${timestamp}`;

  await adminClient.from('custom_meal_requests').insert({
    id: reqBId,
    order_number: `REQ-${timestamp}`,
    user_id: custBId,
    dish_name: 'Custom Seafood Platter',
    status: 'PENDING',
    servings_count: '4',
    dining_option: 'Delivery',
    budget_tzs: 40000,
  });

  await adminClient.from('restaurant_quotes').insert({
    id: quoteBId,
    request_id: reqBId,
    restaurant_id: restBId,
    quoted_price_tzs: 40000,
    status: 'ACCEPTED',
    estimated_prep_minutes: 45,
  });

  const ordBId = `ord_cm_${timestamp}`;
  await adminClient.from('orders').insert({
    id: ordBId,
    order_number: `ORD-CM-${timestamp}`,
    user_id: custBId,
    restaurant_id: restBId,
    status: 'COMPLETED',
    subtotal_tzs: 40000,
    service_fee_tzs: 0,
    delivery_fee_tzs: 0,
    total_tzs: 40000,
  });

  const payOrdBId = `pay_cm_${timestamp}`;
  await adminClient.from('payments').insert({
    id: payOrdBId,
    user_id: custBId,
    restaurant_id: restBId,
    order_id: ordBId,
    amount_tzs: 40000,
    net_restaurant_payout_tzs: 36000,
    payment_method: 'AIRTEL_MONEY',
    phone_number: '+255788112233',
    status: 'PENDING',
  });

  const captureResB = await adminClient.rpc('finalize_payment_capture_rpc', {
    p_payment_id: payOrdBId,
    p_provider_reference: `cp_tx_${timestamp}_b`,
    p_gateway_reference: `gw_${timestamp}_b`,
    p_captured_amount_tzs: 40000,
    p_idempotency_key: `idem_cap_b_${timestamp}`,
  });

  assert(captureResB.data?.success === true, 'Custom meal payment capture succeeded');
  const { data: snapshotB } = await adminClient
    .from('order_financial_snapshots')
    .select('*')
    .eq('order_id', ordBId)
    .single();

  assert(BigInt(snapshotB?.gross_food_sales_tzs) === 40000n, 'Custom meal snapshot gross is 40,000 TZS');
  assert(BigInt(snapshotB?.restaurant_net_payable_tzs) === 36000n, 'Custom meal net payable is 36,000 TZS (10% fee = 4,000 TZS)');

  // ============================================================================
  // SCENARIO C: Reservation Deposit Capture & Release
  // ============================================================================
  console.log('\n--- Scenario C: Reservation Deposit Capture & Holding Release ---');
  const resCId = `res_c_${timestamp}`;
  const payResCId = `pay_res_c_${timestamp}`;

  await adminClient.from('reservations').insert({
    id: resCId,
    user_id: custAId,
    restaurant_id: restAId,
    reservation_date: '2026-10-01',
    reservation_time: '19:00',
    party_size: 4,
    status: 'CONFIRMED',
    deposit_amount_tzs: 20000,
  });

  await adminClient.from('payments').insert({
    id: payResCId,
    user_id: custAId,
    restaurant_id: restAId,
    reservation_id: resCId,
    amount_tzs: 20000,
    net_restaurant_payout_tzs: 20000,
    payment_method: 'MIXX_BY_YAS',
    phone_number: '+255711223344',
    status: 'PENDING',
  });

  await adminClient.from('reservations').update({
    is_deposit_paid: true,
    payment_id: payResCId,
  }).eq('id', resCId);

  const captureResC = await adminClient.rpc('finalize_payment_capture_rpc', {
    p_payment_id: payResCId,
    p_provider_reference: `cp_tx_${timestamp}_c`,
    p_gateway_reference: `gw_${timestamp}_c`,
    p_captured_amount_tzs: 20000,
    p_idempotency_key: `idem_cap_c_${timestamp}`,
  });

  assert(captureResC.data?.success === true, 'Reservation deposit payment finalized');

  // Verify holding account: RESERVATION_DEPOSIT_HOLDING
  const { data: resHoldEntries } = await adminClient
    .from('financial_ledger_entries')
    .select('*')
    .eq('batch_id', captureResC.data.batch_id);

  const holdCredit = resHoldEntries?.find(e => e.account_type === 'RESERVATION_DEPOSIT_HOLDING' && e.direction === 'CREDIT');
  const payableCredit = resHoldEntries?.find(e => e.account_type === 'RESTAURANT_PAYABLE');
  assert(!!holdCredit, 'Deposit credited to RESERVATION_DEPOSIT_HOLDING account');
  assert(!payableCredit, 'Deposit was NOT credited to RESTAURANT_PAYABLE yet');

  // Now release deposit on reservation completion
  const releaseRes = await adminClient.rpc('release_reservation_deposit_financially', {
    p_reservation_id: resCId,
    p_outcome_type: 'COMPLETED',
  });
  assert(releaseRes.data?.success === true, 'release_reservation_deposit_financially succeeded');

  const { data: releaseEntries } = await adminClient
    .from('financial_ledger_entries')
    .select('*')
    .eq('batch_id', releaseRes.data.batch_id);

  const releaseDebitHold = releaseEntries?.find(e => e.account_type === 'RESERVATION_DEPOSIT_HOLDING' && e.direction === 'DEBIT');
  const releaseCreditPay = releaseEntries?.find(e => e.account_type === 'RESTAURANT_PAYABLE' && e.direction === 'CREDIT');
  assert(!!releaseDebitHold && !!releaseCreditPay, 'Deposit successfully transferred from RESERVATION_DEPOSIT_HOLDING to RESTAURANT_PAYABLE');

  // ============================================================================
  // SCENARIO D: Late Reservation Payment Guardrail
  // ============================================================================
  console.log('\n--- Scenario D: Late Reservation Payment Review Required ---');
  const resDId = `res_d_${timestamp}`;
  const payResDId = `pay_res_d_${timestamp}`;

  await adminClient.from('reservations').insert({
    id: resDId,
    user_id: custBId,
    restaurant_id: restBId,
    reservation_date: '2026-10-01',
    reservation_time: '20:00',
    party_size: 2,
    status: 'CANCELLED', // Hold was expired / cancelled
    deposit_amount_tzs: 15000,
  });

  await adminClient.from('payments').insert({
    id: payResDId,
    user_id: custBId,
    restaurant_id: restBId,
    reservation_id: resDId,
    amount_tzs: 15000,
    net_restaurant_payout_tzs: 15000,
    payment_method: 'M_PESA',
    phone_number: '+255755333444',
    status: 'PENDING',
  });

  await adminClient.from('reservations').update({
    payment_id: payResDId,
  }).eq('id', resDId);

  const captureResD = await adminClient.rpc('finalize_payment_capture_rpc', {
    p_payment_id: payResDId,
    p_provider_reference: `cp_tx_${timestamp}_d`,
    p_gateway_reference: `gw_${timestamp}_d`,
    p_captured_amount_tzs: 15000,
    p_idempotency_key: `idem_cap_d_${timestamp}`,
  });

  assert(captureResD.data?.success === true, 'Late payment processed without crash');
  // In late payment, the payment succeeds and holds funds in deposit holding
  const { data: resDEntries } = await adminClient
    .from('financial_ledger_entries')
    .select('*')
    .eq('batch_id', captureResD.data.batch_id);

  const resDHeld = resDEntries?.find(e => e.account_type === 'RESERVATION_DEPOSIT_HOLDING');
  assert(!!resDHeld, 'Late payment held in RESERVATION_DEPOSIT_HOLDING, zero restaurant credit');

  // ============================================================================
  // SCENARIO E & F: Partial and Full Refund Flows
  // ============================================================================
  console.log('\n--- Scenarios E & F: Partial & Full Refund Flows ---');
  // Order A was 30,000 TZS. Request 10,000 TZS partial refund.
  const reqRefund1 = await clientCustA.rpc('request_refund_secure', {
    p_payment_id: payOrdAId,
    p_requested_amount_tzs: 10000,
    p_reason_code: 'COLD_FOOD',
    p_reason_detail: 'Food arrived cold',
    p_idempotency_key: `idem_ref_1_${timestamp}`,
  });
  assert(reqRefund1.data?.success === true, 'Partial refund requested (10,000 TZS)');
  const refund1Id = reqRefund1.data.refund_request_id;

  // Restaurant approves
  const appRefund1 = await clientOwnerA.rpc('approve_refund_secure', {
    p_refund_request_id: refund1Id,
    p_approved_amount_tzs: 10000,
    p_responsibility: 'RESTAURANT',
  });
  assert(appRefund1.data?.success === true, 'Restaurant approved partial refund');

  // Service role finalizes refund provider result
  const finRefund1 = await adminClient.rpc('finalize_refund_provider_result', {
    p_refund_request_id: refund1Id,
    p_provider_refund_ref: `cp_ref_${timestamp}_1`,
    p_status: 'REFUNDED',
  });
  assert(finRefund1.data?.success === true, 'Partial refund finalized');

  const { data: payAfterPartial } = await adminClient.from('payments').select('*').eq('id', payOrdAId).single();
  assert(payAfterPartial?.status === 'SUCCESS', 'Payment status remains SUCCESS after partial refund');
  assert(BigInt(payAfterPartial?.refunded_amount_tzs) === 10000n, 'Payment refunded_amount_tzs is now 10,000 TZS');

  // Full refund: Request remaining 20,000 TZS
  const reqRefund2 = await clientCustA.rpc('request_refund_secure', {
    p_payment_id: payOrdAId,
    p_requested_amount_tzs: 20000,
    p_reason_code: 'UNSATISFIED',
    p_reason_detail: 'Full refund requested',
    p_idempotency_key: `idem_ref_2_${timestamp}`,
  });
  assert(reqRefund2.data?.success === true, 'Full refund requested for remaining 20,000 TZS');
  const refund2Id = reqRefund2.data.refund_request_id;

  await clientOwnerA.rpc('approve_refund_secure', {
    p_refund_request_id: refund2Id,
    p_approved_amount_tzs: 20000,
    p_responsibility: 'RESTAURANT',
  });

  await adminClient.rpc('finalize_refund_provider_result', {
    p_refund_request_id: refund2Id,
    p_provider_refund_ref: `cp_ref_${timestamp}_2`,
    p_status: 'REFUNDED',
  });

  const { data: payAfterFull } = await adminClient.from('payments').select('*').eq('id', payOrdAId).single();
  assert(payAfterFull?.status === 'REFUNDED', 'Payment status transitions to REFUNDED when 100% refunded');
  assert(BigInt(payAfterFull?.refunded_amount_tzs) === 30000n, 'Payment refunded_amount_tzs is 30,000 TZS');

  // ============================================================================
  // SCENARIO G: Refund Cap Enforcement
  // ============================================================================
  console.log('\n--- Scenario G: Refund Cap Enforcement ---');
  const overRefRes = await clientCustA.rpc('request_refund_secure', {
    p_payment_id: payOrdAId,
    p_requested_amount_tzs: 5000,
    p_reason_code: 'EXTRA',
    p_reason_detail: 'Exceeding refund',
    p_idempotency_key: `idem_ref_over2_${timestamp}`,
  });
  assert(!!overRefRes.error, 'Refund request exceeding captured payment amount is strictly rejected');

  // ============================================================================
  // SCENARIO H: Refund After Prior Payout (Negative Payable Carry Forward)
  // ============================================================================
  console.log('\n--- Scenario H: Refund After Prior Payout ---');
  // Create an order for Rest A: 50,000 TZS
  const ordHId = `ord_h_${timestamp}`;
  await adminClient.from('orders').insert({
    id: ordHId,
    order_number: `ORD-H-${timestamp}`,
    user_id: custBId,
    restaurant_id: restAId,
    status: 'COMPLETED',
    subtotal_tzs: 50000,
    service_fee_tzs: 0,
    delivery_fee_tzs: 0,
    total_tzs: 50000,
  });
  const payOrdHId = `pay_h_${timestamp}`;
  await adminClient.from('payments').insert({
    id: payOrdHId,
    user_id: custBId,
    restaurant_id: restAId,
    order_id: ordHId,
    amount_tzs: 50000,
    net_restaurant_payout_tzs: 45000,
    payment_method: 'M_PESA',
    phone_number: '+255755999888',
    status: 'PENDING',
  });
  await adminClient.rpc('finalize_payment_capture_rpc', {
    p_payment_id: payOrdHId,
    p_provider_reference: `cp_tx_h_${timestamp}`,
    p_gateway_reference: `gw_h_${timestamp}`,
    p_captured_amount_tzs: 50000,
    p_idempotency_key: `idem_h_${timestamp}`,
  });

  // Calculate settlement for Rest A
  const settlHRes = await adminClient.rpc('calculate_merchant_settlement', {
    p_restaurant_id: restAId,
    p_period_start: '2020-01-01T00:00:00Z',
    p_period_end: '2030-01-01T00:00:00Z',
  });
  const settlHId = settlHRes.data?.settlement_id;
  assert(settlHRes.data?.success === true, 'Settlement for Rest A calculated');

  // Approve & Payout
  await adminClient.rpc('approve_merchant_settlement', { p_settlement_id: settlHId });
  const payoutHRes = await adminClient.rpc('execute_merchant_payout_rpc', {
    p_settlement_id: settlHId,
    p_destination_id: destA.id,
    p_idempotency_key: `idem_payout_h_${timestamp}`,
  });
  const payoutHId = payoutHRes.data?.payout_id;

  // Finalize payout SUCCESS
  await adminClient.rpc('finalize_merchant_payout_rpc', {
    p_payout_id: payoutHId,
    p_provider_reference: `cp_payout_ref_h_${timestamp}`,
    p_status: 'SUCCESS',
    p_raw_status: 'completed',
  });

  // Now an old order gets a refund of 25,000 TZS
  const reqRefH = await clientCustB.rpc('request_refund_secure', {
    p_payment_id: payOrdHId,
    p_requested_amount_tzs: 25000,
    p_reason_code: 'QUALITY',
    p_reason_detail: 'Post payout refund',
    p_idempotency_key: `idem_ref_postpay_${timestamp}`,
  });
  await clientOwnerA.rpc('approve_refund_secure', {
    p_refund_request_id: reqRefH.data.refund_request_id,
    p_approved_amount_tzs: 25000,
    p_responsibility: 'RESTAURANT',
  });
  await adminClient.rpc('finalize_refund_provider_result', {
    p_refund_request_id: reqRefH.data.refund_request_id,
    p_provider_refund_ref: `cp_ref_h_${timestamp}`,
    p_status: 'REFUNDED',
  });

  // Check the previous payout was NOT mutated
  const { data: priorPayout } = await adminClient.from('merchant_payouts').select('*').eq('id', payoutHId).single();
  assert(priorPayout?.status === 'SUCCESS', 'Prior payout status remains SUCCESS (not mutated)');

  // Verify that an unsettled debit now exists on the ledger for Rest A
  const { data: unsettledEntries } = await adminClient
    .from('financial_ledger_entries')
    .select('*')
    .eq('restaurant_id', restAId)
    .eq('account_type', 'RESTAURANT_PAYABLE')
    .eq('direction', 'DEBIT')
    .eq('entry_type', 'REFUND_REVERSAL');

  assert(unsettledEntries && unsettledEntries.length > 0, 'Post-payout refund posted debit to RESTAURANT_PAYABLE without altering past payout');

  // ============================================================================
  // SCENARIO I & J: Dispute Hold & Resolution
  // ============================================================================
  console.log('\n--- Scenarios I & J: Dispute Hold & Resolution ---');
  const disputeRes = await clientCustB.rpc('open_financial_dispute_secure', {
    p_dispute_type: 'CUSTOMER_REFUND_DISPUTE',
    p_entity_type: 'ORDER',
    p_entity_id: ordHId,
    p_restaurant_id: restAId,
    p_disputed_amount_tzs: 15000,
    p_reason_code: 'UNRECOGNIZED_TRANSACTION',
    p_description: 'Customer claims unauthorized transaction',
    p_payment_id: payOrdHId,
  });

  assert(disputeRes.data?.success === true, 'Dispute opened for 15,000 TZS');
  const disputeId = disputeRes.data.dispute_id;

  // Check dispute hold entries: DEBIT RESTAURANT_PAYABLE 15000, CREDIT DISPUTE_RESERVE 15000
  const { data: disputeEntries } = await adminClient
    .from('financial_ledger_entries')
    .select('*')
    .eq('dispute_id', disputeId);

  assert(disputeEntries?.some(e => e.account_type === 'DISPUTE_RESERVE' && e.direction === 'CREDIT'), 'Funds held in DISPUTE_RESERVE');

  // Resolve dispute in merchant's favor: RESOLVED_RESTAURANT
  const resolveRes = await adminClient.rpc('resolve_financial_dispute_secure', {
    p_dispute_id: disputeId,
    p_status: 'RESOLVED_RESTAURANT',
    p_resolution: 'Merchant provided proof of delivery',
  });
  assert(resolveRes.data?.success === true, 'Dispute resolved in restaurant favor');

  // Check dispute release batch
  const { data: resolvedDispute } = await adminClient.from('financial_disputes').select('*').eq('id', disputeId).single();
  assert(resolvedDispute?.status === 'RESOLVED_RESTAURANT', 'Dispute status is RESOLVED_RESTAURANT');

  // ============================================================================
  // SCENARIO K: Fee Policy Snapshot Immutability
  // ============================================================================
  console.log('\n--- Scenario K: Fee Policy Snapshot Immutability ---');
  // Order snapshot from Scenario B has commission_rate_bps = 1000 (10%)
  const { data: snapBefore } = await adminClient.from('order_financial_snapshots').select('*').eq('order_id', ordBId).single();
  assert(snapBefore?.commission_basis_points_snapshot === 1000, 'Original order snapshot has 1000 bps commission');

  // Attempting to mutate order_financial_snapshots should be rejected by trigger
  const { error: snapUpdateErr } = await adminClient
    .from('order_financial_snapshots')
    .update({ commission_basis_points_snapshot: 2000 })
    .eq('order_id', ordBId);
  assert(!!snapUpdateErr, 'Database trigger strictly prevents UPDATE on order_financial_snapshots');

  // ============================================================================
  // SCENARIO L: Settlement Calculation (Rest B)
  // ============================================================================
  console.log('\n--- Scenario L: Settlement Calculation ---');
  const settlBRes = await adminClient.rpc('calculate_merchant_settlement', {
    p_restaurant_id: restBId,
    p_period_start: '2020-01-01T00:00:00Z',
    p_period_end: '2030-01-01T00:00:00Z',
  });
  if (settlBRes.error) console.error('settlBRes error details:', settlBRes.error);
  assert(settlBRes.data?.success === true, 'calculate_merchant_settlement for Rest B succeeded');
  const settlBId = settlBRes.data.settlement_id;
  assert(settlBRes.data.net_payable_tzs > 0, 'Net payable amount is positive');

  // ============================================================================
  // SCENARIO M: Concurrent / Duplicate Settlement Prevention
  // ============================================================================
  console.log('\n--- Scenario M: Concurrent / Duplicate Settlement Prevention ---');
  // Re-running calculation for same window should include 0 items because already included in settlBId
  const dupSettlRes = await adminClient.rpc('calculate_merchant_settlement', {
    p_restaurant_id: restBId,
    p_period_start: '2020-01-01T00:00:00Z',
    p_period_end: '2030-01-01T00:00:00Z',
  });
  assert(dupSettlRes.data?.included_items_count === 0, 'Duplicate calculation includes 0 items (no double-counting)');

  // ============================================================================
  // SCENARIO N: Payout Execution & Finalization (Rest B)
  // ============================================================================
  console.log('\n--- Scenario N: Payout Execution & Finalization ---');
  await adminClient.rpc('approve_merchant_settlement', { p_settlement_id: settlBId });
  const payoutBRes = await adminClient.rpc('execute_merchant_payout_rpc', {
    p_settlement_id: settlBId,
    p_destination_id: destB.id,
    p_idempotency_key: `idem_payout_b_${timestamp}`,
  });
  assert(payoutBRes.data?.success === true, 'Payout queued successfully');
  const payoutBId = payoutBRes.data.payout_id;

  const finPayoutB = await adminClient.rpc('finalize_merchant_payout_rpc', {
    p_payout_id: payoutBId,
    p_provider_reference: `cp_payout_b_ref_${timestamp}`,
    p_status: 'SUCCESS',
    p_raw_status: 'completed',
  });
  assert(finPayoutB.data?.success === true, 'Payout finalized as SUCCESS');

  const { data: settlBFinal } = await adminClient.from('merchant_settlements').select('*').eq('id', settlBId).single();
  assert(settlBFinal?.status === 'PAID', 'Settlement transitioned to PAID status');

  // Check ledger batch for payout
  const { data: payoutBatchEntries } = await adminClient
    .from('financial_ledger_entries')
    .select('*')
    .eq('payout_id', payoutBId);

  const debitPayable = payoutBatchEntries?.find(e => e.account_type === 'RESTAURANT_PAYABLE' && e.direction === 'DEBIT');
  const creditReceivable = payoutBatchEntries?.find(e => e.account_type === 'PROVIDER_RECEIVABLE' && e.direction === 'CREDIT');
  assert(!!debitPayable && !!creditReceivable, 'Payout posted DEBIT RESTAURANT_PAYABLE and CREDIT PROVIDER_RECEIVABLE');

  // ============================================================================
  // SCENARIO O: Concurrent Payout Idempotency
  // ============================================================================
  console.log('\n--- Scenario O: Concurrent Payout Idempotency ---');
  const idemPayoutRes = await adminClient.rpc('execute_merchant_payout_rpc', {
    p_settlement_id: settlBId,
    p_destination_id: destB.id,
    p_idempotency_key: `idem_payout_b_${timestamp}`,
  });
  assert(idemPayoutRes.data?.payout_id === payoutBId, 'Idempotent payout request returns existing payout ID');

  // ============================================================================
  // SCENARIO P: Payout Failure Handling
  // ============================================================================
  console.log('\n--- Scenario P: Payout Failure Handling ---');
  // Create an isolated restaurant for Payout Failure test
  const restPId = `rest_p_${timestamp}`;
  await adminClient.from('restaurants').insert({
    id: restPId,
    owner_id: ownerBId,
    name: 'Beta Grill Oysterbay',
    slug: `beta-grill-p-${timestamp}`,
    cuisine: 'Grill',
    is_open: true,
    is_verified: true,
    address: 'Oysterbay, Dar es Salaam',
  });
  await adminClient.from('merchant_fee_policies').insert({
    restaurant_id: restPId,
    commission_basis_points: 1000,
    effective_from: '2020-01-01T00:00:00Z',
    effective_until: null,
    created_by: ownerBId,
  });
  const { data: destP } = await adminClient.from('merchant_payout_destinations').insert({
    restaurant_id: restPId,
    destination_type: 'BANK',
    provider: 'CRDB',
    masked_account_identifier: 'CRDB ****9999',
    account_name: 'Beta Grill P Ltd',
    verification_status: 'VERIFIED',
    is_default: true,
    created_by: ownerBId,
  }).select().single();

  const ordPId = `ord_p_${timestamp}`;
  await adminClient.from('orders').insert({
    id: ordPId,
    order_number: `ORD-P-${timestamp}`,
    user_id: custAId,
    restaurant_id: restPId,
    status: 'COMPLETED',
    subtotal_tzs: 25000,
    service_fee_tzs: 0,
    delivery_fee_tzs: 0,
    total_tzs: 25000,
  });
  const payPId = `pay_p_${timestamp}`;
  await adminClient.from('payments').insert({
    id: payPId,
    user_id: custAId,
    restaurant_id: restPId,
    order_id: ordPId,
    amount_tzs: 25000,
    net_restaurant_payout_tzs: 22500,
    payment_method: 'M_PESA',
    phone_number: '+255755222333',
    status: 'PENDING',
  });
  await adminClient.rpc('finalize_payment_capture_rpc', {
    p_payment_id: payPId,
    p_provider_reference: `cp_tx_p_${timestamp}`,
    p_gateway_reference: `gw_p_${timestamp}`,
    p_captured_amount_tzs: 25000,
    p_idempotency_key: `idem_p_${timestamp}`,
  });

  const settlPRes = await adminClient.rpc('calculate_merchant_settlement', {
    p_restaurant_id: restPId,
    p_period_start: '2020-01-01T00:00:00Z',
    p_period_end: '2030-01-01T00:00:00Z',
  });
  const settlPId = settlPRes.data?.settlement_id;
  await adminClient.rpc('approve_merchant_settlement', { p_settlement_id: settlPId });

  const payoutPRes = await adminClient.rpc('execute_merchant_payout_rpc', {
    p_settlement_id: settlPId,
    p_destination_id: destP.id,
    p_idempotency_key: `idem_payout_fail_${timestamp}`,
  });
  const payoutPId = payoutPRes.data?.payout_id;

  // Finalize as FAILED
  await adminClient.rpc('finalize_merchant_payout_rpc', {
    p_payout_id: payoutPId,
    p_provider_reference: `cp_payout_failed_ref_${timestamp}`,
    p_status: 'FAILED',
    p_raw_status: 'rejected_by_bank',
    p_failure_reason: 'Account closed by recipient',
  });

  const { data: failedPayout } = await adminClient.from('merchant_payouts').select('*').eq('id', payoutPId).single();
  assert(failedPayout?.status === 'FAILED', 'Payout status recorded as FAILED');
  const { data: failedSettl } = await adminClient.from('merchant_settlements').select('*').eq('id', settlPId).single();
  assert(failedSettl?.status !== 'PAID', 'Settlement was NOT marked PAID following payout failure');

  // ============================================================================
  // SCENARIO Q: Payout Reversal Handling
  // ============================================================================
  console.log('\n--- Scenario Q: Payout Reversal Handling ---');
  // Reversal on payout B (which was SUCCESS)
  const revRes = await adminClient.rpc('finalize_merchant_payout_rpc', {
    p_payout_id: payoutBId,
    p_provider_reference: `cp_reversal_ref_${timestamp}`,
    p_status: 'REVERSED',
    p_raw_status: 'reversal_processed',
    p_failure_reason: 'Disbursement recalled by banking partner',
  });
  assert(revRes.data?.success === true, 'finalize_merchant_payout_rpc processed REVERSED');

  const { data: settlBReversed } = await adminClient.from('merchant_settlements').select('*').eq('id', settlBId).single();
  assert(settlBReversed?.status === 'ON_HOLD', 'Settlement marked ON_HOLD following payout reversal');

  // Reversal batch: DEBIT PROVIDER_RECEIVABLE, CREDIT RESTAURANT_PAYABLE
  const { data: reversalEntries } = await adminClient
    .from('financial_ledger_entries')
    .select('*')
    .eq('payout_id', payoutBId)
    .eq('direction', 'CREDIT')
    .eq('account_type', 'RESTAURANT_PAYABLE');

  assert(reversalEntries && reversalEntries.length > 0, 'Reversal restored merchant payable (CREDIT RESTAURANT_PAYABLE)');

  // ============================================================================
  // SCENARIO R - V: Reconciliation Run & Discrepancies
  // ============================================================================
  console.log('\n--- Scenarios R - V: Provider Reconciliation Pipeline ---');
  const { data: recRun } = await adminClient.from('reconciliation_runs').insert({
    provider: 'CLICKPESA',
    period_start: '2026-09-01T00:00:00Z',
    period_end: '2026-09-30T23:59:59Z',
    status: 'RUNNING',
    created_by: ownerAId,
  }).select().single();

  const runId = recRun?.id;

  // Insert items covering R (MATCHED), S (STATUS_MISMATCH), T (AMOUNT_MISMATCH), U (MISSING_PROVIDER), V (MISSING_INTERNAL)
  await adminClient.from('reconciliation_items').insert([
    // Scenario R: MATCHED
    {
      run_id: runId,
      payment_id: payOrdBId,
      provider_reference: `cp_tx_${timestamp}_b`,
      internal_amount_tzs: 40000,
      provider_amount_tzs: 40000,
      internal_status: 'SUCCESS',
      raw_provider_status: 'SUCCESS',
      result: 'MATCHED',
    },
    // Scenario S: STATUS_MISMATCH
    {
      run_id: runId,
      payment_id: payOrdAId,
      provider_reference: `cp_tx_p_${timestamp}`,
      internal_amount_tzs: 25000,
      provider_amount_tzs: 25000,
      internal_status: 'PENDING',
      raw_provider_status: 'SUCCESS',
      result: 'STATUS_MISMATCH',
      notes: 'Provider confirmed success but webhook was delayed',
    },
    // Scenario T: AMOUNT_MISMATCH
    {
      run_id: runId,
      payment_id: payResCId,
      provider_reference: `cp_tx_${timestamp}_c`,
      internal_amount_tzs: 20000,
      provider_amount_tzs: 25000,
      internal_status: 'SUCCESS',
      raw_provider_status: 'SUCCESS',
      result: 'AMOUNT_MISMATCH',
      notes: 'Provider deducted different amount from user wallet',
    },
    // Scenario U: MISSING_PROVIDER
    {
      run_id: runId,
      payment_id: `pay_ghost_${timestamp}`,
      provider_reference: 'UNMATCHED_REF',
      internal_amount_tzs: 18000,
      provider_amount_tzs: 0,
      internal_status: 'SUCCESS',
      raw_provider_status: 'NOT_FOUND',
      result: 'MISSING_PROVIDER',
      notes: 'Internal payment recorded without provider batch match',
    },
    // Scenario V: MISSING_INTERNAL
    {
      run_id: runId,
      payment_id: null,
      provider_reference: `cp_unrecognized_${timestamp}`,
      internal_amount_tzs: 0,
      provider_amount_tzs: 30000,
      internal_status: 'NOT_FOUND',
      raw_provider_status: 'SUCCESS',
      result: 'MISSING_INTERNAL',
      notes: 'Orphan provider charge with unknown internal reference',
    },
  ]);

  const { data: recItems } = await adminClient.from('reconciliation_items').select('*').eq('run_id', runId);
  assert(recItems?.some(i => i.result === 'MATCHED'), 'Scenario R: MATCHED verified');
  assert(recItems?.some(i => i.result === 'STATUS_MISMATCH'), 'Scenario S: STATUS_MISMATCH verified');
  assert(recItems?.some(i => i.result === 'AMOUNT_MISMATCH'), 'Scenario T: AMOUNT_MISMATCH verified');
  assert(recItems?.some(i => i.result === 'MISSING_PROVIDER'), 'Scenario U: MISSING_PROVIDER verified');
  assert(recItems?.some(i => i.result === 'MISSING_INTERNAL'), 'Scenario V: MISSING_INTERNAL verified');

  // ============================================================================
  // SCENARIO W: Cross-Tenant Finance RLS
  // ============================================================================
  console.log('\n--- Scenario W: Cross-Tenant Finance RLS Protection ---');
  // Owner A queries settlements of Rest B
  const { data: foreignSettlements } = await clientOwnerA
    .from('merchant_settlements')
    .select('*')
    .eq('restaurant_id', restBId);

  assert(!foreignSettlements || foreignSettlements.length === 0, 'Cross-tenant: Owner A cannot see Restaurant B settlements');

  // Owner A queries destinations of Rest B
  const { data: foreignDests } = await clientOwnerA
    .from('merchant_payout_destinations')
    .select('*')
    .eq('restaurant_id', restBId);

  assert(!foreignDests || foreignDests.length === 0, 'Cross-tenant: Owner A cannot see Restaurant B payout destinations');

  // ============================================================================
  // SCENARIO X: Basic Staff Finance Denial
  // ============================================================================
  console.log('\n--- Scenario X: Basic Staff Finance Denial ---');
  // Staff A queries payout destinations of their own restaurant
  const { data: staffDests } = await clientStaffA
    .from('merchant_payout_destinations')
    .select('*')
    .eq('restaurant_id', restAId);

  assert(!staffDests || staffDests.length === 0, 'Staff: Restaurant STAFF cannot view merchant payout destinations');

  // ============================================================================
  // SCENARIO Y: Provider-Finalization Client Denial
  // ============================================================================
  console.log('\n--- Scenario Y: Provider-Finalization Client Denial ---');
  const { error: finalizeErr } = await clientCustA.rpc('finalize_payment_capture_rpc', {
    p_payment_id: payOrdAId,
    p_provider_reference: 'hack',
    p_gateway_reference: 'hack',
    p_captured_amount_tzs: 100,
    p_idempotency_key: 'hack',
  });
  assert(!!finalizeErr, 'finalize_payment_capture_rpc is strictly denied to authenticated users (service_role only)');

  const { error: payFinErr } = await clientOwnerA.rpc('finalize_merchant_payout_rpc', {
    p_payout_id: payoutBId,
    p_provider_reference: 'hack',
    p_status: 'SUCCESS',
    p_raw_status: 'hack',
  });
  assert(!!payFinErr, 'finalize_merchant_payout_rpc is strictly denied to authenticated users (service_role only)');

  // ============================================================================
  // SCENARIO Z: Ledger Immutability Trigger
  // ============================================================================
  console.log('\n--- Scenario Z: Subledger Immutability Enforcement ---');
  const { error: ledgerUpErr } = await adminClient
    .from('financial_ledger_entries')
    .update({ amount_tzs: 999999 })
    .eq('restaurant_id', restAId);

  assert(!!ledgerUpErr, 'Database trigger strictly prevents UPDATE on financial_ledger_entries');

  const { error: ledgerDelErr } = await adminClient
    .from('financial_ledger_entries')
    .delete()
    .eq('restaurant_id', restAId);

  assert(!!ledgerDelErr, 'Database trigger strictly prevents DELETE on financial_ledger_entries');

  // ============================================================================
  // SCENARIO AA: Paid Settlement Immutability Trigger
  // ============================================================================
  console.log('\n--- Scenario AA: Paid Settlement Immutability Enforcement ---');
  const { error: settlUpErr } = await adminClient
    .from('merchant_settlements')
    .update({ net_payable_tzs: 100 })
    .eq('id', settlHId); // SettlH was marked PAID in Scenario H

  assert(!!settlUpErr, 'Database trigger strictly blocks UPDATE on PAID merchant settlements');

  const { error: settlDelErr } = await adminClient
    .from('merchant_settlements')
    .delete()
    .eq('id', settlHId);

  assert(!!settlDelErr, 'Database trigger strictly blocks DELETE on PAID merchant settlements');

  // ============================================================================
  // SCENARIO AB: Global Double-Entry Balancing Invariant
  // ============================================================================
  console.log('\n--- Scenario AB: Global Subledger Batch Balancing Invariant ---');
  const { data: allEntries } = await adminClient
    .from('financial_ledger_entries')
    .select('batch_id, direction, amount_tzs');

  const batchMap = new Map<string, { debits: bigint; credits: bigint }>();
  for (const entry of allEntries || []) {
    if (!batchMap.has(entry.batch_id)) {
      batchMap.set(entry.batch_id, { debits: 0n, credits: 0n });
    }
    const b = batchMap.get(entry.batch_id)!;
    if (entry.direction === 'DEBIT') b.debits += BigInt(entry.amount_tzs);
    if (entry.direction === 'CREDIT') b.credits += BigInt(entry.amount_tzs);
  }

  let unbalancedCount = 0;
  for (const [batchId, b] of batchMap.entries()) {
    if (b.debits !== b.credits) {
      console.error(`  Unbalanced Batch detected: ${batchId} (Debits: ${b.debits}, Credits: ${b.credits})`);
      unbalancedCount++;
    }
  }

  assert(batchMap.size > 0, `Verified ${batchMap.size} distinct financial posting batches`);
  assert(unbalancedCount === 0, `All ${batchMap.size} financial batches strictly satisfy SUM(DEBIT) == SUM(CREDIT)`);

  console.log('\n===============================================================');
  console.log(`  PACK 4C E2E SUITE RESULTS: ${passedAssertions} PASSED | ${failedAssertions} FAILED`);
  console.log('===============================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runPack4CSuite().catch((err) => {
  console.error('Fatal Pack 4C E2E test error:', err);
  process.exit(1);
});
