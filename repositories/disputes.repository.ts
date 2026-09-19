import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  FinancialDispute,
  FinancialDisputeType,
  FinancialDisputeStatus,
  FinancialDisputeEvidence,
} from '../types/domain';

export class DisputesRepository {
  private static mapRowToDispute(row: any): FinancialDispute {
    return {
      id: row.id,
      disputeType: row.dispute_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      customerUserId: row.customer_user_id,
      restaurantId: row.restaurant_id,
      refundRequestId: row.refund_request_id,
      paymentId: row.payment_id,
      settlementId: row.settlement_id,
      disputedAmountTzs: row.disputed_amount_tzs?.toString() || '0',
      openedBy: row.opened_by,
      reasonCode: row.reason_code,
      description: row.description,
      status: row.status,
      openedAt: row.opened_at,
      evidenceDeadlineAt: row.evidence_deadline_at,
      assignedAdmin: row.assigned_admin,
      resolvedAt: row.resolved_at,
      resolution: row.resolution,
      financialAdjustmentId: row.financial_adjustment_id,
    };
  }

  public static async openDispute(params: {
    disputeType: FinancialDisputeType;
    entityType: string;
    entityId: string;
    restaurantId: string;
    disputedAmountTzs: bigint;
    reasonCode: string;
    description: string;
    refundRequestId?: string;
    paymentId?: string;
  }): Promise<{ success: boolean; disputeId?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('open_financial_dispute_secure', {
      p_dispute_type: params.disputeType,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_restaurant_id: params.restaurantId,
      p_disputed_amount_tzs: Number(params.disputedAmountTzs),
      p_reason_code: params.reasonCode,
      p_description: params.description,
      p_refund_request_id: params.refundRequestId || null,
      p_payment_id: params.paymentId || null,
    });

    if (error) {
      console.error('[DisputesRepository.openDispute] Error:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success ?? true,
      disputeId: data?.dispute_id,
    };
  }

  public static async resolveDispute(params: {
    disputeId: string;
    status: FinancialDisputeStatus;
    resolution: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('resolve_financial_dispute_secure', {
      p_dispute_id: params.disputeId,
      p_status: params.status,
      p_resolution: params.resolution,
    });

    if (error) {
      console.error('[DisputesRepository.resolveDispute] Error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  }

  public static async listByRestaurant(restaurantId: string): Promise<FinancialDispute[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('financial_disputes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('opened_at', { ascending: false });

    if (error) {
      console.error(`[DisputesRepository.listByRestaurant] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToDispute);
  }

  public static async listByCustomer(customerId: string): Promise<FinancialDispute[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('financial_disputes')
      .select('*')
      .eq('customer_user_id', customerId)
      .order('opened_at', { ascending: false });

    if (error) {
      console.error(`[DisputesRepository.listByCustomer] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToDispute);
  }

  public static async getDisputeById(disputeId: string): Promise<FinancialDispute | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('financial_disputes')
      .select('*')
      .eq('id', disputeId)
      .maybeSingle();

    if (error || !data) return null;

    return this.mapRowToDispute(data);
  }

  public static async addEvidence(params: {
    disputeId: string;
    filePath: string;
    fileType: string;
    description?: string;
  }): Promise<{ success: boolean; evidenceId?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase
      .from('financial_dispute_evidence')
      .insert({
        dispute_id: params.disputeId,
        file_path: params.filePath,
        file_type: params.fileType,
        description: params.description || '',
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[DisputesRepository.addEvidence] Error:', error?.message);
      return { success: false, error: error?.message || 'Failed to add evidence' };
    }

    return { success: true, evidenceId: data.id };
  }
}
