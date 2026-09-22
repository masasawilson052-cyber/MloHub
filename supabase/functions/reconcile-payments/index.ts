import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { PaymentGatewayFactory } from '../_shared/payments/PaymentGatewayFactory.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StalePayment {
  id: string;
  order_id: string;
  amount_tzs: number;
  provider: string;
  provider_reference: string | null;
  merchant_reference: string | null;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

interface ReconcileResult {
  paymentId: string;
  outcome: 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'SKIPPED' | 'ERROR';
  reason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Payments older than this (seconds) are eligible for reconciliation. */
const STALE_THRESHOLD_SECONDS = 30;

/** Payments older than this (minutes) with no gateway reference are auto-failed. */
const ORPHAN_TIMEOUT_MINUTES = 15;

/** Maximum payments processed in a single reconciliation run. */
const BATCH_LIMIT = 50;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  // Allow service-role callers (internal cron / Supabase pg_cron)
  const auth = req.headers.get('Authorization') || '';
  if (auth === `Bearer ${serviceRoleKey}`) return true;

  // Allow explicit reconciliation worker header
  const workerSecret = Deno.env.get('RECONCILE_WORKER_SECRET');
  if (workerSecret) {
    const xWorker = req.headers.get('x-worker-secret') || req.headers.get('x-reconciliation-secret');
    if (xWorker === workerSecret) return true;
  }

  return false;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'SERVER_CONFIGURATION_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Authorization: service-role Bearer OR x-worker-secret header
  if (!isAuthorized(req, serviceRoleKey)) {
    return new Response(
      JSON.stringify({ success: false, error: 'UNAUTHORIZED' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_THRESHOLD_SECONDS * 1000).toISOString();
  const orphanThreshold = new Date(now.getTime() - ORPHAN_TIMEOUT_MINUTES * 60 * 1000).toISOString();

  try {
    // Fetch stale PENDING or PROCESSING payments
    const { data: stalePayments, error: fetchErr } = await adminClient
      .from('payments')
      .select('id, order_id, amount_tzs, provider, provider_reference, merchant_reference, processing_status, created_at, updated_at')
      .in('processing_status', ['PENDING', 'PROCESSING'])
      .lt('updated_at', staleThreshold)
      .order('updated_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (fetchErr) {
      console.error('[reconcile-payments] Failed to fetch stale payments:', fetchErr);
      return new Response(
        JSON.stringify({ success: false, error: 'FETCH_FAILED', message: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stalePayments || stalePayments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: ReconcileResult[] = [];

    for (const payment of stalePayments as StalePayment[]) {
      const result = await reconcilePayment(adminClient, payment, orphanThreshold);
      results.push(result);
    }

    const confirmed = results.filter((r) => r.outcome === 'CONFIRMED').length;
    const failed = results.filter((r) => r.outcome === 'FAILED' || r.outcome === 'CANCELLED').length;
    const skipped = results.filter((r) => r.outcome === 'SKIPPED').length;
    const errors = results.filter((r) => r.outcome === 'ERROR').length;

    console.log(`[reconcile-payments] Run complete — confirmed: ${confirmed}, failed: ${failed}, skipped: ${skipped}, errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: stalePayments.length,
        confirmed,
        failed,
        skipped,
        errors,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[reconcile-payments] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'RECONCILE_ERROR', message: err?.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ─── Per-payment reconciliation logic ─────────────────────────────────────────

async function reconcilePayment(
  adminClient: ReturnType<typeof createClient>,
  payment: StalePayment,
  orphanThreshold: string
): Promise<ReconcileResult> {
  try {
    // Orphan: no gateway reference and past the orphan timeout → auto-fail
    if (!payment.provider_reference && !payment.merchant_reference) {
      if (payment.created_at < orphanThreshold) {
        await adminClient
          .from('payments')
          .update({
            processing_status: 'FAILED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id);

        console.warn(`[reconcile-payments] Orphan auto-failed: ${payment.id}`);
        return { paymentId: payment.id, outcome: 'FAILED', reason: 'ORPHAN_TIMEOUT' };
      }

      // Too recent to decide — skip
      return { paymentId: payment.id, outcome: 'SKIPPED', reason: 'NO_REFERENCE_YET' };
    }

    // Build gateway and query live status
    const gateway = PaymentGatewayFactory.getGateway();
    const statusResponse = await gateway.queryStatus(
      payment.provider_reference || '',
      payment.merchant_reference || ''
    );

    if (!statusResponse || !statusResponse.status) {
      return { paymentId: payment.id, outcome: 'SKIPPED', reason: 'GATEWAY_NO_STATUS' };
    }

    const gatewayStatus = statusResponse.status.toUpperCase();

    if (gatewayStatus === 'PAID' || gatewayStatus === 'COMPLETED' || gatewayStatus === 'SUCCESS') {
      // Validate amount match (allow ±1 TZS rounding tolerance)
      const gatewayAmount = Number(statusResponse.amount || 0);
      if (gatewayAmount > 0 && Math.abs(gatewayAmount - payment.amount_tzs) > 1) {
        console.error(`[reconcile-payments] Amount mismatch for ${payment.id}: expected ${payment.amount_tzs}, got ${gatewayAmount}`);
        await adminClient
          .from('payments')
          .update({
            processing_status: 'FAILED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id);
        return { paymentId: payment.id, outcome: 'FAILED', reason: 'AMOUNT_MISMATCH' };
      }

      // Confirm via canonical RPC (same path as live webhook)
      const { error: rpcErr } = await adminClient.rpc('confirm_payment_webhook_rpc', {
        p_merchant_reference: payment.merchant_reference,
        p_provider_reference: payment.provider_reference,
        p_amount_tzs: payment.amount_tzs,
        p_provider: payment.provider,
        p_raw_payload: { reconciled: true, gateway_status: gatewayStatus },
      });

      if (rpcErr) {
        console.error(`[reconcile-payments] RPC confirm failed for ${payment.id}:`, rpcErr);
        return { paymentId: payment.id, outcome: 'ERROR', reason: rpcErr.message };
      }

      return { paymentId: payment.id, outcome: 'CONFIRMED' };

    } else if (
      gatewayStatus === 'FAILED' ||
      gatewayStatus === 'CANCELLED' ||
      gatewayStatus === 'REJECTED' ||
      gatewayStatus === 'EXPIRED'
    ) {
      await adminClient
        .from('payments')
        .update({
          processing_status: gatewayStatus === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      return {
        paymentId: payment.id,
        outcome: gatewayStatus === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
        reason: `GATEWAY_${gatewayStatus}`,
      };

    } else {
      // Still PENDING at gateway — leave it alone
      return { paymentId: payment.id, outcome: 'SKIPPED', reason: `GATEWAY_STILL_${gatewayStatus}` };
    }
  } catch (err: any) {
    console.error(`[reconcile-payments] Error processing ${payment.id}:`, err);
    return { paymentId: payment.id, outcome: 'ERROR', reason: err?.message || 'Unknown error' };
  }
}
