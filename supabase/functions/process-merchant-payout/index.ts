import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeadersFor } from '../_shared/cors.ts';
import { getPayoutGateway, PayoutGateway } from '../_shared/payouts/PayoutGateway.ts';

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  const auth = req.headers.get('Authorization') || '';
  if (auth === `Bearer ${serviceRoleKey}`) return true;

  const workerSecret = Deno.env.get('PAYOUT_WORKER_SECRET');
  if (workerSecret) {
    const xWorker = req.headers.get('x-worker-secret') || req.headers.get('x-payout-secret');
    if (xWorker === workerSecret) return true;
  }

  return false;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { success: false, error: 'METHOD_NOT_ALLOWED' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return reply(500, { success: false, error: 'SERVER_CONFIGURATION_ERROR' });
    }

    if (!isAuthorized(req, serviceRoleKey)) {
      return reply(401, { success: false, error: 'UNAUTHORIZED', message: 'Trusted service role required.' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const targetPayoutId: string | undefined = body.payoutId;

    // Identify payouts to process
    let payoutIds: string[] = [];
    if (targetPayoutId) {
      payoutIds = [targetPayoutId];
    } else {
      const { data: queued, error: qErr } = await supabase
        .from('merchant_payouts')
        .select('id')
        .eq('status', 'QUEUED')
        .order('requested_at', { ascending: true })
        .limit(10);

      if (qErr) {
        return reply(500, { success: false, error: 'QUERY_FAILED', message: qErr.message });
      }
      payoutIds = (queued || []).map((p: any) => p.id);
    }

    if (payoutIds.length === 0) {
      return reply(200, { success: true, processedCount: 0, message: 'No queued payouts found.' });
    }

    // Attempt to initialize gateway
    let gateway: PayoutGateway | null = null;
    let gatewayInitError: string | null = null;
    try {
      gateway = getPayoutGateway();
    } catch (gwErr: any) {
      gatewayInitError = gwErr.message?.includes('PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED')
        ? 'PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED'
        : 'PAYOUT_PROVIDER_NOT_CONFIGURED';
    }

    const results = [];

    for (const payoutId of payoutIds) {
      try {
        // If gateway contract is unverified, fail-closed without fabricating reference
        if (!gateway || gatewayInitError) {
          await supabase.rpc('finalize_merchant_payout_rpc', {
            p_payout_id: payoutId,
            p_provider_reference: 'UNCONFIGURED',
            p_status: 'FAILED',
            p_raw_status: 'BLOCKED',
            p_failure_reason: gatewayInitError || 'PAYOUT_PROVIDER_NOT_CONFIGURED',
          });

          results.push({
            payoutId,
            status: 'FAILED',
            error: gatewayInitError || 'PAYOUT_PROVIDER_NOT_CONFIGURED',
          });
          continue;
        }

        // 1. Decrypt payout secrets via server-only RPC
        const { data: secretData, error: secretErr } = await supabase.rpc(
          'get_payout_processing_secret',
          { p_payout_id: payoutId }
        );

        if (secretErr || !secretData) {
          results.push({
            payoutId,
            status: 'ERROR',
            error: secretErr?.message || 'Failed to retrieve payout secrets.',
          });
          continue;
        }

        // 2. Mark PROCESSING
        await supabase
          .from('merchant_payouts')
          .update({
            status: 'PROCESSING',
            processing_at: new Date().toISOString(),
          })
          .eq('id', payoutId);

        // 3. Disburse via Gateway (NEVER log secretData.account_identifier)
        const disburseResult = await gateway.disburse({
          payoutId: secretData.payout_id,
          settlementId: secretData.settlement_id,
          restaurantId: secretData.restaurant_id,
          amountTzs: secretData.amount_tzs,
          destinationType: secretData.destination_type,
          accountIdentifier: secretData.account_identifier,
          accountName: secretData.account_name,
          idempotencyKey: secretData.idempotency_key,
        });

        // 4. Update status according to authoritative provider response
        if (disburseResult.status === 'SUCCESS') {
          await supabase.rpc('finalize_merchant_payout_rpc', {
            p_payout_id: payoutId,
            p_provider_reference: disburseResult.providerReference,
            p_status: 'SUCCESS',
            p_raw_status: JSON.stringify(disburseResult.rawResponse || {}),
            p_failure_reason: null,
          });

          results.push({
            payoutId,
            status: 'SUCCESS',
            providerReference: disburseResult.providerReference,
          });
        } else if (disburseResult.status === 'FAILED') {
          await supabase.rpc('finalize_merchant_payout_rpc', {
            p_payout_id: payoutId,
            p_provider_reference: disburseResult.providerReference || 'FAILED',
            p_status: 'FAILED',
            p_raw_status: JSON.stringify(disburseResult.rawResponse || {}),
            p_failure_reason: disburseResult.error || 'Disbursement failed at provider',
          });

          results.push({
            payoutId,
            status: 'FAILED',
            error: disburseResult.error,
          });
        } else {
          // Remain in PROCESSING and reconcile later
          await supabase
            .from('merchant_payouts')
            .update({
              provider_reference: disburseResult.providerReference,
              raw_provider_status: JSON.stringify(disburseResult.rawResponse || {}),
            })
            .eq('id', payoutId);

          results.push({
            payoutId,
            status: 'PROCESSING',
            providerReference: disburseResult.providerReference,
          });
        }
      } catch (procErr: any) {
        results.push({
          payoutId,
          status: 'ERROR',
          error: procErr?.message || 'Unexpected processing error',
        });
      }
    }

    return reply(200, {
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (err: any) {
    return reply(500, {
      success: false,
      error: 'SERVER_ERROR',
      message: err?.message || 'Unexpected server error',
    });
  }
});
