import {
  NotificationEventOutbox,
  NotificationEventType,
  NotificationPriority,
  CommunicationClass,
  NotificationChannel,
} from '../../types/domain';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { NotificationRepository } from '../../repositories/notifications.repository';
import { NotificationOutboxRepository } from '../../repositories/notificationOutbox.repository';
import { NotificationDeliveriesRepository } from '../../repositories/notificationDeliveries.repository';
import { NotificationPreferencesRepository } from '../../repositories/notificationPreferences.repository';
import { PushDevicesRepository } from '../../repositories/pushDevices.repository';
import { ProfilesRepository } from '../../repositories/profiles.repository';
import { RealtimeEventEngine } from '../../db/realtime/eventEngine';
import { DeliveryPolicy } from './DeliveryPolicy';
import { TemplateRenderer } from './TemplateRenderer';
import { RecipientResolver, ResolvedRecipient } from './RecipientResolver';
import { PushProvider } from './providers/PushProvider';
import { SmsNotificationProvider } from './providers/SmsProvider';
import { EmailProvider } from './providers/EmailProvider';

export interface ProcessEventResult {
  eventId: string;
  notificationsCreated: number;
  deliveriesDispatched: number;
  errors: string[];
}

export class NotificationEngine {
  /**
   * Main entrypoint to emit an event and process its end-to-end multi-channel delivery.
   * Atomic local write + safe decoupled dispatch.
   * NEVER throws an unhandled exception to business callers.
   */
  public static async emitAndProcess(params: {
    eventType: NotificationEventType;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, any>;
    idempotencyKey?: string;
    priority?: NotificationPriority;
    communicationClass?: CommunicationClass;
  }): Promise<ProcessEventResult> {
    const errors: string[] = [];
    let eventId = '';

    try {
      // 1. Emit to outbox (with deduplication key)
      eventId = await NotificationOutboxRepository.emitEvent({
        eventType: params.eventType,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        payload: params.payload,
        idempotencyKey: params.idempotencyKey,
        priority: params.priority || 'NORMAL',
        communicationClass: params.communicationClass || 'TRANSACTIONAL',
      });
    } catch (err: any) {
      console.warn(`NotificationEngine: Outbox emission warning for ${params.aggregateId}:`, err.message);
      errors.push(`Outbox emission: ${err.message}`);
      eventId = `fallback_nevt_${Date.now()}`;
    }

    // 2. Process the event
    try {
      return await this.processEvent({
        id: eventId,
        eventType: params.eventType,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        payload: params.payload,
        idempotencyKey: params.idempotencyKey || `idem_${Date.now()}`,
        priority: params.priority || 'NORMAL',
        communicationClass: params.communicationClass || 'TRANSACTIONAL',
        processingStatus: 'PENDING',
        retryCount: 0,
        maxRetries: 5,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn(`NotificationEngine: Event processing warning for ${eventId}:`, err.message);
      errors.push(`Processing: ${err.message}`);
      return {
        eventId,
        notificationsCreated: 0,
        deliveriesDispatched: 0,
        errors,
      };
    }
  }

  /**
   * Stale Domain Event Evaluation:
   * Checks whether the underlying aggregate has already transitioned past the event stage.
   * Example: If an ORDER_ACCEPTED event is processed when the order is already COMPLETED or CANCELLED,
   * external push/SMS delivery must be skipped to avoid customer confusion.
   */
  public static async isEventStale(event: NotificationEventOutbox): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
      if (event.aggregateType === 'ORDER') {
        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('id', event.aggregateId)
          .maybeSingle();

        if (order) {
          const terminalOrderStates = ['COMPLETED', 'CANCELLED'];
          const earlyOrderEvents = ['ORDER_CREATED', 'ORDER_ACCEPTED', 'ORDER_PREPARING'];

          if (terminalOrderStates.includes(order.status) && earlyOrderEvents.includes(event.eventType)) {
            return true;
          }
        }
      } else if (event.aggregateType === 'RESERVATION') {
        const { data: res } = await supabase
          .from('reservations')
          .select('status')
          .eq('id', event.aggregateId)
          .maybeSingle();

        if (res) {
          const terminalResStates = ['CANCELLED', 'REJECTED', 'COMPLETED', 'NO_SHOW'];
          if (terminalResStates.includes(res.status) && event.eventType === 'RESERVATION_REMINDER') {
            return true;
          }
        }
      }
    } catch (err: any) {
      console.warn('NotificationEngine.isEventStale check error:', err.message);
    }
    return false;
  }

