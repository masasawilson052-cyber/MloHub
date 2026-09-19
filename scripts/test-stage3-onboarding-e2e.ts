/**
 * ============================================================================
 * MLOHUB STAGE 3 STABILIZATION: LIVE E2E ONBOARDING & DISCOVERY INTEGRATION TEST
 * ============================================================================
 * Verifies the complete authentic lifecycle against local Supabase:
 * 1. Real applicant submits application -> public.restaurant_applications
 * 2. Admin inspects queue -> calls approve_restaurant_application RPC
 * 3. Canonical restaurant & owner membership created (no fake menu/branches)
 * 4. Gating: Unpublished restaurant is invisible in discovery
 * 5. Publish prerequisites: Cannot publish without active branch & menu item
 * 6. Owner completes setup (branch + "Chicken Biryani" 14,000 TZS)
 * 7. Owner publishes restaurant -> is_published = TRUE, is_open = TRUE
 * 8. Customer discovery: Customer searches "Biryani" and finds the dish!
 * 9. Multi-tenant isolation: Cross-tenant modification rejected
 * ============================================================================
 */

// Set local Supabase environment variables for testing
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.EXPO_PUBLIC_APP_ENV = 'development';

import { supabase } from '../lib/supabase';
import { ApplicationRepository } from '../repositories/applications.repository';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import { BranchRepository } from '../repositories/branches.repository';
import { MenuRepository } from '../repositories/menus.repository';
import { DiscoveryRepository } from '../repositories/discovery.repository';

// Test run ID to ensure unique records
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

