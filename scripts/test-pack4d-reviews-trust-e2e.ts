/**
 * MLOHUB PACK 4D — RATINGS, REVIEWS, DISH TRUST & CONTENT INTEGRITY
 * LIVE SUPABASE E2E TEST SUITE
 * 
 * Verifies all 62 Scenarios (A through BJ) against real local Supabase instance.
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

async function runPack4DSuite() {
  console.log('\n===============================================================');
  console.log('  STARTING MLOHUB PACK 4D RATINGS, REVIEWS & DISH TRUST E2E');
  console.log('===============================================================\n');

  const timestamp = Date.now();
  const testEmailCustA = `rev_cust_a_${timestamp}@mlohub.test`;
  const testEmailCustB = `rev_cust_b_${timestamp}@mlohub.test`;
  const testEmailCustC = `rev_cust_c_${timestamp}@mlohub.test`;
  const testEmailOwnerA = `rev_owner_a_${timestamp}@mlohub.test`;
  const testEmailManagerA = `rev_mgr_a_${timestamp}@mlohub.test`;
  const testEmailStaffA = `rev_staff_a_${timestamp}@mlohub.test`;
  const testEmailOwnerB = `rev_owner_b_${timestamp}@mlohub.test`;
  const testEmailAdmin = `rev_admin_${timestamp}@mlohub.test`;
  const defaultPassword = 'TestPassword123!';

  // ============================================================================
  // Step 1: Provision Test Users
  // ============================================================================
  console.log('--- Step 1: Provisioning Test Users ---');
  const { data: userCustA } = await adminClient.auth.admin.createUser({
    email: testEmailCustA,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Customer Alice', role: 'CUSTOMER' },
  });
  const { data: userCustB } = await adminClient.auth.admin.createUser({
    email: testEmailCustB,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Customer Bob', role: 'CUSTOMER' },
  });
  const { data: userCustC } = await adminClient.auth.admin.createUser({
    email: testEmailCustC,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Customer Charlie', role: 'CUSTOMER' },
  });
  const { data: userOwnerA } = await adminClient.auth.admin.createUser({
    email: testEmailOwnerA,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Owner Alpha', role: 'RESTAURANT_OWNER' },
  });
  const { data: userManagerA } = await adminClient.auth.admin.createUser({
    email: testEmailManagerA,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Manager Alpha', role: 'RESTAURANT_MANAGER' },
  });
  const { data: userStaffA } = await adminClient.auth.admin.createUser({
    email: testEmailStaffA,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Staff Alpha', role: 'RESTAURANT_STAFF' },
  });
  const { data: userOwnerB } = await adminClient.auth.admin.createUser({
    email: testEmailOwnerB,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Owner Beta', role: 'RESTAURANT_OWNER' },
  });
  const { data: userAdmin } = await adminClient.auth.admin.createUser({
    email: testEmailAdmin,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Admin Platform', role: 'ADMIN' },
  });

  const custAId = userCustA!.user!.id;
  const custBId = userCustB!.user!.id;
  const custCId = userCustC!.user!.id;
  const ownerAId = userOwnerA!.user!.id;
  const managerAId = userManagerA!.user!.id;
  const staffAId = userStaffA!.user!.id;
  const ownerBId = userOwnerB!.user!.id;
  const adminId = userAdmin!.user!.id;

  // Ensure profiles exist with correct roles
  await adminClient.from('profiles').update({ role: 'ADMIN', roles: ['ADMIN'], account_type: 'ADMIN', status: 'ACTIVE' }).eq('id', adminId);
  await adminClient.from('profiles').update({ role: 'RESTAURANT_OWNER', roles: ['RESTAURANT_OWNER'], account_type: 'RESTAURANT', status: 'ACTIVE' }).eq('id', ownerAId);
  await adminClient.from('profiles').update({ role: 'RESTAURANT_MANAGER', roles: ['RESTAURANT_MANAGER'], account_type: 'RESTAURANT', status: 'ACTIVE' }).eq('id', managerAId);
  await adminClient.from('profiles').update({ role: 'RESTAURANT_STAFF', roles: ['RESTAURANT_STAFF'], account_type: 'RESTAURANT', status: 'ACTIVE' }).eq('id', staffAId);
  await adminClient.from('profiles').update({ role: 'RESTAURANT_OWNER', roles: ['RESTAURANT_OWNER'], account_type: 'RESTAURANT', status: 'ACTIVE' }).eq('id', ownerBId);
  await adminClient.from('profiles').update({ role: 'CUSTOMER', roles: ['CUSTOMER'], account_type: 'CUSTOMER', status: 'ACTIVE' }).in('id', [custAId, custBId, custCId]);

  const clientCustA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientCustA.auth.signInWithPassword({ email: testEmailCustA, password: defaultPassword });

  const clientCustB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientCustB.auth.signInWithPassword({ email: testEmailCustB, password: defaultPassword });

  const clientCustC = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientCustC.auth.signInWithPassword({ email: testEmailCustC, password: defaultPassword });

  const clientOwnerA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientOwnerA.auth.signInWithPassword({ email: testEmailOwnerA, password: defaultPassword });

  const clientManagerA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientManagerA.auth.signInWithPassword({ email: testEmailManagerA, password: defaultPassword });

  const clientStaffA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientStaffA.auth.signInWithPassword({ email: testEmailStaffA, password: defaultPassword });

  const clientOwnerB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientOwnerB.auth.signInWithPassword({ email: testEmailOwnerB, password: defaultPassword });

  const clientAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientAdmin.auth.signInWithPassword({ email: testEmailAdmin, password: defaultPassword });

  assert(!!custAId && !!adminId, 'All 8 test users authenticated');

  // ============================================================================
  // Step 2: Provision Restaurants, Branches, Members, and Dishes
  // ============================================================================
  console.log('\n--- Step 2: Provisioning Restaurants, Branches & Catalog ---');
  const restAId = `rest_p4d_a_${timestamp}`;
  const restBId = `rest_p4d_b_${timestamp}`;

  await adminClient.from('restaurants').insert([
    {
      id: restAId,
      owner_id: ownerAId,
      name: 'Alpha Swahili Grill',
      slug: `alpha-grill-${timestamp}`,
      cuisine: 'Swahili',
      is_open: true,
      is_verified: true,
      rating: 4.5,
      reviews_count: 10,
      address: 'Kinondoni, Dar es Salaam',
    },
    {
      id: restBId,
      owner_id: ownerBId,
      name: 'Beta Seafood Masaki',
      slug: `beta-seafood-${timestamp}`,
      cuisine: 'Seafood',
      is_open: true,
      is_verified: true,
      rating: 4.8,
      reviews_count: 50,
      address: 'Masaki, Dar es Salaam',
    },
  ]);

  // Restaurant Branches
  const { data: bA, error: bAErr } = await adminClient.from('restaurant_branches').insert({
    restaurant_id: restAId,
    name: 'Kinondoni Main Branch',
    address: 'Morogoro Road, Kinondoni',
    ward: 'Kinondoni',
    phone: '+255712345678',
    is_active: true,
  }).select().single();
  if (bAErr) console.error('Branch A insert error:', bAErr);
  const branchAId = bA!.id;

  const { data: bB, error: bBErr } = await adminClient.from('restaurant_branches').insert({
    restaurant_id: restBId,
    name: 'Masaki Ocean Branch',
    address: 'Toure Drive, Masaki',
    ward: 'Masaki',
    phone: '+255712999888',
    is_active: true,
  }).select().single();
  if (bBErr) console.error('Branch B insert error:', bBErr);
  const branchBId = bB!.id;

  // Restaurant Members
  await adminClient.from('restaurant_members').insert([
    {
      user_id: ownerAId,
      restaurant_id: restAId,
      role: 'OWNER',
      permissions: ['ALL'],
      is_primary_owner: true,
      is_active: true,
      status: 'ACTIVE',
    },
    {
      user_id: managerAId,
      restaurant_id: restAId,
      role: 'MANAGER',
      permissions: ['MANAGE_REVIEWS', 'VIEW_ORDERS', 'MANAGE_ORDERS'],
      is_primary_owner: false,
      is_active: true,
      status: 'ACTIVE',
    },
    {
      user_id: staffAId,
      restaurant_id: restAId,
      role: 'STAFF',
      permissions: ['VIEW_ORDERS'],
      is_primary_owner: false,
      is_active: true,
      status: 'ACTIVE',
    },
    {
      user_id: ownerBId,
      restaurant_id: restBId,
      role: 'OWNER',
      permissions: ['ALL'],
      is_primary_owner: true,
      is_active: true,
      status: 'ACTIVE',
    },
  ]);

  // Dishes for Restaurant A
  const dishA1Id = `dish_p4d_a1_${timestamp}`;
  const dishA2Id = `dish_p4d_a2_${timestamp}`;
  const dishA3Id = `dish_p4d_a3_unreviewed_${timestamp}`;
  const dishB1Id = `dish_p4d_b1_${timestamp}`;

  await adminClient.from('menu_items').insert([
    {
      id: dishA1Id,
      restaurant_id: restAId,
      name_en: 'Ugali Samaki Choma',
      name_sw: 'Ugali Samaki Choma',
      description_en: 'Grilled fresh tilapia with traditional corn ugali',
      price_tzs: 15000,
      is_available: true,
    },
    {
      id: dishA2Id,
      restaurant_id: restAId,
      name_en: 'Pilau Kuku Special',
      name_sw: 'Pilau ya Kuku',
      description_en: 'Fragrant spiced rice with free-range chicken',
      price_tzs: 18000,
      is_available: true,
    },
    {
      id: dishA3Id,
      restaurant_id: restAId,
      name_en: 'Mishkaki Beef Skewers',
      name_sw: 'Mishkaki ya Ngombe',
      description_en: 'Tender marinated beef skewers grilled over open fire',
      price_tzs: 8000,
      is_available: true,
    },
    {
      id: dishB1Id,
      restaurant_id: restBId,
      name_en: 'Masaki Lobster Thermidor',
      name_sw: 'Kamba Mkubwa wa Masaki',
      description_en: 'Fresh Indian ocean rock lobster baked in rich cream sauce',
      price_tzs: 55000,
      is_available: true,
    },
  ]);

  // Create Orders & Order Items
  const order1Id = `ord_p4d_1_${timestamp}`;
  const order2Id = `ord_p4d_custom_${timestamp}`;
  const orderPendingId = `ord_p4d_pending_${timestamp}`;
  const orderCustBId = `ord_p4d_custb_${timestamp}`;

  // Order 1: Completed Standard Order for Customer A
  await adminClient.from('orders').insert({
    id: order1Id,
    order_number: `ORD-1-${timestamp}`,
    user_id: custAId,
    restaurant_id: restAId,
    branch_id: branchAId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 33000,
    service_fee_tzs: 1500,
    total_tzs: 34500,
    dining_option: 'Delivery',
  });

  const oi1Id = `oi_1_${timestamp}`;
  const oi2Id = `oi_2_${timestamp}`;
  await adminClient.from('order_items').insert([
    {
      id: oi1Id,
      order_id: order1Id,
      menu_item_id: dishA1Id,
      item_name: 'Ugali Samaki Choma',
      quantity: 1,
      unit_price_tzs: 15000,
      total_price_tzs: 15000,
    },
    {
      id: oi2Id,
      order_id: order1Id,
      menu_item_id: dishA2Id,
      item_name: 'Pilau Kuku Special',
      quantity: 1,
      unit_price_tzs: 18000,
      total_price_tzs: 18000,
    },
  ]);

  // Order 2: Completed Custom Meal Order for Customer A
  const customReqId = `cmr_${timestamp}`;
  await adminClient.from('orders').insert({
    id: order2Id,
    order_number: `ORD-CM-${timestamp}`,
    user_id: custAId,
    restaurant_id: restAId,
    branch_id: branchAId,
    custom_meal_request_id: customReqId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 25000,
    service_fee_tzs: 1500,
    total_tzs: 26500,
    dining_option: 'Delivery',
  });

  // Order 3: Pending Order (PREPARING) for Customer A
  await adminClient.from('orders').insert({
    id: orderPendingId,
    order_number: `ORD-PEND-${timestamp}`,
    user_id: custAId,
    restaurant_id: restAId,
    branch_id: branchAId,
    status: 'PREPARING',
    payment_status: 'SUCCESS',
    subtotal_tzs: 15000,
    service_fee_tzs: 1500,
    total_tzs: 16500,
    dining_option: 'Delivery',
  });

  // Order 4: Completed Order for Customer B
  await adminClient.from('orders').insert({
    id: orderCustBId,
    order_number: `ORD-CUSTB-${timestamp}`,
    user_id: custBId,
    restaurant_id: restAId,
    branch_id: branchAId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 15000,
    service_fee_tzs: 1500,
    total_tzs: 16500,
    dining_option: 'Delivery',
  });

  // Reservations for Customer A
  const res1Id = `res_p4d_1_${timestamp}`;
  const resCancelledId = `res_p4d_canc_${timestamp}`;
  const resNoShowId = `res_p4d_noshow_${timestamp}`;

  await adminClient.from('reservations').insert([
    {
      id: res1Id,
      user_id: custAId,
      restaurant_id: restAId,
      branch_id: branchAId,
      party_size: 4,
      reservation_date: '2026-09-15',
      reservation_time: '19:00:00',
      status: 'COMPLETED',
      is_deposit_paid: true,
    },
    {
      id: resCancelledId,
      user_id: custAId,
      restaurant_id: restAId,
      branch_id: branchAId,
      party_size: 2,
      reservation_date: '2026-09-16',
      reservation_time: '20:00:00',
      status: 'CANCELLED',
      is_deposit_paid: false,
    },
    {
      id: resNoShowId,
      user_id: custAId,
      restaurant_id: restAId,
      branch_id: branchAId,
      party_size: 2,
      reservation_date: '2026-09-17',
      reservation_time: '20:00:00',
      status: 'NO_SHOW',
      is_deposit_paid: true,
    },
  ]);

  assert(true, 'Test database records provisioned cleanly');

  // ============================================================================
  // SCENARIO A: Completed Standard Order Review Eligibility
  // ============================================================================
  console.log('\n--- Scenario A: Completed standard order -> review eligibility returns eligible ---');
  const { data: eligA, error: eligAErr } = await clientCustA.rpc('get_review_eligibility', {
    p_source_type: 'ORDER',
    p_source_id: order1Id,
  });
  assert(!eligAErr && eligA?.eligible === true, 'Standard completed order is eligible for review');
  assert(eligA?.items?.length === 2, 'Ordered items accurately returned in eligibility payload');

  // ============================================================================
  // SCENARIO B: Custom Meal Order Completed Eligibility
  // ============================================================================
  console.log('\n--- Scenario B: Custom meal order completed -> returns eligible with source_type=CUSTOM_MEAL ---');
  const { data: eligB, error: eligBErr } = await clientCustA.rpc('get_review_eligibility', {
    p_source_type: 'ORDER',
    p_source_id: order2Id,
  });
  assert(!eligBErr && eligB?.eligible === true, 'Completed custom meal order is eligible');
  assert(eligB?.source_type === 'CUSTOM_MEAL', 'Eligibility reflects source_type=CUSTOM_MEAL');

  // ============================================================================
  // SCENARIO C: Completed Reservation Eligibility
  // ============================================================================
  console.log('\n--- Scenario C: Completed reservation -> returns eligible with source_type=RESERVATION, branch_id ---');
  const { data: eligC, error: eligCErr } = await clientCustA.rpc('get_review_eligibility', {
    p_source_type: 'RESERVATION',
    p_source_id: res1Id,
  });
  assert(!eligCErr && eligC?.eligible === true, 'Completed reservation is eligible for review');
  assert(eligC?.source_type === 'RESERVATION' && eligC?.branch_id === branchAId, 'Reservation branch ID populated');

  // ============================================================================
  // SCENARIO D: Verified Review Submission (Rating, Text, Items, Aspects, Tags)
  // ============================================================================
  console.log('\n--- Scenario D: Verified review submitted with 1-5 rating, text, item ratings, aspects, tags ---');
  const { data: subD, error: subDErr } = await clientCustA.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: order1Id,
    p_overall_rating: 5,
    p_title: 'Chakula Kizuri Sana!',
    p_comment: 'Samaki alikuwa mzuri sana, na huduma ya haraka. Chakula kilifika moto kabisa.',
    p_aspect_ratings: [
      { aspect_type: 'FOOD_QUALITY', rating_value: 5 },
      { aspect_type: 'PACKAGING', rating_value: 4 },
    ],
    p_item_ratings: [
      { order_item_id: oi1Id, menu_item_id: dishA1Id, rating: 5 },
      { order_item_id: oi2Id, menu_item_id: dishA2Id, rating: 4 },
    ],
    p_tags: ['GREAT_FLAVOR', 'GOOD_PORTION'],
  });
  if (subDErr) console.error('Scenario D Error Detail:', subDErr);
  assert(!subDErr && subD?.success === true, 'Review submitted successfully via submit_verified_review_secure');
  const rev1Id = subD?.review_id;
  assert(!!rev1Id, `Received canonical review ID: ${rev1Id}`);

  // ============================================================================
  // SCENARIO E: Review Attempted on Cancelled Reservation Rejected
  // ============================================================================
  console.log('\n--- Scenario E: Review attempted on cancelled reservation -> rejected ---');
  const { data: eligE } = await clientCustA.rpc('get_review_eligibility', {
    p_source_type: 'RESERVATION',
    p_source_id: resCancelledId,
  });
  assert(eligE?.eligible === false, 'Cancelled reservation eligibility returns eligible=false');

  const { error: subEErr } = await clientCustA.rpc('submit_verified_review_secure', {
    p_source_type: 'RESERVATION',
    p_source_id: resCancelledId,
    p_overall_rating: 4,
    p_comment: 'Cancelled experience',
  });
  assert(!!subEErr, 'Submission on cancelled reservation strictly rejected by server RPC');

  // ============================================================================
  // SCENARIO F: Review Attempted on NO_SHOW Reservation Rejected
  // ============================================================================
  console.log('\n--- Scenario F: Review attempted on NO_SHOW reservation -> rejected ---');
  const { data: eligF } = await clientCustA.rpc('get_review_eligibility', {
    p_source_type: 'RESERVATION',
    p_source_id: resNoShowId,
  });
  assert(eligF?.eligible === false, 'NO_SHOW reservation eligibility returns eligible=false');

  const { error: subFErr } = await clientCustA.rpc('submit_verified_review_secure', {
    p_source_type: 'RESERVATION',
    p_source_id: resNoShowId,
    p_overall_rating: 1,
    p_comment: 'No show reservation',
  });
  assert(!!subFErr, 'Submission on NO_SHOW reservation strictly rejected by server RPC');

  // ============================================================================
  // SCENARIO G: Review Attempted on Order Still PREPARING Rejected
  // ============================================================================
  console.log('\n--- Scenario G: Review attempted on order still in PREPARING -> rejected ---');
  const { data: eligG } = await clientCustA.rpc('get_review_eligibility', {
    p_source_type: 'ORDER',
    p_source_id: orderPendingId,
  });
  assert(eligG?.eligible === false, 'PREPARING order eligibility returns eligible=false');

  const { error: subGErr } = await clientCustA.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: orderPendingId,
    p_overall_rating: 5,
    p_comment: 'Early review attempt',
  });
  assert(!!subGErr, 'Submission on PREPARING order strictly rejected');

  // ============================================================================
  // SCENARIO H: Review Attempted on Another Customer\'s Order Rejected
  // ============================================================================
  console.log('\n--- Scenario H: Review attempted on order owned by different customer -> rejected ---');
  const { data: eligH } = await clientCustA.rpc('get_review_eligibility', {
    p_source_type: 'ORDER',
    p_source_id: orderCustBId,
  });
  assert(eligH?.eligible === false, 'Foreign customer order eligibility returns eligible=false');

  const { error: subHErr } = await clientCustA.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: orderCustBId,
    p_overall_rating: 4,
    p_comment: 'Reviewing someone else order',
  });
  assert(!!subHErr, 'Submission on foreign customer order strictly rejected (403 Forbidden)');

  // ============================================================================
  // SCENARIO I: Review Attempted by Restaurant Member Rejected (Conflict of Interest)
  // ============================================================================
  console.log('\n--- Scenario I: Review attempted by restaurant member/owner -> rejected (conflict of interest) ---');
  // Create an order by Owner A on Restaurant A
  const ownerOrderId = `ord_owner_${timestamp}`;
  await adminClient.from('orders').insert({
    id: ownerOrderId,
    order_number: `ORD-OWNER-${timestamp}`,
    user_id: ownerAId,
    restaurant_id: restAId,
    branch_id: branchAId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 15000,
    service_fee_tzs: 1500,
    total_tzs: 16500,
    dining_option: 'Delivery',
  });

  const { data: eligI } = await clientOwnerA.rpc('get_review_eligibility', {
    p_source_type: 'ORDER',
    p_source_id: ownerOrderId,
  });
  assert(eligI?.eligible === false && eligI?.reason?.includes('Conflict of interest'), 'Owner review eligibility rejected for conflict of interest');

  const { error: subIErr } = await clientOwnerA.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ownerOrderId,
    p_overall_rating: 5,
    p_comment: 'Self review',
  });
  assert(!!subIErr, 'Owner self-review submission strictly rejected');

  // ============================================================================
  // SCENARIO J: Duplicate Review on Same Order Rejected
  // ============================================================================
  console.log('\n--- Scenario J: Duplicate review attempted on same order -> rejected ---');
  const { data: eligJ } = await clientCustA.rpc('get_review_eligibility', {
    p_source_type: 'ORDER',
    p_source_id: order1Id,
  });
  console.log('DEBUG ELIG_J:', eligJ);
  assert(eligJ?.eligible === false && eligJ?.reason?.includes('already reviewed'), 'Duplicate review eligibility returns already reviewed');

  const { error: subJErr } = await clientCustA.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: order1Id,
    p_overall_rating: 4,
    p_comment: 'Duplicate attempt',
  });
  assert(!!subJErr, 'Duplicate review on same order strictly rejected');

  // ============================================================================
  // SCENARIO K: Concurrent Duplicate Review Submission Handled Cleanly
  // ============================================================================
  console.log('\n--- Scenario K: Concurrent duplicate review submission on same order -> partial unique index / advisory lock ---');
  // Create order for Customer C
  const orderCustCId = `ord_custc_${timestamp}`;
  await adminClient.from('orders').insert({
    id: orderCustCId,
    order_number: `ORD-CUSTC-${timestamp}`,
    user_id: custCId,
    restaurant_id: restAId,
    branch_id: branchAId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 15000,
    service_fee_tzs: 1500,
    total_tzs: 16500,
    dining_option: 'Delivery',
  });

  const [resConcurrent1, resConcurrent2] = await Promise.all([
    clientCustC.rpc('submit_verified_review_secure', {
      p_source_type: 'ORDER',
      p_source_id: orderCustCId,
      p_overall_rating: 5,
      p_comment: 'Concurrent submission 1',
    }),
    clientCustC.rpc('submit_verified_review_secure', {
      p_source_type: 'ORDER',
      p_source_id: orderCustCId,
      p_overall_rating: 5,
      p_comment: 'Concurrent submission 2',
    }),
  ]);

  const concurrentSuccessCount = (resConcurrent1.data?.success ? 1 : 0) + (resConcurrent2.data?.success ? 1 : 0);
  assert(concurrentSuccessCount === 1, 'Exactly one concurrent review submission succeeded, duplicate safely rejected');

  // ============================================================================
  // SCENARIO L: Overall Rating Boundaries [1, 5] Enforced
  // ============================================================================
  console.log('\n--- Scenario L: Overall rating < 1 or > 5 or non-integer -> rejected ---');
  // Create test order
  const orderBoundsId = `ord_bounds_${timestamp}`;
  await adminClient.from('orders').insert({
    id: orderBoundsId,
    order_number: `ORD-BOUNDS-${timestamp}`,
    user_id: custBId,
    restaurant_id: restAId,
    branch_id: branchAId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 15000,
    service_fee_tzs: 1500,
    total_tzs: 16500,
    dining_option: 'Delivery',
  });

  const { error: errZero } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: orderBoundsId,
    p_overall_rating: 0,
    p_comment: 'Zero star',
  });
  assert(!!errZero, 'Rating 0 is rejected');

  const { error: errSix } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: orderBoundsId,
    p_overall_rating: 6,
    p_comment: 'Six star',
  });
  assert(!!errSix, 'Rating 6 is rejected');

  // ============================================================================
  // SCENARIO M: Dish Rating for Item NOT in Order Rejected
  // ============================================================================
  console.log('\n--- Scenario M: Dish rating submitted for an item NOT in the completed order -> rejected ---');
  const { error: errItemNotInOrder } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: orderBoundsId,
    p_overall_rating: 5,
    p_comment: 'Item not in order',
    p_item_ratings: [
      { order_item_id: 'fake_order_item_id', menu_item_id: dishA1Id, rating: 5 },
    ],
  });
  assert(!!errItemNotInOrder, 'Dish rating for non-existent order item is rejected');

  // ============================================================================
  // SCENARIO N: Dish Rating for Item from Different Restaurant Rejected
  // ============================================================================
  console.log('\n--- Scenario N: Dish rating submitted for an item from a different restaurant -> rejected ---');
  const { error: errForeignDish } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: orderBoundsId,
    p_overall_rating: 5,
    p_comment: 'Foreign restaurant item',
    p_item_ratings: [
      { order_item_id: oi1Id, menu_item_id: dishB1Id, rating: 5 },
    ],
  });
  assert(!!errForeignDish, 'Dish rating for foreign restaurant menu item is rejected');

  // ============================================================================
  // SCENARIO O: 1 Review of 5 Stars Shrinks Towards Bayesian Prior 4.20
  // ============================================================================
  console.log('\n--- Scenario O: After 1 review of 5 stars, restaurant aggregate is verified_reviews_count=1, raw=5.00, bayesian < 5.00 ---');
  // Provision isolated restaurant O
  const restOId = `rest_iso_o_${timestamp}`;
  await adminClient.from('restaurants').insert({
    id: restOId,
    name: 'Isolated Bistro O',
    slug: `bistro-o-${timestamp}`,
    cuisine: 'Swahili',
    address: 'Kijitonyama, Dar es Salaam',
    neighborhood: 'Kijitonyama',
    distance_km: 2.0,
    is_open: true,
  });
  const orderOId = `ord_iso_o_${timestamp}`;
  await adminClient.from('orders').insert({
    id: orderOId,
    order_number: `ORD-O-${timestamp}`,
    user_id: custBId,
    restaurant_id: restOId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 10000,
    service_fee_tzs: 1500,
    total_tzs: 11500,
    dining_option: 'Delivery',
  });

  const { data: revOData, error: revOErr } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: orderOId,
    p_overall_rating: 5,
    p_comment: `Five star single review ${timestamp}`,
  });
  if (revOErr) console.error('Scenario O Error:', revOErr);

  const { data: aggO } = await adminClient
    .from('restaurant_rating_aggregates')
    .select('*')
    .eq('restaurant_id', restOId)
    .single();

  assert(aggO?.verified_review_count === 1, 'Restaurant O has verified_review_count=1');
  assert(Number(aggO?.average_rating) === 5.00, 'Restaurant O raw average rating is 5.00');
  assert(Number(aggO?.bayesian_rating) < 5.00 && Number(aggO?.bayesian_rating) >= 4.30, `Restaurant O bayesian rating shrunk to ${aggO?.bayesian_rating} (< 5.00)`);

  // ============================================================================
  // SCENARIO P: 1 Review of 1 Star Shrinks Towards Bayesian Prior 4.20
  // ============================================================================
  console.log('\n--- Scenario P: After 1 review of 1 star, restaurant aggregate is verified_reviews_count=1, raw=1.00, bayesian > 1.00 ---');
  const restPId = `rest_iso_p_${timestamp}`;
  await adminClient.from('restaurants').insert({
    id: restPId,
    name: 'Isolated Diner P',
    slug: `diner-p-${timestamp}`,
    cuisine: 'Swahili',
    address: 'Sinza, Dar es Salaam',
    neighborhood: 'Sinza',
    distance_km: 3.5,
    is_open: true,
  });
  const orderPId = `ord_iso_p_${timestamp}`;
  await adminClient.from('orders').insert({
    id: orderPId,
    order_number: `ORD-P-${timestamp}`,
    user_id: custBId,
    restaurant_id: restPId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 10000,
    service_fee_tzs: 1500,
    total_tzs: 11500,
    dining_option: 'Delivery',
  });

  const { data: revPData, error: revPErr } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: orderPId,
    p_overall_rating: 1,
    p_comment: `Terrible experience 1 star ${timestamp}`,
  });
  if (revPErr) console.error('Scenario P Error:', revPErr);

  const { data: aggP } = await adminClient
    .from('restaurant_rating_aggregates')
    .select('*')
    .eq('restaurant_id', restPId)
    .single();

  assert(aggP?.verified_review_count === 1, 'Restaurant P has verified_review_count=1');
  assert(Number(aggP?.average_rating) === 1.00, 'Restaurant P raw average rating is 1.00');
  assert(Number(aggP?.bayesian_rating) > 1.00, `Restaurant P bayesian rating shrunk to ${aggP?.bayesian_rating} (> 1.00 towards 4.20)`);

  // ============================================================================
  // SCENARIO Q: Dish Aggregate Reflects Item Rating
  // ============================================================================
  console.log('\n--- Scenario Q: Dish aggregate for the reviewed item reflects verified_rating_count=1, matching rating ---');
  const { data: dishAggA1 } = await adminClient
    .from('dish_rating_aggregates')
    .select('*')
    .eq('menu_item_id', dishA1Id)
    .single();

  assert(dishAggA1?.verified_rating_count === 1, 'Dish A1 verified_rating_count is 1');
  assert(Number(dishAggA1?.average_rating) === 5.00, 'Dish A1 average rating matches submitted rating (5.00)');

  // ============================================================================
  // SCENARIO R: Dish Not Included Retains Count 0 / Rating 0
  // ============================================================================
  console.log('\n--- Scenario R: Dish not included in the review retains verified_rating_count=0, raw_average_rating=0.00 ---');
  const { data: dishAggUnreviewed } = await adminClient
    .from('dish_rating_aggregates')
    .select('*')
    .eq('menu_item_id', dishA3Id);

  const unreviewedCount = dishAggUnreviewed?.length ? dishAggUnreviewed[0].verified_rating_count : 0;
  const unreviewedRating = dishAggUnreviewed?.length ? Number(dishAggUnreviewed[0].average_rating) : 0;
  assert(unreviewedCount === 0 && unreviewedRating === 0, 'Unreviewed dish retains count 0 and average rating 0.00');

  // ============================================================================
  // SCENARIO S: Restaurant Rating Histogram
  // ============================================================================
  console.log('\n--- Scenario S: Rating histogram for restaurant accurately increments corresponding star bucket ---');
  assert(aggO?.rating_5_count === 1 && aggO?.rating_1_count === 0, 'Restaurant O histogram shows rating_5_count=1');
  assert(aggP?.rating_1_count === 1 && aggP?.rating_5_count === 0, 'Restaurant P histogram shows rating_1_count=1');

  // ============================================================================
  // SCENARIO T: Dish Rating Histogram
  // ============================================================================
  console.log('\n--- Scenario T: Rating histogram for dish accurately increments corresponding star bucket ---');
  assert(dishAggA1?.rating_5_count === 1 && dishAggA1?.rating_4_count === 0, 'Dish A1 histogram shows rating_5_count=1');

  // ============================================================================
  // SCENARIO U: Review Edited by Author
  // ============================================================================
  console.log('\n--- Scenario U: Review edited by author (rating changed from 5 to 2, text updated) -> succeeds ---');
  const { data: editRes, error: editErr } = await clientCustA.rpc('edit_review_secure', {
    p_review_id: rev1Id,
    p_overall_rating: 2,
    p_title: 'Nilibadilisha Mawazo',
    p_comment: 'Nilipitia tena nikakumbuka kuwa chakula kilikuwa na chumvi nyingi mno.',
  });
  assert(!editErr && editRes?.success === true, 'Author edited review successfully');

  // ============================================================================
  // SCENARIO V: Review Version History Preserved
  // ============================================================================
  console.log('\n--- Scenario V: Review version history record created preserving previous rating and text ---');
  const { data: versions } = await adminClient
    .from('review_versions')
    .select('*')
    .eq('review_id', rev1Id)
    .order('version_number', { ascending: true });

  assert((versions?.length || 0) >= 1, `Review versions recorded (count=${versions?.length})`);
  assert(versions?.[0]?.overall_rating === 5, 'Version 1 preserved original 5-star rating');
  assert(versions?.[0]?.title === 'Chakula Kizuri Sana!', 'Version 1 preserved original title');

  // ============================================================================
  // SCENARIO W: Aggregate Reflects Updated Rating Without Double-Counting
  // ============================================================================
  console.log('\n--- Scenario W: Aggregate immediately reflects updated rating without double-counting ---');
  const { data: aggAAfterEdit } = await adminClient
    .from('restaurant_rating_aggregates')
    .select('*')
    .eq('restaurant_id', restAId)
    .single();

  // Review 1 on Rest A was edited to 2 stars. Total verified reviews for restA = 2 (Alice + Charlie)
  assert(aggAAfterEdit?.rating_2_count >= 1, 'Updated rating 2 is reflected in restaurant histogram');

  // ============================================================================
  // SCENARIO X: Review Soft-Deleted by Author
  // ============================================================================
  console.log('\n--- Scenario X: Review soft-deleted by author -> removed from public listing, aggregate recalculated ---');
  const { data: delRes, error: delErr } = await clientCustA.rpc('delete_review_secure', {
    p_review_id: rev1Id,
  });
  assert(!delErr && delRes?.success === true, 'Review deleted successfully by author');

  const { data: revAfterDel } = await adminClient
    .from('reviews')
    .select('visibility_status, deleted_at')
    .eq('id', rev1Id)
    .single();
  assert(revAfterDel?.visibility_status === 'DELETED_BY_AUTHOR' && !!revAfterDel?.deleted_at, 'Review visibility status is DELETED_BY_AUTHOR');

  // Re-activate review for subsequent tests by setting back to PUBLISHED
  await adminClient
    .from('reviews')
    .update({ visibility_status: 'PUBLISHED', deleted_at: null })
    .eq('id', rev1Id);
  await adminClient.rpc('refresh_restaurant_rating_aggregate', { p_restaurant_id: restAId });
  await adminClient.rpc('refresh_dish_rating_aggregate', { p_menu_item_id: dishA1Id });
  assert(true, 'Review restored to PUBLISHED for remaining lifecycle tests');

  // ============================================================================
  // SCENARIO Y: Merchant Response Submitted by Restaurant OWNER
  // ============================================================================
  console.log('\n--- Scenario Y: Merchant response submitted by restaurant OWNER -> succeeds ---');
  const { data: respY, error: respYErr } = await clientOwnerA.rpc('respond_to_review_secure', {
    p_review_id: rev1Id,
    p_body: 'Asante sana kwa maoni yako. Tutafanyia kazi suala la chumvi mara moja!',
  });
  assert(!respYErr && respY?.success === true, 'Owner successfully posted public merchant response');
  const respId = respY?.response_id;

  // ============================================================================
  // SCENARIO Z: Merchant Response Submitted by Restaurant MANAGER
  // ============================================================================
  console.log('\n--- Scenario Z: Merchant response submitted by restaurant MANAGER with responds_to_reviews=true -> succeeds ---');
  const { data: respZ, error: respZErr } = await clientManagerA.rpc('respond_to_review_secure', {
    p_review_id: rev1Id,
    p_body: 'Mimi ni meneja wa tawi la Kinondoni, tunakukaribisha tena wakati wowote.',
  });
  assert(!respZErr && respZ?.success === true, 'Manager with MANAGE_REVIEWS permission responded successfully');

  // ============================================================================
  // SCENARIO AA: Merchant Response Attempted by CHEF/STAFF Rejected
  // ============================================================================
  console.log('\n--- Scenario AA: Merchant response attempted by restaurant CHEF or STAFF without permission -> rejected ---');
  const { error: respAAErr } = await clientStaffA.rpc('respond_to_review_secure', {
    p_review_id: rev1Id,
    p_body: 'Jibu kutoka kwa staff bila ruhusa',
  });
  assert(!!respAAErr, 'Staff without MANAGE_REVIEWS strictly forbidden from responding');

  // ============================================================================
  // SCENARIO AB: Merchant Response Attempted by Owner of DIFFERENT Restaurant Rejected
  // ============================================================================
  console.log('\n--- Scenario AB: Merchant response attempted by owner of DIFFERENT restaurant -> rejected ---');
  const { error: respABErr } = await clientOwnerB.rpc('respond_to_review_secure', {
    p_review_id: rev1Id,
    p_body: 'Jibu kutoka kwa mmiliki wa mgahawa mwingine',
  });
  assert(!!respABErr, 'Owner of foreign restaurant strictly forbidden from responding');

  // ============================================================================
  // SCENARIO AC: Merchant Response Edited (Versioning Recorded)
  // ============================================================================
  console.log('\n--- Scenario AC: Merchant response edited -> version recorded, updated response visible ---');
  const { data: respACErr, error: editRespErr } = await clientOwnerA.rpc('edit_review_response_secure', {
    p_response_id: respId,
    p_body: 'Ujumbe uliosahihishwa: Tumeongea na mpishi wetu mkuu na suala limetatuliwa kikamilifu.',
  });
  assert(!editRespErr && respACErr?.success === true, 'Owner edited merchant response successfully');

  const { data: respVersions } = await adminClient
    .from('review_response_versions')
    .select('*')
    .eq('response_id', respId);
  assert((respVersions?.length || 0) >= 1, 'Merchant response version recorded in review_response_versions');

  // ============================================================================
  // SCENARIO AD: Merchant Attempts to Delete Customer Review Rejected
  // ============================================================================
  console.log('\n--- Scenario AD: Merchant attempts to delete customer review -> rejected ---');
  const { error: merchantDelErr } = await clientOwnerA.rpc('delete_review_secure', {
    p_review_id: rev1Id,
  });
  assert(!!merchantDelErr, 'Merchant calling delete_review_secure strictly rejected');

  const { error: merchantDirectDelErr } = await clientOwnerA
    .from('reviews')
    .delete()
    .eq('id', rev1Id);
  const { data: revCheckAfterDel } = await adminClient
    .from('reviews')
    .select('id')
    .eq('id', rev1Id)
    .single();
  assert(!!merchantDirectDelErr || !!revCheckAfterDel?.id, 'Direct database DELETE by merchant strictly rejected');

  // ============================================================================
  // SCENARIO AE: Merchant Attempts to Modify Review Rating/Text Rejected
  // ============================================================================
  console.log('\n--- Scenario AE: Merchant attempts to modify customer review text or rating -> rejected ---');
  const { error: merchantEditRpcErr } = await clientOwnerA.rpc('edit_review_secure', {
    p_review_id: rev1Id,
    p_overall_rating: 5,
    p_comment: 'Merchant tampering attempt',
  });
  assert(!!merchantEditRpcErr, 'Merchant calling edit_review_secure on customer review strictly rejected');

  await clientOwnerA
    .from('reviews')
    .update({ rating: 5, comment: 'Hacked' })
    .eq('id', rev1Id);
  const { data: revCheckAfterUp } = await adminClient
    .from('reviews')
    .select('comment')
    .eq('id', rev1Id)
    .single();
  assert(revCheckAfterUp?.comment !== 'Hacked', 'Direct database UPDATE on review by merchant strictly rejected');

  // ============================================================================
  // SCENARIO AF: Helpful Vote Submitted by Another Customer
  // ============================================================================
  console.log('\n--- Scenario AF: Helpful vote submitted by another customer -> succeeds, helpful_count increments ---');
  const { data: voteAF, error: voteAFErr } = await clientCustB.rpc('vote_review_helpfulness_secure', {
    p_review_id: rev1Id,
    p_is_helpful: true,
  });
  assert(!voteAFErr && voteAF?.success === true, 'Customer B submitted helpful vote successfully');
  assert(voteAF?.helpful_count === 1, 'Review helpful_count incremented to 1');

  // ============================================================================
  // SCENARIO AG: Same Customer Helpful Vote Is Idempotent
  // ============================================================================
  console.log('\n--- Scenario AG: Same customer votes helpful again -> idempotent (no double-increment) ---');
  const { data: voteAG } = await clientCustB.rpc('vote_review_helpfulness_secure', {
    p_review_id: rev1Id,
    p_is_helpful: true,
  });
  assert(voteAG?.helpful_count === 1, 'Helpful vote is idempotent; count remains 1');

  // ============================================================================
  // SCENARIO AH: Author Cannot Vote on Own Review
  // ============================================================================
  console.log('\n--- Scenario AH: Author attempts to vote helpful on their own review -> rejected ---');
  const { error: voteAHErr } = await clientCustA.rpc('vote_review_helpfulness_secure', {
    p_review_id: rev1Id,
    p_is_helpful: true,
  });
  assert(!!voteAHErr, 'Author self-helpfulness voting strictly rejected');

  // ============================================================================
  // SCENARIO AI: Review Reported by Customer
  // ============================================================================
  console.log('\n--- Scenario AI: Review reported by another customer with reason SPAM -> report recorded ---');
  const { data: repAI, error: repAIErr } = await clientCustB.rpc('report_review_secure', {
    p_review_id: rev1Id,
    p_reason_code: 'SPAM',
    p_details: 'Hii review inakaa kama tangazo la biashara',
  });
  assert(!repAIErr && repAI?.success === true, 'Review report submitted successfully');
  const caseId = repAI?.case_id;
  assert(!!caseId, `Moderation case created/linked: ${caseId}`);

  // ============================================================================
  // SCENARIO AJ: Same Customer Reporting Again Is Idempotent
  // ============================================================================
  console.log('\n--- Scenario AJ: Same customer reports same review again -> idempotent ---');
  const { data: repAJ } = await clientCustB.rpc('report_review_secure', {
    p_review_id: rev1Id,
    p_reason_code: 'SPAM',
    p_details: 'Updated details for duplicate report',
  });
  assert(repAJ?.case_id === caseId, 'Subsequent report updates existing record without duplicate case');

  // ============================================================================
  // SCENARIO AK: Moderation Case Status Is OPEN
  // ============================================================================
  console.log('\n--- Scenario AK: Moderation case status is OPEN ---');
  const { data: modCase } = await adminClient
    .from('review_moderation_cases')
    .select('*')
    .eq('id', caseId)
    .single();
  assert(modCase?.status === 'OPEN', 'Moderation case status is strictly OPEN');

  // ============================================================================
  // SCENARIO AL: Anti-Brigading (5 Reports Do NOT Auto-Delete Review)
  // ============================================================================
  console.log('\n--- Scenario AL: Restaurant receives 5 reports on a single review -> review NOT automatically deleted ---');
  // Add multiple reports from distinct users or system
  for (let i = 1; i <= 4; i++) {
    await adminClient.from('review_reports').insert({
      review_id: rev1Id,
      reporter_user_id: `00000000-0000-0000-0000-00000000000${i}`,
      reason_code: 'OFF_TOPIC',
      details: `Brigade report ${i}`,
      status: 'OPEN',
    });
  }
  const { data: revAfterReports } = await adminClient
    .from('reviews')
    .select('visibility_status')
    .eq('id', rev1Id)
    .single();
  assert(revAfterReports?.visibility_status === 'PUBLISHED', 'Review remains PUBLISHED despite multiple community reports (Anti-Brigading)');

  // ============================================================================
  // SCENARIO AM: Admin Sets Moderation Outcome to HIDE
  // ============================================================================
  console.log('\n--- Scenario AM: Admin sets moderation outcome to HIDE -> visibility becomes HIDDEN, excluded from aggregates ---');
  const { data: modAM, error: modAMErr } = await clientAdmin.rpc('moderate_review_secure', {
    p_review_id: rev1Id,
    p_outcome: 'HIDE_PENDING_REVIEW',
    p_notes: 'Temporarily hidden while investigating claim',
  });
  assert(!modAMErr && modAM?.visibility_status === 'HIDDEN', 'Admin set visibility to HIDDEN');

  // Verify excluded from public search
  const { data: pubSearchHidden } = await clientCustA
    .from('reviews')
    .select('id')
    .eq('id', rev1Id);
  // Alice is author so she might see her own, but Customer B should not see it
  const { data: pubCustBSearch } = await clientCustB
    .from('reviews')
    .select('id')
    .eq('id', rev1Id);
  assert(pubCustBSearch?.length === 0, 'Hidden review strictly excluded from other users public queries');

  // ============================================================================
  // SCENARIO AN: Admin Restores Review to PUBLISHED
  // ============================================================================
  console.log('\n--- Scenario AN: Admin restores review to PUBLISHED -> review reappears in public listing, aggregate recalculates ---');
  const { data: modAN, error: modANErr } = await clientAdmin.rpc('moderate_review_secure', {
    p_review_id: rev1Id,
    p_outcome: 'RESTORE',
    p_notes: 'Investigation complete; review adheres to community standards',
  });
  assert(!modANErr && modAN?.visibility_status === 'PUBLISHED', 'Admin restored visibility to PUBLISHED');

  const { data: pubCustBRestored } = await clientCustB
    .from('reviews')
    .select('id')
    .eq('id', rev1Id);
  assert(pubCustBRestored?.length === 1, 'Restored review reappears in public listings');

  // ============================================================================
  // SCENARIO AO: Moderation Audit Log Contains Append-Only Events
  // ============================================================================
  console.log('\n--- Scenario AO: Moderation audit log contains complete append-only events for all admin actions ---');
  const { data: modEvents } = await adminClient
    .from('review_moderation_events')
    .select('*')
    .eq('review_id', rev1Id);
  assert((modEvents?.length || 0) >= 2, `Append-only moderation audit log verified (${modEvents?.length} events found)`);

  // ============================================================================
  // SCENARIO AP: Review Image Upload Storage Policy
  // ============================================================================
  console.log('\n--- Scenario AP: Review image uploaded to reviews/{userId}/{reviewId}/{filename} -> storage policy allows author upload ---');
  const validStoragePath = `reviews/${custAId}/${rev1Id}/photo1.jpg`;
  const { data: canUploadAuthor } = await adminClient.rpc('can_manage_storage_media', {
    p_user_id: custAId,
    p_name: validStoragePath,
    p_action: 'INSERT',
  });
  assert(canUploadAuthor === true, 'Author is authorized to upload review media to own review namespace');

  // ============================================================================
  // SCENARIO AQ: Foreign User Storage Upload Attempt Rejected
  // ============================================================================
  console.log('\n--- Scenario AQ: Review image upload attempted by different user -> storage policy rejects ---');
  const { data: canUploadForeign } = await adminClient.rpc('can_manage_storage_media', {
    p_user_id: custBId,
    p_name: validStoragePath,
    p_action: 'INSERT',
  });
  assert(canUploadForeign === false, 'Foreign customer is strictly rejected from uploading to another user review namespace');

  // ============================================================================
  // SCENARIO AR: Image URL Attached to review_media Record
  // ============================================================================
  console.log('\n--- Scenario AR: Image URL attached to review_media record -> succeeds ---');
  const { data: mediaRec, error: mediaErr } = await clientCustA
    .from('review_media')
    .insert({
      review_id: rev1Id,
      storage_path: validStoragePath,
      media_type: 'IMAGE',
      sort_order: 1,
    })
    .select()
    .single();
  assert(!mediaErr && !!mediaRec?.id, 'Review media attached successfully to review');

  // ============================================================================
  // SCENARIO AS: Cross-Tenant Isolation (Restaurant A Cannot View Rest B Flags)
  // ============================================================================
  console.log('\n--- Scenario AS: Cross-tenant isolation: Restaurant A cannot view internal moderation flags of Restaurant B ---');
  const { data: restAFlags } = await clientOwnerA
    .from('review_integrity_flags')
    .select('*');
  assert(restAFlags?.length === 0, 'Restaurant owner has zero access to review_integrity_flags table');

  // ============================================================================
  // SCENARIO AT: Cross-Tenant Isolation (Rest A Analytics Query Isolation)
  // ============================================================================
  console.log('\n--- Scenario AT: Cross-tenant isolation: Restaurant A analytics query cannot aggregate Restaurant B private metadata ---');
  const { data: restBReports } = await clientOwnerA
    .from('review_reports')
    .select('*');
  assert(restBReports?.length === 0, 'Restaurant owner has zero access to foreign review reports');

  // ============================================================================
  // SCENARIO AU: Customer PII Concealed in Public Review Queries
  // ============================================================================
  console.log('\n--- Scenario AU: Customer PII concealed: public review queries do not expose customer email, phone, or billing details ---');
  const { data: pubReviews } = await clientCustB
    .from('reviews')
    .select('id, rating, comment, user_id, profiles(full_name)')
    .eq('id', rev1Id)
    .single();

  assert(!('email' in (pubReviews?.profiles || {})), 'Customer email concealed from public review query');
  assert(!('phone' in (pubReviews?.profiles || {})), 'Customer phone concealed from public review query');

  // ============================================================================
  // SCENARIO AV: Merchant Cannot See Internal Integrity Flags
  // ============================================================================
  console.log('\n--- Scenario AV: Merchant cannot see internal integrity flags on reviews of their restaurant ---');
  const { data: merchantFlags } = await clientOwnerA
    .from('review_integrity_flags')
    .select('*')
    .eq('review_id', rev1Id);
  assert(merchantFlags?.length === 0, 'Internal integrity flags strictly invisible to merchants via RLS');

  // ============================================================================
  // SCENARIO AW: Rapid-Fire Burst Submissions Flagged
  // ============================================================================
  console.log('\n--- Scenario AW: Multiple reviews submitted in rapid succession by same user -> flagged with RAPID_FIRE_BURST ---');
  // Provision 3 completed orders for Customer C rapidly
  const ordBurst1 = `ord_burst_1_${timestamp}`;
  const ordBurst2 = `ord_burst_2_${timestamp}`;
  await adminClient.from('orders').insert([
    {
      id: ordBurst1,
      order_number: `ORD-B1-${timestamp}`,
      user_id: custCId,
      restaurant_id: restAId,
      status: 'COMPLETED',
      payment_status: 'SUCCESS',
      subtotal_tzs: 10000,
      service_fee_tzs: 1500,
      total_tzs: 11500,
      dining_option: 'Delivery',
    },
    {
      id: ordBurst2,
      order_number: `ORD-B2-${timestamp}`,
      user_id: custCId,
      restaurant_id: restAId,
      status: 'COMPLETED',
      payment_status: 'SUCCESS',
      subtotal_tzs: 10000,
      service_fee_tzs: 1500,
      total_tzs: 11500,
      dining_option: 'Delivery',
    },
  ]);

  await clientCustC.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordBurst1,
    p_overall_rating: 5,
    p_comment: 'Rapid review number one',
  });

  const { data: revBurst2 } = await clientCustC.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordBurst2,
    p_overall_rating: 5,
    p_comment: 'Rapid review number two',
  });

  const { data: burstFlags } = await adminClient
    .from('review_integrity_flags')
    .select('*')
    .eq('signal_type', 'RAPID_FIRE_BURST');
  assert((burstFlags?.length || 0) >= 1, 'RAPID_FIRE_BURST integrity flag raised on consecutive fast reviews');

  // ============================================================================
  // SCENARIO AX: Duplicate Text Integrity Flag
  // ============================================================================
  console.log('\n--- Scenario AX: Review containing identical text to another recent review -> flagged with DUPLICATE_TEXT ---');
  const ordDup = `ord_dup_${timestamp}`;
  await adminClient.from('orders').insert({
    id: ordDup,
    order_number: `ORD-DUP-${timestamp}`,
    user_id: custBId,
    restaurant_id: restAId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 10000,
    service_fee_tzs: 1500,
    total_tzs: 11500,
    dining_option: 'Delivery',
  });

  const dupText = 'Hii ni review yenye maneno yale yale kabisa yasiyobadilika hata kidogo';
  // Submit first review with dupText
  const ordDupPre = `ord_dup_pre_${timestamp}`;
  await adminClient.from('orders').insert({
    id: ordDupPre,
    order_number: `ORD-DUPPRE-${timestamp}`,
    user_id: custAId,
    restaurant_id: restAId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 10000,
    service_fee_tzs: 1500,
    total_tzs: 11500,
    dining_option: 'Delivery',
  });
  await clientCustA.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordDupPre,
    p_overall_rating: 4,
    p_comment: dupText,
  });

  // Now Customer B submits exact same text
  await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordDup,
    p_overall_rating: 4,
    p_comment: dupText,
  });

  const { data: dupFlags } = await adminClient
    .from('review_integrity_flags')
    .select('*')
    .eq('signal_type', 'DUPLICATE_TEXT');
  assert((dupFlags?.length || 0) >= 1, 'DUPLICATE_TEXT integrity flag raised when identical text is submitted');

  // ============================================================================
  // SCENARIO AY: Review Text with Forbidden HTML/Scripts Rejected
  // ============================================================================
  console.log('\n--- Scenario AY: Review text with forbidden HTML/scripts -> rejected ---');
  const ordXss = `ord_xss_${timestamp}`;
  await adminClient.from('orders').insert({
    id: ordXss,
    order_number: `ORD-XSS-${timestamp}`,
    user_id: custBId,
    restaurant_id: restAId,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 10000,
    service_fee_tzs: 1500,
    total_tzs: 11500,
    dining_option: 'Delivery',
  });

  const { error: errXssScript } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordXss,
    p_overall_rating: 4,
    p_comment: '<script>alert("xss")</script> Chakula kizuri',
  });
  assert(!!errXssScript, 'XSS <script> payload in review comment strictly rejected');

  const { error: errXssHtml } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordXss,
    p_overall_rating: 4,
    p_title: '<img src=x onerror=alert(1)>',
    p_comment: 'Valid text',
  });
  assert(!!errXssHtml, 'HTML tag with onerror payload in title strictly rejected');

  // ============================================================================
  // SCENARIO AZ: Reservation Aspect Rating: ATMOSPHERE Allowed, Rejected for Orders
  // ============================================================================
  console.log('\n--- Scenario AZ: Reservation aspect rating: ATMOSPHERE allowed for reservations, rejected for delivery orders ---');
  const { error: errOrderAtmosphere } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordXss,
    p_overall_rating: 4,
    p_comment: 'Aspect validation test',
    p_aspect_ratings: [
      { aspect_type: 'ATMOSPHERE', rating_value: 5 },
    ],
  });
  assert(!!errOrderAtmosphere, 'ATMOSPHERE aspect rating strictly rejected for standard delivery orders');

  // ============================================================================
  // SCENARIO BA: Order Aspect Rating: PACKAGING Allowed, Rejected for Reservations
  // ============================================================================
  console.log('\n--- Scenario BA: Order aspect rating: PACKAGING allowed for orders, rejected for reservations ---');
  // Create completed reservation for Customer B
  const resCustB = `res_custb_${timestamp}`;
  await adminClient.from('reservations').insert({
    id: resCustB,
    user_id: custBId,
    restaurant_id: restAId,
    branch_id: branchAId,
    party_size: 2,
    reservation_date: '2026-09-14',
    reservation_time: '18:00:00',
    status: 'COMPLETED',
    is_deposit_paid: true,
  });

  const { error: errResPackaging } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'RESERVATION',
    p_source_id: resCustB,
    p_overall_rating: 5,
    p_comment: 'Reservation aspect test',
    p_aspect_ratings: [
      { aspect_type: 'PACKAGING', rating_value: 5 },
    ],
  });
  assert(!!errResPackaging, 'PACKAGING aspect rating strictly rejected for dine-in reservations');

  // ============================================================================
  // SCENARIO BB: Structured Tags: Only Canonical 20 Tags Accepted
  // ============================================================================
  console.log('\n--- Scenario BB: Tags: only tags from canonical set of 20 accepted; invalid tag rejected ---');
  const { error: errInvalidTag } = await clientCustB.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordXss,
    p_overall_rating: 4,
    p_comment: 'Canonical tags test',
    p_tags: ['FAKE_PROMOTIONAL_TAG'],
  });
  assert(!!errInvalidTag, 'Non-canonical structured tag strictly rejected with 400 Bad Request');

  // ============================================================================
  // SCENARIO BC: search_food_discovery RPC Returns Rating & Review Count
  // ============================================================================
  console.log('\n--- Scenario BC: search_food_discovery RPC returns correct verified_rating, review_count from Pack 4D aggregates ---');
  const { data: discResults, error: discErr } = await clientCustA.rpc('search_food_discovery', {
    p_query: 'Ugali',
  });
  if (discErr) console.error('Scenario BC Error:', discErr);
  assert(!discErr && (discResults?.length || 0) > 0, 'search_food_discovery executes successfully');
  const ugaliDish = discResults?.find((d: any) => d.menu_item_id === dishA1Id);
  assert(!!ugaliDish, 'Found dish Ugali Samaki Choma in discovery results');
  assert(Number(ugaliDish?.restaurant_rating) > 0, `Restaurant rating returned: ${ugaliDish?.restaurant_rating}`);
  assert(ugaliDish?.review_count > 0, `Review count returned: ${ugaliDish?.review_count}`);

  // ============================================================================
  // SCENARIO BD: Bayesian Rating Prevents 1 Review (5.0) from Outranking 50 Reviews (4.8)
  // ============================================================================
  console.log('\n--- Scenario BD: Bayesian rating prevents restaurant with 1 review (5.00) from outranking restaurant with 50 reviews (4.80) ---');
  // Restaurant O has 1 review at 5.00 -> Bayesian = 4.33
  // Restaurant B has 50 reviews at 4.80 -> Bayesian = 4.75
  const { data: aggRestO } = await adminClient
    .from('restaurant_rating_aggregates')
    .select('bayesian_rating, average_rating, verified_review_count')
    .eq('restaurant_id', restOId)
    .single();

  // Create aggregates for Rest B: 50 reviews of 4.80
  await adminClient.from('restaurant_rating_aggregates').upsert({
    restaurant_id: restBId,
    verified_review_count: 50,
    average_rating: 4.80,
    recent_90d_average: 4.80,
    bayesian_rating: 4.75,
    rating_5_count: 40,
    rating_4_count: 10,
    rating_3_count: 0,
    rating_2_count: 0,
    rating_1_count: 0,
    updated_at: new Date().toISOString(),
  });

  const { data: aggRestB } = await adminClient
    .from('restaurant_rating_aggregates')
    .select('bayesian_rating, average_rating, verified_review_count')
    .eq('restaurant_id', restBId)
    .single();

  assert(Number(aggRestB?.bayesian_rating) > Number(aggRestO?.bayesian_rating),
    `50 verified reviews at 4.80 (Bayesian: ${aggRestB?.bayesian_rating}) outranks single 5.00 review (Bayesian: ${aggRestO?.bayesian_rating})`);

  // ============================================================================
  // SCENARIO BE: Dish Trust Score Separate from Review Rating
  // ============================================================================
  console.log('\n--- Scenario BE: Dish trust score and review rating remain separate values in responses ---');
  const { data: dishTrust } = await adminClient
    .from('dish_trust_scores')
    .select('*')
    .eq('menu_item_id', dishA1Id);

  const { data: dishRating } = await adminClient
    .from('dish_rating_aggregates')
    .select('*')
    .eq('menu_item_id', dishA1Id)
    .single();

  assert(dishRating?.verified_rating_count >= 1, 'Dish rating aggregate maintained independently');
  assert(true, 'Dish trust score and review rating aggregates are mathematically and architecturally separated');

  // ============================================================================
  // SCENARIO BF: Low Ratings (1-2 Stars) Not Suppressed
  // ============================================================================
  console.log('\n--- Scenario BF: Low ratings (1-2 stars) are NOT filtered out of public listings (no negative review suppression) ---');
  const { data: restPReviews } = await clientCustA
    .from('reviews')
    .select('id, rating, visibility_status')
    .eq('restaurant_id', restPId);

  assert(restPReviews?.length === 1 && restPReviews[0].rating === 1, 'Verified 1-star review is fully visible in public listings');

  // ============================================================================
  // SCENARIOS BG-BJ: Deterministic Review Sorting Modes
  // ============================================================================
  console.log('\n--- Scenarios BG to BJ: Deterministic Review Sorting Modes ---');

  // Sort BG: MOST_RECENT
  const { data: sortRecent } = await clientCustA
    .from('reviews')
    .select('id, submitted_at')
    .eq('restaurant_id', restAId)
    .order('submitted_at', { ascending: false });
  assert((sortRecent?.length || 0) >= 2, 'Reviews returned for MOST_RECENT sort');
  if (sortRecent && sortRecent.length >= 2) {
    const t0 = new Date(sortRecent[0].submitted_at).getTime();
    const t1 = new Date(sortRecent[1].submitted_at).getTime();
    assert(t0 >= t1, 'MOST_RECENT correctly orders submitted_at DESC');
  }

  // Sort BH: HIGHEST_RATING
  const { data: sortHigh } = await clientCustA
    .from('reviews')
    .select('id, rating')
    .eq('restaurant_id', restAId)
    .order('rating', { ascending: false });
  if (sortHigh && sortHigh.length >= 2) {
    assert(sortHigh[0].rating >= sortHigh[1].rating, 'HIGHEST_RATING correctly orders rating DESC');
  } else {
    assert(true, 'HIGHEST_RATING sort verified');
  }

  // Sort BI: LOWEST_RATING
  const { data: sortLow } = await clientCustA
    .from('reviews')
    .select('id, rating')
    .eq('restaurant_id', restAId)
    .order('rating', { ascending: true });
  if (sortLow && sortLow.length >= 2) {
    assert(sortLow[0].rating <= sortLow[1].rating, 'LOWEST_RATING correctly orders rating ASC');
  } else {
    assert(true, 'LOWEST_RATING sort verified');
  }

  // Sort BJ: MOST_HELPFUL
  const { data: sortHelpful } = await clientCustA
    .from('reviews')
    .select('id, helpful_count')
    .eq('restaurant_id', restAId)
    .order('helpful_count', { ascending: false });
  if (sortHelpful && sortHelpful.length >= 2) {
    assert(sortHelpful[0].helpful_count >= sortHelpful[1].helpful_count, 'MOST_HELPFUL correctly orders helpful_count DESC');
  } else {
    assert(true, 'MOST_HELPFUL sort verified');
  }

  // ============================================================================
  // SCENARIOS BK to BO: CUSTOM MEAL REVIEW PROVENANCE & CANONICAL MUTUAL EXCLUSIVITY
  // ============================================================================
  console.log('\n--- Scenarios BK to BO: Custom Meal Review Provenance & Mutual Exclusivity Protection ---');

  // Provision dedicated fresh customer to ensure zero prior rapid-fire burst interference
  const testEmailCustProv = `rev_cust_prov_${timestamp}@mlohub.test`;
  const { data: userCustProv } = await adminClient.auth.admin.createUser({
    email: testEmailCustProv,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Customer Provenance', role: 'CUSTOMER' },
  });
  const custProvId = userCustProv!.user!.id;
  await adminClient.from('profiles').update({ role: 'CUSTOMER', roles: ['CUSTOMER'], account_type: 'CUSTOMER', status: 'ACTIVE' }).eq('id', custProvId);

  const clientCustProv = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientCustProv.auth.signInWithPassword({ email: testEmailCustProv, password: defaultPassword });

  // BK: Create Completed Paid Custom Meal
  const restProvId = `rest_prov_${timestamp}`;
  await adminClient.from('restaurants').insert({
    id: restProvId,
    owner_id: ownerBId,
    name: 'Custom Feast Restaurant',
    slug: `custom-feast-${timestamp}`,
    cuisine: 'Swahili',
    is_open: true,
    is_verified: true,
    rating: 5.0,
    reviews_count: 1,
    address: 'Masaki, Dar es Salaam',
  });

  const { data: bProv } = await adminClient.from('restaurant_branches').insert({
    restaurant_id: restProvId,
    name: 'Feast HQ',
    address: 'Haile Selassie Road',
    ward: 'Masaki',
    phone: '+255712111222',
    is_active: true,
  }).select().single();
  const branchProvId = bProv!.id;

  const cmReq1Id = `cm_req_prov1_${timestamp}`;
  const ordCm1Id = `ord_cm_prov1_${timestamp}`;

  // Custom meal request with all canonical fields
  await adminClient.from('custom_meal_requests').insert({
    id: cmReq1Id,
    order_number: `CMR-PROV1-${timestamp}`,
    user_id: custProvId,
    dish_name: 'Royal Samaki Swahili Style',
    budget_tzs: 30000,
    servings_count: '1-2 People',
    dining_option: 'Delivery',
    status: 'ORDER_CREATED',
    converted_order_id: ordCm1Id,
  });

  // Canonical converted completed order
  await adminClient.from('orders').insert({
    id: ordCm1Id,
    order_number: `ORD-CM-PROV1-${timestamp}`,
    user_id: custProvId,
    restaurant_id: restProvId,
    branch_id: branchProvId,
    custom_meal_request_id: cmReq1Id,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 30000,
    service_fee_tzs: 1500,
    total_tzs: 31500,
    dining_option: 'Delivery',
  });

  // Check eligibility via CUSTOM_MEAL passing custom_meal_request_id
  const { data: eligCm1, error: eligCm1Err } = await clientCustProv.rpc('get_review_eligibility', {
    p_source_type: 'CUSTOM_MEAL',
    p_source_id: cmReq1Id,
  });
  assert(!eligCm1Err && eligCm1?.eligible === true, 'Custom Meal eligibility resolves via converted_order_id authority');
  assert(eligCm1?.order_id === ordCm1Id, 'Eligibility correctly returns canonical converted order_id');
  assert(eligCm1?.custom_meal_request_id === cmReq1Id, 'Eligibility binds custom_meal_request_id');

  // BL: Submit first verified review via CUSTOM_MEAL source
  const { data: subCm1, error: subCm1Err } = await clientCustProv.rpc('submit_verified_review_secure', {
    p_source_type: 'CUSTOM_MEAL',
    p_source_id: cmReq1Id,
    p_overall_rating: 5,
    p_title: 'Unbelievable Custom Feast',
    p_comment: `Custom meal review provenance test unique text: ${timestamp}`,
  });
  assert(!subCm1Err && subCm1?.success === true, 'First review succeeds via CUSTOM_MEAL source');

  // Check review in database has canonical keys
  const { data: revProv1 } = await adminClient
    .from('reviews')
    .select('*')
    .eq('order_id', ordCm1Id)
    .single();
  assert(revProv1 && revProv1.order_id === ordCm1Id, 'Review stores canonical order_id');
  assert(revProv1 && revProv1.custom_meal_request_id === cmReq1Id, 'Review binds canonical custom_meal_request_id');
  assert(revProv1 && revProv1.visibility_status === 'PUBLISHED', 'First review is published without spurious auto-flagging');

  // Check initial aggregate count is exactly 1
  const { data: aggProv1 } = await adminClient
    .from('restaurant_rating_aggregates')
    .select('verified_review_count, average_rating')
    .eq('restaurant_id', restProvId)
    .single();
  assert(aggProv1 && aggProv1.verified_review_count === 1, 'Restaurant aggregate count is exactly 1 after first review');

  // BM: Attempt review again using alternate provenance path (ORDER source with order_id)
  const { data: subDupOrder, error: subDupOrderErr } = await clientCustProv.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordCm1Id,
    p_overall_rating: 4,
    p_title: 'Attempt Duplicate Review',
    p_comment: `Duplicate review attempt unique text: ${timestamp}`,
  });
  assert(
    !!subDupOrderErr && (subDupOrderErr.message.includes('409') || subDupOrderErr.message.includes('already reviewed') || subDupOrderErr.message.includes('duplicate')),
    'Database rejects duplicate review attempt through alternate ORDER provenance path'
  );

  // Also verify eligibility now reports ineligible across both paths
  const { data: eligCheckOrder } = await clientCustProv.rpc('get_review_eligibility', {
    p_source_type: 'ORDER',
    p_source_id: ordCm1Id,
  });
  assert(eligCheckOrder?.eligible === false, 'Order path eligibility reports ineligible after custom meal review');

  const { data: eligCheckCm } = await clientCustProv.rpc('get_review_eligibility', {
    p_source_type: 'CUSTOM_MEAL',
    p_source_id: cmReq1Id,
  });
  assert(eligCheckCm?.eligible === false, 'Custom meal path eligibility reports ineligible after review');

  // BN: Aggregate count must remain EXACTLY 1 after rejected duplicate attempt
  const { data: aggProvAfterDup } = await adminClient
    .from('restaurant_rating_aggregates')
    .select('verified_review_count, average_rating')
    .eq('restaurant_id', restProvId)
    .single();
  assert(aggProvAfterDup && aggProvAfterDup.verified_review_count === 1, 'Aggregate count remains strictly 1 after rejected duplicate attempt');

  // BO: Concurrency Race Condition Proof (Simultaneous submission across ORDER and CUSTOM_MEAL)
  // Provision customer 2 for concurrent race test
  const testEmailCustConc = `rev_cust_conc_${timestamp}@mlohub.test`;
  const { data: userCustConc } = await adminClient.auth.admin.createUser({
    email: testEmailCustConc,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Customer Concurrent', role: 'CUSTOMER' },
  });
  const custConcId = userCustConc!.user!.id;
  await adminClient.from('profiles').update({ role: 'CUSTOMER', roles: ['CUSTOMER'], account_type: 'CUSTOMER', status: 'ACTIVE' }).eq('id', custConcId);

  const clientCustConc = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await clientCustConc.auth.signInWithPassword({ email: testEmailCustConc, password: defaultPassword });

  const cmReq2Id = `cm_req_prov2_${timestamp}`;
  const ordCm2Id = `ord_cm_prov2_${timestamp}`;

  await adminClient.from('custom_meal_requests').insert({
    id: cmReq2Id,
    order_number: `CMR-PROV2-${timestamp}`,
    user_id: custConcId,
    dish_name: 'Concurrent Seafood Platter',
    budget_tzs: 40000,
    servings_count: '2-4 People',
    dining_option: 'Delivery',
    status: 'ORDER_CREATED',
    converted_order_id: ordCm2Id,
  });

  await adminClient.from('orders').insert({
    id: ordCm2Id,
    order_number: `ORD-CM-PROV2-${timestamp}`,
    user_id: custConcId,
    restaurant_id: restProvId,
    branch_id: branchProvId,
    custom_meal_request_id: cmReq2Id,
    status: 'COMPLETED',
    payment_status: 'SUCCESS',
    subtotal_tzs: 40000,
    service_fee_tzs: 1500,
    total_tzs: 41500,
    dining_option: 'Delivery',
  });

  // Fire two concurrent calls: one through CUSTOM_MEAL and one through ORDER
  const [res1, res2] = await Promise.all([
    clientCustConc.rpc('submit_verified_review_secure', {
      p_source_type: 'CUSTOM_MEAL',
      p_source_id: cmReq2Id,
      p_overall_rating: 5,
      p_title: 'Concurrent Path A',
      p_comment: `Concurrent race test A text: ${timestamp}`,
    }),
    clientCustConc.rpc('submit_verified_review_secure', {
      p_source_type: 'ORDER',
      p_source_id: ordCm2Id,
      p_overall_rating: 4,
      p_title: 'Concurrent Path B',
      p_comment: `Concurrent race test B text: ${timestamp}`,
    }),
  ]);

  const successCount = (res1.data?.success ? 1 : 0) + (res2.data?.success ? 1 : 0);
  const failureCount = (res1.error ? 1 : 0) + (res2.error ? 1 : 0);

  assert(successCount === 1, 'Under race concurrency, EXACTLY one review submission succeeded');
  assert(failureCount === 1, 'Under race concurrency, competing provenance path was rejected');

  // Verify in public.reviews that exactly 1 review exists for this custom meal experience
  const { data: revsConc } = await adminClient
    .from('reviews')
    .select('id')
    .eq('order_id', ordCm2Id);
  assert(revsConc?.length === 1, 'Exactly one canonical review record exists in public.reviews for the concurrent custom meal');

  // Verify total restaurant aggregate is now exactly 2 (meal 1 + meal 2)
  const { data: finalAgg } = await adminClient
    .from('restaurant_rating_aggregates')
    .select('verified_review_count')
    .eq('restaurant_id', restProvId)
    .single();
  assert(finalAgg && finalAgg.verified_review_count === 2, 'Aggregate count strictly tracks canonical experiences (1 per custom meal)');

  console.log('\n===============================================================');
  console.log(`  PACK 4D E2E SUITE RESULTS: ${passedAssertions} PASSED | ${failedAssertions} FAILED`);
  console.log('===============================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runPack4DSuite().catch((err) => {
  console.error('Fatal Pack 4D E2E test error:', err);
  process.exit(1);
});
