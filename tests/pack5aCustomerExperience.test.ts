/**
 * ============================================================================
 * MLOHUB PACK 5A: COMPLETE CUSTOMER EXPERIENCE & DESIGN SYSTEM SUITE
 * ============================================================================
 * Tests canonical customer navigation, tab lock, customer orders screen,
 * onboarding flow, auth landing, Local Premium tokens, and zero synthetic data.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { Radii } from '../theme/radius';
import { Shadows } from '../theme/shadows';
import { ZIndex } from '../theme/zIndex';
import { Breakpoints } from '../theme/breakpoints';
import { formatTzs } from '../utils/formatters';

let passed = 0;
let failed = 0;

function assert(condition: any, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

export function runPack5aCustomerTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 PACK 5A: CUSTOMER EXPERIENCE, NAVIGATION & DESIGN SYSTEM');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '..');

  // ---------------------------------------------------------------------------
  // 1. Bottom Tab Navigation Lock
  // ---------------------------------------------------------------------------
  console.log('--- Section 1: Bottom Tab Navigation Lock ---');
  const tabLayoutPath = path.join(rootDir, 'app/(tabs)/_layout.tsx');
  assert(fs.existsSync(tabLayoutPath), 'app/(tabs)/_layout.tsx exists');

  const tabLayoutContent = fs.readFileSync(tabLayoutPath, 'utf-8');
  assert(tabLayoutContent.includes('name="index"'), 'Tab 1: index (EXPLORE) registered');
  assert(tabLayoutContent.includes('name="orders"'), 'Tab 2: orders (ORDERS) registered');
  assert(tabLayoutContent.includes('name="custom"'), 'Tab 3: custom (CUSTOM) registered');
  assert(tabLayoutContent.includes('name="bookings"'), 'Tab 4: bookings (BOOKINGS) registered');
  assert(tabLayoutContent.includes('name="profile"'), 'Tab 5: profile (PROFILE) registered');
  assert(
    tabLayoutContent.includes('name="explore"') && tabLayoutContent.includes('href: null'),
    'Deep search explore screen preserved with href: null (not a duplicate 6th tab)'
  );
  assert(tabLayoutContent.includes('tabBarActiveTintColor'), 'Active tint color configured');

  // ---------------------------------------------------------------------------
  // 2. Customer Orders Tab Architecture
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: Customer Orders Architecture ---');
  const ordersScreenPath = path.join(rootDir, 'app/(tabs)/orders.tsx');
  assert(fs.existsSync(ordersScreenPath), 'app/(tabs)/orders.tsx exists');

  const ordersContent = fs.readFileSync(ordersScreenPath, 'utf-8');
  assert(ordersContent.includes('OrderRepository.listOrdersForCustomer'), 'Uses OrderRepository to query orders');
  assert(ordersContent.includes('ACTIVE_STATUSES'), 'Defines canonical active statuses (PENDING, ACCEPTED, PREPARING, READY)');
  assert(ordersContent.includes('PAST_STATUSES'), 'Defines canonical past statuses (COMPLETED, CANCELLED, REJECTED)');
  assert(ordersContent.includes('SegmentedControl'), 'Uses SegmentedControl for Active vs Past toggle');
  assert(ordersContent.includes('RealtimeEventEngine.subscribe'), 'Subscribes to customer real-time order updates');
  assert(ordersContent.includes('Digital Receipt') || ordersContent.includes('Maelezo ya Oda'), 'Includes digital receipt & kitchen progression modal');
  assert(!ordersContent.includes('courierPin') && !ordersContent.includes('driverGps'), 'No fake courier GPS or PIN invention');

  // ---------------------------------------------------------------------------
  // 3. Customer-First Launch & Onboarding Flow
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: Customer-First Launch & Onboarding Flow ---');
  const indexPath = path.join(rootDir, 'app/index.tsx');
  assert(fs.existsSync(indexPath), 'app/index.tsx exists');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  assert(indexContent.includes('Redirect href="/(tabs)"'), 'app/index.tsx routes unauthenticated users directly to discovery');

  const onboardingPath = path.join(rootDir, 'app/onboarding.tsx');
  assert(fs.existsSync(onboardingPath), 'app/onboarding.tsx exists');
  const onboardingContent = fs.readFileSync(onboardingPath, 'utf-8');
  assert(onboardingContent.includes("router.replace('/(tabs)')"), 'Onboarding completion routes directly to discovery /(tabs)');

  // ---------------------------------------------------------------------------
  // 4. Honest Auth Landing & Progressive Registration
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: Honest Auth Landing & Progressive Registration ---');
  const authLandingPath = path.join(rootDir, 'app/auth/index.tsx');
  assert(fs.existsSync(authLandingPath), 'app/auth/index.tsx exists');
  const authLandingContent = fs.readFileSync(authLandingPath, 'utf-8');
  assert(!authLandingContent.includes('Escrow'), 'Zero escrow terminology in customer auth landing');
  assert(authLandingContent.includes('Explore Food First'), 'Browse as guest discovery option present');
  assert(authLandingContent.includes('/partner'), 'Discrete partner portal route present');

  const loginPath = path.join(rootDir, 'app/auth/login.tsx');
  assert(fs.existsSync(loginPath), 'app/auth/login.tsx exists');
  const loginContent = fs.readFileSync(loginPath, 'utf-8');
  assert(!loginContent.includes('Google') && !loginContent.includes('Apple'), 'No fake Google/Apple social sign-in buttons');

  // ---------------------------------------------------------------------------
  // 5. Local Premium Design Tokens Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 5: Local Premium Design System Tokens ---');
  assert(Colors.brandInk === '#142033', 'Brand Ink token #142033');
  assert(Colors.warmIvory === '#FAF8F3', 'Warm Ivory background token #FAF8F3');
  assert(Colors.surface === '#FFFFFF', 'Surface token #FFFFFF');
  assert(Colors.saffron === '#D4A348', 'Highlight saffron token #D4A348');
  assert(Colors.foodAction === '#C8482A', 'Food action accent token #C8482A');
  assert(Colors.botanicalGreen === '#246B39', 'Botanical green status token #246B39');
  assert(ZIndex.cartAccessory === 50, 'ZIndex.cartAccessory is 50');
  assert(ZIndex.bottomNav === 100, 'ZIndex.bottomNav is 100');
  assert(Breakpoints.tablet === 768, 'Breakpoints.tablet is 768px');
  assert(formatTzs(15000) === 'TZS 15,000', 'Standard currency format produces "TZS 15,000"');

  console.log('\n================================================================');
  console.log(`🏁 PACK 5A CUSTOMER SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`Pack 5A Customer test suite failed with ${failed} errors.`);
  }

  return { passed, failed };
}

if (require.main === module) {
  runPack5aCustomerTestSuite();
}
