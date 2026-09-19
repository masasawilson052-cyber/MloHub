import { NotificationRepository } from '../repositories/notifications.repository';
import { isSupabaseConfigured } from '../lib/supabase';
import { Notification } from '../types/domain';
import { RealtimeEventEngine, RealtimeEventPayload } from '../db/realtime/eventEngine';
import { MloHubDB } from '../db';

export class NotificationService {
  /**
   * List in-app notifications for user
   */
  public static async listUserNotifications(userId: string): Promise<Notification[]> {
    if (isSupabaseConfigured()) {
      return NotificationRepository.listForUser(userId);
    }

    await MloHubDB.init();
    const list = MloHubDB.notifications.getAll().filter((n) => n.userId === userId);
    return list.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      category: 'ORDER',
      titleEn: n.titleEn,
      titleSw: n.titleSw,
      messageEn: n.messageEn,
      messageSw: n.messageSw,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
  }

  /**
   * Mark notification as read
   */
  public static async markAsRead(id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      await NotificationRepository.markAsRead(id);
      return;
    }

    await MloHubDB.init();
    await MloHubDB.notifications.markAsRead(id);
  }

  /**
   * Send notification to user
   */
  public static async sendNotification(notif: Partial<Notification>): Promise<Notification> {
    if (isSupabaseConfigured()) {
      const created = await NotificationRepository.createNotification(notif);
      RealtimeEventEngine.publish(`notifications:user:${notif.userId}`, {
        eventType: 'NEW_ORDER_PLACED',
        customerId: notif.userId,
        data: { notification: created },
      });
      return created;
    }

    await MloHubDB.init();
    const mock = await MloHubDB.notifications.create({
      userId: notif.userId || 'usr-default',
      type: (notif.type as any) || 'system',
      titleEn: notif.titleEn || 'Notification',
      titleSw: notif.titleSw || 'Taarifa',
      messageEn: notif.messageEn || '',
      messageSw: notif.messageSw || '',
    });

    return {
      id: mock.id,
      userId: mock.userId,
      type: mock.type,
      category: 'ORDER',
      titleEn: mock.titleEn,
      titleSw: mock.titleSw,
      messageEn: mock.messageEn,
      messageSw: mock.messageSw,
      isRead: mock.isRead,
      createdAt: mock.createdAt,
    };
  }

  /**
   * Subscribe to notifications in real-time
   */
  public static subscribeToNotifications(
    userId: string,
    callback: (event: RealtimeEventPayload) => void
  ): () => void {
    return RealtimeEventEngine.subscribe(`notifications:user:${userId}`, callback);
  }
}
