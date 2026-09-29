/**
 * MloHub Administrator Final Closure Pass 1 - Financial Governance Test Suite
 *
 * 15 Authoritative Verification Checks:
 * 1. Offline payout destination cannot become VERIFIED.
 * 2. No "Upgrade to Verified" button in RestaurantDetailAdmin.
 * 3. app/admin/index.tsx has no handleUpgradeToVerified.
 * 4. Legacy verify_restaurant_secure in migration requires 3 reviewed documents.
 * 5. Reactivation in migration does not set VERIFIED without 3 verified documents and never alters launch status.
 * 6. UNKNOWN payment provider does not become ClickPesa.
 * 7. Server financial summary RPC get_admin_finance_summary exists in migration.
 * 8. Financial Admin lists use pagination/range (PaymentRepository, RefundsRepository, DisputesRepository, SettlementsRepository, PayoutsRepository, AuditLogRepository).
 * 9. Settlements center wires approveSettlement.
 * 10. Settlements center wires executePayout.
 * 11. Settlement hold RPC requires AAL2 + SUPER_ADMIN.
 * 12. Payout retry RPC requires AAL2 + SUPER_ADMIN.
 * 13. Dispute center wires resolveDispute.
 * 14. Manual reconciliation in reconcile-payments requires Admin AAL2.
 * 15. Payment reconciliation never updates success client-side.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PayoutsRepository } from '../repositories/payouts.repository';
import { PaymentRepository } from '../repositories/payments.repository';
import { RefundsRepository } from '../repositories/refunds.repository';
import { DisputesRepository } from '../repositories/disputes.repository';
import { SettlementsRepository } from '../repositories/settlements.repository';
import { AuditLogRepository } from '../repositories/auditLogs.repository';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import { PaymentGatewayProvider } from '../db/types';

const ROOT_DIR = path.resolve(__dirname, '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf-8');
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('--- ADMIN FINANCIAL GOVERNANCE CLOSURE (PASS 1 OF 2) ---');
  console.log('=============================================================\n');

  // --------------------------------------------------------------------------
  // Check 1: Offline payout destination cannot become VERIFIED
  // --------------------------------------------------------------------------
  console.log('[Check 1] Offline payout destination fail-closed verification');
  const destinationResult = await PayoutsRepository.addPayoutDestination({
    restaurantId: 'test-rest-id',
    destinationType: 'MOBILE_MONEY',
    provider: 'VODACOM_MPESA',
    rawAccountIdentifier: '255755123456',
    accountName: 'Fail Closed Merchant',
  });
  assert.equal(destinationResult.success, false, 'addPayoutDestination must fail when offline');
  assert.equal(destinationResult.destinationId, undefined, 'destinationId must be undefined on offline failure');
  console.log('✅ Check 1 PASS: Offline payout destination cannot become VERIFIED');

  // --------------------------------------------------------------------------
  // Check 2: No "Upgrade to Verified" button in RestaurantDetailAdmin
  // --------------------------------------------------------------------------
  console.log('[Check 2] RestaurantDetailAdmin UI clean from legacy verification bypass');
  const restaurantDetailContent = readFile('components/admin/RestaurantDetailAdmin.tsx');
  assert.equal(
    restaurantDetailContent.includes('Upgrade to Verified'),
    false,
    'RestaurantDetailAdmin must not contain "Upgrade to Verified" button or text'
  );
  assert.equal(
    restaurantDetailContent.includes('handleConfirmUpgrade'),
    false,
    'RestaurantDetailAdmin must not contain handleConfirmUpgrade'
  );
  assert.equal(
    restaurantDetailContent.includes('upgradeMode'),
    false,
    'RestaurantDetailAdmin must not contain upgradeMode'
  );
  console.log('✅ Check 2 PASS: No "Upgrade to Verified" button in RestaurantDetailAdmin');

  // --------------------------------------------------------------------------
  // Check 3: app/admin/index.tsx has no handleUpgradeToVerified
  // --------------------------------------------------------------------------
  console.log('[Check 3] app/admin/index.tsx clean from handleUpgradeToVerified');
  const adminIndexContent = readFile('app/admin/index.tsx');
  assert.equal(
    adminIndexContent.includes('handleUpgradeToVerified'),
    false,
    'app/admin/index.tsx must not contain handleUpgradeToVerified'
  );
  assert.equal(
    adminIndexContent.includes('onUpgradeToVerified'),
    false,
    'app/admin/index.tsx must not pass onUpgradeToVerified prop'
  );
  console.log('✅ Check 3 PASS: app/admin/index.tsx has no handleUpgradeToVerified');

  // --------------------------------------------------------------------------
  // Check 4: Legacy verify_restaurant_secure in migration requires 3 reviewed documents
  // --------------------------------------------------------------------------
  console.log('[Check 4] Migration verify_restaurant_secure document requirement');
  const migrationContent = readFile(
    'supabase/migrations/20260929000100_admin_financial_governance_closure.sql'
  );
  assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.verify_restaurant_secure'),
    'Migration must define verify_restaurant_secure'
  );
  assert.ok(
    migrationContent.includes("'BUSINESS_LICENSE'") &&
      migrationContent.includes("'TIN_DOCUMENT'") &&
      migrationContent.includes("'FOOD_OPERATION_DOCUMENT'"),
    'verify_restaurant_secure must check BUSINESS_LICENSE, TIN_DOCUMENT, and FOOD_OPERATION_DOCUMENT'
  );
  assert.ok(
    migrationContent.includes('v_verified_count < 3') || migrationContent.includes('v_verified_count = 3'),
    'verify_restaurant_secure must require 3 verified documents'
  );
  console.log('✅ Check 4 PASS: verify_restaurant_secure in migration requires 3 reviewed documents');

  // --------------------------------------------------------------------------
  // Check 5: Reactivation in migration does not set VERIFIED without 3 docs and never alters launch status
  // --------------------------------------------------------------------------
  console.log('[Check 5] Migration reactivate_restaurant_secure document requirement & launchStatus safety');
  assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.reactivate_restaurant_secure'),
    'Migration must define reactivate_restaurant_secure'
  );
  // Must check doc count for verification
  assert.ok(
    migrationContent.includes('v_verified_count = 3 THEN \'VERIFIED\' ELSE \'PENDING_VERIFICATION\''),
    'reactivate_restaurant_secure must only set VERIFIED when 3 verified documents exist'
  );
  // Must NOT modify launch_status
  assert.equal(
    migrationContent.includes('launch_status ='),
    false,
    'reactivate_restaurant_secure must NEVER mutate launch_status'
  );
  console.log('✅ Check 5 PASS: reactivate_restaurant_secure respects document truth and preserves launch status');

  // --------------------------------------------------------------------------
  // Check 6: UNKNOWN payment provider does not become ClickPesa
  // --------------------------------------------------------------------------
  console.log('[Check 6] UNKNOWN payment provider handling');
  const paymentsRepoContent = readFile('repositories/payments.repository.ts');
  assert.ok(
    paymentsRepoContent.includes("(row.provider || 'UNKNOWN') as PaymentGatewayProvider"),
    'payments.repository.ts must fall back to UNKNOWN, not CLICKPESA'
  );
  assert.equal(
    paymentsRepoContent.includes("row.provider || 'CLICKPESA'"),
    false,
    'payments.repository.ts must not default empty provider to CLICKPESA'
  );
  console.log('✅ Check 6 PASS: UNKNOWN payment provider does not become ClickPesa');

  // --------------------------------------------------------------------------
  // Check 7: Server financial summary RPC get_admin_finance_summary exists in migration
  // --------------------------------------------------------------------------
  console.log('[Check 7] Authoritative RPC get_admin_finance_summary in migration');
  assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.get_admin_finance_summary'),
    'Migration must define get_admin_finance_summary'
  );
  assert.ok(
    migrationContent.includes('attempted_volume_tzs') &&
      migrationContent.includes('captured_volume_tzs') &&
      migrationContent.includes('refunded_volume_tzs') &&
      migrationContent.includes('pending_payments') &&
      migrationContent.includes('calculated_settlements'),
    'get_admin_finance_summary must aggregate attempted, captured, refunded, pending, and settlements'
  );
  console.log('✅ Check 7 PASS: Server financial summary RPC get_admin_finance_summary exists in migration');

  // --------------------------------------------------------------------------
  // Check 8: Financial Admin lists use pagination/range
  // --------------------------------------------------------------------------
  console.log('[Check 8] Pagination across all 6 financial repositories');
  assert.equal(typeof PaymentRepository.listAdminPage, 'function', 'PaymentRepository.listAdminPage must exist');
  assert.equal(typeof RefundsRepository.listAdminPage, 'function', 'RefundsRepository.listAdminPage must exist');
  assert.equal(typeof DisputesRepository.listAdminPage, 'function', 'DisputesRepository.listAdminPage must exist');
  assert.equal(typeof SettlementsRepository.listAdminPage, 'function', 'SettlementsRepository.listAdminPage must exist');
  assert.equal(typeof PayoutsRepository.listAdminPage, 'function', 'PayoutsRepository.listAdminPage must exist');
  assert.equal(typeof AuditLogRepository.listAdminPage, 'function', 'AuditLogRepository.listAdminPage must exist');
  console.log('✅ Check 8 PASS: All 6 financial repositories implement listAdminPage with pagination');

  // --------------------------------------------------------------------------
  // Check 9: Settlements center wires approveSettlement
  // --------------------------------------------------------------------------
  console.log('[Check 9] Settlements center wires approveSettlement');
  const settlementsCenterContent = readFile('components/admin/SettlementsPayoutsCenter.tsx');
  assert.ok(
    settlementsCenterContent.includes('SettlementsRepository.approveSettlement'),
    'SettlementsPayoutsCenter must wire SettlementsRepository.approveSettlement'
  );
  console.log('✅ Check 9 PASS: Settlements center wires approveSettlement');

  // --------------------------------------------------------------------------
  // Check 10: Settlements center wires executePayout
  // --------------------------------------------------------------------------
  console.log('[Check 10] Settlements center wires executePayout');
  assert.ok(
    settlementsCenterContent.includes('PayoutsRepository.executePayout'),
    'SettlementsPayoutsCenter must wire PayoutsRepository.executePayout'
  );
  console.log('✅ Check 10 PASS: Settlements center wires executePayout');

  // --------------------------------------------------------------------------
  // Check 11: Settlement hold RPC requires AAL2 + SUPER_ADMIN
  // --------------------------------------------------------------------------
  console.log('[Check 11] Settlement hold RPC authorization requirements');
  assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.set_merchant_settlement_hold_secure'),
    'Migration must define set_merchant_settlement_hold_secure'
  );
  const holdRpcSection = migrationContent.substring(
    migrationContent.indexOf('CREATE OR REPLACE FUNCTION public.set_merchant_settlement_hold_secure'),
    migrationContent.indexOf('CREATE OR REPLACE FUNCTION public.retry_merchant_payout_secure')
  );
  assert.ok(
    holdRpcSection.includes('public.require_admin_aal2()'),
    'set_merchant_settlement_hold_secure must require AAL2'
  );
  assert.ok(
    holdRpcSection.includes('public.is_super_admin('),
    'set_merchant_settlement_hold_secure must require SUPER_ADMIN'
  );
  console.log('✅ Check 11 PASS: Settlement hold RPC requires AAL2 + SUPER_ADMIN');

  // --------------------------------------------------------------------------
  // Check 12: Payout retry RPC requires AAL2 + SUPER_ADMIN
  // --------------------------------------------------------------------------
  console.log('[Check 12] Payout retry RPC authorization requirements');
  assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.retry_merchant_payout_secure'),
    'Migration must define retry_merchant_payout_secure'
  );
  const retryRpcSection = migrationContent.substring(
    migrationContent.indexOf('CREATE OR REPLACE FUNCTION public.retry_merchant_payout_secure')
  );
  assert.ok(
    retryRpcSection.includes('public.require_admin_aal2()'),
    'retry_merchant_payout_secure must require AAL2'
  );
  assert.ok(
    retryRpcSection.includes('public.is_super_admin('),
    'retry_merchant_payout_secure must require SUPER_ADMIN'
  );
  console.log('✅ Check 12 PASS: Payout retry RPC requires AAL2 + SUPER_ADMIN');

  // --------------------------------------------------------------------------
  // Check 13: Dispute center wires resolveDispute
  // --------------------------------------------------------------------------
  console.log('[Check 13] Dispute center wires resolveDispute');
  const refundsCenterContent = readFile('components/admin/RefundsDisputesCenter.tsx');
  assert.ok(
    refundsCenterContent.includes('DisputesRepository.resolveDispute'),
    'RefundsDisputesCenter must wire DisputesRepository.resolveDispute'
  );
  console.log('✅ Check 13 PASS: Dispute center wires resolveDispute');

  // --------------------------------------------------------------------------
  // Check 14: Manual reconciliation in reconcile-payments requires Admin AAL2
  // --------------------------------------------------------------------------
  console.log('[Check 14] reconcile-payments Edge Function Dual Authorization');
  const reconcileFnContent = readFile('supabase/functions/reconcile-payments/index.ts');
  assert.ok(
    reconcileFnContent.includes("userClient.rpc('require_admin_aal2')"),
    'reconcile-payments must verify Admin AAL2 via require_admin_aal2'
  );
  assert.ok(
    reconcileFnContent.includes("userClient.rpc('is_admin'"),
    'reconcile-payments must verify Admin role via is_admin'
  );
  console.log('✅ Check 14 PASS: Manual reconciliation in reconcile-payments requires Admin AAL2');

  // --------------------------------------------------------------------------
  // Check 15: Payment reconciliation never updates success client-side
  // --------------------------------------------------------------------------
  console.log('[Check 15] Payment reconciliation never updates success client-side');
  const paymentsMonitorContent = readFile('components/admin/PaymentsMonitor.tsx');
  assert.ok(
    paymentsMonitorContent.includes("supabase.functions.invoke('reconcile-payments'"),
    'PaymentsMonitor must invoke reconcile-payments Edge Function'
  );
  assert.equal(
    paymentsMonitorContent.includes("updateStatus("),
    false,
    'PaymentsMonitor must NEVER directly call updateStatus on payments'
  );
  assert.equal(
    paymentsMonitorContent.includes(".update({ status:"),
    false,
    'PaymentsMonitor must NEVER perform direct status updates'
  );
  console.log('✅ Check 15 PASS: Payment reconciliation never updates success client-side');

  console.log('\n=============================================================');
  console.log('🎉 ALL 15 FINANCIAL GOVERNANCE CLOSURE CHECKS PASSED!');
  console.log('=============================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exitCode = 1;
});
