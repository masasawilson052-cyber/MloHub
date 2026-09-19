/**
 * Stage 11: Canonical Trust & Data Quality Rules Configuration
 * Single source of truth for decay schedules, Bayesian priors,
 * anti-sabotage rate limits, and explainability thresholds.
 */

export const TRUST_RULES = {
  // Freshness Decay Boundaries (in milliseconds)
  FRESHNESS_THRESHOLDS_MS: {
    FRESH: 24 * 60 * 60 * 1000,      // <= 24 hours
    RECENT: 72 * 60 * 60 * 1000,     // > 24 hours && <= 72 hours
    AGING: 7 * 24 * 60 * 60 * 1000,  // > 72 hours && <= 7 days
    STALE: 30 * 24 * 60 * 60 * 1000, // > 7 days (decay penalty accelerates)
  },

  // Confidence Multipliers based on Verification Age
  DECAY_MULTIPLIERS: {
    FRESH: 1.0,     // 100% confidence retention
    RECENT: 0.85,   // 85% confidence
    AGING: 0.60,    // 60% confidence
    STALE: 0.30,    // 30% confidence
    UNKNOWN: 0.0,   // Unverified / No historical audit
  },

  // Bayesian Priors for Fulfillment Reliability
  // Prior represents a platform average of 85% reliability over C = 10 pseudo-orders
  BAYESIAN_FULFILLMENT_PRIOR: {
    PSEUDO_COUNT_C: 10,
    ALPHA_PRIOR: 8.5, // 8.5 successes out of 10
    BETA_PRIOR: 1.5,  // 1.5 failures out of 10
    MINIMUM_EVALUATION_SAMPLE: 5, // Below 5 orders, flagged as NEW_RESTAURANT
  },

  // Discrepancy Reporting & Anti-Sabotage Rate Limits
  REPORT_LIMITS: {
    MAX_REPORTS_PER_ITEM_PER_USER_HOURS: 24, // 1 report per item per user per 24 hours
    MAX_REPORTS_PER_USER_DAILY: 3,           // Max 3 discrepancy reports per user per day
    CONFIRMED_ORDER_WEIGHT_BONUS: 3.0,       // Customer with paid order has 3x weight
    WALK_IN_REPORT_WEIGHT: 1.0,              // Walk-in / unverified report weight
    CORROBORATION_THRESHOLD: 2,              // 2 independent reports trigger immediate flag
  },

  // Report Impact Penalties on Price Confidence (0.0 to 1.0 scale)
  REPORT_PENALTIES: {
    UNVERIFIED_REPORT: 0.15, // Single unverified report lowers confidence slightly
    UNDER_REVIEW: 0.35,      // Multiple reports or flagged by system
    CONFIRMED_DISCREPANCY: 0.70, // Confirmed price error drops confidence to LOW
  },

  // Rapid Trust Recovery Parameters
  RECOVERY: {
    RESTAURANT_UPDATE_RESTORES_FRESH: true, // Manual price update resets timer to FRESH
    PHOTO_AUDIT_BONUS_DAYS: 7,              // Photo-verified audit extends FRESH window by 7 days
  },

  // Market Supply Gap Scoring Weights
  SUPPLY_GAP: {
    MIN_SEARCH_VOLUME_THRESHOLD: 10,
    ZERO_RESULT_WEIGHT: 2.0,
    HIGH_GAP_THRESHOLD: 15.0,
    MEDIUM_GAP_THRESHOLD: 8.0,
  },

  // Dar es Salaam Municipal Wards / Centroids for Privacy Preserving Coarsening
  DARES_SALAAM_CENTROIDS: [
    { name: 'Kariakoo', latitude: -6.8212, longitude: 39.2785 },
    { name: 'Masaki / Oysterbay', latitude: -6.7584, longitude: 39.2829 },
    { name: 'Mikocheni', latitude: -6.7725, longitude: 39.2435 },
    { name: 'Sinza / Kijitonyama', latitude: -6.7820, longitude: 39.2290 },
    { name: 'Kinondoni', latitude: -6.7938, longitude: 39.2612 },
    { name: 'City Centre / Posta', latitude: -6.8163, longitude: 39.2885 },
    { name: 'Ilala / Upanga', latitude: -6.8122, longitude: 39.2680 },
    { name: 'Mbezi Beach', latitude: -6.7089, longitude: 39.2256 },
    { name: 'Tegeta', latitude: -6.6710, longitude: 39.1980 },
    { name: 'Mwenge', latitude: -6.7680, longitude: 39.2195 },
  ] as const,
};
