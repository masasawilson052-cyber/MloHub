# MloHub SMS Provider Setup & Operational Runbook

This guide details the setup, credential management, carrier verification, and troubleshooting procedures for Tanzanian telecom gateways integrated into MloHub.

---

## 1. Gateway Overview & Supported Telecoms

MloHub supports all licensed Tanzanian mobile network operators:

| Operator | Supported Brands | Network Prefixes | Canonical Delivery Gateway |
|---|---|---|---|
| **Vodacom Tanzania** | M-Pesa, Vodacom GSM | `074`, `075`, `076` | NextSMS / Beem Africa |
| **Airtel Tanzania** | Airtel Money | `068`, `069`, `078`, `079` | NextSMS / Beem Africa |
| **MIC Tanzania (Yas)** | Tigo, Mixx by Yas | `065`, `067`, `071` | NextSMS / Beem Africa |
| **Viettel Tanzania** | Halotel, HaloPesa | `061`, `062` | NextSMS / Beem Africa |
| **TTCL Corporation** | TTCL Mobile | `073` | NextSMS / Beem Africa |
| **Zantel** | EzyPesa (Zanzibar) | `077` | NextSMS / Beem Africa |

---

## 2. Environment Variables & Secret Security

> [!CAUTION]
> **CRITICAL SECURITY REQUIREMENT**:  
> SMS provider credentials (usernames, passwords, API keys, and secret keys) must **NEVER** be prefixed with `EXPO_PUBLIC_`.  
> Variables prefixed with `EXPO_PUBLIC_` are automatically baked into compiled JavaScript bundles by Expo / Metro Bundler and can be extracted by any user inspectable bundle.

### Required Backend Variables

Set these in your Supabase project's Edge Functions environment (`supabase secrets set ...`) or server-side `.env`:

```bash
# Gateway Selection: sandbox | nextsms | beem
SMS_PROVIDER=nextsms

# NextSMS Tanzania Gateway
NEXTSMS_USERNAME=your_nextsms_username
NEXTSMS_PASSWORD=your_nextsms_password
NEXTSMS_SENDER_ID=MLOHUB

# Beem Africa Gateway (Alternative)
BEEM_API_KEY=your_beem_api_key
BEEM_SECRET_KEY=your_beem_secret_key
BEEM_SENDER_ID=INFO

# Cryptographic Pepper for HMAC-SHA256 OTP Hashing
SMS_OTP_PEPPER=generate_a_random_32_byte_secret_here
```

---

## 3. Configuring NextSMS Tanzania

1. **Register Account**: Sign up at [https://messaging-service.co.tz](https://messaging-service.co.tz).
2. **Sender ID Approval**: Apply for your Sender ID (e.g. `MLOHUB`) via the NextSMS portal with TCRA approval documentation.
3. **API Credentials**:
   - Obtain your HTTP Basic Auth username and password.
   - Note the single message endpoint: `https://messaging-service.co.tz/api/sms/v1/text/single`.
4. **Deploy Secrets to Supabase**:
   ```bash
   npx supabase secrets set SMS_PROVIDER=nextsms
   npx supabase secrets set NEXTSMS_USERNAME="your_username"
   npx supabase secrets set NEXTSMS_PASSWORD="your_password"
   npx supabase secrets set NEXTSMS_SENDER_ID="MLOHUB"
   ```

---

## 4. Configuring Beem Africa

1. **Register Account**: Sign up at [https://beem.africa](https://beem.africa).
2. **Sender ID**: Register your Sender ID with Beem Africa.
3. **API Keys**:
   - Generate your API Key and Secret Key in the Beem dashboard.
   - Endpoint: `https://apisms.beem.africa/v1/send`.
4. **Deploy Secrets to Supabase**:
   ```bash
   npx supabase secrets set SMS_PROVIDER=beem
   npx supabase secrets set BEEM_API_KEY="your_api_key"
   npx supabase secrets set BEEM_SECRET_KEY="your_secret_key"
   npx supabase secrets set BEEM_SENDER_ID="MLOHUB"
   ```

---

## 5. Development & Sandbox Mode

When developing locally or running automated test suites:
- Set `SMS_PROVIDER=sandbox` (or leave empty).
- The system automatically engages `SandboxSmsGateway`.
- All outgoing SMS and OTP challenges are recorded deterministically into the `sms_logs` table without incurring carrier fees or network latency.
- In `SystemHealth`, the adapter status will truthfully report `SANDBOX (SIMULATED)`.

---

## 6. Live Handset Testing Procedure

Before claiming `LIVE TESTED` in `SystemHealth`:
1. Ensure your provider account has a positive prepaid TZS credit balance.
2. Add a verified Tanzanian handset number (e.g. `+255 754 357 613`).
3. Trigger an OTP request:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+255754357613", "purpose": "CUSTOMER_VERIFICATION", "language": "sw"}'
   ```
4. Verify handset reception of the SMS within 10 seconds.
5. Check `sms_logs` table in Supabase to confirm status is `SENT` and `provider_message_id` is recorded.
