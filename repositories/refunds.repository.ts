import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RefundRequest, RefundStatus, RefundResponsibility } from '../types/domain';

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

  public static async getById(id: string): Promise<RefundRequest | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return this.mapRowToRefundRequest(data);
  }
}
