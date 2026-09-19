import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  PaymentMethodCode,
  PaymentTransactionEntity,
  PaymentType,
} from '../../db/types';

export interface CreatePaymentRequest {
  orderId?: string;
  reservationId?: string;
  customMealRequestId?: string;
  quoteId?: string;
  methodCode: PaymentMethodCode;
  paymentType: PaymentType;
  payerPhone: string;
  idempotencyKey?: string;
}

export interface PaymentInitiationResult {
  success: boolean;
  paymentId: string;
  providerReference: string;
  merchantReference: string;
  status:
    | 'PENDING'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'CANCELLED'
    | 'REFUNDED';
  amountTzs: number;
  methodCode: PaymentMethodCode;
  carrierName: string;
  ussdCode: string;
  carrierPromptText: string;
  expiresAt: string;
  error?: string;
}

function mapDbStatus(status?: string):
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED' {
  switch ((status || '').toUpperCase()) {
    case 'SUCCESS':
    case 'PAID':
      return 'PAID';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'PROCESSING':
      return 'PROCESSING';
    default:
      return 'PENDING';
  }
}

export class PaymentApi {
  static async createPayment(
    request: CreatePaymentRequest
  ): Promise<PaymentInitiationResult> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Supabase must be configured before production payments can be initiated.'
      );
    }

    const { data, error } = await supabase.functions.invoke(
      'create-payment',
      {
        body: request,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.success) {
      return {
        success: false,
        paymentId: data?.paymentId || '',
        providerReference: '',
        merchantReference: '',
        status: 'FAILED',
        amountTzs: 0,
        methodCode: request.methodCode,
        carrierName: '',
        ussdCode: '',
        carrierPromptText: '',
        expiresAt: '',
        error:
          data?.message ||
          data?.error ||
          'Payment initiation failed.',
      };
    }

    return {
      success: true,
      paymentId: data.paymentId,
      providerReference:
        data.providerReference || data.gatewayReference || '',
      merchantReference: data.merchantReference,
      status: mapDbStatus(data.status),
      amountTzs: Number(data.amountTzs || 0),
      methodCode: request.methodCode,
      carrierName: data.carrierName || '',
      ussdCode: data.ussdCode || '',
      carrierPromptText: data.carrierPromptText || '',
      expiresAt: data.expiresAt || '',
    };
  }

  static async getPaymentStatus(
    paymentId: string
  ): Promise<PaymentTransactionEntity> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.functions.invoke(
      'get-payment-status',
      {
        body: {
          paymentId,
        },
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.success || !data?.payment) {
      throw new Error(
        data?.message ||
          data?.error ||
          'Unable to retrieve payment status.'
      );
    }

    const p = data.payment;
    return {
      id: p.id,
      userId: p.user_id,
      orderId: p.order_id || undefined,
      reservationId: p.reservation_id || undefined,
      restaurantId: p.restaurant_id || undefined,
      restaurantName: p.restaurant_name || '',
      provider: p.provider || 'CLICKPESA',
      providerReference:
        p.provider_reference || p.provider_transaction_id || '',
      providerTransactionId:
        p.provider_transaction_id || undefined,
      merchantReference: p.merchant_reference || undefined,
      amountTzs: Number(p.amount_tzs || 0),
      currency: 'TZS',
      paymentMethod: p.payment_method || 'Mobile Money',
      methodCode: p.method_code || 'MPESA',
      status: mapDbStatus(p.status),
      paymentType: p.payment_type || 'ORDER_FULL',
      payerPhone: p.phone_number || undefined,
      failureReason: p.failure_reason || undefined,
      confirmedAt: p.confirmed_at || undefined,
      paidAt: p.paid_at || undefined,
      refundedAt: p.refunded_at || undefined,
      createdAt: p.created_at || new Date().toISOString(),
      updatedAt: p.updated_at || undefined,
    };
  }
}
