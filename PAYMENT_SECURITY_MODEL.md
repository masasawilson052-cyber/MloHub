# MLOHUB PAYMENT SECURITY MODEL
**Document Version:** 1.0 (Stage 9 Architecture)  
**Applies to:** Expo React Native Client, Supabase Edge Functions, ClickPesa / Selcom Gateways

---

## 1. Architectural Boundary
```
┌────────────────────────────────────────────────────────┐
│               UNTRUSTED BOUNDARY                       │
│  Expo React Native Client (iOS / Android / Web)        │
│  - No provider API keys or webhook secrets             │
│  - Cannot mutate payment status directly               │
│  - Cannot dictate authoritative pricing                │
│  - Displays USSD instructions & countdown timer        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS (User Session JWT)
                           ▼
┌────────────────────────────────────────────────────────┐
│                TRUSTED BACKEND BOUNDARY                │
│  Supabase Edge Functions & Database Triggers           │
│  - /create-payment: Resolves authoritative amounts     │
│  - /payment-webhook: HMAC-SHA256 signature check       │
│  - /get-payment-status: Direct status inquiries        │
│  - /request-refund: Admin-only refund orchestration    │
│  - PostgreSQL RLS: Tenant isolation & append-only log  │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS (Signed API Requests)
                           ▼
┌────────────────────────────────────────────────────────┐
│            OFFICIAL PAYMENT PROVIDERS                  │
│  ClickPesa (Primary) / Selcom (Secondary)              │
│  - Dispatches USSD Push to Vodacom, Airtel, Yas, Halo  │
│  - Dispatches Webhook to MloHub Backend                │
└────────────────────────────────────────────────────────┘
```

---

## 2. Security Principles

### Principle 1: Zero Secrets in Client Bundle
No secrets are compiled into the client app. Variables prefixed with `EXPO_PUBLIC_` are strictly non-sensitive configuration parameters (`EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). All payment gateway credentials (`CLICKPESA_CLIENT_ID`, `CLICKPESA_API_KEY`, `CLICKPESA_WEBHOOK_SECRET`, `SELCOM_*`) are hosted in backend environment secrets.

### Principle 2: Authoritative Database Pricing
The payable amount is locked on the server. The client specifies only the entity identifier (`orderId`, `customOrderId`, or `reservationId`). The server retrieves the price from the database record and calculates platform fees (10% commission, TZS 1,500 service fee, TZS 2,500 delivery fee) using server-side logic (`config/platformFees.ts`).

### Principle 3: Cryptographic Webhook Authenticity
All incoming webhooks from payment gateways are validated using HMAC-SHA256 digests. If a signature fails or the signature header is absent, the request is rejected with HTTP 401 and recorded in `payment_events` with status `REJECTED`.

### Principle 4: Append-Only Audit Ledger
Payment state transitions are logged in `public.payment_events`. A PostgreSQL trigger (`trg_prevent_payment_events_mutation`) enforces that rows in `payment_events` cannot be updated or deleted, providing an immutable audit trail for financial disputes and regulatory audits.

### Principle 5: Idempotency & Replay Defense
Every payment attempt generates an idempotency key. Repeating an initiation with the same idempotency key returns the existing transaction without creating duplicate gateway pushes. Duplicate webhook deliveries are acknowledged safely without re-triggering order fulfillment.
