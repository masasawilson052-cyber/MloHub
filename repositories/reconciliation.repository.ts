import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  ReconciliationRun,
  ReconciliationItem,
  ReconciliationResult,
} from '../types/domain';

export class ReconciliationRepository {
  private static mapRowToRun(row: any): ReconciliationRun {
    return {
      id: row.id,
      provider: row.provider,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdBy: row.created_by,
      summary: row.summary || {},
    };
  }

  private static mapRowToItem(row: any): ReconciliationItem {
    return {
      id: row.id,
      runId: row.run_id,
      paymentId: row.payment_id,
      payoutId: row.payout_id,
      providerReference: row.provider_reference,
      internalAmountTzs: row.internal_amount_tzs?.toString(),
      providerAmountTzs: row.provider_amount_tzs?.toString(),
      internalStatus: row.internal_status,
      rawProviderStatus: row.raw_provider_status,
      result: row.result,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }

  public static async createRun(params: {
    provider: string;
    periodStart: string;
    periodEnd: string;
  }): Promise<{ success: boolean; runId?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase
      .from('reconciliation_runs')
      .insert({
        provider: params.provider,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        status: 'RUNNING',
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[ReconciliationRepository.createRun] Error:', error?.message);
      return { success: false, error: error?.message || 'Failed to create run' };
    }

    return { success: true, runId: data.id };
  }

  public static async addReconciliationItems(
    items: Array<{
      runId: string;
      paymentId?: string;
      payoutId?: string;
      providerReference: string;
      internalAmountTzs?: bigint;
      providerAmountTzs?: bigint;
      internalStatus?: string;
      rawProviderStatus?: string;
      result: ReconciliationResult;
      notes?: string;
    }>
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const rows = items.map((item) => ({
      run_id: item.runId,
      payment_id: item.paymentId || null,
      payout_id: item.payoutId || null,
      provider_reference: item.providerReference,
      internal_amount_tzs: item.internalAmountTzs !== undefined ? Number(item.internalAmountTzs) : null,
      provider_amount_tzs: item.providerAmountTzs !== undefined ? Number(item.providerAmountTzs) : null,
      internal_status: item.internalStatus || null,
      raw_provider_status: item.rawProviderStatus || null,
      result: item.result,
      notes: item.notes || null,
    }));

    const { data, error } = await supabase
      .from('reconciliation_items')
      .insert(rows)
      .select();

    if (error) {
      console.error('[ReconciliationRepository.addReconciliationItems] Error:', error.message);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || 0 };
  }

  public static async completeRun(
    runId: string,
    summary: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase
      .from('reconciliation_runs')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        summary,
      })
      .eq('id', runId);

    if (error) {
      console.error('[ReconciliationRepository.completeRun] Error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  public static async listRuns(limit: number = 20): Promise<ReconciliationRun[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('reconciliation_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ReconciliationRepository.listRuns] Error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToRun);
  }

  public static async getRunDetails(runId: string): Promise<{
    run: ReconciliationRun;
    items: ReconciliationItem[];
  } | null> {
    if (!isSupabaseConfigured()) return null;

    const { data: runData, error: runError } = await supabase
      .from('reconciliation_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();

    if (runError || !runData) return null;

    const { data: itemsData, error: itemsError } = await supabase
      .from('reconciliation_items')
      .select('*')
      .eq('run_id', runId);

    if (itemsError) {
      console.error('[ReconciliationRepository.getRunDetails] Error:', itemsError.message);
      return null;
    }

    return {
      run: this.mapRowToRun(runData),
      items: (itemsData || []).map(this.mapRowToItem),
    };
  }
}
