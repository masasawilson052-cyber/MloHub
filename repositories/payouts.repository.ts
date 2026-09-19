import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  MerchantPayoutDestination,
  MerchantPayout,
  PayoutDestinationType,
} from '../types/domain';

export class PayoutsRepository {
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
      if (clean.length <= 6) return '***' + clean.slice(-3);
      return clean.slice(0, 6) + '***' + clean.slice(-3);
    }
    // Bank account
    if (clean.length <= 4) return '****' + clean;
    return clean.slice(0, 3) + '****' + clean.slice(-4);
  }

  public static async addPayoutDestination(params: {
    restaurantId: string;
    destinationType: PayoutDestinationType;
    provider: string;
    rawAccountIdentifier: string;
    accountName: string;
    isDefault?: boolean;
  }): Promise<{ success: boolean; destinationId?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const masked = this.maskIdentifier(params.rawAccountIdentifier, params.destinationType);

    // 1. Insert public destination metadata
    const { data: dest, error: destError } = await supabase
      .from('merchant_payout_destinations')
      .insert({
        restaurant_id: params.restaurantId,
        destination_type: params.destinationType,
        provider: params.provider,
        masked_account_identifier: masked,
        account_name: params.accountName,
        verification_status: 'PENDING_VERIFICATION',
        is_default: params.isDefault ?? false,
      })
      .select()
      .single();

    if (destError || !dest) {
      console.error('[PayoutsRepository.addPayoutDestination] Error:', destError?.message);
      return { success: false, error: destError?.message || 'Failed to add destination' };
    }

    // 2. Insert private secret reference into merchant_payout_destination_secrets
    const { error: secretError } = await supabase
      .from('merchant_payout_destination_secrets')
      .insert({
        destination_id: dest.id,
        encrypted_account_reference: params.rawAccountIdentifier,
      });

    if (secretError) {
      console.warn('[PayoutsRepository.addPayoutDestination] Secret storage note:', secretError.message);
    }

    return { success: true, destinationId: dest.id };
  }

  public static async listDestinations(restaurantId: string): Promise<MerchantPayoutDestination[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('merchant_payout_destinations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[PayoutsRepository.listDestinations] Error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToDestination);
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
      success: data?.success ?? true,
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
}
