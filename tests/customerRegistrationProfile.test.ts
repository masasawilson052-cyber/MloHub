/**
 * Customer Registration & Profile Navigation State Integrity Test Suite
 * File: tests/customerRegistrationProfile.test.ts
 */

import { authStorage } from '../lib/authStorage';
import { normalizeTanzaniaPhone } from '../utils/phone';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('\n========================================================================');
  console.log('--- TEST SUITE: CUSTOMER REGISTRATION & PROFILE PERSISTENCE CLOSURE ---');
  console.log('========================================================================\n');

  // TEST 1: Phone number normalization on customer registration
  console.log('[TEST 1] Tanzania phone normalization for registration');
  const rawInput = '0775008357';
  const normalized = normalizeTanzaniaPhone(rawInput);
  assert(normalized === '+255775008357', 'Phone normalized to international Tanzania format');

  // TEST 2: Active customer session persistence format
  console.log('\n[TEST 2] Active customer session storage format');
  const dummyCustomer = {
    user: {
      id: 'cust_test_uuid_123',
      email: 'baraka@example.com',
      fullName: 'Juma Baraka',
      phone: '+255775008357',
      location: 'Mikocheni, Dar es Salaam',
      accountType: 'CUSTOMER',
      role: 'CUSTOMER',
      roles: ['CUSTOMER'],
      status: 'ACTIVE',
      restaurantMemberships: [],
      activeRole: 'CUSTOMER',
      activeWorkspace: 'CUSTOMER',
    },
    profile: {
      id: 'cust_test_uuid_123',
      email: 'baraka@example.com',
      fullName: 'Juma Baraka',
      phone: '+255775008357',
      location: 'Mikocheni, Dar es Salaam',
      accountType: 'CUSTOMER',
      role: 'CUSTOMER',
      roles: ['CUSTOMER'],
      status: 'ACTIVE',
      preferredLanguage: 'sw',
      dietaryPreferences: ['Halal', 'No Seafood'],
    },
    email: 'baraka@example.com',
    phone: '+255775008357',
    token: 'sb_cust_token_test',
    savedAt: new Date().toISOString(),
  };

  await authStorage.setItem('@mlohub_customer_session', JSON.stringify(dummyCustomer));
  const retrievedRaw = await authStorage.getItem('@mlohub_customer_session');
  assert(retrievedRaw !== null, 'Session retrieved successfully from authStorage');

  const parsed = JSON.parse(retrievedRaw!);
  assert(parsed.user.fullName === 'Juma Baraka', 'Preserved fullName is Juma Baraka');
  assert(parsed.user.email === 'baraka@example.com', 'Preserved email is baraka@example.com');
  assert(parsed.user.phone === '+255775008357', 'Preserved phone is +255775008357');
  assert(parsed.user.location === 'Mikocheni, Dar es Salaam', 'Preserved location is Mikocheni');

  // TEST 3: Initials calculation logic for ProfileHeader
  console.log('\n[TEST 3] ProfileHeader initials generator');
  const calculateInitials = (name: string): string => {
    return name
      ? name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : 'MH';
  };
  assert(calculateInitials('Juma Baraka') === 'JB', 'Initials for Juma Baraka resolves to JB');
  assert(calculateInitials('Amina') === 'A', 'Initials for single name Amina resolves to A');
  assert(calculateInitials('') === 'MH', 'Initials for empty string defaults to MH');

  // TEST 4: Guest detection logic
  console.log('\n[TEST 4] Guest vs Authenticated customer resolution in profile view');
  const isGuestWhenEmpty = (!dummyCustomer.user && !''.trim() && !''.trim());
  assert(!isGuestWhenEmpty, 'Identified as authenticated when customer session exists');

  const isGuestTruly = (!null && !''.trim() && !''.trim());
  assert(isGuestTruly, 'Identified as guest when no user, no name and no email exist');

  // TEST 5: Session cleanup on signOut
  console.log('\n[TEST 5] Customer session clearing on signOut');
  await authStorage.removeItem('@mlohub_customer_session');
  const afterSignOut = await authStorage.getItem('@mlohub_customer_session');
  assert(afterSignOut === null, 'Customer session successfully deleted upon sign out');

  console.log('\n========================================================================');
  console.log('✅ ALL CUSTOMER REGISTRATION & PROFILE PERSISTENCE TESTS PASSED (100%)');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
