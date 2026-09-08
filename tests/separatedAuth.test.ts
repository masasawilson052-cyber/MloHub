import { AuthService } from '../db/auth/service';
import { UserRole } from '../db/types';
import { MloHubDB } from '../db';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

export async function runSeparatedAuthTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 MLOHUB SEPARATED CUSTOMER VS RESTAURANT AUTH TESTS');
  console.log('======================================================\n');

  await MloHubDB.init();

  // TEST GROUP 1: Customer Account Login & Profile
  console.log('Test Group 1: Customer Account Login & Data Resolution');
  const customerSession = await AuthService.login({
    emailOrPhone: 'frank.mlaki@mlohub.tz',
    password: 'password123',
  });

  assert(customerSession.user.role === UserRole.CUSTOMER, 'Customer login resolves CUSTOMER role');
  assert(customerSession.customerProfile !== undefined, 'Customer profile attached to customer session');
  assert(customerSession.customerProfile?.neighborhood === 'Mikocheni', 'Customer neighborhood data resolved');
  assert(customerSession.activeRestaurant === undefined, 'Customer session has no active restaurant management entity');

  // TEST GROUP 2: Restaurant Owner Account Login & Kitchen Entity
  console.log('\nTest Group 2: Restaurant Owner Account Login & Merchant Resolution');
  const restaurantSession = await AuthService.login({
    emailOrPhone: 'mama.amina@mlohub.tz',
    password: 'password123',
  });

  assert(restaurantSession.user.role === UserRole.RESTAURANT_OWNER, 'Restaurant login resolves RESTAURANT_OWNER role');
  assert(restaurantSession.activeRestaurant !== undefined, 'Active restaurant entity attached to merchant session');
  assert(restaurantSession.activeRestaurant?.name === 'Mama Amina Biryani House', 'Active restaurant name resolved');
  assert(restaurantSession.memberships.length > 0, 'Restaurant owner memberships resolved');
  assert(restaurantSession.memberships[0].role === 'OWNER', 'Owner assigned OWNER membership role');

  // TEST GROUP 3: Multi-Role Account Switching
  console.log('\nTest Group 3: Account Switching between Customer and Restaurant Owner');
  const switchedToCustomer = await AuthService.switchAccountContext(restaurantSession.user.id, UserRole.CUSTOMER);
  assert(switchedToCustomer.user.activeRole === UserRole.CUSTOMER, 'Merchant switched to Customer mode');

  const switchedToRestaurant = await AuthService.switchAccountContext(
    restaurantSession.user.id,
    UserRole.RESTAURANT_OWNER,
    'mama-amina-biryani'
  );
  assert(switchedToRestaurant.user.activeRole === UserRole.RESTAURANT_OWNER, 'Switched back to Restaurant Owner mode');
  assert(switchedToRestaurant.activeRestaurant?.id === 'mama-amina-biryani', 'Active restaurant re-attached on switch');

  console.log('\n======================================================');
  console.log(`🏁 SEPARATED AUTH TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}

if (typeof require !== 'undefined' && require.main === module) {
  runSeparatedAuthTestSuite().then((r) => {
    if (r.failed > 0) process.exit(1);
  });
}
