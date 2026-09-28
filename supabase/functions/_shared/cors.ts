/**
 * Production Restricted CORS Configuration for Supabase Edge Functions
 * 
 * Implements origin validation for web clients while permitting native mobile
 * clients (which do not transmit a web Origin header).
 */

export const ALLOWED_WEB_ORIGINS: readonly string[] = [
  'https://mlohub.co.tz',
  'https://www.mlohub.co.tz',
  'https://admin.mlohub.co.tz',
  'https://portal.mlohub.co.tz',
  'https://mlohub.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
];

const STANDARD_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-clickpesa-signature, clickpesa-signature, x-selcom-signature, selcom-signature, digest, timestamp, idempotency-key';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': STANDARD_ALLOW_HEADERS,
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/**
 * Returns origin-restricted CORS headers for an incoming HTTP request.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');

  // Native apps or direct server requests don't provide an Origin header
  if (!origin || origin === 'null') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': STANDARD_ALLOW_HEADERS,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    };
  }

  // Check exact allowed origins or local development origins
  const isAllowed =
    ALLOWED_WEB_ORIGINS.includes(origin) ||
    /^https:\/\/([a-zA-Z0-9-]+\.)?mlohub\.co\.tz$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);

  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': STANDARD_ALLOW_HEADERS,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
  }

  // Fail-closed for disallowed foreign web origins
  return {
    'Access-Control-Allow-Origin': 'https://mlohub.co.tz',
    'Access-Control-Allow-Headers': STANDARD_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}
