/**
 * Supabase Edge Function: request-refund
 * Admin-Authorized Mobile Money Refund Dispatch
 */

import { corsHeaders } from '../_shared/cors';
import { PaymentGatewayFactory } from '../_shared/payments/PaymentGatewayFactory';

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { paymentId, gatewayReference, merchantReference, amountTzs, reason, adminUserId } = body;

    if (!paymentId || !gatewayReference || !amountTzs || !adminUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MISSING_FIELDS',
          message: 'paymentId, gatewayReference, amountTzs, and adminUserId are required.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gateway = PaymentGatewayFactory.getGateway();
    const refundResult = await gateway.refund({
      paymentId,
      gatewayReference,
      merchantReference: merchantReference || '',
      amountTzs: Number(amountTzs),
      reason: reason || 'Admin authorized cancellation refund',
      adminUserId,
    });

    return new Response(
      JSON.stringify({
        success: refundResult.success,
        refundReference: refundResult.refundReference,
        amountTzs: refundResult.amountTzs,
        status: refundResult.status,
        message: refundResult.message,
      }),
      { status: refundResult.success ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'REFUND_DISPATCH_FAILED',
        message: err.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
