import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  NotificationPreference,
  MarketingConsent,
  NotificationChannel,
  CommunicationClass,
} from '../types/domain';

export class NotificationPreferencesRepository {
  private static mapRowToPreference(row: any): NotificationPreference {
    return {
      id: row.id,
      userId: row.user_id,
      channel: row.channel,
      category: row.category,
      enabled: row.enabled,
      quietHoursEnabled: row.quiet_hours_enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      quietHoursTimezone: row.quiet_hours_timezone,
      updatedAt: row.updated_at,
    };
  }

  private static mapRowToConsent(row: any): MarketingConsent {
    return {
      id: row.id,
      userId: row.user_id,
      channel: row.channel,
      consented: row.consented,
      consentedAt: row.consented_at,
      withdrawnAt: row.withdrawn_at,
      consentPolicyVersion: row.consent_policy_version,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static async getPreferences(userId: string): Promise<NotificationPreference[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error(`NotificationPreferencesRepository.getPreferences(${userId}) error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToPreference);
  }

  public static async updatePreference(params: {
    channel: NotificationChannel;
    category: string;
    enabled: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase.rpc('update_notification_preference_secure', {
      p_channel: params.channel,
      p_category: params.category,
      p_enabled: params.enabled,
      p_quiet_hours_enabled: params.quietHoursEnabled ?? false,
      p_quiet_hours_start: params.quietHoursStart || '22:00:00',
      p_quiet_hours_end: params.quietHoursEnd || '07:00:00',
    });

    if (error) {
      console.error('NotificationPreferencesRepository.updatePreference error:', error.message);
      throw new Error(`Failed to update notification preference: ${error.message}`);
    }
  }

  public static async getMarketingConsent(userId: string, channel: NotificationChannel): Promise<MarketingConsent | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('marketing_consents')
      .select('*')
      .eq('user_id', userId)
      .eq('channel', channel)
      .maybeSingle();

    if (error) {
      console.error(`NotificationPreferencesRepository.getMarketingConsent error:`, error.message);
      return null;
    }

    return data ? this.mapRowToConsent(data) : null;
  }

  public static async updateMarketingConsent(params: {
    channel: NotificationChannel;
    consented: boolean;
    policyVersion?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase.rpc('update_marketing_consent_secure', {
      p_channel: params.channel,
      p_consented: params.consented,
      p_policy_version: params.policyVersion || 'v1.0',
      p_ip_address: params.ipAddress || null,
      p_user_agent: params.userAgent || null,
    });

    if (error) {
      console.error('NotificationPreferencesRepository.updateMarketingConsent error:', error.message);
      throw new Error(`Failed to update marketing consent: ${error.message}`);
    }
  }

  public static async checkReachability(params: {
    userId: string;
    channel: NotificationChannel;
    category: string;
    communicationClass: CommunicationClass;
    destination?: string;
  }): Promise<{ reachable: boolean; status: string; reason: string }> {
    if (!isSupabaseConfigured()) {
      return { reachable: true, status: 'QUEUED', reason: 'MOCK_ALLOWED' };
    }

    const { data, error } = await supabase.rpc('is_recipient_reachable', {
      p_user_id: params.userId,
      p_channel: params.channel,
      p_category: params.category,
      p_comm_class: params.communicationClass,
      p_destination: params.destination || null,
    });

    if (error) {
      console.error('NotificationPreferencesRepository.checkReachability error:', error.message);
      return { reachable: true, status: 'QUEUED', reason: 'FALLBACK_ALLOWED' };
    }

    return data as { reachable: boolean; status: string; reason: string };
  }
}
