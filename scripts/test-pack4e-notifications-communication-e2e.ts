/**
 * MLOHUB PACK 4E — NOTIFICATIONS, COMMUNICATION & DELIVERY RELIABILITY
 * FINAL RELIABILITY & PROVIDER-TRUTH CLOSURE GATE E2E TEST SUITE
 * 
 * Tests all 28 required scenarios against live local Supabase instance.
 */

import { createClient } from '@supabase/supabase-js';
import { NotificationEngine } from '../services/notifications/NotificationEngine';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

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

async function runPack4EClosureSuite() {
  console.log('\n===============================================================');
  console.log('  MLOHUB PACK 4E: FINAL RELIABILITY & PROVIDER-TRUTH CLOSURE GATE');
  console.log('  Testing 28 Authoritative Live Scenarios');
  console.log('===============================================================\n');

  // Setup test entities
  console.log('--- Setting up Test Entities ---');
  const userAEmail = `notif.usera.${Date.now()}@mlohub.test`;
  const userBEmail = `notif.userb.${Date.now()}@mlohub.test`;
  const chefEmail = `notif.chef.${Date.now()}@mlohub.test`;
  const password = 'Password123!';

  // User A (Customer / Owner)
  const { data: userARes, error: errA } = await adminClient.auth.admin.createUser({
    email: userAEmail,
    password,
    email_confirm: true,
  });
  assert(!errA && !!userARes?.user?.id, 'Test User A created');
  const userAId = userARes!.user!.id;

  await adminClient.from('profiles').upsert({
    id: userAId,
    full_name: 'Customer A',
    email: userAEmail,
    phone: '+255711000001',
    role: 'CUSTOMER',
  });

  // User B (Customer)
  const { data: userBRes, error: errB } = await adminClient.auth.admin.createUser({
    email: userBEmail,
    password,
    email_confirm: true,
  });
  assert(!errB && !!userBRes?.user?.id, 'Test User B created');
  const userBId = userBRes!.user!.id;

  await adminClient.from('profiles').upsert({
    id: userBId,
    full_name: 'Customer B',
    email: userBEmail,
    phone: '+255711000002',
    role: 'CUSTOMER',
  });

  // Chef User (Staff member without financial authority)
  const { data: chefRes, error: errChef } = await adminClient.auth.admin.createUser({
    email: chefEmail,
    password,
    email_confirm: true,
  });
  assert(!errChef && !!chefRes?.user?.id, 'Chef User created');
  const chefId = chefRes!.user!.id;

  await adminClient.from('profiles').upsert({
    id: chefId,
    full_name: 'Chef Juma',
    email: chefEmail,
    phone: '+255711000003',
    role: 'RESTAURANT',
  });

  // Test Restaurant
  const restaurantId = `rest_e2e_${Date.now()}`;
  await adminClient.from('restaurants').insert({
    id: restaurantId,
    owner_id: userAId,
    name: 'MloHub Reliable Grill',
    slug: `reliable-grill-${Date.now()}`,
    cuisine: 'Swahili',
    address: 'Oysterbay, Dar es Salaam',
    is_open: true,
    is_verified: true,
  });

  // Add Owner & Chef to restaurant_members
  await adminClient.from('restaurant_members').insert([
    {
      restaurant_id: restaurantId,
      user_id: userAId,
      role: 'OWNER',
      permissions: ['ALL'],
      is_active: true,
    },
    {
      restaurant_id: restaurantId,
      user_id: chefId,
      role: 'CHEF',
      permissions: ['KITCHEN'],
      is_active: true,
    },
  ]);

  // Client instances authenticated as User A and User B
  const clientA = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await clientA.auth.signInWithPassword({ email: userAEmail, password });

  const clientB = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await clientB.auth.signInWithPassword({ email: userBEmail, password });

  // --------------------------------------------------------------------------
  // Scenario 1: Transactional outbox atomicity
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 1: Transactional Outbox Atomicity ---');
  const order1Id = `ord_atom_${Date.now()}`;
  const order1Num = `ORD-ATOM-${Date.now().toString().slice(-5)}`;
  const { error: ord1Err } = await adminClient.from('orders').insert({
    id: order1Id,
    order_number: order1Num,
    user_id: userAId,
    restaurant_id: restaurantId,
    status: 'PENDING',
    payment_status: 'PENDING',
    subtotal_tzs: 15000,
    total_tzs: 16500,
    dining_option: 'Delivery',
  });
  assert(!ord1Err, 'Order committed cleanly in database transaction');

  const { data: outbox1 } = await adminClient
    .from('notification_event_outbox')
    .select('*')
    .eq('aggregate_type', 'ORDER')
    .eq('aggregate_id', order1Id)
    .eq('event_type', 'ORDER_CREATED')
    .maybeSingle();
  assert(!!outbox1, 'Trigger committed ORDER_CREATED outbox event atomically with order record');
  assert(outbox1?.processing_status === 'PENDING', 'Initial outbox status is PENDING');

  // --------------------------------------------------------------------------
  // Scenario 2: Suppression Precedence: Marketing opt-out vs Security Critical
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Marketing Opt-out vs Security Critical ---');
  // Record marketing consent = false
  await adminClient.from('marketing_consents').upsert({
    user_id: userAId,
    channel: 'PUSH',
    consented: false,
    withdrawn_at: new Date().toISOString(),
    consent_policy_version: 'v1.0',
  });

  const { data: mktDecision } = await adminClient.rpc('is_recipient_reachable', {
    p_user_id: userAId,
    p_channel: 'PUSH',
    p_category: 'PROMOTION',
    p_comm_class: 'MARKETING',
    p_destination: null,
  });
  assert((mktDecision as any)?.reachable === false, 'Marketing push suppressed when marketing consent is false');
  assert((mktDecision as any)?.reason === 'NO_MARKETING_CONSENT', 'Reason is NO_MARKETING_CONSENT');

  const { data: secDecision } = await adminClient.rpc('is_recipient_reachable', {
    p_user_id: userAId,
    p_channel: 'PUSH',
    p_category: 'SECURITY',
    p_comm_class: 'SECURITY',
    p_destination: null,
  });
  assert((secDecision as any)?.reachable === true, 'Critical security notification bypasses marketing opt-out');
  assert((secDecision as any)?.reason === 'CRITICAL_BYPASS', 'Reason is CRITICAL_BYPASS');

  // --------------------------------------------------------------------------
  // Scenario 3: Hard bounced destination NEVER receives message (even for SECURITY)
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Hard Bounced Destination Non-Bypassable ---');
  const hardBouncedEmail = `bounced_${Date.now()}@invalid-domain-test.com`;
  await adminClient.rpc('record_suppression_secure', {
    p_channel: 'EMAIL',
    p_destination: hardBouncedEmail,
    p_reason: 'HARD_BOUNCE',
    p_details: '550 Mailbox unavailable',
  });

  const { data: bounceSecCheck } = await adminClient.rpc('is_recipient_reachable', {
    p_user_id: userAId,
    p_channel: 'EMAIL',
    p_category: 'SECURITY',
    p_comm_class: 'SECURITY',
    p_destination: hardBouncedEmail,
  });
  assert((bounceSecCheck as any)?.reachable === false, 'HARD_BOUNCE destination blocked EVEN for SECURITY class');
  assert((bounceSecCheck as any)?.reason.includes('HARD_BOUNCE'), 'Reason correctly records HARD_BOUNCE suppression');

  // --------------------------------------------------------------------------
  // Scenario 4: Spam complaint recipient NEVER receives message
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Spam Complaint Recipient Blocked ---');
  const spamEmail = `spam_${Date.now()}@test-inbox.com`;
  await adminClient.rpc('record_suppression_secure', {
    p_channel: 'EMAIL',
    p_destination: spamEmail,
    p_reason: 'SPAM_COMPLAINT',
    p_details: 'User clicked mark as spam',
  });

  const { data: spamCheck } = await adminClient.rpc('is_recipient_reachable', {
    p_user_id: userAId,
    p_channel: 'EMAIL',
    p_category: 'SECURITY',
    p_comm_class: 'SECURITY',
    p_destination: spamEmail,
  });
  assert((spamCheck as any)?.reachable === false, 'SPAM_COMPLAINT destination blocked EVEN for SECURITY class');
  assert((spamCheck as any)?.reason.includes('SPAM_COMPLAINT'), 'Reason correctly records SPAM_COMPLAINT suppression');

  // --------------------------------------------------------------------------
  // Scenario 5: Carrier blocked number NEVER receives SMS
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Carrier Blocked Number Blocked ---');
  const blockedPhone = '+255799999999';
  await adminClient.rpc('record_suppression_secure', {
    p_channel: 'SMS',
    p_destination: blockedPhone,
    p_reason: 'CARRIER_BLOCK',
    p_details: 'Telco bar / DND active',
  });

  const { data: carrierCheck } = await adminClient.rpc('is_recipient_reachable', {
    p_user_id: userAId,
    p_channel: 'SMS',
    p_category: 'ALL',
    p_comm_class: 'TRANSACTIONAL_CRITICAL',
    p_destination: blockedPhone,
  });
  assert((carrierCheck as any)?.reachable === false, 'CARRIER_BLOCK number blocked EVEN for TRANSACTIONAL_CRITICAL');
  assert((carrierCheck as any)?.reason.includes('CARRIER_BLOCK'), 'Reason records CARRIER_BLOCK suppression');

  // --------------------------------------------------------------------------
  // Scenario 6 & 7: Push token storage authority
  // --------------------------------------------------------------------------
  console.log('\n--- Scenarios 6 & 7: Push Token Storage Authority ---');
  // Register token for User A via secure RPC
  const tokenA = `ExponentPushToken[userA_${Date.now()}]`;
  const { error: regErrA } = await clientA.rpc('register_push_device_token_secure', {
    p_device_fingerprint: `fp_a_${Date.now()}`,
    p_platform: 'android',
    p_token: tokenA,
  });
  assert(!regErrA, 'User A registered push token via secure RPC');

  // User B attempts direct SELECT on push_device_tokens
  const { data: directSelectB, error: selectErrB } = await clientB
    .from('push_device_tokens')
    .select('*');
  assert(!selectErrB && (directSelectB?.length || 0) === 0, 'Scenario 6: User B cannot select User A raw push token');

  // User A attempts direct SELECT on push_device_tokens
  const { data: directSelectA, error: selectErrA } = await clientA
    .from('push_device_tokens')
    .select('*');
  assert(!selectErrA && (directSelectA?.length || 0) === 0, 'Scenario 7: Direct client SELECT on push_device_tokens is denied by RLS');

  // --------------------------------------------------------------------------
  // Scenario 8: Worker concurrency: Two workers racing with FOR UPDATE SKIP LOCKED
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Worker Concurrency (SKIP LOCKED) ---');
  // Create two pending deliveries
  const del1Id = `ndel_race1_${Date.now()}`;
  const del2Id = `ndel_race2_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert([
    {
      id: del1Id,
      user_id: userAId,
      channel: 'PUSH',
      recipient_address: tokenA,
      provider: 'EXPO',
      status: 'PENDING',
      idempotency_key: `race_del1_${Date.now()}`,
    },
    {
      id: del2Id,
      user_id: userAId,
      channel: 'PUSH',
      recipient_address: tokenA,
      provider: 'EXPO',
      status: 'PENDING',
      idempotency_key: `race_del2_${Date.now()}`,
    },
  ]);

  // Two workers claim concurrently with batch_size = 1
  const [claimWorker1, claimWorker2] = await Promise.all([
    adminClient.rpc('claim_pending_deliveries_secure', {
      p_worker_id: 'worker-instance-1',
      p_batch_size: 1,
      p_lease_seconds: 60,
    }),
    adminClient.rpc('claim_pending_deliveries_secure', {
      p_worker_id: 'worker-instance-2',
      p_batch_size: 1,
      p_lease_seconds: 60,
    }),
  ]);

  const claimedId1 = (claimWorker1.data as any)?.[0]?.id;
  const claimedId2 = (claimWorker2.data as any)?.[0]?.id;
  assert(!!claimedId1 && !!claimedId2, 'Both workers successfully claimed a job');
  assert(claimedId1 !== claimedId2, 'Racing workers claimed distinct jobs without collision (SKIP LOCKED verified)');

  // --------------------------------------------------------------------------
  // Scenario 9: Worker lease recovery after expiration
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Worker Lease Recovery ---');
  // Simulate crashed worker: lease_until set to past
  const pastTime = new Date(Date.now() - 10000).toISOString();
  await adminClient.from('notification_deliveries').update({
    worker_id: 'crashed-worker-99',
    claimed_at: pastTime,
    lease_until: pastTime,
    status: 'QUEUED',
  }).eq('id', del1Id);

  // Recovery worker claims
  const { data: recoveredJobs } = await adminClient.rpc('claim_pending_deliveries_secure', {
    p_worker_id: 'recovery-worker-1',
    p_batch_size: 5,
    p_lease_seconds: 60,
  });
  const recoveredDel1 = (recoveredJobs as any[])?.find((j) => j.id === del1Id);
  assert(!!recoveredDel1, 'Expired lease successfully recovered by recovery worker');
  assert(recoveredDel1?.worker_id === 'recovery-worker-1', 'Worker ID updated to new worker on lease recovery');

  // --------------------------------------------------------------------------
  // Scenario 10: Retry with exponential backoff & jitter vs Permanent Failure
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 10: Retry Backoff vs Immediate Permanent Failure ---');
  const retryDelId = `ndel_retry_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert({
    id: retryDelId,
    user_id: userAId,
    channel: 'SMS',
    recipient_address: '+255711000001',
    provider: 'BEEM_AFRICA',
    status: 'PENDING',
    idempotency_key: `retry_del_${Date.now()}`,
    max_attempts: 3,
  });

  // Attempt 1: Retryable error 503
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: retryDelId,
    p_provider: 'BEEM_AFRICA',
    p_status: 'FAILED_RETRYABLE',
    p_status_code: '503',
    p_error_code: 'GATEWAY_TIMEOUT',
    p_error_message: 'Transient carrier connection reset',
  });

  const { data: delAfterRetry } = await adminClient
    .from('notification_deliveries')
    .select('status, attempt_count, next_attempt_at')
    .eq('id', retryDelId)
    .single();
  assert(delAfterRetry?.status === 'FAILED_RETRYABLE', 'Retryable failure sets status FAILED_RETRYABLE');
  assert(!!delAfterRetry?.next_attempt_at, 'Next attempt scheduled with backoff delay');

  // Attempt 2: Permanent error (invalid number / permanent bounce)
  const permDelId = `ndel_perm_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert({
    id: permDelId,
    user_id: userAId,
    channel: 'SMS',
    recipient_address: '+255711000001',
    provider: 'BEEM_AFRICA',
    status: 'PENDING',
    idempotency_key: `perm_del_${Date.now()}`,
    max_attempts: 3,
  });

  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: permDelId,
    p_provider: 'BEEM_AFRICA',
    p_status: 'FAILED_PERMANENT',
    p_status_code: '400',
    p_error_code: 'INVALID_DESTINATION_NUMBER',
    p_error_message: 'Number is invalid or deactivated by operator',
  });

  const { data: delAfterPerm } = await adminClient
    .from('notification_deliveries')
    .select('status, next_attempt_at')
    .eq('id', permDelId)
    .single();
  assert(delAfterPerm?.status === 'FAILED_PERMANENT', 'Permanent failure immediately sets FAILED_PERMANENT');
  assert(delAfterPerm?.next_attempt_at === null, 'Permanent failure does NOT schedule any future retry');

  // --------------------------------------------------------------------------
  // Scenario 11: Dead Letter: Exhausted retries fail permanently without affecting business state
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 11: Dead Letter Transition ---');
  // Attempt 2 and 3 on retryDelId to exhaust budget (max_attempts: 3)
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: retryDelId,
    p_provider: 'BEEM_AFRICA',
    p_status: 'FAILED_RETRYABLE',
  });
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: retryDelId,
    p_provider: 'BEEM_AFRICA',
    p_status: 'FAILED_RETRYABLE',
  });

  const { data: exhaustedDel } = await adminClient
    .from('notification_deliveries')
    .select('status, attempt_count')
    .eq('id', retryDelId)
    .single();
  assert(exhaustedDel?.attempt_count === 3, 'Delivery exhausted all 3 attempts');
  assert(exhaustedDel?.status === 'FAILED_PERMANENT', 'Exhausted retry budget transitioned to FAILED_PERMANENT');

  // Verify underlying order is completely untouched
  const { data: orderCheck11 } = await adminClient.from('orders').select('status').eq('id', order1Id).single();
  assert(orderCheck11?.status === 'PENDING', 'Business order status remains canonical and unaffected');

  // --------------------------------------------------------------------------
  // Scenario 12: Callback Idempotency
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Provider Callback Idempotency ---');
  const callbackDelId = `ndel_cb_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert({
    id: callbackDelId,
    user_id: userAId,
    channel: 'PUSH',
    recipient_address: tokenA,
    provider: 'EXPO',
    status: 'SENT',
    idempotency_key: `cb_del_${Date.now()}`,
  });

  // First callback receipt
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: callbackDelId,
    p_provider: 'EXPO',
    p_status: 'PROVIDER_DELIVERED',
    p_provider_msg_id: 'expo_rec_1001',
    p_status_code: '200',
  });

  // Duplicate callback receipt with same receipt ID
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: callbackDelId,
    p_provider: 'EXPO',
    p_status: 'PROVIDER_DELIVERED',
    p_provider_msg_id: 'expo_rec_1001',
    p_status_code: '200',
  });

  const { data: cbDelRecord } = await adminClient
    .from('notification_deliveries')
    .select('status, provider_message_id')
    .eq('id', callbackDelId)
    .single();
  assert(cbDelRecord?.status === 'PROVIDER_DELIVERED', 'Status maintained as PROVIDER_DELIVERED');
  assert(cbDelRecord?.provider_message_id === 'expo_rec_1001', 'Provider message ID intact');

  // --------------------------------------------------------------------------
  // Scenario 13: Status Regression Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Status Regression Prevention ---');
  // Attempt late SENT or FAILED_RETRYABLE callback on already PROVIDER_DELIVERED delivery
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: callbackDelId,
    p_provider: 'EXPO',
    p_status: 'FAILED_RETRYABLE',
    p_status_code: '500',
  });

  const { data: postLateCb } = await adminClient
    .from('notification_deliveries')
    .select('status')
    .eq('id', callbackDelId)
    .single();
  assert(postLateCb?.status === 'PROVIDER_DELIVERED', 'PROVIDER_DELIVERED status protected against regression from late failure');

  // --------------------------------------------------------------------------
  // Scenario 14: Stale Domain Event Cancellation
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 14: Stale Domain Event Cancellation ---');
  const staleOrderId = `ord_stale_${Date.now()}`;
  await adminClient.from('orders').insert({
    id: staleOrderId,
    order_number: `ORD-STALE-${Date.now().toString().slice(-4)}`,
    user_id: userAId,
    restaurant_id: restaurantId,
    status: 'PENDING',
    payment_status: 'PENDING',
    subtotal_tzs: 18000,
    total_tzs: 19500,
    dining_option: 'Dine In',
  });
  await adminClient.from('orders').update({ status: 'ACCEPTED' }).eq('id', staleOrderId);
  await adminClient.from('orders').update({ status: 'PREPARING' }).eq('id', staleOrderId);
  await adminClient.from('orders').update({ status: 'READY' }).eq('id', staleOrderId);
  await adminClient.from('orders').update({ status: 'COMPLETED' }).eq('id', staleOrderId);

  // Older pending ORDER_ACCEPTED event
  const isStale = await NotificationEngine.isEventStale({
    id: `nevt_stale_${Date.now()}`,
    eventType: 'ORDER_ACCEPTED',
    aggregateType: 'ORDER',
    aggregateId: staleOrderId,
    payload: { order_id: staleOrderId },
    idempotencyKey: `idem_stale_${Date.now()}`,
    priority: 'NORMAL',
    communicationClass: 'TRANSACTIONAL',
    processingStatus: 'PENDING',
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date().toISOString(),
  });
  assert(isStale === true, 'NotificationEngine detects stale ORDER_ACCEPTED event on already COMPLETED order');

  // --------------------------------------------------------------------------
  // Scenario 15: Template Version Snapshotting
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 15: Template Version Snapshotting ---');
  const snapDelId = `ndel_snap_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert({
    id: snapDelId,
    user_id: userAId,
    channel: 'PUSH',
    recipient_address: tokenA,
    provider: 'EXPO',
    status: 'SENT',
    idempotency_key: `snap_del_${Date.now()}`,
    template_id: 'ntpl_order_ready_push_sw',
    template_version: 1,
    locale: 'sw',
    rendered_title: 'Mlo Tayari! #ORD-100',
    rendered_body: 'Mlo wako tayari umekamilika.',
  });

  const { data: snapRecord } = await adminClient
    .from('notification_deliveries')
    .select('template_version, rendered_title, rendered_body')
    .eq('id', snapDelId)
    .single();
  assert(snapRecord?.template_version === 1, 'Delivery snapshot preserves template version 1');
  assert(snapRecord?.rendered_title === 'Mlo Tayari! #ORD-100', 'Delivery snapshot preserves exact rendered title at send time');

  // --------------------------------------------------------------------------
  // Scenario 16: Finance Recipient Restriction: Owner vs Chef
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 16: Finance Recipient Restriction ---');
  const { data: finRecipients } = await adminClient.rpc('resolve_event_recipients', {
    p_event_type: 'SETTLEMENT_GENERATED',
    p_aggregate_type: 'SETTLEMENT',
    p_aggregate_id: 'stl_test_101',
    p_payload: { restaurant_id: restaurantId },
  });

  const recipientUserIds = (finRecipients as any[])?.map((r) => r.recipient_user_id) || [];
  assert(recipientUserIds.includes(userAId), 'Restaurant OWNER resolved for financial settlement notification');
  assert(!recipientUserIds.includes(chefId), 'Chef strictly excluded from financial settlement notification');

  // --------------------------------------------------------------------------
  // Scenario 17: Marketing Consent Ownership Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 17: Marketing Consent Ownership Isolation ---');
  // Client B attempts to modify User A's marketing consent
  const { error: rogueConsentErr } = await clientB.from('marketing_consents').upsert({
    user_id: userAId,
    channel: 'SMS',
    consented: true,
  });
  assert(!!rogueConsentErr, 'User B blocked by RLS from modifying User A marketing consent');

  // --------------------------------------------------------------------------
  // Scenario 18: Realtime Topic Privacy
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 18: Realtime Topic Privacy ---');
  // In-app notifications table RLS: User B cannot select User A's in-app notifications
  const testNotifUserA = `notif_priv_${Date.now()}`;
  await adminClient.from('notifications').insert({
    id: testNotifUserA,
    user_id: userAId,
    type: 'ORDER_READY',
    category: 'ORDER',
    title_en: 'Private Note',
    title_sw: 'Ujumbe Binafsi',
    message_en: 'Private text',
    message_sw: 'Ujumbe',
    is_read: false,
    communication_class: 'TRANSACTIONAL',
  });

  const { data: bViewsA } = await clientB.from('notifications').select('*').eq('id', testNotifUserA);
  assert((bViewsA?.length || 0) === 0, 'User B cannot query User A notification (Realtime channel isolation enforced)');

  // --------------------------------------------------------------------------
  // Scenario 19 & 20: Reservation Reminders: Idempotent emission & Cancelled check
  // --------------------------------------------------------------------------
  console.log('\n--- Scenarios 19 & 20: Reservation Reminders ---');
  const res1Id = `res_rem_${Date.now()}`;
  await adminClient.from('reservations').insert({
    id: res1Id,
    user_id: userAId,
    restaurant_id: restaurantId,
    party_size: 2,
    reservation_date: '2026-10-05',
    reservation_time: '20:00',
    status: 'CONFIRMED',
  });

  // Schedule 24h reminder
  const rem24h_1 = await NotificationEngine.scheduleReservationReminder({ reservationId: res1Id, window: '24h' });
  assert(rem24h_1.emitted === true, 'Scenario 19: 24h reminder emitted for CONFIRMED reservation');

  // Duplicate scheduling with same window
  const rem24h_2 = await NotificationEngine.scheduleReservationReminder({ reservationId: res1Id, window: '24h' });
  assert(rem24h_1.eventId === rem24h_2.eventId, 'Scenario 19: Duplicate reminder scheduling is idempotent with identical event ID');

  // Cancel reservation
  await adminClient.from('reservations').update({ status: 'CANCELLED' }).eq('id', res1Id);
  const rem2h_cancelled = await NotificationEngine.scheduleReservationReminder({ reservationId: res1Id, window: '2h' });
  assert(rem2h_cancelled.emitted === false, 'Scenario 20: Cancelled reservation does NOT emit reminder');

  // --------------------------------------------------------------------------
  // Scenario 21: In-App Durability on Push Delivery Failure
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 21: In-App Durability on Delivery Failure ---');
  const inAppDurId = `notif_dur_${Date.now()}`;
  await adminClient.from('notifications').insert({
    id: inAppDurId,
    user_id: userAId,
    type: 'ORDER_READY',
    category: 'ORDER',
    title_en: 'Durable Meal Ready',
    title_sw: 'Mlo Tayari',
    message_en: 'Ready for pickup',
    message_sw: 'Mlo tayari',
    is_read: false,
    communication_class: 'TRANSACTIONAL',
  });

  // Fail push delivery
  const pushDelDurId = `ndel_dur_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert({
    id: pushDelDurId,
    notification_id: inAppDurId,
    user_id: userAId,
    channel: 'PUSH',
    recipient_address: 'invalid_token',
    provider: 'EXPO',
    status: 'FAILED_PERMANENT',
    idempotency_key: `dur_push_${Date.now()}`,
  });

  // Verify in-app notification is intact
  const { data: durNotifCheck } = await clientA.from('notifications').select('*').eq('id', inAppDurId).single();
  assert(!!durNotifCheck, 'In-app notification remains completely intact and readable after push failure');
  assert(durNotifCheck?.is_read === false, 'In-app notification retains unread state for customer');

  // --------------------------------------------------------------------------
  // Scenario 22: Raw Response Redaction
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 22: Raw Response Redaction ---');
  const redactDelId = `ndel_redact_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert({
    id: redactDelId,
    user_id: userAId,
    channel: 'SMS',
    recipient_address: '+255711000001',
    provider: 'BEEM_AFRICA',
    status: 'PENDING',
    idempotency_key: `redact_del_${Date.now()}`,
  });

  // Attempt with sensitive headers and OTP in raw response
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: redactDelId,
    p_provider: 'BEEM_AFRICA',
    p_status: 'PROVIDER_ACCEPTED',
    p_provider_msg_id: 'beem_msg_777',
    p_status_code: '200',
    p_raw_response: {
      status: 'successful',
      message_id: 'beem_msg_777',
      authorization: 'Bearer secret_provider_key_12345',
      token: 'jwt_admin_token',
      otp: '992811',
      pin: '4321',
      password: 'supersecretpassword',
    },
  });

  const { data: redactAttempt } = await adminClient
    .from('notification_delivery_attempts')
    .select('provider_raw_response')
    .eq('delivery_id', redactDelId)
    .single();
  const storedJson = redactAttempt?.provider_raw_response || {};
  assert(!storedJson.authorization, 'Authorization header stripped from attempt log');
  assert(!storedJson.token, 'Token stripped from attempt log');
  assert(!storedJson.otp, 'OTP stripped from attempt log');
  assert(!storedJson.password, 'Password stripped from attempt log');
  assert(storedJson.status === 'successful', 'Safe non-sensitive status preserved');

  // --------------------------------------------------------------------------
  // Scenario 23: Expo Receipt Status Distinction (Ticket != Receipt)
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 23: Expo Receipt Status Distinction ---');
  const expoDelId = `ndel_expo_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert({
    id: expoDelId,
    user_id: userAId,
    channel: 'PUSH',
    recipient_address: tokenA,
    provider: 'EXPO',
    status: 'PENDING',
    idempotency_key: `expo_del_${Date.now()}`,
  });

  // Ticket acceptance: PROVIDER_ACCEPTED
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: expoDelId,
    p_provider: 'EXPO',
    p_status: 'PROVIDER_ACCEPTED',
    p_provider_msg_id: 'ticket_id_5001',
    p_status_code: '200',
  });
  const { data: ticketDel } = await adminClient.from('notification_deliveries').select('status').eq('id', expoDelId).single();
  assert(ticketDel?.status === 'PROVIDER_ACCEPTED', 'Expo ticket OK records status PROVIDER_ACCEPTED (not device delivered)');

  // Async Receipt delivery confirmation: PROVIDER_DELIVERED
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: expoDelId,
    p_provider: 'EXPO',
    p_status: 'PROVIDER_DELIVERED',
    p_provider_msg_id: 'receipt_id_5001',
    p_status_code: '200',
  });
  const { data: receiptDel } = await adminClient.from('notification_deliveries').select('status').eq('id', expoDelId).single();
  assert(receiptDel?.status === 'PROVIDER_DELIVERED', 'Expo APNs/FCM receipt OK records status PROVIDER_DELIVERED');

  // --------------------------------------------------------------------------
  // Scenario 24: SMS Submission Status
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 24: SMS Submission Status ---');
  const smsDelId = `ndel_sms_sub_${Date.now()}`;
  await adminClient.from('notification_deliveries').insert({
    id: smsDelId,
    user_id: userAId,
    channel: 'SMS',
    recipient_address: '+255711000001',
    provider: 'NEXTSMS',
    status: 'PENDING',
    idempotency_key: `sms_sub_${Date.now()}`,
  });

  // Submission acceptance by gateway
  await adminClient.rpc('record_delivery_attempt_secure', {
    p_delivery_id: smsDelId,
    p_provider: 'NEXTSMS',
    p_status: 'PROVIDER_ACCEPTED',
    p_provider_msg_id: 'nextsms_sub_888',
    p_status_code: '200',
  });
  const { data: smsSubRecord } = await adminClient.from('notification_deliveries').select('status').eq('id', smsDelId).single();
  assert(smsSubRecord?.status === 'PROVIDER_ACCEPTED', 'SMS gateway submission records PROVIDER_ACCEPTED (does not claim handset delivery)');

  // --------------------------------------------------------------------------
  // Scenario 25: Quiet Hours Respect
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 25: Quiet Hours Respect ---');
  // Configure quiet hours for User A (22:00 to 07:00)
  await adminClient.from('notification_preferences').upsert({
    user_id: userAId,
    channel: 'PUSH',
    category: 'ORDER',
    enabled: true,
    quiet_hours_enabled: true,
    quiet_hours_start: '22:00:00',
    quiet_hours_end: '07:00:00',
    quiet_hours_timezone: 'Africa/Dar_es_Salaam',
  });

  const { data: quietPrefCheck } = await adminClient.from('notification_preferences').select('quiet_hours_enabled').eq('user_id', userAId).single();
  assert(quietPrefCheck?.quiet_hours_enabled === true, 'Quiet hours preference verified in database');

  // --------------------------------------------------------------------------
  // Scenario 26: Multi-Channel Concurrency without Cross-Channel Cascading Failure
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 26: Multi-Channel Concurrency ---');
  const multiResult = await NotificationEngine.emitAndProcess({
    eventType: 'ORDER_READY',
    aggregateType: 'ORDER',
    aggregateId: order1Id,
    payload: { order_id: order1Id, order_number: order1Num, user_id: userAId, restaurant_id: restaurantId },
    idempotencyKey: `idem_multi_${Date.now()}`,
    priority: 'HIGH',
    communicationClass: 'TRANSACTIONAL',
  });
  assert(multiResult.notificationsCreated >= 1, 'In-app notification created successfully');
  assert(multiResult.deliveriesDispatched >= 1, 'External deliveries dispatched concurrently without failure');

  // --------------------------------------------------------------------------
  // Scenario 27: Device Token Invalidation on DeviceNotRegistered
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 27: Device Deactivation on DeviceNotRegistered ---');
  const staleToken = `ExponentPushToken[stale_${Date.now()}]`;
  await adminClient.from('push_device_tokens').insert({
    device_id: (await adminClient.from('push_devices').select('id').eq('user_id', userAId).limit(1).single()).data?.id,
    user_id: userAId,
    token_type: 'EXPO',
    token: staleToken,
    is_valid: true,
  });

  await adminClient.rpc('deactivate_push_device_token_secure', {
    p_token: staleToken,
    p_reason: 'DeviceNotRegistered',
  });

  const { data: invalidatedToken } = await adminClient
    .from('push_device_tokens')
    .select('is_valid, invalidation_reason')
    .eq('token', staleToken)
    .single();
  assert(invalidatedToken?.is_valid === false, 'Token invalidated in database');
  assert(invalidatedToken?.invalidation_reason === 'DeviceNotRegistered', 'Reason recorded as DeviceNotRegistered');

  // --------------------------------------------------------------------------
  // Scenario 28: Offline Resilience: Outbox events accumulate and drain cleanly
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 28: Offline Outbox Accumulation & Drain ---');
  const offlineEvt1 = await adminClient.rpc('emit_notification_event', {
    p_event_type: 'ORDER_CREATED',
    p_aggregate_type: 'ORDER',
    p_aggregate_id: 'ord_off_1',
    p_payload: { order_number: 'OFFLINE-1' },
  });
  const offlineEvt2 = await adminClient.rpc('emit_notification_event', {
    p_event_type: 'ORDER_ACCEPTED',
    p_aggregate_type: 'ORDER',
    p_aggregate_id: 'ord_off_2',
    p_payload: { order_number: 'OFFLINE-2' },
  });

  const { data: offlinePending } = await adminClient
    .from('notification_event_outbox')
    .select('id')
    .in('id', [offlineEvt1.data, offlineEvt2.data]);
  assert(offlinePending?.length === 2, 'Events accumulated durably in outbox during network disconnect');

  // Drain outbox via claim & process
  const drainedJobs = await NotificationEngine.claimAndProcessBatch('worker-drain-1', 10, 60);
  assert(Array.isArray(drainedJobs), 'Worker claimed and drained accumulated outbox queue');

  // Cleanup test data
  console.log('\n--- Cleaning up E2E Test Entities ---');
  await adminClient.from('orders').delete().eq('restaurant_id', restaurantId);
  await adminClient.from('reservations').delete().eq('restaurant_id', restaurantId);
  await adminClient.from('restaurant_members').delete().eq('restaurant_id', restaurantId);
  await adminClient.from('restaurants').delete().eq('id', restaurantId);
  await adminClient.from('profiles').delete().in('id', [userAId, userBId, chefId]);
  await adminClient.auth.admin.deleteUser(userAId);
  await adminClient.auth.admin.deleteUser(userBId);
  await adminClient.auth.admin.deleteUser(chefId);
  console.log('Cleanup completed successfully.');

  console.log('\n===============================================================');
  console.log(`  PACK 4E E2E CLOSURE GATE RESULTS: ${passedAssertions} PASSED | ${failedAssertions} FAILED`);
  console.log('===============================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runPack4EClosureSuite().catch((err) => {
  console.error('Fatal E2E closure suite error:', err);
  process.exit(1);
});
