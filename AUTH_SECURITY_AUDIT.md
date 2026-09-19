# MloHub Security & Secrets Audit Report (Stage 1)

## 1. Executive Summary
This audit inspects the MloHub Expo source code for exposed credentials, hardcoded secrets, weak cryptographic primitives, client-side authentication bypasses, and unauthorized access vectors. Findings are categorized according to severity (CRITICAL, HIGH, MEDIUM, LOW) with remediation plans.

---

## 2. Audit Findings & Classification

### [CRITICAL] 1. Hardcoded ClickPesa Webhook HMAC Secret in Client Code
- **Location**: `services/PaymentGatewayService.ts` (`line 70`)
- **Code**: `private static readonly CLICKPESA_WEBHOOK_SECRET = 'mlohub_cp_sec_993847291048_prod';`
- **Impact**: Anyone inspecting the client mobile/web bundle can extract the HMAC signature secret, allowing forged payment confirmation webhooks and unauthorized balance credits.
- **Classification**: **CRITICAL**
- **Remediation**: Remove the hardcoded secret from the client bundle. Webhook verification must occur exclusively on a backend server / Supabase Edge Function with environment variables unexposed to Expo.

### [CRITICAL] 2. Passwords & Plaintext Security PINs Stored in Client-Side Database
- **Location**: `db/repositories.ts` (`lines 693-698`), `services/AdminOnboardingService.ts` (`lines 224-233`), `db/seed.ts`
- **Code**: Storing `password_hash`, `securityPin: '1234'`, and metadata inside client-synced records.
- **Impact**: Mobile storage inspection or local DB dumps expose hashed/plaintext credentials.
- **Classification**: **CRITICAL**
- **Remediation**: Transition all credential verification to `auth.users` via Supabase Auth. Deprecate local password hashes and PIN fields from client models.

### [HIGH] 3. Sensitive SMS Gateway Secrets Exposed via `EXPO_PUBLIC_` Prefix
- **Location**: `services/sms/SmsProvider.ts` (`lines 79-81, 143-145`), `.env`
- **Code**: `process.env.EXPO_PUBLIC_BEEM_SECRET_KEY || process.env.BEEM_SECRET_KEY`, `process.env.EXPO_PUBLIC_NEXTSMS_PASSWORD`
- **Impact**: Any variable prefixed with `EXPO_PUBLIC_` is inlined into the frontend bundle by Expo/Metro, exposing SMS gateway account credentials to mobile/web reverse engineering.
- **Classification**: **HIGH**
- **Remediation**: Remove `EXPO_PUBLIC_` prefixes from all SMS and payment secrets in `.env` and client code. Client code must interact with SMS via sandbox simulation or protected Edge Functions.

### [HIGH] 4. Service Role Key in Local `.env` / Environment Files
- **Location**: `.env`, `.env.example`
- **Impact**: If `SUPABASE_SERVICE_ROLE_KEY` is referenced in client bundle or committed to public version control, all RLS policies can be bypassed.
- **Classification**: **HIGH**
- **Remediation**: Ensure `.env` is strictly gitignored (confirmed). Ensure `.env.example` contains only safe blank placeholders. Ensure client code imports only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### [MEDIUM] 5. Custom Client-Signed JWT Tokens & Local Session Storage
- **Location**: `db/auth/crypto.ts`, `db/auth/service.ts`
- **Impact**: Prototype JWTs signed using a static secret (`MLOHUB_STATIC_DEV_SECRET_2026`) allow token tampering if secret is extracted.
- **Classification**: **MEDIUM**
- **Remediation**: Supabase Auth handles asymmetric cryptographic signing with server-side public/private key pairs and short-lived access tokens.

### [LOW] 6. Default Development PINs in UI Placeholders
- **Location**: UI inputs in `app/(tabs)/profile.tsx`, `app/admin/index.tsx`
- **Impact**: Users might assume `'1234'` or `'9999'` are valid credentials.
- **Classification**: **LOW**
- **Remediation**: Replace default PIN values with empty placeholders (`••••`).

---

## 3. Immediate Remediations Implemented in Stage 1
1. `services/PaymentGatewayService.ts`: Removed hardcoded webhook secret.
2. `services/sms/SmsProvider.ts`: Removed `EXPO_PUBLIC_` secret prefix fallbacks; restricted to server-side/sandbox operations.
3. `.env.example`: Updated with only clean, unpopulated placeholders:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_ANON_KEY=
   ```
4. `lib/supabase.ts`: Configured strictly using only public anon credentials with graceful fallback.
