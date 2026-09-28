# MloHub Server-Authoritative Route Delivery Quotes Guide

## 1. Overview & Architecture

MloHub utilizes a **server-authoritative, route-based delivery pricing model**. 

Unlike naive client-side distance estimates or static delivery fees, MloHub computes actual road driving distances and transit durations using the **Google Routes API (v2:computeRoutes)** executed exclusively within server-side Supabase Edge Functions (`quote-delivery`).

```
┌─────────────────────────────────┐
│     Customer Mobile / Web       │
│  (components/OrderReviewModal)  │
└──────────────┬──────────────────┘
               │ 1. Debounced Quote Request (branchId, customer lat/lng)
               ▼
┌─────────────────────────────────┐
│   Supabase Edge Function        │
│      (`quote-delivery`)         │
└───────┬─────────────────┬───────┘
        │                 │
        │ 2. Compute      │ 3. Fetch Pricing Config
        │    Driving      │    (branch_delivery_pricing)
        ▼    Route        ▼
┌───────────────┐ ┌───────────────┐
│ Google Routes │ │ Supabase DB   │
│   API (v2)    │ │ (PostgreSQL)  │
└───────────────┘ └───────┬───────┘
                          │ 4. Persist Quote (15-min TTL)
                          ▼
                  ┌───────────────┐
                  │public.delivery│
                  │    _quotes    │
                  └───────────────┘
```

---

## 2. Security Guardrails

> [!IMPORTANT]
> **Zero Client-Side Exposure**: `GOOGLE_ROUTES_API_KEY` must **NEVER** be prefixed with `EXPO_PUBLIC_` or placed in `.env.local` or client-side application code.

- **Private Secret Storage**: The API key is stored strictly as a Supabase Edge Function secret (`GOOGLE_ROUTES_API_KEY`).
- **Server Authority**: The Expo client never calculates delivery fees or passes arbitrary fee amounts to order submission.
- **Fail-Closed Range Enforcement**: If the route distance exceeds the branch's maximum delivery distance (`max_delivery_distance_km`), the server throws `OUTSIDE_DELIVERY_RANGE`, preventing orders outside service coverage.

---

## 3. Google Routes API Setup

### Step 1: Obtain a Google Cloud API Key
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Routes API** (specifically Directions / Compute Routes v2).
3. Under **Credentials**, create an API key.
4. **Key Restrictions (Recommended)**:
   - Application restrictions: None or IP address restriction (if using fixed egress IPs).
   - API restrictions: Restrict key exclusively to **Routes API**.

### Step 2: Store Key in Supabase Secrets
Run the following via Supabase CLI or configure in Supabase Dashboard (**Project Settings** → **Edge Functions** → **Secrets**):
```bash
supabase secrets set GOOGLE_ROUTES_API_KEY="AIzaSyYourSecretRoutesKeyHere..."
```

---

## 4. Fallback Architecture (Key Unset or Network Failure)

If `GOOGLE_ROUTES_API_KEY` is not yet configured or Google's API experiences an outage, MloHub **does not crash**:
1. It automatically computes the geodesic distance using the Haversine formula:
   $$\text{Haversine}(lat_1, lon_1, lat_2, lon_2)$$
2. It applies a road-curvature factor ($1.28\times$) representing typical urban road detour in Tanzanian cities.
3. It estimates driving transit duration at an urban average speed of 25 km/h.
4. It sets `is_simulated = TRUE` in the persisted quote record and flags `isProvisional = true` to the client so that administrators and customers are aware.

---

## 5. Branch Delivery Pricing Model

Delivery pricing is configured per branch in `public.branch_delivery_pricing`:

| Column | Default Value | Description |
| :--- | :--- | :--- |
| `base_fee_tzs` | `2000` | Base delivery fee in Tanzanian Shillings |
| `included_distance_meters` | `2000` (2 km) | Distance included in the base fee |
| `billing_increment_meters` | `1000` (1 km) | Distance bucket for incremental pricing |
| `fee_per_increment_tzs` | `500` | Additional fee added per billing increment |
| `minimum_fee_tzs` | `2000` | Absolute minimum delivery fee floor |
| `maximum_fee_tzs` | `15000` | Absolute maximum delivery fee cap |
| `max_delivery_distance_meters` | `25000` (25 km) | Hard delivery radius cutoff |
| `configuration_confirmed` | `FALSE` | Set to `TRUE` once restaurant owner confirms rates |

### Mathematical Fee Formula
```
BillableMeters = max(0, RouteDistanceMeters - IncludedDistanceMeters)
Increments     = ceil(BillableMeters / BillingIncrementMeters)
RawFee         = BaseFeeTzs + (Increments * FeePerIncrementTzs)
FinalFee       = clamp(RawFee, MinimumFeeTzs, MaximumFeeTzs)
```

### Examples
- **1.5 km**: Within 2 km included distance $\rightarrow$ **2,000 TZS**
- **3.2 km**: 1.2 km over included $\rightarrow$ 2 increments ($2 \times 500 = 1,000$) $\rightarrow$ **3,000 TZS**
- **7.5 km**: 5.5 km over included $\rightarrow$ 6 increments ($6 \times 500 = 3,000$) $\rightarrow$ **5,000 TZS**
- **26 km**: Exceeds 25 km cutoff $\rightarrow$ **OUTSIDE_DELIVERY_RANGE** error

---

## 6. Quote Lifecycle & Database Integration

1. **Quote Generation**: `quote-delivery` persists a record in `public.delivery_quotes` with `expires_at = now() + interval '15 minutes'`.
2. **Review Modal**: `OrderReviewModal.tsx` fetches the quote when customer coordinates are available, displaying the route distance, ETA, and breakdown.
3. **Atomic Consumption**: When the customer submits the order, `create_order_secure` verifies:
   - Quote exists and belongs to the authenticated customer (`user_id`).
   - Quote branch matches order branch (`branch_id`).
   - Quote has not expired (`expires_at > now()`).
   - Quote has not already been consumed (`consumed_at IS NULL`).
4. **Fulfillment Type Rule**:
   - `DELIVERY`: Uses quoted delivery fee.
   - `TAKEAWAY` (Pickup): Delivery fee is strictly **0 TZS**.
   - `DINE_IN`: Delivery fee is strictly **0 TZS**.
