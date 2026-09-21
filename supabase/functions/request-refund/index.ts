import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { success: false, error: 'METHOD_NOT_ALLOWED' });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return reply(401, { success: false, error: 'UNAUTHORIZED' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return reply(500, { success: false, error: 'SERVER_CONFIGURATION_ERROR' });
    }

    // Validate the user's JWT
    const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: auth } },
    });

    const { data: { user }, error: userErr } = await authClient.auth.getUser(auth.slice(7));
    if (userErr || !user) return reply(401, { success: false, error: 'INVALID_SESSION' });

    // Privileged admin client (service role — bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { paymentId, amountTzs, reason = 'Admin-initiated refund' } = body;

    if (!paymentId || typeof paymentId !== 'string') {
      return reply(400, {
        success: false,
        error: 'INVALID_PAYMENT_ID',
        message: 'Valid paymentId is required.',
      });
    }

    const refundAmount = Number(amountTzs);
    if (!Number.isSafeInteger(refundAmount) || refundAmount <= 0) {
      return reply(400, {
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Refund amount must be a positive integer in TZS.',
      });
    }

    // Deterministic idempotency key: admin + payment + amount + day
    const today = new Date().toISOString().split('T')[0];
    const idempotencyKey = `admin_refund_${paymentId}_${refundAmount}_${user.id.substring(0, 8)}_${today}`;

    // Delegate ALL validation, cumulative-limit checks, and insertion to the
    // canonical authoritative RPC. This is the SINGLE refund-creation authority
    // for admin-initiated refunds. Direct inserts into refund_requests are
    // explicitly NOT used here to avoid split authority.
    const { data: rpcResult, error: rpcErr } = await adminClient.rpc(
      'request_refund_admin_secure',
      {
        p_payment_id:            paymentId,
        p_requested_amount_tzs:  refundAmount,
        p_reason_code:           'ADMIN_INITIATED',
        p_reason_detail:         String(reason).trim().substring(0, 500),
        p_idempotency_key:       idempotencyKey,
        p_admin_user_id:         user.id,
        p_affected_items:        [],
      }
    );

    if (rpcErr) {
      console.error('request_refund_admin_secure RPC error:', rpcErr);

      // Map known SQL exceptions to HTTP status codes
      if (rpcErr.message?.includes('403')) {
        return reply(403, { success: false, error: 'ADMIN_REQUIRED', message: rpcErr.message });
      }
      if (rpcErr.message?.includes('404')) {
        return reply(404, { success: false, error: 'PAYMENT_NOT_FOUND', message: rpcErr.message });
      }
      if (rpcErr.message?.includes('400')) {
        return reply(400, { success: false, error: 'REFUND_REJECTED', message: rpcErr.message });
      }
      return reply(500, { success: false, error: 'REFUND_RECORDING_FAILED', message: rpcErr.message });
    }

    if (!rpcResult?.success) {
      return reply(500, { success: false, error: 'REFUND_RECORDING_FAILED', message: 'RPC returned unsuccessfully.' });
    }

    return reply(200, {
      success: true,
      refundRequestId: rpcResult.refund_request_id,
      status:          rpcResult.status,
      amountTzs:       refundAmount,
      idempotent:      rpcResult.idempotent ?? false,
      operationalQueue: true,
      message:
        'Refund request queued in refund_requests. Authorize in ClickPesa merchant console and call approve_refund_secure to complete settlement.',
    });
  } catch (err: any) {
    console.error('request-refund error:', err);
    return reply(500, {
      success: false,
      error: 'REFUND_SERVICE_ERROR',
      message: err?.message || 'Unexpected server error',
    });
  }
});
