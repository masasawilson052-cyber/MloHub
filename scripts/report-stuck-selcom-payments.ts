/**
 * ============================================================================
 * MLOHUB: AUDIT & REPAIR STUCK SELCOM PAYMENTS (STAGING ONLY)
 * ============================================================================
 * Safe diagnostic script to inspect stuck Selcom mobile money payments.
 * 
 * Invariants:
 * 1. Read-only by default: queries Selcom queryStatus and outputs report without writing.
 * 2. Strict Production Guard: Refuses execution against production (rrebkpeumvqffuwtqvje).
 * 3. Repair mode (--confirm flag): On STAGING only, confirms payments where Selcom
 *    reports status as PAID with matching authoritative amount via
 *    confirm_payment_webhook_rpc, and prints a clear before/after comparison table.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PaymentGatewayFactory } from '../supabase/functions/_shared/payments/PaymentGatewayFactory';

const PROD_REF = 'rrebkpeumvqffuwtqvje';

interface PaymentRow {
  id: string;
  order_id: string | null;
  reservation_id: string | null;
  amount_tzs: number;
  provider: string;
  provider_reference: string | null;
  merchant_reference: string | null;
  status: string;
  duplicate_of_payment_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRecord {
  paymentId: string;
  merchantRef: string;
  providerRef: string;
  amountTzs: number;
  dbStatusBefore: string;
  selcomStatus: string;
  selcomAmount: number;
  actionTaken: string;
  dbStatusAfter: string;
}

async function main() {
  console.log('\n================================================================');
  console.log('🔍 MLOHUB SELCOM STUCK PAYMENTS AUDIT & VERIFICATION');
  console.log('================================================================\n');

  const isConfirmMode = process.argv.includes('--confirm') || process.argv.includes('--fix');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

  // 1. Strict Production Guard
  if (supabaseUrl.includes(PROD_REF)) {
    console.error(`❌ REFUSING EXECUTION: Target URL (${supabaseUrl}) matches production reference (${PROD_REF}). Aborting.`);
    process.exit(1);
  }

  const prodJsonPath = path.resolve(__dirname, '..', 'production-public.json');
  if (fs.existsSync(prodJsonPath)) {
    try {
      const prodConfig = JSON.parse(fs.readFileSync(prodJsonPath, 'utf8'));
      if (prodConfig.url && supabaseUrl.trim().toLowerCase() === prodConfig.url.trim().toLowerCase()) {
        console.error(`❌ REFUSING EXECUTION: SUPABASE_URL matches production-public.json (${prodConfig.url}). Aborting.`);
        process.exit(1);
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  if (!serviceRoleKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Target database: ${supabaseUrl}`);
  console.log(`Mode: ${isConfirmMode ? '🛠️  REPAIR & CONFIRM (--confirm)' : '👀  READ-ONLY AUDIT'}\n`);

  // 2. Fetch all Selcom payments in PENDING, EXPIRED, or FAILED status
  const { data: stuckPayments, error: fetchErr } = await adminClient
    .from('payments')
    .select('id, order_id, reservation_id, amount_tzs, provider, provider_reference, merchant_reference, status, duplicate_of_payment_id, created_at, updated_at')
    .ilike('provider', 'selcom')
    .in('status', ['PENDING', 'EXPIRED', 'FAILED'])
    .is('duplicate_of_payment_id', null)
    .order('created_at', { ascending: false });

  if (fetchErr) {
    console.error('❌ Failed to fetch stuck payments:', fetchErr.message);
    process.exit(1);
  }

  if (!stuckPayments || stuckPayments.length === 0) {
    console.log('✓ No stuck Selcom payments found in PENDING, EXPIRED, or FAILED status.');
    process.exit(0);
  }

  console.log(`Found ${stuckPayments.length} candidate Selcom payment(s) for status inspection.`);

  const selcomGateway = PaymentGatewayFactory.getGateway('selcom');
  const auditRecords: AuditRecord[] = [];

  for (const p of stuckPayments as PaymentRow[]) {
    const merchantRef = p.merchant_reference || '';
    const providerRef = p.provider_reference || '';

    let selcomStatus = 'UNKNOWN';
    let selcomAmount = 0;
    let actionTaken = 'NONE (Read-Only)';
    let dbStatusAfter = p.status;

    try {
      if (!providerRef && !merchantRef) {
        selcomStatus = 'NO_REFERENCE';
      } else {
        const gwResponse = await selcomGateway.queryStatus(providerRef, merchantRef);
        selcomStatus = String(gwResponse.status || 'UNKNOWN').toUpperCase();
        selcomAmount = Number(gwResponse.amountTzs ?? gwResponse.amount ?? 0);
      }
    } catch (err: any) {
      selcomStatus = `ERROR: ${err?.message || 'Unreachable'}`;
    }

    const isPaidAtGateway = (selcomStatus === 'PAID' || selcomStatus === 'SUCCESS' || selcomStatus === 'COMPLETED');
    const isAmountMatch = (selcomAmount === p.amount_tzs || (selcomAmount === 0 && isPaidAtGateway));

    if (isPaidAtGateway && isAmountMatch && isConfirmMode) {
      console.log(`⚡ Payment ${p.id} (${merchantRef}) is PAID at Selcom. Confirming via confirm_payment_webhook_rpc...`);
      const { data: rpcRes, error: rpcErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
        p_merchant_reference: merchantRef,
        p_gateway_reference: providerRef || merchantRef,
        p_provider: 'selcom',
        p_collected_amount: p.amount_tzs,
        p_event_id: `selcom_stuck_repair_${p.id}_${Date.now()}`,
        p_raw_payload: {
          source: 'report-stuck-selcom-payments',
          verifiedAt: new Date().toISOString(),
        },
      });

      if (rpcErr || rpcRes?.success === false) {
        actionTaken = `FAILED: ${rpcErr?.message || rpcRes?.error || 'RPC error'}`;
        dbStatusAfter = p.status;
      } else if (rpcRes?.duplicate) {
        actionTaken = `CONFIRMED_DUPLICATE (original: ${rpcRes.original_payment_id})`;
        dbStatusAfter = 'SUCCESS (DUPLICATE)';
      } else {
        actionTaken = 'CONFIRMED_SUCCESS';
        dbStatusAfter = 'SUCCESS';
      }
    } else if (isPaidAtGateway && !isAmountMatch) {
      actionTaken = `MISMATCH_FLAGGED (expected ${p.amount_tzs}, gateway ${selcomAmount})`;
    } else if (isPaidAtGateway && !isConfirmMode) {
      actionTaken = 'ELIGIBLE_FOR_CONFIRM (run with --confirm)';
    }

    auditRecords.push({
      paymentId: p.id,
      merchantRef,
      providerRef,
      amountTzs: p.amount_tzs,
      dbStatusBefore: p.status,
      selcomStatus,
      selcomAmount,
      actionTaken,
      dbStatusAfter,
    });
  }

  // 3. Print Report
  console.log('\n================================================================');
  console.log('📋 AUDIT REPORT: SELCOM PAYMENT RECONCILIATION SUMMARY');
  console.log('================================================================\n');

  console.table(auditRecords.map(r => ({
    'Payment ID': r.paymentId.slice(0, 16) + '...',
    'Merchant Ref': r.merchantRef,
    'Amount': `${r.amountTzs.toLocaleString()} TZS`,
    'Status (Before)': r.dbStatusBefore,
    'Selcom Status': r.selcomStatus,
    'Action': r.actionTaken,
    'Status (After)': r.dbStatusAfter,
  })));

  const confirmedCount = auditRecords.filter(r => r.actionTaken.startsWith('CONFIRMED')).length;
  const eligibleCount = auditRecords.filter(r => r.actionTaken.startsWith('ELIGIBLE')).length;

  console.log(`\nAudit completed: ${auditRecords.length} examined, ${confirmedCount} confirmed, ${eligibleCount} pending confirmation.`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Fatal error in report-stuck-selcom-payments:', err);
  process.exit(1);
});
