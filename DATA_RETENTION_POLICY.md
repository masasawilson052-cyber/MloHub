# MLOHUB DATA RETENTION & PRIVACY POLICY

## 1. Overview
This document defines the authoritative data retention, redaction, and privacy policy for MloHub. It ensures regulatory compliance with Tanzanian personal data protection laws (Personal Data Protection Act, 2022) and platform principles regarding user anonymity and commercial trust.

---

## 2. Geolocation Privacy & Zero GPS Retention
MloHub enforces strict privacy gates for customer search, browsing, and discovery activity:

1. **Immediate GPS Stripping**:
   - Exact client coordinates (`latitude`, `longitude`) are processed solely in volatile memory during local food discovery to calculate approximate distance (e.g., "1.2 km away").
   - Exact GPS coordinates are **never** persisted to the analytics database (`search_analytics_events`, `zero_result_events`, `discovery_funnel_events`).
2. **Municipal Centroid Coarsening**:
   - Location queries are snapped to pre-defined municipal ward / neighborhood centroids in Dar es Salaam (*Kariakoo, Masaki/Oysterbay, Mikocheni, Sinza/Kijitonyama, Kinondoni, City Centre/Posta, Ilala/Upanga, Mbezi Beach, Tegeta, Mwenge*).
3. **No Movement Profiling**:
   - Platform analytics cannot reconstruct customer paths, travel routes, home addresses, or personal movement routines.

---

## 3. Data Lifespan & Pruning Schedule

| Data Category | Retention Period | Post-Expiry Action | Justification |
|---|---|---|---|
| **Raw Search Telemetry** (`search_analytics_events`) | 90 Days | Hard Purged or Rolled up to aggregate counts | Market trend analysis only requires aggregated counts |
| **Zero-Result Query Logs** (`zero_result_events`) | 60 Days | Aggregated to monthly supply gap metrics; raw records purged | Demand gap identification |
| **Funnel Progression Logs** (`discovery_funnel_events`) | 90 Days | Rolled up into weekly conversion rates; records purged | Conversion rate optimization |
| **Customer Discrepancy Reports** (`customer_discrepancy_reports`) | 1 Year | Retained for audit & restaurant quality scoring; user ID anonymized after 180 days | Accountability and trust dispute history |
| **Dish Trust Score History** (`dish_trust_scores`) | Permanent (Current) / 1 Year (Audit log) | Archived to analytical data warehouse | Historical price volatility tracking |
| **Order History & Financial Receipts** | 7 Years | Legal financial retention | Compliance with Tanzanian Revenue Authority (TRA) standards |

---

## 4. User Anonymity & PII Protection
- **Unauthenticated Diners**: Search queries executed by unauthenticated guests carry a randomized session hash (`sessionId`) without IP tracking or browser fingerprint storage.
- **Customer Discrepancy Reports**: Diners submitting reports are shielded from restaurant retaliation; the restaurant operator only sees the dish name, reported price, and evidence without diner PII.
