import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FINANCIAL_CONFIG } from '../config/platformFees';

export interface PlatformFinancialSettings {
  currency: string;
  customerServiceFeeTzs: number;
  minimumOrderValueTzs: number;
  defaultCommissionBasisPoints: number;
  defaultCommissionRate: number;
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
        customerServiceFeeTzs: FINANCIAL_CONFIG.SERVICE_FEE_TZS,
        minimumOrderValueTzs: FINANCIAL_CONFIG.MIN_ORDER_SUBTOTAL_TZS,
        defaultCommissionBasisPoints: Math.round(FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE * 10000),
        defaultCommissionRate: FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE,
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
          customerServiceFeeTzs: FINANCIAL_CONFIG.SERVICE_FEE_TZS,
          minimumOrderValueTzs: FINANCIAL_CONFIG.MIN_ORDER_SUBTOTAL_TZS,
          defaultCommissionBasisPoints: Math.round(FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE * 10000),
          defaultCommissionRate: FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE,
        };
      }

      const row = data[0];
      const bps = Number(row.default_commission_basis_points ?? 1000);
      return {
        currency: row.currency || 'TZS',
        customerServiceFeeTzs: Number(row.customer_service_fee_tzs ?? 1500),
        minimumOrderValueTzs: Number(row.minimum_order_value_tzs ?? 2000),
        defaultCommissionBasisPoints: bps,
        defaultCommissionRate: bps / 10000,
      };
    } catch (e: any) {
      console.warn('Exception reading platform financial settings:', e?.message);
      return {
        currency: FINANCIAL_CONFIG.CURRENCY,
        customerServiceFeeTzs: FINANCIAL_CONFIG.SERVICE_FEE_TZS,
        minimumOrderValueTzs: FINANCIAL_CONFIG.MIN_ORDER_SUBTOTAL_TZS,
        defaultCommissionBasisPoints: Math.round(FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE * 10000),
        defaultCommissionRate: FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE,
      };
    }
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
