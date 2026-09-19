# MLOHUB STAGE 9: PAYMENT ARCHITECTURE & SECURITY AUDIT
**Date:** September 2026  
**Document ID:** AUDIT-STAGE9-PAYMENTS-TZ-001  
**Status:** COMPLETED  
**Scope:** Migration from Simulated Client Payment Flow to Production Server-Driven Tanzanian Payment Architecture (ClickPesa Primary, Selcom Secondary, Sandbox Mode)

---

## 1. Executive Summary
Prior to Stage 9, MloHub relied on a simulated client-driven payment mock designed during early prototype sprints. While functional for UI demos, this architecture contained fundamental security vulnerabilities that made it unsuitable for real financial transactions in Tanzania. 

Stage 9 completely overhauls the payment layer, establishing a zero-trust server-driven architecture where the React Native / Expo client is treated as an **untrusted endpoint**. All payment initiation, authoritative amount resolution, webhook verification, and state transitions are executed exclusively within Supabase Edge Functions and backend database triggers.

---

## 2. Legacy Payment Implementation Flaws (Pre-Stage 9)

### Flaw 1: Client-Side Webhook Invocation & Secret Leakage
* **Observed in:** `components/PaymentCheckoutModal.tsx`
* **Vulnerability:** The client modal directly invoked:
  ```typescript
  PaymentGatewayService.processWebhook(webhookPayload, 'mlohub_cp_sec_993847291048_prod');
  ```
* **Impact:** High Severity. A malicious user or tampered client APK could forge arbitrary payment confirmation payloads with hardcoded secret tokens, instantly flipping orders to `PAID` without transferring any money.

### Flaw 2: Fake In-App PIN Prompt (Telecom USSD Anti-Pattern)
* **Observed in:** `components/PaymentCheckoutModal.tsx` (`pinInput: '••••'`)
* **Vulnerability:** The app rendered an in-app PIN entry keypad simulating telecom authentication.
* **Impact:** Severe Security & Regulatory Risk. Under Bank of Tanzania (BoT) and telecom regulations (Vodacom M-Pesa, Airtel Money, Tigo Pesa, HaloPesa), third-party applications must **never** capture, store, or solicit a customer's mobile money PIN. Mobile money PINs must be entered strictly on the telecom's native OS/SIM USSD popup prompt.

### Flaw 3: Client-Authoritative Pricing & Lack of Amount Locking
* **Observed in:** `services/PaymentGatewayService.ts` (`initiatePayment(dto)`)
* **Vulnerability:** The client supplied `amountTzs: subtotal`, `deliveryFee`, and `serviceFee` in the DTO, which the service accepted at face value.
* **Impact:** Critical Financial Risk. A user modifying client network requests or component state could change a TZS 50,000 biryani batch order to TZS 100, initiate the transaction, and mark the order confirmed.

### Flaw 4: Missing Append-Only Audit Ledger (`payment_events`)
* **Observed in:** Database schema
* **Vulnerability:** The database only contained a mutable `payments` table. State transitions (from `PENDING` to `PAID` or `FAILED`) overwrote existing rows without an immutable ledger of webhook headers, gateway transaction IDs, or actor logs.
* **Impact:** Inability to perform financial reconciliation, dispute resolution, or fraud auditing.

### Flaw 5: Hardcoded Fake Signature Bypass
* **Observed in:** `services/PaymentGatewayService.ts`
* **Vulnerability:**
  ```typescript
  if (signatureHeader && signatureHeader !== this.CLICKPESA_WEBHOOK_SECRET && !signatureHeader.startsWith('mlohub_cp_'))
  ```
* **Impact:** Any signature prefixed with `mlohub_cp_` was accepted as cryptographically valid, nullifying signature verification.

---

## 3. Stage 9 Architectural Remediations

| Area | Legacy Simulated Approach | Stage 9 Production Architecture |
| :--- | :--- | :--- |
| **Trust Model** | Client trusted to simulate payment & call webhooks | **Zero-Trust Client**: Client has zero secrets and zero state mutation authority |
| **Secrets Management** | Gateway secret stored or bypassed in client bundle | **Backend Only**: Secrets reside in Supabase Edge Functions / Vault (`CLICKPESA_API_KEY`, etc.) |
| **Amount Resolution** | Client computes and submits payable amount | **Authoritative Server Resolution**: Edge Function recalculates amount from DB records |
| **Handset PIN Prompt** | Fake in-app 4-digit PIN input | **Native Telecom Push**: Real USSD prompt sent to phone; app displays high-trust waiting view |
| **Webhook Processing** | Called from React Native component | **Public Secure Webhook**: Authenticated via HMAC-SHA256 signature verification |
| **Replay Attack Defense** | Basic status check (`status === 'PAID'`) | **Cryptographic Event Deduplication**: Unique event IDs and idempotency keys logged to `payment_events` |
| **Audit Ledger** | Mutable `payments` table only | **Append-Only Ledger**: `payment_events` logs all raw payloads, transitions, and timestamps |
| **Multi-Provider** | Hardcoded mock | **Pluggable Architecture**: `PaymentGateway` interface supporting ClickPesa, Selcom, and Sandbox |

---

## 4. Telecom Carrier Integration Matrix (Tanzania)

| Telecom / Network | Carrier Code | Method Code | USSD Fallback | Default Push Type |
| :--- | :--- | :--- | :--- | :--- |
| **Vodacom Tanzania** | VODACOM | `MPESA` | `*150*00#` | USSD Push (Menu Prompt) |
| **Airtel Tanzania** | AIRTEL | `AIRTEL_MONEY` | `*150*60#` | USSD Push (Direct Push) |
| **Yas (formerly Tigo)** | TIGO | `MIXX_BY_YAS` | `*150*01#` | USSD Push (SIM Toolkit) |
| **Halotel Tanzania** | HALOTEL | `HALOPESA` | `*150*88#` | USSD Push (Direct Prompt) |
| **Cards & Secondary** | SELCOM/CP | `CARD` | Web Redirect | 3D-Secure Hosted Checkout |

---

## 5. Audit Sign-off
* **Lead Security Auditor:** Antigravity Agentic Systems
* **Architecture Compliance:** Bank of Tanzania (BoT) Electronic Payment Guidelines & Zero-Trust Client Specification
* **Result:** Legacy flaws identified; remediation plan approved and executed.
