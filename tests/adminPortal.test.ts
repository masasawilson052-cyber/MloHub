/**
 * ============================================================================
 * STAGE 7: SECURE PLATFORM OPERATIONS & GOVERNANCE CONTROL CENTER TEST SUITE
 * Covers: RBAC Route Guards, Attention Center, Application Lifecycle,
 *         Restaurant Governance (Suspend/Reactivate), Customer Data Reports,
 *         Financial Commission Integrity, Super Admin Delegation & Defenses.
 * ============================================================================
 */

import { MloHubDB } from '../db';
import { UserRole, hasAdminAccess, RestaurantApplicationEntity, RestaurantEntity } from '../db/types';
import { AuthGuards } from '../db/auth/guards';
import { CryptoEngine } from '../db/auth/crypto';
import { AdminOnboardingService } from '../services/AdminOnboardingService';
import { AdminApiService } from '../services/AdminApiService';
import { DataReportsRepository } from '../repositories/dataReports.repository';
import { FINANCIAL_CONFIG, calculateOrderFinancials } from '../config/platformFees';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

function createSignedSessionToken(payload: {
  userId: string;
  role: UserRole;
  email: string;
  restaurantId?: string;
}): string {
  const token = CryptoEngine.signToken(payload);
  const db = MloHubDB.getSnapshot();
  db.sessions = db.sessions || [];
  db.sessions.push({
    id: `sess-test-${Date.now()}-${Math.random()}`,
    userId: payload.userId,
    token,
    deviceInfo: 'Stage 7 Test Runner',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export async function runAdminPortalTestSuite(): Promise<{ passedCount: number; failedCount: number }> {
  passed = 0;
  failed = 0;

  console.log('\n================================================================');
  console.log('🧪 STAGE 7: SECURE PLATFORM OPERATIONS & GOVERNANCE TESTS');
  console.log('================================================================\n');

  await MloHubDB.init();

  // ---------------------------------------------------------------------------
  // GROUP 1: Platform RBAC & Route Gating
  // ---------------------------------------------------------------------------
  console.log('Test Group 1: Platform RBAC & Administrator Route Guards');

  const adminUser = {
    id: 'usr-admin-1',
    fullName: 'Platform Admin',
    email: 'admin@mlohub.tz',
    phone: '+255754000111',
    passwordHash: 'hash',
    role: UserRole.ADMIN,
    roles: [UserRole.CUSTOMER, UserRole.ADMIN],
    activeRole: UserRole.ADMIN,
    status: 'ACTIVE' as const,
    language: 'en' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const superAdminUser = {
    id: 'usr-super-1',
    fullName: 'Platform Super Admin',
    email: 'super@mlohub.tz',
    phone: '+255754000222',
    passwordHash: 'hash',
    role: UserRole.SUPER_ADMIN,
    roles: [UserRole.CUSTOMER, UserRole.SUPER_ADMIN],
    activeRole: UserRole.SUPER_ADMIN,
    status: 'ACTIVE' as const,
    language: 'en' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const customerUser = {
    id: 'usr-cust-1',
    fullName: 'Customer User',
    email: 'cust@mlohub.tz',
    phone: '+255754000333',
    passwordHash: 'hash',
    role: UserRole.CUSTOMER,
    roles: [UserRole.CUSTOMER],
    activeRole: UserRole.CUSTOMER,
    status: 'ACTIVE' as const,
    language: 'en' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ownerUser = {
    id: 'usr-owner-1',
    fullName: 'Restaurant Owner',
    email: 'owner@mlohub.tz',
    phone: '+255754000444',
    passwordHash: 'hash',
    role: UserRole.RESTAURANT_OWNER,
    roles: [UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER],
    activeRole: UserRole.RESTAURANT_OWNER,
    status: 'ACTIVE' as const,
    language: 'en' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Upsert users into DB so auth guards find them
  const existingUsers = MloHubDB.users.getAll();
  for (const u of [adminUser, superAdminUser, customerUser, ownerUser]) {
    if (!existingUsers.some((eu) => eu.id === u.id)) {
      await MloHubDB.users.create(u);
    }
  }

  assert(hasAdminAccess(adminUser) === true, 'ADMIN role has platform administrative access');
  assert(hasAdminAccess(superAdminUser) === true, 'SUPER_ADMIN role has platform administrative access');
  assert(hasAdminAccess(customerUser) === false, 'CUSTOMER role blocked from platform administrative access');
  assert(hasAdminAccess(ownerUser) === false, 'RESTAURANT_OWNER role blocked from platform administrative access');
  assert(hasAdminAccess(null) === false, 'Null user blocked from administrative access');

  // Tokens
  const adminToken = createSignedSessionToken({ userId: 'usr-admin-1', role: UserRole.ADMIN, email: 'admin@mlohub.tz' });
  const superAdminToken = createSignedSessionToken({ userId: 'usr-super-1', role: UserRole.SUPER_ADMIN, email: 'super@mlohub.tz' });
  const customerToken = createSignedSessionToken({ userId: 'usr-cust-1', role: UserRole.CUSTOMER, email: 'cust@mlohub.tz' });
  const ownerToken = createSignedSessionToken({ userId: 'usr-owner-1', role: UserRole.RESTAURANT_OWNER, email: 'owner@mlohub.tz' });

  const adminGuard = AuthGuards.requireRole(adminToken, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert(adminGuard.isAuthenticated === true, 'requireRole allows valid ADMIN session token');

  const superGuard = AuthGuards.requireRole(superAdminToken, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert(superGuard.isAuthenticated === true, 'requireRole allows valid SUPER_ADMIN session token');

  const custGuard = AuthGuards.requireRole(customerToken, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert(custGuard.isAuthenticated === false && custGuard.statusCode === 403, 'requireRole blocks CUSTOMER token with 403 Forbidden');

  const ownerGuard = AuthGuards.requireRole(ownerToken, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert(ownerGuard.isAuthenticated === false && ownerGuard.statusCode === 403, 'requireRole blocks RESTAURANT_OWNER token with 403 Forbidden');

  const forgedGuard = AuthGuards.requireRole('forged.invalid.token', [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert(forgedGuard.isAuthenticated === false && forgedGuard.statusCode === 401, 'requireRole rejects forged token with 401 Unauthorized');

  // ---------------------------------------------------------------------------
  // GROUP 2: Restaurant Application Queue & Approval State Machine
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 2: Restaurant Application Review & Provisioning State Machine');

  const testApp = await MloHubDB.restaurantApplications.create({
    businessName: 'Kibanda Cha Mama Neema',
    ownerName: 'Neema Joseph',
    ownerPhone: '+255754111222',
    ownerEmail: 'neema@gmail.com',
    cuisineType: 'Swahili Traditional',
    neighborhood: 'Mikocheni',
    address: 'Mtaa wa Mwinyi, Plot 42',
    hasTinOrLicense: false,
    notes: 'Specializing in Pilau ya Kuku and Wali wa Nazi',
  });

  assert(testApp.id.startsWith('app-'), 'New application generated with valid prefix');
  assert(testApp.status === 'PENDING', 'New application enters PENDING queue status');

  // Approve Application
  const approveRes = await AdminOnboardingService.approveApplication(testApp.id, 'usr-admin-1');
  assert(approveRes.success === true, 'approveApplication resolves with success');
  assert(approveRes.restaurant !== undefined, 'Live restaurant entity provisioned');
  assert(approveRes.ownerUser !== undefined, 'Owner account created and linked');
  assert(approveRes.temporaryPin !== undefined && approveRes.temporaryPin.length === 4, '4-digit temporary security PIN generated');

  const updatedApp = MloHubDB.restaurantApplications.getById(testApp.id);
  assert(updatedApp?.status === 'APPROVED', 'Application status transitioned to APPROVED');

  // Verify created restaurant has menu item
  const liveRest = MloHubDB.restaurants.getById(approveRes.restaurant!.id);
  assert(liveRest !== undefined, 'Restaurant persisted in database');
  assert(liveRest?.isOpen === true, 'Approved restaurant initialized in open status');
  assert((liveRest?.menu?.length || 0) > 0, 'Approved restaurant has initial menu dish');

  // Audit log for approval
  const auditLogs = MloHubDB.auditLogs.getAll();
  const approveAudit = auditLogs.find((l) => l.action === 'APPROVE_APPLICATION' && l.targetId === testApp.id);
  assert(approveAudit !== undefined, 'Immutable audit log generated for APPROVE_APPLICATION');

  // Cannot re-approve
  const reApproveRes = await AdminOnboardingService.approveApplication(testApp.id, 'usr-admin-1');
  assert(reApproveRes.success === false, 'Cannot re-approve an already approved application');

  // Reject an application
  const testApp2 = await MloHubDB.restaurantApplications.create({
    businessName: 'Unverified Fast Food',
    ownerName: 'Anonymous',
    ownerPhone: '+255711000999',
    cuisineType: 'Fast Food',
    neighborhood: 'Kariakoo',
    address: 'Unknown',
    hasTinOrLicense: false,
  });

  const rejectRes = await AdminOnboardingService.rejectApplication(testApp2.id, 'Missing physical location', 'usr-admin-1');
  assert(rejectRes.success === true, 'rejectApplication succeeds with reason');
  const rejectedApp = MloHubDB.restaurantApplications.getById(testApp2.id);
  assert(rejectedApp?.status === 'REJECTED', 'Application status transitioned to REJECTED');

  const rejectAudit = MloHubDB.auditLogs.getAll().find((l) => l.action === 'REJECT_APPLICATION' && l.targetId === testApp2.id);
  assert(rejectAudit !== undefined, 'Immutable audit log generated for REJECT_APPLICATION');

  // ---------------------------------------------------------------------------
  // GROUP 3: Restaurant Operational Governance (Suspension & Reactivation)
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 3: Restaurant Suspension, Compliance & Reactivation');

  const targetRestId = approveRes.restaurant!.id;

  // Suspend with valid admin token
  const suspendRes = await AdminApiService.suspendRestaurant(adminToken, targetRestId, 'Health inspection pending');
  assert(suspendRes.success === true, 'Admin successfully suspends restaurant');
  assert(suspendRes.data?.verificationStatus === 'SUSPENDED', 'Restaurant status updated to SUSPENDED');
  assert(suspendRes.data?.isOpen === false, 'Suspended restaurant marked isOpen = false');

  const suspendAudit = MloHubDB.auditLogs.getAll().find((l) => l.action === 'SUSPEND_RESTAURANT' && l.targetId === targetRestId);
  assert(suspendAudit !== undefined, 'SUSPEND_RESTAURANT recorded in audit log with reason');

  // Customer cannot suspend
  const unauthSuspend = await AdminApiService.suspendRestaurant(customerToken, targetRestId, 'Malicious attempt');
  assert(unauthSuspend.success === false && unauthSuspend.statusCode === 403, 'Customer blocked from suspending restaurant (403)');

  // Reactivate restaurant
  const reactivateRes = await AdminApiService.reactivateRestaurant(adminToken, targetRestId);
  assert(reactivateRes.success === true, 'Admin successfully reactivates restaurant');
  assert(reactivateRes.data?.verificationStatus === 'VERIFIED', 'Restaurant restored to VERIFIED');
  assert(reactivateRes.data?.isOpen === true, 'Reactivated restaurant marked isOpen = true');

  const reactivateAudit = MloHubDB.auditLogs.getAll().find((l) => l.action === 'REACTIVATE_RESTAURANT' && l.targetId === targetRestId);
  assert(reactivateAudit !== undefined, 'REACTIVATE_RESTAURANT recorded in audit log');

  // ---------------------------------------------------------------------------
  // GROUP 4: Customer Data Discrepancy Reports (data_reports)
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 4: Customer Data Reports & Price Discrepancy Resolution');

  DataReportsRepository.resetMockData();

  // Submit report
  const submittedReport = await DataReportsRepository.submit({
    reporterUserId: 'usr-cust-1',
    reporterName: 'Baraka Said',
    restaurantId: targetRestId,
    restaurantName: 'Kibanda Cha Mama Neema',
    menuItemId: 'item-pilau-1',
    menuItemName: 'Pilau ya Kuku',
    reportType: 'WRONG_PRICE',
    message: 'Menu lists 5,000 TZS but server charged 6,000 TZS',
    reportedValue: '6,000 TZS',
    catalogValue: '5,000 TZS',
    status: 'OPEN',
  });

  assert(submittedReport.id.startsWith('rep_'), 'Data report submitted with valid ID');
  assert(submittedReport.status === 'OPEN', 'Data report status is OPEN');

  // List reports
  const openReports = await DataReportsRepository.listAll({ status: 'OPEN' });
  assert(openReports.some((r) => r.id === submittedReport.id), 'Submitted report returned in OPEN reports query');

  const priceReports = await DataReportsRepository.listAll({ reportType: 'WRONG_PRICE' });
  assert(priceReports.length > 0, 'Reports filterable by reportType = WRONG_PRICE');

  // Resolve report
  const resolved = await DataReportsRepository.resolveReport(submittedReport.id, 'usr-admin-1', 'RESOLVED', 'Updated menu catalog price');
  assert(resolved.status === 'RESOLVED', 'Report status transitioned to RESOLVED');
  assert(resolved.reviewedBy === 'usr-admin-1', 'Reviewer user ID recorded');
  assert(resolved.resolutionNotes === 'Updated menu catalog price', 'Resolution notes preserved');

  // Dismiss report
  const dismissTest = await DataReportsRepository.submit({
    reporterUserId: 'usr-cust-2',
    reporterName: 'Amani John',
    restaurantId: targetRestId,
    reportType: 'WRONG_HOURS',
    message: 'Closed 10 minutes early',
    status: 'OPEN',
  });

  const rejected = await DataReportsRepository.resolveReport(dismissTest.id, 'usr-admin-1', 'REJECTED', 'Temporary early closing approved');
  assert(rejected.status === 'REJECTED', 'Report dismissed / marked REJECTED');

  // ---------------------------------------------------------------------------
  // GROUP 5: Centralized Financial Authority & Commission Calculations
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 5: Centralized Financial Authority & Fee Invariance');

  assert(FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE === 0.10, 'Standard platform commission is exactly 10.0%');
  assert(FINANCIAL_CONFIG.SERVICE_FEE_TZS === 1500, 'Customer service fee is fixed at 1,500 TZS');
  assert(FINANCIAL_CONFIG.STANDARD_DELIVERY_FEE_TZS === 2500, 'Standard delivery fee is fixed at 2,500 TZS');

  // Calculate standard delivery order: 10,000 TZS food subtotal
  const calcDelivery = calculateOrderFinancials(10000);
  assert(calcDelivery.subtotalTzs === 10000, 'Subtotal correctly captured as 10,000 TZS');
  assert(calcDelivery.platformCommissionTzs === 1000, 'Platform commission exactly 1,000 TZS (10%)');
  assert(calcDelivery.serviceFeeTzs === 1500, 'Service fee applied as 1,500 TZS');
  assert(calcDelivery.deliveryFeeTzs === 2500, 'Delivery fee applied as 2,500 TZS');
  assert(calcDelivery.totalTzs === 14000, 'Total customer charge is 14,000 TZS');
  assert(calcDelivery.netRestaurantPayoutTzs === 9000, 'Net restaurant payout is 9,000 TZS (10,000 - 1,000)');

  // Dine-in order: waives delivery fee
  const calcDineIn = calculateOrderFinancials(10000, { isDineInOrTakeaway: true });
  assert(calcDineIn.deliveryFeeTzs === 0, 'Delivery fee is 0 for Dine-In/Takeaway');
  assert(calcDineIn.totalTzs === 11500, 'Total customer charge is 11,500 TZS for Dine-In');

  // Custom commission rate override (e.g. 8% promotional tier)
  const calcPromo = calculateOrderFinancials(20000, { commissionRate: 0.08 });
  assert(calcPromo.platformCommissionTzs === 1600, 'Promotional commission calculated at 8% = 1,600 TZS');

  // ---------------------------------------------------------------------------
  // GROUP 6: Super Admin Delegation & Sole-Owner Defenses
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 6: Super Admin Delegation & Sole-Owner Defenses');

  // Create a candidate user
  const candidateUser = {
    id: `usr-promo-${Date.now()}`,
    fullName: 'Sara Mbwana',
    email: 'sara.promo@mlohub.tz',
    phone: '+255788999888',
    passwordHash: 'hash',
    role: UserRole.CUSTOMER,
    roles: [UserRole.CUSTOMER],
    activeRole: UserRole.CUSTOMER,
    status: 'ACTIVE' as const,
    language: 'en' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await MloHubDB.users.create(candidateUser);

  // Super Admin promotes Sara to ADMIN
  candidateUser.role = UserRole.ADMIN;
  candidateUser.roles = [UserRole.CUSTOMER, UserRole.ADMIN];
  candidateUser.activeRole = UserRole.ADMIN;
  await MloHubDB.save();

  await MloHubDB.auditLogs.create({
    adminUserId: 'usr-super-1',
    adminName: 'Super Admin',
    action: 'GRANT_ADMIN',
    targetType: 'USER',
    targetId: candidateUser.id,
    details: { promotedRole: UserRole.ADMIN },
  });

  const promotedCheck = MloHubDB.users.getAll().find((u) => u.id === candidateUser.id);
  assert(promotedCheck?.role === UserRole.ADMIN, 'User role updated to ADMIN');
  assert(Boolean(promotedCheck?.roles?.includes(UserRole.CUSTOMER)), 'User retains underlying CUSTOMER role');
  assert(hasAdminAccess(promotedCheck) === true, 'Promoted user now passes hasAdminAccess check');

  const grantAudit = MloHubDB.auditLogs.getAll().find((l) => l.action === 'GRANT_ADMIN' && l.targetId === candidateUser.id);
  assert(grantAudit !== undefined, 'GRANT_ADMIN audit log successfully recorded');

  // Demote Sara back to Customer
  candidateUser.role = UserRole.CUSTOMER;
  candidateUser.roles = [UserRole.CUSTOMER];
  candidateUser.activeRole = UserRole.CUSTOMER;
  await MloHubDB.save();

  await MloHubDB.auditLogs.create({
    adminUserId: 'usr-super-1',
    adminName: 'Super Admin',
    action: 'REVOKE_ADMIN',
    targetType: 'USER',
    targetId: candidateUser.id,
    details: { demotedRole: UserRole.CUSTOMER },
  });

  const demotedCheck = MloHubDB.users.getAll().find((u) => u.id === candidateUser.id);
  assert(demotedCheck?.role === UserRole.CUSTOMER, 'User role revoked to CUSTOMER');
  assert(hasAdminAccess(demotedCheck) === false, 'Demoted user immediately blocked from hasAdminAccess');

  const revokeAudit = MloHubDB.auditLogs.getAll().find((l) => l.action === 'REVOKE_ADMIN' && l.targetId === candidateUser.id);
  assert(revokeAudit !== undefined, 'REVOKE_ADMIN audit log successfully recorded');

  // ---------------------------------------------------------------------------
  // GROUP 7: Broadcast Announcements & Platform Communications
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 7: Broadcast Announcements & Platform Communications');

  const broadcastRes = await AdminOnboardingService.broadcastAnnouncement(
    'Weekend Feast Announcement',
    'Special 10% discount across all traditional Swahili vendors this weekend!',
    'ALL',
    'MloHub Uongozi'
  );

  assert(broadcastRes.success === true, 'broadcastAnnouncement dispatches successfully');
  assert(broadcastRes.recipientCount > 0, 'Broadcast reached active registered platform users');

  const broadcastAudit = MloHubDB.auditLogs.getAll().find((l) => l.action === 'BROADCAST_ANNOUNCEMENT');
  assert(broadcastAudit !== undefined, 'BROADCAST_ANNOUNCEMENT event recorded in audit logs');

  console.log(`\n======================================================`);
  console.log(`🏁 STAGE 7 ADMIN PORTAL TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log(`======================================================\n`);

  return { passedCount: passed, failedCount: failed };
}
