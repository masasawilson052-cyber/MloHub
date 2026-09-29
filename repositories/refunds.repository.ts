import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RefundRequest, RefundStatus, RefundResponsibility } from '../types/domain';
import { AdminPage, AdminPageQuery } from '../types/admin';

export class RefundsRepository {
  private static mapRowToRefundRequest(row: any): RefundRequest {
    return {
      id: row.id,
      paymentId: row.payment_id,
      orderId: row.order_id,
      reservationId: row.reservation_id,
      customMealRequestId: row.custom_meal_request_id,
      customerUserId: row.customer_user_id,
      restaurantId: row.restaurant_id,
      requestedAmountTzs: row.requested_amount_tzs?.toString() || '0',
      approvedAmountTzs: row.approved_amount_tzs?.toString(),
      reasonCode: row.reason_code,
      reasonDetail: row.reason_detail,
      responsibility: row.responsibility,
      status: row.status,
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      providerRefundReference: row.provider_refund_reference,
      completedAt: row.completed_at,
      failureReason: row.failure_reason,
      idempotencyKey: row.idempotency_key,
      affectedItems: row.affected_items || [],
    };
  }

  public static async requestRefund(params: {
    paymentId: string;
    amountTzs: bigint;
    reasonCode: string;
    reasonDetail?: string;
    idempotencyKey: string;
    affectedItems?: any[];
  }): Promise<{ success: boolean; refundRequestId?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('request_refund_secure', {
      p_payment_id: params.paymentId,
      p_requested_amount_tzs: Number(params.amountTzs),
      p_reason_code: params.reasonCode,
      p_reason_detail: params.reasonDetail || '',
      p_idempotency_key: params.idempotencyKey,
      p_affected_items: params.affectedItems || [],
    });

    if (error) {
      console.error('[RefundsRepository.requestRefund] Error:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success ?? true,
      refundRequestId: data?.refund_request_id,
    };
  }

  public static async approveRefund(params: {
    refundRequestId: string;
    approvedAmountTzs: bigint;
    responsibility: RefundResponsibility;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('approve_refund_secure', {
      p_refund_request_id: params.refundRequestId,
      p_approved_amount_tzs: Number(params.approvedAmountTzs),
      p_responsibility: params.responsibility,
    });

    if (error) {
      console.error('[RefundsRepository.approveRefund] Error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  }

  public static async listByCustomer(customerId: string): Promise<RefundRequest[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('customer_user_id', customerId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error(`[RefundsRepository.listByCustomer] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToRefundRequest);
  }

  public static async listByRestaurant(restaurantId: string): Promise<RefundRequest[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error(`[RefundsRepository.listByRestaurant] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToRefundRequest);
  }

  public static async listAll(limit: number = 100): Promise<RefundRequest[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('refund_requests')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[RefundsRepository.listAll] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToRefundRequest);
  }

  public static async listAdminPage(query: AdminPageQuery = {}): Promise<AdminPage<RefundRequest>> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const pageSize = Math.min(100, Math.max(10, query.pageSize || 50));
    const page = Math.max(1, query.page || 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let qb = supabase
      .from('refund_requests')
      .select('*', { count: 'exact' });

    if (query.status && query.status !== 'ALL') {
      qb = qb.eq('status', query.status);
    }
    if (query.restaurantId && query.restaurantId !== 'ALL') {
      qb = qb.eq('restaurant_id', query.restaurantId);
    }
    if (query.from) {
      qb = qb.gte('requested_at', query.from);
    }
    if (query.to) {
      qb = qb.lte('requested_at', query.to);
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      qb = qb.or(`id.ilike.%${term}%,reason_code.ilike.%${term}%,reason_detail.ilike.%${term}%`);
    }

    const { data, error, count } = await qb
      .order('requested_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[RefundsRepository.listAdminPage] Error:', error.message);
      throw new Error(`Unable to load refund requests: ${error.message}`);
    }

    return {
      items: (data || []).map(this.mapRowToRefundRequest),
      page,
      pageSize,
      total: count || 0,
      hasNext: from + (data?.length || 0) < (count || 0),
    };
  }
}

