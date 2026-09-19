# MLOHUB STAGE 9: PAYMENT SECURITY AUDIT & THREAT MODEL
**Classification:** Financial Systems Security Review  
**Date:** September 2026  
**Scope:** Server-Driven Tanzanian Payment Architecture (ClickPesa / Selcom / Sandbox)

---

## 1. Threat Modeling & Defense Invariants

### 1.1 Threat: Client-Side Amount Tampering
* **Threat Vector:** An attacker intercepts or alters the HTTP payload originating from the React Native app, changing an order's subtotal from TZS 60,000 to TZS 500.
* **Defense Invariant:** Zero-Trust Client Model. The client is forbidden from specifying or overriding the payable amount. When initiating a payment, `PaymentGatewayService.initiatePayment` and Supabase Edge Function `create-payment` query the database record directly (`orders`, `custom_orders`, `reservations`) to establish the **authoritative amount**. Any client-supplied amount that differs from the database record is rejected.

### 1.2 Threat: Forged Webhook Callbacks (Unauthenticated State Mutation)
* **Threat Vector:** An adversary identifies the public webhook URL (`/payment-webhook`) and submits forged HTTP POST requests asserting that an order has been paid.
* **Defense Invariant:** Cryptographic HMAC-SHA256 Signature Verification. All incoming webhooks must include an authentic `x-clickpesa-signature` or Selcom `Digest` header computed using the secret private key (`CLICKPESA_WEBHOOK_SECRET`). Forged, altered, or unsigned requests are immediately rejected with HTTP 401 and logged as `SIGNATURE_FAILED` in the append-only `payment_events` table.

### 1.3 Threat: Replay Attacks (Duplicate Webhook Delivery)
* **Threat Vector:** A network glitch or replay attack resends an authentic webhook payload multiple times, potentially triggering double order fulfillment or duplicate ledger credits.
* **Defense Invariant:** Event Deduplication & Idempotency. Every webhook delivery carries an `eventId` and `orderReference`. The receiver checks `payment_events` for previous deliveries. If the payment is already in `PAID` state, the endpoint returns an idempotent 200 response without duplicating state transitions or emitting redundant kitchen prep events.

### 1.4 Threat: Underpayment Fraud
* **Threat Vector:** A customer approves a partial or altered amount on their telecom handset (e.g. TZS 1,000 on a TZS 50,000 order).
* **Defense Invariant:** Amount Match Verification. Prior to marking a transaction `PAID`, the webhook processor compares `collectedAmount` reported by the gateway against `amountTzs` in the database. If `collectedAmount < expectedAmount`, the payment is flagged as `FAILED`, `AMOUNT_MISMATCH` is logged to the ledger, and the kitchen batch prep remains strictly unlocked.

### 1.5 Threat: Credential Leakage in Client Bundles
* **Threat Vector:** Decompilation of the Expo Android APK or web JavaScript bundle exposing payment provider API keys.
* **Defense Invariant:** Strict Environment Variable Segregation. No payment credentials use the `EXPO_PUBLIC_` prefix. ClickPesa client IDs, API keys, and webhook secrets reside exclusively in server-side Supabase Edge Functions.

---

## 2. Row Level Security (RLS) Matrix for Payment Tables

| Table | Operation | Role | Policy Enforcement |
| :--- | :--- | :--- | :--- |
| `public.payments` | SELECT | Customer | `user_id = auth.uid()` |
| `public.payments` | SELECT | Restaurant Staff | Active membership in target `restaurant_id` |
| `public.payments` | SELECT | Platform Admin | `role = 'MLOHUB_ADMIN' OR 'SUPER_ADMIN' = ANY(roles)` |
| `public.payments` | INSERT / UPDATE | Client | **BLOCKED**; strictly executed via Edge Functions / RPC with `SECURITY DEFINER` |
| `public.payment_events` | SELECT | Customer / Vendor | Permitted only for their own associated payment IDs |
| `public.payment_events` | UPDATE / DELETE | ALL | **BLOCKED**; trigger `trg_prevent_payment_events_mutation` enforces append-only immutability |
| `public.refunds` | SELECT | Customer / Vendor | Permitted for their own payments |
| `public.refunds` | INSERT | Non-Admin | **BLOCKED**; refunds require platform administrator authorization |

---

## 3. Handset USSD PIN Regulatory Compliance
Under Bank of Tanzania (BoT) National Payment Systems regulations and telecom carrier terms (Vodacom M-Pesa, Airtel Money, Tigo Pesa, HaloPesa):
1. Third-party applications must never present PIN entry screens or store subscriber PINs.
2. The customer enters their mobile money PIN **exclusively** on the carrier's native SIM/OS USSD dialog.
3. MloHub's client UI replaces all legacy mock PIN inputs with a clear waiting view:
   * "Angalia Simu Yako / Check Your Phone"
   * Instructions specifying the handset prompt and carrier name.
   * Prominent security reassurance: *"MloHub haitakuomba au kuhifadhi PIN yako ya mtandao wa simu."*

---

## 4. Security Verification Summary
* **Static SQL Invariant Verification:** 22/22 tests passed (`npm run security:test`).
* **Dynamic Security Rules:** 48/48 tests passed.
* **Payment Architecture E2E Tests:** 11/11 groups passed (`npm test`).
* **Type Safety & Build Status:** 0 TypeScript errors, 18/18 Expo doctor checks passed.
