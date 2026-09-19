import { supabase, supabaseAdmin, isSupabaseConfigured } from '../lib/supabase';
import {
  NotificationEventOutbox,
  NotificationEventType,
  NotificationPriority,
  CommunicationClass,
} from '../types/domain';

export class NotificationOutboxRepository {
  private static mapRowToOutbox(row: any): NotificationEventOutbox {
    return {
      id: row.id,
      eventType: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      payload: row.payload || {},
      idempotencyKey: row.idempotency_key,
      priority: row.priority || 'NORMAL',
      communicationClass: row.communication_class || 'TRANSACTIONAL',
      processingStatus: row.processing_status || 'PENDING',
      retryCount: row.retry_count || 0,
      maxRetries: row.max_retries || 5,
      nextRetryAt: row.next_retry_at,
      processedAt: row.processed_at,
      lastError: row.last_error,
      workerId: row.worker_id,
      claimedAt: row.claimed_at,
      leaseUntil: row.lease_until,
      createdAt: row.created_at,
    };
  }

  public static async emitEvent(params: {
    eventType: NotificationEventType;
    aggregateType: string;
    aggregateId: string;
    payload?: Record<string, any>;
    idempotencyKey?: string;
    priority?: NotificationPriority;
    communicationClass?: CommunicationClass;
  }): Promise<string> {
    if (!isSupabaseConfigured()) {
      return `nevt_mock_${Date.now()}`;
    }

    const { data, error } = await supabase.rpc('emit_notification_event', {
      p_event_type: params.eventType,
      p_aggregate_type: params.aggregateType,
      p_aggregate_id: params.aggregateId,
      p_payload: params.payload || {},
      p_idempotency_key: params.idempotencyKey || null,
      p_priority: params.priority || 'NORMAL',
      p_communication_class: params.communicationClass || 'TRANSACTIONAL',
    });

    if (error) {
      console.error('NotificationOutboxRepository.emitEvent error:', error.message);
      throw new Error(`Failed to emit notification event: ${error.message}`);
    }

    return data as string;
  }

  public static async getEventById(id: string): Promise<NotificationEventOutbox | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('notification_event_outbox')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`NotificationOutboxRepository.getEventById(${id}) error:`, error.message);
      return null;
    }

    return data ? this.mapRowToOutbox(data) : null;
  }

  /**
   * Concurrently claim pending outbox events using FOR UPDATE SKIP LOCKED
   */
  public static async claimEvents(
    workerId: string,
    batchSize: number = 10,
    leaseSeconds: number = 60
  ): Promise<NotificationEventOutbox[]> {
    if (!isSupabaseConfigured()) return [];

    const client = supabaseAdmin || supabase;
    const { data, error } = await client.rpc('claim_outbox_events_secure', {
      p_worker_id: workerId,
      p_batch_size: batchSize,
      p_lease_seconds: leaseSeconds,
    });

    if (error) {
      console.error('NotificationOutboxRepository.claimEvents error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToOutbox);
  }

  public static async listPendingEvents(limit: number = 20): Promise<NotificationEventOutbox[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('notification_event_outbox')
      .select('*')
      .in('processing_status', ['PENDING', 'FAILED'])
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('NotificationOutboxRepository.listPendingEvents error:', error.message);
      return [];
    }

    return (data || []).map(this.mapRowToOutbox);
  }

  public static async updateEventStatus(
    id: string,
    status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'DEAD_LETTER',
    error?: string
  ): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const updatePayload: Record<string, any> = {
      processing_status: status,
      last_error: error || null,
    };

    if (status === 'PROCESSED') {
      updatePayload.processed_at = new Date().toISOString();
    }

    const client = supabaseAdmin || supabase;
    const { error: dbError } = await client
      .from('notification_event_outbox')
      .update(updatePayload)
      .eq('id', id);

    if (dbError) {
      console.error(`NotificationOutboxRepository.updateEventStatus(${id}) error:`, dbError.message);
    }
  }
}
