# MLOHUB CONFIGURATION & SECRETS HANDOVER GUIDE

**Confidentiality Notice**: This document outlines the configuration and secrets architecture for the MloHub application. It strictly separates public client configurations from private server-side secrets.

---

## 1. Public Environment Configuration (Client Safe)

These values are compiled into the client web bundle and mobile binaries. They use the `EXPO_PUBLIC_` prefix and are strictly restricted to public publishable identifiers.

### Production Settings (`production-public.json` / `.env.local`)
```env
# Public Supabase Gateway (Hosted)
EXPO_PUBLIC_SUPABASE_URL=https://rrebkpeumvqffuwtqvje.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_WGyFGbo78W5YMZCy0ytaAw_Q-YDvhrg

# Environment Mode
EXPO_PUBLIC_APP_ENV=production

# Password Recovery Callback URL
EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL=http://127.0.0.1:5512/auth/reset-password
```

> **Security Rule**: Never place `SUPABASE_SERVICE_ROLE_KEY` or any merchant API secrets in `.env`, `.env.local`, or client code. The build pipeline automatically rejects builds if secret keys are detected.

---

## 2. Server-Side Edge Function Secrets (Supabase Vault)

These secrets must be configured exclusively in the Supabase Dashboard (`Settings` → `Edge Functions` → `Secrets`) or via the Supabase CLI. They are never exposed to the client browser.

### A. ClickPesa Payment Integration
```bash
# Set Payment Provider to ClickPesa
supabase secrets set PAYMENT_PROVIDER="clickpesa"
supabase secrets set CLICKPESA_BASE_URL="https://api.clickpesa.com/third-parties"

# Merchant Credentials (From ClickPesa Portal)
supabase secrets set CLICKPESA_CLIENT_ID="<YOUR_CLICKPESA_CLIENT_ID>"
supabase secrets set CLICKPESA_API_KEY="<YOUR_CLICKPESA_API_KEY>"
supabase secrets set CLICKPESA_CHECKSUM_KEY="<YOUR_CLICKPESA_CHECKSUM_KEY>"
```

### B. SMS & OTP Service (Beem or NextSMS)
```bash
# Provider Selection
supabase secrets set SMS_PROVIDER="beem" # or "nextsms"

# Beem Africa Credentials
supabase secrets set BEEM_API_KEY="<YOUR_BEEM_API_KEY>"
supabase secrets set BEEM_SECRET_KEY="<YOUR_BEEM_SECRET_KEY>"
supabase secrets set BEEM_SENDER_NAME="MLOHUB"

# One-Way Hash Pepper for OTP Integrity
supabase secrets set SMS_OTP_PEPPER="<GENERATE_A_64_CHAR_HEX_STRING>"
```

---

## 3. External Webhook Registration (ClickPesa)

To receive real-time mobile money payment notifications (M-Pesa, Airtel Money, Tigo Pesa, Halopesa), configure the webhook in your ClickPesa Merchant Portal:

1. Log into [ClickPesa Portal](https://portal.clickpesa.com).
2. Navigate to **Developers** → **Webhooks**.
3. Click **Add Webhook Endpoint**.
4. Set **Endpoint URL**:
   ```
   https://rrebkpeumvqffuwtqvje.supabase.co/functions/v1/payment-webhook
   ```
5. Select Event Subscriptions:
   - `bill.payment.received`
   - `payment.status.updated`
6. Ensure **Checksum Verification** is enabled matching your `CLICKPESA_CHECKSUM_KEY`.

---

## 4. Supabase Authentication & URL Configuration

In your Supabase Dashboard (`Authentication` → `URL Configuration`):

### Site URL:
```
https://app.mlohub.co.tz (or http://127.0.0.1:5512 for local staging)
```

### Redirect URLs (Allowed Callback URLs):
Add all of the following:
```
http://127.0.0.1:5512/**
http://127.0.0.1:5512/auth/reset-password
https://*.mlohub.co.tz/**
https://*.mlohub.co.tz/auth/reset-password
```

---

## 5. Supabase Edge Functions Deployment

When ready to deploy edge functions from your workstation:
```bash
cd supabase
supabase functions deploy create-payment --no-verify-jwt
supabase functions deploy payment-webhook --no-verify-jwt
supabase functions deploy get-payment-status
supabase functions deploy request-refund
supabase functions deploy send-otp --no-verify-jwt
supabase functions deploy verify-otp --no-verify-jwt
```

---

## 6. Pending Database Migrations

Before launching live custom meal workflows, execute Migration 06 in the Supabase SQL Editor:
- **File**: `supabase/migrations/20260921000006_custom_meal_privacy_and_direct_write_guards.sql`
- **Action**: Paste into Supabase SQL Editor and click **Run**.
- **What it does**:
  1. Creates `public.custom_meal_delivery_details` with customer/admin/accepted-kitchen RLS.
  2. Creates secure RPC `get_custom_meal_delivery_details`.
  3. Attaches direct-write blocking triggers to `custom_meal_requests` and `restaurant_quotes`.
