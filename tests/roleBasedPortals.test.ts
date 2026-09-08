import { MloHubDB } from '../db';
import { UserRole, hasAdminAccess, getUserRoles } from '../db/types';
import { AuthService } from '../db/auth/service';
import { AuthGuards } from '../db/auth/guards';
import { CryptoEngine } from '../db/auth/crypto';
import { AdminApiService } from '../services/AdminApiService';

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

export async function runRoleBasedPortalsTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB STRICT ROLE-BASED PORTAL SEPARATION TESTS (12 SCENARIOS)');
  console.log('================================================================\n');

  await MloHubDB.init();

  // Test setup users
  const customerUser = MloHubDB.users.getById('usr-frank')!;
  const ownerUser = MloHubDB.users.getById('usr-chef-amina')!;
  const adminUser = MloHubDB.users.getById('usr-admin')!;

  // Generate valid tokens
  const customerToken = CryptoEngine.signToken({
    userId: customerUser.id,
    role: UserRole.CUSTOMER,
    email: customerUser.email,
  });

  const ownerToken = CryptoEngine.signToken({
    userId: ownerUser.id,
    role: UserRole.RESTAURANT_OWNER,
    email: ownerUser.email,
    restaurantId: 'mama-amina-biryani',
  });

  const superAdminToken = CryptoEngine.signToken({
    userId: adminUser.id,
    role: UserRole.SUPER_ADMIN,
    email: adminUser.email,
  });

  const standardAdminToken = CryptoEngine.signToken({
    userId: 'usr-sub-admin',
    role: UserRole.ADMIN,
    email: 'subadmin@mlohub.tz',
  });

  // -------------------------------------------------------------------------
  // SCENARIO 1: Customer cannot see the Admin Onboarding card
  // -------------------------------------------------------------------------
  console.log('Scenario 1: Customer UI Visibility Guards');
  const customerCanSeeAdmin = hasAdminAccess(customerUser);
  assert(customerCanSeeAdmin === false, 'Customer user hasAdminAccess is FALSE (Admin Onboarding card hidden)');
  assert(
    !getUserRoles(customerUser).includes(UserRole.ADMIN) &&
    !getUserRoles(customerUser).includes(UserRole.SUPER_ADMIN),
    'Customer user has no admin roles'
  );

  // -------------------------------------------------------------------------
  // SCENARIO 2: Restaurant Owner cannot see the Admin Onboarding card
  // -------------------------------------------------------------------------
  console.log('\nScenario 2: Restaurant Owner UI Visibility Guards');
  const ownerCanSeeAdmin = hasAdminAccess(ownerUser);
  assert(ownerCanSeeAdmin === false, 'Restaurant Owner hasAdminAccess is FALSE (Admin Onboarding card strictly hidden)');
  assert(
    !getUserRoles(ownerUser).includes(UserRole.ADMIN) &&
    !getUserRoles(ownerUser).includes(UserRole.SUPER_ADMIN),
    'Restaurant Owner has no admin roles'
  );

  // -------------------------------------------------------------------------
  // SCENARIO 3: ADMIN can see and access Restaurant Onboarding
  // -------------------------------------------------------------------------
  console.log('\nScenario 3: Standard ADMIN Role Access');
  const standardAdminUser = {
    id: 'usr-sub-admin',
    role: UserRole.ADMIN,
    roles: [UserRole.ADMIN],
  };
  const adminCanSee = hasAdminAccess(standardAdminUser);
  assert(adminCanSee === true, 'ADMIN role hasAdminAccess is TRUE (Admin Onboarding card rendered)');
  const adminApiAuth = AuthGuards.requireRole(standardAdminToken, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert(adminApiAuth.isAuthenticated === true, 'ADMIN role passes requireRole guard');

  // -------------------------------------------------------------------------
  // SCENARIO 4: SUPER_ADMIN can see and access Restaurant Onboarding
  // -------------------------------------------------------------------------
  console.log('\nScenario 4: SUPER_ADMIN Role Access');
  const superAdminCanSee = hasAdminAccess(adminUser);
  assert(superAdminCanSee === true, 'SUPER_ADMIN role hasAdminAccess is TRUE');
  const superAdminApiAuth = AuthGuards.requireRole(superAdminToken, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert(superAdminApiAuth.isAuthenticated === true, 'SUPER_ADMIN role passes requireRole guard');

  // -------------------------------------------------------------------------
  // SCENARIO 5: Restaurant Owner manually opening /admin is denied
  // -------------------------------------------------------------------------
  console.log('\nScenario 5: Route Guard Navigation Protection (/admin)');
  const ownerRouteCheck = hasAdminAccess(ownerUser);
  assert(ownerRouteCheck === false, 'Navigation guard blocks Restaurant Owner from /admin route');
  const customerRouteCheck = hasAdminAccess(customerUser);
  assert(customerRouteCheck === false, 'Navigation guard blocks Customer from /admin route');

  // -------------------------------------------------------------------------
  // SCENARIO 6: Restaurant Owner calling an admin API receives 403 Forbidden
  // -------------------------------------------------------------------------
  console.log('\nScenario 6: Backend API 403 Forbidden on Unauthorized Access');
  const ownerApiRes = await AdminApiService.listRestaurants(ownerToken);
  assert(ownerApiRes.statusCode === 403, 'Restaurant Owner calling GET /api/admin/restaurants receives HTTP 403');
  assert(ownerApiRes.success === false, 'Admin API rejects Restaurant Owner request');
  assert(ownerApiRes.error?.includes('403 Forbidden') === true, 'Response error specifies 403 Forbidden');

  const customerApiRes = await AdminApiService.createRestaurant(customerToken, {
    businessName: 'Hacker Spot',
    ownerName: 'Fake Admin',
    ownerPhone: '+255 799 999 999',
    ownerNationalId: '19999999-00000-00000-00',
    neighborhood: 'Sinza',
    address: 'Sinza',
    payoutPhoneNumber: '+255 799 999 999',
    initialMenu: [{ name: 'Test', priceTzs: 1000 }],
    checklist: {
      phoneVerified: true,
      ownerIdentified: true,
      locationConfirmed: true,
      businessPhotoAttached: true,
      menuWithPricesAdded: true,
      termsAccepted: true,
    },
  });
  assert(customerApiRes.statusCode === 403, 'Customer calling POST /api/admin/restaurants receives HTTP 403');

  // -------------------------------------------------------------------------
  // SCENARIO 7: Unauthenticated user calling an admin API receives 401 Unauthorized
  // -------------------------------------------------------------------------
  console.log('\nScenario 7: Backend API 401 Unauthorized on Missing / Invalid Auth');
  const unauthApiRes = await AdminApiService.listRestaurants(undefined);
  assert(unauthApiRes.statusCode === 401, 'Unauthenticated request receives HTTP 401');
  assert(unauthApiRes.error?.includes('401 Unauthorized') === true, 'Error specifies 401 Unauthorized');

  const forgedTokenRes = await AdminApiService.listRestaurants('invalid-fake-token');
  assert(forgedTokenRes.statusCode === 401, 'Invalid signature token receives HTTP 401');

  // -------------------------------------------------------------------------
  // SCENARIO 8: Restaurant Owner cannot manage another restaurant
  // -------------------------------------------------------------------------
  console.log('\nScenario 8: Multi-Tenant Restaurant Boundary Protection');
  const otherRestaurantId = 'kibo-mchemsho';
  const ownerCrossAccessCheck = AuthGuards.requireRestaurantMembership(ownerToken, otherRestaurantId);
  assert(ownerCrossAccessCheck.isAuthenticated === false, 'Owner blocked from managing other restaurant');
  assert(ownerCrossAccessCheck.statusCode === 403, 'Cross-tenant access returns 403');

  const ownAccessCheck = AuthGuards.requireRestaurantMembership(ownerToken, 'mama-amina-biryani');
  assert(ownAccessCheck.isAuthenticated === true, 'Owner allowed to manage their own restaurant');

  // -------------------------------------------------------------------------
  // SCENARIO 9: Changing a role in local storage does not grant access
  // -------------------------------------------------------------------------
  console.log('\nScenario 9: Client-Side Role Spoofing Prevention');
  // Attempt forged payload with role ADMIN signed with invalid key
  const forgedAdminPayload = {
    userId: 'usr-frank',
    role: 'ADMIN',
    email: 'frank@mlohub.tz',
    exp: Date.now() + 100000,
  };
  const fakeToken = `header.${Buffer.from(JSON.stringify(forgedAdminPayload)).toString('base64')}.bad_signature`;
  const spoofAttemptAuth = AuthGuards.requireRole(fakeToken, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert(spoofAttemptAuth.isAuthenticated === false, 'Cryptographic verification rejects spoofed token');
  assert(spoofAttemptAuth.statusCode === 401, 'Spoofed token returns 401');

  // -------------------------------------------------------------------------
  // SCENARIO 10: Switch Account displays only authorized workspaces
  // -------------------------------------------------------------------------
  console.log('\nScenario 10: Authorized Workspace Resolution');
  const customerWorkspaces = await AuthService.getAuthorizedWorkspaces(customerUser.id);
  assert(customerWorkspaces.length === 1, 'Customer-only user gets exactly 1 workspace (Personal Account)');
  assert(customerWorkspaces[0].type === 'CUSTOMER', 'Workspace is Customer type');
  assert(!customerWorkspaces.some((w) => w.type === 'MLOHUB_ADMIN'), 'Admin workspace not shown to customer');

  const ownerWorkspaces = await AuthService.getAuthorizedWorkspaces(ownerUser.id);
  assert(ownerWorkspaces.some((w) => w.type === 'CUSTOMER'), 'Owner has Personal Account workspace');
  assert(ownerWorkspaces.some((w) => w.type === 'RESTAURANT_OWNER'), 'Owner has Restaurant Owner workspace');
  assert(!ownerWorkspaces.some((w) => w.type === 'MLOHUB_ADMIN'), 'Admin workspace not shown to restaurant owner');

  const adminWorkspaces = await AuthService.getAuthorizedWorkspaces(adminUser.id);
  assert(adminWorkspaces.some((w) => w.type === 'MLOHUB_ADMIN'), 'Admin has MloHub Administration workspace');

  // Unauthorized switch attempt
  try {
    await AuthService.switchWorkspace(customerUser.id, 'MLOHUB_ADMIN');
    assert(false, 'Should have thrown error on unauthorized workspace switch');
  } catch (e: any) {
    assert(e.message.includes('403 Forbidden'), 'Unauthorized workspace switch threw 403 error');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 11: Customer features do not appear in active Restaurant workspace
  // -------------------------------------------------------------------------
  console.log('\nScenario 11: Workspace UI Isolation');
  const switchedToOwner = await AuthService.switchWorkspace(ownerUser.id, 'RESTAURANT_OWNER', 'mama-amina-biryani');
  assert(switchedToOwner.user.activeWorkspace === 'RESTAURANT_OWNER', 'Active workspace set to RESTAURANT_OWNER');
  assert(switchedToOwner.activeRestaurant?.id === 'mama-amina-biryani', 'Active restaurant entity attached');

  const switchedToCustomer = await AuthService.switchWorkspace(ownerUser.id, 'CUSTOMER');
  assert(switchedToCustomer.user.activeWorkspace === 'CUSTOMER', 'Switched back to CUSTOMER workspace');

  // -------------------------------------------------------------------------
  // SCENARIO 12: Admin data is never fetched before authorization succeeds & Audit Log Recorded
  // -------------------------------------------------------------------------
  console.log('\nScenario 12: Audit Logging & Pre-Authorization Protection');
  const prevLogsCount = MloHubDB.auditLogs.getAll().length;

  const validAdminAction = await AdminApiService.sendRestaurantOtp(superAdminToken, '+255 754 888 777');
  assert(validAdminAction.statusCode === 200, 'Super Admin successfully executed admin action');
  
  const newLogsCount = MloHubDB.auditLogs.getAll().length;
  assert(newLogsCount > prevLogsCount, 'Audit log recorded sensitive admin action');
  const latestLog = MloHubDB.auditLogs.getAll()[0];
  assert(latestLog.action === 'SEND_OTP', 'Audit log action matches SEND_OTP');
  assert(latestLog.adminUserId === adminUser.id, 'Audit log records admin user ID');

  console.log('\n================================================================');
  console.log(`🏁 ROLE-BASED PORTALS TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run when executed directly
runRoleBasedPortalsTestSuite();
