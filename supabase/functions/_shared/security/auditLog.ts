/**
 * Production Security Audit Log Utility for Supabase Edge Functions
 * 
 * Safely persists security alerts, access violations, rate limit violations,
 * and suspicious gateway activities to public.security_events.
 */

// Isomorphic SupabaseClient typing compatible with both Deno runtime and Node.js test runners
type SupabaseClient = any;

export interface SecurityEventPayload {
  eventType: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, any>;
}

/**
 * Records a security event to public.security_events.
 * This operation is non-blocking and will never throw an exception to callers.
 */
export async function recordSecurityEvent(
  supabase: SupabaseClient,
  event: SecurityEventPayload
): Promise<void> {
  try {
    const { error } = await supabase.from('security_events').insert({
      event_type: event.eventType,
      severity: event.severity || 'MEDIUM',
      actor_id: event.actorId || null,
      ip_address: event.ipAddress || null,
      user_agent: event.userAgent || null,
      endpoint: event.endpoint || null,
      details: event.details || {},
    });

    if (error) {
      console.warn('[SecurityAudit] Failed to record security event:', error.message);
    }
  } catch (err: any) {
    console.warn('[SecurityAudit] Unexpected error logging security event:', err?.message || err);
  }
}
