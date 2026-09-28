/**
 * Production Rate Limiter Utility for Supabase Edge Functions
 * 
 * Provides atomic database-backed rate limiting with transactional advisory locking (consume_rate_limit RPC)
 * with graceful fallback to public.api_rate_limits.
 * Sensitive endpoints fail-closed on rate-limiting infrastructure failure.
 */

// Isomorphic SupabaseClient typing compatible with both Deno runtime and Node.js test runners
type SupabaseClient = any;

export interface RateLimitOptions {
  key: string;
  action: string;
  maxHits: number;
  windowSeconds: number;
  ipAddress?: string;
  identifier?: string;
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  currentHits: number;
}

export const SENSITIVE_RATE_LIMIT_ACTIONS = new Set([
  'CREATE_PAYMENT',
  'VERIFY_OTP',
  'SEND_OTP',
  'ADMIN_MFA',
]);

/**
 * Extracts the real client IP address from standard reverse proxy headers.
 */
export function getRequestIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }

  return 'unknown';
}

/**
 * Enforces rate limiting against public.api_rate_limits via atomic consume_rate_limit RPC.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const isSensitive = options.failClosed || SENSITIVE_RATE_LIMIT_ACTIONS.has(options.action);

  try {
    // 1. Primary: Atomic consume_rate_limit RPC
    if (typeof supabase.rpc === 'function') {
      const { data, error } = await supabase.rpc('consume_rate_limit', {
        p_rate_key: options.key,
        p_action: options.action,
        p_max_hits: options.maxHits,
        p_window_seconds: options.windowSeconds,
        p_ip_address: options.ipAddress || null,
        p_identifier: options.identifier || null,
      });

      if (!error && data && typeof data === 'object') {
        return {
          allowed: Boolean(data.allowed),
          remaining: Number(data.remaining ?? 0),
          resetAt: new Date(data.reset_at),
          currentHits: Number(data.current_hits ?? 1),
        };
      }

      if (error) {
        console.warn('[RateLimit] consume_rate_limit RPC error:', error.message);
        if (isSensitive) {
          // Sensitive endpoints fail closed on error
          return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(Date.now() + options.windowSeconds * 1000),
            currentHits: options.maxHits,
          };
        }
      }
    }

    // 2. Fallback: Table-level queries (for offline/mock environments)
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: existing, error: queryError } = await supabase
      .from('api_rate_limits')
      .select('id, hits, window_end')
      .eq('rate_key', options.key)
      .eq('action', options.action)
      .gt('window_end', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.warn('[RateLimit] Query error:', queryError.message);
      if (isSensitive) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(now.getTime() + options.windowSeconds * 1000),
          currentHits: options.maxHits,
        };
      }
      return {
        allowed: true,
        remaining: options.maxHits,
        resetAt: new Date(now.getTime() + options.windowSeconds * 1000),
        currentHits: 1,
      };
    }

    if (existing) {
      const resetAt = new Date(existing.window_end);
      if (existing.hits >= options.maxHits) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          currentHits: existing.hits,
        };
      }

      const updatedHits = existing.hits + 1;
      await supabase
        .from('api_rate_limits')
        .update({ hits: updatedHits })
        .eq('id', existing.id);

      return {
        allowed: true,
        remaining: Math.max(0, options.maxHits - updatedHits),
        resetAt,
        currentHits: updatedHits,
      };
    }

    const windowEnd = new Date(now.getTime() + options.windowSeconds * 1000);
    await supabase.from('api_rate_limits').insert({
      rate_key: options.key,
      action: options.action,
      ip_address: options.ipAddress || null,
      identifier: options.identifier || null,
      hits: 1,
      window_start: nowIso,
      window_end: windowEnd.toISOString(),
    });

    return {
      allowed: true,
      remaining: options.maxHits - 1,
      resetAt: windowEnd,
      currentHits: 1,
    };
  } catch (err: any) {
    console.error('[RateLimit] Unexpected error enforcing rate limit:', err?.message || err);
    if (isSensitive) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + options.windowSeconds * 1000),
        currentHits: options.maxHits,
      };
    }
    return {
      allowed: true,
      remaining: 1,
      resetAt: new Date(Date.now() + options.windowSeconds * 1000),
      currentHits: 1,
    };
  }
}
