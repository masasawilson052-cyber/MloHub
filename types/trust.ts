/**
 * Stage 11: Trust & Data Quality Type Definitions
 * Multi-dimensional, explainable trust assessments without single-rating collapse.
 */

export type TrustFreshnessCategory = 'FRESH' | 'RECENT' | 'AGING' | 'STALE' | 'UNKNOWN';

export type TrustTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type TrustDimension =
  | 'MENU_FRESHNESS'
  | 'PRICE_CONFIDENCE'
  | 'AVAILABILITY_CONFIDENCE'
  | 'HOURS_CONFIDENCE'
  | 'LOCATION_CONFIDENCE'
  | 'FULFILLMENT_RELIABILITY'
  | 'CUSTOMER_REPORT_HEALTH'
  | 'VERIFICATION_STATUS';

export type CustomerReportEvidenceState =
  | 'UNVERIFIED_REPORT'
  | 'UNDER_REVIEW'
  | 'CONFIRMED'
  | 'DISMISSED'
  | 'RESTAURANT_CORRECTED'
  | 'ADMIN_RESOLVED';

export type ReportCategory =
  | 'PRICE_DISCREPANCY'
  | 'OUT_OF_STOCK'
  | 'CLOSED_DURING_OPEN_HOURS'
  | 'WRONG_LOCATION'
  | 'DISH_NOT_ON_MENU'
  | 'OTHER';

export interface CustomerDiscrepancyReport {
  id: string;
  restaurantId: string;
  branchId?: string;
  menuItemId?: string;
  dishName: string;
  reportedPrice?: number;
  listedPrice?: number;
  category: ReportCategory;
  description?: string;
  evidenceUrl?: string; // Optional receipt photo
  reportedByUserId: string;
  hasPaidOrderHistory: boolean;
  evidenceState: CustomerReportEvidenceState;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface DishTrustAssessment {
  dishId: string;
  dishName: string;
  branchId?: string;
  restaurantId: string;
  // Multi-dimensional tiers
  overallTier: TrustTier;
  priceTier: TrustTier;
  availabilityTier: TrustTier;
  freshnessCategory: TrustFreshnessCategory;
  // Numerical values (strictly internal / operational)
  priceConfidenceScore: number; // 0.0 to 1.0
  // Explainability
  badgeLabel: string;
  badgeTone: 'positive' | 'neutral' | 'warning' | 'critical';
  shortExplanation: string;
  detailedReasons: string[];
  lastVerifiedAt?: string;
  lastVerifiedBy?: 'RESTAURANT' | 'ADMIN' | 'COMMUNITY_VERIFIED';
  isReportedDiscrepancy: boolean;
  evidenceState?: CustomerReportEvidenceState;
}

export interface RestaurantTrustAssessment {
  restaurantId: string;
  restaurantName: string;
  // Legal Identity
  legalVerificationStatus: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'REJECTED';
  isBrelaVerified: boolean;
  isTinVerified: boolean;
  // Operational Dimensions
  fulfillmentReliabilityTier: TrustTier;
  bayesianReliabilityRate: number; // 0.0 to 1.0 (internal)
  actualCompletedOrders: number;
  totalOrdersCount: number;
  hoursConfidenceTier: TrustTier;
  locationConfidenceTier: TrustTier;
  overallHealthTier: TrustTier;
  // Sample & Transparency
  isLowSample: boolean; // Flagged when totalOrders < 5
  sampleSizeWarning?: string;
  // Report Health
  activeDiscrepancyCount: number;
  reportHealthTier: TrustTier;
  // Plain Language Explanations
  summaryBadge: string;
  badgeTone: 'positive' | 'neutral' | 'warning' | 'critical';
  explanations: {
    identity: string;
    fulfillment: string;
    menuFreshness: string;
    reportHealth: string;
  };
}

export interface TrustAuditEntry {
  id: string;
  entityType: 'DISH' | 'RESTAURANT' | 'REPORT';
  entityId: string;
  dimension: TrustDimension;
  previousScore?: number | string;
  newScore: number | string;
  reason: string;
  actorUserId?: string;
  createdAt: string;
}
