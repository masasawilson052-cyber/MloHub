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

    // Privileged admin client for read/write without RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin role
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, roles, full_name')
      .eq('id', user.id)
      .single();
    const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : [profile?.role || ''];
    const isAdmin =
      profile?.role === 'ADMIN' ||
      profile?.role === 'SUPER_ADMIN' ||
      roles.includes('ADMIN') ||
      roles.includes('SUPER_ADMIN');

    if (!isAdmin) {
      return reply(403, {
        success: false,
        error: 'ADMIN_REQUIRED',
        message: 'Administrator authority required to request refunds.',
      });
    }

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

    // Lookup payment from canonical payments table
    const { data: payment, error: payErr } = await adminClient
      .from('payments')
      .select('id, amount_tzs, status, order_id, reservation_id, user_id, restaurant_id, provider, merchant_reference, provider_reference')
      .eq('id', paymentId)
      .maybeSingle();

    if (payErr || !payment) {
      return reply(404, { success: false, error: 'PAYMENT_NOT_FOUND', message: 'Payment record not found.' });
    }

    const paymentStatus = String(payment.status).toUpperCase();
    if (!['PAID', 'CAPTURED', 'SUCCESS'].includes(paymentStatus)) {
      return reply(400, {
        success: false,
        error: 'PAYMENT_NOT_REFUNDABLE',
        message: `Payment status is '${payment.status}'. Only completed payments can be refunded.`,
      });
    }

    // Check cumulative refunds already requested/approved in refund_requests (canonical table)
    const { data: existingRequests } = await adminClient
      .from('refund_requests')
      .select('requested_amount_tzs, status')
      .eq('payment_id', paymentId)
      .in('status', ['REQUESTED', 'APPROVED', 'PROVIDER_PROCESSING', 'REFUNDED', 'PARTIALLY_REFUNDED']);

    const alreadyRefunded = (existingRequests || []).reduce(
      (sum: number, r: any) => sum + Number(r.requested_amount_tzs || 0),
      0
    );

    const maxRefundable = Number(payment.amount_tzs) - alreadyRefunded;
    if (refundAmount > maxRefundable) {
      return reply(400, {
        success: false,
        error: 'EXCEEDS_REFUNDABLE_BALANCE',
        message: `Maximum refundable balance is ${maxRefundable} TZS (already requested/refunded: ${alreadyRefunded} TZS).`,
      });
    }

    // Idempotency key: deterministic for same admin + payment + amount + day
    const today = new Date().toISOString().split('T')[0];
    const idempotencyKey = `admin_refund_${paymentId}_${refundAmount}_${user.id.substring(0, 8)}_${today}`;

    // Check idempotency — return existing request if already submitted today
    const { data: existingIdempotent } = await adminClient
      .from('refund_requests')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingIdempotent) {
      return reply(200, {
        success: true,
        refundRequestId: existingIdempotent.id,
        status: existingIdempotent.status,
        amountTzs: refundAmount,
        idempotent: true,
        message: 'Refund request already exists for this operation today (idempotent).',
      });
    }

    // Insert into canonical refund_requests table (bypassing RLS with service role)
    const { data: newRequest, error: insertErr } = await adminClient
      .from('refund_requests')
      .insert({
        payment_id: paymentId,
        order_id: payment.order_id || null,
        reservation_id: payment.reservation_id || null,
        customer_user_id: payment.user_id || null,
        restaurant_id: payment.restaurant_id || null,
        requested_amount_tzs: refundAmount,
        reason_code: 'ADMIN_INITIATED',
        reason_detail: String(reason).trim().substring(0, 500),
        status: 'REQUESTED',
        requested_by: user.id,
        idempotency_key: idempotencyKey,
        affected_items: [],
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Error inserting refund_request:', insertErr);
      return reply(500, { success: false, error: 'REFUND_RECORDING_FAILED', message: insertErr.message });
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      admin_user_id: user.id,
      action: 'REQUEST_ADMIN_REFUND',
      target_type: 'PAYMENT',
      target_id: paymentId,
      details: {
        refund_request_id: newRequest.id,
        idempotency_key: idempotencyKey,
        amount_tzs: refundAmount,
        reason: String(reason).trim(),
        payment_merchant_reference: payment.merchant_reference,
        payment_provider_reference: payment.provider_reference,
        requested_by_email: user.email,
        requested_by_name: profile?.full_name,
        merchant_action_required:
          'Authorize refund in ClickPesa merchant console, then use approve_refund_secure RPC with the provider settlement reference.',
      },
    });

    return reply(200, {
      success: true,
      refundRequestId: newRequest.id,
      status: 'REQUESTED',
      amountTzs: refundAmount,
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
