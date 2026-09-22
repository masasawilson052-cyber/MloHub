import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const response = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function render(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => String(payload[key] ?? ''));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response(405, { success: false, error: 'METHOD_NOT_ALLOWED' });

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET');
  if (!serviceRoleKey || !supabaseUrl || !workerSecret || req.headers.get('x-worker-secret') !== workerSecret) {
    return response(401, { success: false, error: 'WORKER_UNAUTHORIZED' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const workerId = `notification-worker-${crypto.randomUUID()}`;
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(Math.max(Number(body.batchSize) || 10, 1), 50);

  const { data: events, error: claimError } = await admin.rpc('claim_outbox_events_secure', {
    p_worker_id: workerId,
    p_batch_size: batchSize,
    p_lease_seconds: 60,
  });
  if (claimError) return response(503, { success: false, error: 'OUTBOX_CLAIM_FAILED' });

  let processed = 0;
  let failed = 0;
  for (const event of events || []) {
    try {
      const { data: recipients, error: recipientError } = await admin.rpc('resolve_event_recipients', {
        p_event_type: event.event_type,
        p_aggregate_type: event.aggregate_type,
        p_aggregate_id: event.aggregate_id,
        p_payload: event.payload || {},
      });
      if (recipientError) throw recipientError;

      const { data: templateRows, error: templateError } = await admin
        .from('notification_templates')
        .select('event_type, locale, title_template, body_template, version')
        .eq('event_type', event.event_type)
        .eq('channel', 'IN_APP')
        .eq('is_active', true);
      if (templateError) throw templateError;

      const templates = new Map((templateRows || []).map((template) => [template.locale, template]));
      for (const recipient of recipients || []) {
        const template = templates.get(recipient.preferred_locale) || templates.get('en') || templates.get('sw');
        if (!template) continue;
        const payload = event.payload || {};
        const dedupeKey = `${event.id}:${recipient.recipient_user_id}:IN_APP`;
        const title = render(template.title_template, payload);
        const message = render(template.body_template, payload);
        const { error: notificationError } = await admin.from('notifications').upsert({
          id: `notif_${crypto.randomUUID()}`,
          user_id: recipient.recipient_user_id,
          type: event.event_type,
          category: 'SYSTEM',
          title_en: title,
          title_sw: title,
          message_en: message,
          message_sw: message,
          event_id: event.id,
          communication_class: event.communication_class,
          priority: event.priority,
          locale: recipient.preferred_locale,
          dedupe_key: dedupeKey,
          data: payload,
          created_at: new Date().toISOString(),
        }, { onConflict: 'user_id,dedupe_key' });
        if (notificationError) throw notificationError;
      }

      const { error: processedError } = await admin
        .from('notification_event_outbox')
        .update({ processing_status: 'PROCESSED', processed_at: new Date().toISOString(), lease_until: null, last_error: null })
        .eq('id', event.id)
        .eq('worker_id', workerId);
      if (processedError) throw processedError;
      processed += 1;
    } catch (error) {
      failed += 1;
      await admin.from('notification_event_outbox').update({
        processing_status: event.retry_count + 1 >= event.max_retries ? 'DEAD_LETTER' : 'FAILED',
        retry_count: event.retry_count + 1,
        next_retry_at: new Date(Date.now() + Math.min(300000, 30000 * (event.retry_count + 1))).toISOString(),
        last_error: error instanceof Error ? error.message : String(error),
        lease_until: null,
      }).eq('id', event.id).eq('worker_id', workerId);
    }
  }

  return response(200, { success: true, workerId, claimed: (events || []).length, processed, failed });
});
