import { runtimeConfig } from '../lib/runtimeConfig';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  MerchantPayoutDestination,
  MerchantPayout,
  PayoutDestinationType,
  RestaurantFinancialSummary,
} from '../types/domain';

export class PayoutsRepository {
  private static fallbackDestinations: Map<string, MerchantPayoutDestination[]> = new Map();
  private static fallbackSummary: Map<string, RestaurantFinancialSummary> = new Map();

  private static mapRowToDestination(row: any): MerchantPayoutDestination {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      destinationType: row.destination_type,
      provider: row.provider,
      maskedAccountIdentifier: row.masked_account_identifier,
      accountName: row.account_name,
      verificationStatus: row.verification_status,
      isDefault: row.is_default,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      createdBy: row.created_by,
    };
  }

  private static mapRowToPayout(row: any): MerchantPayout {
    return {
      id: row.id,
      settlementId: row.settlement_id,
      restaurantId: row.restaurant_id,
      destinationId: row.destination_id,
      destinationTypeSnapshot: row.destination_type_snapshot,
      providerSnapshot: row.provider_snapshot,
      maskedIdentifierSnapshot: row.masked_identifier_snapshot,
      accountNameSnapshot: row.account_name_snapshot,
      amountTzs: row.amount_tzs?.toString() || '0',
      currency: 'TZS',
      provider: row.provider,
      providerReference: row.provider_reference,
      providerPayoutId: row.provider_payout_id,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      requestedAt: row.requested_at,
      processingAt: row.processing_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
      failureCode: row.failure_code,
      failureReason: row.failure_reason,
      rawProviderStatus: row.raw_provider_status,
    };
  }

  private static maskIdentifier(identifier: string, type: PayoutDestinationType): string {
    const clean = identifier.trim();
    if (type === 'MOBILE_MONEY') {
      return clean.slice(0, 6) + '***' + clean.slice(-3);
    }
    return clean.slice(0, 3) + '****' + clean.slice(-4);
  }

  /**
   * Adds a new payout destination via secure server Edge Function.
   * Client NEVER inserts directly into merchant_payout_destination_secrets.
   */
  public static async addPayoutDestination(params: {
    restaurantId: string;
    destinationType: PayoutDestinationType;
    provider: string;
    rawAccountIdentifier: string;
    accountName: string;
    isDefault?: boolean;
  }): Promise<{ success: boolean; destinationId?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      const fallbackId = `dest-fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const masked = this.maskIdentifier(params.rawAccountIdentifier, params.destinationType);
      const fallbackItem: MerchantPayoutDestination = {
        id: fallbackId,
        restaurantId: params.restaurantId,
        destinationType: params.destinationType,
        provider: params.provider,
        maskedAccountIdentifier: masked,
        accountName: params.accountName,
        verificationStatus: 'VERIFIED',
        isDefault: params.isDefault ?? false,
        createdAt: new Date().toISOString(),
        createdBy: 'offline_user',
      };
      const list = this.fallbackDestinations.get(params.restaurantId) || [];
      if (fallbackItem.isDefault) {
        list.forEach((d) => (d.isDefault = false));
      }
      list.unshift(fallbackItem);
      this.fallbackDestinations.set(params.restaurantId, list);
      return { success: true, destinationId: fallbackId };
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-payout-destination', {
        body: {
          restaurantId: params.restaurantId,
          destinationType: params.destinationType,
          provider: params.provider,
          accountIdentifier: params.rawAccountIdentifier,
          accountName: params.accountName,
          isDefault: params.isDefault ?? false,
        },
      });

      if (error || data?.success !== true || !data?.destinationId) {
        return {
          success: false,
          error: data?.error || data?.message || error?.message || 'Failed to save payout destination',
        };
      }

      return {
        success: true,
        destinationId: data.destinationId,
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to save payout destination' };
    }
  }

  public static async listDestinations(restaurantId: string): Promise<MerchantPayoutDestination[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackDestinations.get(restaurantId) || [];
    }

    try {
      const { data, error } = await supabase
        .from('merchant_payout_destinations')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) {
        if (this.fallbackDestinations.has(restaurantId)) {
          return this.fallbackDestinations.get(restaurantId) || [];
        }
        console.error(`[PayoutsRepository.listDestinations] Error:`, error.message);
        return [];
      }

      return (data || []).map(this.mapRowToDestination);
    } catch {
      return this.fallbackDestinations.get(restaurantId) || [];
    }
  }

  public static async setDefaultDestination(
    restaurantId: string,
    destinationId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Payout service unavailable' };

    try {
      const { error } = await supabase.rpc('set_default_payout_destination_secure', {
        p_restaurant_id: restaurantId,
        p_destination_id: destinationId,
      });

      if (error) {

        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public static async disableDestination(
    restaurantId: string,
    destinationId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Payout service unavailable' };

    try {
      const { error } = await supabase.rpc('disable_payout_destination_secure', {
        p_restaurant_id: restaurantId,
        p_destination_id: destinationId,
      });

      if (error) {

        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public static async getFinancialSummary(
    restaurantId: string,
    from?: string,
    to?: string
  ): Promise<RestaurantFinancialSummary> {
    if (!isSupabaseConfigured() && !runtimeConfig.allowLocalDataFallbacks) throw new Error('Finance service unavailable');
    const defaultFallback: RestaurantFinancialSummary = {
      restaurantId,
      from,
      to,
      grossFoodSales: 0,
      platformCommission: 0,
      serviceFeePlatformRevenue: 0,
      refundDeductions: 0,
      adjustments: 0,
      deliveryRestaurantShare: 0,
      restaurantPayable: 0,
      settledAmount: 0,
      pendingAmount: 0,
      paidOutAmount: 0,
    };

    if (!isSupabaseConfigured()) {
      return this.fallbackSummary.get(restaurantId) || defaultFallback;
    }

    try {
      const { data, error } = await supabase.rpc('get_restaurant_financial_summary', {
        p_restaurant_id: restaurantId,
        p_from: from || null,
        p_to: to || null,
      });

      if (error) {
        if (!runtimeConfig.allowLocalDataFallbacks) throw new Error('Could not load financial summary');
        if (this.fallbackSummary.has(restaurantId)) {
          return this.fallbackSummary.get(restaurantId)!;
        }
        console.warn(`[PayoutsRepository.getFinancialSummary] RPC note:`, error.message);
        return defaultFallback;
      }

      return {
        restaurantId,
        from: data?.from,
        to: data?.to,
        grossFoodSales: Number(data?.gross_food_sales || 0),
        platformCommission: Number(data?.platform_commission || 0),
        serviceFeePlatformRevenue: Number(data?.service_fee_platform_revenue || 0),
        refundDeductions: Number(data?.refund_deductions || 0),
        adjustments: Number(data?.adjustments || 0),
        deliveryRestaurantShare: Number(data?.delivery_restaurant_share || 0),
        restaurantPayable: Number(data?.restaurant_payable || 0),
        settledAmount: Number(data?.settled_amount || 0),
        pendingAmount: Number(data?.pending_amount || 0),
        paidOutAmount: Number(data?.paid_out_amount || 0),
      };
    } catch (e: any) {
      if (!runtimeConfig.allowLocalDataFallbacks) throw new Error('Could not load financial summary');
      return this.fallbackSummary.get(restaurantId) || defaultFallback;
    }
  }

  public static setFallbackSummary(restaurantId: string, summary: RestaurantFinancialSummary): void {
    this.fallbackSummary.set(restaurantId, summary);
  }

  public static async executePayout(params: {
    settlementId: string;
    destinationId: string;
    idempotencyKey: string;
  }): Promise<{ success: boolean; payoutId?: string; status?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('execute_merchant_payout_rpc', {
      p_settlement_id: params.settlementId,
      p_destination_id: params.destinationId,
      p_idempotency_key: params.idempotencyKey,
    });

    if (error) {
      console.error('[PayoutsRepository.executePayout] Error:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success === true,
      payoutId: data?.payout_id,
      status: data?.status,
    };
  }

  public static async listPayoutsByRestaurant(restaurantId: string): Promise<MerchantPayout[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('merchant_payouts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error(`[PayoutsRepository.listPayoutsByRestaurant] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToPayout);
  }

  public static async getPayoutById(payoutId: string): Promise<MerchantPayout | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('merchant_payouts')
      .select('*')
      .eq('id', payoutId)
      .maybeSingle();

    if (error || !data) return null;

    return this.mapRowToPayout(data);
  }

  public static async listAll(limit: number = 100): Promise<MerchantPayout[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('merchant_payouts')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[PayoutsRepository.listAll] Error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToPayout);
  }

  public static async reviewDestination(
    destinationId: string,
    decision: 'VERIFIED' | 'REJECTED',
    options?: {
      verificationReference?: string;
      verifiedAccountName?: string;
      reason?: string;
    }
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Payout verification service unavailable');
    }

    const { error } = await supabase.rpc('review_payout_destination_secure', {
      p_destination_id: destinationId,
      p_decision: decision,
      p_verification_reference: options?.verificationReference ?? null,
      p_verified_account_name: options?.verifiedAccountName ?? null,
      p_reason: options?.reason ?? null,
    });

    if (error) {
      throw new Error(`Payout destination review failed: ${error.message}`);
    }
  }
}
