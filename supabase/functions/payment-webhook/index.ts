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

    if (
      verification.status !== 'PAID'
    ) {
      const {
        data: payment,
      } = await adminClient
        .from('payments')
        .select('id')
        .eq(
          'merchant_reference',
          verification.merchantReference
        )
        .maybeSingle();

      if (payment) {
        const dbStatus =
          verification.status === 'CANCELLED'
            ? 'CANCELLED'
            : verification.status === 'FAILED'
            ? 'FAILED'
            : 'PENDING';

        await adminClient
          .from('payments')
          .update({
            status: dbStatus,
            failed_at:
              dbStatus === 'FAILED'
                ? new Date().toISOString()
                : null,
          })
          .eq('id', payment.id);

        await adminClient
          .from('payment_events')
          .insert({
            payment_id: payment.id,
            event_id: verification.eventId,
            event_type: `PAYMENT_${dbStatus}`,
            provider: verification.provider,
            status: dbStatus,
            amount_tzs: verification.amountTzs,
            merchant_reference:
              verification.merchantReference,
            provider_reference:
              verification.gatewayReference,
            raw_payload: verification.rawPayload,
            actor_type: 'GATEWAY_WEBHOOK',
          });
      }

      return response(200, {
        success: true,
        processed: true,
        status: verification.status,
      });
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
