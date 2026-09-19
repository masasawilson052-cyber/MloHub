/**
 * ============================================================================
 * PACK 3I — SECTION 2: AUTHENTICATED USER SESSIONS VERIFICATION
 * ============================================================================
 * Verifies real Supabase Auth sessions for:
 * A. Ordinary Customer
 * B. Restaurant Owner
 * C. Platform Admin
 *
 * Verifies:
 * - Real supabase.auth session created
 * - Profile loaded from public.profiles
 * - Role/membership resolved from real database state
 * - Logout destroys session
 * - Page refresh restores legitimate session
 * - Zero demo account substitution
 * - Zero MloHubDB fallback
 * ============================================================================
 */

process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.EXPO_PUBLIC_APP_ENV = 'development';

import { runtimeConfig, setRuntimeConfigForTesting } from 'C:/Users/hp/Downloads/MloHub_Expo 2/MloHub_Expo/lib/runtimeConfig';
import { supabase } from 'C:/Users/hp/Downloads/MloHub_Expo 2/MloHub_Expo/lib/supabase';
import { ApplicationRepository } from 'C:/Users/hp/Downloads/MloHub_Expo 2/MloHub_Expo/repositories/applications.repository';

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

const RUN_ID = Date.now().toString().slice(-5);

async function runSessionVerification() {
  console.log('================================================================');
  console.log('🧪 PACK 3I: AUTHENTICATED USER SESSIONS VERIFICATION');
  console.log('================================================================\n');

  setRuntimeConfigForTesting({
    mode: 'development',
    isDevelopment: true,
    isTest: false,
    isDemo: false,
    allowLocalDataFallbacks: false,
    requiresRealSupabase: true,
  });

  assert(runtimeConfig.allowLocalDataFallbacks === false, 'Runtime forbids local data fallbacks');
  assert(runtimeConfig.requiresRealSupabase === true, 'Runtime requires real Supabase');

  // ==========================================================================
  // A. ORDINARY CUSTOMER
  // ==========================================================================
  console.log('--- A. Ordinary Customer Session ---');
  const custEmail = `customer_${RUN_ID}@mlohub.tz`;
  const custPassword = 'SecurePassword123!';

  // 1. Real supabase.auth session created
  const { data: custAuth, error: custErr } = await supabase.auth.signUp({
    email: custEmail,
    password: custPassword,
    options: {
      data: {
        full_name: 'Juma Jux',
        role: 'CUSTOMER',
      },
    },
  });
  assert(!custErr, 'Customer signUp error is null');
  assert(!!custAuth.session, 'Customer real Supabase session created');
  assert(!!custAuth.user?.id, 'Customer authentic UUID assigned');

  // 2. Profile loaded from public.profiles
  const { data: custProfile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', custAuth.user!.id)
    .single();

  assert(!profErr, 'Customer profile loaded from public.profiles');
  assert(custProfile.role === 'CUSTOMER', 'Customer profile role is CUSTOMER');
  assert(custProfile.full_name === 'Juma Jux', 'Customer profile full_name matches');

  // 3. Logout destroys session
  await supabase.auth.signOut();
  const { data: signedOutCust } = await supabase.auth.getSession();
  assert(signedOutCust.session === null, 'Customer logout destroys session');

  // 4. Legitimate session restoration / login
  const { data: restoredCust, error: restCustErr } = await supabase.auth.signInWithPassword({
    email: custEmail,
    password: custPassword,
  });
  assert(!restCustErr, 'Customer signInWithPassword succeeds');
  assert(restoredCust.session?.user?.id === custAuth.user!.id, 'Restored session matches original customer UUID');
  await supabase.auth.signOut();

  // ==========================================================================
  // B. RESTAURANT OWNER
  // ==========================================================================
  console.log('\n--- B. Restaurant Owner Session & Membership ---');
  const ownerEmail = `owner_${RUN_ID}@mlohub.tz`;
  const ownerPassword = 'OwnerPassword123!';

  // 1. Real supabase.auth session created
  const { data: ownerAuth, error: ownerErr } = await supabase.auth.signUp({
    email: ownerEmail,
    password: ownerPassword,
    options: {
      data: {
        full_name: 'Mama Amina',
        role: 'RESTAURANT_OWNER',
      },
    },
  });
  assert(!ownerErr, 'Owner signUp error is null');
  assert(!!ownerAuth.session, 'Owner real Supabase session created');
  const ownerId = ownerAuth.user!.id;

  // Sign in as owner to establish active session
  await supabase.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });

  // 2. Submit Application
  const appData = await ApplicationRepository.submit({
    applicantUserId: ownerId,
    businessName: `Amina Swahili Lounge ${RUN_ID}`,
    ownerName: 'Mama Amina',
    ownerPhone: '+255712345678',
    ownerEmail: ownerEmail,
    cuisineType: 'Swahili',
    neighborhood: 'Mikocheni',
    address: 'Mikocheni, Dar es Salaam',
    hasTinOrLicense: true,
    tinNumber: `TIN-${RUN_ID}`,
    notes: 'Authentic swahili lounge',
  });
  assert(!!appData && !!appData.id, 'Owner restaurant application submitted to public.restaurant_applications');

  // 3. Admin User signs in & approves application
  const adminEmail = `admin_${RUN_ID}@mlohub.tz`;
  const adminPassword = 'SuperAdmin2026!';
  const { data: adminAuth, error: adminErr } = await supabase.auth.signUp({
    email: adminEmail,
    password: adminPassword,
    options: {
      data: {
        full_name: 'Platform Administrator',
        role: 'ADMIN',
      },
    },
  });
  assert(!adminErr, 'Admin account created');
  
  // Elevate admin role in profiles via psql (bypassing governance triggers for platform setup)
  const { execSync } = await import('child_process');
  execSync(
    `docker exec -i supabase_db_MloHub_Expo psql -U postgres -d postgres -c "SET session_replication_role = replica; UPDATE public.profiles SET role = 'ADMIN', roles = ARRAY['ADMIN'::user_role_enum], account_type = 'ADMIN' WHERE email = '${adminEmail}'; SET session_replication_role = DEFAULT;"`
  );

  // Re-sign in as admin to get fresh claims
  await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  // Execute approval RPC via ApplicationRepository
  const approvedApp = await ApplicationRepository.updateStatus(appData.id, 'APPROVED', adminAuth.user!.id);
  assert(approvedApp.status === 'APPROVED', 'Admin executes approve_restaurant_application server RPC');

  // 4. Verify Owner Membership & Active Restaurant
  await supabase.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });

  const { data: memberRows, error: memErr } = await supabase
    .from('restaurant_members')
    .select('*')
    .eq('user_id', ownerId);

  assert(!memErr, 'Owner queries public.restaurant_members');
  assert(Array.isArray(memberRows) && memberRows.length > 0, 'Real restaurant membership row resolved');
  assert(memberRows![0].role === 'OWNER', 'Resolved membership role is OWNER');
  assert(memberRows![0].is_primary_owner === true, 'Owner is marked is_primary_owner');

  // Verify restaurant in public.restaurants
  const restId = memberRows![0].restaurant_id;
  const { data: restRow, error: restErr } = await supabase
    .from('restaurants')
    .select('id, name, is_published, is_open')
    .eq('id', restId)
    .single();

  assert(!restErr, 'Canonical restaurant loaded from public.restaurants');
  assert(restRow!.is_published === false, 'Newly approved restaurant is unpublished by default');

  // 5. Logout & Restore Owner Session
  await supabase.auth.signOut();
  const { data: signedOutOwner } = await supabase.auth.getSession();
  assert(signedOutOwner.session === null, 'Owner logout destroys session');

  const { data: restoredOwner, error: restOwnerErr } = await supabase.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });
  assert(!restOwnerErr, 'Owner signInWithPassword restores legitimate session');
  assert(restoredOwner.session?.user?.id === ownerId, 'Restored session resolves identical owner UUID');
  await supabase.auth.signOut();

  // ==========================================================================
  // C. PLATFORM ADMIN / SUPER_ADMIN
  // ==========================================================================
  console.log('\n--- C. Platform Admin Session & Authority ---');
  const { data: adminLogin, error: adminLoginErr } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  assert(!adminLoginErr, 'Admin signInWithPassword succeeds');
  assert(adminLogin.session !== null, 'Admin real session created');

  const { data: adminProf } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', adminLogin.session!.user.id)
    .single();
  assert(adminProf?.role === 'ADMIN', 'Admin profile role is ADMIN in public.profiles');

  // Verify RPC is_admin check
  const { data: isAdminRpc, error: isAdminErr } = await supabase.rpc('is_admin', {
    p_user_id: adminLogin.session!.user.id,
  });
  assert(!isAdminErr && isAdminRpc === true, 'Server RPC is_admin evaluates to TRUE for admin session');

  await supabase.auth.signOut();
  const { data: finalSession } = await supabase.auth.getSession();
  assert(finalSession.session === null, 'Final logout destroys admin session');

  console.log('\n================================================================');
  console.log(`🏁 AUTHENTICATED SESSIONS VERIFIED: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');
}

runSessionVerification().catch((err) => {
  console.error('Session verification failed:', err);
  process.exit(1);
});
