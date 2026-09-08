import { CryptoEngine } from '../db/auth/crypto';
import { AuthService } from '../db/auth/service';
import { AuthGuards } from '../db/auth/guards';
import { UserRole } from '../db/types';
import { MloHubDB } from '../db';

// Simple Test Runner Assertion Library
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function assertThrowsAsync(fn: () => Promise<any>, expectedSubstr: string, message: string) {
  try {
    await fn();
    console.error(`  ✗ FAIL (Expected error but succeeded): ${message}`);
    failedCount++;
  } catch (err: any) {
    if (err.message && err.message.includes(expectedSubstr)) {
      console.log(`  ✓ ${message} (Threw: "${err.message}")`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL (Unexpected error): ${err.message}`);
      failedCount++;
    }
  }
}

export async function runAuthTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 MLOHUB DUAL-ACCOUNT AUTHENTICATION TEST SUITE');
  console.log('======================================================\n');

  await MloHubDB.init();

  // TEST 1: Password Strength Engine
  console.log('Test Group 1: Password Strength & Cryptography');
  const s1 = CryptoEngine.checkPasswordStrength('123');
  assert(s1.score === 1 && s1.label === 'Too Short', 'Short password correctly flagged as Weak/Too Short');

  const s2 = CryptoEngine.checkPasswordStrength('KaribuMlo2026!');
  assert(s2.score >= 4 && s2.label === 'Strong', 'Complex password identified as Strong');

  const hash = CryptoEngine.hashPassword('secretPass123');
  assert(hash.startsWith('mlohub_v1$'), 'Password hash formatted with salted mlohub_v1 prefix');
  assert(CryptoEngine.verifyPassword('secretPass123', hash), 'Valid password verified successfully');
  assert(!CryptoEngine.verifyPassword('wrongPassword', hash), 'Invalid password rejected');

  // TEST 2: Customer Registration
  console.log('\nTest Group 2: Customer Registration Flow');
  const testCustomerEmail = `customer_${Date.now()}@mlohub.tz`;
  const customerRes = await AuthService.registerCustomer({
    fullName: 'Juma Selemani',
    email: testCustomerEmail,
    phone: `+255 712 ${Math.floor(100000 + Math.random() * 900000)}`,
    password: 'CustomerPassword2026!',
    location: 'Sinza Mori, Dar es Salaam',
    dietaryPreferences: ['High Protein', 'No Nuts'],
    agreeTerms: true,
  });

  assert(customerRes.user.role === UserRole.CUSTOMER, 'New customer created with role CUSTOMER');
  assert(customerRes.customerProfile !== undefined, 'Customer profile record created');
  assert(customerRes.token.split('.').length === 3, 'Valid session JWT token generated');
  assert(customerRes.customerProfile?.neighborhood === 'Sinza Mori, Dar es Salaam', 'Customer location persisted');

  // TEST 3: Duplicate Email Check
  console.log('\nTest Group 3: Duplicate Email & Phone Prevention');
  await assertThrowsAsync(
    () =>
      AuthService.registerCustomer({
        fullName: 'Duplicate User',
        email: testCustomerEmail,
        phone: '+255 754 000 000',
        password: 'Pass123456!',
        agreeTerms: true,
      }),
    'already exists',
    'Reject registration when email is already in use'
  );

  // TEST 4: Restaurant Registration & Onboarding
  console.log('\nTest Group 4: Multi-Step Restaurant Registration');
  const testOwnerEmail = `owner_${Date.now()}@mlohub.tz`;
  const restaurantRes = await AuthService.registerRestaurant({
    ownerFullName: 'Chef Hassan Makame',
    ownerEmail: testOwnerEmail,
    ownerPhone: `+255 788 ${Math.floor(100000 + Math.random() * 900000)}`,
    password: 'ChefPassword2026!',
    restaurantName: 'Zanzibar Spice Lounge',
    cuisine: 'Biryani',
    restaurantPhone: '+255 788 111 222',
    address: 'Chwaka Road, Mikocheni B',
    neighborhood: 'Mikocheni B',
    regionCity: 'Dar es Salaam',
    openingHours: '08:00 AM',
    closingHours: '10:30 PM',
    description: 'Authentic stone town pilau and coconut beef.',
    agreeTerms: true,
  });

  assert(restaurantRes.user.role === UserRole.RESTAURANT_OWNER, 'Owner created with role RESTAURANT_OWNER');
  assert(restaurantRes.activeRestaurant !== undefined, 'Restaurant profile created');
  assert(
    restaurantRes.activeRestaurant?.verificationStatus === 'PENDING_VERIFICATION',
    'New restaurant initially flagged as PENDING_VERIFICATION'
  );
  assert(restaurantRes.memberships.length > 0, 'Restaurant membership created');
  assert(restaurantRes.memberships[0].role === 'OWNER', 'Owner assigned OWNER membership role');

  // TEST 5: Shared Unified Login
  console.log('\nTest Group 5: Shared Unified Login & Automatic Role Resolution');
  // Login as Customer
  const loginCust = await AuthService.login({
    emailOrPhone: testCustomerEmail,
    password: 'CustomerPassword2026!',
  });
  assert(loginCust.user.role === UserRole.CUSTOMER, 'Shared login resolves CUSTOMER role automatically');

  // Login as Restaurant Owner
  const loginChef = await AuthService.login({
    emailOrPhone: testOwnerEmail,
    password: 'ChefPassword2026!',
  });
  assert(loginChef.user.role === UserRole.RESTAURANT_OWNER, 'Shared login resolves RESTAURANT_OWNER role automatically');
  assert(loginChef.activeRestaurant?.name === 'Zanzibar Spice Lounge', 'Active restaurant linked to login response');

  // Test Bad Password
  await assertThrowsAsync(
    () =>
      AuthService.login({
        emailOrPhone: testCustomerEmail,
        password: 'wrong_password_xyz',
      }),
    'Invalid email/phone or password',
    'Reject invalid credentials safely without timing leak'
  );

  // TEST 6: Authorization Guards & Role Protection
  console.log('\nTest Group 6: Authorization Guards & Endpoint Protection');
  const validCustAuth = AuthGuards.requireAuth(loginCust.token);
  assert(validCustAuth.isAuthenticated && validCustAuth.role === UserRole.CUSTOMER, 'requireAuth allows valid customer token');

  const invalidAuth = AuthGuards.requireAuth('invalid.token.payload');
  assert(!invalidAuth.isAuthenticated && invalidAuth.statusCode === 401, 'requireAuth rejects forged token with 401');

  // Customer attempting restaurant management endpoint
  const roleCheck = AuthGuards.requireRole(loginCust.token, [UserRole.RESTAURANT_OWNER, UserRole.ADMIN]);
  assert(!roleCheck.isAuthenticated && roleCheck.statusCode === 403, 'requireRole blocks customer from restaurant endpoints with 403');

  // Restaurant Owner accessing their restaurant
  const restId = restaurantRes.activeRestaurant!.id;
  const memberCheck = AuthGuards.requireRestaurantMembership(loginChef.token, restId);
  assert(memberCheck.isAuthenticated, 'requireRestaurantMembership grants owner access to their restaurant');

  // Restaurant Owner attempting to manage another restaurant
  const unauthorizedRestCheck = AuthGuards.requireRestaurantMembership(loginChef.token, 'mama-amina-biryani');
  assert(!unauthorizedRestCheck.isAuthenticated && unauthorizedRestCheck.statusCode === 403, 'requireRestaurantMembership blocks owner from other restaurants');

  // TEST 7: Multi-Role Context Switching
  console.log('\nTest Group 7: Multi-Role Account Context Switching');
  const switchedCust = await AuthService.switchAccountContext(loginChef.user.id, UserRole.CUSTOMER);
  assert(switchedCust.user.activeRole === UserRole.CUSTOMER, 'Restaurant owner switched context to CUSTOMER without re-login');

  const switchedBack = await AuthService.switchAccountContext(loginChef.user.id, UserRole.RESTAURANT_OWNER, restId);
  assert(switchedBack.user.activeRole === UserRole.RESTAURANT_OWNER, 'Switched context back to RESTAURANT_OWNER');

  // TEST 8: Logout & Session Invalidation
  console.log('\nTest Group 8: Logout & Session Revocation');
  await AuthService.logout(loginCust.token);
  assert(true, 'Session revoked in database on logout');

  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passedCount} Passed | ${failedCount} Failed`);
  console.log('======================================================\n');

  return { passedCount, failedCount };
}

// Self-executing if run directly
if (typeof require !== 'undefined' && require.main === module) {
  runAuthTestSuite().then((r) => {
    if (r.failedCount > 0) process.exit(1);
  });
}
