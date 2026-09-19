/**
 * ============================================================================
 * MLOHUB REPAIR PACK 3C ACCEPTANCE TEST SUITE
 * Strict Runtime Cutover & Supabase Authoritative Data Validation
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { runtimeConfig } from '../lib/runtimeConfig';
import { createEmptyDbSnapshot } from '../context/DbContext';
import { MloHubDB } from '../db';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import { CustomMealRepository } from '../repositories/customMeals.repository';
import { ReservationRepository } from '../repositories/reservations.repository';

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

export async function runDbContextCutoverTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 PACK 3C: DBCONTEXT PRODUCTION DATA CUTOVER SUITE');
  console.log('================================================================');

  const dbContextPath = path.resolve(__dirname, '../context/DbContext.tsx');
  const restaurantRepoPath = path.resolve(__dirname, '../repositories/restaurants.repository.ts');
  const customMealRepoPath = path.resolve(__dirname, '../repositories/customMeals.repository.ts');

  assert(fs.existsSync(dbContextPath), 'context/DbContext.tsx exists');
  assert(fs.existsSync(restaurantRepoPath), 'repositories/restaurants.repository.ts exists');
  assert(fs.existsSync(customMealRepoPath), 'repositories/customMeals.repository.ts exists');

  const dbContextSrc = fs.readFileSync(dbContextPath, 'utf8');
  const restaurantRepoSrc = fs.readFileSync(restaurantRepoPath, 'utf8');
  const customMealRepoSrc = fs.readFileSync(customMealRepoPath, 'utf8');

  // A. Real mode does not initialize MloHubDB
  assert(
    dbContextSrc.includes('allowLocalFallbacks ? MloHubDB.getSnapshot() : createEmptyDbSnapshot()'),
    'Criterion A: Real mode initial state does not read MloHubDB snapshot'
  );
  assert(
    dbContextSrc.includes('if (allowLocalFallbacks) {\n        // Test / Demo mode: preserve existing local snapshot behavior\n        const snapshot = await MloHubDB.init();'),
    'Criterion A: Real mode loadData does not call MloHubDB.init()'
  );

  // B & C. Empty Supabase results remain empty arrays
  assert(
    dbContextSrc.includes('const activeRestaurants = allowLocalFallbacks ? dbState.restaurants : cloudRestaurants;'),
    'Criterion B: Empty Supabase restaurant result remains [] in real mode'
  );
  assert(
    dbContextSrc.includes('const activeReservations = allowLocalFallbacks ? dbState.reservations : cloudReservations;'),
    'Criterion C: Empty reservations result remains [] in real mode'
  );
  assert(
    dbContextSrc.includes('const activeOrders = allowLocalFallbacks ? dbState.customMealRequests : cloudOrders;'),
    'Criterion B/C: Empty custom orders result remains [] in real mode'
  );
  assert(
    dbContextSrc.includes('const activeNotifications = allowLocalFallbacks ? dbState.notifications : cloudNotifications;'),
    'Criterion B/C: Empty notifications result remains [] in real mode'
  );

  // D. No usr-customer-1 fallback exists
  assert(!dbContextSrc.includes('usr-customer-1'), 'Criterion D: No usr-customer-1 fallback exists anywhere in DbContext.tsx');

  // E. No usr-chef-amina fallback exists
  assert(!dbContextSrc.includes('usr-chef-amina'), 'Criterion E: No usr-chef-amina fallback exists anywhere in DbContext.tsx');
  assert(!restaurantRepoSrc.includes('usr-chef-amina'), 'Criterion E: No usr-chef-amina fallback exists in restaurants.repository.ts');

  // F. Real-mode writes do not call MloHubDB
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      const { data: { user: currentAuthUser } } = await supabase.auth.getUser();"),
    'Criterion F: updateUser writes to Supabase profiles directly without calling MloHubDB'
  );
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      const { data: { user: authUser } } = await supabase.auth.getUser();\n      if (!authUser?.id) {\n        throw new Error('Authentication required to create a reservation.');"),
    'Criterion F: createReservation writes to ReservationRepository without calling MloHubDB'
  );
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      const success = await ReservationRepository.cancel(id);"),
    'Criterion F: cancelReservation calls ReservationRepository without calling MloHubDB'
  );
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      const { data: { user: authUser } } = await supabase.auth.getUser();\n      if (!authUser?.id) {\n        throw new Error('Authentication required to create a custom meal request.');"),
    'Criterion F: createCustomOrder calls CustomMealRepository without calling MloHubDB'
  );
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      const updated = await CustomMealRepository.updateRequest(id,"),
    'Criterion F: updateCustomOrder calls CustomMealRepository.updateRequest without calling MloHubDB'
  );
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      const success = await CustomMealRepository.cancelRequest(id);"),
    'Criterion F: deleteCustomOrder calls CustomMealRepository.cancelRequest without calling MloHubDB'
  );
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      const { data: { user: authUser } } = await supabase.auth.getUser();\n      if (!authUser?.id) {\n        throw new Error('Authentication required to submit a review.');"),
    'Criterion F: addReview calls ReviewRepository without calling MloHubDB'
  );

  // G. switchUser is blocked in real modes
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      throw new Error('Account switching is disabled in this environment.');\n    }"),
    'Criterion G: switchUser is blocked in real modes'
  );

  // H. resetDatabase is blocked in real modes
  assert(
    dbContextSrc.includes("if (!allowLocalFallbacks) {\n      throw new Error('Database reset is available only in test/demo mode.');\n    }"),
    'Criterion H: resetDatabase is blocked in real modes'
  );

  // I. test/demo still supports local fixtures
  assert(
    runtimeConfig.allowLocalDataFallbacks === true,
    'Criterion I: Test/demo runner maintains allowLocalDataFallbacks === true'
  );
  const testSnapshot = MloHubDB.getSnapshot();
  assert(testSnapshot.users.length > 0, 'Criterion I: Local test fixture users accessible in test/demo mode');
  assert(testSnapshot.restaurants.length > 0, 'Criterion I: Local test fixture restaurants accessible in test/demo mode');

  // J. Supabase failure does not hydrate local restaurants
  assert(
    !dbContextSrc.includes('cloudRestaurants.length > 0 ? cloudRestaurants : dbState.restaurants'),
    'Criterion J: Supabase empty/failure does NOT silently substitute local seeded restaurants'
  );

  // K. Real mode payments and users are not seeded local arrays
  const emptySnapshot = createEmptyDbSnapshot();
  assert(emptySnapshot.payments.length === 0, 'Criterion K: createEmptyDbSnapshot payments is []');
  assert(emptySnapshot.users.length === 0, 'Criterion K: createEmptyDbSnapshot users is []');
  assert(emptySnapshot.restaurants.length === 0, 'Criterion K: createEmptyDbSnapshot restaurants is []');
  assert(emptySnapshot.activeUserId === undefined, 'Criterion K: createEmptyDbSnapshot activeUserId is undefined');
  assert(
    dbContextSrc.includes('const activePayments = allowLocalFallbacks ? dbState.payments : [];'),
    'Criterion K: Real mode payments resolves to [] instead of seeded local transactions'
  );
  assert(
    dbContextSrc.includes('const activeUsers = allowLocalFallbacks ? dbState.users : (cloudUser ? [cloudUser] : []);'),
    'Criterion K: Real mode users does not expose seeded local user accounts'
  );

  // Repository method extensions
  assert(typeof CustomMealRepository.updateRequest === 'function', 'CustomMealRepository.updateRequest method exists');
  assert(typeof CustomMealRepository.cancelRequest === 'function', 'CustomMealRepository.cancelRequest method exists');
  assert(typeof CustomMealRepository.deleteRequest === 'function', 'CustomMealRepository.deleteRequest method exists');

  // RestaurantRepository hardening
  assert(!restaurantRepoSrc.includes("rating: Number(row.rating) || 4.5"), 'RestaurantRepository does not default rating to 4.5');
  assert(!restaurantRepoSrc.includes("min_price_tzs || 3000"), 'RestaurantRepository does not default minPrice to 3000');
  assert(!restaurantRepoSrc.includes("max_price_tzs || 25000"), 'RestaurantRepository does not default maxPrice to 25000');
  assert(!restaurantRepoSrc.includes("neighborhood || 'Mikocheni'"), 'RestaurantRepository does not default neighborhood to Mikocheni');
  assert(!restaurantRepoSrc.includes("region_city || 'Dar es Salaam'"), 'RestaurantRepository does not default regionCity to Dar es Salaam');
  assert(!restaurantRepoSrc.includes("is_verified ?? true"), 'RestaurantRepository does not default is_verified to true');
  assert(!restaurantRepoSrc.includes("verification_status || 'VERIFIED'"), 'RestaurantRepository does not default verification_status to VERIFIED');

  console.log('\n======================================================');
  console.log(`🏁 PACK 3C SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}

if (typeof require !== 'undefined' && require.main === module) {
  runDbContextCutoverTestSuite().then((r) => {
    if (r.failed > 0) process.exit(1);
  });
}
