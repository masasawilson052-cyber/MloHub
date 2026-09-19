# MLOHUB MARKET VALIDATION & SUPPLY GAP MODEL

## 1. Overview
The Market Validation Data Layer turns passive search queries, zero-result searches, and conversion funnel drop-offs into actionable market intelligence for platform operators and restaurant partners.

It answers the critical commercial questions:
- *Where is food demand greater than verified supply?*
- *What specific dishes are diners searching for in which Dar es Salaam neighborhoods without finding options?*
- *Which price points cause customers to abandon checkout?*

---

## 2. Mathematical Definition of Supply Gap Index

The **Supply Gap Index ($SGI$)** quantifies unmet demand for a food item or cuisine category $k$ within a municipal ward $w$:

$$SGI(k, w) = \frac{D(k, w) \times \left(1 + Z(k, w) \times W_z\right)}{S_{\text{verified}}(k, w) + 1}$$

Where:
- $D(k, w)$: Search Demand Volume (number of searches for query $k$ in ward $w$ over rolling 7 days).
- $Z(k, w)$: Zero-Result Rate ($0.0 \le Z \le 1.0$, percentage of searches that returned zero dishes).
- $W_z$: Zero-Result Multiplier Weight ($W_z = 2.0$, amplifying demand when customers completely fail to find food).
- $S_{\text{verified}}(k, w)$: Number of verified partner restaurants actively serving dish $k$ in ward $w$.
- $+1$: Laplace smoothing denominator preventing division by zero.

### Urgency Classification Tiers
- **CRITICAL GAP ($SGI \ge 15.0$)**: Immediate commercial opportunity; urgent restaurant onboarding required.
- **HIGH GAP ($8.0 \le SGI < 15.0$)**: High customer interest with limited menu variety.
- **MODERATE GAP ($4.0 \le SGI < 8.0$)**: Healthy market with room for specialty competitors.
- **BALANCED / LOW GAP ($SGI < 4.0$)**: Sufficient verified supply meeting current search demand.

---

## 3. Discovery Conversion Funnel Architecture

The customer food discovery journey is tracked across 7 privacy-coarsened stages:

```
[1] SEARCH_EXECUTED (User enters query / filters)
       │
       ▼
[2] DISH_IMPRESSION (Dish cards rendered in viewport)
       │
       ▼
[3] DISH_CLICKED (User selects dish to view details)
       │
       ▼
[4] RESTAURANT_VIEWED (User enters restaurant profile)
       │
       ▼
[5] ADD_TO_CART (Dish added to active order drawer)
       │
       ▼
[6] CHECKOUT_INITIATED (User opens order review & payment screen)
       │
       ▼
[7] ORDER_COMPLETED (Order accepted and confirmed)
```

### Funnel Drop-off Diagnostic Metrics
1. **Search-to-Click Ratio**: $\frac{\text{Dish Clicks}}{\text{Searches}}$. Low ratio indicates poor search relevance or unappealing listings.
2. **Click-to-Cart Ratio**: $\frac{\text{Cart Additions}}{\text{Dish Clicks}}$. Low ratio indicates price sensitivity or missing options.
3. **Cart-to-Order Ratio**: $\frac{\text{Orders Completed}}{\text{Cart Additions}}$. Low ratio indicates delivery fee or payment friction.

---

## 4. Privacy & Ethical Boundaries
- All market intelligence metrics are computed from coarsened ward centroids.
- No individual diner search history is ever exposed to restaurant partners or third parties.
- Reports for restaurants show aggregated demand (e.g., *"140 people in Mikocheni searched for Zanzibar Mix this week"*), never customer identities.
