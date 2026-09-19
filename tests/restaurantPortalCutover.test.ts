import fs from 'fs';
import path from 'path';
import { BranchRepository } from '../repositories/branches.repository';
import { MenuRepository } from '../repositories/menus.repository';
import { OrderRepository } from '../repositories/orders.repository';
import { ReservationRepository } from '../repositories/reservations.repository';
import { RestaurantMemberRepository } from '../repositories/restaurantMembers.repository';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import { PaymentRepository } from '../repositories/payments.repository';
import { ReviewRepository } from '../repositories/reviews.repository';
import { resolvePortalAccess } from '../db/auth/guards';
import { UserRole } from '../db/types';

export async function runRestaurantPortalCutoverTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB REPAIR PACK 3E: RESTAURANT PORTAL SUPABASE CUTOVER SUITE');
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

  const portalPath = path.join(__dirname, '..', 'app', 'restaurant-portal', 'index.tsx');
  const portalContent = fs.readFileSync(portalPath, 'utf8');

  // --------------------------------------------------------------------------
  // Criterion A: DbContext & MloHubDB Decoupling
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion A: DbContext & MloHubDB Decoupling ---');

  record(
    !portalContent.includes('useMloHubDB()'),
    'app/restaurant-portal/index.tsx does not call useMloHubDB()'
  );
  record(
    !portalContent.includes('MloHubDB.restaurants.update('),
    'app/restaurant-portal/index.tsx does not mutate MloHubDB.restaurants'
  );
  record(
    !portalContent.includes('MloHubDB.save()'),
    'app/restaurant-portal/index.tsx does not invoke MloHubDB.save()'
  );
  record(
    portalContent.includes('loadRestaurantWorkspace'),
    'app/restaurant-portal/index.tsx implements loadRestaurantWorkspace'
  );

  // --------------------------------------------------------------------------
  // Criterion B: Multi-Branch Modeling & Geographic Honesty
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion B: Multi-Branch Modeling & Geographic Honesty ---');

  const branchRepoPath = path.join(__dirname, '..', 'repositories', 'branches.repository.ts');
  const branchRepoContent = fs.readFileSync(branchRepoPath, 'utf8');

  record(
    !branchRepoContent.includes("|| 'Dar es Salaam'"),
    'BranchRepository contains no hardcoded Dar es Salaam fallbacks'
  );
  record(
    !portalContent.includes(`${'activeRestaurant.id'}-main`) && !portalContent.includes("name: `${activeRestaurant.name} - Main Branch`"),
    'app/restaurant-portal/index.tsx does not synthesize fake -main branches'
  );

  const headerPath = path.join(__dirname, '..', 'components', 'restaurant', 'RestaurantPortalHeader.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');
  record(
    !headerContent.includes("'Main Branch'") && headerContent.includes("'No branch selected'"),
    'RestaurantPortalHeader defaults honestly to "No branch selected"'
  );

  // --------------------------------------------------------------------------
  // Criterion C: Menu Management & Freshness Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion C: Menu Management & Freshness Verification ---');

  const menuRepoPath = path.join(__dirname, '..', 'repositories', 'menus.repository.ts');
  const menuRepoContent = fs.readFileSync(menuRepoPath, 'utf8');

  record(
    !menuRepoContent.includes("|| 'Dish'") && !menuRepoContent.includes("|| 'Chakula'"),
    'MenuRepository contains no fake "Dish" or "Chakula" names'
  );
  record(
    typeof MenuRepository.updateItem === 'function' &&
    typeof MenuRepository.archiveItem === 'function' &&
    typeof MenuRepository.bulkSetAvailability === 'function' &&
    typeof MenuRepository.createCategory === 'function' &&
    typeof MenuRepository.archiveCategory === 'function' &&
    typeof MenuRepository.setBranchPrice === 'function' &&
    typeof MenuRepository.listBranchPrices === 'function',
    'MenuRepository exposes full CRUD: updateItem, archiveItem, bulkSetAvailability, categories, and branch pricing'
  );

  // --------------------------------------------------------------------------
  // Criterion D: Order Lifecycle & Kitchen Pipeline
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion D: Order Lifecycle & Kitchen Pipeline ---');

  record(
    typeof OrderRepository.listOrdersForRestaurant === 'function' &&
    typeof OrderRepository.updateStatus === 'function',
    'OrderRepository exposes listOrdersForRestaurant and updateStatus'
  );

  const orderPipelinePath = path.join(__dirname, '..', 'services', 'OrderPipelineService.ts');
  const orderPipelineContent = fs.readFileSync(orderPipelinePath, 'utf8');
  record(
    (orderPipelineContent.includes('OrderRepository.updateStatus(orderId, \'ACCEPTED\')') ||
     orderPipelineContent.includes("OrderRepository.updateStatus(orderId, 'ACCEPTED')")) &&
    (orderPipelineContent.includes('OrderRepository.updateStatus(orderId, \'CANCELLED\', reason)') ||
     orderPipelineContent.includes("OrderRepository.updateStatus(orderId, 'CANCELLED', reason)")),
    'OrderPipelineService propagates order state changes to Supabase public.orders'
  );

  // --------------------------------------------------------------------------
  // Criterion E: Real Reservations Repository
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion E: Real Reservations Repository ---');

  const resRepoPath = path.join(__dirname, '..', 'repositories', 'reservations.repository.ts');
  const resRepoContent = fs.readFileSync(resRepoPath, 'utf8');

  record(
    typeof ReservationRepository.listByRestaurant === 'function' &&
    typeof ReservationRepository.updateStatus === 'function' &&
    resRepoContent.includes("'CONFIRMED'") && resRepoContent.includes("'SEATED'") && resRepoContent.includes("'NO_SHOW'"),
    'ReservationRepository exposes listByRestaurant and validates canonical statuses'
  );

  // --------------------------------------------------------------------------
  // Criterion F: Staff Management & Tenancy RBAC
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion F: Staff Management & Tenancy RBAC ---');

  record(
    typeof RestaurantMemberRepository.listByRestaurant === 'function' &&
    typeof RestaurantMemberRepository.updateRole === 'function' &&
    typeof RestaurantMemberRepository.deactivateMember === 'function' &&
    typeof RestaurantMemberRepository.inviteMember === 'function',
    'RestaurantMemberRepository exposes listByRestaurant, updateRole, deactivateMember, inviteMember'
  );

  const mockOwnerUser = {
    id: 'test-owner-uuid-1',
    email: 'owner@test.com',
    role: UserRole.RESTAURANT_OWNER,
    status: 'ACTIVE' as const,
  };
  const mockActiveMembership = {
    id: 'mem-1',
    userId: 'test-owner-uuid-1',
    restaurantId: 'rest-test-1',
    role: 'OWNER' as const,
    status: 'ACTIVE' as const,
    isPrimaryOwner: true,
  };
  const mockRestaurant = {
    id: 'rest-test-1',
    name: 'Taste of Zanzibar',
    address: 'Bagamoyo Rd',
  } as any;

  const access = resolvePortalAccess({
    isAuthLoading: false,
    user: mockOwnerUser,
    activeRestaurant: mockRestaurant,
    memberships: [mockActiveMembership as any],
    activeWorkspace: 'RESTAURANT_OWNER',
  });

  record(
    access.status === 'AUTHORIZED' && access.restaurant?.id === 'rest-test-1',
    'resolvePortalAccess authorizes valid restaurant member independently of customer DbContext'
  );

  const foreignAccess = resolvePortalAccess({
    isAuthLoading: false,
    user: mockOwnerUser,
    activeRestaurant: { id: 'rest-foreign-2', name: 'Foreign Rest' } as any,
    memberships: [mockActiveMembership as any],
    activeWorkspace: 'RESTAURANT_OWNER',
  });
  record(
    foreignAccess.status !== 'AUTHORIZED',
    'resolvePortalAccess rejects access to unauthorized restaurant tenant'
  );

  // --------------------------------------------------------------------------
  // Criterion G: Supporting Repositories Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion G: Supporting Repositories Verification ---');

  record(
    typeof PaymentRepository.listByRestaurant === 'function' &&
    typeof PaymentRepository.listAll === 'function' &&
    typeof ReviewRepository.listForRestaurant === 'function' &&
    typeof RestaurantRepository.update === 'function',
    'PaymentRepository (including listByRestaurant), ReviewRepository, RestaurantRepository ready for portal data'
  );

  // --------------------------------------------------------------------------
  // Criterion H: Pack 3E.1 Finance & Staff Safety Closure (Items A through K)
  // --------------------------------------------------------------------------
  console.log('\n--- Criterion H: Pack 3E.1 Finance & Staff Safety Closure ---');

  const earningsCompPath = path.join(__dirname, '..', 'components', 'restaurant', 'EarningsOverview.tsx');
  const earningsCompContent = fs.readFileSync(earningsCompPath, 'utf8');
  const memberRepoPath = path.join(__dirname, '..', 'repositories', 'restaurantMembers.repository.ts');
  const memberRepoContent = fs.readFileSync(memberRepoPath, 'utf8');
  const paymentRepoPath = path.join(__dirname, '..', 'repositories', 'payments.repository.ts');
  const paymentRepoContent = fs.readFileSync(paymentRepoPath, 'utf8');

  // A. Restaurant earnings do not fall back to completed orders
  record(
    !portalContent.includes('completedOrders.map') &&
    portalContent.includes('financialTotals'),
    'Criterion A: Restaurant earnings do not synthesize financial transactions from completed orders'
  );

  // B. Payment query is scoped by active restaurant ID
  record(
    portalContent.includes('PaymentRepository.listByRestaurant(activeRestaurant.id)') &&
    !portalContent.includes('PaymentRepository.listAll(') &&
    paymentRepoContent.includes(".eq('restaurant_id', restaurantId)"),
    'Criterion B: Payment query is scoped directly to active restaurant ID via PaymentRepository.listByRestaurant'
  );

  // C. Empty payment rows produce empty financial state
  record(
    earningsCompContent.includes('No payment activity yet.') &&
    portalContent.includes('payments.map'),
    'Criterion C: Empty payment rows produce honest empty financial state ("No payment activity yet.")'
  );

  // D. FAILED/PENDING/CANCELLED are excluded from successful revenue
  record(
    portalContent.includes("p.status === 'SUCCESS'") &&
    earningsCompContent.includes("tx.paymentStatus === 'SUCCESS'"),
    'Criterion D: FAILED/PENDING/CANCELLED are excluded from successful revenue calculation'
  );

  // E. REFUNDED does not remain counted as retained revenue
  record(
    !portalContent.includes("p.status === 'REFUNDED'") &&
    portalContent.includes("if (p.status === 'SUCCESS')"),
    'Criterion E: REFUNDED transactions are excluded from retained revenue totals'
  );

  // F. No frontend 10% commission calculation remains
  record(
    !earningsCompContent.includes('0.10') &&
    !earningsCompContent.includes('10%') &&
    !portalContent.includes('* 4.5') &&
    !portalContent.includes('* 18'),
    'Criterion F: No frontend 10% commission calculation or arbitrary weekly/monthly multipliers remain'
  );

  // G. Staff invitation does not use auth.admin
  record(
    !memberRepoContent.includes('auth.admin') &&
    !portalContent.includes('auth.admin'),
    'Criterion G: Staff invitation does not call auth.admin from client'
  );

  // H. No service-role key appears in restaurant-member client code
  record(
    !memberRepoContent.includes('service_role') &&
    !memberRepoContent.includes('serviceRole') &&
    !portalContent.includes('service_role') &&
    !portalContent.includes('serviceRole'),
    'Criterion H: No service-role key appears in restaurant-member client code'
  );

  // I. No fake usr-* member ID is generated
  record(
    !memberRepoContent.includes('usr-') &&
    !memberRepoContent.includes('usr-${Date'),
    'Criterion I: No fake usr-* member ID is generated in membership repository'
  );

  // J. Unsupported staff invitation fails honestly in non-demo mode
  let inviteErrorOccurred = false;
  try {
    await RestaurantMemberRepository.inviteMember('rest-test', 'test@staff.com', 'STAFF');
  } catch (err: any) {
    if (err?.message?.includes('Staff invitations are not available yet')) {
      inviteErrorOccurred = true;
    }
  }
  record(
    inviteErrorOccurred,
    'Criterion J: Unsupported staff invitation fails honestly with clear message'
  );

  // K. Tenant filtering remains enforced on role updates and deactivation
  record(
    memberRepoContent.includes(".eq('restaurant_id', restaurantId)") &&
    portalContent.includes('RestaurantMemberRepository.updateRole(activeRestaurant.id,') &&
    portalContent.includes('RestaurantMemberRepository.deactivateMember(activeRestaurant.id,'),
    'Criterion K: Tenant filtering (restaurant_id) remains strictly enforced on role updates and deactivations'
  );

  // L. No fabricated settlement status from payment SUCCESS
  record(
    !portalContent.includes("'SETTLED'") &&
    !portalContent.includes('settlementStatus') &&
    !earningsCompContent.includes("'SETTLED'") &&
    !earningsCompContent.includes('settlementStatus') &&
    earningsCompContent.includes('Payment successful'),
    'Criterion L: No fabricated settlementStatus or SETTLED state derived from customer payment.status === "SUCCESS"'
  );

  console.log('\n======================================================');
  console.log(`🏁 PACK 3E RESTAURANT PORTAL SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runRestaurantPortalCutoverTests()
    .then(({ failed }) => process.exit(failed > 0 ? 1 : 0))
    .catch((err) => {
      console.error('Fatal Pack 3E test error:', err);
      process.exit(1);
    });
}
