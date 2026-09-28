/**
 * MloHub Production Static Security Audit Script
 * 
 * Performs automated security compliance verification:
 * 1. Client-Side Secret Leakage (Google server keys, Selcom secret, Supabase service role).
 * 2. Prohibited Mobile Money PIN Prompts (Zero PIN collection on client UI).
 * 3. Secure Storage Configuration (Encrypted auth token storage).
 * 4. Mandatory Admin MFA Enclosure (AAL2 enforcement).
 * 5. Database MFA & Replay Protection Migrations.
 * 6. Edge Function CORS & Rate Limit Hardening.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');

interface AuditCheck {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const auditChecks: AuditCheck[] = [];

function recordCheck(id: string, name: string, passed: boolean, details: string) {
  auditChecks.push({ id, name, passed, details });
  const symbol = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${symbol} [${id}] ${name}: ${details}`);
}

function getFilesRecursively(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.git', '.expo', 'dist', 'dist-production', 'dist-payment-security-web', 'dist-payment-security-android'].includes(file)) {
        results = results.concat(getFilesRecursively(filePath, extensions));
      }
    } else {
      if (extensions.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function runAudit() {
  console.log('================================================================');
  console.log('MLOHUB PRODUCTION STATIC SECURITY AUDIT');
  console.log('================================================================\n');

  // Check 1: Client-Side Secret Leakage
  const clientSourceDirs = ['app', 'components', 'context', 'hooks', 'lib', 'services', 'repositories', 'constants'];
  let leakedSecretsFound = false;
  const secretPatterns = [
    { pattern: /GOOGLE_ROUTES_API_KEY\s*[:=]\s*['"][^'"]+['"]/i, desc: 'Hardcoded Google Routes API Key' },
    { pattern: /SELCOM_API_SECRET\s*[:=]\s*['"][^'"]+['"]/i, desc: 'Hardcoded Selcom API Secret' },
    { pattern: /CLICKPESA_CLIENT_SECRET\s*[:=]\s*['"][^'"]+['"]/i, desc: 'Hardcoded ClickPesa Client Secret' },
    { pattern: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+['"]/i, desc: 'Hardcoded Supabase Service Role Key' },
  ];

  for (const dir of clientSourceDirs) {
    const files = getFilesRecursively(path.join(ROOT_DIR, dir), ['.ts', '.tsx', '.js', '.jsx']);
    for (const file of files) {
      if (file.endsWith('testEnv.ts') || file.endsWith('e2eBootstrap.js') || file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      for (const sp of secretPatterns) {
        if (sp.pattern.test(content)) {
          leakedSecretsFound = true;
          recordCheck('SEC-01', 'Secret Leakage', false, `Found ${sp.desc} in ${path.relative(ROOT_DIR, file)}`);
        }
      }
    }
  }

  if (!leakedSecretsFound) {
    recordCheck('SEC-01', 'Client-Side Secret Leakage Scan', true, 'Zero secret keys exposed in client source code');
  }

  // Check 2: Mobile Money PIN Prompt Verification
  let pinPromptsFound = false;
  const pinPromptPatterns = [
    /placeholder=["'].*?(enter|ingiza).*?(pin|password|msimbo).*?["']/i,
    /text=["'].*?(enter\s+your\s+mpesa\s+pin|weka\s+pin).*?["']/i,
  ];

  for (const dir of ['components', 'app']) {
    const files = getFilesRecursively(path.join(ROOT_DIR, dir), ['.ts', '.tsx']);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pp of pinPromptPatterns) {
        if (pp.test(content)) {
          pinPromptsFound = true;
          recordCheck('SEC-02', 'Prohibited PIN Collection', false, `Found prohibited PIN input in ${path.relative(ROOT_DIR, file)}`);
        }
      }
    }
  }

  if (!pinPromptsFound) {
    recordCheck('SEC-02', 'Client PIN Collection Prohibition', true, 'No client forms prompt for M-Pesa / Mobile Money PINs (USSD push compliance)');
  }

  // Check 3: Secure Session Storage Adapter
  const supabaseLibPath = path.join(ROOT_DIR, 'lib', 'supabase.ts');
  const authStoragePath = path.join(ROOT_DIR, 'lib', 'authStorage.ts');
  const authStorageNativePath = path.join(ROOT_DIR, 'lib', 'authStorage.native.ts');
  const authStorageWebPath = path.join(ROOT_DIR, 'lib', 'authStorage.web.ts');

  if (fs.existsSync(supabaseLibPath) && fs.existsSync(authStoragePath)) {
    const libContent = fs.readFileSync(supabaseLibPath, 'utf8');
    const usesAuthStorage = libContent.includes('authStorage') && !libContent.includes('@react-native-async-storage/async-storage');
    const nativeHasSecureStore = fs.existsSync(authStorageNativePath) && fs.readFileSync(authStorageNativePath, 'utf8').includes('expo-secure-store');
    const webHasMemoryFallback = fs.existsSync(authStorageWebPath) && fs.readFileSync(authStorageWebPath, 'utf8').includes('localStorage');

    recordCheck(
      'SEC-03',
      'Encrypted Native Session Storage',
      usesAuthStorage && nativeHasSecureStore && webHasMemoryFallback,
      'authStorage replaces unencrypted AsyncStorage with expo-secure-store (native KeyStore) and localStorage (web)'
    );
  } else {
    recordCheck('SEC-03', 'Encrypted Native Session Storage', false, 'lib/authStorage.ts not found');
  }

  // Check 4: Admin Mandatory TOTP MFA Gate
  const adminIndexPath = path.join(ROOT_DIR, 'app', 'admin', 'index.tsx');
  const mfaGatePath = path.join(ROOT_DIR, 'components', 'admin', 'security', 'AdminMfaGate.tsx');
  if (fs.existsSync(adminIndexPath) && fs.existsSync(mfaGatePath)) {
    const adminContent = fs.readFileSync(adminIndexPath, 'utf8');
    const wrapsMfaGate = adminContent.includes('<AdminMfaGate>') && adminContent.includes('AdminMfaGate');
    recordCheck(
      'SEC-04',
      'Admin Portal MFA Gate Enforcement',
      wrapsMfaGate,
      'Admin portal root view is wrapped in <AdminMfaGate> enforcing AAL2'
    );
  } else {
    recordCheck('SEC-04', 'Admin Portal MFA Gate Enforcement', false, 'Admin MFA components missing');
  }

  // Check 5: Database AAL2 & Replay Protection Migrations
  const migrationPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20260927000200_security_aal2_ratelimits.sql');
  if (fs.existsSync(migrationPath)) {
    const migContent = fs.readFileSync(migrationPath, 'utf8');
    const hasAal2 = migContent.includes('require_admin_aal2') && migContent.includes('aal2');
    const hasRateLimits = migContent.includes('api_rate_limits');
    const hasSecurityEvents = migContent.includes('security_events');
    const hasUniquePaymentEvents = migContent.includes('idx_payment_events_provider_event');

    recordCheck(
      'SEC-05',
      'Database Security Hardening Migration',
      hasAal2 && hasRateLimits && hasSecurityEvents && hasUniquePaymentEvents,
      'AAL2 RPC check, api_rate_limits, security_events, and payment_events unique replay index defined'
    );
  } else {
    recordCheck('SEC-05', 'Database Security Hardening Migration', false, 'Migration 20260927000200_security_aal2_ratelimits.sql missing');
  }

  // Check 6: Edge Functions Hardening (CORS & Purpose Binding)
  const corsPath = path.join(ROOT_DIR, 'supabase', 'functions', '_shared', 'cors.ts');
  const sendOtpPath = path.join(ROOT_DIR, 'supabase', 'functions', 'send-otp', 'index.ts');
  const verifyOtpPath = path.join(ROOT_DIR, 'supabase', 'functions', 'verify-otp', 'index.ts');

  if (fs.existsSync(corsPath) && fs.existsSync(sendOtpPath) && fs.existsSync(verifyOtpPath)) {
    const corsContent = fs.readFileSync(corsPath, 'utf8');
    const sendOtpContent = fs.readFileSync(sendOtpPath, 'utf8');
    const verifyOtpContent = fs.readFileSync(verifyOtpPath, 'utf8');

    const hasDynamicCors = corsContent.includes('corsHeadersFor') && corsContent.includes('ALLOWED_WEB_ORIGINS');
    const hasOtpPurposes = sendOtpContent.includes('ALLOWED_OTP_PURPOSES') && sendOtpContent.includes('CUSTOMER_VERIFICATION');
    const hasVerifyPurpose = verifyOtpContent.includes('challenge.purpose');

    recordCheck(
      'SEC-06',
      'Edge Functions CORS & Purpose Binding',
      hasDynamicCors && hasOtpPurposes && hasVerifyPurpose,
      'Dynamic origin-restricted CORS and OTP purpose binding strictly enforced'
    );
  } else {
    recordCheck('SEC-06', 'Edge Functions CORS & Purpose Binding', false, 'Edge functions files missing');
  }

  console.log('\n================================================================');
  const allPassed = auditChecks.every(c => c.passed);
  console.log(`AUDIT RESULT: ${allPassed ? 'ALL AUDIT CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log(`TOTAL CHECKS: ${auditChecks.length} | PASSED: ${auditChecks.filter(c => c.passed).length} | FAILED: ${auditChecks.filter(c => !c.passed).length}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runAudit();
