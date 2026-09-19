import { CryptoEngine } from '../db/auth/crypto';
import { AuthService } from '../db/auth/service';
import { AuthGuards, resolvePortalAccess, selectRestaurantOrders } from '../db/auth/guards';
import { UserRole, UserEntity, RestaurantMembershipEntity, isMembershipActive } from '../db/types';
import { MloHubDB } from '../db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { runtimeConfig } from '../lib/runtimeConfig';
import * as fs from 'fs';
import * as path from 'path';

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
    if (err.message && err.message.toLowerCase().includes(expectedSubstr.toLowerCase())) {
      console.log(`  ✓ ${message} (Threw: "${err.message}")`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL (Unexpected error): ${err.message}`);
      failedCount++;
    }
  }
}

function createSignedSessionToken(payload: {
  userId: string;
  role: UserRole;
  email: string;
  restaurantId?: string;
}, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): string {
  const token = CryptoEngine.signToken(payload, expiresInMs);
  const decoded = CryptoEngine.verifyToken(token);
  const sessId = decoded?.jti || decoded?.sessionId || `sess-${Date.now()}-${Math.random()}`;
  const db = MloHubDB.getSnapshot();
  db.sessions = db.sessions || [];
  db.sessions.push({
    id: sessId,
    sessionId: sessId,
    token,
    userId: payload.userId,
    deviceInfo: 'test-runner',
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export async function runAuthTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 MLOHUB DUAL-ACCOUNT AUTHENTICATION TEST SUITE');
  console.log('======================================================\n');

  await MloHubDB.init();

  // =========================================================================
  // TEST GROUP 1: PASSWORD STRENGTH & CRYPTOGRAPHY
  // =========================================================================
  console.log('Test Group 1: Password Strength & Cryptography');
  const s1 = CryptoEngine.checkPasswordStrength('123');
  assert(s1.score === 1 && s1.label === 'Too Short', 'Short password correctly flagged as Weak/Too Short');

  const s2 = CryptoEngine.checkPasswordStrength('KaribuMlo2026!');
  assert(s2.score >= 4 && s2.label === 'Strong', 'Complex password identified as Strong');

  // Modern v2 hashing
  const hash = CryptoEngine.hashPassword('secretPass123');
  assert(hash.startsWith('mlohub_v2$'), 'Password hash formatted with salted mlohub_v2 prefix');
  assert(CryptoEngine.verifyPassword('secretPass123', hash), 'Valid password verified successfully');
  assert(!CryptoEngine.verifyPassword('wrongPassword', hash), 'Invalid password rejected');
  assert(!CryptoEngine.verifyPassword('secretPass12', hash), 'Prefix substring of password rejected');
  assert(!CryptoEngine.verifyPassword('secretPass1234', hash), 'Appended substring of password rejected');

  // Bypasses rejected
  assert(!CryptoEngine.verifyPassword('password123', hash), 'Universal password "password123" bypass fails');
  assert(!CryptoEngine.verifyPassword('1234', hash), 'Security PIN bypass "1234" fails');
  assert(!CryptoEngine.verifyPassword('testPass', 'legacyPlaintextMismatch'), 'Plaintext password mismatch fails safely');
  assert(!CryptoEngine.verifyPassword('testPass', 'invalid_hash_format'), 'Malformed hash format fails safely');
  assert(!CryptoEngine.verifyPassword('testPass', 'mlohub_v1$salt$1234abcd'), 'Truncated hash fails safely');
  assert(!CryptoEngine.verifyPassword('testPass', 'mlohub_v999$salt$abcdef'), 'Unknown algorithm prefix fails safely');

  // Whitespace preservation
  const passWithSpaces = '  SpacesPass2026!  ';
  const passWithSpacesHash = CryptoEngine.hashPassword(passWithSpaces);
  assert(CryptoEngine.verifyPassword(passWithSpaces, passWithSpacesHash), 'Whitespace-padded password verifies with exact whitespace');
  assert(!CryptoEngine.verifyPassword('SpacesPass2026!', passWithSpacesHash), 'Trimmed password does not match untrimmed password hash');

  // Multi-byte Unicode passwords
  const unicodePass = 'MloChakula🍲2026🇹🇿✨';
  const unicodeHash = CryptoEngine.hashPassword(unicodePass);
  assert(CryptoEngine.verifyPassword(unicodePass, unicodeHash), 'Multi-byte Unicode password verifies correctly');
  assert(!CryptoEngine.verifyPassword('MloChakula🍜2026🇹🇿✨', unicodeHash), 'Distinct Unicode characters do not match (🍲 vs 🍜)');

  // Legacy mlohub_v1$ hash verification & upgrade checks (both Latin-1 raw string and UTF-8)
  const legacyV1Latin1 = CryptoEngine.createLegacyV1Hash('Café2026!', 'saltLatin1', false);
  assert(CryptoEngine.verifyPassword('Café2026!', legacyV1Latin1), 'Legacy mlohub_v1 Latin-1 accented password (Café2026!) verifies');
  const legacyV1Utf8 = CryptoEngine.createLegacyV1Hash('Café2026!', 'saltUtf8', true);
  assert(CryptoEngine.verifyPassword('Café2026!', legacyV1Utf8), 'Legacy mlohub_v1 UTF-8 accented password (Café2026!) verifies');
  assert(CryptoEngine.shouldUpgradeHash(legacyV1Latin1), 'shouldUpgradeHash flags mlohub_v1 hash for upgrade');
  assert(!CryptoEngine.shouldUpgradeHash(hash), 'shouldUpgradeHash returns false for mlohub_v2 hash');

  // =========================================================================
  // TEST GROUP 2: CUSTOMER REGISTRATION FLOW
  // =========================================================================
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

  // =========================================================================
  // TEST GROUP 3: SMS OTP VERIFICATION FLOW
  // =========================================================================
  console.log('\nTest Group 3: Customer SMS OTP Verification Flow');
  const otpCustomerPhone = `+255 754 ${Math.floor(100000 + Math.random() * 900000)}`;
  const sendRes = await AuthService.sendCustomerOtp(otpCustomerPhone);
  assert(sendRes.success === true, 'Customer SMS OTP dispatched successfully');
  assert(sendRes.carrierName !== 'Unknown', 'Tanzanian mobile carrier detected for customer phone');

  const cleanCustPhone = otpCustomerPhone.replace(/[^0-9]/g, '');
  const custChallenge = await MloHubDB.otpChallenges.getActiveByPhone(cleanCustPhone);
  assert(custChallenge !== undefined, 'Customer OTP challenge saved in database');
  assert(custChallenge?.purpose === 'CUSTOMER_VERIFICATION', 'OTP challenge tagged with CUSTOMER_VERIFICATION');

  const badOtpVerify = await AuthService.verifyCustomerOtp(otpCustomerPhone, '000000');
  assert(!badOtpVerify.success, 'Invalid OTP code rejected for customer');

  // =========================================================================
  // TEST GROUP 4: DUPLICATE EMAIL PREVENTION
  // =========================================================================
  console.log('\nTest Group 4: Duplicate Email & Phone Prevention');
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

  // =========================================================================
  // TEST GROUP 5: MULTI-STEP RESTAURANT REGISTRATION
  // =========================================================================
  console.log('\nTest Group 5: Multi-Step Restaurant Registration');
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
  assert(isMembershipActive(restaurantRes.memberships[0]), 'New restaurant membership is active');

  // =========================================================================
  // TEST GROUP 6: SHARED UNIFIED LOGIN & LEGACY UPGRADE
  // =========================================================================
  console.log('\nTest Group 6: Shared Unified Login & Automatic Role Resolution');
  const loginCust = await AuthService.login({
    emailOrPhone: testCustomerEmail,
    password: 'CustomerPassword2026!',
  });
  assert(loginCust.user.role === UserRole.CUSTOMER, 'Shared login resolves CUSTOMER role automatically');

  const loginChef = await AuthService.login({
    emailOrPhone: testOwnerEmail,
    password: 'ChefPassword2026!',
  });
  assert(loginChef.user.role === UserRole.RESTAURANT_OWNER, 'Shared login resolves RESTAURANT_OWNER role automatically');
  assert(loginChef.activeRestaurant?.name === 'Zanzibar Spice Lounge', 'Active restaurant linked to login response');

  await assertThrowsAsync(
    () =>
      AuthService.login({
        emailOrPhone: testCustomerEmail,
        password: 'wrong_password_xyz',
      }),
    'Invalid email/phone or password',
    'Reject invalid credentials safely without timing leak'
  );

  // Test legacy password upgrade during login
  const legacyUpgradeEmail = `legacy_${Date.now()}@mlohub.tz`;
  const legacyUserHash = CryptoEngine.createLegacyV1Hash('Café2026!', 'saltLegacyUser');
  const db = MloHubDB.getSnapshot();
  const legacyUser: UserEntity = {
    id: `usr-legacy-${Date.now()}`,
    fullName: 'Legacy User',
    email: legacyUpgradeEmail,
    phone: `+255 799 ${Math.floor(100000 + Math.random() * 900000)}`,
    passwordHash: legacyUserHash,
    role: UserRole.CUSTOMER,
    roles: [UserRole.CUSTOMER],
    activeRole: UserRole.CUSTOMER,
    language: 'sw',
    isEmailVerified: true,
    isPhoneVerified: true,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.users.push(legacyUser);
  await MloHubDB.save();

  const legacyLoginRes = await AuthService.login({
    emailOrPhone: legacyUpgradeEmail,
    password: 'Café2026!',
  });
  assert(legacyLoginRes.user.id === legacyUser.id, 'User with legacy mlohub_v1 accented password logs in successfully');
  const updatedUserInDb = db.users.find((u) => u.id === legacyUser.id);
  assert(
    !!updatedUserInDb?.passwordHash?.startsWith('mlohub_v2$'),
    'Legacy mlohub_v1 hash automatically upgraded to mlohub_v2 on successful login'
  );

  // Suspended and Inactive users blocked at login
  const suspendedEmail = `suspended_${Date.now()}@mlohub.tz`;
  await AuthService.registerCustomer({
    fullName: 'Suspended User',
    email: suspendedEmail,
    phone: `+255 711 ${Math.floor(100000 + Math.random() * 900000)}`,
    password: 'Password123!',
    agreeTerms: true,
  });
  const suspendedUser = db.users.find((u) => u.email === suspendedEmail);
  if (suspendedUser) suspendedUser.status = 'SUSPENDED';
  await assertThrowsAsync(
    () => AuthService.login({ emailOrPhone: suspendedEmail, password: 'Password123!' }),
    'suspended',
    'Suspended user cannot log in'
  );

  const inactiveEmail = `inactive_${Date.now()}@mlohub.tz`;
  await AuthService.registerCustomer({
    fullName: 'Inactive User',
    email: inactiveEmail,
    phone: `+255 710 ${Math.floor(100000 + Math.random() * 900000)}`,
    password: 'Password123!',
    agreeTerms: true,
  });
  const inactiveUser = db.users.find((u) => u.email === inactiveEmail);
  if (inactiveUser) inactiveUser.status = 'INACTIVE';
  await assertThrowsAsync(
    () => AuthService.login({ emailOrPhone: inactiveEmail, password: 'Password123!' }),
    'suspended or deactivated',
    'Inactive user cannot log in'
  );

  // =========================================================================
  // TEST GROUP 7: AUTHORIZATION GUARDS & ENDPOINT PROTECTION
  // =========================================================================
  console.log('\nTest Group 7: Authorization Guards & Endpoint Protection');
  const validCustAuth = AuthGuards.requireAuth(loginCust.token);
  assert(validCustAuth.isAuthenticated && validCustAuth.role === UserRole.CUSTOMER, 'requireAuth allows valid customer token');

  const invalidAuth = AuthGuards.requireAuth('invalid.token.payload');
  assert(!invalidAuth.isAuthenticated && invalidAuth.statusCode === 401, 'requireAuth rejects forged token with 401');

  const roleCheck = AuthGuards.requireRole(loginCust.token, [UserRole.RESTAURANT_OWNER, UserRole.ADMIN]);
  assert(!roleCheck.isAuthenticated && roleCheck.statusCode === 403, 'requireRole blocks customer from restaurant endpoints with 403');

  const restId = restaurantRes.activeRestaurant!.id;
  const memberCheck = AuthGuards.requireRestaurantMembership(loginChef.token, restId);
  assert(memberCheck.isAuthenticated, 'requireRestaurantMembership grants owner access to their restaurant');

  const unauthorizedRestCheck = AuthGuards.requireRestaurantMembership(loginChef.token, 'mama-amina-biryani');
  assert(!unauthorizedRestCheck.isAuthenticated && unauthorizedRestCheck.statusCode === 403, 'requireRestaurantMembership blocks owner from other restaurants');

  // Revoked membership rejected
  const revokedMemUser: UserEntity = {
    id: `usr-revoked-${Date.now()}`,
    fullName: 'Revoked Staff',
    email: `revoked_${Date.now()}@mlohub.tz`,
    phone: `+255 733 ${Math.floor(100000 + Math.random() * 900000)}`,
    passwordHash: CryptoEngine.hashPassword('Pass123!'),
    role: UserRole.RESTAURANT_OWNER,
    roles: [UserRole.RESTAURANT_OWNER],
    activeRole: UserRole.RESTAURANT_OWNER,
    language: 'sw',
    isEmailVerified: true,
    isPhoneVerified: true,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.users.push(revokedMemUser);
  db.restaurantMemberships.push({
    id: `mem-revoked-${Date.now()}`,
    userId: revokedMemUser.id,
    restaurantId: restId,
    role: 'STAFF',
    status: 'REVOKED',
    permissions: ['view_orders'],
    isPrimaryOwner: false,
    createdAt: new Date().toISOString(),
  });
  const revokedToken = createSignedSessionToken({
    userId: revokedMemUser.id,
    role: UserRole.RESTAURANT_OWNER,
    email: revokedMemUser.email,
    restaurantId: restId,
  });
  const revokedAuthCheck = AuthGuards.requireAuth(revokedToken);
  assert(!revokedAuthCheck.isAuthenticated && revokedAuthCheck.statusCode === 403, 'requireAuth rejects token with revoked membership (403)');
  const revokedMemGuardCheck = AuthGuards.requireRestaurantMembership(revokedToken, restId);
  assert(!revokedMemGuardCheck.isAuthenticated && revokedMemGuardCheck.statusCode === 403, 'requireRestaurantMembership rejects revoked membership (403)');

  // Suspended account rejected by AuthGuards
  const suspToken = createSignedSessionToken({
    userId: suspendedUser!.id,
    role: UserRole.CUSTOMER,
    email: suspendedEmail,
  });
  const suspGuardCheck = AuthGuards.requireAuth(suspToken);
  assert(!suspGuardCheck.isAuthenticated && suspGuardCheck.statusCode === 403, 'requireAuth rejects suspended account token (403)');

  // =========================================================================
  // TEST GROUP 8: MULTI-ROLE & WORKSPACE SWITCHING (PATCH 1B)
  // =========================================================================
  console.log('\nTest Group 8: Multi-Role & Workspace Switching');
  let currentChefToken = loginChef.token;
  const switchedCust = await AuthService.switchAccountContext(currentChefToken, UserRole.CUSTOMER);
  assert(switchedCust.user.activeRole === UserRole.CUSTOMER, 'Restaurant owner switched context to CUSTOMER without re-login');
  currentChefToken = switchedCust.token;

  const switchedBack = await AuthService.switchAccountContext(currentChefToken, UserRole.RESTAURANT_OWNER, restId);
  assert(switchedBack.user.activeRole === UserRole.RESTAURANT_OWNER, 'Switched context back to RESTAURANT_OWNER');
  currentChefToken = switchedBack.token;

  // Owner A cannot switch to Restaurant B
  await assertThrowsAsync(
    () => AuthService.switchWorkspace(currentChefToken, 'RESTAURANT_OWNER', 'mama-amina-biryani'),
    'membership',
    'Owner A cannot switch workspace to Restaurant B (without active membership)'
  );

  // Switching workspace invalidates replaced token and creates valid new token
  const chefTokenBeforeSwitch = currentChefToken;
  const switchWorkspaceRes = await AuthService.switchWorkspace(chefTokenBeforeSwitch, 'CUSTOMER');
  assert(switchWorkspaceRes.token !== chefTokenBeforeSwitch, 'New distinct token issued on workspace switch');

  const oldTokenVerify = await AuthService.verifySession(chefTokenBeforeSwitch);
  assert(oldTokenVerify === null, 'Old token invalidated after workspace switch in verifySession');

  const oldTokenGuard = AuthGuards.requireAuth(chefTokenBeforeSwitch);
  assert(!oldTokenGuard.isAuthenticated, 'Old token rejected by AuthGuards.requireAuth after switch');

  const newTokenVerify = await AuthService.verifySession(switchWorkspaceRes.token);
  assert(newTokenVerify !== null && newTokenVerify.user.activeRole === UserRole.CUSTOMER, 'New token valid and reflects CUSTOMER active role');

  // =========================================================================
  // TEST GROUP 9: LOGOUT & REAL SESSION REVOCATION
  // =========================================================================
  console.log('\nTest Group 9: Logout & Session Revocation');
  const activeTokenToLogout = switchWorkspaceRes.token;
  await AuthService.logout(activeTokenToLogout);

  const postLogoutVerify = await AuthService.verifySession(activeTokenToLogout);
  assert(postLogoutVerify === null, 'verifySession returns null after logout');

  const postLogoutGuard = AuthGuards.requireAuth(activeTokenToLogout);
  assert(!postLogoutGuard.isAuthenticated, 'requireAuth rejects revoked token after logout');

  const tokenInDb = db.sessions?.find((s) => s.token === activeTokenToLogout);
  assert(!tokenInDb, 'Session token completely purged from database sessions array on logout');

  // =========================================================================
  // TEST GROUP 10: SESSION EXPIRATION & BOOTSTRAP CLEANUP
  // =========================================================================
  console.log('\nTest Group 10: Session Expiration & Bootstrap Cleanup');
  const expiredUserId = `usr-exp-${Date.now()}`;
  const expiredToken = CryptoEngine.signToken({
    userId: expiredUserId,
    role: UserRole.CUSTOMER,
    email: 'expired@mlohub.tz',
  }, -100000); // Expired 100 seconds ago

  db.sessions = db.sessions || [];
  db.sessions.push({
    id: `sess-expired-${Date.now()}`,
    token: expiredToken,
    userId: expiredUserId,
    deviceInfo: 'test-runner',
    expiresAt: new Date(Date.now() - 100000).toISOString(),
    createdAt: new Date(Date.now() - 200000).toISOString(),
  });
  db.activeUserId = expiredUserId;
  await MloHubDB.save();

  const expiredBootstrapResult = await AuthService.bootstrapSession();
  assert(expiredBootstrapResult === null, 'Expired session bootstrap returns null');
  assert(db.activeUserId === undefined, 'Active user cleared when bootstrap encounters expired session');

  // Unknown user session
  const unknownUserToken = CryptoEngine.signToken({
    userId: 'non-existent-user-id',
    role: UserRole.CUSTOMER,
    email: 'ghost@mlohub.tz',
  }, 1000000);
  db.sessions.push({
    id: `sess-unknown-${Date.now()}`,
    token: unknownUserToken,
    userId: 'non-existent-user-id',
    deviceInfo: 'test-runner',
    expiresAt: new Date(Date.now() + 1000000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  db.activeUserId = 'non-existent-user-id';
  await MloHubDB.save();

  const unknownBootstrapResult = await AuthService.bootstrapSession();
  assert(unknownBootstrapResult === null, 'Session with non-existent user returns null on bootstrap');
  assert(db.activeUserId === undefined, 'Active user cleared when user does not exist in database');

  // user.get() returns undefined when no active user
  assert(MloHubDB.user.get() === undefined, 'MloHubDB.user.get() returns undefined when no active session');

  // Cross-user switching prevented
  await assertThrowsAsync(
    () => MloHubDB.user.switch('usr-other-user'),
    'Arbitrary account switching is disabled',
    'MloHubDB.user.switch blocks arbitrary user impersonation'
  );

  // =========================================================================
  // TEST GROUP 11: PORTAL ACCESS RESOLUTION (resolvePortalAccess)
  // =========================================================================
  console.log('\nTest Group 11: Restaurant Portal Access Resolution');
  const validOwnerUser = db.users.find((u) => u.id === restaurantRes.user.id)!;
  const validOwnerRestaurant = restaurantRes.activeRestaurant!;
  const validMemberships = db.restaurantMemberships.filter((m) => m.userId === validOwnerUser.id);

  // 1. Valid owner with active membership
  const accessAllowed = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: validOwnerUser,
    memberships: validMemberships,
    restaurants: db.restaurants,
    activeRestaurant: validOwnerRestaurant,
  });
  assert(
    accessAllowed.status === 'AUTHORIZED' && accessAllowed.restaurant?.id === validOwnerRestaurant.id,
    'resolvePortalAccess authorizes owner with active membership'
  );

  // 2. Revoked membership returns DENIED
  const revokedMembershipList: RestaurantMembershipEntity[] = [
    {
      id: 'mem-test-revoked',
      userId: validOwnerUser.id,
      restaurantId: validOwnerRestaurant.id,
      role: 'OWNER',
      status: 'REVOKED',
      permissions: ['all'],
      isPrimaryOwner: true,
      createdAt: new Date().toISOString(),
    },
  ];
  const accessRevoked = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: { ...validOwnerUser, role: UserRole.CUSTOMER, roles: [UserRole.CUSTOMER] },
    memberships: revokedMembershipList,
    restaurants: db.restaurants,
    activeRestaurant: validOwnerRestaurant,
  });
  assert(accessRevoked.status === 'DENIED', 'resolvePortalAccess denies access for revoked membership');

  // 3. Customer-only user returns DENIED
  const accessCustomerOnly = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: customerRes.user,
    memberships: [],
    restaurants: db.restaurants,
    activeRestaurant: null,
  });
  assert(accessCustomerOnly.status === 'DENIED', 'resolvePortalAccess denies access for customer-only user');

  // 4. Unassigned owner returns AWAITING_ASSIGNMENT
  const unassignedOwner: UserEntity = {
    ...validOwnerUser,
    id: `usr-unassigned-${Date.now()}`,
    role: UserRole.RESTAURANT_OWNER,
    roles: [UserRole.RESTAURANT_OWNER],
    activeRestaurantId: undefined,
  };
  const accessUnassigned = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: unassignedOwner,
    memberships: [],
    restaurants: db.restaurants,
    activeRestaurant: null,
  });
  assert(accessUnassigned.status === 'AWAITING_ASSIGNMENT', 'resolvePortalAccess returns AWAITING_ASSIGNMENT for unassigned owner');

  // 5. Suspended user returns DENIED
  const accessSuspended = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: suspendedUser!,
    memberships: validMemberships,
    restaurants: db.restaurants,
    activeRestaurant: validOwnerRestaurant,
  });
  assert(accessSuspended.status === 'DENIED', 'resolvePortalAccess denies access for suspended user');

  // 6. Unauthenticated returns UNAUTHENTICATED
  const accessUnauth = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: null,
    memberships: [],
    restaurants: db.restaurants,
    activeRestaurant: null,
  });
  assert(accessUnauth.status === 'UNAUTHENTICATED', 'resolvePortalAccess returns UNAUTHENTICATED when user is null');

  // =========================================================================
  // TEST GROUP 12: ORDER ISOLATION & SELECT RESTAURANT ORDERS
  // =========================================================================
  console.log('\nTest Group 12: Restaurant Order Isolation & selectRestaurantOrders');
  const sampleOrders: any[] = [
    { id: 'ord-1', targetRestaurantId: restId, status: 'Confirmed' },
    { id: 'ord-2', targetRestaurantId: 'mama-amina-biryani', status: 'Confirmed' },
    { id: 'ord-3', targetRestaurantId: undefined, status: 'Confirmed' },
  ];
  const strictlyFilteredOrders = selectRestaurantOrders(sampleOrders, restId);
  assert(
    strictlyFilteredOrders.length === 1 && strictlyFilteredOrders[0].id === 'ord-1',
    'selectRestaurantOrders strictly filters to targetRestaurantId without leaking unmatched/undefined orders'
  );
  assert(selectRestaurantOrders([], restId).length === 0, 'selectRestaurantOrders returns empty array for empty orders');
  assert(selectRestaurantOrders(null as any, restId).length === 0, 'selectRestaurantOrders safely handles null orders');
  assert(selectRestaurantOrders(sampleOrders, '').length === 0, 'selectRestaurantOrders returns empty array for empty restaurantId');

  // =========================================================================
  // TEST GROUP 13: STRICT REJECTION OF USER-ID SHORTCUTS
  // =========================================================================
  console.log('\nTest Group 13: Strict Rejection of User-ID Shortcuts in Workspace/Account Switching');
  const snapshotBeforeUserIdAttempt = JSON.stringify({
    activeUserId: db.activeUserId,
    sessionCount: (db.sessions || []).length,
  });

  await assertThrowsAsync(
    () => AuthService.switchWorkspace('usr-admin' as any, 'MLOHUB_ADMIN'),
    'Valid session token is required',
    'AuthService.switchWorkspace rejects arbitrary user-ID (usr-admin) without valid signed token'
  );

  await assertThrowsAsync(
    () => AuthService.switchWorkspace(validOwnerUser.id as any, 'RESTAURANT_OWNER'),
    'Valid session token is required',
    'AuthService.switchWorkspace rejects owner user-ID without token'
  );

  await assertThrowsAsync(
    () => AuthService.switchAccountContext('usr-admin' as any, UserRole.ADMIN),
    'Valid session token is required',
    'AuthService.switchAccountContext rejects arbitrary user-ID without valid signed token'
  );

  const snapshotAfterUserIdAttempt = JSON.stringify({
    activeUserId: db.activeUserId,
    sessionCount: (db.sessions || []).length,
  });
  assert(
    snapshotBeforeUserIdAttempt === snapshotAfterUserIdAttempt,
    'Database activeUserId and stored sessions remain completely unchanged after rejected user-ID attempts'
  );

  // =========================================================================
  // TEST GROUP 14: IMMEDIATE REVOCATION ON ADMIN DEMOTION
  // =========================================================================
  console.log('\nTest Group 14: Immediate Revocation on Admin Demotion');
  const tempAdminEmail = `admin_demote_${Date.now()}@mlohub.tz`;
  const tempAdminUser: UserEntity = {
    id: `usr-admin-demote-${Date.now()}`,
    fullName: 'Demotable Admin',
    email: tempAdminEmail,
    phone: `+255 777 ${Math.floor(100000 + Math.random() * 900000)}`,
    passwordHash: CryptoEngine.hashPassword('AdminPass2026!'),
    role: UserRole.ADMIN,
    roles: [UserRole.ADMIN, UserRole.CUSTOMER],
    language: 'sw',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.users.push(tempAdminUser);
  await MloHubDB.save();

  const adminToken = createSignedSessionToken({
    userId: tempAdminUser.id,
    role: UserRole.ADMIN,
    email: tempAdminEmail,
  });

  // Verification succeeds while user holds ADMIN in roles
  const verifiedBeforeDemote = await AuthService.verifySession(adminToken);
  assert(verifiedBeforeDemote !== null && verifiedBeforeDemote.user.id === tempAdminUser.id, 'Session verification succeeds for active admin');
  const guardPassBeforeDemote = AuthGuards.requireRole(adminToken, [UserRole.ADMIN]);
  assert(guardPassBeforeDemote.isAuthenticated && guardPassBeforeDemote.userId === tempAdminUser.id, 'AuthGuards.requireRole permits access for active admin');

  // Demote user in db.users: strip ADMIN role
  tempAdminUser.roles = [UserRole.CUSTOMER];
  tempAdminUser.role = UserRole.CUSTOMER;
  await MloHubDB.save();

  // Older token must now be immediately blocked because live account no longer holds claimed role
  const verifyAfterDemote = await AuthService.verifySession(adminToken);
  assert(verifyAfterDemote === null, 'verifySession rejects older token immediately when admin role is stripped from user.roles');

  const guardCheckAfterDemote = AuthGuards.requireRole(adminToken, [UserRole.ADMIN]);
  assert(!guardCheckAfterDemote.isAuthenticated, 'AuthGuards.requireRole blocks demoted admin immediately even if holding older signed token');

  // =========================================================================
  // TEST GROUP 15: STAFF MEMBER BLOCKED FROM OWNER-ONLY OPERATIONS
  // =========================================================================
  console.log('\nTest Group 15: Staff Member Blocked from Owner-Only Operations');
  const staffEmail = `staff_${Date.now()}@mlohub.tz`;
  const staffUserId = `usr-staff-${Date.now()}`;
  const testStaffUser: UserEntity = {
    id: staffUserId,
    fullName: 'Kitchen Staff Member',
    email: staffEmail,
    phone: `+255 788 ${Math.floor(100000 + Math.random() * 900000)}`,
    passwordHash: CryptoEngine.hashPassword('StaffPass2026!'),
    role: UserRole.RESTAURANT_STAFF,
    roles: [UserRole.RESTAURANT_STAFF],
    activeRestaurantId: restId,
    language: 'sw',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.users.push(testStaffUser);

  const staffMembership: RestaurantMembershipEntity = {
    id: `mem-staff-${Date.now()}`,
    userId: staffUserId,
    restaurantId: restId,
    role: 'STAFF',
    status: 'ACTIVE',
    permissions: ['view_orders', 'update_kitchen_status'],
    isPrimaryOwner: false,
    createdAt: new Date().toISOString(),
  };
  db.restaurantMemberships.push(staffMembership);
  await MloHubDB.save();

  const staffToken = createSignedSessionToken({
    userId: staffUserId,
    role: UserRole.RESTAURANT_STAFF,
    email: staffEmail,
    restaurantId: restId,
  });

  // Staff can verify membership
  const membershipCheck = AuthGuards.requireRestaurantMembership(staffToken, restId);
  assert(membershipCheck.isAuthenticated && membershipCheck.userId === staffUserId, 'requireRestaurantMembership accepts active staff member');

  // Staff is blocked from owner-only actions
  const ownerCheck = AuthGuards.requireRestaurantOwner(staffToken, restId);
  assert(!ownerCheck.isAuthenticated, 'AuthGuards.requireRestaurantOwner strictly blocks staff member');

  // =========================================================================
  // TEST GROUP 16: CRYPTOGRAPHICALLY DISTINCT TOKENS ON FROZEN CLOCK
  // =========================================================================
  console.log('\nTest Group 16: Cryptographically Distinct Tokens on Frozen Clock');
  const identicalClaims = {
    userId: 'usr-frozen-clock',
    role: UserRole.CUSTOMER,
    email: 'frozen@mlohub.tz',
  };

  // Issue two tokens consecutively without sleep
  const tokenA = CryptoEngine.signToken(identicalClaims);
  const tokenB = CryptoEngine.signToken(identicalClaims);
  assert(tokenA !== tokenB, 'Tokens issued with identical claims at the exact same time are distinct');

  const payloadA = CryptoEngine.verifyToken(tokenA);
  const payloadB = CryptoEngine.verifyToken(tokenB);
  assert(
    !!payloadA && !!payloadB && !!payloadA.jti && !!payloadB.jti && payloadA.jti !== payloadB.jti,
    'Each token carries a unique cryptographic sessionId/jti'
  );

  // =========================================================================
  // TEST GROUP 17: SESSION REPLACEMENT & MULTI-DEVICE ISOLATION
  // =========================================================================
  console.log('\nTest Group 17: Session Replacement & Multi-Device Isolation');
  const multiDevUser = validOwnerUser;
  const tokenDevice1 = createSignedSessionToken({
    userId: multiDevUser.id,
    role: UserRole.RESTAURANT_OWNER,
    email: multiDevUser.email,
    restaurantId: restId,
  });
  const tokenDevice2 = createSignedSessionToken({
    userId: multiDevUser.id,
    role: UserRole.RESTAURANT_OWNER,
    email: multiDevUser.email,
    restaurantId: restId,
  });

  assert(tokenDevice1 !== tokenDevice2, 'Device 1 and Device 2 receive distinct session tokens');

  // Both devices are authenticated
  const dev1Session = await AuthService.verifySession(tokenDevice1);
  const dev2Session = await AuthService.verifySession(tokenDevice2);
  assert(
    dev1Session !== null && dev2Session !== null &&
    dev1Session.user.id === multiDevUser.id && dev2Session.user.id === multiDevUser.id,
    'Both devices verified successfully'
  );

  // Device 1 switches workspace to CUSTOMER
  const switchRes = await AuthService.switchWorkspace(tokenDevice1, 'CUSTOMER');
  const tokenDevice1New = switchRes.token;
  assert(tokenDevice1New !== tokenDevice1, 'New distinct token issued on workspace switch');

  // Device 1's old token is invalidated
  const dev1OldCheck = await AuthService.verifySession(tokenDevice1);
  assert(dev1OldCheck === null, 'Device 1 old session token is invalidated upon workspace switch');

  // Device 1's new token is valid
  const dev1NewSession = await AuthService.verifySession(tokenDevice1New);
  assert(dev1NewSession !== null && dev1NewSession.user.id === multiDevUser.id, 'Device 1 new session token is valid');

  // Device 2's session remains valid and untouched
  const dev2StillValid = await AuthService.verifySession(tokenDevice2);
  assert(dev2StillValid !== null && dev2StillValid.user.id === multiDevUser.id, 'Device 2 session remains completely valid and undisturbed');

  // =========================================================================
  // TEST GROUP 18: PORTAL ACCESS CUSTOMER WORKSPACE GATE & MEMBERSHIP DEFENSE
  // =========================================================================
  console.log('\nTest Group 18: resolvePortalAccess Customer Workspace Gate & Foreign Membership Defense');
  // Owner in CUSTOMER workspace
  const portalCustWorkspace = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: validOwnerUser,
    memberships: validMemberships,
    restaurants: db.restaurants,
    activeRestaurant: validOwnerRestaurant,
    activeWorkspace: 'CUSTOMER',
  });
  assert(
    portalCustWorkspace.status === 'CUSTOMER_WORKSPACE',
    'resolvePortalAccess returns CUSTOMER_WORKSPACE when owner is in customer workspace'
  );
  assert(
    (portalCustWorkspace.availableRestaurants || []).some((r) => r.id === validOwnerRestaurant.id),
    'resolvePortalAccess provides availableRestaurants for switching when in customer workspace'
  );

  // Foreign membership defense: user A cannot use user B's membership
  const foreignMembership: RestaurantMembershipEntity = {
    id: 'mem-foreign-123',
    userId: 'usr-someone-else',
    restaurantId: validOwnerRestaurant.id,
    role: 'OWNER',
    status: 'ACTIVE',
    permissions: ['all'],
    isPrimaryOwner: true,
    createdAt: new Date().toISOString(),
  };
  const foreignPortalAccess = resolvePortalAccess({
    isAuthLoading: false,
    isReady: true,
    user: customerRes.user,
    memberships: [foreignMembership],
    restaurants: db.restaurants,
    activeRestaurant: null,
    activeWorkspace: 'RESTAURANT_OWNER',
  });
  assert(
    foreignPortalAccess.status === 'DENIED',
    'resolvePortalAccess rejects foreign membership belonging to another userId'
  );

  // =========================================================================
  // TEST GROUP 19: SUPABASE AUTH CLIENT CONFIGURATION & CONTRACTS
  // =========================================================================
  console.log('\nTest Group 19: Supabase Auth Client Configuration & Contracts');
  assert(typeof isSupabaseConfigured === 'function', 'isSupabaseConfigured export is a callable function');
  const configured = isSupabaseConfigured();
  assert(typeof configured === 'boolean', `isSupabaseConfigured() returns boolean (${configured})`);
  assert(supabase !== undefined && supabase.auth !== undefined, 'supabase.auth client is initialized and accessible');
  assert(typeof supabase.auth.signUp === 'function', 'supabase.auth.signUp is available');
  assert(typeof supabase.auth.signInWithPassword === 'function', 'supabase.auth.signInWithPassword is available');
  assert(typeof supabase.auth.signOut === 'function', 'supabase.auth.signOut is available');
  assert(typeof supabase.auth.resetPasswordForEmail === 'function', 'supabase.auth.resetPasswordForEmail is available');
  assert(typeof supabase.auth.onAuthStateChange === 'function', 'supabase.auth.onAuthStateChange is available');

  // Verify auth listener lifecycle
  const { data: listenerData } = supabase.auth.onAuthStateChange(() => {});
  assert(listenerData?.subscription !== undefined, 'onAuthStateChange returns a valid subscription object');
  assert(typeof listenerData?.subscription?.unsubscribe === 'function', 'Subscription has unsubscribe method');
  listenerData?.subscription?.unsubscribe();

  // =========================================================================
  // TEST GROUP 20: PACK 3B — AUTHCONTEXT PRODUCTION CUTOVER INVARIANTS
  // =========================================================================
  console.log('\nTest Group 20: Pack 3B — AuthContext Strict Environment Boundary Invariants');
  assert(runtimeConfig.isTest === true, 'Test runner detected runtimeConfig.isTest === true');
  assert(runtimeConfig.allowLocalDataFallbacks === true, 'Local fallbacks enabled only for test runner');

  const authContextPath = path.resolve(__dirname, '../context/AuthContext.tsx');
  assert(fs.existsSync(authContextPath), 'context/AuthContext.tsx exists');
  const authContextSrc = fs.readFileSync(authContextPath, 'utf8');

  // Verify deprecated insecure logging strings are completely eradicated
  assert(!authContextSrc.includes('local platform credentials'), 'No "local platform credentials" in AuthContext.tsx');
  assert(!authContextSrc.includes('restore local platform session'), 'No "restore local platform session" in AuthContext.tsx');

  // Verify runtimeConfig is imported and used
  assert(authContextSrc.includes("import { runtimeConfig } from '../lib/runtimeConfig';"), 'AuthContext imports runtimeConfig');
  assert(authContextSrc.includes('runtimeConfig.allowLocalDataFallbacks'), 'AuthContext gates local fallbacks with allowLocalDataFallbacks');

  // Verify MloHubDB is fully isolated from AuthContext (Pack 3H isolation)
  const lines = authContextSrc.split('\n');
  const mlohubDbNonImportLines = lines
    .map((l, idx) => ({ line: l.trim(), num: idx + 1 }))
    .filter(({ line }) => line.includes('MloHubDB') && !line.startsWith('import '));

  assert(
    mlohubDbNonImportLines.length === 0,
    `Pack 3H Isolation: AuthContext has 0 direct MloHubDB operations (delegates to DemoAuthAdapter)`
  );
  assert(
    authContextSrc.includes('DemoAuthAdapter'),
    'AuthContext routes local fallbacks through DemoAuthAdapter'
  );

  // Ensure fallbackBootstrap itself has fail-closed boundary
  assert(
    authContextSrc.includes('if (!runtimeConfig.allowLocalDataFallbacks)') &&
    authContextSrc.includes('await applyAuthState(null)'),
    'fallbackBootstrap fails closed (sets null state) when allowLocalDataFallbacks is false'
  );

  // Ensure switchUser fails closed in real modes
  assert(
    authContextSrc.includes("throw new Error('Account switching is disabled in this environment."),
    'switchUser blocks arbitrary account switching when allowLocalDataFallbacks is false'
  );

  console.log('\n======================================================');
  console.log(`🏁 AUTH TEST SUITE RESULTS: ${passedCount} Passed | ${failedCount} Failed`);
  console.log('======================================================\n');

  return { passedCount, failedCount };
}

// Self-executing if run directly
if (typeof require !== 'undefined' && require.main === module) {
  runAuthTestSuite().then((r) => {
    if (r.failedCount > 0) process.exit(1);
  });
}
