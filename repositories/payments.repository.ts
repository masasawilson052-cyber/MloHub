import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Payment, PaymentStatus } from '../types/domain';
import { PaymentGatewayProvider } from '../db/types';
import { AdminPage, AdminPageQuery } from '../types/admin';

export class PaymentRepository {
  public static async createForOrder(params: {
    orderId: string;
    methodCode: 'MPESA' | 'AIRTEL_MONEY' | 'MIXX_BY_YAS' | 'HALOPESA';
    payerPhone: string;
    idempotencyKey: string;
  }): Promise<{ success: boolean; paymentId?: string; status?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        orderId: params.orderId,
        methodCode: params.methodCode,
        payerPhone: params.payerPhone,
        idempotencyKey: params.idempotencyKey,
      },
    });

    if (error) throw new Error(`Failed to start payment: ${error.message}`);
    return {
      success: data?.success === true,
      paymentId: data?.paymentId,
      status: data?.status,
      error: data?.success === true ? undefined : data?.error || 'Payment was not accepted.',
    };
  }

  private static mapRowToPayment(row: any): Payment {
    return {
      id: row.id,
      orderId: row.order_id,
      reservationId: row.reservation_id,
      customerId: row.user_id,
      restaurantId: row.restaurant_id,
      provider: (row.provider || 'UNKNOWN') as PaymentGatewayProvider,
      externalReference: row.provider_reference,
      providerTransactionId: row.provider_transaction_id,
      amountTzs: row.amount_tzs || 0,
      platformCommissionTzs: row.platform_commission_tzs || 0,
      netRestaurantPayoutTzs: row.net_restaurant_payout_tzs || 0,
      currency: 'TZS',
      paymentMethod: row.payment_method || 'M_PESA',
      phoneNumber: row.phone_number || '',
      status: row.status || 'PENDING',
      idempotencyKey: row.idempotency_key,
      webhookVerified: row.webhook_verified ?? false,
      paidAt: row.paid_at,
      refundedAt: row.refunded_at,
      merchantReference: row.merchant_reference || row.metadata?.merchantReference,
      failureReason: row.failure_reason || row.metadata?.failureReason,
      metadata: row.metadata || {},
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  public static async createRecord(payment: Partial<Payment>): Promise<Payment> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      id: payment.id || `pay_${Date.now()}`,
      order_id: payment.orderId,
      reservation_id: payment.reservationId,
      user_id: payment.customerId,
      restaurant_id: payment.restaurantId,
      amount_tzs: payment.amountTzs || 0,
      platform_commission_tzs: payment.platformCommissionTzs || 0,
      net_restaurant_payout_tzs: payment.netRestaurantPayoutTzs || (payment.amountTzs || 0),
      payment_method: payment.paymentMethod || 'M_PESA',
      phone_number: payment.phoneNumber || '',
      status: payment.status || 'PENDING',
      provider: payment.provider || 'UNKNOWN',
      provider_reference: payment.externalReference,
      idempotency_key: payment.idempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      metadata: payment.metadata || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('payments')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('PaymentRepository.createRecord error:', error.message);
      throw new Error(`Failed to create payment record: ${error.message}`);
    }

    return this.mapRowToPayment(data);
  }

  public static async listByRestaurant(restaurantId: string): Promise<Payment[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`PaymentRepository.listByRestaurant(${restaurantId}) error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToPayment);
  }

  public static async listByCustomer(customerId: string): Promise<Payment[]> {
    if (!isSupabaseConfigured() || !customerId) return [];

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`PaymentRepository.listByCustomer(${customerId}) error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToPayment);
  }

  public static async listAll(filter?: {
    restaurantId?: string;
    status?: string;
    limit?: number;
  }): Promise<Payment[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    let query = supabase.from('payments').select('*');
    if (filter?.restaurantId) {
      query = query.eq('restaurant_id', filter.restaurantId);
    }
    if (filter?.status && filter.status !== 'ALL') {
      query = query.eq('status', filter.status);
    }
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filter?.limit || 100);

    if (error) {
      console.error('PaymentRepository.listAll error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToPayment);
  }

  public static async getById(id: string): Promise<Payment | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`PaymentRepository.getById(${id}) error:`, error.message);
      throw new Error(`Failed to load payment: ${error.message}`);
    }

    return data ? this.mapRowToPayment(data) : null;
  }

  public static async getByOrderId(orderId: string): Promise<Payment[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`PaymentRepository.getByOrderId(${orderId}) error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToPayment);
  }

  public static async updateStatus(
    id: string,
    status: PaymentStatus,
    extra?: { providerReference?: string; providerTransactionId?: string; metadata?: any }
  ): Promise<Payment> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'SUCCESS') updates.paid_at = new Date().toISOString();
    if (status === 'REFUNDED') updates.refunded_at = new Date().toISOString();
    if (extra?.providerReference) updates.provider_reference = extra.providerReference;
    if (extra?.providerTransactionId) updates.provider_transaction_id = extra.providerTransactionId;
    if (extra?.metadata) updates.metadata = extra.metadata;

    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`PaymentRepository.updateStatus(${id}) error:`, error.message);
      throw new Error(`Failed to update payment status: ${error.message}`);
    }

    return this.mapRowToPayment(data);
  }

  public static async listAdminPage(query: AdminPageQuery = {}): Promise<AdminPage<Payment>> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const pageSize = Math.min(100, Math.max(10, query.pageSize || 50));
    const page = Math.max(1, query.page || 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let qb = supabase
      .from('payments')
      .select('*', { count: 'exact' });

    if (query.status && query.status !== 'ALL') {
      if (query.status === 'CAPTURED') {
        qb = qb.in('status', ['SUCCESS', 'CAPTURED', 'PAID']);
      } else if (query.status === 'FAILED') {
        qb = qb.in('status', ['FAILED', 'CANCELLED']);
      } else {
        qb = qb.eq('status', query.status);
      }
    }
    if (query.restaurantId && query.restaurantId !== 'ALL') {
      qb = qb.eq('restaurant_id', query.restaurantId);
    }
    if (query.provider && query.provider !== 'ALL') {
      qb = qb.eq('provider', query.provider);
    }
    if (query.from) {
      qb = qb.gte('created_at', query.from);
    }
    if (query.to) {
      qb = qb.lte('created_at', query.to);
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      qb = qb.or(`id.ilike.%${term}%,provider_reference.ilike.%${term}%,phone_number.ilike.%${term}%`);
    }

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[PaymentRepository.listAdminPage] Error:', error.message);
      throw new Error(`Unable to load payments: ${error.message}`);
    }

    return {
      items: (data || []).map(this.mapRowToPayment),
      page,
      pageSize,
      total: count || 0,
      hasNext: from + (data?.length || 0) < (count || 0),
    };
  }
}

