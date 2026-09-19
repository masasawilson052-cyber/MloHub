# MLOHUB PAYMENT PROVIDER SETUP GUIDE
**Target Providers:** ClickPesa (Primary), Selcom (Secondary / Failover)  
**Supported Methods:** Vodacom M-Pesa, Airtel Money, Mixx by Yas (Tigo), HaloPesa

---

## 1. ClickPesa Gateway Configuration (Primary)

### 1.1 Developer Account Registration
1. Register at the ClickPesa Developer Portal: [https://developer.clickpesa.com](https://developer.clickpesa.com)
2. Obtain your **Client ID** and **API Key** from the API Management dashboard.
3. Configure your **Webhook URL** in the ClickPesa portal:
   * **Staging / Sandbox:** `https://<your-supabase-project-ref>.supabase.co/functions/v1/payment-webhook`
   * **Production:** `https://api.mlohub.tz/v1/payment-webhook`
4. Set a strong, randomly generated **Webhook Secret** in the ClickPesa portal.

### 1.2 Supabase Secret Configuration
Set the backend environment secrets using the Supabase CLI:
```bash
supabase secrets set \
  PAYMENT_PROVIDER="clickpesa" \
  CLICKPESA_BASE_URL="https://api.clickpesa.com/v1" \
  CLICKPESA_CLIENT_ID="<your-clickpesa-client-id>" \
  CLICKPESA_API_KEY="<your-clickpesa-api-key>" \
  CLICKPESA_WEBHOOK_SECRET="<your-webhook-secret>"
```
*(For sandbox testing, use `CLICKPESA_BASE_URL="https://sandbox.clickpesa.com/v1"`).*

---

## 2. Selcom Gateway Configuration (Secondary / Future Failover)

### 2.1 Developer Account Registration
1. Register at the Selcom Developer Portal: [https://developer.selcom.net](https://developer.selcom.net)
2. Retrieve your **Vendor ID**, **API Key**, and **API Secret**.
3. Configure your **Callback URL** to point to `/functions/v1/payment-webhook`.

### 2.2 Supabase Secret Configuration
```bash
supabase secrets set \
  SELCOM_BASE_URL="https://api.selcom.net/v1" \
  SELCOM_VENDOR_ID="<your-vendor-id>" \
  SELCOM_API_KEY="<your-selcom-api-key>" \
  SELCOM_API_SECRET="<your-selcom-api-secret>"
```

---

## 3. Local Development & Sandbox Mode
To run MloHub locally without incurring telecom charges or requiring live accounts:
1. In your local `.env` file, set:
   ```env
   PAYMENT_PROVIDER=sandbox
   EXPO_PUBLIC_APP_ENV=development
   EXPO_PUBLIC_DEMO_MODE=true
   ```
2. The `SandboxPaymentGateway` runs locally with deterministic simulation rules:
   * **Normal numbers (e.g. +255 754 123 456):** Initiates successfully. In the checkout modal, click *"✓ Thibitisha (Approve)"* to simulate handset approval.
   * **Numbers ending in 00 (e.g. +255 754 000 000):** Simulates instant failure (insufficient funds).
3. Test suite execution:
   ```powershell
   powershell -ExecutionPolicy Bypass -Command "npm test"
   ```
