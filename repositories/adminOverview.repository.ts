import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AdminOverviewMetrics } from '../types/admin';

export { AdminOverviewMetrics };

export class AdminOverviewRepository {
  static async getMetrics(): Promise<AdminOverviewMetrics> {
    if (!isSupabaseConfigured()) {
      throw new Error('Platform metrics unavailable');
    }

    const { data, error } = await supabase.rpc('get_admin_overview_metrics');

    if (error) {
      console.error('[AdminOverviewRepository.getMetrics] RPC error:', error.message);
      throw new Error(`Unable to load platform overview metrics: ${error.message}`);
    }

    return {
      totalRestaurants: Number(data?.total_restaurants || 0),
      basicSellers: Number(data?.basic_sellers || 0),
      verifiedSellers: Number(data?.verified_sellers || 0),
      suspendedRestaurants: Number(data?.suspended_restaurants || 0),

      pendingApplications: Number(data?.pending_applications || 0),
      openReports: Number(data?.open_reports || 0),

      totalOrders: Number(data?.total_orders || 0),
      completedOrders: Number(data?.completed_orders || 0),

      capturedVolumeTzs: Number(data?.captured_volume_tzs || 0),
      platformRevenueTzs: Number(data?.platform_revenue_tzs || 0),

      pendingRefunds: Number(data?.pending_refunds || 0),
      pendingSettlements: Number(data?.pending_settlements || 0),

      stalePayments: Number(data?.stale_payments || 0),
      failedOutbox: Number(data?.failed_outbox || 0),
    };
  }
}
