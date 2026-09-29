import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AdminFinanceSummary } from '../types/admin';

export class AdminFinanceRepository {
  static async getSummary(
    from?: string,
    to?: string
  ): Promise<AdminFinanceSummary> {
    if (!isSupabaseConfigured()) {
      throw new Error('Administrator finance service unavailable');
    }

    const { data, error } = await supabase.rpc('get_admin_finance_summary', {
      p_from: from || null,
      p_to: to || null,
    });

    if (error || !data) {
      throw new Error(`Unable to load finance summary: ${error?.message || 'No response'}`);
    }

    return {
      attemptedVolumeTzs: Number(data.attempted_volume_tzs || 0),
      capturedVolumeTzs: Number(data.captured_volume_tzs || 0),
      refundedVolumeTzs: Number(data.refunded_volume_tzs || 0),
      pendingPayments: Number(data.pending_payments || 0),
      failedPayments: Number(data.failed_payments || 0),
      pendingRefunds: Number(data.pending_refunds || 0),
      openDisputes: Number(data.open_disputes || 0),
      calculatedSettlements: Number(data.calculated_settlements || 0),
      approvedSettlements: Number(data.approved_settlements || 0),
      queuedPayouts: Number(data.queued_payouts || 0),
      failedPayouts: Number(data.failed_payouts || 0),
      settlementGrossTzs: Number(data.settlement_gross_tzs || 0),
      platformCommissionTzs: Number(data.platform_commission_tzs || 0),
      merchantNetPayableTzs: Number(data.merchant_net_payable_tzs || 0),
      paidOutTzs: Number(data.paid_out_tzs || 0),
    };
  }
}
