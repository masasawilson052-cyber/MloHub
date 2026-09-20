import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  NotificationDelivery,
  NotificationDeliveryAttempt,
  NotificationDeliveryStatus,
  NotificationChannel,
} from '../types/domain';

export class NotificationDeliveriesRepository {
  private static mapRowToDelivery(row: any): NotificationDelivery {
    return {
      id: row.id,
      notificationId: row.notification_id,
      outboxEventId: row.outbox_event_id,
      userId: row.user_id,
      channel: row.channel,
      recipientAddress: row.recipient_address,
      provider: row.provider,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      attemptCount: row.attempt_count || 0,
      maxAttempts: row.max_attempts || 3,
      nextAttemptAt: row.next_attempt_at,
      lastAttemptAt: row.last_attempt_at,
      providerMessageId: row.provider_message_id,
      providerResponse: row.provider_response || {},
      errorCode: row.error_code,
      errorMessage: row.error_message,
      deliveredAt: row.delivered_at,
      workerId: row.worker_id,
      claimedAt: row.claimed_at,
      leaseUntil: row.lease_until,
      templateId: row.template_id,
      templateVersion: row.template_version,
      locale: row.locale,
      renderedTitle: row.rendered_title,
      renderedBody: row.rendered_body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapRowToAttempt(row: any): NotificationDeliveryAttempt {
    return {
      id: row.id,
      deliveryId: row.delivery_id,
      attemptNumber: row.attempt_number,
      channel: row.channel,
      provider: row.provider,
      status: row.status,
      providerMessageId: row.provider_message_id,
      providerStatusCode: row.provider_status_code,
      providerRawResponse: row.provider_raw_response || {},
      errorCode: row.error_code,
      errorMessage: row.error_message,
      attemptedAt: row.attempted_at,
      durationMs: row.duration_ms || 0,
    };
  }

  /**
   * Sanitizes raw provider responses before persisting:
   * Strips authentication tokens, OTPs, PINs, secrets, and private credentials.
   */
  public static sanitizeResponse(raw?: Record<string, any>): Record<string, any> {
    if (!raw || typeof raw !== 'object') return {};
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = new Set([
      'authorization',
      'authorization_header',
      'token',
      'accesstoken',
      'access_token',
      'bearer',
      'otp',
      'pin',
      'password',
      'secret',
      'apikey',
      'api_key',
      'key',
    ]);

    for (const [k, v] of Object.entries(raw)) {
      if (!sensitiveKeys.has(k.toLowerCase())) {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  public static async createDelivery(delivery: {
    notificationId?: string;
    outboxEventId?: string;
    userId: string;
    channel: NotificationChannel;
    recipientAddress: string;
    provider: string;
    status?: NotificationDeliveryStatus;
    idempotencyKey: string;
    maxAttempts?: number;
    templateId?: string;
    templateVersion?: number;
    locale?: string;
    renderedTitle?: string;
    renderedBody?: string;
  }): Promise<NotificationDelivery> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row: Record<string, any> = {
      id: `ndel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      notification_id: delivery.notificationId || null,
      outbox_event_id: delivery.outboxEventId || null,
      user_id: delivery.userId,
      channel: delivery.channel,
      recipient_address: delivery.recipientAddress,
      provider: delivery.provider,
      status: delivery.status || 'PENDING',
      idempotency_key: delivery.idempotencyKey,
      max_attempts: delivery.maxAttempts || 3,
      template_id: delivery.templateId || null,
      template_version: delivery.templateVersion || null,
      locale: delivery.locale || 'sw',
      rendered_title: delivery.renderedTitle || null,
      rendered_body: delivery.renderedBody || null,
    };

    const { data, error } = await supabase
      .from('notification_deliveries')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('NotificationDeliveriesRepository.createDelivery error:', error.message);
      throw new Error(`Failed to create delivery: ${error.message}`);
    }

    return this.mapRowToDelivery(data);
  }

  public static async recordAttempt(params: {
    deliveryId: string;
    provider: string;
    status: NotificationDeliveryStatus;
    providerMsgId?: string;
    statusCode?: string;
    rawResponse?: Record<string, any>;
    errorCode?: string;
    errorMessage?: string;
    durationMs?: number;
  }): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const safeResponse = this.sanitizeResponse(params.rawResponse);

    const { error } = await supabase.rpc('record_delivery_attempt_secure', {
      p_delivery_id: params.deliveryId,
      p_provider: params.provider,
      p_status: params.status,
      p_provider_msg_id: params.providerMsgId || null,
      p_status_code: params.statusCode || null,
      p_raw_response: safeResponse,
      p_error_code: params.errorCode || null,
      p_error_message: params.errorMessage || null,
      p_duration_ms: params.durationMs || 0,
    });

    if (error) {
      console.error('NotificationDeliveriesRepository.recordAttempt error:', error.message);
      throw new Error(`Failed to record delivery attempt: ${error.message}`);
    }
  }

  /**
   * Concurrently claims pending deliveries using database-level FOR UPDATE SKIP LOCKED
   * with worker leases and lease expiration recovery.
   */
  public static async claimDeliveries(
    workerId: string,
    batchSize: number = 10,
    leaseSeconds: number = 60
  ): Promise<NotificationDelivery[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase.rpc('claim_pending_deliveries_secure', {
      p_worker_id: workerId,
      p_batch_size: batchSize,
      p_lease_seconds: leaseSeconds,
    });

    if (error) {
      console.error('NotificationDeliveriesRepository.claimDeliveries error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToDelivery);
  }

  public static async getDelivery(id: string): Promise<NotificationDelivery | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('notification_deliveries')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`NotificationDeliveriesRepository.getDelivery(${id}) error:`, error.message);
      return null;
    }

    return data ? this.mapRowToDelivery(data) : null;
  }

  public static async getAttemptsForDelivery(deliveryId: string): Promise<NotificationDeliveryAttempt[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('notification_delivery_attempts')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('attempt_number', { ascending: true });

    if (error) {
      console.error(`NotificationDeliveriesRepository.getAttemptsForDelivery(${deliveryId}) error:`, error.message);
      return [];
    }

    return (data || []).map(this.mapRowToAttempt);
  }
}
