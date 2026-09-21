import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { PaymentGatewayFactory } from '../_shared/payments/PaymentGatewayFactory.ts';

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

function response(
  status: number,
  body: Record<string, unknown>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return response(405, {
      success: false,
      error: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    const rawBody = await req.text();
    const headers: Record<string, string | undefined> = {};
    req.headers.forEach(
      (value, key) => {
        headers[key.toLowerCase()] = value;
      }
    );

    const gateway = PaymentGatewayFactory.getGateway();
    const verification = await gateway.verifyWebhook(
      rawBody,
      headers
    );

    if (!verification.isValid) {
      console.warn(
        'Rejected invalid payment webhook.'
      );
      return response(401, {
        success: false,
        error: 'INVALID_WEBHOOK',
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get(
      'SUPABASE_SERVICE_ROLE_KEY'
    );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return response(500, {
        success: false,
        error: 'SERVER_CONFIGURATION_ERROR',
      });
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {data: payment, error: lookupError} = await adminClient.from('payments').select('*').eq('merchant_reference', verification.merchantReference).maybeSingle();
    if (lookupError) return response(503, {success:false,error:'PAYMENT_LOOKUP_FAILED'});
    if (!payment) return response(404, {success:false,error:'PAYMENT_NOT_FOUND'});
    if (String(payment.provider).toLowerCase() !== verification.provider || (payment.provider_reference && payment.provider_reference !== verification.gatewayReference)) return response(409,{success:false,error:'PAYMENT_REFERENCE_MISMATCH'});
    if (verification.status === 'PAID' && (verification.currency !== 'TZS' || Number(payment.amount_tzs) !== verification.amountTzs)) return response(409,{success:false,error:'PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH'});
    if (verification.status !== 'PAID') {
      // A delayed failure callback must never reverse a confirmed payment.
      if (payment.status !== 'PENDING') return response(200,{success:true,ignored:true});
      const {error: updateError} = await adminClient.from('payments').update({status:'FAILED',failed_at:new Date().toISOString()}).eq('id',payment.id).eq('status','PENDING');
      if(updateError) return response(503,{success:false,error:'PAYMENT_UPDATE_FAILED'});
      return response(200,{success:true,processed:true,status:'FAILED'});
    }

    const {
      data: result,
      error: rpcError,
    } = await adminClient.rpc(
      'confirm_payment_webhook_rpc',
      {
        p_merchant_reference:
          verification.merchantReference,
        p_gateway_reference:
          verification.gatewayReference,
        p_provider: verification.provider,
        p_collected_amount:
          verification.amountTzs,
        p_event_id: verification.eventId,
        p_raw_payload: verification.rawPayload,
      }
    );

    if (rpcError) {
      console.error(
        'Payment confirmation RPC failed:',
        rpcError
      );
      return response(500, {
        success: false,
        error: 'PAYMENT_CONFIRMATION_FAILED',
      });
    }

    if (result?.success === false) return response(409, {success:false,error:result.error || 'PAYMENT_REJECTED'});
    return response(200, {
      success: true,
      result,
    });
  } catch (error) {
    console.error(error);
    return response(500, {
      success: false,
      error: 'WEBHOOK_PROCESSING_FAILED',
    });
  }
});
