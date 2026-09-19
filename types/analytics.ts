/**
 * Stage 11: Market Validation & Analytics Type Definitions
 * Privacy-preserving search tracking, conversion funnels, and supply gap indices.
 */

export interface CoarsenedLocation {
  wardName: string;
  latitude: number;
  longitude: number;
}

export interface SearchAnalyticsEvent {
  id: string;
  query: string;
  normalizedQuery: string;
  cuisineCategory?: string;
  wardName: string; // Centroid only, NO raw GPS
  resultsCount: number;
  isZeroResult: boolean;
  isRefinement: boolean;
  previousQuery?: string;
  sessionId: string;
  userId?: string; // Anonymized or omitted for public users
  createdAt: string;
}

export interface ZeroResultEvent {
  id: string;
  query: string;
  wardName: string;
  categoryHint?: string;
  occurredAt: string;
  refinementQuery?: string;
}

export type FunnelStage =
  | 'SEARCH_EXECUTED'
  | 'DISH_IMPRESSION'
  | 'DISH_CLICKED'
  | 'RESTAURANT_VIEWED'
  | 'ADD_TO_CART'
  | 'CHECKOUT_INITIATED'
  | 'ORDER_COMPLETED';

export interface FunnelEvent {
  id: string;
  stage: FunnelStage;
  sessionId: string;
  userId?: string;
  dishId?: string;
  restaurantId?: string;
  branchId?: string;
  wardName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SupplyGapMetric {
  id: string;
  categoryOrDish: string;
  wardName: string;
  searchDemandScore: number;
  zeroResultCount: number;
  zeroResultRate: number; // 0.0 to 1.0
  verifiedServingRestaurants: number;
  supplyGapIndex: number;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  recommendedAction: string;
  isFixtureData?: boolean;
  computedAt: string;
}

export interface ConversionFunnelReport {
  periodDays: number;
  totalSearches: number;
  dishImpressions: number;
  dishClicks: number;
  restaurantViews: number;
  cartAdditions: number;
  ordersCompleted: number;
  searchToClickRate: number;
  clickToOrderRate: number;
  funnelDropoffStage: string;
  isFixtureData?: boolean;
}
