import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Notification } from '../types/domain';

export class NotificationRepository {
  private static mapRowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      category: row.category || 'ORDER',
      titleEn: row.title_en,
      titleSw: row.title_sw,
      messageEn: row.message_en,
      messageSw: row.message_sw,
      isRead: row.is_read ?? false,
      orderId: row.order_id,
      restaurantId: row.restaurant_id,
      actionType: row.action_type,
      payload: row.data || {},
      eventId: row.event_id,
      communicationClass: row.communication_class || 'TRANSACTIONAL',
      priority: row.priority || 'NORMAL',
      locale: row.locale || 'sw',
      dedupeKey: row.dedupe_key,
      readAt: row.read_at,
      archivedAt: row.archived_at,
      createdAt: row.created_at || new Date().toISOString(),
    };
  }

  public static async listForUser(userId: string, includeArchived: boolean = false): Promise<Notification[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (!includeArchived) {
      query = query.is('archived_at', null);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error(`NotificationRepository.listForUser(${userId}) error:`, error.message);
      throw new Error(`Failed to load notifications: ${error.message}`);
    }

    return (data || []).map(this.mapRowToNotification);
  }

  public static async listUnread(userId: string, limit: number = 50): Promise<Notification[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`NotificationRepository.listUnread(${userId}) error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToNotification);
  }

  public static async listAll(limit: number = 100): Promise<Notification[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('NotificationRepository.listAll error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToNotification);
  }

  public static async markAsRead(id: string): Promise<void> {
    if (!isSupabaseConfigured()) return;

    // Call secure RPC if available, fallback to update
    const { error: rpcError } = await supabase.rpc('mark_notification_read', {
      p_notification_id: id,
    });

    if (rpcError) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error(`NotificationRepository.markAsRead(${id}) error:`, error.message);
      }
    }
  }

  public static async markAllAsRead(userId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { error: rpcError } = await supabase.rpc('mark_all_notifications_read');

    if (rpcError) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error(`NotificationRepository.markAllAsRead(${userId}) error:`, error.message);
      }
    }
  }

  public static async archiveNotification(id: string): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { error: rpcError } = await supabase.rpc('archive_notification', {
      p_notification_id: id,
    });

    if (rpcError) {
      const { error } = await supabase
        .from('notifications')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error(`NotificationRepository.archiveNotification(${id}) error:`, error.message);
      }
    }
  }

  public static async createNotification(notif: Partial<Notification>): Promise<Notification> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      user_id: notif.userId,
      type: notif.type || 'SYSTEM',
      category: notif.category || 'ORDER',
      title_en: notif.titleEn || 'Notification',
      title_sw: notif.titleSw || 'Taarifa',
      message_en: notif.messageEn || '',
      message_sw: notif.messageSw || '',
      is_read: notif.isRead ?? false,
      order_id: notif.orderId,
      restaurant_id: notif.restaurantId,
      action_type: notif.actionType,
      data: notif.payload || {},
      event_id: notif.eventId,
      communication_class: notif.communicationClass || 'TRANSACTIONAL',
      priority: notif.priority || 'NORMAL',
      locale: notif.locale || 'sw',
      dedupe_key: notif.dedupeKey,
      read_at: notif.readAt,
      archived_at: notif.archivedAt,
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('NotificationRepository.createNotification error:', error.message);
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return this.mapRowToNotification(data);
  }
}
