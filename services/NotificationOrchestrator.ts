/**
 * MloHub Centralized Notification Orchestrator (Stage 8)
 * Dispatches notifications across SMS, In-App, and Push channels
 * while respecting customer & vendor consent preferences.
 */

import { MloHubDB } from '../db';
import { SmsService } from './sms/SmsService';
import { SmsTemplates, SmsLanguage } from './sms/smsTemplates';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';

export type NotificationChannel = 'SMS' | 'IN_APP' | 'PUSH';

export type NotificationEventType =
  | 'ORDER_PLACED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_READY'
  | 'ORDER_DELIVERED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_CANCELLED'
  | 'VENDOR_APPROVED'
  | 'SECURITY_ALERT';

export interface NotificationPayload {
  userId?: string;
  recipientPhone?: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  language?: SmsLanguage;
  data?: Record<string, any>;
  forceSms?: boolean; // For critical security OTPs or vendor activations
}

export interface OrchestrationResult {
  inAppDelivered: boolean;
  smsDelivered: boolean;
  pushDelivered: boolean;
  smsMessageId?: string;
  error?: string;
}

export class NotificationOrchestrator {
  /**
   * Dispatch a notification across all enabled and preferred channels
   */
  public static async dispatch(payload: NotificationPayload): Promise<OrchestrationResult> {
    await MloHubDB.init();

    let userPrefersSms = true;
    let userPrefersInApp = true;
    let userPrefersPush = true;
    let phoneToUse = payload.recipientPhone;

    if (payload.userId) {
      const user = await MloHubDB.users.getById(payload.userId);
      if (user) {
        if (!phoneToUse && user.phone) {
          phoneToUse = user.phone;
        }
        if (user.notificationPreferences) {
          userPrefersSms = user.notificationPreferences.sms !== false;
          userPrefersInApp = user.notificationPreferences.inApp !== false;
          userPrefersPush = user.notificationPreferences.push !== false;
        }
      }
    }

    const result: OrchestrationResult = {
      inAppDelivered: false,
      smsDelivered: false,
      pushDelivered: false,
    };

    // 1. In-App Notification Delivery
    if (userPrefersInApp && payload.userId) {
      try {
        await MloHubDB.notifications.create({
          id: `notif_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
          userId: payload.userId,
          titleEn: payload.title,
          titleSw: payload.title,
          messageEn: payload.body,
          messageSw: payload.body,
          type: payload.eventType,
          category: 'general',
          isRead: false,
          timeAgoEn: 'Just now',
          timeAgoSw: 'Sasa hivi',
          createdAt: new Date().toISOString(),
        });
        result.inAppDelivered = true;

        // Broadcast realtime notification event
        RealtimeEventEngine.emit('notifications:created', {
          userId: payload.userId,
          title: payload.title,
          message: payload.body,
        });
      } catch (err) {
        console.warn('[NotificationOrchestrator] In-app notification creation failed:', err);
      }
    }

    // 2. Transactional SMS Delivery
    const shouldSendSms = payload.forceSms || (userPrefersSms && !!phoneToUse);
    if (shouldSendSms && phoneToUse) {
      try {
        const smsRes = await SmsService.sendNotification(
          phoneToUse,
          payload.body,
          payload.eventType
        );
        result.smsDelivered = smsRes.success;
        result.smsMessageId = smsRes.messageId;
      } catch (err: any) {
        result.error = err?.message;
        console.warn('[NotificationOrchestrator] SMS notification delivery failed:', err);
      }
    }

    // 3. Push Notification (Simulated in Stage 8)
    if (userPrefersPush) {
      result.pushDelivered = true;
    }

    return result;
  }
}
