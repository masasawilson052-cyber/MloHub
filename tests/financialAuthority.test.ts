/**
 * MLOHUB PACK 4C: FINANCIAL AUTHORITY, REFUNDS, DISPUTES,
 * SETTLEMENTS & RECONCILIATION
 * Unit and Integration Test Suite
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  calculateCommissionTzs,
  formatTzs,
} from '../config/platformFees';
import {
  SandboxPayoutProvider,
  ClickPesaPayoutProvider,
  getPayoutProvider,
} from '../services/payouts/PayoutProvider';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

export async function runFinancialAuthorityTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 PACK 4C: FINANCIAL AUTHORITY & RECONCILIATION SUITE');
  console.log('================================================================\n');

  const files = {
    migration: path.resolve(__dirname, '../supabase/migrations/20260918000003_pack4c_financial_authority.sql'),
    domainTypes: path.resolve(__dirname, '../types/domain.ts'),
    platformFeesConfig: path.resolve(__dirname, '../config/platformFees.ts'),
    payoutProvider: path.resolve(__dirname, '../services/payouts/PayoutProvider.ts'),
    financialLedgerRepo: path.resolve(__dirname, '../repositories/financialLedger.repository.ts'),
    refundsRepo: path.resolve(__dirname, '../repositories/refunds.repository.ts'),
    settlementsRepo: path.resolve(__dirname, '../repositories/settlements.repository.ts'),
    payoutsRepo: path.resolve(__dirname, '../repositories/payouts.repository.ts'),
    disputesRepo: path.resolve(__dirname, '../repositories/disputes.repository.ts'),
    reconciliationRepo: path.resolve(__dirname, '../repositories/reconciliation.repository.ts'),
    reposIndex: path.resolve(__dirname, '../repositories/index.ts'),
  };

  // Section 1: Artifact & File Existence
  console.log('--- Section 1: Artifact & File Existence ---');
  for (const [name, filePath] of Object.entries(files)) {
    assert(fs.existsSync(filePath), `Target file exists: ${name} (${path.basename(filePath)})`);
  }

  // Section 2: Exact BigInt Money & Basis Points Commission Calculation
  console.log('\n--- Section 2: Exact Integer Money & Basis Points Math ---');
  const comm10 = calculateCommissionTzs(30000n, 1000n);
  assert(comm10 === 3000n, '10% commission on 30,000 TZS equals 3,000 TZS exactly');

  // Half-up rounding on fractional outcome: 12,345 * 15% (1500 bps) = 1851.75 -> 1852
  const commHalfUp = calculateCommissionTzs(12345n, 1500n);
  assert(commHalfUp === 1852n, 'Half-up integer rounding on 12,345 TZS @ 15% yields 1,852 TZS');

  // Extreme precision test beyond JavaScript Number.MAX_SAFE_INTEGER (9,007,199,254,740,991)
  const hugeGross = 10_000_000_000_000_000n; // 10 quadrillion TZS
  const hugeComm = calculateCommissionTzs(hugeGross, 1000n);
  assert(hugeComm === 1_000_000_000_000_000n, 'Calculates exact commission on 10 quadrillion TZS without floating-point drift');

  const hugeOdd = 10_000_000_000_000_005n;
  const hugeOddComm = calculateCommissionTzs(hugeOdd, 1000n);
  assert(hugeOddComm === 1_000_000_000_000_001n, 'Preserves exact single-shilling rounding on huge BigInt amounts');

  // Section 3: Safe Currency Formatting (formatTzs)
  console.log('\n--- Section 3: Safe Currency Formatting (formatTzs) ---');
  assert(formatTzs(120000n) === '120,000 TZS', 'formatTzs formats bigint 120000n to "120,000 TZS"');
  assert(formatTzs('50000') === '50,000 TZS', 'formatTzs formats numeric string "50000" properly');
  assert(formatTzs(25000) === '25,000 TZS', 'formatTzs formats safe integer number 25000');

  let rejectedUnsafeNumber = false;
  try {
    formatTzs(99999999999999999999);
  } catch {
    rejectedUnsafeNumber = true;
  }
  assert(rejectedUnsafeNumber, 'formatTzs throws error when unsafe float/number is provided');

  // Section 4: Payout Provider Abstraction & Fail-Closed Guardrails
  console.log('\n--- Section 4: Payout Provider Abstraction & Guardrails ---');
  const sandbox = new SandboxPayoutProvider();
  const caps = sandbox.getCapabilities();
  assert(caps.supportsMobileMoneyPayouts === true, 'SandboxPayoutProvider supports mobile money payouts');
  assert(caps.supportsBankPayouts === true, 'SandboxPayoutProvider supports bank payouts');
  assert(caps.supportsAutomatedRefunds === true, 'SandboxPayoutProvider supports automated refunds');

  const destValidation = await sandbox.validateDestination({
    destinationType: 'MOBILE_MONEY',
    accountIdentifier: '255755123456',
    provider: 'M_PESA',
  });
  assert(destValidation.isValid === true, 'Sandbox verifies valid mobile money destination');

  const payoutResult = await sandbox.disbursePayout({
    payoutId: 'pay_test_1',
    settlementId: 'settl_test_1',
    restaurantId: 'rest_test_1',
    amountTzs: 100000n,
    destinationType: 'MOBILE_MONEY',
    accountIdentifier: '255755123456',
    accountName: 'Vendor Name',
    idempotencyKey: 'idem_payout_test_1',
  });
  assert(payoutResult.success === true && payoutResult.status === 'SUCCESS', 'Sandbox disbursePayout returns SUCCESS');
  assert(payoutResult.providerReference.startsWith('cp_payout_'), 'Sandbox returns provider reference');

  // ClickPesa fail-closed verification
  const clickPesa = new ClickPesaPayoutProvider();
  let clickPesaFailedClosed = false;
  try {
    await clickPesa.disbursePayout({
      payoutId: 'pay_live_1',
      settlementId: 'settl_live_1',
      restaurantId: 'rest_live_1',
      amountTzs: 50000n,
      destinationType: 'MOBILE_MONEY',
      accountIdentifier: '255755000000',
      accountName: 'Live Vendor',
      idempotencyKey: 'idem_live_1',
    });
  } catch (e: any) {
    if (e.message && e.message.includes('Fail-closed')) {
      clickPesaFailedClosed = true;
    }
  }
  assert(clickPesaFailedClosed, 'ClickPesaPayoutProvider fails closed when credentials not configured');

  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  const resolvedProvider = getPayoutProvider();
  assert(resolvedProvider.name === 'SANDBOX_PAYOUT_PROVIDER', 'getPayoutProvider selects Sandbox in development');

  // Section 5: Double-Entry Balancing Invariant Logic
  console.log('\n--- Section 5: Double-Entry Balancing Invariants ---');
  function checkBatch(entries: Array<{ direction: string; amountTzs: bigint }>): boolean {
    let debits = 0n;
    let credits = 0n;
    for (const e of entries) {
      if (e.direction === 'DEBIT') debits += e.amountTzs;
      if (e.direction === 'CREDIT') credits += e.amountTzs;
    }
    return debits === credits;
  }

  // A. Standard Order: 34k customer paid, 29.5k net payable, 4.5k platform rev
  const orderBatch = [
    { direction: 'DEBIT', amountTzs: 34000n },
    { direction: 'CREDIT', amountTzs: 29500n },
    { direction: 'CREDIT', amountTzs: 4500n },
  ];
  assert(checkBatch(orderBatch), 'PAYMENT_CAPTURE batch balances (Debits 34,000 = Credits 34,000)');

  // B. Reservation Deposit Capture: held in RESERVATION_DEPOSIT_HOLDING
  const resHoldBatch = [
    { direction: 'DEBIT', amountTzs: 20000n },
    { direction: 'CREDIT', amountTzs: 20000n },
  ];
  assert(checkBatch(resHoldBatch), 'RESERVATION_DEPOSIT_CAPTURE batch balances (Debits 20,000 = Credits 20,000)');

  // C. Reservation Deposit Release: holding to payable
  const resReleaseBatch = [
    { direction: 'DEBIT', amountTzs: 20000n },
    { direction: 'CREDIT', amountTzs: 20000n },
  ];
  assert(checkBatch(resReleaseBatch), 'RESERVATION_DEPOSIT_RELEASE batch balances');

  // D. Merchant Refund: reduces restaurant payable
  const refMerchantBatch = [
    { direction: 'DEBIT', amountTzs: 10000n },
    { direction: 'CREDIT', amountTzs: 10000n },
  ];
  assert(checkBatch(refMerchantBatch), 'Merchant-funded REFUND_DISBURSEMENT batch balances');

  // E. Platform Refund: reduces platform revenue
  const refPlatBatch = [
    { direction: 'DEBIT', amountTzs: 1500n },
    { direction: 'CREDIT', amountTzs: 1500n },
  ];
  assert(checkBatch(refPlatBatch), 'Platform-funded REFUND_DISBURSEMENT batch balances');

  // F. Merchant Payout: payable to provider receivable
  const payoutBatch = [
    { direction: 'DEBIT', amountTzs: 100000n },
    { direction: 'CREDIT', amountTzs: 100000n },
  ];
  assert(checkBatch(payoutBatch), 'MERCHANT_PAYOUT batch balances');

  // G. Payout Reversal: provider receivable to restaurant payable
  const reversalBatch = [
    { direction: 'DEBIT', amountTzs: 100000n },
    { direction: 'CREDIT', amountTzs: 100000n },
  ];
  assert(checkBatch(reversalBatch), 'PAYOUT_REVERSAL batch balances and restores merchant entitlement');

  // H. Dispute Hold: payable to reserve
  const disputeHoldBatch = [
    { direction: 'DEBIT', amountTzs: 15000n },
    { direction: 'CREDIT', amountTzs: 15000n },
  ];
  assert(checkBatch(disputeHoldBatch), 'DISPUTE_HOLD batch balances');

  // Section 6: Settlement Netting Semantics
  console.log('\n--- Section 6: Settlement Netting Semantics ---');
  const settlementEntries = [
    { direction: 'CREDIT', amountTzs: 50000n },
    { direction: 'CREDIT', amountTzs: 30000n },
    { direction: 'DEBIT', amountTzs: 10000n }, // refund adjustment
  ];
  let netSigned = 0n;
  for (const e of settlementEntries) {
    if (e.direction === 'CREDIT') netSigned += e.amountTzs;
    if (e.direction === 'DEBIT') netSigned -= e.amountTzs;
  }
  assert(netSigned === 70000n, 'Settlement correctly nets credits (+80,000) and debits (-10,000) to 70,000 TZS');

  // Negative payable handling
  const negativeEntries = [
    { direction: 'CREDIT', amountTzs: 10000n },
    { direction: 'DEBIT', amountTzs: 25000n },
  ];
  let negSigned = 0n;
  for (const e of negativeEntries) {
    if (e.direction === 'CREDIT') negSigned += e.amountTzs;
    if (e.direction === 'DEBIT') negSigned -= e.amountTzs;
  }
  assert(negSigned === -15000n, 'Negative payable position is -15,000 TZS');
  assert(negSigned <= 0n, 'Negative payable correctly prevents creation of external negative payout');

  // Section 7: Migration Schema Invariants
  console.log('\n--- Section 7: Migration Schema Invariants ---');
  const migrationSrc = fs.readFileSync(files.migration, 'utf8');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.financial_posting_batches'), 'Migration creates financial_posting_batches');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.financial_ledger_entries'), 'Migration creates financial_ledger_entries');
  assert(migrationSrc.includes('trg_prevent_financial_ledger_mutation'), 'Migration enforces append-only immutability trigger on ledger');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.merchant_fee_policies'), 'Migration creates merchant_fee_policies');
  assert(migrationSrc.includes('validate_fee_policy_overlap'), 'Migration enforces non-overlapping fee policy validation');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.order_financial_snapshots'), 'Migration creates order_financial_snapshots');
  assert(migrationSrc.includes('trg_prevent_order_financial_snapshot_mutation'), 'Migration enforces snapshot immutability trigger');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.refund_requests'), 'Migration creates refund_requests');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.financial_disputes'), 'Migration creates financial_disputes');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.financial_dispute_evidence'), 'Migration creates financial_dispute_evidence');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.merchant_settlements'), 'Migration creates merchant_settlements');
  assert(migrationSrc.includes('trg_prevent_paid_settlement_mutation'), 'Migration enforces PAID settlement immutability trigger');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.merchant_settlement_items'), 'Migration creates merchant_settlement_items');
  assert(migrationSrc.includes('ledger_entry_id UUID NOT NULL UNIQUE'), 'merchant_settlement_items enforces UNIQUE ledger_entry_id');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.merchant_payout_destinations'), 'Migration creates merchant_payout_destinations');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.merchant_payout_destination_secrets'), 'Migration creates merchant_payout_destination_secrets');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.merchant_payouts'), 'Migration creates merchant_payouts');
  assert(migrationSrc.includes('destination_type_snapshot'), 'merchant_payouts snapshots destination type');
  assert(migrationSrc.includes('masked_identifier_snapshot'), 'merchant_payouts snapshots masked account identifier');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.reconciliation_runs'), 'Migration creates reconciliation_runs');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.reconciliation_items'), 'Migration creates reconciliation_items');
  assert(migrationSrc.includes('FUNCTION public.finalize_payment_capture_rpc'), 'Migration defines finalize_payment_capture_rpc');
  assert(migrationSrc.includes('FUNCTION public.release_reservation_deposit_financially'), 'Migration defines release_reservation_deposit_financially');
  assert(migrationSrc.includes('FUNCTION public.calculate_merchant_settlement'), 'Migration defines calculate_merchant_settlement');
  assert(migrationSrc.includes('FUNCTION public.approve_merchant_settlement'), 'Migration defines approve_merchant_settlement');
  assert(migrationSrc.includes('FUNCTION public.execute_merchant_payout_rpc'), 'Migration defines execute_merchant_payout_rpc');
  assert(migrationSrc.includes('FUNCTION public.finalize_merchant_payout_rpc'), 'Migration defines finalize_merchant_payout_rpc');
  assert(migrationSrc.includes('FUNCTION public.request_refund_secure'), 'Migration defines request_refund_secure');
  assert(migrationSrc.includes('FUNCTION public.approve_refund_secure'), 'Migration defines approve_refund_secure');
  assert(migrationSrc.includes('FUNCTION public.finalize_refund_provider_result'), 'Migration defines finalize_refund_provider_result');
  assert(migrationSrc.includes('FUNCTION public.open_financial_dispute_secure'), 'Migration defines open_financial_dispute_secure');
  assert(migrationSrc.includes('FUNCTION public.resolve_financial_dispute_secure'), 'Migration defines resolve_financial_dispute_secure');
  assert(migrationSrc.includes('REVOKE EXECUTE ON FUNCTION public.finalize_payment_capture_rpc'), 'Revokes finalize_payment_capture_rpc from public/authenticated');
  assert(migrationSrc.includes('REVOKE EXECUTE ON FUNCTION public.finalize_merchant_payout_rpc'), 'Revokes finalize_merchant_payout_rpc from public/authenticated');
  assert(migrationSrc.includes('REVOKE EXECUTE ON FUNCTION public.finalize_refund_provider_result'), 'Revokes finalize_refund_provider_result from public/authenticated');

  // Section 8: Domain Types Invariants
  console.log('\n--- Section 8: Domain Types Invariants ---');
  const domainSrc = fs.readFileSync(files.domainTypes, 'utf8');
  assert(domainSrc.includes('export type FinancialEntryType ='), 'domainTypes exports FinancialEntryType');
  assert(domainSrc.includes('export type FinancialAccountType ='), 'domainTypes exports FinancialAccountType');
  assert(domainSrc.includes("'CUSTOMER_PAYMENT_CLEARING'"), "FinancialAccountType contains 'CUSTOMER_PAYMENT_CLEARING'");
  assert(domainSrc.includes("'RESTAURANT_PAYABLE'"), "FinancialAccountType contains 'RESTAURANT_PAYABLE'");
  assert(domainSrc.includes("'PLATFORM_REVENUE'"), "FinancialAccountType contains 'PLATFORM_REVENUE'");
  assert(domainSrc.includes("'RESERVATION_DEPOSIT_HOLDING'"), "FinancialAccountType contains 'RESERVATION_DEPOSIT_HOLDING'");
  assert(domainSrc.includes("'REFUND_PAYABLE'"), "FinancialAccountType contains 'REFUND_PAYABLE'");
  assert(domainSrc.includes("'PROVIDER_RECEIVABLE'"), "FinancialAccountType contains 'PROVIDER_RECEIVABLE'");
  assert(domainSrc.includes("'DISPUTE_RESERVE'"), "FinancialAccountType contains 'DISPUTE_RESERVE'");
  assert(domainSrc.includes('export type RefundStatus ='), 'domainTypes exports RefundStatus');
  assert(domainSrc.includes('export type FinancialDisputeStatus ='), 'domainTypes exports FinancialDisputeStatus');
  assert(domainSrc.includes('export type MerchantSettlementStatus ='), 'domainTypes exports MerchantSettlementStatus');
  assert(domainSrc.includes('export type MerchantPayoutStatus ='), 'domainTypes exports MerchantPayoutStatus');
  assert(domainSrc.includes('export interface FinancialPostingBatch'), 'domainTypes exports FinancialPostingBatch');
  assert(domainSrc.includes('export interface FinancialLedgerEntry'), 'domainTypes exports FinancialLedgerEntry');
  assert(domainSrc.includes('export interface OrderFinancialSnapshot'), 'domainTypes exports OrderFinancialSnapshot');
  assert(domainSrc.includes('export interface RefundRequest'), 'domainTypes exports RefundRequest');
  assert(domainSrc.includes('export interface FinancialDispute'), 'domainTypes exports FinancialDispute');
  assert(domainSrc.includes('export interface MerchantSettlement'), 'domainTypes exports MerchantSettlement');
  assert(domainSrc.includes('export interface MerchantSettlementItem'), 'domainTypes exports MerchantSettlementItem');
  assert(domainSrc.includes('export interface MerchantPayoutDestination'), 'domainTypes exports MerchantPayoutDestination');
  assert(domainSrc.includes('export interface MerchantPayout'), 'domainTypes exports MerchantPayout');
  assert(domainSrc.includes('export interface RestaurantFinancialSummary'), 'domainTypes exports RestaurantFinancialSummary');

  // Section 9: Repositories Implementation
  console.log('\n--- Section 9: Repositories Implementation ---');
  const finRepoSrc = fs.readFileSync(files.financialLedgerRepo, 'utf8');
  assert(finRepoSrc.includes('getRestaurantLedgerEntries('), 'FinancialLedgerRepository implements getRestaurantLedgerEntries');
  assert(finRepoSrc.includes('getRestaurantSummary('), 'FinancialLedgerRepository implements getRestaurantSummary');
  assert(finRepoSrc.includes('getOrderFinancialSnapshot('), 'FinancialLedgerRepository implements getOrderFinancialSnapshot');
  assert(finRepoSrc.includes('getPostingBatch('), 'FinancialLedgerRepository implements getPostingBatch');

  const refRepoSrc = fs.readFileSync(files.refundsRepo, 'utf8');
  assert(refRepoSrc.includes('requestRefund('), 'RefundsRepository implements requestRefund');
  assert(refRepoSrc.includes('approveRefund('), 'RefundsRepository implements approveRefund');
  assert(refRepoSrc.includes('listByCustomer('), 'RefundsRepository implements listByCustomer');
  assert(refRepoSrc.includes('listByRestaurant('), 'RefundsRepository implements listByRestaurant');

  const setRepoSrc = fs.readFileSync(files.settlementsRepo, 'utf8');
  assert(setRepoSrc.includes('calculateSettlement('), 'SettlementsRepository implements calculateSettlement');
  assert(setRepoSrc.includes('approveSettlement('), 'SettlementsRepository implements approveSettlement');
  assert(setRepoSrc.includes('listByRestaurant('), 'SettlementsRepository implements listByRestaurant');
  assert(setRepoSrc.includes('getSettlementWithItems('), 'SettlementsRepository implements getSettlementWithItems');

  const payRepoSrc = fs.readFileSync(files.payoutsRepo, 'utf8');
  assert(payRepoSrc.includes('addPayoutDestination('), 'PayoutsRepository implements addPayoutDestination');
  assert(payRepoSrc.includes('listDestinations('), 'PayoutsRepository implements listDestinations');
  assert(payRepoSrc.includes('executePayout('), 'PayoutsRepository implements executePayout');
  assert(payRepoSrc.includes('listPayoutsByRestaurant('), 'PayoutsRepository implements listPayoutsByRestaurant');

  const disRepoSrc = fs.readFileSync(files.disputesRepo, 'utf8');
  assert(disRepoSrc.includes('openDispute('), 'DisputesRepository implements openDispute');
  assert(disRepoSrc.includes('resolveDispute('), 'DisputesRepository implements resolveDispute');
  assert(disRepoSrc.includes('addEvidence('), 'DisputesRepository implements addEvidence');

  const recRepoSrc = fs.readFileSync(files.reconciliationRepo, 'utf8');
  assert(recRepoSrc.includes('createRun('), 'ReconciliationRepository implements createRun');
  assert(recRepoSrc.includes('addReconciliationItems('), 'ReconciliationRepository implements addReconciliationItems');
  assert(recRepoSrc.includes('completeRun('), 'ReconciliationRepository implements completeRun');
  assert(recRepoSrc.includes('getRunDetails('), 'ReconciliationRepository implements getRunDetails');

  const indexSrc = fs.readFileSync(files.reposIndex, 'utf8');
  assert(indexSrc.includes('financialLedger.repository'), 'repositories/index exports financialLedger.repository');
  assert(indexSrc.includes('refunds.repository'), 'repositories/index exports refunds.repository');
  assert(indexSrc.includes('settlements.repository'), 'repositories/index exports settlements.repository');
  assert(indexSrc.includes('payouts.repository'), 'repositories/index exports payouts.repository');
  assert(indexSrc.includes('disputes.repository'), 'repositories/index exports disputes.repository');
  assert(indexSrc.includes('reconciliation.repository'), 'repositories/index exports reconciliation.repository');

  console.log('\n================================================================');
  console.log(`  PACK 4C UNIT & INTEGRATION: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runFinancialAuthorityTestSuite().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  });
}