  /**
   * Process a single outbox event:
   * Recipient resolution -> Stale Check -> Preferences / Quiet Hours -> In-App -> Snapshotting -> Push / SMS / Email
   */
  public static async processEvent(event: NotificationEventOutbox): Promise<ProcessEventResult> {
    const errors: string[] = [];
    let notifsCount = 0;
    let deliveriesCount = 0;

    try {
      // 1. Resolve recipients server-authoritatively
      const recipients = await RecipientResolver.resolve({
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
      });

      if (recipients.length === 0) {
        await NotificationOutboxRepository.updateEventStatus(event.id, 'PROCESSED');
        return { eventId: event.id, notificationsCreated: 0, deliveriesDispatched: 0, errors };
      }

      // 2. Check if event is superseded / stale
      const stale = await this.isEventStale(event);
      if (stale) {
        console.log(`NotificationEngine: Event ${event.id} is stale/superseded. Skipping external deliveries.`);
        await NotificationOutboxRepository.updateEventStatus(event.id, 'PROCESSED');
        return { eventId: event.id, notificationsCreated: 0, deliveriesDispatched: 0, errors: ['EVENT_SUPERSEDED'] };
      }

      // 3. For each recipient, render templates, snapshot metadata, and dispatch channels
      for (const recipient of recipients) {
        try {
          const userPreferences = await NotificationPreferencesRepository.getPreferences(recipient.userId);
          const inAppPref = userPreferences.find((p) => p.channel === 'IN_APP');
          const pushPref = userPreferences.find((p) => p.channel === 'PUSH');
          const smsPref = userPreferences.find((p) => p.channel === 'SMS');
          const emailPref = userPreferences.find((p) => p.channel === 'EMAIL');

          // Render In-App content
          const inAppContent = await TemplateRenderer.render({
            eventType: event.eventType,
            channel: 'IN_APP',
            locale: recipient.preferredLocale,
            payload: event.payload,
          });

          // In-App Evaluation
          const inAppReachability = DeliveryPolicy.evaluate({
            channel: 'IN_APP',
            communicationClass: event.communicationClass,
            priority: event.priority,
            preference: inAppPref,
          });

          let inAppRecord: any = null;
          if (inAppReachability.reachable) {
            const dedupeKey = `dedupe_${event.id}_${recipient.userId}`;
            try {
              inAppRecord = await NotificationRepository.createNotification({
                userId: recipient.userId,
                type: event.eventType,
                category: this.mapCategory(event.aggregateType),
                titleEn: inAppContent.title,
                titleSw: inAppContent.title,
                messageEn: inAppContent.body,
                messageSw: inAppContent.body,
                isRead: false,
                orderId: event.aggregateType === 'ORDER' ? event.aggregateId : undefined,
                restaurantId: event.payload.restaurant_id || event.payload.restaurantId,
                payload: event.payload,
                eventId: event.id,
                communicationClass: event.communicationClass,
                priority: event.priority,
                locale: recipient.preferredLocale,
                dedupeKey,
              });
              notifsCount++;

              // Realtime Broadcast for active sessions (strictly scoped to recipient channel)
              RealtimeEventEngine.emit(`user:${recipient.userId}:notifications`, {
                eventType: 'NOTIFICATION_RECEIVED',
                data: inAppRecord,
                timestamp: new Date().toISOString(),
              });
            } catch (createErr: any) {
              console.warn(`NotificationEngine: in-app insert dedupe for ${recipient.userId}:`, createErr.message);
            }
          }

          // Fetch profile for phone and email if external delivery might be needed
          const userProfile = await ProfilesRepository.findById(recipient.userId);

          // PUSH Dispatch
          const pushReachability = DeliveryPolicy.evaluate({
            channel: 'PUSH',
            communicationClass: event.communicationClass,
            priority: event.priority,
            preference: pushPref,
          });

          if (pushReachability.reachable) {
            const activeTokens = await PushDevicesRepository.getActiveTokensForUser(recipient.userId);
            for (const tokenRecord of activeTokens) {
              const pushContent = await TemplateRenderer.render({
                eventType: event.eventType,
                channel: 'PUSH',
                locale: recipient.preferredLocale,
                payload: event.payload,
              });

              const idempotencyKey = `ndel_push_${event.id}_${tokenRecord.id}`;
              const startTime = Date.now();

              // Snapshot template version and rendered title/body at send time
              const delivery = await NotificationDeliveriesRepository.createDelivery({
                notificationId: inAppRecord?.id,
                outboxEventId: event.id,
                userId: recipient.userId,
                channel: 'PUSH',
                recipientAddress: tokenRecord.token,
                provider: 'EXPO',
                status: 'PENDING',
                idempotencyKey,
                templateId: pushContent.templateId,
                templateVersion: pushContent.templateVersion,
                locale: recipient.preferredLocale,
                renderedTitle: pushContent.title,
                renderedBody: pushContent.body,
              });

              const pushResult = await PushProvider.sendPush({
                token: tokenRecord.token,
                title: pushContent.title,
                body: pushContent.body,
                data: {
                  notificationId: inAppRecord?.id,
                  eventId: event.id,
                  aggregateType: event.aggregateType,
                  aggregateId: event.aggregateId,
                },
              });

              const durationMs = Date.now() - startTime;
              await NotificationDeliveriesRepository.recordAttempt({
                deliveryId: delivery.id,
                provider: 'EXPO',
                status: pushResult.success
                  ? 'PROVIDER_ACCEPTED'
                  : pushResult.isDeviceNotRegistered
                  ? 'FAILED_PERMANENT'
                  : 'FAILED_RETRYABLE',
                providerMsgId: pushResult.providerMessageId,
                statusCode: pushResult.statusCode,
                errorCode: pushResult.error,
                errorMessage: pushResult.error,
                durationMs,
              });
              deliveriesCount++;
            }
          }

          // SMS Dispatch (for Critical / Important Transactional events)
          const isSmsEligible =
            event.priority === 'CRITICAL' ||
            event.eventType === 'ORDER_READY' ||
            event.eventType === 'RESERVATION_REMINDER' ||
            event.eventType === 'RESERVATION_CONFIRMED' ||
            event.communicationClass === 'SECURITY';

          if (isSmsEligible && userProfile?.phone) {
            const smsReachability = DeliveryPolicy.evaluate({
              channel: 'SMS',
              communicationClass: event.communicationClass,
              priority: event.priority,
              preference: smsPref,
            });

            if (smsReachability.reachable) {
              const smsContent = await TemplateRenderer.render({
                eventType: event.eventType,
                channel: 'SMS',
                locale: recipient.preferredLocale,
                payload: event.payload,
              });

              const idempotencyKey = `ndel_sms_${event.id}_${recipient.userId}`;
              const startTime = Date.now();

              // Snapshot template metadata
              const delivery = await NotificationDeliveriesRepository.createDelivery({
                notificationId: inAppRecord?.id,
                outboxEventId: event.id,
                userId: recipient.userId,
                channel: 'SMS',
                recipientAddress: userProfile.phone,
                provider: 'SMS_GATEWAY',
                status: 'PENDING',
                idempotencyKey,
                templateId: smsContent.templateId,
                templateVersion: smsContent.templateVersion,
                locale: recipient.preferredLocale,
                renderedTitle: smsContent.title,
                renderedBody: smsContent.body,
              });

              const smsResult = await SmsNotificationProvider.sendSms({
                phone: userProfile.phone,
                message: smsContent.body,
              });

              const durationMs = Date.now() - startTime;
              await NotificationDeliveriesRepository.recordAttempt({
                deliveryId: delivery.id,
                provider: smsResult.provider,
                status: smsResult.success
                  ? 'PROVIDER_ACCEPTED'
                  : smsResult.isSuppressed
                  ? 'SUPPRESSED'
                  : 'FAILED_RETRYABLE',
                providerMsgId: smsResult.providerMessageId,
                statusCode: smsResult.statusCode ? String(smsResult.statusCode) : undefined,
                errorCode: smsResult.error,
                errorMessage: smsResult.error,
                durationMs,
              });
              deliveriesCount++;
            }
          }

          // EMAIL Dispatch (e.g. Order Completed / Invoices / Security)
          const isEmailEligible =
            event.eventType === 'ORDER_COMPLETED' ||
            event.eventType === 'PAYMENT_CONFIRMED' ||
            event.communicationClass === 'SECURITY';

          if (isEmailEligible && userProfile?.email) {
            const emailReachability = DeliveryPolicy.evaluate({
              channel: 'EMAIL',
              communicationClass: event.communicationClass,
              priority: event.priority,
              preference: emailPref,
            });

            if (emailReachability.reachable) {
              const emailContent = await TemplateRenderer.render({
                eventType: event.eventType,
                channel: 'EMAIL',
                locale: recipient.preferredLocale,
                payload: event.payload,
              });

              const idempotencyKey = `ndel_email_${event.id}_${recipient.userId}`;
              const startTime = Date.now();

              // Snapshot template metadata
              const delivery = await NotificationDeliveriesRepository.createDelivery({
                notificationId: inAppRecord?.id,
                outboxEventId: event.id,
                userId: recipient.userId,
                channel: 'EMAIL',
                recipientAddress: userProfile.email,
                provider: 'EMAIL_GATEWAY',
                status: 'PENDING',
                idempotencyKey,
                templateId: emailContent.templateId,
                templateVersion: emailContent.templateVersion,
                locale: recipient.preferredLocale,
                renderedTitle: emailContent.title,
                renderedBody: emailContent.body,
              });

              const emailResult = await EmailProvider.sendEmail({
                to: userProfile.email,
                subject: emailContent.title,
                textBody: emailContent.body,
              });

              const durationMs = Date.now() - startTime;
              await NotificationDeliveriesRepository.recordAttempt({
                deliveryId: delivery.id,
                provider: emailResult.provider,
                status: emailResult.success
                  ? 'PROVIDER_ACCEPTED'
                  : emailResult.isSuppressed
                  ? 'SUPPRESSED'
                  : 'FAILED_RETRYABLE',
                providerMsgId: emailResult.providerMessageId,
                statusCode: emailResult.statusCode ? String(emailResult.statusCode) : undefined,
                errorCode: emailResult.error,
                errorMessage: emailResult.error,
                durationMs,
              });
              deliveriesCount++;
            }
          }
        } catch (recipErr: any) {
          console.warn(`NotificationEngine: Error delivering to recipient ${recipient.userId}:`, recipErr.message);
          errors.push(`Recipient ${recipient.userId}: ${recipErr.message}`);
        }
      }

      // Mark outbox event processed
      await NotificationOutboxRepository.updateEventStatus(event.id, 'PROCESSED');
    } catch (err: any) {
      console.warn(`NotificationEngine: Fatal error processing event ${event.id}:`, err.message);
      errors.push(err.message);
      await NotificationOutboxRepository.updateEventStatus(event.id, 'FAILED', err.message);
    }

    return {
      eventId: event.id,
      notificationsCreated: notifsCount,
      deliveriesDispatched: deliveriesCount,
      errors,
    };
  }

