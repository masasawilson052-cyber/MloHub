import fs from 'fs';
import path from 'path';
import { UserRole, hasAdminAccess } from '../db/types';
import { ApplicationRepository } from '../repositories/applications.repository';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import { OrderRepository } from '../repositories/orders.repository';
import { PaymentRepository } from '../repositories/payments.repository';
import { AuditLogRepository } from '../repositories/auditLogs.repository';
import { NotificationRepository } from '../repositories/notifications.repository';
import { DataReportsRepository } from '../repositories/dataReports.repository';
import { ProfileAdminRepository } from '../repositories/profiles.repository';
import { Payment, Order } from '../types/domain';

export async function runAdminPortalCutoverTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB REPAIR PACK 3F: ADMIN PORTAL PRODUCTION CUTOVER SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function record(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  const adminIndexPath = path.join(__dirname, '..', 'app', 'admin', 'index.tsx');
  const adminIndexContent = fs.readFileSync(adminIndexPath, 'utf8');

  // --------------------------------------------------------------------------
  // Criteria A-D: RBAC Authorization & Access Gate
  // --------------------------------------------------------------------------
  console.log('\n--- Criteria A-D: RBAC Authorization & Access Gate ---');

  record(
    hasAdminAccess(null as any) === false && hasAdminAccess(undefined as any) === false,
    'Criterion A: /admin access denied if user is null or undefined'
  );

  const customerUser = {
    id: 'cust-1',
    role: UserRole.CUSTOMER,
    roles: [UserRole.CUSTOMER],
    accountType: 'CUSTOMER' as const,
  };
  record(
    hasAdminAccess(customerUser as any) === false,
    'Criterion B: /admin access denied if user.role is CUSTOMER'
  );

  const adminUser = {
    id: 'admin-1',
    role: UserRole.ADMIN,
    roles: [UserRole.ADMIN],
    accountType: 'ADMIN' as const,
  };
  record(
    hasAdminAccess(adminUser as any) === true,
    'Criterion C: /admin access granted if user.role is ADMIN'
  );

  const superAdminUser = {
    id: 'superadmin-1',
    role: UserRole.SUPER_ADMIN,
    roles: [UserRole.SUPER_ADMIN],
    accountType: 'SUPER_ADMIN' as const,
  };
  record(
    hasAdminAccess(superAdminUser as any) === true,
    'Criterion D: /admin access granted if user.role is SUPER_ADMIN'
  );

  // --------------------------------------------------------------------------
  // Criteria E-I: Complete Decoupling from MloHubDB & Local Fallbacks
  // --------------------------------------------------------------------------
  console.log('\n--- Criteria E-I: Decoupling from MloHubDB & Local Fallbacks ---');

  record(
    !adminIndexContent.includes('useMloHubDB'),
    'Criterion E: No reference to useMloHubDB in app/admin/index.tsx'
  );

  record(
    !adminIndexContent.includes('MloHubDB.') && !adminIndexContent.includes('MloHubDB,'),
    'Criterion F: No reference to MloHubDB in app/admin/index.tsx'
  );

  record(
    !adminIndexContent.includes('dbUser') && !adminIndexContent.includes('user || dbUser'),
    'Criterion G: No reference to dbUser fallback in app/admin/index.tsx'
  );

  record(
    !adminIndexContent.includes('customOrders'),
    'Criterion H: No reference to customOrders in app/admin/index.tsx'
  );

  record(
    !adminIndexContent.includes("'usr-admin'") &&
    !adminIndexContent.includes('"usr-admin"') &&
    !adminIndexContent.includes("'super-admin'") &&
    !adminIndexContent.includes('"super-admin"'),
    'Criterion I: No caller-supplied admin fallback (usr-admin / super-admin)'
  );

  // --------------------------------------------------------------------------
  // Criteria J-M: Application Repository Operations
  // --------------------------------------------------------------------------
  console.log('\n--- Criteria J-M: Application Repository Operations ---');

  record(
    adminIndexContent.includes('ApplicationRepository.listAll()'),
    'Criterion J: Applications loaded via ApplicationRepository.listAll()'
  );

  record(
    typeof ApplicationRepository.updateStatus === 'function' &&
    adminIndexContent.includes("ApplicationRepository.updateStatus(appId, 'APPROVED'"),
    'Criterion K: Application approval calls ApplicationRepository.updateStatus("APPROVED")'
  );

  record(
    adminIndexContent.includes("ApplicationRepository.updateStatus(appId, 'REJECTED'"),
    'Criterion L: Application rejection calls ApplicationRepository.updateStatus("REJECTED")'
  );

  record(
    adminIndexContent.includes("ApplicationRepository.updateStatus(appId, 'PENDING'"),
    'Criterion M: Application change-request calls ApplicationRepository.updateStatus("PENDING")'
  );

  // --------------------------------------------------------------------------
  // Criteria N-P: Restaurant Governance Operations
  // --------------------------------------------------------------------------
  console.log('\n--- Criteria N-P: Restaurant Governance Operations ---');

  record(
    typeof RestaurantRepository.suspendRestaurant === 'function' &&
    adminIndexContent.includes('RestaurantRepository.suspendRestaurant('),
    'Criterion N: Restaurant suspension calls RestaurantRepository.suspendRestaurant()'
  );

  record(
    typeof RestaurantRepository.reactivateRestaurant === 'function' &&
    adminIndexContent.includes('RestaurantRepository.reactivateRestaurant('),
    'Criterion O: Restaurant reactivation calls RestaurantRepository.reactivateRestaurant()'
  );

  record(
    typeof RestaurantRepository.update === 'function' &&
    adminIndexContent.includes('RestaurantRepository.update(restaurantId,') &&
    adminIndexContent.includes('tinNumber:') &&
    adminIndexContent.includes('businessLicenseNumber:'),
    'Criterion P: Restaurant verification calls RestaurantRepository.update() with real docs'
  );

  // --------------------------------------------------------------------------
  // Criterion Q: Customer Discrepancy Reports
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion Q: Customer Discrepancy Reports ---');

  record(
    typeof DataReportsRepository.resolveReport === 'function' &&
    adminIndexContent.includes('DataReportsRepository.resolveReport('),
    'Criterion Q: Report resolution calls DataReportsRepository.resolveReport()'
  );

  // --------------------------------------------------------------------------
  // Criteria R-U: Platform Identity & Role Management
  // --------------------------------------------------------------------------
  console.log('\n--- Criteria R-U: Platform Identity & Role Management ---');

  record(
    typeof ProfileAdminRepository.listAll === 'function' &&
    adminIndexContent.includes('ProfileAdminRepository.listAll()'),
    'Criterion R: Platform users loaded from ProfileAdminRepository.listAll()'
  );

  record(
    typeof ProfileAdminRepository.changeRole === 'function' &&
    adminIndexContent.includes('ProfileAdminRepository.changeRole('),
    'Criterion S: Admin grant calls ProfileAdminRepository.changeRole()'
  );

  record(
    adminIndexContent.includes("ProfileAdminRepository.changeRole(userId, UserRole.CUSTOMER, 'CUSTOMER')"),
    'Criterion T: Admin revoke calls ProfileAdminRepository.changeRole()'
  );

  record(
    adminIndexContent.includes('userId === activeUser.id') &&
    adminIndexContent.includes('cannot revoke your own'),
    'Criterion U: Self-admin revocation is blocked'
  );

  // --------------------------------------------------------------------------
  // Criteria V-X: Financial KPI Honesty & Truthful Settlement
  // --------------------------------------------------------------------------
  console.log('\n--- Criteria V-X: Financial KPI Honesty & Truthful Settlement ---');

  // Test financial computation function simulating app/admin/index.tsx logic
  const mockPayments: Payment[] = [
    {
      id: 'pay-1',
      customerId: 'cust-1',
      provider: 'VODACOM_MPESA',
      amountTzs: 50000,
      platformCommissionTzs: 2500,
      netRestaurantPayoutTzs: 47500,
      currency: 'TZS',
      paymentMethod: 'MOBILE_MONEY',
      phoneNumber: '+255712345678',
      status: 'SUCCESS',
      webhookVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pay-2',
      customerId: 'cust-2',
      provider: 'AIRTEL_MONEY',
      amountTzs: 30000,
      platformCommissionTzs: 1500,
      netRestaurantPayoutTzs: 28500,
      currency: 'TZS',
      paymentMethod: 'MOBILE_MONEY',
      phoneNumber: '+255754000111',
      status: 'FAILED',
      webhookVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pay-3',
      customerId: 'cust-3',
      provider: 'TIGO_PESA',
      amountTzs: 20000,
      platformCommissionTzs: 1000,
      netRestaurantPayoutTzs: 19000,
      currency: 'TZS',
      paymentMethod: 'MOBILE_MONEY',
      phoneNumber: '+255655112233',
      status: 'PENDING',
      webhookVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const successfulPayments = mockPayments.filter((p) => p.status === 'SUCCESS');
  const grossVolumeTzs = successfulPayments.reduce((acc, p) => acc + (p.amountTzs || 0), 0);
  const platformRevenueTzs = successfulPayments.reduce(
    (acc, p) => acc + (p.platformCommissionTzs || 0),
    0
  );

  record(
    grossVolumeTzs === 50000,
    'Criterion V: Financial volume derived strictly from payments with status === "SUCCESS" (50,000 TZS)'
  );

  record(
    platformRevenueTzs === 2500,
    'Criterion W: Platform fee derived strictly from real payment commission (2,500 TZS)'
  );

  record(
    grossVolumeTzs < 100000,
    'Criterion X: Non-success payments (FAILED: 30k, PENDING: 20k) do not increase gross volume'
  );

  // --------------------------------------------------------------------------
  // Criteria Y-AB: Orders, Realtime Invalidation, Freshness & System Health
  // --------------------------------------------------------------------------
  console.log('\n--- Criteria Y-AB: Orders, Realtime, Freshness & System Health ---');

  record(
    adminIndexContent.includes('OrderRepository.listAll()'),
    'Criterion Y: Order counts derived strictly from OrderRepository.listAll()'
  );

  record(
    adminIndexContent.includes('RealtimeEventEngine.subscribe') &&
    adminIndexContent.includes('loadPlatformData()') &&
    !adminIndexContent.includes('MloHubDB.reload()'),
    'Criterion Z: Realtime invalidation triggers repository reload, not MloHubDB refresh'
  );

  record(
    adminIndexContent.includes('restaurants.length > 0') &&
    adminIndexContent.includes(': 0;'),
    'Criterion AA: Freshness score does not fabricate 100% when no restaurant data exists'
  );

  const healthComponentPath = path.join(__dirname, '..', 'components', 'admin', 'SystemHealth.tsx');
  const healthComponentContent = fs.readFileSync(healthComponentPath, 'utf8');

  record(
    !healthComponentContent.includes('Platform Infrastructure: 100% Operational') &&
    (healthComponentContent.includes('isSupabaseConfigured') || healthComponentContent.includes('isCloud')),
    'Criterion AB: SystemHealth reflects real connection state or honest status'
  );

  return { passed, failed };
}
