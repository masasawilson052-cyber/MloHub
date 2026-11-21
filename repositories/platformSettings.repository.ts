import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FINANCIAL_CONFIG, DEFAULT_FEE_RULES } from '../config/platformFees';

export interface PlatformFinancialSettings {
  currency: string;
  customerServiceFeeTzs: number;
  minimumOrderValueTzs: number;
  defaultCommissionBasisPoints: number;
  defaultCommissionRate: number;
}

export interface AdminFeeSettings {
  serviceFeeBps: number;
  serviceFeeMinTzs: number;
  serviceFeeMaxTzs: number;
  deliveryMinOrderTzs: number;
  minimumOrderValueTzs: number;
  commissionBpsDelivery: number;
  commissionBpsTakeaway: number;
  commissionBpsDineIn: number;
  newRestaurantFreeDays: number;
  currency: string;
}

export interface PlatformOperationalSettings {
  freshDays: number;
  recentDays: number;
  staleDays: number;
  supportPhone: string;
  supportEmail: string;
  supportHours: string;
  maintenanceMode: boolean;
  restaurantApplicationsEnabled: boolean;
  customerRegistrationEnabled: boolean;
}

export class PlatformSettingsRepository {
  /**
   * Authoritative read of platform financial configuration from PostgreSQL singleton.
   * Falls back cleanly to local configuration defaults if database unconfigured or unreachable.
   */
  public static async getFinancialSettings(): Promise<PlatformFinancialSettings> {
    if (!isSupabaseConfigured()) {
      return {
        currency: FINANCIAL_CONFIG.CURRENCY,
        customerServiceFeeTzs: 0,
        minimumOrderValueTzs: FINANCIAL_CONFIG.MIN_ORDER_SUBTOTAL_TZS,
        defaultCommissionBasisPoints: 1000,
        defaultCommissionRate: 0.10,
      };
    }

    try {
      const { data, error } = await supabase.rpc('get_public_platform_financial_settings');
      if (error || !data || data.length === 0) {
        const errMsg = String(error?.message || '');
        const isSchemaCacheMiss =
          (error as any)?.code === 'PGRST202' ||
          (error as any)?.code === '42883' ||
          errMsg.includes('Could not find the function') ||
          errMsg.includes('schema cache');
        if (error && !isSchemaCacheMiss) {
          console.warn('Could not read platform financial settings from DB, using fallback defaults:', error.message);
        }
        return {
          currency: FINANCIAL_CONFIG.CURRENCY,
          customerServiceFeeTzs: 0,
          minimumOrderValueTzs: FINANCIAL_CONFIG.MIN_ORDER_SUBTOTAL_TZS,
          defaultCommissionBasisPoints: 1000,
          defaultCommissionRate: 0.10,
        };
      }

      const row = data[0];
      const bps = Number(row.default_commission_basis_points ?? 1000);
      return {
        currency: row.currency || 'TZS',
        customerServiceFeeTzs: Number(row.customer_service_fee_tzs ?? 0),
        minimumOrderValueTzs: Number(row.minimum_order_value_tzs ?? 2000),
        defaultCommissionBasisPoints: bps,
        defaultCommissionRate: bps / 10000,
      };
    } catch (e: any) {
      console.warn('Exception reading platform financial settings:', e?.message);
      return {
        currency: FINANCIAL_CONFIG.CURRENCY,
        customerServiceFeeTzs: 0,
        minimumOrderValueTzs: FINANCIAL_CONFIG.MIN_ORDER_SUBTOTAL_TZS,
        defaultCommissionBasisPoints: 1000,
        defaultCommissionRate: 0.10,
      };
    }
  }

  /**
   * Load current platform financial settings via direct SELECT from platform_financial_settings
   * (allowed by admin RLS). Includes full commission breakdown and grace periods.
   */
  public static async getAdminFeeSettings(): Promise<AdminFeeSettings> {
    const fallback: AdminFeeSettings = {
      serviceFeeBps: 300,
      serviceFeeMinTzs: 200,
      serviceFeeMaxTzs: 500,
      deliveryMinOrderTzs: 5000,
      minimumOrderValueTzs: 2000,
      commissionBpsDelivery: 800,
      commissionBpsTakeaway: 500,
      commissionBpsDineIn: 0,
      newRestaurantFreeDays: 30,
      currency: 'TZS',
    };

    if (!isSupabaseConfigured()) {
      return fallback;
    }

    try {
      const { data, error } = await supabase
        .from('platform_financial_settings')
        .select('*')
        .eq('id', true)
        .maybeSingle();

      if (error || !data) {
        console.warn('Could not read platform_financial_settings via direct select:', error?.message);
        return fallback;
      }

      return {
        serviceFeeBps: Number(data.service_fee_bps ?? 300),
        serviceFeeMinTzs: Number(data.service_fee_min_tzs ?? 200),
        serviceFeeMaxTzs: Number(data.service_fee_max_tzs ?? 500),
        deliveryMinOrderTzs: Number(data.delivery_min_order_tzs ?? 5000),
        minimumOrderValueTzs: Number(data.minimum_order_value_tzs ?? 2000),
        commissionBpsDelivery: Number(data.commission_bps_delivery ?? 800),
        commissionBpsTakeaway: Number(data.commission_bps_takeaway ?? 500),
        commissionBpsDineIn: Number(data.commission_bps_dine_in ?? 0),
        newRestaurantFreeDays: Number(data.new_restaurant_free_days ?? 30),
        currency: String(data.currency || 'TZS'),
      };
    } catch (err: any) {
      console.warn('Exception reading platform_financial_settings:', err?.message);
      return fallback;
    }
  }

