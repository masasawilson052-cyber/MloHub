import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PushDevice, PushDeviceToken } from '../types/domain';

export class PushDevicesRepository {
  private static mapRowToDevice(row: any): PushDevice {
    return {
      id: row.id,
      userId: row.user_id,
      deviceFingerprint: row.device_fingerprint,
      platform: row.platform,
      deviceModel: row.device_model,
      appVersion: row.app_version,
      osVersion: row.os_version,
      isActive: row.is_active,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
    };
  }

  private static mapRowToToken(row: any): PushDeviceToken {
    return {
      id: row.id,
      deviceId: row.device_id,
      userId: row.user_id,
      tokenType: row.token_type,
      token: row.token,
      isValid: row.is_valid,
      invalidatedAt: row.invalidated_at,
      invalidationReason: row.invalidation_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static async registerDeviceToken(params: {
    deviceFingerprint: string;
    platform: 'ios' | 'android' | 'web' | 'unknown';
    token: string;
    tokenType?: 'EXPO' | 'FCM' | 'APNS';
    deviceModel?: string;
    appVersion?: string;
    osVersion?: string;
  }): Promise<{ deviceId: string; tokenId: string; token: string }> {
    if (!isSupabaseConfigured()) {
      return { deviceId: 'mock_dev', tokenId: 'mock_tok', token: params.token };
    }

    const { data, error } = await supabase.rpc('register_push_device_token_secure', {
      p_device_fingerprint: params.deviceFingerprint,
      p_platform: params.platform,
      p_token: params.token,
      p_token_type: params.tokenType || 'EXPO',
      p_device_model: params.deviceModel || null,
      p_app_version: params.appVersion || null,
      p_os_version: params.osVersion || null,
    });

    if (error) {
      console.error('PushDevicesRepository.registerDeviceToken error:', error.message);
      throw new Error(`Failed to register push device token: ${error.message}`);
    }

    return {
      deviceId: (data as any).device_id,
      tokenId: (data as any).token_id,
      token: (data as any).token,
    };
  }

  public static async deactivateToken(token: string, reason: string = 'DeviceNotRegistered'): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase.rpc('deactivate_push_device_token_secure', {
      p_token: token,
      p_reason: reason,
    });

    if (error) {
      console.error('PushDevicesRepository.deactivateToken error:', error.message);
      throw new Error(`Failed to deactivate push token: ${error.message}`);
    }
  }

  public static async getActiveTokensForUser(userId: string): Promise<PushDeviceToken[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('push_device_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_valid', true);

    if (error) {
      console.error(`PushDevicesRepository.getActiveTokensForUser(${userId}) error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToToken);
  }

  public static async listDevicesForUser(userId: string): Promise<PushDevice[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('push_devices')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error(`PushDevicesRepository.listDevicesForUser(${userId}) error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToDevice);
  }
}
