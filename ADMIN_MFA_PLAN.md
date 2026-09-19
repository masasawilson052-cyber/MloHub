# MloHub Admin Multi-Factor Authentication (MFA) Implementation Plan

**Document Version:** 1.0 (Stage 3 Security Hardening)  
**Target Roles:** `ADMIN`, `SUPER_ADMIN`  
**Security Standard:** Time-based One-Time Password (TOTP) — RFC 6238  
**Backend:** Supabase Auth MFA (`supabase.auth.mfa.*`)

---

## 1. Executive Summary

As part of the Stage 3 security hardening, all administrative access (`ADMIN` and `SUPER_ADMIN`) must be protected by mandatory Multi-Factor Authentication (MFA). Normal password authentication alone is insufficient for administrative accounts holding control over restaurant approvals, financial payouts, user suspension, and system audits.

This plan details the architecture, user journey, Supabase configuration, and rollback contingencies for enabling mandatory TOTP MFA.

---

## 2. Architecture & Enforcement Levels

Supabase Auth provides built-in Authenticator App (TOTP) MFA supporting Google Authenticator, Authy, Apple Keychain, and 1Password.

### Authentication Assurance Levels (AAL):
- **AAL1 (Assurance Level 1):** Verified email/password or OTP (standard customer session).
- **AAL2 (Assurance Level 2):** Verified email/password + verified TOTP code from authenticator app.

### Database-Level Enforcement (PostgreSQL):
In administrative RPCs (`approve_restaurant_application`, `suspend_restaurant`, `change_platform_role`), PostgreSQL enforces AAL2:

```sql
-- Check that the JWT assurance level is AAL2 for Admin operations
CREATE OR REPLACE FUNCTION public.require_admin_aal2()
RETURNS BOOLEAN AS $$
DECLARE
    v_aal TEXT;
BEGIN
    v_aal := (auth.jwt() ->> 'aal');
    IF v_aal IS NULL OR v_aal != 'aal2' THEN
        RAISE EXCEPTION '403 Forbidden: Administrator operation requires AAL2 multi-factor verification.';
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

---

## 3. Administrator Enrollment Flow

1. **Admin Login:**
   - Admin logs in via `app/auth/login.tsx` using email and strong password.
   - Initial session established at `AAL1`.
2. **Detection & Challenge:**
   - The app detects `user.role === 'ADMIN'` or `user.role === 'SUPER_ADMIN'`.
   - The app queries `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
   - If user has enrolled factors: App immediately displays the 6-digit TOTP challenge modal.
   - If user has NOT enrolled factors: App redirects to `app/admin/mfa-setup.tsx`.
3. **MFA Setup Flow (`app/admin/mfa-setup.tsx`):**
   - Call `supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'MloHub Admin' })`.
   - Supabase returns:
     - `id`: Factor ID
     - `totp.qr_code`: SVG QR code
     - `totp.secret`: Plaintext secret for manual entry
   - Admin scans QR code with Authenticator app.
   - Admin enters the generated 6-digit code to verify factor enrollment:
     `supabase.auth.mfa.challengeAndVerify({ factorId, code })`.
   - Factor transitions to `verified`. Session elevates to `AAL2`.
4. **Subsequent Logins:**
   - After email/password, call `supabase.auth.mfa.challenge({ factorId })`.
   - Admin enters 6-digit TOTP code.
   - Call `supabase.auth.mfa.verify({ factorId, challengeId, code })`.
   - Session upgraded to `AAL2`. Access to `app/admin/index.tsx` granted.

---

## 4. Emergency Backup Codes & Break-Glass Protocol

1. **Recovery Codes:**
   - Upon first enrollment, generate 8 single-use cryptographically random recovery codes (e.g. `XXXX-XXXX-XXXX`).
   - Store hashed recovery codes in a secure administrative vault table (`public.admin_recovery_codes`).
2. **Break-Glass Root Access:**
   - If a Super Admin loses their authenticator device, the designated technical lead uses the Supabase Dashboard / SQL Console via Service Role to reset the MFA factor:
     ```sql
     -- Revoke lost factor
     DELETE FROM auth.mfa_factors WHERE user_id = '<target_user_id>';
     ```
   - An immutable audit log entry is automatically written with the action `EMERGENCY_MFA_RESET`.

---

## 5. Rollout Schedule

- **Stage 3:** Schema and architectural readiness established; helper verification functions prepared.
- **Stage 4:** Enrollment UI (`components/AdminMfaModal.tsx`) and enforcement integrated into `app/admin/_layout.tsx`.
- **Pre-Production Launch:** Enforce hard requirement: Any user with `ADMIN` or `SUPER_ADMIN` role must complete enrollment prior to accessing live management consoles.
