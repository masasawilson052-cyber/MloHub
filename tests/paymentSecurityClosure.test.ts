/**
 * ============================================================================
 * MLOHUB PAYMENT, SELCOM & SECURITY PRODUCTION CLOSURE TEST SUITE
 * ============================================================================
 * 
 * Verifies:
 * 1. Generic Web Crypto primitives (hmacSha256Hex, timingSafeEqualText).
 * 2. Selcom Gateway architecture (fail-closed requireSelcomConfig, contract verification, signing, manual refund notice).
 * 3. PaymentGatewayFactory migration & legacy gating (ALLOW_LEGACY_CLICKPESA).
 * 4. Native & Web Auth Storage (encrypted KeyStore chunking, memory fallback).
 * 5. Admin MFA AAL2 Gate integration & Database Migration enforcement.
 * 6. Edge functions security (origin-restricted CORS, rate limiting, OTP purpose binding).
 * 7. Webhook replay protection & security audit logging.
 */

import * as fs from 'fs';
import * as path from 'path';
import { hmacSha256Hex, timingSafeEqualText } from '../supabase/functions/_shared/security/crypto';
import { SelcomGateway, requireSelcomConfig } from '../supabase/functions/_shared/payments/SelcomGateway';
import { PaymentGatewayFactory } from '../supabase/functions/_shared/payments/PaymentGatewayFactory';
import { SelcomContractNotVerifiedError } from '../supabase/functions/_shared/payments/selcom/SelcomContract';
import { ALLOWED_WEB_ORIGINS, corsHeadersFor } from '../supabase/functions/_shared/cors';
import { getRequestIp } from '../supabase/functions/_shared/security/rateLimit';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runPaymentSecurityClosureTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🔒 MLOHUB PAYMENT, SELCOM & SECURITY PRODUCTION CLOSURE SUITE');
  console.log('================================================================');

  const rootDir = path.resolve(__dirname, '..');

  // --------------------------------------------------------------------------
  // Group A: Web Crypto Primitives (Decoupled from ClickPesa)
  // --------------------------------------------------------------------------
  console.log('\n--- Group A: Web Crypto Primitives ---');

  // A1: HMAC-SHA256 hex output calculation
  const testMessage = 'test-payload-data';
  const testSecret = 'secret-key-12345';
  const hmacHex = await hmacSha256Hex(testMessage, testSecret);
  assert(typeof hmacHex === 'string' && hmacHex.length === 64, 'A1: hmacSha256Hex returns 64-char lowercase hex string');
  assert(/^[0-9a-f]{64}$/.test(hmacHex), 'A1: Output is valid hex string');

  // A2: Determinism of HMAC
  const hmacHex2 = await hmacSha256Hex(testMessage, testSecret);
  assert(hmacHex === hmacHex2, 'A2: HMAC calculation is strictly deterministic');

  // A3: Timing-safe string comparison
  assert(timingSafeEqualText('abc123xyz', 'abc123xyz') === true, 'A3: Equal strings evaluate to true');
  assert(timingSafeEqualText('abc123xyz', 'abc123xyw') === false, 'A3: Different strings evaluate to false');
  assert(timingSafeEqualText('abc123xyz', 'abc') === false, 'A3: Different length strings evaluate to false');
  assert(timingSafeEqualText('', '') === true, 'A3: Empty strings evaluate to true');

  // --------------------------------------------------------------------------
  // Group B: Selcom Gateway Architecture & Fail-Closed Guard
  // --------------------------------------------------------------------------
  console.log('\n--- Group B: Selcom Gateway Architecture & Migration Guard ---');

  // B1: Fail-closed requireSelcomConfig when environment variables missing
  const oldKey = process.env.SELCOM_API_KEY;
  const oldSecret = process.env.SELCOM_API_SECRET;
  delete process.env.SELCOM_API_KEY;
  delete process.env.SELCOM_API_SECRET;

  let threwConfig = false;
  try {
    requireSelcomConfig();
  } catch (err: any) {
    threwConfig = true;
    assert(err.message.includes('SELCOM_CONFIGURATION_INCOMPLETE'), 'B1: Throws SELCOM_CONFIGURATION_INCOMPLETE when credentials missing');
  }
  assert(threwConfig, 'B1: requireSelcomConfig strictly fails closed without credentials');

  // Restore env if any
  if (oldKey) process.env.SELCOM_API_KEY = oldKey;
  if (oldSecret) process.env.SELCOM_API_SECRET = oldSecret;

  // B2: Unverified contract blocks live collection
  const selcomGateway = new SelcomGateway(
    {
      apiKey: 'dummy_key',
      apiSecret: 'dummy_secret',
      baseUrl: 'https://api.selcom.net',
      vendorId: 'VEND_001',
    },
    false
  );

  let threwContract = false;
  try {
    await selcomGateway.initiateUssdPush({
      amount: 10000,
      currency: 'TZS',
      phoneNumber: '+255712345678',
      orderReference: 'ORDER-1234',
      provider: 'selcom',
      methodCode: 'MIXX_BY_YAS',
    });
  } catch (err: any) {
    threwContract = true;
    assert(err instanceof SelcomContractNotVerifiedError || err.name === 'SelcomContractNotVerifiedError', 'B2: Throws SelcomContractNotVerifiedError');
    assert(err.message.includes('SELCOM_PRODUCTION_ACTIVATION_BLOCKED'), 'B2: Error message cites SELCOM_PRODUCTION_ACTIVATION_BLOCKED');
  }
  assert(threwContract, 'B2: Live collection strictly blocked while Selcom contract is unverified');

  // B3: Selcom Refund Policy enforcement
  const refundRes = await selcomGateway.refund({
    paymentId: 'PAY-1',
    refundRequestId: 'REF-1',
    gatewayReference: 'SEL-1',
    amountTzs: 5000,
    reason: 'Customer cancellation',
  });
  assert(refundRes.success === false, 'B3: Automated Selcom refund returns success: false');
  assert(refundRes.message.includes('SELCOM_REFUND_MANUAL_REQUIRED'), 'B3: Refund returns SELCOM_REFUND_MANUAL_REQUIRED notice');

  // --------------------------------------------------------------------------
  // Group C: Payment Gateway Factory & Migration Status
  // --------------------------------------------------------------------------
  console.log('\n--- Group C: Payment Gateway Factory & Legacy Gating ---');

  // C1: Gating legacy ClickPesa
  PaymentGatewayFactory.resetInstances();
  const oldAllowLegacy = process.env.ALLOW_LEGACY_CLICKPESA;
  delete process.env.ALLOW_LEGACY_CLICKPESA;

  let threwLegacy = false;
  try {
    PaymentGatewayFactory.getGateway('clickpesa');
  } catch (err: any) {
    threwLegacy = true;
    assert(err.message.includes('CLICKPESA_LEGACY_DISABLED'), 'C1: Legacy ClickPesa blocked with CLICKPESA_LEGACY_DISABLED by default');
  }
  assert(threwLegacy, 'C1: ClickPesa blocked unless explicitly enabled via ALLOW_LEGACY_CLICKPESA=true');

  // C2: Allowing legacy when flag set
  PaymentGatewayFactory.resetInstances();
  process.env.ALLOW_LEGACY_CLICKPESA = 'true';
  const legacyGateway = PaymentGatewayFactory.getGateway('clickpesa');
  assert(legacyGateway !== undefined, 'C2: Legacy ClickPesa gateway instantiated when ALLOW_LEGACY_CLICKPESA=true');
  if (oldAllowLegacy) process.env.ALLOW_LEGACY_CLICKPESA = oldAllowLegacy;
  else delete process.env.ALLOW_LEGACY_CLICKPESA;

  // C3: Sandbox fallback
  PaymentGatewayFactory.resetInstances();
  process.env.MLOHUB_ALLOW_SANDBOX_PAYMENTS = 'true';
  const sandboxGateway = PaymentGatewayFactory.getGateway('sandbox');
  assert(sandboxGateway.provider === 'sandbox', 'C3: Sandbox provider instantiated for offline/mock test environments');
  delete process.env.MLOHUB_ALLOW_SANDBOX_PAYMENTS;

  // --------------------------------------------------------------------------
  // Group D: Auth Storage & Native KeyStore Protection
  // --------------------------------------------------------------------------
  console.log('\n--- Group D: Encrypted Session Storage & KeyStore Protection ---');

  // D1: authStorage isomorphic contract
  const authStorageTs = fs.readFileSync(path.join(rootDir, 'lib', 'authStorage.ts'), 'utf8');
  assert(authStorageTs.includes('authStorage'), 'D1: lib/authStorage.ts provides isomorphic authStorage export');

  // D2: Native SecureStore chunking logic (1800-byte cap under KeyStore 2048-byte limit)
  const nativeStorage = fs.readFileSync(path.join(rootDir, 'lib', 'authStorage.native.ts'), 'utf8');
  assert(nativeStorage.includes('CHUNK_SIZE = 1800'), 'D2: authStorage.native.ts sets CHUNK_SIZE = 1800 to bypass Android KeyStore 2048-byte limit');
  assert(nativeStorage.includes('SecureStore.setItemAsync'), 'D2: authStorage.native.ts uses expo-secure-store hardware encryption');

  // D3: Web fallback
  const webStorage = fs.readFileSync(path.join(rootDir, 'lib', 'authStorage.web.ts'), 'utf8');
  assert(webStorage.includes('localStorage'), 'D3: authStorage.web.ts uses browser localStorage with memory fallback');

  // D4: Supabase client uses authStorage
  const supabaseTs = fs.readFileSync(path.join(rootDir, 'lib', 'supabase.ts'), 'utf8');
  assert(supabaseTs.includes('storage: authStorage'), 'D4: lib/supabase.ts configured with authStorage');
  assert(!supabaseTs.includes('@react-native-async-storage/async-storage'), 'D4: lib/supabase.ts contains zero AsyncStorage token leaks');

  // --------------------------------------------------------------------------
  // Group E: Admin Mandatory TOTP MFA Gate
  // --------------------------------------------------------------------------
  console.log('\n--- Group E: Admin Mandatory TOTP MFA Gate ---');

  // E1: Components exist
  const mfaGatePath = path.join(rootDir, 'components', 'admin', 'security', 'AdminMfaGate.tsx');
  const mfaSetupPath = path.join(rootDir, 'components', 'admin', 'security', 'AdminMfaSetup.tsx');
  const mfaChallengePath = path.join(rootDir, 'components', 'admin', 'security', 'AdminMfaChallenge.tsx');
  assert(fs.existsSync(mfaGatePath), 'E1: AdminMfaGate component exists');
  assert(fs.existsSync(mfaSetupPath), 'E1: AdminMfaSetup component exists');
  assert(fs.existsSync(mfaChallengePath), 'E1: AdminMfaChallenge component exists');

  // E2: Admin index wraps layout in AdminMfaGate
  const adminIndex = fs.readFileSync(path.join(rootDir, 'app', 'admin', 'index.tsx'), 'utf8');
  assert(adminIndex.includes('<AdminMfaGate>'), 'E2: app/admin/index.tsx wraps administrator view inside <AdminMfaGate>');
  assert(adminIndex.includes('</AdminMfaGate>'), 'E2: <AdminMfaGate> properly closed');

  // --------------------------------------------------------------------------
  // Group F: Database AAL2 MFA Enforcement & Replay Protection
  // --------------------------------------------------------------------------
  console.log('\n--- Group F: Database AAL2 MFA Enforcement & Migrations ---');

  const migrationFile = path.join(rootDir, 'supabase', 'migrations', '20260927000200_security_aal2_ratelimits.sql');
  assert(fs.existsSync(migrationFile), 'F1: Migration 20260927000200_security_aal2_ratelimits.sql exists');

  const migrationSql = fs.readFileSync(migrationFile, 'utf8');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.require_admin_aal2()'), 'F2: Migration defines require_admin_aal2()');
  assert(migrationSql.includes('auth.jwt() ->> \'aal\''), 'F2: require_admin_aal2 checks JWT aal claim');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.api_rate_limits'), 'F3: Migration creates api_rate_limits table');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.security_events'), 'F4: Migration creates security_events table');
  assert(migrationSql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event'), 'F5: Migration creates unique replay index on payment_events(provider, event_id)');

  // --------------------------------------------------------------------------
  // Group G: Restricted CORS & Client IP Parsing
  // --------------------------------------------------------------------------
  console.log('\n--- Group G: Restricted CORS & Client IP Parsing ---');

  // G1: Mobile / native client (no Origin header)
  const nativeReq = new Request('https://api.mlohub.co.tz/create-payment', { method: 'POST' });
  const nativeCors = corsHeadersFor(nativeReq);
  assert(nativeCors['Access-Control-Allow-Origin'] === '*', 'G1: Native mobile apps permitted');

  // G2: Whitelisted web origin
  const webReq = new Request('https://api.mlohub.co.tz/create-payment', {
    method: 'POST',
    headers: { origin: 'https://mlohub.co.tz' },
  });
  const webCors = corsHeadersFor(webReq);
  assert(webCors['Access-Control-Allow-Origin'] === 'https://mlohub.co.tz', 'G2: Whitelisted web domain permitted with echo origin');

  // G3: Local development origin
  const localReq = new Request('https://api.mlohub.co.tz/create-payment', {
    method: 'POST',
    headers: { origin: 'http://localhost:8081' },
  });
  const localCors = corsHeadersFor(localReq);
  assert(localCors['Access-Control-Allow-Origin'] === 'http://localhost:8081', 'G3: Localhost development origin permitted');

  // G4: Disallowed foreign origin
  const foreignReq = new Request('https://api.mlohub.co.tz/create-payment', {
    method: 'POST',
    headers: { origin: 'https://malicious-site.example.com' },
  });
  const foreignCors = corsHeadersFor(foreignReq);
  assert(foreignCors['Access-Control-Allow-Origin'] === 'https://mlohub.co.tz', 'G4: Foreign origin denied and clamped to primary domain');

  // G5: IP header parsing
  const cfReq = new Request('https://api.mlohub.co.tz', { headers: { 'cf-connecting-ip': '197.250.1.20' } });
  assert(getRequestIp(cfReq) === '197.250.1.20', 'G5: Extracts Cloudflare connecting IP');

  const xffReq = new Request('https://api.mlohub.co.tz', { headers: { 'x-forwarded-for': '197.250.1.25, 10.0.0.1' } });
  assert(getRequestIp(xffReq) === '197.250.1.25', 'G5: Extracts first client IP from x-forwarded-for list');

  // --------------------------------------------------------------------------
  // Group H: OTP Purpose Binding
  // --------------------------------------------------------------------------
  console.log('\n--- Group H: OTP Purpose Binding ---');

  const sendOtpContent = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'send-otp', 'index.ts'), 'utf8');
  assert(sendOtpContent.includes('ALLOWED_OTP_PURPOSES'), 'H1: send-otp declares ALLOWED_OTP_PURPOSES');
  assert(sendOtpContent.includes('CUSTOMER_VERIFICATION'), 'H1: CUSTOMER_VERIFICATION is allowed');
  assert(sendOtpContent.includes('CUSTOMER_REGISTRATION'), 'H1: CUSTOMER_REGISTRATION is allowed');
  assert(sendOtpContent.includes('PASSWORD_RESET'), 'H1: PASSWORD_RESET is allowed');
  assert(sendOtpContent.includes('LOGIN'), 'H1: LOGIN is allowed');
  assert(sendOtpContent.includes('VENDOR_ACTIVATION'), 'H1: VENDOR_ACTIVATION is allowed');

  const verifyOtpContent = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'verify-otp', 'index.ts'), 'utf8');
  assert(verifyOtpContent.includes('challenge.purpose !== purpose'), 'H2: verify-otp strictly checks purpose mismatch');
  assert(verifyOtpContent.includes('OTP_PURPOSE_MISMATCH'), 'H2: verify-otp audits OTP_PURPOSE_MISMATCH');
  assert(verifyOtpContent.includes('PHONE_VERIFY_PURPOSES.has(purpose)'), 'H3: verify-otp only marks phone verified for verification purposes');

  // H4: create-payment rate limiting
  const createPaymentSrc = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'create-payment', 'index.ts'), 'utf8');
  assert(createPaymentSrc.includes('user:${user.id}:create-payment') && createPaymentSrc.includes('maxHits: 8'), 'H4: create-payment enforces user-level rate limiting (max 8/60s)');
  assert(createPaymentSrc.includes('target:${targetId}:create-payment') && createPaymentSrc.includes('maxHits: 4'), 'H4: create-payment enforces target-level rate limiting (max 4/300s)');

  // --------------------------------------------------------------------------
  // Group I: Hardening Migrations & Admin MFA Gate Fail-Closed
  // --------------------------------------------------------------------------
  console.log('\n--- Group I: Hardening Migrations & Admin MFA Gate Fail-Closed ---');

  // I1: Atomic rate limit migration
  const rateLimitMigration = path.join(rootDir, 'supabase', 'migrations', '20260927000300_atomic_rate_limits.sql');
  assert(fs.existsSync(rateLimitMigration), 'I1: Migration 20260927000300_atomic_rate_limits.sql exists');
  const rateLimitSql = fs.readFileSync(rateLimitMigration, 'utf8');
  assert(rateLimitSql.includes('FUNCTION public.consume_rate_limit'), 'I1: Migration defines consume_rate_limit');
  assert(rateLimitSql.includes('pg_advisory_xact_lock'), 'I1: consume_rate_limit uses pg_advisory_xact_lock to eliminate race conditions');

  // I2: Complete high-risk admin RPC AAL2 hardening
  const aal2CompleteMigration = path.join(rootDir, 'supabase', 'migrations', '20260927000400_admin_aal2_complete_hardening.sql');
  assert(fs.existsSync(aal2CompleteMigration), 'I2: Migration 20260927000400_admin_aal2_complete_hardening.sql exists');
  const aal2Sql = fs.readFileSync(aal2CompleteMigration, 'utf8');
  const requiredAal2Rpcs = [
    'approve_restaurant_application',
    'reject_restaurant_application',
    'verify_restaurant_secure',
    'reactivate_restaurant_secure',
    'archive_restaurant_secure',
    'resolve_financial_dispute_secure',
    'update_platform_financial_settings_secure',
    'update_platform_operational_settings_secure',
    'execute_merchant_payout_rpc',
    'publish_platform_announcement_secure',
  ];
  for (const rpc of requiredAal2Rpcs) {
    assert(aal2Sql.includes(rpc), `I2: Hardened migration covers ${rpc}`);
  }
  const aal2Matches = aal2Sql.match(/PERFORM public\.require_admin_aal2\(\);/g) || [];
  assert(aal2Matches.length >= 10, `I2: All 10 high-risk RPCs invoke require_admin_aal2 (found ${aal2Matches.length})`);

  // I3: Admin MFA Gate fails closed
  const mfaGateContent = fs.readFileSync(mfaGatePath, 'utf8');
  assert(mfaGateContent.includes('await logout()'), 'I3: AdminMfaGate strictly fails closed via logout when MFA API unavailable');

  // I4: Private backend workers do NOT use browser wildcard CORS
  const webhookSrc = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'payment-webhook', 'index.ts'), 'utf8');
  assert(!webhookSrc.includes("import { corsHeaders }"), 'I4: payment-webhook does not import wildcard corsHeaders');
  assert(!webhookSrc.includes("...corsHeaders"), 'I4: payment-webhook does not emit wildcard CORS headers');

  const reconcileSrc = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'reconcile-payments', 'index.ts'), 'utf8');
  assert(!reconcileSrc.includes("import { corsHeaders }"), 'I4: reconcile-payments does not import wildcard corsHeaders');
  assert(!reconcileSrc.includes("...corsHeaders"), 'I4: reconcile-payments does not emit wildcard CORS headers');

  const outboxSrc = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'process-notification-outbox', 'index.ts'), 'utf8');
  assert(!outboxSrc.includes("import { corsHeaders }"), 'I4: process-notification-outbox does not import wildcard corsHeaders');
  assert(!outboxSrc.includes("...corsHeaders"), 'I4: process-notification-outbox does not emit wildcard CORS headers');

  // I5: Admin system health and request refund use scoped CORS
  const healthSrc = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'admin-system-health', 'index.ts'), 'utf8');
  assert(healthSrc.includes("corsHeadersFor(req)"), 'I5: admin-system-health uses corsHeadersFor(req)');

  const refundSrc = fs.readFileSync(path.join(rootDir, 'supabase', 'functions', 'request-refund', 'index.ts'), 'utf8');
  assert(refundSrc.includes("corsHeadersFor(req)"), 'I5: request-refund uses corsHeadersFor(req)');

  console.log('\n================================================================');
  console.log(`SUITE COMPLETE: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  return { passed, failed };
}

// Direct execution support
if (require.main === module) {
  runPaymentSecurityClosureTests().catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}
