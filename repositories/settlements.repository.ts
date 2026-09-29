import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MerchantSettlement, MerchantSettlementItem } from '../types/domain';
import { AdminPage, AdminPageQuery } from '../types/admin';

export class SettlementsRepository {
  private static mapRowToSettlement(row: any): MerchantSettlement {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      currency: 'TZS',
      grossSalesTzs: row.gross_sales_tzs?.toString() || '0',
      platformFeesTzs: row.platform_fees_tzs?.toString() || '0',
      refundAdjustmentsTzs: row.refund_adjustments_tzs?.toString() || '0',
      disputeAdjustmentsTzs: row.dispute_adjustments_tzs?.toString() || '0',
      otherAdjustmentsTzs: row.other_adjustments_tzs?.toString() || '0',
      netPayableTzs: row.net_payable_tzs?.toString() || '0',
      status: row.status,
      reference: row.reference,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      payoutId: row.payout_id,
    };
  }

  private static mapRowToSettlementItem(row: any): MerchantSettlementItem {
    return {
      id: row.id,
      settlementId: row.settlement_id,
      ledgerEntryId: row.ledger_entry_id,
      orderId: row.order_id,
      paymentId: row.payment_id,
      entryType: row.entry_type,
      grossTzs: row.gross_tzs?.toString() || '0',
      feeTzs: row.fee_tzs?.toString() || '0',
      adjustmentTzs: row.adjustment_tzs?.toString() || '0',
      netTzs: row.net_tzs?.toString() || '0',
    };
  }

  public static async calculateSettlement(params: {
    restaurantId: string;
    periodStart: string;
    periodEnd: string;
  }): Promise<{ success: boolean; settlementId?: string; reference?: string; netPayableTzs?: number; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('calculate_merchant_settlement', {
      p_restaurant_id: params.restaurantId,
      p_period_start: params.periodStart,
      p_period_end: params.periodEnd,
    });

    if (error) {
      console.error('[SettlementsRepository.calculateSettlement] Error:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success ?? true,
      settlementId: data?.settlement_id,
      reference: data?.reference,
      netPayableTzs: data?.net_payable_tzs,
    };
  }

  public static async approveSettlement(settlementId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('approve_merchant_settlement', {
      p_settlement_id: settlementId,
    });

    if (error) {
      console.error('[SettlementsRepository.approveSettlement] Error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  }

  public static async listByRestaurant(restaurantId: string): Promise<MerchantSettlement[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('merchant_settlements')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[SettlementsRepository.listByRestaurant] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToSettlement);
  }

  public static async getSettlementWithItems(settlementId: string): Promise<{
    settlement: MerchantSettlement;
    items: MerchantSettlementItem[];
  } | null> {
    if (!isSupabaseConfigured()) return null;

    const { data: settlementData, error: settlementError } = await supabase
      .from('merchant_settlements')
      .select('*')
      .eq('id', settlementId)
      .maybeSingle();

    if (settlementError || !settlementData) return null;

    const { data: itemsData, error: itemsError } = await supabase
      .from('merchant_settlement_items')
      .select('*')
      .eq('settlement_id', settlementId);

    if (itemsError) {
      console.error(`[SettlementsRepository.getSettlementWithItems] Error:`, itemsError.message);
      return null;
    }

    return {
      settlement: this.mapRowToSettlement(settlementData),
      items: (itemsData || []).map(this.mapRowToSettlementItem),
    };
  }

  public static async listAll(limit: number = 100): Promise<MerchantSettlement[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('merchant_settlements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SettlementsRepository.listAll] Error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToSettlement);
  }

  public static async setHold(
    settlementId: string,
    hold: boolean,
    reason: string
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('set_merchant_settlement_hold_secure', {
      p_settlement_id: settlementId,
      p_hold: hold,
      p_reason: reason,
    });

    if (error) {
      console.error('[SettlementsRepository.setHold] Error:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success ?? true,
      status: data?.status,
    };
  }

  public static async listAdminPage(query: AdminPageQuery = {}): Promise<AdminPage<MerchantSettlement>> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const pageSize = Math.min(100, Math.max(10, query.pageSize || 50));
    const page = Math.max(1, query.page || 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let qb = supabase
      .from('merchant_settlements')
      .select('*', { count: 'exact' });

    if (query.status && query.status !== 'ALL') {
      qb = qb.eq('status', query.status);
    }
    if (query.restaurantId && query.restaurantId !== 'ALL') {
      qb = qb.eq('restaurant_id', query.restaurantId);
    }
    if (query.from) {
      qb = qb.gte('created_at', query.from);
    }
    if (query.to) {
      qb = qb.lte('created_at', query.to);
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      qb = qb.or(`id.ilike.%${term}%,reference.ilike.%${term}%`);
    }

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[SettlementsRepository.listAdminPage] Error:', error.message);
      throw new Error(`Unable to load settlements: ${error.message}`);
    }

    return {
      items: (data || []).map(this.mapRowToSettlement),
      page,
      pageSize,
      total: count || 0,
      hasNext: from + (data?.length || 0) < (count || 0),
    };
  }
}