  /**
   * Update fee rules via update_platform_fee_rules_secure RPC.
   * Also updates minimum_order_value_tzs via update_platform_financial_settings_secure if provided.
   */
  public static async updatePlatformFeeRules(input: {
    serviceFeeBps: number;
    serviceFeeMinTzs: number;
    serviceFeeMaxTzs: number;
    deliveryMinOrderTzs: number;
    commissionBpsDelivery: number;
    commissionBpsTakeaway: number;
    commissionBpsDineIn: number;
    newRestaurantFreeDays: number;
    minimumOrderValueTzs?: number;
    reason: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase.rpc('update_platform_fee_rules_secure', {
      p_service_fee_bps: input.serviceFeeBps,
      p_service_fee_min_tzs: input.serviceFeeMinTzs,
      p_service_fee_max_tzs: input.serviceFeeMaxTzs,
      p_delivery_min_order_tzs: input.deliveryMinOrderTzs,
      p_commission_bps_delivery: input.commissionBpsDelivery,
      p_commission_bps_takeaway: input.commissionBpsTakeaway,
      p_commission_bps_dine_in: input.commissionBpsDineIn,
      p_new_restaurant_free_days: input.newRestaurantFreeDays,
      p_change_reason: input.reason.trim(),
    });

    if (error) {
      console.error('update_platform_fee_rules_secure error:', error.message);
      return { success: false, error: error.message };
    }

    if (input.minimumOrderValueTzs !== undefined) {
      const { error: minError } = await supabase.rpc('update_platform_financial_settings_secure', {
        p_service_fee_tzs: 0,
        p_minimum_order_tzs: Math.round(input.minimumOrderValueTzs),
        p_default_commission_bps: input.commissionBpsDelivery,
        p_change_reason: input.reason.trim(),
      });
      if (minError) {
        console.warn('update_platform_financial_settings_secure note:', minError.message);
      }
    }

    return { success: true };
  }

  /**
   * Authoritatively update financial parameters. Requires SUPER_ADMIN credentials server-side.
   */
  public static async updateFinancialSettings(input: {
    serviceFeeTzs: number;
    minimumOrderTzs: number;
    commissionPercent: number; // e.g., 10.0 for 10%
    reason: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const commissionBps = Math.round(input.commissionPercent * 100);

    const { data, error } = await supabase.rpc('update_platform_financial_settings_secure', {
      p_service_fee_tzs: Math.round(input.serviceFeeTzs),
      p_minimum_order_tzs: Math.round(input.minimumOrderTzs),
      p_default_commission_bps: commissionBps,
      p_change_reason: input.reason.trim(),
    });

    if (error) {
      console.error('PlatformSettingsRepository.updateFinancialSettings error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  }

  /**
   * Authoritative read of platform operational policies from PostgreSQL singleton.
   */
  public static async getOperationalSettings(): Promise<PlatformOperationalSettings> {
    const fallback: PlatformOperationalSettings = {
      freshDays: 7,
      recentDays: 14,
      staleDays: 30,
      supportPhone: '+255 700 000 000',
      supportEmail: 'support@mlohub.co.tz',
      supportHours: '07:00 AM - 11:00 PM EAT',
      maintenanceMode: false,
      restaurantApplicationsEnabled: true,
      customerRegistrationEnabled: true,
    };

    if (!isSupabaseConfigured()) return fallback;

    try {
      const { data, error } = await supabase.rpc('get_public_platform_operational_settings');
      if (error || !data || data.length === 0) return fallback;

      const row = data[0];
      return {
        freshDays: Number(row.fresh_days ?? 7),
        recentDays: Number(row.recent_days ?? 14),
        staleDays: Number(row.stale_days ?? 30),
        supportPhone: row.support_phone || fallback.supportPhone,
        supportEmail: row.support_email || fallback.supportEmail,
        supportHours: row.support_hours || fallback.supportHours,
        maintenanceMode: Boolean(row.maintenance_mode),
        restaurantApplicationsEnabled: row.restaurant_applications_enabled !== false,
        customerRegistrationEnabled: row.customer_registration_enabled !== false,
      };
    } catch {
      return fallback;
    }
  }

  /**
   * Authoritative update of operational policies. Requires ADMIN credentials server-side.
   */
  public static async updateOperationalSettings(input: {
    freshDays: number;
    recentDays: number;
    staleDays: number;
    supportPhone: string;
    supportEmail: string;
    supportHours: string;
    maintenanceMode: boolean;
    restaurantApplicationsEnabled: boolean;
    customerRegistrationEnabled: boolean;
    reason: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('update_platform_operational_settings_secure', {
      p_fresh_days: input.freshDays,
      p_recent_days: input.recentDays,
      p_stale_days: input.staleDays,
      p_support_phone: input.supportPhone,
      p_support_email: input.supportEmail,
      p_support_hours: input.supportHours,
      p_maintenance_mode: input.maintenanceMode,
      p_restaurant_applications_enabled: input.restaurantApplicationsEnabled,
      p_customer_registration_enabled: input.customerRegistrationEnabled,
      p_change_reason: input.reason.trim(),
    });

    if (error) {
      console.error('PlatformSettingsRepository.updateOperationalSettings error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  }
}