async function runLiveOnboardingE2E() {
  console.log('================================================================');
  console.log('🚀 RUNNING STAGE 3 STABILIZATION LIVE ONBOARDING E2E TEST');
  console.log(`Run ID: ${RUN_ID}`);
  console.log('================================================================\n');

  // Test identities
  const applicantEmail = `owner_${RUN_ID}@mlohub.tz`;
  const applicantPassword = 'ValidPassword123!';
  const adminEmail = `admin_${RUN_ID}@mlohub.tz`;
  const adminPassword = 'AdminPassword123!';

  // --------------------------------------------------------------------------
  // Step 1: Applicant Account Registration & Application Submission
  // --------------------------------------------------------------------------
  console.log('--- Step 1: Applicant Registration & Application Submission ---');
  
  // Sign up applicant in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: applicantEmail,
    password: applicantPassword,
    options: {
      data: {
        full_name: `Mama Amina ${RUN_ID}`,
        phone: `+255754${RUN_ID}`,
        role: 'CUSTOMER',
      },
    },
  });

  if (authError && !authError.message.includes('already registered')) {
    throw new Error(`Failed to sign up applicant: ${authError.message}`);
  }

  // Sign in as applicant to have authentic auth.uid() session
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: applicantEmail,
    password: applicantPassword,
  });
  if (loginError) throw new Error(`Applicant sign-in failed: ${loginError.message}`);
  const applicantUserId = loginData.user.id;
  assert(!!applicantUserId, `Applicant authenticated with UUID ${applicantUserId}`);

  // Submit application using ApplicationRepository
  const businessName = `Mama Amina Biryani Spot ${RUN_ID}`;
  const app = await ApplicationRepository.submit({
    applicantUserId,
    businessName,
    ownerName: `Mama Amina ${RUN_ID}`,
    ownerPhone: `+255754${RUN_ID}`,
    ownerEmail: applicantEmail,
    cuisineType: 'Swahili',
    neighborhood: 'Mikocheni',
    address: 'Old Bagamoyo Rd, Mikocheni B',
    hasTinOrLicense: true,
    tinNumber: `900-${RUN_ID}-888`,
    notes: 'Specializes in authentic Zanzibar Dum Biryani and Pilau',
  });

  assert(!!app.id, `Application submitted successfully with ID: ${app.id}`);
  assert(app.status === 'PENDING', `Application status is PENDING`);
  assert(app.applicantUserId === applicantUserId, `Application bound to authentic applicant_user_id`);

  // Verify applicant can view their own application
  const myApps = await ApplicationRepository.listMine();
  assert(myApps.some((a) => a.id === app.id), `Applicant listMine() retrieves the submitted application`);

  // --------------------------------------------------------------------------
  // Step 2: Admin Portal Queue Inspection & Secure Approval
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: Admin Queue & Server RPC Approval ---');

  // Sign up and elevate Administrator
  const { data: adminSignupData, error: adminSignupError } = await supabase.auth.signUp({
    email: adminEmail,
    password: adminPassword,
    options: {
      data: {
        full_name: `System Admin ${RUN_ID}`,
        phone: `+255799${RUN_ID}`,
      },
    },
  });
  if (adminSignupError && !adminSignupError.message.includes('already registered')) {
    throw new Error(`Failed to sign up admin: ${adminSignupError.message}`);
  }

  // Elevate to ADMIN in public.profiles via psql
  const { execSync } = await import('child_process');
  execSync(
    `docker exec -i supabase_db_MloHub_Expo psql -U postgres -d postgres -c "SET session_replication_role = replica; UPDATE public.profiles SET role = 'ADMIN', roles = ARRAY['ADMIN'::user_role_enum], account_type = 'ADMIN' WHERE email = '${adminEmail}'; SET session_replication_role = DEFAULT;"`
  );

  // Sign in as Administrator
  const { data: adminLoginData, error: adminLoginError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (adminLoginError) {
    throw new Error(`Admin sign-in failed: ${adminLoginError.message}`);
  }
  const adminUserId = adminLoginData.user.id;
  assert(!!adminUserId, `Admin authenticated with UUID ${adminUserId}`);

  // Admin lists applications in queue
  const pendingApps = await ApplicationRepository.listAll('PENDING');
  assert(pendingApps.some((a) => a.id === app.id), `Admin queue sees pending application`);

  // Admin executes approval via server RPC
  const approvedApp = await ApplicationRepository.updateStatus(app.id, 'APPROVED', adminUserId || 'system-admin');
  assert(approvedApp.status === 'APPROVED', `Application transitioned to APPROVED`);

  // --------------------------------------------------------------------------
  // Step 3: Canonical Workspace Created with ZERO Synthetic Menus
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Canonical Workspace & Owner Membership ---');

  const expectedSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const restaurant = await RestaurantRepository.getBySlug(expectedSlug);
  assert(!!restaurant, `Restaurant created in public.restaurants with slug: ${expectedSlug}`);
  const restaurantId = restaurant!.id;

  // Verify Initial Lifecycle Gating
  assert(restaurant!.isPublished === false, `Newly approved restaurant isPublished is FALSE`);
  assert(restaurant!.isOpen === false, `Newly approved restaurant isOpen is FALSE`);
  assert(restaurant!.isVerified === true, `Restaurant verification status is VERIFIED`);

  // Verify Owner Membership Created
  const { data: members, error: memErr } = await supabase
    .from('restaurant_members')
    .select('*')
    .eq('restaurant_id', restaurantId);
  assert(!memErr && members?.length > 0, `Owner membership record created in public.restaurant_members`);
  assert(members![0].user_id === applicantUserId, `Member user_id matches applicant user ID`);
  assert(members![0].role === 'OWNER', `Member role is OWNER`);
  assert(members![0].is_primary_owner === true, `Member is primary owner`);

  // Verify ZERO synthetic menu items or branches were fabricated
  const initialBranches = await BranchRepository.listByRestaurant(restaurantId);
  assert(initialBranches.length === 0, `Zero branches fabricated upon approval (owner must configure)`);

  const initialItems = await MenuRepository.listItems(restaurantId);
  assert(initialItems.length === 0, `Zero menu items fabricated upon approval (owner must configure)`);

  // --------------------------------------------------------------------------
  // Step 4: Customer Discovery Invisibility
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4: Discovery Invisibility (Unpublished Restaurant) ---');

  const prePublishResults = await DiscoveryRepository.searchDishes({
    query: businessName,
    availableOnly: false,
  });
  assert(prePublishResults.length === 0, `Unpublished restaurant yields 0 results in customer discovery`);

  // --------------------------------------------------------------------------
  // Step 5: Publish Prerequisites Enforcement
  // --------------------------------------------------------------------------
  console.log('\n--- Step 5: Publish Prerequisites Validation ---');

  // Sign back in as Restaurant Owner
  await supabase.auth.signInWithPassword({
    email: applicantEmail,
    password: applicantPassword,
  });

  // Attempt to publish without branches or menu items
  let publishFailedAsExpected = false;
  try {
    await RestaurantRepository.publishRestaurant(restaurantId);
  } catch (err: any) {
    publishFailedAsExpected = true;
    assert(
      err.message.includes('branch') || err.message.includes('menu item') || err.message.includes('400'),
      `Publish rejected when prerequisites are missing: ${err.message}`
    );
  }
  assert(publishFailedAsExpected, `Cannot publish restaurant without branch and menu items`);

  // --------------------------------------------------------------------------
  // Step 6: Owner Real Setup (Branch + Menu Item with Pricing)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 6: Real Setup (Branch & Menu Creation) ---');

  // Create real branch
  const branch = await BranchRepository.create({
    restaurantId,
    name: 'Mikocheni Main Kitchen',
    address: 'Old Bagamoyo Rd, Mikocheni B',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    ward: 'Mikocheni',
    latitude: -6.7725,
    longitude: 39.2412,
    phone: `+255754${RUN_ID}`,
    isActive: true,
  });
  assert(!!branch.id, `Created authentic branch: ${branch.name} (${branch.id})`);

  // Create real category & menu item
  const category = await MenuRepository.createCategory({
    restaurantId,
    nameEn: 'Biryani & Rice Specialties',
    nameSw: 'Vyakula vya Biriani na Wali',
    displayOrder: 1,
  });
  assert(!!category.id, `Created menu category: ${category.nameEn}`);

  const menuItem = await MenuRepository.createItem({
    restaurantId,
    categoryId: category.id,
    nameEn: 'Zanzibar Chicken Dum Biryani',
    nameSw: 'Biriani ya Kuku ya Kizanzibari',
    descriptionEn: 'Fragrant basmati rice slow-cooked with tender marinated chicken and Zanzibar whole spices.',
    descriptionSw: 'Wali wa basmati uliopikwa taratibu na kuku mwenye viungo vya asili vya Zanzibar.',
    priceTzs: 14000,
    isAvailable: true,
    stockQuantity: 40,
    preparationMinutes: 20,
    dietaryTags: ['Halal', 'Poultry'],
    spiceLevel: 'Medium',
  });
  assert(!!menuItem.id, `Created authentic dish: ${menuItem.nameEn} for ${menuItem.priceTzs} TZS`);

  // --------------------------------------------------------------------------
  // Step 7: Successful Publication
  // --------------------------------------------------------------------------
  console.log('\n--- Step 7: Publication Execution ---');

  const pubRes = await RestaurantRepository.publishRestaurant(restaurantId);
  assert(pubRes.isPublished === true, `Restaurant publication returned isPublished = TRUE`);

  const publishedRest = await RestaurantRepository.getById(restaurantId);
  assert(publishedRest!.isPublished === true, `Database restaurant isPublished is TRUE`);
  assert(publishedRest!.isOpen === true, `Database restaurant isOpen is TRUE`);

  // --------------------------------------------------------------------------
  // Step 8: Customer Discovery Visibility
  // --------------------------------------------------------------------------
  console.log('\n--- Step 8: Customer Discovery Visibility ---');

  // Anonymous customer searches for "Biryani"
  const discoveryDishes = await DiscoveryRepository.searchDishes({
    query: 'Biryani',
    availableOnly: true,
    limit: 20,
  });

  const matchedDish = discoveryDishes.find((d) => d.menuItemId === menuItem.id || d.restaurantId === restaurantId);
  assert(!!matchedDish, `Published dish appears in search_food_discovery results!`);
  if (matchedDish) {
    assert(matchedDish.priceTzs === 14000, `Discovery displays correct price: ${matchedDish.priceTzs} TZS`);
    assert(matchedDish.restaurantName.includes('Mama Amina'), `Discovery displays correct restaurant name`);
    assert(matchedDish.isAvailable === true, `Discovery reports dish is available`);
  }

  // --------------------------------------------------------------------------
  // Step 9: Multi-Tenant Cross-Restaurant Boundary Enforcement
  // --------------------------------------------------------------------------
  console.log('\n--- Step 9: Cross-Tenant Multi-Tenant Isolation ---');

  // Register an unrelated user
  const otherUserEmail = `other_${RUN_ID}@mlohub.tz`;
  await supabase.auth.signUp({
    email: otherUserEmail,
    password: 'OtherPassword123!',
  });
  await supabase.auth.signInWithPassword({
    email: otherUserEmail,
    password: 'OtherPassword123!',
  });

  // Attempt to edit Restaurant A's menu item as an unrelated user
  let crossTenantBlocked = false;
  try {
    await MenuRepository.updateItem(menuItem.id, {
      priceTzs: 2000, // Unauthorized price tamper
    });
  } catch (err: any) {
    crossTenantBlocked = true;
    assert(
      err.message.includes('row-level security') || err.message.includes('403') || err.message.includes('Failed') || err.message.includes('permission'),
      `Cross-tenant edit blocked by RLS / permissions: ${err.message}`
    );
  }
  assert(crossTenantBlocked, `Non-member cannot modify restaurant menu item`);

  // Attempt to unpublish Restaurant A as an unrelated user
  let unpublishBlocked = false;
  try {
    await RestaurantRepository.unpublishRestaurant(restaurantId);
  } catch (err: any) {
    unpublishBlocked = true;
    assert(err.message.includes('403') || err.message.includes('Forbidden'), `Cross-tenant unpublish blocked: ${err.message}`);
  }
  assert(unpublishBlocked, `Non-member cannot unpublish another restaurant`);

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 LIVE ONBOARDING E2E COMPLETED: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runLiveOnboardingE2E().catch((err) => {
  console.error('\n💥 FATAL E2E FAILURE:', err);
  process.exit(1);
});
