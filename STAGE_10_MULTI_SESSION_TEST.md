# Stage 10: Multi-Session Live Realtime Testing Guide

## 1. Objective
This test script validates cross-session, cross-device real-time event propagation between:
- **Session A**: Customer (placing orders, requesting custom meals, viewing live status)
- **Session B**: Restaurant Operator (accepting orders, updating kitchen kanban, editing menu)
- **Session C**: Platform Administrator (reviewing vendor registrations, fraud reports)

---

## 2. Preparation & Setup

1. Start the MloHub development server:
   ```bash
   npx expo start --web
   ```
2. Open three separate private browser windows (or distinct physical devices):
   - **Window 1 (Customer)**: `http://localhost:8081` (Log in as customer: `frank@mlohub.co.tz`)
   - **Window 2 (Restaurant)**: `http://localhost:8081/restaurant-portal` (Log in as owner: `amina@biryani.co.tz`)
   - **Window 3 (Admin)**: `http://localhost:8081/admin` (Log in as admin: `admin@mlohub.co.tz`)

---

## 3. Step-by-Step Multi-Session Verification Flows

### Flow 1: Order Placement to Delivery Completion (Zero-Refresh)
1. **Window 1 (Customer)**:
   - Browse to Mama Amina Authentic Biryani.
   - Add "Chicken Biryani" to cart.
   - Proceed to checkout, select "Mobile Money (M-Pesa)", and click "Pay with Sandbox".
   - Payment succeeds. The customer screen displays: **Status: Received (`PENDING`)**.
2. **Window 2 (Restaurant)**:
   - **DO NOT REFRESH THE PAGE**.
   - Notice the Attention Center and Incoming Orders queue automatically updates within 500ms.
   - Click "Accept Order" and set estimated prep time to 25 minutes.
3. **Window 1 (Customer)**:
   - Notice the status updates immediately to **"Accepted" (`ACCEPTED`)** with prep timer without touching the device.
4. **Window 2 (Restaurant)**:
   - Switch to **Kitchen Board** tab.
   - Find the order card and click **"Start Cooking 🔥"**.
5. **Window 1 (Customer)**:
   - Notice the status updates immediately to **"Cooking" (`PREPARING`)**.
6. **Window 2 (Restaurant)**:
   - Click **"Mark Ready ✅"** on the kitchen card.
7. **Window 1 (Customer)**:
   - Notice the status updates immediately to **"Ready" (`READY`)**.
8. **Window 2 (Restaurant)**:
   - Click **"Complete Order 🚀"**.
9. **Window 1 (Customer)**:
   - Status transitions to **"Completed" (`COMPLETED`)** and prompts the customer to rate their meal.

---

### Flow 2: Live Menu Price & Availability Updates
1. **Window 1 (Customer)**:
   - Add "Authentic Chicken Biryani" to cart (Price: 12,000 TZS).
   - Keep the cart open.
2. **Window 2 (Restaurant)**:
   - Go to **Menu Manager** tab.
   - Edit "Authentic Chicken Biryani", change price to 14,000 TZS, and save.
3. **Window 1 (Customer)**:
   - Observe real-time alert: *"The price for 'Authentic Chicken Biryani' has updated from TZS 12,000 to TZS 14,000."*
   - Cart subtotal recalculates automatically without user interaction.
4. **Window 2 (Restaurant)**:
   - Toggle availability of "Authentic Chicken Biryani" to OFF (Sold out).
5. **Window 1 (Customer)**:
   - Observe alert: *"Item Sold Out: 'Authentic Chicken Biryani' is currently out of stock."*

---

### Flow 3: Custom Meal Negotiation
1. **Window 1 (Customer)**:
   - Go to "Custom" tab, enter request: "Zanzibar Spiced Beef Pilau for 20 guests", and submit.
2. **Window 2 (Restaurant)**:
   - Attention Center rings with a new custom meal request.
   - Operator clicks "Quote", submits quote for 160,000 TZS.
3. **Window 1 (Customer)**:
   - Real-time notification appears with the quote.
   - Customer clicks "Accept Quote", pays via sandbox mobile money.
4. **Window 2 (Restaurant)**:
   - Confirmed custom meal order arrives directly in kitchen queue in `PENDING` state.
