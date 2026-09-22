import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { PaymentGatewayFactory } from '../_shared/payments/PaymentGatewayFactory.ts';

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
      }),
      {
        status: 405,
        headers: jsonHeaders,
      }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'UNAUTHORIZED',
        }),
        {
          status: 401,
          headers: jsonHeaders,
        }
      );
    }

    const {
      paymentId,
    } = await req.json();

    if (!paymentId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PAYMENT_ID_REQUIRED',
        }),
        {
          status: 400,
          headers: jsonHeaders,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Payment status recovery is not configured.');
    }

    const userClient = createClient(
      supabaseUrl,
      anonKey || serviceRoleKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const token = authHeader.replace(
      'Bearer ',
      ''
    );
    const {
      data: { user },
    } = await userClient.auth.getUser(
      token
    );

    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'INVALID_SESSION',
        }),
        {
          status: 401,
          headers: jsonHeaders,
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: payment, error } = await adminClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', user.id)
      .single();

    if (error || !payment) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PAYMENT_NOT_FOUND',
        }),
        {
          status: 404,
          headers: jsonHeaders,
        }
      );
    }

    if (payment.status === 'PENDING' || payment.status === 'PROCESSING') {
      const paymentAgeMs = Date.now() - new Date(payment.created_at || payment.updated_at || 0).getTime();
      if (paymentAgeMs < 30_000) {
        return new Response(JSON.stringify({ success: true, payment, reconciled: false, recoveryEligibleAt: new Date(Date.now() + (30_000 - paymentAgeMs)).toISOString() }), {
          status: 200,
          headers: jsonHeaders,
        });
      }
      if (!payment.provider_reference || !payment.merchant_reference) {
        return new Response(JSON.stringify({ success: false, error: 'PAYMENT_PROVIDER_REFERENCE_MISSING' }), {
          status: 409,
          headers: jsonHeaders,
        });
      }
      const gateway = PaymentGatewayFactory.getGateway(String(payment.provider || 'clickpesa').toLowerCase() as any);
      const providerStatus = await gateway.queryStatus(
        payment.provider_reference || '',
        payment.merchant_reference || ''
      );

      if (providerStatus.status === 'PAID') {
        if (providerStatus.amountTzs !== Number(payment.amount_tzs)) {
          return new Response(JSON.stringify({ success: false, error: 'PAYMENT_AMOUNT_MISMATCH' }), {
            status: 409,
            headers: jsonHeaders,
          });
        }

        const { error: confirmError } = await adminClient.rpc('confirm_payment_webhook_rpc', {
          p_merchant_reference: payment.merchant_reference,
          p_gateway_reference: providerStatus.gatewayReference,
          p_provider: String(payment.provider || 'clickpesa').toLowerCase(),
          p_collected_amount: providerStatus.amountTzs,
          p_event_id: `recovery_${payment.id}_${providerStatus.gatewayReference}`,
          p_raw_payload: {
            source: 'get-payment-status',
            provider: payment.provider,
            provider_status: providerStatus.rawResponse,
          },
        });

        if (confirmError) throw confirmError;
      } else if (providerStatus.status === 'FAILED' || providerStatus.status === 'CANCELLED') {
        const { error: updateError } = await adminClient
          .from('payments')
          .update({ status: providerStatus.status, updated_at: new Date().toISOString() })
          .eq('id', payment.id)
          .in('status', ['PENDING', 'PROCESSING']);
        if (updateError) throw updateError;
      }

      const { data: reconciledPayment, error: reconciledError } = await adminClient
        .from('payments')
        .select('*')
        .eq('id', payment.id)
        .single();
      if (reconciledError) throw reconciledError;
      return new Response(
        JSON.stringify({ success: true, payment: reconciledPayment, reconciled: true }),
        {
          status: 200,
          headers: jsonHeaders,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'PAYMENT_STATUS_FAILED',
      }),
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }
});
