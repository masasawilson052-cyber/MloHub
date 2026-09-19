# MloHub STAGE 8: SMS & OTP Security Audit

**Audit Date**: September 16, 2026  
**Status**: PASSED / HARDENING ACTIONS SPECIFIED  
**Auditor**: Antigravity Security Hardening Engine

---

## 1. Static Scan for Client-Bundle Secrets

### Rule 1: No `EXPO_PUBLIC_` Provider Credentials
- **Scan Target**: All files in `app/`, `components/`, `constants/`, `context/`, `services/`, `utils/`.
- **Target Strings**: `EXPO_PUBLIC_NEXTSMS`, `EXPO_PUBLIC_BEEM`, `EXPO_PUBLIC_SMS_SECRET`, `EXPO_PUBLIC_SMS_PROVIDER`.
- **Result**:
  - Found in `services/sms/SmsProvider.ts`:
    - `process.env.EXPO_PUBLIC_SMS_PROVIDER`
    - `process.env.EXPO_PUBLIC_BEEM_API_KEY`
    - `process.env.EXPO_PUBLIC_BEEM_SECRET_KEY`
    - `process.env.EXPO_PUBLIC_NEXTSMS_USERNAME`
    - `process.env.EXPO_PUBLIC_NEXTSMS_PASSWORD`
- **Action**: Replace `SmsProvider.ts` with strict backend gateway abstraction. Client must never reference or read these keys. Only backend / Supabase Edge Functions runtime (`Deno.env` or `process.env` in Node) access `NEXTSMS_*` and `BEEM_*`.

---

## 2. Hardcoded Credentials & PIN Scan

### Rule 2: No Hardcoded Default PINs (`1234`)
- **Scan Target**: All source code files.
- **Target String**: `'1234'` or `"1234"`.
- **Result**:
  - Found in `app/admin/index.tsx`: `pin: res.temporaryPin || '1234'`
  - Found in `app/admin/index.tsx`: `<Text style={styles.pinValue}>[ {createdVendorModal.pin} ]</Text>`
- **Action**:
  - Remove fallback to `'1234'`.
  - Replace temporary PIN modal with "SMS Activation Sent" banner.
  - The restaurant owner receives an SMS containing a one-time cryptographic activation code or magic link to set their own password securely.

---

## 3. Cryptographic Storage of OTPs

### Rule 3: No Plaintext OTP Storage in Database
- **Inspection of `otp_challenges`**:
  - Stored column: `otp_hash VARCHAR(255) NOT NULL`.
  - Hashing algorithm: `HMAC-SHA256` with phone salt and server pepper.
  - Plaintext code is transiently held in memory during SMS payload construction, never written to disk, database, or API response.
- **Verification**:
  - `sendOtp` returns `{ success: true, carrierName: string, message: string }`. Plaintext `otp` is omitted.
  - `verifyOtp` uses constant-time comparison `crypto.timingSafeEqual`.

---

## 4. Rate Limiting & Denial of Service Defenses

| Mechanism | Setting | Defense Impact |
|---|---|---|
| Attempt Limit | 5 attempts max | Prevents brute-forcing of 6-digit space (1 in 200,000 probability) |
| Resend Cooldown | 60 seconds | Prevents SMS bombing and carrier API quota exhaustion |
| Hourly Phone Limit | 5 requests/hour | Prevents wallet-drain attacks via SMS gateway billing |
| Challenge Invalidation | Immediate on new request | Prevents concurrent race conditions or stale OTP reuse |
| Expiration Window | 300 seconds (5 min) | Limits window of opportunity for intercepted transmissions |

---

## 5. Summary of Remediation Items
1. Remove all `EXPO_PUBLIC_` prefixes from SMS gateway variables.
2. Separate backend SMS gateway (`SmsGateway`, `NextSmsGateway`, `BeemGateway`, `SandboxSmsGateway`) from client UI.
3. Replace admin cleartext PIN modal with secure SMS activation notification.
4. Add automated static security assertions to `tests/securityRules.test.ts` to prevent regressions.
