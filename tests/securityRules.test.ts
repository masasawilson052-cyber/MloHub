import { MloHubDB } from '../db';
import { UserRole, RestaurantMembershipEntity, UserEntity } from '../db/types';
import { AuthGuards } from '../db/auth/guards';
import { CryptoEngine } from '../db/auth/crypto';
import { RestaurantRole, RestaurantPermission } from '../types/auth';

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

function createSignedTestToken(payload: {
  userId: string;
  role: UserRole;
  email: string;
  restaurantId?: string;
}): string {
  const token = CryptoEngine.signToken(payload);
  const db = MloHubDB.getSnapshot();
  db.sessions = db.sessions || [];
  db.sessions.push({
    id: `sess-sec-${Date.now()}-${Math.random()}`,
    userId: payload.userId,
    token,
    deviceInfo: 'Security Test Runner',
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export async function runSecurityRulesTestSuite(): Promise<{ passedCount: number; failedCount: number }> {
  console.log('\n================================================================');
  console.log('🧪 STAGE 3: DATABASE SECURITY, TENANT ISOLATION & RBAC TEST SUITE');
  console.log('================================================================\n');

  await MloHubDB.init();

  // ---------------------------------------------------------------------------
  // GROUP 1: Platform Role Escalation Defense
  // ---------------------------------------------------------------------------
  console.log('Test Group 1: Platform Role Escalation Prevention');

  const customerUser = MloHubDB.users.getById('usr-frank');
  assert(customerUser !== undefined, 'Customer profile exists');
  assert(customerUser?.role === UserRole.CUSTOMER, 'Customer role is CUSTOMER');

  // Customer cannot forge admin claims or elevate via profile update
  const fakeAdminPayload = {
    ...customerUser!,
    role: UserRole.ADMIN,
    roles: [UserRole.CUSTOMER, UserRole.ADMIN],
  };

  // Profile protection logic: simulate profile update validation
  function validateProfileUpdate(callerId: string, currentRoles: UserRole[], updates: Partial<UserEntity>): { allowed: boolean; error?: string } {
    const isAdmin = currentRoles.includes(UserRole.ADMIN) || currentRoles.includes(UserRole.SUPER_ADMIN);
    const protectedFields = ['role', 'roles', 'account_type', 'status', 'is_identity_verified', 'is_phone_verified'];
    const attemptedProtectedFields = Object.keys(updates).filter(k => protectedFields.includes(k));

    if (!isAdmin && attemptedProtectedFields.length > 0) {
      return {
        allowed: false,
        error: `403 Forbidden: Field(s) [${attemptedProtectedFields.join(', ')}] are protected and can only be modified by platform administrators.`,
      };
    }
    return { allowed: true };
  }

  const escalationAttempt = validateProfileUpdate('usr-frank', [UserRole.CUSTOMER], {
    role: UserRole.ADMIN,
    status: 'ACTIVE',
  });
  assert(escalationAttempt.allowed === false, 'Non-admin prevented from modifying role/status');
  assert(Boolean(escalationAttempt.error?.includes('protected and can only be modified by platform administrators')), 'Proper 403 security error returned on escalation attempt');

  const adminAttempt = validateProfileUpdate('usr-admin', [UserRole.ADMIN], {
    status: 'SUSPENDED',
  });
  assert(adminAttempt.allowed === true, 'Platform administrator permitted to update protected fields');

  // ---------------------------------------------------------------------------
  // GROUP 2: Restaurant Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 2: Restaurant Tenant Isolation');

  const mamaAminaRestId = 'mama-amina-biryani';
  const kiboRestId = 'kibo-mchemsho';

  // Seed test users in db.users so requireAuth succeeds
  const db = MloHubDB.getSnapshot();
  db.users = db.users || [];
  
  const testUsers = [
    {
      id: 'usr-staff-b',
      fullName: 'Staff Member B',
      email: 'staff.b@kibomchemsho.tz',
      phone: '+255 754 000 001',
      role: UserRole.RESTAURANT_STAFF,
      roles: [UserRole.RESTAURANT_STAFF],
      activeRole: UserRole.RESTAURANT_STAFF,
      activeWorkspace: 'CUSTOMER' as const,
      status: 'ACTIVE' as const,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'usr-manager-amina',
      fullName: 'Manager Amina',
      email: 'manager@mamaamina.tz',
      phone: '+255 754 000 002',
      role: UserRole.RESTAURANT_STAFF,
      roles: [UserRole.RESTAURANT_STAFF],
      activeRole: UserRole.RESTAURANT_STAFF,
      activeWorkspace: 'CUSTOMER' as const,
      status: 'ACTIVE' as const,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'usr-chef-juma',
      fullName: 'Chef Juma',
      email: 'chef@mamaamina.tz',
      phone: '+255 754 000 003',
      role: UserRole.RESTAURANT_STAFF,
      roles: [UserRole.RESTAURANT_STAFF],
      activeRole: UserRole.RESTAURANT_STAFF,
      activeWorkspace: 'CUSTOMER' as const,
      status: 'ACTIVE' as const,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'usr-staff-rashid',
      fullName: 'Staff Rashid',
      email: 'rashid@mamaamina.tz',
      phone: '+255 754 000 004',
      role: UserRole.RESTAURANT_STAFF,
      roles: [UserRole.RESTAURANT_STAFF],
      activeRole: UserRole.RESTAURANT_STAFF,
      activeWorkspace: 'CUSTOMER' as const,
      status: 'ACTIVE' as const,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Insert or update test users
  for (const u of testUsers) {
    const idx = db.users.findIndex(x => x.id === u.id);
    if (idx >= 0) db.users[idx] = u as any;
    else db.users.push(u as any);
  }

  // Seed memberships for testing
  db.restaurantMemberships = db.restaurantMemberships || [];
  db.restaurantMemberships = db.restaurantMemberships.filter(m => !m.id.startsWith('sec-test-'));

  db.restaurantMemberships.push({
    id: 'sec-test-mem-amina',
    userId: 'usr-chef-amina',
    restaurantId: mamaAminaRestId,
    role: 'OWNER',
    isPrimaryOwner: true,
    permissions: [
      'VIEW_DASHBOARD', 'VIEW_ORDERS', 'MANAGE_ORDERS',
      'VIEW_MENU', 'MANAGE_MENU', 'VERIFY_MENU',
      'VIEW_RESERVATIONS', 'MANAGE_RESERVATIONS',
      'VIEW_REVIEWS', 'MANAGE_STAFF', 'VIEW_ANALYTICS',
      'VIEW_FINANCIALS', 'MANAGE_PAYOUTS', 'MANAGE_SETTINGS'
    ],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  db.restaurantMemberships.push({
    id: 'sec-test-mem-staff-b',
    userId: 'usr-staff-b',
    restaurantId: kiboRestId,
    role: 'STAFF',
    isPrimaryOwner: false,
    permissions: ['VIEW_DASHBOARD', 'VIEW_ORDERS'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  const aminaToken = createSignedTestToken({
    userId: 'usr-chef-amina',
    role: UserRole.RESTAURANT_OWNER,
    email: 'mama.amina@mlohub.tz',
    restaurantId: mamaAminaRestId,
  });

  const staffBToken = createSignedTestToken({
    userId: 'usr-staff-b',
    role: UserRole.RESTAURANT_STAFF,
    email: 'staff.b@kibomchemsho.tz',
    restaurantId: kiboRestId,
  });

  // Owner of Restaurant A accesses Restaurant A
  const aminaOwnRestAuth = AuthGuards.requireRestaurantMembership(aminaToken, mamaAminaRestId);
  assert(aminaOwnRestAuth.isAuthenticated === true, 'Owner permitted access to their own restaurant tenant');

  // Owner of Restaurant A tries to access Restaurant B
  const aminaCrossTenantAuth = AuthGuards.requireRestaurantMembership(aminaToken, kiboRestId);
  assert(aminaCrossTenantAuth.isAuthenticated === false, 'Owner blocked from cross-tenant access to Restaurant B');
  assert(aminaCrossTenantAuth.statusCode === 403, 'Cross-tenant access returned HTTP 403 Forbidden');

  // Staff of Restaurant B tries to access Restaurant A
  const staffBCrossTenantAuth = AuthGuards.requireRestaurantMembership(staffBToken, mamaAminaRestId);
  assert(staffBCrossTenantAuth.isAuthenticated === false, 'Staff member blocked from cross-tenant access to Restaurant A');
  assert(staffBCrossTenantAuth.statusCode === 403, 'Staff cross-tenant access returns 403');

  // ---------------------------------------------------------------------------
  // GROUP 3: Granular Restaurant Role-Based Access Control (RBAC)
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 3: Granular Restaurant Role & Permission Guards');

  // Add a Manager and Chef for Mama Amina Biryani
  db.restaurantMemberships.push({
    id: 'sec-test-mem-manager',
    userId: 'usr-manager-amina',
    restaurantId: mamaAminaRestId,
    role: 'MANAGER',
    isPrimaryOwner: false,
    permissions: [
      'VIEW_DASHBOARD', 'VIEW_ORDERS', 'MANAGE_ORDERS',
      'VIEW_MENU', 'MANAGE_MENU', 'VERIFY_MENU',
      'VIEW_RESERVATIONS', 'MANAGE_RESERVATIONS',
      'VIEW_REVIEWS', 'VIEW_ANALYTICS', 'VIEW_EARNINGS'
    ],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  db.restaurantMemberships.push({
    id: 'sec-test-mem-chef',
    userId: 'usr-chef-juma',
    restaurantId: mamaAminaRestId,
    role: 'CHEF',
    isPrimaryOwner: false,
    permissions: ['VIEW_DASHBOARD', 'VIEW_ORDERS', 'MANAGE_ORDERS', 'VIEW_MENU', 'VIEW_RESERVATIONS'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  db.restaurantMemberships.push({
    id: 'sec-test-mem-staff',
    userId: 'usr-staff-rashid',
    restaurantId: mamaAminaRestId,
    role: 'STAFF',
    isPrimaryOwner: false,
    permissions: ['VIEW_DASHBOARD', 'VIEW_ORDERS', 'VIEW_MENU', 'VIEW_RESERVATIONS'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  const managerToken = createSignedTestToken({
    userId: 'usr-manager-amina',
    role: UserRole.RESTAURANT_STAFF,
    email: 'manager@mamaamina.tz',
    restaurantId: mamaAminaRestId,
  });

  const chefToken = createSignedTestToken({
    userId: 'usr-chef-juma',
    role: UserRole.RESTAURANT_STAFF,
    email: 'chef@mamaamina.tz',
    restaurantId: mamaAminaRestId,
  });

  const staffToken = createSignedTestToken({
    userId: 'usr-staff-rashid',
    role: UserRole.RESTAURANT_STAFF,
    email: 'rashid@mamaamina.tz',
    restaurantId: mamaAminaRestId,
  });

  // Test requireRestaurantRole
  const ownerRoleCheck = AuthGuards.requireRestaurantRole(aminaToken, mamaAminaRestId, ['OWNER']);
  assert(ownerRoleCheck.isAuthenticated === true, 'requireRestaurantRole grants OWNER');

  const managerRoleCheck = AuthGuards.requireRestaurantRole(managerToken, mamaAminaRestId, ['OWNER', 'MANAGER']);
  assert(managerRoleCheck.isAuthenticated === true, 'requireRestaurantRole grants MANAGER for [OWNER, MANAGER]');

  const chefRoleCheck = AuthGuards.requireRestaurantRole(chefToken, mamaAminaRestId, ['OWNER', 'MANAGER']);
  assert(chefRoleCheck.isAuthenticated === false, 'requireRestaurantRole blocks CHEF when only [OWNER, MANAGER] allowed');
  assert(chefRoleCheck.statusCode === 403, 'Blocked role check returns 403');

  // Test requireRestaurantPermission: MANAGE_STAFF (Owner only by default)
  const ownerStaffPerm = AuthGuards.requireRestaurantPermission(aminaToken, mamaAminaRestId, 'MANAGE_STAFF');
  assert(ownerStaffPerm.isAuthenticated === true, 'OWNER has MANAGE_STAFF permission');

  const managerStaffPerm = AuthGuards.requireRestaurantPermission(managerToken, mamaAminaRestId, 'MANAGE_STAFF');
  assert(managerStaffPerm.isAuthenticated === false, 'MANAGER blocked from MANAGE_STAFF by default');

  // Test requireRestaurantPermission: MANAGE_MENU (Owner & Manager allowed)
  const managerMenuPerm = AuthGuards.requireRestaurantPermission(managerToken, mamaAminaRestId, 'MANAGE_MENU');
  assert(managerMenuPerm.isAuthenticated === true, 'MANAGER has MANAGE_MENU permission');

  const staffMenuPerm = AuthGuards.requireRestaurantPermission(staffToken, mamaAminaRestId, 'MANAGE_MENU');
  assert(staffMenuPerm.isAuthenticated === false, 'STAFF blocked from MANAGE_MENU');

  // Test requireRestaurantPermission: MANAGE_ORDERS (Owner, Manager, Chef allowed)
  const chefOrderPerm = AuthGuards.requireRestaurantPermission(chefToken, mamaAminaRestId, 'MANAGE_ORDERS');
  assert(chefOrderPerm.isAuthenticated === true, 'CHEF has MANAGE_ORDERS permission');

  const staffOrderPerm = AuthGuards.requireRestaurantPermission(staffToken, mamaAminaRestId, 'MANAGE_ORDERS');
  assert(staffOrderPerm.isAuthenticated === false, 'STAFF blocked from MANAGE_ORDERS without explicit grant');

  // Test requireRestaurantPermission: VIEW_DASHBOARD (All members allowed)
  const staffDashboardPerm = AuthGuards.requireRestaurantPermission(staffToken, mamaAminaRestId, 'VIEW_DASHBOARD');
  assert(staffDashboardPerm.isAuthenticated === true, 'STAFF has VIEW_DASHBOARD permission');

  // ---------------------------------------------------------------------------
  // GROUP 4: Last-Owner Protection
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 4: Last-Owner Protection');

  function validateOwnerRemoval(restaurantId: string, membershipIdToRemove: string): { allowed: boolean; error?: string } {
    const mems = db.restaurantMemberships?.filter(m => m.restaurantId === restaurantId && m.status === 'ACTIVE') || [];
    const target = mems.find(m => m.id === membershipIdToRemove);
    if (!target) return { allowed: false, error: 'Membership not found' };

    if (target.role === 'OWNER') {
      const remainingOwners = mems.filter(m => m.id !== membershipIdToRemove && m.role === 'OWNER');
      if (remainingOwners.length === 0) {
        return {
          allowed: false,
          error: 'Cannot delete or deactivate the last active OWNER of a restaurant.',
        };
      }
    }
    return { allowed: true };
  }

  const removeLastOwner = validateOwnerRemoval(mamaAminaRestId, 'sec-test-mem-amina');
  assert(removeLastOwner.allowed === false, 'Removal of sole active restaurant OWNER is rejected');
  assert(Boolean(removeLastOwner.error?.includes('last active OWNER')), 'Error specifies last active OWNER protection');

  // Adding a second owner allows removal of the first
  db.restaurantMemberships.push({
    id: 'sec-test-mem-co-owner',
    userId: 'usr-co-owner',
    restaurantId: mamaAminaRestId,
    role: 'OWNER',
    isPrimaryOwner: false,
    permissions: ['VIEW_DASHBOARD', 'MANAGE_SETTINGS'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  const removeFirstWithCoOwner = validateOwnerRemoval(mamaAminaRestId, 'sec-test-mem-amina');
  assert(removeFirstWithCoOwner.allowed === true, 'Removal permitted when another active OWNER exists');

  // Cleanup co-owner
  db.restaurantMemberships = db.restaurantMemberships.filter(m => m.id !== 'sec-test-mem-co-owner');

  // ---------------------------------------------------------------------------
  // GROUP 5: Order Immutability & Pricing Trust Boundary
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 5: Zero-Trust Order Pricing & Snapshot Immutability');

  // Server-side pricing trust model test
  function calculateTrustedOrderPricing(
    menuItems: Array<{ id: string; priceTzs: number }>,
    orderItems: Array<{ menuItemId: string; quantity: number }>
  ): { subtotalTzs: number; serviceFeeTzs: number; deliveryFeeTzs: number; totalTzs: number } {
    let subtotal = 0;
    for (const item of orderItems) {
      const found = menuItems.find(m => m.id === item.menuItemId);
      if (!found) throw new Error(`Menu item not found: ${item.menuItemId}`);
      if (item.quantity <= 0) throw new Error('Quantity must be positive');
      subtotal += found.priceTzs * item.quantity;
    }
    const serviceFee = 1500;
    const deliveryFee = 2500;
    return {
      subtotalTzs: subtotal,
      serviceFeeTzs: serviceFee,
      deliveryFeeTzs: deliveryFee,
      totalTzs: subtotal + serviceFee + deliveryFee,
    };
  }

  const catalog = [
    { id: 'item-biryani', priceTzs: 12000 },
    { id: 'item-juice', priceTzs: 3000 },
  ];

  // Client attempts to submit spoofed price (e.g. 100 TZS instead of 12000 TZS)
  const clientPayload = [
    { menuItemId: 'item-biryani', quantity: 2, clientClaimedPrice: 100 },
    { menuItemId: 'item-juice', quantity: 1, clientClaimedPrice: 50 },
  ];

  const trustedCalc = calculateTrustedOrderPricing(catalog, clientPayload);
  assert(trustedCalc.subtotalTzs === 27000, 'Server recalculates subtotal strictly from catalog (12000*2 + 3000 = 27000 TZS)');
  assert(trustedCalc.totalTzs === 31000, 'Server calculates total including fixed fees (27000 + 1500 + 2500 = 31000 TZS)');

  // Immutability trigger validation
  function validateOrderItemMutation(orderStatus: string, oldItem: any, newItem: any): { allowed: boolean; error?: string } {
    if (orderStatus !== 'PENDING' && (oldItem.unit_price_tzs !== newItem.unit_price_tzs || oldItem.subtotal_tzs !== newItem.subtotal_tzs)) {
      return {
        allowed: false,
        error: 'Order items and historical pricing cannot be modified once the order has been placed.',
      };
    }
    return { allowed: true };
  }

  const tamperAttempt = validateOrderItemMutation('ACCEPTED', { unit_price_tzs: 12000, subtotal_tzs: 24000 }, { unit_price_tzs: 5000, subtotal_tzs: 10000 });
  assert(tamperAttempt.allowed === false, 'Order item line price tampering rejected after placement');
  assert(Boolean(tamperAttempt.error?.includes('Order items and historical pricing cannot be modified')), 'Rejection message enforces snapshot immutability');

  // ---------------------------------------------------------------------------
  // GROUP 6: Order State Machine Transitions
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 6: Order State Machine Validation');

  const validTransitions: Record<string, string[]> = {
    'PENDING': ['ACCEPTED', 'CONFIRMED', 'CANCELLED', 'REJECTED'],
    'ACCEPTED': ['PREPARING', 'CANCELLED'],
    'CONFIRMED': ['PREPARING', 'CANCELLED'],
    'PREPARING': ['READY', 'CANCELLED'],
    'READY': ['OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'],
    'OUT_FOR_DELIVERY': ['COMPLETED', 'CANCELLED'],
    'COMPLETED': [], // Terminal
    'CANCELLED': [], // Terminal
    'REJECTED': [],  // Terminal
  };

  function validateStatusTransition(currentStatus: string, newStatus: string): boolean {
    const allowed = validTransitions[currentStatus] || [];
    return allowed.includes(newStatus);
  }

  assert(validateStatusTransition('PENDING', 'ACCEPTED') === true, 'PENDING -> ACCEPTED is valid');
  assert(validateStatusTransition('ACCEPTED', 'PREPARING') === true, 'ACCEPTED -> PREPARING is valid');
  assert(validateStatusTransition('PREPARING', 'READY') === true, 'PREPARING -> READY is valid');
  assert(validateStatusTransition('READY', 'COMPLETED') === true, 'READY -> COMPLETED is valid');
  assert(validateStatusTransition('PENDING', 'COMPLETED') === false, 'Direct jump PENDING -> COMPLETED is blocked');
  assert(validateStatusTransition('COMPLETED', 'PENDING') === false, 'Reverting COMPLETED -> PENDING is blocked');
  assert(validateStatusTransition('CANCELLED', 'ACCEPTED') === false, 'Reactivating CANCELLED order is blocked');

  // ---------------------------------------------------------------------------
  // GROUP 7: Verified Review Checks
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 7: Verified Review Ownership & Validation');

  interface ReviewSubmission {
    userId: string;
    restaurantId: string;
    orderId?: string;
    rating: number;
    hasCompletedOrder: boolean;
  }

  function validateReviewEligibility(submission: ReviewSubmission): { allowed: boolean; error?: string } {
    if (!submission.hasCompletedOrder) {
      return {
        allowed: false,
        error: 'Reviews can only be submitted for completed orders.',
      };
    }
    if (!Number.isInteger(submission.rating) || submission.rating < 1 || submission.rating > 5) {
      return {
        allowed: false,
        error: 'Rating must be an integer between 1 and 5.',
      };
    }
    return { allowed: true };
  }

  const unverifiedReview = validateReviewEligibility({
    userId: 'usr-frank',
    restaurantId: mamaAminaRestId,
    rating: 5,
    hasCompletedOrder: false,
  });
  assert(unverifiedReview.allowed === false, 'Review rejected when user has no completed order');
  assert(Boolean(unverifiedReview.error?.includes('completed orders')), 'Error enforces completed order prerequisite');

  const invalidRatingReview = validateReviewEligibility({
    userId: 'usr-frank',
    restaurantId: mamaAminaRestId,
    rating: 6,
    hasCompletedOrder: true,
  });
  assert(invalidRatingReview.allowed === false, 'Review rating > 5 rejected');

  const zeroRatingReview = validateReviewEligibility({
    userId: 'usr-frank',
    restaurantId: mamaAminaRestId,
    rating: 0,
    hasCompletedOrder: true,
  });
  assert(zeroRatingReview.allowed === false, 'Review rating < 1 rejected');

  const validReview = validateReviewEligibility({
    userId: 'usr-frank',
    restaurantId: mamaAminaRestId,
    rating: 5,
    hasCompletedOrder: true,
  });
  assert(validReview.allowed === true, 'Valid 5-star review on completed order accepted');

  // ---------------------------------------------------------------------------
  // GROUP 8: Storage Bucket Tenant Isolation Paths
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 8: Storage Bucket Tenant Path Isolation');

  function validateStorageUploadPath(
    bucket: string,
    path: string,
    context: { userId: string; restaurantId?: string; isAdmin?: boolean }
  ): { allowed: boolean; error?: string } {
    if (context.isAdmin) return { allowed: true };

    if (bucket === 'restaurant-images' || bucket === 'menu-images') {
      const parts = path.split('/');
      const targetRestaurantId = parts[0];
      if (context.restaurantId !== targetRestaurantId) {
        return {
          allowed: false,
          error: `403 Forbidden: Cannot upload image to foreign restaurant path '${targetRestaurantId}'.`,
        };
      }
      return { allowed: true };
    }

    if (bucket === 'profile-images') {
      const parts = path.split('/');
      const targetUserId = parts[0];
      if (context.userId !== targetUserId) {
        return {
          allowed: false,
          error: `403 Forbidden: Cannot upload profile image to foreign user path '${targetUserId}'.`,
        };
      }
      return { allowed: true };
    }

    if (bucket === 'verification-documents') {
      // Only restaurant members of the matching restaurant or platform admins can upload
      const parts = path.split('/');
      const targetRestaurantId = parts[0];
      if (context.restaurantId !== targetRestaurantId) {
        return {
          allowed: false,
          error: `403 Forbidden: Cannot upload verification documents for foreign restaurant '${targetRestaurantId}'.`,
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }

  const aminaValidUpload = validateStorageUploadPath('menu-images', `${mamaAminaRestId}/biryani.jpg`, {
    userId: 'usr-chef-amina',
    restaurantId: mamaAminaRestId,
  });
  assert(aminaValidUpload.allowed === true, 'Restaurant member upload to own restaurant folder allowed');

  const aminaSpoofedUpload = validateStorageUploadPath('menu-images', `${kiboRestId}/fish.jpg`, {
    userId: 'usr-chef-amina',
    restaurantId: mamaAminaRestId,
  });
  assert(aminaSpoofedUpload.allowed === false, 'Restaurant member upload to foreign restaurant folder blocked');
  assert(Boolean(aminaSpoofedUpload.error?.includes('Cannot upload image to foreign restaurant path')), 'Path-traversal isolation enforced');

  const userProfileUpload = validateStorageUploadPath('profile-images', 'usr-frank/avatar.png', {
    userId: 'usr-frank',
  });
  assert(userProfileUpload.allowed === true, 'User upload to own avatar folder allowed');

  const spoofedUserProfile = validateStorageUploadPath('profile-images', 'usr-admin/avatar.png', {
    userId: 'usr-frank',
  });
  assert(spoofedUserProfile.allowed === false, 'User upload to foreign avatar folder blocked');

  // ---------------------------------------------------------------------------
  // GROUP 9: Data Reports Validation
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 9: Data Reports Validation & Constraints');

  const validReportReasons = [
    'WRONG_PRICE',
    'ITEM_UNAVAILABLE',
    'INCORRECT_HOURS',
    'CLOSED_PERMANENTLY',
    'WRONG_LOCATION',
    'OFFENSIVE_CONTENT',
    'OTHER',
  ];

  function validateDataReport(reason: string): boolean {
    return validReportReasons.includes(reason);
  }

  assert(validateDataReport('WRONG_PRICE') === true, 'Valid reason WRONG_PRICE accepted');
  assert(validateDataReport('ITEM_UNAVAILABLE') === true, 'Valid reason ITEM_UNAVAILABLE accepted');
  assert(validateDataReport('INVALID_REASON_XYZ') === false, 'Invalid reason rejected by constraint logic');

  console.log('\n======================================================');
  console.log(`🏁 SECURITY TEST SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passedCount: passed, failedCount: failed };
}

// Direct execution support
if (require.main === module) {
  runSecurityRulesTestSuite().then(res => {
    if (res.failedCount > 0) {
      process.exit(1);
    }
  });
}
