import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AdminAttentionSummary {
  pendingApplications: number;
  pendingDisputes: number;
  stalePayments: number;
  failedOutbox: number;
  unsettledLedgerCount: number;
  unsettledLedgerTotalTzs: number;
  pendingRefundsCount: number;
  pendingRefundsTotalTzs: number;
  openDataReports: number;
  generatedAt: string;
}

export class AdminGovernanceRepository {
  /**
   * Calls public.get_admin_attention_summary() RPC authoritatively.
   */
  public static async getAttentionSummary(): Promise<AdminAttentionSummary> {
    const fallback: AdminAttentionSummary = {
      pendingApplications: 0,
      pendingDisputes: 0,
      stalePayments: 0,
      failedOutbox: 0,
      unsettledLedgerCount: 0,
      unsettledLedgerTotalTzs: 0,
      pendingRefundsCount: 0,
      pendingRefundsTotalTzs: 0,
      openDataReports: 0,
      generatedAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) {
      return fallback;
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_attention_summary');
      if (error) {
        console.error('Error in get_admin_attention_summary RPC:', error.message);
        return fallback;
      }

      if (!data) return fallback;

      return {
        pendingApplications: Number(data.pendingApplications ?? 0),
        pendingDisputes: Number(data.pendingDisputes ?? 0),
        stalePayments: Number(data.stalePayments ?? 0),
        failedOutbox: Number(data.failedOutbox ?? 0),
        unsettledLedgerCount: Number(data.unsettledLedgerCount ?? 0),
        unsettledLedgerTotalTzs: Number(data.unsettledLedgerTotalTzs ?? 0),
        pendingRefundsCount: Number(data.pendingRefundsCount ?? 0),
        pendingRefundsTotalTzs: Number(data.pendingRefundsTotalTzs ?? 0),
        openDataReports: Number(data.openDataReports ?? 0),
        generatedAt: data.generatedAt || new Date().toISOString(),
      };
    } catch (e: any) {
      console.error('Exception calling get_admin_attention_summary:', e?.message);
      return fallback;
    }
  }
}
