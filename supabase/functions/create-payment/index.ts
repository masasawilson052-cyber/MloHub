import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { PaymentGatewayFactory } from '../_shared/payments/PaymentGatewayFactory.ts';
import type {
  PaymentMethodCode,
  PaymentType,
} from '../_shared/payments/paymentTypes.ts';

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

function dbPaymentMethod(method: PaymentMethodCode): string {
  switch (method) {
    case 'MPESA':
      return 'M_PESA';
    case 'AIRTEL_MONEY':
      return 'AIRTEL_MONEY';
    case 'MIXX_BY_YAS':
      return 'MIXX_BY_YAS';
    case 'HALOPESA':
      return 'HALOPESA';
    case 'CARD':
      return 'CARD';
    default:
      throw new Error(
        `Unsupported gateway payment method: ${method}`
      );
  }
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return response(500, {
        success: false,
        error: 'SERVER_CONFIGURATION_ERROR',
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return response(401, {
        success: false,
        error: 'UNAUTHORIZED',
      });
    }

    const token = authHeader.substring('Bearer '.length);
    const userClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return response(401, {
        success: false,
        error: 'INVALID_SESSION',
      });
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const body = await req.json();
    const {
      orderId,
      reservationId,
      customMealRequestId,
      quoteId,
      methodCode,
      paymentType = 'ORDER_FULL',
      payerPhone,
      idempotencyKey,
    } = body as {
      orderId?: string;
      reservationId?: string;
      customMealRequestId?: string;
      quoteId?: string;
      methodCode?: PaymentMethodCode;
      paymentType?: PaymentType;
      payerPhone?: string;
      idempotencyKey?: string;
    };

    if (!methodCode || !payerPhone) {
      return response(400, {
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
      });
    }

    if (methodCode === 'CASH_ON_DELIVERY') {
      return response(400, {
        success: false,
        error: 'CASH_NOT_GATEWAY_PAYMENT',
      });
    }

    const targetCount = [
      Boolean(orderId),
      Boolean(reservationId),
      Boolean(customMealRequestId && quoteId),
    ].filter(Boolean).length;

    if (targetCount !== 1) {
      return response(400, {
        success: false,
        error: 'EXACTLY_ONE_PAYMENT_TARGET_REQUIRED',
      });
    }

    if (idempotencyKey) {
      const {
        data: existing,
      } = await adminClient
        .from('payments')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existing) {
        return response(200, {
          success: true,
          paymentId: existing.id,
          providerReference: existing.provider_reference,
          merchantReference: existing.merchant_reference,
          status: existing.status,
          amountTzs: existing.amount_tzs,
        });
      }
    }

    let restaurantId = '';
    let restaurantName = '';
    let amountTzs = 0;
    let commissionBaseTzs = 0;

    if (orderId) {
      const {
        data: order,
        error,
      } = await adminClient
        .from('orders')
        .select(
          `
          id,
          user_id,
          restaurant_id,
          total_tzs,
          subtotal_tzs,
          payment_status,
          restaurants(name)
        `
        )
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();

      if (error || !order) {
        return response(404, {
          success: false,
          error: 'ORDER_NOT_FOUND',
        });
      }

      if (
        order.payment_status === 'SUCCESS' ||
        order.payment_status === 'REFUNDED'
      ) {
        return response(409, {
          success: false,
          error: 'ORDER_ALREADY_FINALIZED',
        });
      }

      restaurantId = order.restaurant_id;
      restaurantName = (order.restaurants as any)?.name || '';
      amountTzs = Number(order.total_tzs);
      commissionBaseTzs = Number(order.subtotal_tzs);
    }

    if (reservationId) {
      const {
        data: reservation,
        error,
      } = await adminClient
        .from('reservations')
        .select(
          `
          id,
          user_id,
          restaurant_id,
          deposit_amount_tzs,
          is_deposit_paid,
          restaurants(name)
        `
        )
        .eq('id', reservationId)
        .eq('user_id', user.id)
        .single();

      if (error || !reservation) {
        return response(404, {
          success: false,
          error: 'RESERVATION_NOT_FOUND',
        });
      }

      if (reservation.is_deposit_paid) {
        return response(409, {
          success: false,
          error: 'RESERVATION_ALREADY_PAID',
        });
      }

      amountTzs = Number(reservation.deposit_amount_tzs || 0);
      if (amountTzs <= 0) {
        return response(409, {
          success: false,
          error: 'RESERVATION_DEPOSIT_NOT_CONFIGURED',
        });
      }

      restaurantId = reservation.restaurant_id;
      restaurantName = (reservation.restaurants as any)?.name || '';
      commissionBaseTzs = 0;
    }

    if (customMealRequestId && quoteId) {
      const {
        data: request,
        error: requestError,
      } = await adminClient
        .from('custom_meal_requests')
        .select(
          `
          id,
          user_id,
          accepted_quote_id
        `
        )
        .eq('id', customMealRequestId)
        .eq('user_id', user.id)
        .single();

      if (requestError || !request) {
        return response(404, {
          success: false,
          error: 'CUSTOM_MEAL_NOT_FOUND',
        });
      }

      if (
        request.accepted_quote_id !== quoteId
      ) {
        return response(409, {
          success: false,
          error: 'QUOTE_NOT_ACCEPTED',
        });
      }

      const {
        data: quote,
        error: quoteError,
      } = await adminClient
        .from('restaurant_quotes')
        .select(
          `
          id,
          request_id,
          restaurant_id,
          quoted_price_tzs,
          status,
          restaurants(name)
        `
        )
        .eq('id', quoteId)
        .eq(
          'request_id',
          customMealRequestId
        )
        .single();

      if (
        quoteError ||
        !quote ||
        quote.status !== 'ACCEPTED'
      ) {
        return response(409, {
          success: false,
          error: 'QUOTE_NOT_PAYABLE',
        });
      }

      amountTzs = Number(quote.quoted_price_tzs);
      commissionBaseTzs = amountTzs;
      restaurantId = quote.restaurant_id;
      restaurantName = (quote.restaurants as any)?.name || '';
    }

    if (
      !restaurantId ||
      !Number.isFinite(amountTzs) ||
      amountTzs <= 0
    ) {
      return response(400, {
        success: false,
        error: 'INVALID_AUTHORITATIVE_AMOUNT',
      });
    }

    const {
      data: feeRule,
    } = await adminClient
      .from('platform_fee_rules')
      .select('commission_rate')
      .eq('is_active', true)
      .order('effective_from', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    const commissionRate = Number(feeRule?.commission_rate ?? 0.1);
    const platformCommissionTzs = Math.round(
      commissionBaseTzs * commissionRate
    );
    const netRestaurantPayoutTzs = Math.max(
      0,
      commissionBaseTzs - platformCommissionTzs
    );

    const paymentId = `pay_${crypto.randomUUID()}`;
    const merchantReference = `MH${Date.now()
      .toString()
      .slice(-10)}${Math.floor(
      Math.random() * 90 + 10
    )}`;

    const {
      error: insertError,
    } = await adminClient
      .from('payments')
      .insert({
        id: paymentId,
        order_id: orderId || null,
        reservation_id: reservationId || null,
        custom_meal_request_id: customMealRequestId || null,
        quote_id: quoteId || null,
        user_id: user.id,
        restaurant_id: restaurantId,
        amount_tzs: amountTzs,
        platform_commission_tzs: platformCommissionTzs,
        net_restaurant_payout_tzs: netRestaurantPayoutTzs,
        payment_method: dbPaymentMethod(methodCode),
        method_code: methodCode,
        payment_type: paymentType,
        phone_number: payerPhone,
        status: 'PENDING',
        merchant_reference: merchantReference,
        idempotency_key: idempotencyKey || null,
        metadata: {
          commission_rate_snapshot: commissionRate,
          restaurant_name: restaurantName,
        },
      });

    if (insertError) {
      console.error(insertError);
      return response(500, {
        success: false,
        error: 'PAYMENT_RECORD_CREATE_FAILED',
      });
    }

    const gateway = PaymentGatewayFactory.getGateway();
    const gatewayResult = await gateway.initiateUssdPush({
      amount: amountTzs,
      currency: 'TZS',
      orderReference: merchantReference,
      phoneNumber: payerPhone,
      methodCode,
      paymentType,
      description: `MloHub ${restaurantName}`.slice(
        0,
        100
      ),
      metadata: {
        paymentId,
      },
    });

    if (!gatewayResult.success) {
      await adminClient
        .from('payments')
        .update({
          status: 'FAILED',
          failed_at: new Date().toISOString(),
          failure_reason: gatewayResult.error || 'Gateway initiation failed',
        })
        .eq('id', paymentId);

      await adminClient
        .from('payment_events')
        .insert({
          payment_id: paymentId,
          event_id: `init_fail_${crypto.randomUUID()}`,
          event_type: 'PAYMENT_INITIATION_FAILED',
          provider: gatewayResult.provider,
          status: 'FAILED',
          amount_tzs: amountTzs,
          merchant_reference: merchantReference,
          provider_reference: gatewayResult.gatewayReference || null,
          actor_type: 'SYSTEM',
        });

      return response(502, {
        success: false,
        paymentId,
        error: 'GATEWAY_INITIATION_FAILED',
        message: gatewayResult.error || 'Unable to initiate payment.',
      });
    }

    await adminClient
      .from('payments')
      .update({
        provider: gatewayResult.provider.toUpperCase(),
        provider_reference: gatewayResult.gatewayReference,
        provider_transaction_id: gatewayResult.gatewayReference,
      })
      .eq('id', paymentId);

    await adminClient
      .from('payment_events')
      .insert({
        payment_id: paymentId,
        event_id: `init_${crypto.randomUUID()}`,
        event_type: 'PAYMENT_INITIATED',
        provider: gatewayResult.provider,
        status: 'PENDING',
        amount_tzs: amountTzs,
        merchant_reference: merchantReference,
        provider_reference: gatewayResult.gatewayReference,
        actor_type: 'CUSTOMER',
        actor_id: user.id,
      });

    return response(200, {
      success: true,
      paymentId,
      provider: gatewayResult.provider,
      providerReference: gatewayResult.gatewayReference,
      merchantReference,
      status: 'PENDING',
      amountTzs,
      carrierName: gatewayResult.carrierName,
      ussdCode: gatewayResult.ussdCode,
      carrierPromptText: gatewayResult.carrierPromptText,
      expiresAt: gatewayResult.expiresAt,
    });
  } catch (error) {
    console.error(error);
    return response(500, {
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});
