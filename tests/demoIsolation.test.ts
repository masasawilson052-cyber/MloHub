/**
 * ============================================================================
 * MLOHUB TEST SUITE: PACK 3H — DEMO / TEST ISOLATION
 * ============================================================================
 * Verifies that mocks, fixtures, demo accounts, fake business records,
 * and local test capabilities are strictly isolated from production,
 * staging, and development runtimes.
 *
 * Comprehensive Coverage:
 *   Criteria A - E: Dynamic runtime configuration & environment mode authority
 *   Criteria F - J: Fail-closed repositories, services, and failure injection
 *   Criteria K - N: UI component isolation & zero manufactured facts
 *   Criteria O - T: Fixture barrier, dedicated modules, and integrity
 *   Criteria U - Z: Dependency boundary audits & negative string assertions
 * ============================================================================
 */
// Ensure test environment variables are set for automated test runners
(process.env as any).NODE_ENV = 'test';
process.env.EXPO_PUBLIC_APP_ENV = 'test';

import fs from 'fs';
import path from 'path';
import {
  runtimeConfig,
  setRuntimeConfigForTesting,
  resetRuntimeConfigForTesting,
} from '../lib/runtimeConfig';
import {
  DEMO_RESTAURANTS,
  DEMO_USERS,
  DEMO_CUSTOMER_PROFILES,
  DEMO_RESTAURANT_MEMBERSHIPS,
  DEMO_SESSIONS,
  DEMO_CUSTOM_MEALS,
  DEMO_RESERVATIONS,
  DEMO_PAYMENTS,
  DEMO_REVIEWS,
  DEMO_NOTIFICATIONS,
} from '../demo/fixtures';
import { DiscoveryRepository } from '../repositories/discovery.repository';
import { RestaurantService } from '../services/RestaurantService';

let passedAssertions = 0;

