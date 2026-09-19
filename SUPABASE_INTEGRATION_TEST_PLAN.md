# MloHub Supabase Live Integration Test Plan

**Document Version:** 1.0 (Stage 2 Verification)  
**System:** MloHub Expo / React Native App & Supabase PostgreSQL Backend

---

## 1. Objectives & Prerequisites

This integration test plan validates that the client application, repository layer, and live Supabase PostgreSQL database interact correctly across all roles without relying on client-side simulation.

### Prerequisites:
1. A running Supabase project instance (local Supabase CLI or hosted at `*.supabase.co`).
2. Migration files executed in order:
   - `supabase/migrations/20260908000001_mlohub_core_schema.sql`
   - `supabase/migrations/20260916000001_initial_auth.sql`
   - `supabase/migrations/20260916000002_stage2_data_layer.sql`
3. Seed data applied:
   - `supabase/seed.sql`
4. Environment variables populated in `.env`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   EXPO_PUBLIC_USE_MOCK_DATA=false
   ```

---

## 2. Test Scenarios Matrix

### Scenario 1: Customer Discovery & Restaurant Listing
- **Actor:** Anonymous / Authenticated Customer
- **Flow:**
  1. Open app (`app/(tabs)/index.tsx`).
  2. Verify `RestaurantRepository.list()` queries PostgreSQL `restaurants` table.
  3. Filter by neighborhood: "Mikocheni", "Sinza", "Mwenge", "Masaki".
  4. Verify Swahili/English full-text search works via PostgreSQL `search_tsv` column on `menu_items`.
- **Success Criteria:**
  - Restaurants returned match seeded Dar es Salaam spots.
  - No client-side `MloHubDB` fallback logs appear in console.
  - Verified badges and price in TZS render correctly.

---

### Scenario 2: Standard Order Placement with Line-Item Snapshots
- **Actor:** Authenticated Customer (`frank.mlaki@mlohub.tz`)
- **Flow:**
  1. Navigate to `mama-amina-biryani` detail page (`app/restaurant/[id].tsx`).
  2. Select 2x "Zanzibar Beef Biryani" (12,000 TZS each) and 1x "Fresh Ukwaju Juice" (3,000 TZS).
  3. Choose Delivery to "Mikocheni B".
  4. Confirm order submission (`OrderService.submitStandardMenuOrder`).
- **PostgreSQL Assertions:**
  - Row inserted in `public.orders` with `subtotal_tzs = 27000`, `service_fee_tzs = 1500`, `delivery_fee_tzs = 2500`, `total_tzs = 31000`.
  - Rows inserted in `public.order_items` with immutable snapshots:
    - `item_name_snapshot = 'Zanzibar Beef Biryani'`, `price_snapshot = 12000`.
    - `item_name_snapshot = 'Fresh Ukwaju Juice'`, `price_snapshot = 3000`.
  - Notification inserted into `public.notifications` for both Customer and Restaurant Owner.

---

### Scenario 3: Real-Time Kitchen Order Acceptance & Progression
- **Actor:** Restaurant Owner (`mama.amina@mlohub.tz`) in Kitchen Portal
- **Flow:**
  1. Restaurant Owner opens Kitchen Portal (`app/restaurant-portal/index.tsx`).
  2. Real-time subscription receives WebSocket event (`orders:restaurant:mama-amina-biryani`).
  3. Owner clicks "Accept Order" with estimated prep time of 25 minutes.
  4. Owner clicks "Ready for Pickup".
- **PostgreSQL Assertions:**
  - `public.orders` status changes from `PENDING` ➔ `ACCEPTED` ➔ `READY`.
  - Timestamps `accepted_at` and `ready_at` are populated by PostgreSQL.
  - Customer's active order tracking screen updates instantaneously via WebSocket.

---

### Scenario 4: Dining Reservation with 50% Advance Mobile Deposit
- **Actor:** Customer (`amina.bakari@mlohub.tz`)
- **Flow:**
  1. Open Dining Reservation modal (`components/ReservationModal.tsx`).
  2. Select Date: 2026-09-25, Time: 08:00 PM, Party Size: 4 Guests.
  3. Select Deposit Option: `50% Advance Deposit (Lipa Nusu)`.
  4. Verify calculated amount is 20,000 TZS (4 guests * 10,000 = 40,000 * 50%).
  5. Submit reservation (`ReservationService.createReservation`).
- **PostgreSQL Assertions:**
  - Row inserted in `public.reservations`:
    - `party_size = 4`
    - `deposit_amount_tzs = 20000`
    - `deposit_option = 'deposit_50'`
    - `is_deposit_paid = false`
    - `status = 'CONFIRMED'`
  - Notification dispatched to restaurant manager.

---

### Scenario 5: Custom Meal Request & Chef Bidding Flow
- **Actor:** Customer + Multiple Chefs
- **Flow:**
  1. Customer submits Custom Meal Request (`app/(tabs)/custom.tsx`):
     - Dish: "15-Person Coastal Pilau & Whole Roasted Goat Leg"
     - Budget: 250,000 TZS
     - Delivery Location: "Masaki"
  2. Two distinct restaurants bid:
     - Chef Amina quotes 240,000 TZS with prep time 120 mins.
     - Chef Rashid quotes 220,000 TZS with prep time 90 mins.
  3. Customer reviews bids and accepts Chef Rashid's quote.
- **PostgreSQL Assertions:**
  - Row created in `public.custom_meal_requests`.
  - Two rows created in `public.restaurant_quotes`.
  - Winning quote updates `accepted_quote_id` on request.
  - Losing quotes marked as `ARCHIVED`.

---

### Scenario 6: Row Level Security Boundary Verification
- **Actor:** Attacker / Cross-Tenant User
- **Test Actions:**
  1. Customer A attempts to query `SELECT * FROM orders WHERE user_id = 'customer_b_uuid';`
     - Expected: Returns empty set `[]` (RLS blocks row visibility).
  2. Restaurant Owner A attempts to query `SELECT * FROM orders WHERE restaurant_id = 'restaurant_b_id';`
     - Expected: Returns empty set `[]`.
  3. Direct client attempt to update `price_snapshot` on existing `order_items` row:
     - Expected: PostgreSQL error (RLS policy rejects update).
  4. Anonymous user queries `public.audit_logs`:
     - Expected: 403 Forbidden / Empty result set.

---

### Scenario 7: Cloud Storage Uploads (Food Photos & Banners)
- **Actor:** Restaurant Owner
- **Flow:**
  1. Pick food photo from camera roll (`ImageUploadService.ts`).
  2. Upload to Supabase Storage bucket `menu-images`.
  3. Retrieve public URL and save to `menu_items.photo_url`.
- **Assertions:**
  - Object uploaded into Supabase storage under `/dishes/{restaurantId}/*`.
  - Public URL accessible via CDN.
  - Image renders cleanly in Expo `<Image>` component.

---

## 3. Automated & Manual Execution Guide

### Automated Run:
```bash
npm run typecheck
npm test
```

### Live Supabase Test Run (with configured `.env`):
```bash
npm run test
```
The test runner will detect `isSupabaseConfigured() === true` and execute live queries directly against your cloud database.
