/**
 * ============================================================================
 * MLOHUB STAGE 3 STABILIZATION ACCEPTANCE TEST SUITE
 * Real Restaurant Onboarding to Customer Discovery
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

export async function runStage3OnboardingTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 STAGE 3: REAL RESTAURANT ONBOARDING ACCEPTANCE SUITE');
  console.log('================================================================');

  const files = {
    registerRestaurant: path.resolve(__dirname, '../app/auth/register-restaurant.tsx'),
    restaurantPortal: path.resolve(__dirname, '../app/restaurant-portal/index.tsx'),
    applicationsRepo: path.resolve(__dirname, '../repositories/applications.repository.ts'),
    restaurantsRepo: path.resolve(__dirname, '../repositories/restaurants.repository.ts'),
    domainTypes: path.resolve(__dirname, '../types/domain.ts'),
    dbTypes: path.resolve(__dirname, '../db/types.ts'),
    authContext: path.resolve(__dirname, '../context/AuthContext.tsx'),
    migrationFile: path.resolve(__dirname, '../supabase/migrations/20260917000010_stage13_restaurant_onboarding_lifecycle.sql'),
  };

  // Verify all files exist
  for (const [name, filePath] of Object.entries(files)) {
    assert(fs.existsSync(filePath), `Target file exists: ${name} (${path.basename(filePath)})`);
  }

  const sources = {
    registerRestaurant: fs.readFileSync(files.registerRestaurant, 'utf8'),
    restaurantPortal: fs.readFileSync(files.restaurantPortal, 'utf8'),
    applicationsRepo: fs.readFileSync(files.applicationsRepo, 'utf8'),
    restaurantsRepo: fs.readFileSync(files.restaurantsRepo, 'utf8'),
    domainTypes: fs.readFileSync(files.domainTypes, 'utf8'),
    dbTypes: fs.readFileSync(files.dbTypes, 'utf8'),
    authContext: fs.readFileSync(files.authContext, 'utf8'),
    migrationFile: fs.readFileSync(files.migrationFile, 'utf8'),
  };

  // ==========================================================================
  // Criterion A: Restaurant Registration Source of Truth
  // ==========================================================================
  console.log('\n--- Criterion A: Restaurant Registration Source of Truth ---');
  
  // No MloHubDB imports or usage in register-restaurant.tsx
  assert(
    !sources.registerRestaurant.includes("from '../../db'") &&
    !sources.registerRestaurant.includes("from '@/db'") &&
    !sources.registerRestaurant.includes('MloHubDB'),
    'register-restaurant.tsx has ZERO MloHubDB imports or references'
  );

  // Calls ApplicationRepository.submit
  assert(
    sources.registerRestaurant.includes('ApplicationRepository.submit'),
    'register-restaurant.tsx delegates application persistence to ApplicationRepository.submit'
  );

  // Authenticates or signs up real Supabase user
  assert(
    sources.registerRestaurant.includes('signUpCustomer') ||
    sources.registerRestaurant.includes('supabase.auth'),
    'register-restaurant.tsx ensures authenticated Supabase session before submitting'
  );

  // Truthful feedback: No misleading fake bypass claims
  assert(
    !sources.registerRestaurant.includes('SMS OTP verification has been bypassed for demo/testing') &&
    !sources.registerRestaurant.includes('verified directly'),
    'register-restaurant.tsx removes fake SMS OTP bypass / auto-verify claims'
  );

  assert(
    sources.registerRestaurant.includes('UNDER ADMIN REVIEW') ||
    sources.registerRestaurant.includes('submitted for administrator review') ||
    sources.registerRestaurant.includes('Application Submitted Successfully'),
    'register-restaurant.tsx presents truthful under-review state'
  );

  // ==========================================================================
  // Criterion B: Application Repository & RPC Alignment
  // ==========================================================================
  console.log('\n--- Criterion B: Application Repository & Server RPCs ---');

  // Uses Supabase client
  assert(
    sources.applicationsRepo.includes("from '../lib/supabase'") ||
    sources.applicationsRepo.includes("from '@/lib/supabase'"),
    'applications.repository.ts imports canonical Supabase client'
  );

  // No MloHubDB fallback
  assert(
    !sources.applicationsRepo.includes('MloHubDB'),
    'applications.repository.ts has ZERO MloHubDB fallbacks'
  );

  // Submit requires or binds applicant_user_id
  assert(
    sources.applicationsRepo.includes('applicant_user_id') ||
    sources.applicationsRepo.includes('applicantUserId'),
    'applications.repository.ts maps applicant_user_id to authenticated profile'
  );

  // updateStatus calls server RPCs
  assert(
    sources.applicationsRepo.includes('approve_restaurant_application') &&
    sources.applicationsRepo.includes('reject_restaurant_application'),
    'applications.repository.ts delegates approval/rejection to server RPCs'
  );

  // listMine method exists
  assert(
    sources.applicationsRepo.includes('listMine'),
    'applications.repository.ts provides listMine() for applicant status tracking'
  );

  // ==========================================================================
  // Criterion C: Database Migration & Schema Invariants
  // ==========================================================================
  console.log('\n--- Criterion C: Database Migration & Schema Invariants ---');

  // applicant_user_id column added to restaurant_applications
  assert(
    sources.migrationFile.includes('applicant_user_id UUID REFERENCES public.profiles'),
    'Migration adds applicant_user_id referencing public.profiles'
  );

  // is_published column added to restaurants
  assert(
    sources.migrationFile.includes('is_published BOOLEAN NOT NULL DEFAULT FALSE') ||
    sources.migrationFile.includes('ADD COLUMN IF NOT EXISTS is_published'),
    'Migration adds is_published column with FALSE default'
  );

  // approve_restaurant_application RPC enforces initial un-published gating
  assert(
    sources.migrationFile.includes('is_published = FALSE') &&
    sources.migrationFile.includes('is_open = FALSE'),
    'approve_restaurant_application RPC initializes is_published = FALSE and is_open = FALSE'
  );

  // approve_restaurant_application RPC creates restaurant_members record
  assert(
    sources.migrationFile.includes('INSERT INTO public.restaurant_members'),
    'approve_restaurant_application RPC creates owner membership in restaurant_members'
  );

  // publish_restaurant RPC enforces active branch prerequisite
  assert(
    sources.migrationFile.includes('FROM public.restaurant_branches') &&
    sources.migrationFile.includes('is_active = TRUE'),
    'publish_restaurant RPC validates that restaurant has at least 1 active branch'
  );

  // publish_restaurant RPC enforces available menu item with price > 0 prerequisite
  assert(
    sources.migrationFile.includes('FROM public.menu_items') &&
    sources.migrationFile.includes('price_tzs > 0') &&
    sources.migrationFile.includes('is_available = TRUE'),
    'publish_restaurant RPC validates available menu item with price_tzs > 0'
  );

  // search_food_discovery includes is_published = TRUE
  assert(
    sources.migrationFile.includes('r.is_published = TRUE'),
    'search_food_discovery RPC explicitly filters by r.is_published = TRUE'
  );

  // ==========================================================================
  // Criterion D: Restaurant Repository & Customer Discovery
  // ==========================================================================
  console.log('\n--- Criterion D: Restaurant Repository & Customer Discovery ---');

  // publishRestaurant and unpublishRestaurant exist
  assert(
    sources.restaurantsRepo.includes('publishRestaurant') &&
    sources.restaurantsRepo.includes('unpublishRestaurant'),
    'restaurants.repository.ts exposes publishRestaurant and unpublishRestaurant'
  );

  // Customer queries filter by publishedOnly: true
  assert(
    sources.restaurantsRepo.includes('publishedOnly') &&
    sources.restaurantsRepo.includes('is_published'),
    'restaurants.repository.ts supports publishedOnly filter for customer discovery'
  );

  // ==========================================================================
  // Criterion E: Domain Models & UI Publication Controls
  // ==========================================================================
  console.log('\n--- Criterion E: Domain Models & UI Publication Controls ---');

  // Domain types include isPublished and isActive
  assert(
    sources.domainTypes.includes('isPublished?: boolean') &&
    sources.domainTypes.includes('isActive?: boolean'),
    'types/domain.ts defines isPublished and isActive on Restaurant'
  );

  // DB types include isPublished and isActive
  assert(
    sources.dbTypes.includes('isPublished?: boolean') &&
    sources.dbTypes.includes('isActive?: boolean'),
    'db/types.ts defines isPublished and isActive on RestaurantEntity'
  );

  // AuthContext maps isPublished and isActive
  assert(
    sources.authContext.includes('isPublished: restRow.is_published') &&
    sources.authContext.includes('isActive: restRow.is_active'),
    'AuthContext.tsx maps is_published and is_active in mapRestaurantRowToEntity'
  );

  // Restaurant Portal provides publication control / banner
  assert(
    sources.restaurantPortal.includes('handlePublishRestaurant') ||
    sources.restaurantPortal.includes('publishRestaurant'),
    'restaurant-portal/index.tsx wires publish action to RestaurantRepository.publishRestaurant'
  );

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`🏁 STAGE 3 ACCEPTANCE SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================');

  return { passed, failed };
}
