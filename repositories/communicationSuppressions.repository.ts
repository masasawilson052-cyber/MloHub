import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CommunicationSuppression, NotificationChannel } from '../types/domain';

export class CommunicationSuppressionsRepository {
  private static mapRowToSuppression(row: any): CommunicationSuppression {
    return {
      id: row.id,
      channel: row.channel,
      destination: row.destination,
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
    };
  }

  public static async isSuppressed(channel: NotificationChannel, destination: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { data, error } = await supabase
      .from('communication_suppressions')
      .select('id')
      .eq('channel', channel)
      .eq('destination', destination.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('CommunicationSuppressionsRepository.isSuppressed error:', error.message);
      return false;
    }

    return !!data;
  }

  public static async addSuppression(
    channel: NotificationChannel,
    destination: string,
    reason: 'HARD_BOUNCE' | 'SPAM_REPORT' | 'UNSUBSCRIBED' | 'INVALID_NUMBER' | 'CARRIER_BLOCKED' | 'MANUAL_SUPPRESSION',
    details?: string
  ): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase.rpc('record_suppression_secure', {
      p_channel: channel,
      p_destination: destination.toLowerCase().trim(),
      p_reason: reason,
      p_details: details || null,
    });

    if (error) {
      console.error('CommunicationSuppressionsRepository.addSuppression error:', error.message);
      throw new Error(`Failed to record suppression: ${error.message}`);
    }
  }

  public static async listSuppressions(channel?: NotificationChannel): Promise<CommunicationSuppression[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase.from('communication_suppressions').select('*');
    if (channel) {
      query = query.eq('channel', channel);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('CommunicationSuppressionsRepository.listSuppressions error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToSuppression);
  }
}
