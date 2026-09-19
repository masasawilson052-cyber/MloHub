/**
 * ============================================================================
 * MLOHUB FOOD-FIRST DISCOVERY DOMAIN TYPES
 * ============================================================================
 */

export type DiscoverySort =
  | 'RECOMMENDED'
  | 'NEAREST'
  | 'CHEAPEST'
  | 'HIGHEST_RATED'
  | 'FRESHEST'
  | 'MOST_POPULAR';

export type FreshnessTier = 'FRESH' | 'RECENT' | 'AGING' | 'STALE' | 'UNKNOWN';

export interface ScoreBreakdown {
  relevanceScore: number; // 0–100
  distanceScore: number;  // 0–100
  priceScore: number;     // 0–100
  ratingScore: number;    // 0–100
  freshnessScore: number; // 0–100
  availabilityScore: number; // 0–100
  overallScore: number;   // 0–100 (Weighted combination)
}

export interface DiscoveryQuery {
  query?: string;
  latitude?: number;
  longitude?: number;
  neighborhood?: string;
  maxDistanceKm?: number;
  minPriceTzs?: number;
  maxPriceTzs?: number;
  minRating?: number;
  openNow?: boolean;
  availableOnly?: boolean;
  cuisineTypes?: string[];
  dietaryTags?: string[];
  sortBy?: DiscoverySort;
  limit?: number;
  offset?: number;
}

export interface DishDiscoveryResult {
  menuItemId: string;
  dishName: string;
  dishNameSw?: string;
  description?: string;
  descriptionSw?: string;
  imageUrl?: string;

  // Restaurant & Branch Context
  restaurantId: string;
  restaurantName: string;
  restaurantLogo?: string;
  cuisineType?: string;
  branchId: string;
  branchName: string;
  neighborhood: string;
  address?: string;

  // Financials & Geometry
  priceTzs: number;
  basePriceTzs?: number;
  currency: 'TZS';
  distanceKm: number;

  // Reputation & Operation
  restaurantRating: number;
  reviewCount: number;
  isAvailable: boolean;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  isOpenNow: boolean | 'UNKNOWN';
  openingHoursSummary?: string;

  // Freshness & Trust
  lastMenuVerifiedAt?: string;
  lastPriceVerifiedAt?: string;
  lastAvailabilityVerifiedAt?: string;
  freshnessScore: number;
  freshnessTier: FreshnessTier;
  freshnessLabel: string;

  // Transparent Scoring Breakdown
  scores?: ScoreBreakdown;
}

export interface SearchAutocompleteSuggestion {
  text: string;
  type: 'dish' | 'cuisine' | 'popular' | 'recent';
  subtext?: string;
  category?: string;
}

export interface RecentSearchItem {
  id: string;
  query: string;
  timestamp: string;
  filters?: Partial<DiscoveryQuery>;
}

export interface DiscoveryResponse {
  query: DiscoveryQuery;
  results: DishDiscoveryResult[];
  totalCount: number;
  hasMore: boolean;
  appliedNeighborhood?: string;
  usingGpsLocation: boolean;
}
