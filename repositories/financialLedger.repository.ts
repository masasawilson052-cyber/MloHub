import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  FinancialLedgerEntry,
  OrderFinancialSnapshot,
  FinancialPostingBatch,
  RestaurantFinancialSummary,
} from '../types/domain';

export class FinancialLedgerRepository {
  private static mapRowToEntry(row: any): FinancialLedgerEntry {
    return {
      id: row.id,
      batchId: row.batch_id,
      entryType: row.entry_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      restaurantId: row.restaurant_id,
      customerUserId: row.customer_user_id,
      paymentId: row.payment_id,
      refundId: row.refund_id,
      disputeId: row.dispute_id,
      settlementId: row.settlement_id,
      payoutId: row.payout_id,
      currency: 'TZS',
      amountTzs: row.amount_tzs?.toString() || '0',
      direction: row.direction,
      accountType: row.account_type,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      description: row.description,
      occurredAt: row.occurred_at,
      createdAt: row.created_at,
      createdByType: row.created_by_type,
      idempotencyKey: row.idempotency_key,
      metadata: row.metadata || {},
    };
  }

  public static async getRestaurantLedgerEntries(
    restaurantId: string,
    limit: number = 100
  ): Promise<FinancialLedgerEntry[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('financial_ledger_entries')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[FinancialLedgerRepository.getRestaurantLedgerEntries] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToEntry);
  }

  public static async getRestaurantSummary(restaurantId: string): Promise<RestaurantFinancialSummary> {
    if (!isSupabaseConfigured()) {
      return {
        restaurantId,
        totalGrossFoodSalesTzs: '0',
        totalPlatformCommissionTzs: '0',
        totalNetEntitlementTzs: '0',
        totalSettledPaidTzs: '0',
        unsettledPayableTzs: '0',
        heldDisputedTzs: '0',
        activeDisputesCount: 0,
      };
    }

    // Query entries for RESTAURANT_PAYABLE
    const { data: entries, error } = await supabase
      .from('financial_ledger_entries')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (error) {
      console.error(`[FinancialLedgerRepository.getRestaurantSummary] Error:`, error.message);
      return {
        restaurantId,
        totalGrossFoodSalesTzs: '0',
        totalPlatformCommissionTzs: '0',
        totalNetEntitlementTzs: '0',
        totalSettledPaidTzs: '0',
        unsettledPayableTzs: '0',
        heldDisputedTzs: '0',
        activeDisputesCount: 0,
      };
    }

    // Query snapshots for gross sales & commissions
    const { data: snapshots } = await supabase
      .from('order_financial_snapshots')
      .select('*')
      .eq('restaurant_id', restaurantId);

    let grossFood = 0n;
    let platformComm = 0n;
    let netEntitlement = 0n;

    (snapshots || []).forEach((s) => {
      grossFood += BigInt(s.gross_food_sales_tzs || 0);
      platformComm += BigInt(s.platform_commission_tzs || 0);
      netEntitlement += BigInt(s.restaurant_net_payable_tzs || 0);
    });

    // Query settlements to find settled items
    const { data: settlementItems } = await supabase
      .from('merchant_settlement_items')
      .select('ledger_entry_id, merchant_settlements!inner(restaurant_id, status)')
      .eq('merchant_settlements.restaurant_id', restaurantId);

    const settledEntryIds = new Set((settlementItems || []).map((si: any) => si.ledger_entry_id));

    // Calculate unsettled payable and held reserves
    let unsettledPayable = 0n;
    let heldDisputed = 0n;
    let paidOut = 0n;

    (entries || []).forEach((e) => {
      const amt = BigInt(e.amount_tzs || 0);
      if (e.account_type === 'RESTAURANT_PAYABLE') {
        if (!settledEntryIds.has(e.id)) {
          if (e.direction === 'CREDIT') unsettledPayable += amt;
          if (e.direction === 'DEBIT') unsettledPayable -= amt;
        }
      }
      if (e.account_type === 'DISPUTE_RESERVE') {
        if (e.direction === 'CREDIT') heldDisputed += amt;
        if (e.direction === 'DEBIT') heldDisputed -= amt;
      }
      if (e.entry_type === 'SETTLEMENT_PAYOUT' && e.account_type === 'RESTAURANT_PAYABLE' && e.direction === 'DEBIT') {
        paidOut += amt;
      }
    });

    // Query active disputes count
    const { count: disputeCount } = await supabase
      .from('financial_disputes')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .in('status', ['OPEN', 'EVIDENCE_REQUIRED', 'UNDER_REVIEW']);

    // Query last settlement
    const { data: lastSettlement } = await supabase
      .from('merchant_settlements')
      .select('created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      restaurantId,
      totalGrossFoodSalesTzs: grossFood.toString(),
      totalPlatformCommissionTzs: platformComm.toString(),
      totalNetEntitlementTzs: netEntitlement.toString(),
      totalSettledPaidTzs: paidOut.toString(),
      unsettledPayableTzs: (unsettledPayable > 0n ? unsettledPayable : 0n).toString(),
      heldDisputedTzs: heldDisputed.toString(),
      activeDisputesCount: disputeCount || 0,
      lastSettlementAt: lastSettlement?.created_at,
    };
  }

  public static async getOrderFinancialSnapshot(orderId: string): Promise<OrderFinancialSnapshot | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('order_financial_snapshots')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      orderId: data.order_id,
      restaurantId: data.restaurant_id,
      paymentId: data.payment_id,
      grossFoodSalesTzs: data.gross_food_sales_tzs?.toString() || '0',
      customerServiceFeeTzs: data.customer_service_fee_tzs?.toString() || '0',
      restaurantDeliveryFeeTzs: data.restaurant_delivery_fee_tzs?.toString() || '0',
      discountTzs: data.discount_tzs?.toString() || '0',
      platformCommissionTzs: data.platform_commission_tzs?.toString() || '0',
      providerFeeTzs: data.provider_fee_tzs?.toString(),
      restaurantNetPayableTzs: data.restaurant_net_payable_tzs?.toString() || '0',
      commissionPolicyId: data.commission_policy_id,
      commissionBasisPointsSnapshot: data.commission_basis_points_snapshot,
      currency: 'TZS',
      createdAt: data.created_at,
    };
  }

  public static async getPostingBatch(batchId: string): Promise<FinancialPostingBatch | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('financial_posting_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      batchType: data.batch_type,
      totalAmountTzs: data.total_amount_tzs?.toString() || '0',
      isBalanced: data.is_balanced,
      idempotencyKey: data.idempotency_key,
      createdAt: data.created_at,
    };
  }
}
