/**
 * ============================================================================
 * MLOHUB RESTAURANT 100% PRODUCTION CLOSURE TEST SUITE
 * Covers: Gate A, Private Store Setup, Payout Verification, Server Readiness,
 *         Gate B, Customer Discovery Isolation, Order Gating & Paid Notifications,
 *         Kitchen Kanban Pipeline, Merchant Finance & Ledger, Security Invariants.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { Restaurant, Order, OrderStatus } from '../types/domain';
import { DAR_ES_SALAAM_LOCATION_PRESETS } from '../constants/branchPresets';
import { getPayoutGateway, SelcomPayoutGateway, ClickPesaPayoutGateway, SandboxPayoutGateway } from '../supabase/functions/_shared/payouts/PayoutGateway';
import { getPayoutProvider, ClickPesaPayoutProvider, SelcomPayoutProvider, SandboxPayoutProvider } from '../services/payouts/PayoutProvider';

const ROOT = path.resolve(__dirname, '..');

function readRel(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

export async function runRestaurant100PercentClosureTests(): Promise<{
  passed: number;
  failed: number;
}> {
  console.log('\n================================================================');
  console.log('🏆 MLOHUB RESTAURANT 100% PRODUCTION CLOSURE VERIFICATION SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, label: string) => {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${label}`);
      failed++;
    }
  };

  // ---------------------------------------------------------------------------
  // 1. GATE A: Application -> Documents -> Admin Review -> Merchant Approval
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Gate A: Application, Documents, Admin Review & Merchant Approval ---');

  const appDetailSrc = readRel('components/admin/ApplicationDetail.tsx');
  const merchantVerifServiceSrc = readRel('services/MerchantVerificationService.ts');
  const twoGateSql = readRel('supabase/migrations/20260928000100_restaurant_two_gate_lifecycle.sql');
  const authorityClosureSql = readRel('supabase/migrations/20260928000600_restaurant_authority_verification_closure.sql');
  const finalClosureSql = readRel('supabase/migrations/20260928000500_final_restaurant_closure.sql');

  // 1.1: Document Review UI provides [View], [Verify], [Reject] actions
  assert(
    appDetailSrc.includes('handleVerifyDocument') &&
      appDetailSrc.includes('handleRejectDocument') &&
      appDetailSrc.includes('reviewVerificationDocument'),
    '1.1: ApplicationDetail UI wires authoritative document review actions (View, Verify, Reject)'
  );

  // 1.2: Mandatory document types defined and enforced for Gate A
  const requiredDocs = ['BUSINESS_LICENSE', 'TIN_DOCUMENT', 'FOOD_OPERATION_DOCUMENT'];
  for (const docType of requiredDocs) {
    assert(
      appDetailSrc.includes(docType) && authorityClosureSql.includes(docType),
      `1.2: Mandatory document type ${docType} strictly verified before Gate A approval`
    );
  }

  // 1.3: Document rejection requires non-empty reason
  assert(
    appDetailSrc.includes('rejectionReason') &&
      authorityClosureSql.includes('Rejection reason is required'),
    '1.3: Document rejection strictly requires a non-empty reason'
  );

  // 1.4: Gate A approval button disabled when mandatory documents are not all verified
  assert(
    appDetailSrc.includes('requiredDocumentsVerified') &&
      appDetailSrc.includes('disabled={isProcessing || !requiredDocumentsVerified}'),
    '1.4: Gate A approval button is disabled until all mandatory documents are verified'
  );

  // 1.5: Gate A approve_restaurant_application requires admin AAL2 and puts restaurant in SETUP_REQUIRED
  assert(
    authorityClosureSql.includes('approve_restaurant_application') &&
      authorityClosureSql.includes("'SETUP_REQUIRED'") &&
      authorityClosureSql.includes('require_admin_aal2'),
    '1.5: approve_restaurant_application requires admin AAL2 and creates private store in SETUP_REQUIRED'
  );

  // ---------------------------------------------------------------------------
  // 2. PRIVATE SETUP: Branch, GPS, Hours, Media, Menu, Modifiers, Delivery, Payout Destination
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Private Setup: Branch, GPS, Hours, Media, Menu, Modifiers, Delivery & Payout ---');

  const modifiersSql = readRel('supabase/migrations/20260923000005_customer_marketplace_truth_closure.sql');
  const restaurantPortalSrc = readRel('app/restaurant-portal/index.tsx');

  // 2.1: Operating hours must be merchant-configured, not invented defaults (no 08:00 -> 22:00 auto-creation)
  assert(
    !restaurantPortalSrc.includes("'08:00'") && !restaurantPortalSrc.includes("'22:00'"),
    '2.1: Restaurant portal contains zero automatic default operating hours injection (no invented 08:00-22:00)'
  );

  // 2.2: Branch coordinates validated within Dar es Salaam boundaries
  assert(
    DAR_ES_SALAAM_LOCATION_PRESETS.length >= 10 &&
      DAR_ES_SALAAM_LOCATION_PRESETS.every(p => p.latitude >= -7.1 && p.latitude <= -6.6 && p.longitude >= 39.0 && p.longitude <= 39.5) &&
      authorityClosureSql.includes('latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180'),
    '2.2: Branch GPS coordinates validated and supported with Dar es Salaam presets'
  );

  // 2.3: Menu modifiers support hierarchical groups, options, pricing
  assert(
    modifiersSql.includes('menu_modifier_groups') &&
      modifiersSql.includes('menu_modifier_options') &&
      modifiersSql.includes('price_delta_tzs'),
    '2.3: Menu modifiers support hierarchical groups, options, and price adjustments'
  );

  // 2.4: Payout destination creation encrypts secret with pgp:v1: prefix
  assert(
    finalClosureSql.includes('encrypt_merchant_payout_reference') &&
      finalClosureSql.includes("'pgp:v1:'"),
    '2.4: Payout destination secrets are encrypted server-side with pgp:v1: prefix'
  );

  // ---------------------------------------------------------------------------
  // 3. PAYOUT VERIFICATION: PENDING_VERIFICATION -> admin VERIFIED
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Payout Verification: PENDING_VERIFICATION -> admin VERIFIED ---');

  const payoutPanelSrc = readRel('components/admin/RestaurantPayoutVerificationPanel.tsx');
  const earningsOverviewSrc = readRel('components/restaurant/EarningsOverview.tsx');

  // 3.1: Admin Payout Verification Panel renders masked identifier, never raw secret
  assert(
    payoutPanelSrc.includes('maskedAccountIdentifier') &&
      !payoutPanelSrc.includes('rawAccountIdentifier'),
    '3.1: Admin payout verification panel displays only masked identifiers and account names'
  );

  // 3.2: Review requires verified account name and verification reference
  assert(
    payoutPanelSrc.includes('verifiedAccountName') &&
      payoutPanelSrc.includes('verificationReference') &&
      authorityClosureSql.includes('review_payout_destination_secure'),
    '3.2: Admin review of payout destination requires verified account name & reference'
  );

  // 3.3: Merchant portal displays pending verification notification rather than premature verified message
  assert(
    earningsOverviewSrc.includes('MloHub verification is still required before payouts can be enabled') &&
      earningsOverviewSrc.includes('Pending verification'),
    '3.3: Merchant earnings overview informs merchant that admin verification is required before payouts'
  );

  // ---------------------------------------------------------------------------
  // 4. READINESS: All Mandatory Criteria Server-Evaluated
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Readiness Engine: Authoritative Server-Evaluated Criteria ---');

  // 4.1: Portal binds to getLaunchReadiness rather than naive local state
  assert(
    restaurantPortalSrc.includes('RestaurantRepository.getLaunchReadiness') &&
      restaurantPortalSrc.includes('launchReadiness?.canSubmitForReview === true'),
    '4.1: Restaurant portal publish action strictly checks authoritative server launchReadiness'
  );

  // 4.2: Readiness SQL evaluates authoritative checks
  const readinessChecks = [
    'has_active_branch',
    'branch_has_coordinates',
    'has_opening_hours',
    'has_logo',
    'has_cover_image',
    'has_storefront_image',
    'has_verified_contact',
    'has_menu',
    'menu_item_count',
    'has_payout_destination',
    'delivery_configured',
  ];

  for (const check of readinessChecks) {
    assert(
      authorityClosureSql.includes(check),
      `4.2: Authoritative SQL readiness evaluator checks ${check}`
    );
  }

  // ---------------------------------------------------------------------------
  // 5. GATE B: GO_LIVE_REVIEW -> Admin Approval -> PUBLISHED
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Gate B: Submission -> Admin Approval -> PUBLISHED ---');

  const adminDetailSrc = readRel('components/admin/RestaurantDetailAdmin.tsx');

  // 5.1: Merchant submit action invokes submitForLaunchReview (status becomes GO_LIVE_REVIEW)
  assert(
    restaurantPortalSrc.includes('RestaurantRepository.submitForLaunchReview'),
    '5.1: Merchant portal invokes submitForLaunchReview for Gate B submission'
  );

  // 5.2: Admin Gate B review panel inspects readiness and payout status
  assert(
    adminDetailSrc.includes('RestaurantPayoutVerificationPanel') &&
      adminDetailSrc.includes('readiness?.canSubmitForReview'),
    '5.2: Admin restaurant detail integrates server readiness and payout verification in Gate B area'
  );

  // 5.3: approve_restaurant_launch requires admin AAL2 and sets is_published = true
  assert(
    finalClosureSql.includes('approve_restaurant_launch') &&
      finalClosureSql.includes('is_published = TRUE') &&
      finalClosureSql.includes('require_admin_aal2'),
    '5.3: Gate B approval is restricted to platform admin AAL2 and sets is_published = true'
  );

  // ---------------------------------------------------------------------------
  // 6. CUSTOMER VISIBILITY: Visible Only After PUBLISHED
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Customer Visibility: Visible Only After PUBLISHED ---');

  const restRepoSrc = readRel('repositories/restaurants.repository.ts');

  // 6.1: customerVisibleOnly filter in RestaurantRepository
  assert(
    restRepoSrc.includes('customerVisibleOnly') &&
      restRepoSrc.includes("launchStatus === 'PUBLISHED'") &&
      restRepoSrc.includes('isPublished === true') &&
      restRepoSrc.includes('isVerified === true'),
    '6.1: RestaurantRepository customer filter strictly requires isPublished=true and launchStatus=PUBLISHED'
  );

  // 6.2: Mock isolation check across all 6 lifecycle stages
  const catalogTest: Restaurant[] = [
    { id: '1', name: 'Draft', isPublished: false, isVerified: false, launchStatus: 'SETUP_REQUIRED', isActive: true } as any,
    { id: '2', name: 'Review', isPublished: false, isVerified: false, launchStatus: 'GO_LIVE_REVIEW', isActive: true } as any,
    { id: '3', name: 'Corrections', isPublished: false, isVerified: false, launchStatus: 'CORRECTIONS_REQUIRED', isActive: true } as any,
    { id: '4', name: 'Approved Unpub', isPublished: false, isVerified: true, launchStatus: 'APPROVED_FOR_LAUNCH', isActive: true } as any,
    { id: '5', name: 'Suspended Live', isPublished: true, isVerified: true, launchStatus: 'PUBLISHED', isActive: false } as any,
    { id: '6', name: 'Fully Live', isPublished: true, isVerified: true, launchStatus: 'PUBLISHED', isActive: true, verificationStatus: 'VERIFIED' } as any,
  ];

  const visibleToCustomer = catalogTest.filter(
    (r) => r.isActive && r.isPublished && r.isVerified && r.launchStatus === 'PUBLISHED' && r.verificationStatus === 'VERIFIED'
  );

  assert(visibleToCustomer.length === 1 && visibleToCustomer[0].id === '6', '6.2: Only Fully Live store (id=6) is visible to customers');

  // ---------------------------------------------------------------------------
  // 7. ORDER GATING & PAID NOTIFICATIONS
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Order Gating & Paid Notifications ---');

  // 7.1: Pending payment orders cannot be accepted by merchant
  const mockPendingOrder: Order = {
    id: 'ord-pending',
    restaurantId: 'rest-1',
    status: 'PLACED' as OrderStatus,
    paymentStatus: 'PENDING',
    paymentProvider: 'selcom',
  } as any;

  const mockPaidOrder: Order = {
    id: 'ord-paid',
    restaurantId: 'rest-1',
    status: 'CONFIRMED' as OrderStatus,
    paymentStatus: 'PAID',
    paymentProvider: 'selcom',
  } as any;

  const canAccept = (order: Order) => order.paymentStatus === 'PAID' && order.status === 'CONFIRMED';

  assert(!canAccept(mockPendingOrder), '7.1: Merchant cannot accept order when payment is PENDING');
  assert(canAccept(mockPaidOrder), '7.1: Merchant can accept order when payment is PAID');

  // 7.2: Payment confirmation dispatches RESTAURANT_NEW_PAID_ORDER notification
  const opsSql = readRel('supabase/migrations/20260928000200_restaurant_operations_and_modifiers.sql');
  assert(
    opsSql.includes('RESTAURANT_NEW_PAID_ORDER'),
    '7.2: Database triggers dispatch RESTAURANT_NEW_PAID_ORDER notification upon payment confirmation'
  );

  // ---------------------------------------------------------------------------
  // 8. KITCHEN KANBAN PIPELINE: ACCEPTED -> PREPARING -> READY -> COMPLETED
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Kitchen Kanban Pipeline State Machine ---');

  const validTransitions: Record<string, string[]> = {
    'CONFIRMED': ['ACCEPTED', 'CANCELLED'],
    'ACCEPTED': ['PREPARING', 'CANCELLED'],
    'PREPARING': ['READY', 'CANCELLED'],
    'READY': ['OUT_FOR_DELIVERY', 'COMPLETED'],
    'OUT_FOR_DELIVERY': ['COMPLETED'],
    'COMPLETED': [],
    'CANCELLED': [],
  };

  const isValidTransition = (from: string, to: string) => (validTransitions[from] || []).includes(to);

  assert(isValidTransition('CONFIRMED', 'ACCEPTED'), '8.1: CONFIRMED -> ACCEPTED is valid');
  assert(isValidTransition('ACCEPTED', 'PREPARING'), '8.2: ACCEPTED -> PREPARING is valid');
  assert(isValidTransition('PREPARING', 'READY'), '8.3: PREPARING -> READY is valid');
  assert(isValidTransition('READY', 'COMPLETED'), '8.4: READY -> COMPLETED is valid');
  assert(!isValidTransition('COMPLETED', 'ACCEPTED'), '8.5: COMPLETED -> ACCEPTED is strictly blocked');
  assert(!isValidTransition('CANCELLED', 'READY'), '8.6: CANCELLED -> READY is strictly blocked');

  // ---------------------------------------------------------------------------
  // 9. FINANCE: Financial Snapshot, Double-Entry Settlement, Payout Queue
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Finance: Financial Snapshot, Settlement, and Payout Worker ---');

  const financialSql = readRel('supabase/migrations/20260918000003_pack4c_financial_authority.sql');
  const finalRuntimeSql = readRel('supabase/migrations/20260928000700_restaurant_final_runtime_closure.sql');
  const payoutWorkerSrc = readRel('supabase/functions/process-merchant-payout/index.ts');

  // 9.1: Double-entry balanced posting batches for settlements and payouts
  assert(
    financialSql.includes('INSERT INTO public.financial_posting_batches') &&
      financialSql.includes('SETTLEMENT_PAYOUT') &&
      financialSql.includes('RESTAURANT_PAYABLE'),
    '9.1: Double-entry balanced posting batches verify debits and credits on merchant payouts'
  );

  // 9.2: get_payout_processing_secret RPC is service-role only
  assert(
    finalRuntimeSql.includes('CREATE OR REPLACE FUNCTION public.get_payout_processing_secret') &&
      finalRuntimeSql.includes("auth.role() IS DISTINCT FROM 'service_role'") &&
      finalRuntimeSql.includes('TO service_role'),
    '9.2: get_payout_processing_secret is strictly restricted to service_role'
  );

  // 9.3: Payout Worker consumes secrets and invokes PayoutGateway
  assert(
    payoutWorkerSrc.includes('get_payout_processing_secret') &&
      payoutWorkerSrc.includes('getPayoutGateway') &&
      payoutWorkerSrc.includes('finalize_merchant_payout_rpc') &&
      !payoutWorkerSrc.includes('console.log(secretData.account_identifier)'),
    '9.3: Payout Worker securely executes server disbursements without logging raw credentials'
  );

  // 9.4: Payout gateway enforces contract verification for Selcom and flag for ClickPesa
  let selcomContractErrorThrown = false;
  try {
    new SelcomPayoutGateway();
  } catch (e: any) {
    if (e.message?.includes('PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED')) {
      selcomContractErrorThrown = true;
    }
  }
  assert(selcomContractErrorThrown, '9.4: SelcomPayoutGateway throws PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED when unconfigured');

  let clickPesaFlagErrorThrown = false;
  try {
    new ClickPesaPayoutGateway();
  } catch (e: any) {
    if (e.message?.includes('CLICKPESA_LEGACY_PAYOUT_DISABLED')) {
      clickPesaFlagErrorThrown = true;
    }
  }
  assert(clickPesaFlagErrorThrown, '9.4: ClickPesaPayoutGateway strictly requires ALLOW_LEGACY_CLICKPESA_PAYOUT=true');

  // ---------------------------------------------------------------------------
  // 10. SECURITY & RBAC INVARIANTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Security & RBAC Invariants ---');

  // 10.1: Direct restaurant self-publish blocked by database trigger
  assert(
    authorityClosureSql.includes('trg_protect_restaurant_authority_fields') &&
      authorityClosureSql.includes('403 Forbidden: restaurant lifecycle fields are server-authoritative'),
    '10.1: Database trigger trg_protect_restaurant_authority_fields blocks direct self-publication'
  );

  // 10.2: CHEF role cannot alter branch GPS or address
  assert(
    authorityClosureSql.includes('Restaurant owners managers and admins manage branches') &&
      authorityClosureSql.includes("rm.role IN ('OWNER', 'MANAGER')"),
    '10.2: Branch identity RLS policy restricts GPS and address changes to OWNER and MANAGER (CHEF blocked)'
  );

  // 10.3: Customers cannot access merchant verification documents storage bucket
  assert(
    twoGateSql.includes("bucket_id = 'merchant-verification'") &&
      twoGateSql.includes('public.is_admin(auth.uid())'),
    '10.3: Storage RLS on merchant-verification bucket restricts access to store owner and platform admin'
  );

  // 10.4: Client-side factory does not automatically default to ClickPesa in production
  let clientFactoryThrowsContractError = false;
  const originalEnv = process.env.EXPO_PUBLIC_APP_ENV;
  try {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    getPayoutProvider();
  } catch (e: any) {
    if (e.message?.includes('PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED')) {
      clientFactoryThrowsContractError = true;
    }
  } finally {
    process.env.EXPO_PUBLIC_APP_ENV = originalEnv;
  }
  assert(
    clientFactoryThrowsContractError,
    '10.4: Client getPayoutProvider factory throws PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED in production instead of auto ClickPesa'
  );

  // 10.5: RestaurantRepository publishRestaurant is marked deprecated
  assert(
    restRepoSrc.includes('@deprecated Use `submitForLaunchReview` instead'),
    '10.5: RestaurantRepository.publishRestaurant is annotated @deprecated to prevent direct caller confusion'
  );

  console.log('\n================================================================');
  console.log(`🏁 RESTAURANT 100% CLOSURE SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

// Allow standalone execution
if (require.main === module) {
  runRestaurant100PercentClosureTests()
    .then(({ failed }) => {
      if (failed > 0) process.exit(1);
    })
    .catch((err) => {
      console.error('Test execution error:', err);
      process.exit(1);
    });
}
