/**
 * ============================================================================
 * MLOHUB CANONICAL TEST ENVIRONMENT & SUPABASE CONNECTION BOOTSTRAPPER
 * ============================================================================
 * Resolves identical local Supabase credentials and fail-closed validation
 * across all E2E test suites and integration probes.
 *
 * Invariants:
 * 1. Resolves canonical local Supabase endpoint (http://127.0.0.1:54321) and keys.
 * 2. In production mode, strictly fails closed if configuration is missing.
 * 3. Never falls back to non-existent mock endpoints (like placeholder.supabase.co).
 * 4. Provides authoritative health probe for Supabase GoTrue Auth service.
 * ============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
export const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export interface TestEnvConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  isLocal: boolean;
}

export function initTestEnv(): TestEnvConfig {
  const isProduction =
    (process.env.NODE_ENV || '').toLowerCase() === 'production' ||
    (process.env.EXPO_PUBLIC_APP_ENV || '').toLowerCase() === 'production';

  if (isProduction) {
    const prodUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const prodKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!prodUrl || !prodKey || prodUrl.includes('placeholder') || prodUrl.includes('example')) {
      throw new Error(
        '[MLOHUB CRITICAL] Production mode requires real Supabase configuration. Missing EXPO_PUBLIC_SUPABASE_URL or anon key.'
      );
    }
    return {
      supabaseUrl: prodUrl,
      anonKey: prodKey,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      isLocal: false,
    };
  }

  // In non-production test / dev execution, populate env variables if unset
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = LOCAL_SUPABASE_URL;
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = LOCAL_SUPABASE_ANON_KEY;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!process.env.EXPO_PUBLIC_APP_ENV) {
    process.env.EXPO_PUBLIC_APP_ENV = 'development';
  }

  return {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    isLocal:
      process.env.EXPO_PUBLIC_SUPABASE_URL.includes('127.0.0.1') ||
      process.env.EXPO_PUBLIC_SUPABASE_URL.includes('localhost'),
  };
}

// Auto-run on import to ensure early environment bootstrapping before other modules evaluate
export const testConfig = initTestEnv();

/**
 * Validates that Supabase GoTrue Auth service is running, responsive, and returning HTTP 200.
 * Fails closed if the service is unreachable.
 */
export async function verifySupabaseAuthHealth(
  targetUrl?: string
): Promise<{ healthy: boolean; version?: string; message: string }> {
  const url = (targetUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/$/, '');
  const healthUrl = `${url}/auth/v1/health`;

  try {
    const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      throw new Error(`Auth health endpoint returned HTTP ${res.status}: ${res.statusText}`);
    }
    const body: any = await res.json();
    return {
      healthy: true,
      version: body.version,
      message: `Supabase GoTrue Auth service is healthy at ${url} (version: ${body.version || 'unknown'})`,
    };
  } catch (err: any) {
    throw new Error(`[FAIL-CLOSED] Supabase Auth health check failed at ${healthUrl}: ${err.message}`);
  }
}

/**
 * Creates a privileged service_role client for test setup/teardown.
 */
export function getTestAdminClient(): SupabaseClient {
  return createClient(testConfig.supabaseUrl, testConfig.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
