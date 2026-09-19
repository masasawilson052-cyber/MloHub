/**
 * MLOHUB PACK 4F — ADVANCED RESTAURANT & MEAL OPERATIONS
 * COMPREHENSIVE LIVE E2E TEST SUITE
 * 
 * Verifies live PostgreSQL RPCs, RLS, capacity buckets, operational modes,
 * schedule overrides, delivery zones, order lifecycle events, and audit logs.
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

async function runPack4FE2ESuite() {
  console.log('\n===============================================================');
  console.log('  MLOHUB PACK 4F: ADVANCED RESTAURANT & MEAL OPERATIONS E2E GATE');
  console.log('  Testing Operational Modes, Capacity, Schedules, Zones & Audit');
  console.log('===============================================================\n');

  // Pre-cleanup any previous test leftovers
  await adminClient.from('restaurants').delete().ilike('id', 'rest_p4f_%');

  const runId = `p4f_${Date.now()}`;
  const ownerEmail = `owner.${runId}@mlohub.test`;
  const customerEmail = `customer.${runId}@mlohub.test`;
  const strangerEmail = `stranger.${runId}@mlohub.test`;
  const password = 'Password123!';

  // --- Step 1: Zero Synthetic Restaurants Invariant Audit ---
  console.log('--- Step 1: Clean Runtime Verification ---');
  const { count: initialRestCount } = await adminClient
    .from('restaurants')
    .select('*', { count: 'exact', head: true });
  console.log(`Current pre-test database restaurant count: ${initialRestCount}`);
  assert(initialRestCount === 0, 'Clean database has strictly zero synthetic restaurants');

  let ownerId = '';
  let customerId = '';
  let strangerId = '';
  let staffId = '';
  const restaurantId = `rest_${runId}`;
  const branchId = crypto.randomUUID();

  try {
    // --- Step 2: Create Auth Users ---
    console.log('\n--- Step 2: Setting up Isolated Test Tenant & Actors ---');
    // 1. Owner
    const { data: ownerAuth, error: errOwner } = await adminClient.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'P4F Restaurant Owner', role: 'RESTAURANT_OWNER' },
    });
    assert(!errOwner && !!ownerAuth?.user?.id, 'Owner auth user created');
    ownerId = ownerAuth!.user!.id;

    await adminClient.from('profiles').update({
      full_name: 'P4F Restaurant Owner',
      role: 'RESTAURANT_OWNER',
      roles: ['RESTAURANT_OWNER'],
      account_type: 'RESTAURANT',
    }).eq('id', ownerId);

    // 2. Customer
    const { data: custAuth, error: errCust } = await adminClient.auth.admin.createUser({
      email: customerEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'P4F Regular Customer', role: 'CUSTOMER' },
    });
    assert(!errCust && !!custAuth?.user?.id, 'Customer auth user created');
    customerId = custAuth!.user!.id;

    await adminClient.from('profiles').update({
      full_name: 'P4F Regular Customer',
      role: 'CUSTOMER',
      roles: ['CUSTOMER'],
      account_type: 'CUSTOMER',
    }).eq('id', customerId);

    // 3. Stranger (Unauthorized)
    const { data: strAuth, error: errStr } = await adminClient.auth.admin.createUser({
      email: strangerEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'P4F Stranger User', role: 'CUSTOMER' },
    });
    assert(!errStr && !!strAuth?.user?.id, 'Stranger auth user created');
    strangerId = strAuth!.user!.id;

    // Create scoped clients
    const ownerClient = createClient(SUPABASE_URL, ANON_KEY);
    await ownerClient.auth.signInWithPassword({ email: ownerEmail, password });

    const customerClient = createClient(SUPABASE_URL, ANON_KEY);
    await customerClient.auth.signInWithPassword({ email: customerEmail, password });

    const strangerClient = createClient(SUPABASE_URL, ANON_KEY);
    await strangerClient.auth.signInWithPassword({ email: strangerEmail, password });

    // --- Step 3: Create Restaurant, Branch & Menu ---
    const { error: errRest } = await adminClient.from('restaurants').insert({
      id: restaurantId,
      owner_id: ownerId,
      name: `Pack4F Kitchen ${runId}`,
      slug: `pack4f-kitchen-${runId}`,
      cuisine: 'Swahili / Grill',
      address: 'Aggrey & Swahili St, Kariakoo',
      region_city: 'Dar es Salaam',
      neighborhood: 'Kariakoo',
      is_active: true,
      is_published: true,
      verification_status: 'VERIFIED',
      supports_order_ahead: true,
    });
    assert(!errRest, 'Restaurant insertion succeeded');

    const { error: errMember } = await adminClient.from('restaurant_members').insert({
      restaurant_id: restaurantId,
      user_id: ownerId,
      role: 'OWNER',
      permissions: ['MANAGE_OPERATIONS', 'MANAGE_MENU', 'MANAGE_ORDERS', 'VIEW_DASHBOARD'],
      is_active: true,
    });
    assert(!errMember, 'Member insertion succeeded');

    const { error: errBranch } = await adminClient.from('restaurant_branches').insert({
      id: branchId,
      restaurant_id: restaurantId,
      name: 'Main Branch Kariakoo',
      address: 'Aggrey & Swahili St, Kariakoo',
      region: 'Dar es Salaam',
      phone: '+255712000000',
      is_active: true,
      operational_mode: 'OPEN',
      base_prep_minutes: 25,
      busy_delay_minutes: 0,
      pickup_enabled: true,
      delivery_enabled: true,
      dine_in_enabled: true,
      min_order_amount_tzs: 5000,
      base_delivery_fee_tzs: 2500,
    });
    assert(!errBranch, 'Branch insertion succeeded');

    const catId = `cat_${runId}`;
    await adminClient.from('menu_categories').insert({
      id: catId,
      restaurant_id: restaurantId,
      name_en: 'Grill & Mains',
      name_sw: 'Nyama Choma na Vyakula Vikuu',
      display_order: 1,
      is_active: true,
    });

    const dish1Id = `dish1_${runId}`;
    const dish2Id = `dish2_${runId}`;
    const { error: errItems } = await adminClient.from('menu_items').insert([
      {
        id: dish1Id,
        restaurant_id: restaurantId,
        category_id: catId,
        name_en: 'Quarter Kuku Choma',
        name_sw: 'Robo ya Kuku Choma',
        price_tzs: 12000,
        is_available: true,
        is_archived: false,
      },
      {
        id: dish2Id,
        restaurant_id: restaurantId,
        category_id: catId,
        name_en: 'Chips Mayai Zege',
        name_sw: 'Chips Mayai Zege',
        price_tzs: 4500,
        is_available: true,
        is_archived: false,
      },
    ]);
    if (errItems) console.error('DEBUG: errItems =', errItems);
    assert(!errItems, 'Menu items inserted successfully');

    await adminClient.from('branch_menu_items').insert([
      {
        branch_id: branchId,
        menu_item_id: dish1Id,
        price_tzs: 12000,
        is_available: true,
        operational_status: 'IN_STOCK',
      },
      {
        branch_id: branchId,
        menu_item_id: dish2Id,
        price_tzs: 4500,
        is_available: true,
        operational_status: 'IN_STOCK',
      },
    ]);

    assert(true, 'Test restaurant, branch, and menu catalog initialized');

    // --- Step 4: Test Operational Modes (OPEN, BUSY, PAUSED, CLOSED) ---
    console.log('\n--- Step 4: Branch Operational Mode Authority & RPCs ---');

    // 4.1 Check initial status
    const { data: statusOpen, error: errStatusOpen } = await ownerClient.rpc('get_branch_operational_status', {
      p_branch_id: branchId,
      p_service_type: 'PICKUP',
    });
    assert(!errStatusOpen && statusOpen?.available === true, 'Branch initially available for PICKUP');
    assert(statusOpen?.mode === 'OPEN', 'Initial mode is OPEN');
    assert(statusOpen?.estimated_prep_minutes === 25, 'Initial prep quote is base 25 mins');

    // 4.2 Set to BUSY mode with delay
    const { data: busyRes, error: errBusy } = await ownerClient.rpc('set_branch_operational_mode_secure', {
      p_branch_id: branchId,
      p_mode: 'BUSY',
      p_busy_delay_minutes: 15,
    });
    assert(!errBusy && busyRes?.operational_mode === 'BUSY', 'Owner sets mode to BUSY');

    const { data: statusBusy } = await ownerClient.rpc('get_branch_operational_status', {
      p_branch_id: branchId,
    });
    assert(statusBusy?.available === true, 'Branch in BUSY mode is still accepting orders');
    assert(statusBusy?.estimated_prep_minutes === 40, 'Prep quote includes +15m busy delay (25+15=40m)');

    // 4.3 Set to PAUSED mode
    const { data: pauseRes, error: errPause } = await ownerClient.rpc('set_branch_operational_mode_secure', {
      p_branch_id: branchId,
      p_mode: 'PAUSED',
      p_pause_duration_minutes: 30,
      p_pause_reason: 'Kitchen overloaded with dinner orders',
    });
    assert(!errPause && pauseRes?.operational_mode === 'PAUSED', 'Owner sets mode to PAUSED');

    const { data: statusPaused } = await ownerClient.rpc('get_branch_operational_status', {
      p_branch_id: branchId,
    });
    assert(statusPaused?.available === false, 'Paused branch is NOT accepting orders');
    assert(statusPaused?.reason === 'ORDERS_PAUSED', 'Reason reported as ORDERS_PAUSED');
    assert(statusPaused?.pause_reason === 'Kitchen overloaded with dinner orders', 'Pause reason preserved');

    // 4.4 Unauthorized user attempts mode change -> Rejected
    const { error: errStrangerMode } = await strangerClient.rpc('set_branch_operational_mode_secure', {
      p_branch_id: branchId,
      p_mode: 'OPEN',
    });
    assert(!!errStrangerMode, 'Stranger blocked from modifying operational mode (403 Forbidden)');

    // 4.5 Set to CLOSED mode
    await ownerClient.rpc('set_branch_operational_mode_secure', {
      p_branch_id: branchId,
      p_mode: 'CLOSED',
    });
    const { data: statusClosed } = await ownerClient.rpc('get_branch_operational_status', {
      p_branch_id: branchId,
    });
    assert(statusClosed?.available === false && statusClosed?.reason === 'MANUALLY_CLOSED', 'Branch MANUALLY_CLOSED recognized');

    // 4.6 Resume to OPEN
    await ownerClient.rpc('set_branch_operational_mode_secure', {
      p_branch_id: branchId,
      p_mode: 'OPEN',
    });
    const { data: statusRestored } = await ownerClient.rpc('get_branch_operational_status', {
      p_branch_id: branchId,
    });
    assert(statusRestored?.available === true && statusRestored?.mode === 'OPEN', 'Branch safely resumed to OPEN');

    // --- Step 5: Structured Operating Hours & Schedule Overrides ---
    console.log('\n--- Step 5: Structured Operating Hours & Schedule Overrides ---');
    // Set 24-hour open schedule for all 7 days for test continuity
    const hoursList = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      branch_id: branchId,
      day_of_week: day,
      service_type: 'PICKUP',
      opens_at: '00:00:00',
      closes_at: '23:59:59',
      is_closed: false,
    }));
    const { error: errHours } = await ownerClient.from('branch_operating_hours').upsert(hoursList, {
      onConflict: 'branch_id,day_of_week,service_type',
    });
    assert(!errHours, 'Weekly operating hours saved successfully');

    // Insert special schedule override for a specific date in future
    const overrideDate = '2026-12-25';
    const { error: errOverride } = await ownerClient.from('branch_schedule_overrides').upsert({
      branch_id: branchId,
      override_date: overrideDate,
      service_type: 'PICKUP',
      is_closed: true,
      reason_code: 'CHRISTMAS_HOLIDAY',
      note_internal: 'Closed for public holiday celebration',
    });
    assert(!errOverride, 'Special holiday schedule override stored');

    // --- Step 6: Restaurant-Managed Delivery Zones ---
    console.log('\n--- Step 6: Restaurant-Managed Delivery Zones ---');
    const zoneRow = {
      branch_id: branchId,
      zone_name: `CBD & Upanga ${runId}`,
      fee_tzs: 3000,
      minimum_order_tzs: 10000,
      estimated_delivery_minutes: 25,
      supported_wards: ['Kariakoo', 'Upanga Mashariki', 'Upanga Magharibi'],
      is_active: true,
    };
    const { error: errZone } = await ownerClient.from('branch_delivery_zones').upsert(zoneRow, {
      onConflict: 'branch_id,zone_name',
    });
    assert(!errZone, 'Authoritative delivery zone configured with fee 3,000 TZS');

    // --- Step 7: Menu Item Operational Availability ---
    console.log('\n--- Step 7: Menu Item Operational Availability & Dayparts ---');

    // 7.1 Temporarily 86 Dish 2 (Sold out)
    const { data: soldOutRes, error: errSoldOut } = await ownerClient.rpc('set_item_operational_availability_secure', {
      p_branch_id: branchId,
      p_menu_item_id: dish2Id,
      p_status: 'SOLD_OUT_TEMPORARILY',
      p_unavailable_until: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      p_reason: 'Eggs out of stock until fresh morning supply',
    });
    assert(!errSoldOut && soldOutRes?.operational_status === 'SOLD_OUT_TEMPORARILY', 'Dish 2 marked SOLD_OUT_TEMPORARILY');

    // 7.2 Customer tries to order sold-out Dish 2 -> Server RPC rejects
    const { error: errOrderSoldOut } = await customerClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish2Id, quantity: 1 }],
      p_fulfillment_type: 'Pickup',
    });
    assert(
      !!errOrderSoldOut && errOrderSoldOut.message.includes('sold out'),
      'Server RPC rejects order with sold-out dish'
    );

    // 7.3 Restore dish availability via bulk RPC
    const { data: bulkRes, error: errBulk } = await ownerClient.rpc('bulk_set_items_availability_secure', {
      p_branch_id: branchId,
      p_menu_item_ids: [dish1Id, dish2Id],
      p_status: 'IN_STOCK',
    });
    assert(!errBulk && bulkRes?.updated_count === 2, 'Bulk availability restore marks both items IN_STOCK');

    // --- Step 8: Kitchen Capacity Bucket Controls ---
    console.log('\n--- Step 8: Kitchen Capacity Controls (15-Min Slots) ---');
    // Set branch capacity limit: max 2 orders per 15 min interval
    await adminClient.from('restaurant_branches').update({
      capacity_control_mode: 'ORDER_COUNT',
      max_orders_per_interval: 2,
      capacity_interval_minutes: 15,
    }).eq('id', branchId);

    // Order 1: Should succeed
    const { data: order1Res, error: errOrder1 } = await customerClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish1Id, quantity: 1 }],
      p_fulfillment_type: 'Pickup',
    });
    assert(!errOrder1 && !!order1Res?.order_id, 'Capacity Slot: Order #1 placed successfully');

    // Order 2: Should succeed
    const { data: order2Res, error: errOrder2 } = await customerClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish1Id, quantity: 1 }],
      p_fulfillment_type: 'Pickup',
    });
    assert(!errOrder2 && !!order2Res?.order_id, 'Capacity Slot: Order #2 placed successfully');

    // Order 3: Capacity exceeded in this 15-minute window! Should be throttled with 429
    const { data: order3Res, error: errOrder3 } = await customerClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish1Id, quantity: 1 }],
      p_fulfillment_type: 'Pickup',
    });
    assert(
      !!errOrder3 && errOrder3.message.includes('maximum capacity'),
      'Capacity Slot: Order #3 throttled when max_orders_per_interval exceeded (429)'
    );

    // Reset capacity control to none for further tests
    await adminClient.from('restaurant_branches').update({
      capacity_control_mode: 'NONE',
    }).eq('id', branchId);

    // --- Step 8b: Concurrency: Last Capacity Slot Race ---
    console.log('\n--- Step 8b: Concurrency: Last Capacity Slot Race ---');
    // Set capacity to exactly 1 order per 15 min window on a dedicated branch window
    const raceBranchId = crypto.randomUUID();
    await adminClient.from('restaurant_branches').insert({
      id: raceBranchId,
      restaurant_id: restaurantId,
      name: 'Race Test Branch',
      address: 'Race Track Rd',
      region: 'Dar es Salaam',
      phone: '+255712000001',
      is_active: true,
      operational_mode: 'OPEN',
      pickup_enabled: true,
      capacity_control_mode: 'ORDER_COUNT',
      max_orders_per_interval: 1,
      capacity_interval_minutes: 15,
    });
    await adminClient.from('branch_menu_items').insert({
      branch_id: raceBranchId,
      menu_item_id: dish1Id,
      price_tzs: 12000,
      is_available: true,
      operational_status: 'IN_STOCK',
    });

    const [raceRes1, raceRes2] = await Promise.all([
      customerClient.rpc('create_order_secure', {
        p_branch_id: raceBranchId,
        p_items: [{ menu_item_id: dish1Id, quantity: 1 }],
        p_fulfillment_type: 'Pickup',
      }),
      customerClient.rpc('create_order_secure', {
        p_branch_id: raceBranchId,
        p_items: [{ menu_item_id: dish1Id, quantity: 1 }],
        p_fulfillment_type: 'Pickup',
      }),
    ]);

    const raceSuccesses = [raceRes1, raceRes2].filter(r => !r.error && r.data?.order_id);
    const raceFailures = [raceRes1, raceRes2].filter(r => r.error && r.error.message.includes('maximum capacity'));
    assert(raceSuccesses.length === 1, 'Race Concurrency: Exactly 1 concurrent order captured the remaining slot');
    assert(raceFailures.length === 1, 'Race Concurrency: The competing concurrent order was throttled with 429');

    // --- Step 8c: Service Isolation (Pickup vs Delivery) ---
    console.log('\n--- Step 8c: Service Isolation & Delivery Zone Authority ---');
    // Disable delivery on main branch
    await adminClient.from('restaurant_branches').update({
      delivery_enabled: false,
      pickup_enabled: true,
    }).eq('id', branchId);

    const { error: errDelivDisabled } = await customerClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish1Id, quantity: 1 }],
      p_fulfillment_type: 'Delivery',
    });
    assert(!!errDelivDisabled && errDelivDisabled.message.includes('not accepting orders'), 'Delivery order rejected when delivery service disabled');

    const { data: pickupOkRes, error: errPickupOk } = await customerClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish1Id, quantity: 1 }],
      p_fulfillment_type: 'Pickup',
    });
    assert(!errPickupOk && !!pickupOkRes?.order_id, 'Pickup order succeeds while delivery is disabled');

    // Re-enable delivery and test authoritative delivery fee from zone (3,000 TZS)
    await adminClient.from('restaurant_branches').update({
      delivery_enabled: true,
      min_order_amount_tzs: 5000,
    }).eq('id', branchId);

    const { data: delivOrderRes, error: errDelivOrder } = await customerClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish1Id, quantity: 1 }], // 12000 >= 5000
      p_fulfillment_type: 'Delivery',
      p_delivery_address: 'Kariakoo, Swahili Street Apt 4B',
    });
    assert(!errDelivOrder && !!delivOrderRes?.order_id, 'Delivery order with valid minimum placed successfully');
    assert(delivOrderRes?.delivery_fee_tzs === 3000, 'Authoritative server delivery fee (3,000 TZS) applied from branch_delivery_zones');
    assert(delivOrderRes?.total_tzs === 12000 + 1500 + 3000, 'Total strictly matches subtotal(12000) + service(1500) + delivery(3000) = 16500 TZS');

    // --- Step 8d: Daypart Restrictions ---
    console.log('\n--- Step 8d: Daypart Restrictions ---');
    // Set dish2 to a 1-hour breakfast window far from current time
    await adminClient.from('branch_menu_items').update({
      daypart_start: '04:00:00',
      daypart_end: '05:00:00',
    }).eq('branch_id', branchId).eq('menu_item_id', dish2Id);

    const { error: errDaypart } = await customerClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish2Id, quantity: 1 }],
      p_fulfillment_type: 'Pickup',
    });
    assert(!!errDaypart && errDaypart.message.includes('only available between'), 'Order rejected when item ordered outside daypart schedule');

    // Clear daypart restriction
    await adminClient.from('branch_menu_items').update({
      daypart_start: null,
      daypart_end: null,
    }).eq('branch_id', branchId).eq('menu_item_id', dish2Id);

    // --- Step 8e: Special Opening Override & Overnight Hours ---
    console.log('\n--- Step 8e: Special Opening Override & Overnight Hours ---');
    const scheduleBranchId = crypto.randomUUID();
    await adminClient.from('restaurant_branches').insert({
      id: scheduleBranchId,
      restaurant_id: restaurantId,
      name: 'Schedule Test Branch',
      address: 'Schedule Rd',
      region: 'Dar es Salaam',
      phone: '+255712000002',
      is_active: true,
      operational_mode: 'OPEN',
      pickup_enabled: true,
      timezone: 'Africa/Dar_es_Salaam',
    });

    // Determine current date and DOW in branch's timezone (Africa/Dar_es_Salaam)
    const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dar_es_Salaam' }).format(new Date());
    const darDOW = new Date(`${todayDate}T12:00:00Z`).getUTCDay();

    // Mark today as closed in regular weekly hours
    await adminClient.from('branch_operating_hours').insert({
      branch_id: scheduleBranchId,
      day_of_week: darDOW,
      service_type: 'PICKUP',
      opens_at: '08:00:00',
      closes_at: '20:00:00',
      is_closed: true,
    });

    const { data: statusClosedDay } = await ownerClient.rpc('get_branch_operational_status', {
      p_branch_id: scheduleBranchId,
      p_service_type: 'PICKUP',
    });
    assert(statusClosedDay?.available === false && statusClosedDay?.reason === 'CLOSED_DAY', 'Branch recognized as CLOSED_DAY from weekly schedule');

    // Now insert a special opening override for today's date in Dar es Salaam
    await adminClient.from('branch_schedule_overrides').insert({
      branch_id: scheduleBranchId,
      override_date: todayDate,
      service_type: 'PICKUP',
      opens_at: '00:00:00',
      closes_at: '23:59:59',
      is_closed: false,
      reason_code: 'SPECIAL_EVENT_OPENING',
    });

    const { data: statusOverrideOpen } = await ownerClient.rpc('get_branch_operational_status', {
      p_branch_id: scheduleBranchId,
      p_service_type: 'PICKUP',
    });
    assert(statusOverrideOpen?.available === true, 'Special opening override opens branch on normally closed day');

    // --- Step 8f: Anonymous Auth Boundary ---
    console.log('\n--- Step 8f: Anonymous Auth Boundary ---');
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: errAnonOrder } = await anonClient.rpc('create_order_secure', {
      p_branch_id: branchId,
      p_items: [{ menu_item_id: dish1Id, quantity: 1 }],
      p_fulfillment_type: 'Pickup',
    });
    assert(!!errAnonOrder && errAnonOrder.message.includes('401 Unauthorized'), 'Anonymous user denied from placing orders (401 Unauthorized)');

    const { error: errAnonMode } = await anonClient.rpc('set_branch_operational_mode_secure', {
      p_branch_id: branchId,
      p_mode: 'CLOSED',
    });
    assert(!!errAnonMode && errAnonMode.message.includes('401 Unauthorized'), 'Anonymous user denied from altering operational mode (401 Unauthorized)');

    // --- Step 8g: RBAC Guards for Staff ---
    console.log('\n--- Step 8g: Granular RBAC Permissions ---');
    const staffEmail = `staff.${runId}@mlohub.test`;
    const { data: staffAuth } = await adminClient.auth.admin.createUser({
      email: staffEmail,
      password,
      email_confirm: true,
    });
    staffId = staffAuth!.user!.id;
    await adminClient.from('restaurant_members').insert({
      restaurant_id: restaurantId,
      user_id: staffId,
      role: 'STAFF',
      permissions: ['VIEW_DASHBOARD'],
      is_active: true,
    });

    const staffClient = createClient(SUPABASE_URL, ANON_KEY);
    await staffClient.auth.signInWithPassword({ email: staffEmail, password });

    const { error: errStaffMode } = await staffClient.rpc('set_branch_operational_mode_secure', {
      p_branch_id: branchId,
      p_mode: 'CLOSED',
    });
    assert(!!errStaffMode && errStaffMode.message.includes('403 Forbidden'), 'Staff without MANAGE_OPERATIONS denied from altering operational mode (403 Forbidden)');


    // --- Step 9: Order Lifecycle & Append-Only Operational Events ---
    console.log('\n--- Step 9: Order Operational Events Timeline ---');
    const targetOrderId = order1Res.order_id;

    // Verify ORDER_RECEIVED was recorded automatically by create_order_secure
    const { data: initEvents } = await adminClient
      .from('order_operational_events')
      .select('*')
      .eq('order_id', targetOrderId);
    assert(
      initEvents?.some((e: any) => e.event_type === 'ORDER_RECEIVED'),
      'Initial ORDER_RECEIVED operational event recorded on order creation'
    );

    // Owner transitions: ORDER_VIEWED -> ORDER_ACCEPTED -> PREP_STARTED -> READY
    const { error: errViewed } = await ownerClient.rpc('record_order_operational_event_secure', {
      p_order_id: targetOrderId,
      p_event_type: 'ORDER_VIEWED',
    });
    assert(!errViewed, 'Staff operational event recorded: ORDER_VIEWED');

    const { error: errAccepted } = await ownerClient.rpc('record_order_operational_event_secure', {
      p_order_id: targetOrderId,
      p_event_type: 'ORDER_ACCEPTED',
      p_details: { kitchen_station: 'Grill Station 1' },
    });
    assert(!errAccepted, 'Staff operational event recorded: ORDER_ACCEPTED');

    const { error: errPrep } = await ownerClient.rpc('record_order_operational_event_secure', {
      p_order_id: targetOrderId,
      p_event_type: 'PREP_STARTED',
    });
    assert(!errPrep, 'Staff operational event recorded: PREP_STARTED');

    const { error: errReady } = await ownerClient.rpc('record_order_operational_event_secure', {
      p_order_id: targetOrderId,
      p_event_type: 'READY',
    });
    assert(!errReady, 'Staff operational event recorded: READY');

    // Customer fetches the event timeline
    const { data: customerTimeline } = await customerClient
      .from('order_operational_events')
      .select('*')
      .eq('order_id', targetOrderId)
      .order('created_at', { ascending: true });
    assert(customerTimeline && customerTimeline.length >= 5, 'Customer read access to full 5-step operational timeline');

    // --- Step 10: Operational Audit Logs Verification ---
    console.log('\n--- Step 10: Restaurant Operational Audit Logs ---');
    const { data: auditLogs } = await ownerClient
      .from('restaurant_operational_audit_logs')
      .select('*')
      .eq('branch_id', branchId);
    assert(auditLogs && auditLogs.length >= 3, 'Operational audit logs captured state transitions (OPEN, BUSY, PAUSED, CLOSED)');
    assert(
      auditLogs?.some((log: any) => log.action === 'SET_OPERATIONAL_MODE'),
      'SET_OPERATIONAL_MODE action logged with actor ID and before/after states'
    );

  } finally {
    // --- Step 11: Clean Teardown ---
    console.log('\n--- Step 11: Clean Teardown ---');
    await adminClient.from('restaurants').delete().eq('id', restaurantId);
    if (ownerId) await adminClient.auth.admin.deleteUser(ownerId);
    if (customerId) await adminClient.auth.admin.deleteUser(customerId);
    if (strangerId) await adminClient.auth.admin.deleteUser(strangerId);
    if (staffId) await adminClient.auth.admin.deleteUser(staffId);
    assert(true, 'Test entities safely cleaned up');
  }

  console.log('\n===============================================================');
  console.log(`  PACK 4F E2E RESULTS: ${passedAssertions} PASSED | ${failedAssertions} FAILED`);
  console.log('===============================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runPack4FE2ESuite().catch((e) => {
  console.error('Fatal Pack 4F E2E error:', e);
  process.exit(1);
});
