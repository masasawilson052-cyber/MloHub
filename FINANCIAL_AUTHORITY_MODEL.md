# MloHub Financial Authority Model

## 1. Core Principle: Single Source of Truth
In earlier prototype iterations, financial calculations such as commission were occasionally calculated in ad-hoc UI fragments using arbitrary formulas (e.g. `gross * 0.10`). Under the Stage 7 production architecture:

1. **Central Authority**: All fee percentages, customer service charges, and base delivery fees are defined strictly in `config/platformFees.ts`.
2. **Server-Side Enforcement**: In PostgreSQL / Supabase, stored procedures (`create_order_secure`) compute and stamp immutable pricing snapshots on order creation.
3. **Frontend Invariance**: The frontend UI and Admin Portal consume authoritative calculation functions (`calculateOrderFinancials`) or backend-stamped order fields. Direct inline arithmetic on raw amounts is strictly prohibited.

---

## 2. Fee Structure Specifications

| Fee Component | Value | Applied To | Borne By | Beneficiary |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Commission** | 10.0% (`0.10`) | Food Item Subtotal | Restaurant (deducted from payout) | MloHub Platform |
| **Service Fee** | 1,500 TZS | Per Order | Customer | MloHub Platform |
| **Standard Delivery Fee** | 2,500 TZS | Delivery Orders (waived for Dine-In / Takeaway) | Customer | Rider / Logistics |
| **Minimum Order Value** | 2,000 TZS | Minimum food subtotal | Customer | N/A |

---

## 3. Order Breakdown Equations

```
Total Customer Charge = Subtotal (TZS) + Service Fee (TZS) + Delivery Fee (TZS)
Platform Commission = Subtotal (TZS) * Commission Rate (0.10)
Net Restaurant Payout = Subtotal (TZS) - Platform Commission (TZS)
```

---

## 4. Payment Simulation & Read-Only Governance
- **Simulation Transparency**: Mobile Money and Card payment gateways operate in SIMULATED mode until licensed merchant aggregators (ClickPesa/Selcom) are onboarded in Stage 9.
- **Admin Isolation**: Admin users cannot manually mutate a payment status to `SUCCESS` from the client. Payment state transitions are restricted to backend Webhook / RPC handlers to eliminate financial fraud and rogue account modifications.