  /**
   * Reservation Reminder Scheduling:
   * Idempotently emits 24h or 2h reminders with dedupe key `reservation_reminder_{window}_{reservationId}`.
   * Skips reminder if reservation is CANCELLED, REJECTED, or COMPLETED.
   */
  public static async scheduleReservationReminder(params: {
    reservationId: string;
    window: '24h' | '2h';
  }): Promise<{ emitted: boolean; reason?: string; eventId?: string }> {
    if (!isSupabaseConfigured()) {
      return { emitted: false, reason: 'SUPABASE_NOT_CONFIGURED' };
    }

    const { data: res, error } = await supabase
      .from('reservations')
      .select('id, user_id, restaurant_id, party_size, reservation_date, reservation_time, status')
      .eq('id', params.reservationId)
      .maybeSingle();

    if (error || !res) {
      return { emitted: false, reason: 'RESERVATION_NOT_FOUND' };
    }

    if (res.status === 'CANCELLED' || res.status === 'REJECTED' || res.status === 'COMPLETED' || res.status === 'NO_SHOW') {
      return { emitted: false, reason: `RESERVATION_${res.status}` };
    }

    const dedupeKey = `reservation_reminder_${params.window}_${res.id}`;
    const eventId = await NotificationOutboxRepository.emitEvent({
      eventType: 'RESERVATION_REMINDER',
      aggregateType: 'RESERVATION',
      aggregateId: res.id,
      payload: {
        reservation_id: res.id,
        user_id: res.user_id,
        restaurant_id: res.restaurant_id,
        party_size: res.party_size,
        reservation_date: res.reservation_date,
        reservation_time: res.reservation_time,
        window: params.window,
      },
      idempotencyKey: dedupeKey,
      priority: 'HIGH',
      communicationClass: 'REMINDER',
    });

    return { emitted: true, eventId };
  }

  /**
   * Worker Claim and Batch Processing:
   * Claims pending outbox events concurrently using FOR UPDATE SKIP LOCKED with worker leases.
   */
  public static async claimAndProcessBatch(
    workerId: string,
    batchSize: number = 10,
    leaseSeconds: number = 60
  ): Promise<ProcessEventResult[]> {
    const claimedEvents = await NotificationOutboxRepository.claimEvents(workerId, batchSize, leaseSeconds);
    const results: ProcessEventResult[] = [];

    for (const event of claimedEvents) {
      const res = await this.processEvent(event);
      results.push(res);
    }

    return results;
  }

  private static mapCategory(aggregateType: string): 'ORDER' | 'PAYMENT' | 'SYSTEM' | 'RESTAURANT' | 'QUOTE' {
    switch (aggregateType) {
      case 'ORDER':
        return 'ORDER';
      case 'PAYMENT':
      case 'REFUND':
      case 'SETTLEMENT':
        return 'PAYMENT';
      case 'RESERVATION':
      case 'RESTAURANT':
        return 'RESTAURANT';
      case 'CUSTOM_MEAL':
        return 'QUOTE';
      default:
        return 'SYSTEM';
    }
  }
}