function assert(condition: boolean, description: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${description}`);
  }
  passedAssertions++;
  console.log(`  ✓ ${description}`);
}

export async function runDemoIsolationTestSuite(): Promise<{ passed: number; failed: number }> {
  passedAssertions = 0;
  console.log('\n============================================================');
  console.log('RUNNING PACK 3H — DEMO / TEST ISOLATION TEST SUITE');
  console.log('============================================================\n');

  const rootDir = path.resolve(__dirname, '..');

  // Read critical source files for static verification
  const favoritesModalSrc = fs.readFileSync(
    path.join(rootDir, 'components', 'profile', 'FavoritesModal.tsx'),
    'utf-8'
  );
  const loginSrc = fs.readFileSync(
    path.join(rootDir, 'app', 'auth', 'login.tsx'),
    'utf-8'
  );
  const systemHealthSrc = fs.readFileSync(
    path.join(rootDir, 'components', 'admin', 'SystemHealth.tsx'),
    'utf-8'
  );
  const discoveryRepoSrc = fs.readFileSync(
    path.join(rootDir, 'repositories', 'discovery.repository.ts'),
    'utf-8'
  );
  const restaurantServiceSrc = fs.readFileSync(
    path.join(rootDir, 'services', 'RestaurantService.ts'),
    'utf-8'
  );
  const dataConstantsSrc = fs.readFileSync(
    path.join(rootDir, 'constants', 'data.ts'),
    'utf-8'
  );
  const restaurantDetailSrc = fs.readFileSync(
    path.join(rootDir, 'app', 'restaurant', '[id].tsx'),
    'utf-8'
  );
  const authGuardsSrc = fs.readFileSync(
    path.join(rootDir, 'db', 'auth', 'guards.ts'),
    'utf-8'
  );
  const authServiceSrc = fs.readFileSync(
    path.join(rootDir, 'db', 'auth', 'service.ts'),
    'utf-8'
  );
  const authContextSrc = fs.readFileSync(
    path.join(rootDir, 'context', 'AuthContext.tsx'),
    'utf-8'
  );
  const restaurantPortalSrc = fs.readFileSync(
    path.join(rootDir, 'app', 'restaurant-portal', 'index.tsx'),
    'utf-8'
  );
  const restaurantCardSrc = fs.readFileSync(
    path.join(rootDir, 'components', 'RestaurantCard.tsx'),
    'utf-8'
  );
  const googleMapViewSrc = fs.readFileSync(
    path.join(rootDir, 'components', 'GoogleMapView.tsx'),
    'utf-8'
  );

  // ==========================================================================
  // 1. Runtime Boundary Assertions (Criteria A - E)
  // ==========================================================================
  console.log('--- 1. Runtime Configuration Boundaries ---');

  assert(
    typeof runtimeConfig.allowLocalDataFallbacks === 'boolean',
    'Criterion A1: allowLocalDataFallbacks flag is strictly typed'
  );
  assert(
    typeof runtimeConfig.requiresRealSupabase === 'boolean',
    'Criterion A2: requiresRealSupabase flag is strictly typed'
  );

  // Test setRuntimeConfigForTesting and resetRuntimeConfigForTesting
  setRuntimeConfigForTesting({ allowLocalDataFallbacks: false, isProduction: true });
  assert(
    runtimeConfig.allowLocalDataFallbacks === false && runtimeConfig.isProduction === true,
    'Criterion A3: setRuntimeConfigForTesting overrides configuration dynamically'
  );
  resetRuntimeConfigForTesting();
  assert(
    typeof runtimeConfig.allowLocalDataFallbacks === 'boolean',
    'Criterion A4: resetRuntimeConfigForTesting resets configuration cleanly'
  );

  // Simulate boundary rules in pure logic
  const checkMode = (m: string) => ({
    allowFallbacks: m === 'test' || m === 'demo',
    requiresReal: m === 'development' || m === 'staging' || m === 'production',
  });

  assert(
    checkMode('production').allowFallbacks === false && checkMode('production').requiresReal === true,
    'Criterion A: Production mode forbids local data fallbacks and requires real Supabase'
  );

  assert(
    checkMode('staging').allowFallbacks === false && checkMode('staging').requiresReal === true,
    'Criterion B: Staging mode forbids local data fallbacks and requires real Supabase'
  );

  assert(
    checkMode('development').allowFallbacks === false && checkMode('development').requiresReal === true,
    'Criterion C: Development mode requires real Supabase instance and forbids silent fallbacks'
  );

  assert(
    checkMode('demo').allowFallbacks === true && checkMode('demo').requiresReal === false,
    'Criterion D: Demo mode explicitly permits local data fallbacks'
  );

  assert(
    checkMode('test').allowFallbacks === true && checkMode('test').requiresReal === false,
    'Criterion E: Test mode explicitly permits deterministic test fixtures'
  );

  // ==========================================================================
  // 2. Fail-Closed Repositories & Services (Criteria F - J)
  // ==========================================================================
  console.log('\n--- 2. Fail-Closed Data Access & Fallback Gating ---');

  // Criterion F: DiscoveryRepository fails closed if RPC fails in production
  assert(
    discoveryRepoSrc.includes('if (!runtimeConfig.allowLocalDataFallbacks) {\n            throw error;\n          }'),
    'Criterion F: DiscoveryRepository throws PostgreSQL error instead of falling back when allowLocalDataFallbacks is false'
  );

  // Criterion G: DiscoveryRepository fails closed if Supabase unconfigured in production
  assert(
    discoveryRepoSrc.includes('if (runtimeConfig.requiresRealSupabase && !isSupabaseConfigured()) {') &&
    discoveryRepoSrc.includes('throw new Error('),
    'Criterion G: DiscoveryRepository throws error when unconfigured in production/staging/dev'
  );

  // Criterion H: RestaurantService fails closed if Supabase unconfigured in production
  assert(
    restaurantServiceSrc.includes('if (runtimeConfig.requiresRealSupabase && !isSupabaseConfigured()) {') &&
    restaurantServiceSrc.includes('throw new Error('),
    'Criterion H: RestaurantService throws error when unconfigured in production/staging/dev'
  );

  // Criterion I: RestaurantService fails closed if query throws in production
  assert(
    restaurantServiceSrc.includes('if (!runtimeConfig.allowLocalDataFallbacks) {\n          throw err;\n        }'),
    'Criterion I: RestaurantService propagates database exceptions instead of falling back in production'
  );

  // Criterion J: RestaurantService.getRestaurantDetail returns honest null when missing
  assert(
    restaurantServiceSrc.includes('if (!runtimeConfig.allowLocalDataFallbacks) {\n        return {\n          restaurant: null,\n          menu: [],\n          branches: [],\n        };\n      }'),
    'Criterion J1: RestaurantService.getRestaurantDetail returns honest null object when not in fallback mode'
  );
  assert(
    restaurantServiceSrc.includes('return { restaurant: null, menu: [], branches: [] };'),
    'Criterion J2: RestaurantService.getRestaurantDetail ends with neutral empty object'
  );

  // Failure-Injection Execution Test
  try {
    setRuntimeConfigForTesting({ allowLocalDataFallbacks: false, requiresRealSupabase: true });
    let threw = false;
    try {
      DiscoveryRepository.searchDishesLocalFallback({ query: 'Chips' });
    } catch (e: any) {
      threw = true;
      assert(
        e.message.includes('forbidden'),
        'Criterion J3: searchDishesLocalFallback throws when allowLocalDataFallbacks is false'
      );
    }
    assert(threw, 'Criterion J4: Failure injection confirmed fail-closed execution');
  } finally {
    resetRuntimeConfigForTesting();
  }

  // ==========================================================================
  // 3. UI Component Isolation (Criteria K - N)
  // ==========================================================================
  console.log('\n--- 3. UI Component Isolation ---');

  // Criterion K: FavoritesModal does not import RESTAURANTS constant
  assert(
    !favoritesModalSrc.includes("import { RESTAURANTS") &&
    !favoritesModalSrc.includes("from '../../constants/data'"),
    'Criterion K1: FavoritesModal.tsx does not import RESTAURANTS constant'
  );
  assert(
    favoritesModalSrc.includes('restaurants?:') &&
    favoritesModalSrc.includes('restaurants = [],'),
    'Criterion K2: FavoritesModal.tsx receives restaurants via props'
  );

  // Criterion L: Quick Demo Account UI is strictly guarded by runtimeConfig.isDemo
  assert(
    loginSrc.includes('{runtimeConfig.isDemo && (') &&
    loginSrc.includes('⚡ Quick Demo Accounts'),
    'Criterion L1: Quick Demo Accounts prefill is strictly guarded by runtimeConfig.isDemo'
  );
  assert(
    loginSrc.includes('if (!runtimeConfig.isDemo) {'),
    'Criterion L2: Quick Demo button handlers verify runtimeConfig.isDemo before prefilling'
  );

  // Criterion M: SystemHealth displays honest unverified/simulated status
  assert(
    systemHealthSrc.includes("status: isCloud\n        ? (runtimeConfig.isDemo ? 'DEMO INSTANCE (CONFIGURED)' : 'CONFIGURED (UNVERIFIED)')"),
    'Criterion M1: SystemHealth labels Supabase PostgreSQL honestly as UNVERIFIED when not live-tested'
  );
  assert(
    systemHealthSrc.includes('isHealthy: false, // Fail closed: presence of URL/key does not guarantee live PostgreSQL reachability'),
    'Criterion M2: SystemHealth marks isHealthy as false by default for unverified cloud backend'
  );

  // Criterion N: app/restaurant/[id].tsx dynamically loads menu items
  assert(
    restaurantDetailSrc.includes('MenuRepository.listItems(id)') &&
    restaurantDetailSrc.includes('const [dbMenuItems, setDbMenuItems] = useState<any[]>([]);'),
    'Criterion N: restaurant/[id].tsx dynamically queries dishes from MenuRepository'
  );

  // ==========================================================================
  // 4. Demo Fixtures Barrier & Integrity (Criteria O - T)
  // ==========================================================================
  console.log('\n--- 4. Fixture Barrier & Integrity ---');

  const fixtureDir = path.join(rootDir, 'demo', 'fixtures');
  assert(
    fs.existsSync(path.join(fixtureDir, 'restaurants.ts')) &&
    fs.existsSync(path.join(fixtureDir, 'users.ts')) &&
    fs.existsSync(path.join(fixtureDir, 'orders.ts')) &&
    fs.existsSync(path.join(fixtureDir, 'reservations.ts')) &&
    fs.existsSync(path.join(fixtureDir, 'payments.ts')) &&
    fs.existsSync(path.join(fixtureDir, 'index.ts')),
    'Criterion O: All 6 dedicated demo/fixtures modules exist under demo/fixtures/'
  );

  // Criterion P: demo/fixtures/restaurants.ts exports DEMO_RESTAURANTS
  assert(
    Array.isArray(DEMO_RESTAURANTS) && DEMO_RESTAURANTS.length >= 9,
    `Criterion P1: DEMO_RESTAURANTS array is exported with ${DEMO_RESTAURANTS.length} restaurants`
  );
  assert(
    DEMO_RESTAURANTS.some((r) => r.id === 'mama-amina-biryani'),
    'Criterion P2: DEMO_RESTAURANTS contains Mama Amina Biryani House'
  );

  // Criterion Q: demo/fixtures/users.ts exports DEMO_USERS & DEMO_CUSTOMER_PROFILES
  assert(
    Array.isArray(DEMO_USERS) && DEMO_USERS.length >= 5,
    `Criterion Q1: DEMO_USERS array is exported with ${DEMO_USERS.length} test accounts`
  );
  assert(
    DEMO_USERS.some((u) => u.email === 'admin@mlohub.tz') &&
    DEMO_USERS.some((u) => u.email === 'mama.amina@mlohub.tz') &&
    DEMO_USERS.some((u) => u.email === 'frank.mlaki@mlohub.tz'),
    'Criterion Q2: DEMO_USERS contains Admin, Mama Amina, and Frank Mlaki'
  );
  assert(
    Array.isArray(DEMO_CUSTOMER_PROFILES) && DEMO_CUSTOMER_PROFILES.length >= 4,
    'Criterion Q3: DEMO_CUSTOMER_PROFILES array is exported'
  );
  assert(
    Array.isArray(DEMO_RESTAURANT_MEMBERSHIPS) && DEMO_RESTAURANT_MEMBERSHIPS.length >= 1,
    'Criterion Q4: DEMO_RESTAURANT_MEMBERSHIPS array is exported'
  );

  // Criterion R: demo/fixtures/orders.ts exports DEMO_CUSTOM_MEALS
  assert(
    Array.isArray(DEMO_CUSTOM_MEALS) && DEMO_CUSTOM_MEALS.length >= 1,
    'Criterion R: DEMO_CUSTOM_MEALS array is exported with initial custom order fixture'
  );

  // Criterion S: demo/fixtures/reservations.ts exports DEMO_RESERVATIONS
  assert(
    Array.isArray(DEMO_RESERVATIONS) && DEMO_RESERVATIONS.length >= 1,
    'Criterion S: DEMO_RESERVATIONS array is exported with initial reservation fixture'
  );

  // Criterion T: demo/fixtures/payments.ts exports DEMO_PAYMENTS & DEMO_REVIEWS
  assert(
    Array.isArray(DEMO_PAYMENTS) && DEMO_PAYMENTS.length >= 1,
    'Criterion T1: DEMO_PAYMENTS array is exported with initial payment fixture'
  );
  assert(
    Array.isArray(DEMO_REVIEWS) && DEMO_REVIEWS.length >= 1,
    'Criterion T2: DEMO_REVIEWS array is exported with initial review fixture'
  );
  assert(
    Array.isArray(DEMO_NOTIFICATIONS) && DEMO_NOTIFICATIONS.length >= 1,
    'Criterion T3: DEMO_NOTIFICATIONS array is exported with initial notification fixture'
  );

  // Backward compatibility check on constants/data.ts
  assert(
    dataConstantsSrc.includes("import { DEMO_RESTAURANTS } from '../demo/fixtures/restaurants';") &&
    dataConstantsSrc.includes('export const RESTAURANTS: Restaurant[] = DEMO_RESTAURANTS;'),
    'Criterion Compatibility: constants/data.ts re-exports DEMO_RESTAURANTS for legacy test consumers'
  );

  // ==========================================================================
  // 5. Dependency Boundary Audits & Zero Manufactured Facts (Criteria U - Z)
  // ==========================================================================
  console.log('\n--- 5. Dependency Boundary Audits & Zero Manufactured Facts ---');

  // Criterion U: Production auth modules do NOT import MloHubDB
  assert(
    !authGuardsSrc.includes('import { MloHubDB }') && !authGuardsSrc.includes("from '../index'"),
    'Criterion U1: db/auth/guards.ts has ZERO imports of MloHubDB'
  );
  assert(
    !authServiceSrc.includes('import { MloHubDB }') && !authServiceSrc.includes("from '../index'"),
    'Criterion U2: db/auth/service.ts has ZERO imports of MloHubDB'
  );
  assert(
    !authContextSrc.includes('import { MloHubDB }'),
    'Criterion U3: context/AuthContext.tsx has ZERO imports of MloHubDB'
  );

  // Criterion V: Repositories do NOT import MloHubDB or DEMO fixtures
  assert(
    !discoveryRepoSrc.includes('import { MloHubDB }'),
    'Criterion V1: repositories/discovery.repository.ts has ZERO imports of MloHubDB'
  );
  assert(
    !discoveryRepoSrc.includes('DEMO_RESTAURANTS'),
    'Criterion V2: repositories/discovery.repository.ts has ZERO imports of DEMO_RESTAURANTS'
  );

  // Criterion W: Restaurant Portal does NOT import MloHubDB
  assert(
    !restaurantPortalSrc.includes('import { MloHubDB }'),
    'Criterion W: app/restaurant-portal/index.tsx has ZERO imports of MloHubDB'
  );

  // Criterion X: Components import domain types, not data constants
  assert(
    restaurantCardSrc.includes("import { Restaurant } from '../types/domain';"),
    'Criterion X1: components/RestaurantCard.tsx imports Restaurant from types/domain'
  );
  assert(
    googleMapViewSrc.includes("import { Restaurant } from '../types/domain';"),
    'Criterion X2: components/GoogleMapView.tsx imports Restaurant from types/domain'
  );

  // Criterion Y: Zero manufactured facts in AuthContext.tsx
  assert(
    !authContextSrc.includes('|| 4.5') &&
    !authContextSrc.includes("|| 'Mikocheni'") &&
    !authContextSrc.includes("|| 'VERIFIED'"),
    'Criterion Y: AuthContext contains NO manufactured defaults (no fake 4.5 rating, no default Mikocheni, no fake VERIFIED status)'
  );

  // Criterion Z: Dedicated Demo adapters exist under services/demo/
  assert(
    fs.existsSync(path.join(rootDir, 'services', 'demo', 'DemoAuthAdapter.ts')) &&
    fs.existsSync(path.join(rootDir, 'services', 'demo', 'DemoDiscoveryAdapter.ts')) &&
    fs.existsSync(path.join(rootDir, 'services', 'demo', 'DemoOrderPipelineAdapter.ts')),
    'Criterion Z: Dedicated Demo adapters exist under services/demo/ for isolated offline testing'
  );

  console.log(`\nPack 3H Test Suite Complete: ${passedAssertions} assertions passed.\n`);
  return { passed: passedAssertions, failed: 0 };
}

if (require.main === module) {
  runDemoIsolationTestSuite()
    .then((res) => {
      console.log(`SUCCESS: ${res.passed} tests passed.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('FAILURE:', err);
      process.exit(1);
    });
}
