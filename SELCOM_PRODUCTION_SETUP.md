# Selcom Production Integration & Onboarding Guide

## 1. Executive Summary

This guide outlines the mandatory production setup, security configuration, and operational verification required to activate **Selcom Pay** as the primary mobile-money payment gateway for MloHub in Tanzania.

---

## 2. Merchant Onboarding & Required Credentials

Before live transactions can be processed, MloHub must complete corporate merchant onboarding with Selcom Tanzania:

1. **Merchant Contract**: Formal merchant agreement signed with Selcom Pay.
2. **Settlement Bank Account**: Designated Tanzanian commercial bank account (TZS) linked for daily automated settlements.
3. **Official Credentials Provided by Selcom**:
   - `SELCOM_VENDOR_ID`: Assigned merchant vendor code.
   - `SELCOM_API_KEY`: Production API key for request authentication.
   - `SELCOM_API_SECRET`: Production cryptographic key used for HMAC-SHA256 request signatures and webhook verification.
   - `SELCOM_BASE_URL`: Verified production endpoint URL (e.g., `https://apigw.selcom.net/v1` or as specified in official merchant package).

---

## 3. Supabase Edge Function Secrets Setup

Configure the verified merchant credentials strictly as Supabase server secrets (NEVER expose to client bundles or `.env.local`):

```bash
# Set primary payment provider to Selcom
supabase secrets set PAYMENT_PROVIDER="selcom"

# Official Selcom Merchant Credentials
supabase secrets set SELCOM_BASE_URL="https://<OFFICIAL_SELCOM_ENDPOINT>"
supabase secrets set SELCOM_VENDOR_ID="<YOUR_VENDOR_ID>"
supabase secrets set SELCOM_API_KEY="<YOUR_API_KEY>"
supabase secrets set SELCOM_API_SECRET="<YOUR_API_SECRET>"

# Contract Verification Flag (Set to 'true' once official API tests pass)
supabase secrets set SELCOM_CONTRACT_VERIFIED="true"

# Disable Legacy ClickPesa
supabase secrets set ALLOW_LEGACY_CLICKPESA="false"
```

---

## 4. Webhook Configuration & Replay Protection

1. **Webhook Callback URL**:
   Provide the following HTTPS endpoint to the Selcom technical integration team:
   ```
   https://rrebkpeumvqffuwtqvje.supabase.co/functions/v1/payment-webhook
   ```
2. **Supported Event Types**:
   - Mobile Money Push Completion (`COMPLETED`, `SUCCESS`)
   - Customer Cancellation (`CANCELLED`)
   - Timeout / Failure (`FAILED`)
3. **Verification Checklist**:
   - Inbound webhook headers must contain `Digest` or `x-selcom-signature` computed with `SELCOM_API_SECRET`.
   - Inbound payload must match the database `merchant_reference`, currency (`TZS`), and expected order total.
   - The database enforces uniqueness on `(provider, event_id)` in `public.payment_events` to ensure duplicate or replayed webhooks are acknowledged without duplicate financial settlement.

---

## 5. Channel Testing & Operational Sign-off

Before opening live customer orders to Selcom processing, complete the following test matrix:

| Channel | Operator | Test Number Format | Success Verification | Cancel Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Vodacom M-Pesa** | Vodacom | `074x`, `075x`, `076x` | [ ] Approved via USSD | [ ] Cancelled / timed out |
| **Airtel Money** | Airtel | `068x`, `069x`, `078x` | [ ] Approved via USSD | [ ] Cancelled / timed out |
| **Mixx by Yas** | Tigo | `065x`, `067x`, `071x` | [ ] Approved via USSD | [ ] Cancelled / timed out |
| **HaloPesa** | Halotel | `062x` | [ ] Approved via USSD | [ ] Cancelled / timed out |

---

## 6. Refund Support Status

> [!IMPORTANT]
> **Manual Refund Policy**: Automated programmatic refunds via Selcom are currently **NOT supported** or integrated into MloHub.
> 
> When an order refund or dispute is approved by an administrator in the Admin Portal, the system transitions the database refund request to `MANUAL_DISBURSEMENT_REQUIRED`. The financial administrator must disburse the refund manually through the Selcom Merchant Portal and record the transaction reference into MloHub's audit ledger. Automated database status transitions to `REFUNDED` are strictly blocked until confirmed by the administrator.

---

## 7. Credential Rotation Policy

1. Generate a new API Secret in the Selcom Merchant Portal.
2. Update the Supabase Edge Function secret:
   ```bash
   supabase secrets set SELCOM_API_SECRET="<NEW_SECRET>"
   ```
3. Test a live low-value verification transaction.
4. Revoke the old API Secret in the Selcom portal.
5. Record an immutable security event in `public.security_events` (`PAYMENT_CREDENTIALS_ROTATED`).
