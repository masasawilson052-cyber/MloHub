/**
 * ============================================================================
 * MLOHUB FOOD-FIRST DISCOVERY RANKING ENGINE
 * ============================================================================
 * Configurable multi-factor ranking formula.
 * Computes transparent scores across Relevance, Distance, Price Fit,
 * Restaurant Rating, Menu Freshness, and Availability Confidence.
 */

import { FreshnessTier, ScoreBreakdown } from '../types/discovery';

export interface RankingWeights {
  relevance: number;    // Default: 0.35
  distance: number;     // Default: 0.20
  priceFit: number;     // Default: 0.15
  rating: number;       // Default: 0.10
  freshness: number;    // Default: 0.10
  availability: number; // Default: 0.10
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  relevance: 0.35,
  distance: 0.20,
  priceFit: 0.15,
  rating: 0.10,
  freshness: 0.10,
  availability: 0.10,
};

/**
 * Calculates text relevance score (0–100).
 * Dish name matches strictly outrank restaurant name matches.
 */
export function calculateRelevanceScore(params: {
  query?: string;
  dishName: string;
  dishNameSw?: string;
  description?: string;
  restaurantName: string;
  cuisineType?: string;
  isSynonymMatch?: boolean;
}): number {
  const { query, dishName, dishNameSw, description, restaurantName, cuisineType, isSynonymMatch } = params;
  if (!query || !query.trim()) return 80; // Browse mode default

  const q = query.trim().toLowerCase();
  const nameEn = dishName.toLowerCase();
  const nameSw = (dishNameSw || '').toLowerCase();
  const desc = (description || '').toLowerCase();
  const rest = restaurantName.toLowerCase();
  const cuisine = (cuisineType || '').toLowerCase();

  // 1. Exact dish name match (highest priority)
  if (nameEn === q || nameSw === q) return 100;

  // 2. Prefix or substring in dish name
  if (nameEn.startsWith(q) || nameSw.startsWith(q)) return 95;
  if (nameEn.includes(q) || nameSw.includes(q)) return 90;

  // 3. Multi-word all words match dish name
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length > 1 && words.every((w) => nameEn.includes(w) || nameSw.includes(w))) {
    return 88;
  }

  // 4. Bilingual synonym match on dish
  if (isSynonymMatch) return 78;

  // 5. Dish description / culinary tags match
  if (desc.includes(q)) return 60;

  // 6. Cuisine type match
  if (cuisine.includes(q)) return 45;

  // 7. Restaurant name only match
  if (rest.includes(q)) return 35;

  return 20;
}

/**
 * Calculates geographic distance score (0–100).
 * Uses smooth decay over maximum radius (default 5 km).
 */
export function calculateDistanceScore(distanceKm: number, maxRadiusKm: number = 5): number {
  if (distanceKm <= 0) return 100;
  if (distanceKm >= maxRadiusKm * 2) return 10;

  const normalized = Math.min(distanceKm / maxRadiusKm, 2);
  // Linear decay to 20 at maxRadius, falling to 0 beyond 2x radius
  return Math.max(10, Math.round(100 - normalized * 45));
}

/**
 * Calculates price and budget fit score (0–100).
 * Provides value bonus for items comfortably within budget.
 */
export function calculatePriceScore(params: {
  priceTzs: number;
  budgetTzs?: number;
  minPriceTzs?: number;
}): number {
  const { priceTzs, budgetTzs, minPriceTzs } = params;

  if (budgetTzs && budgetTzs > 0) {
    if (priceTzs <= budgetTzs) {
      // Items under budget: 80 base + up to 20 points for economical value
      const savingsRatio = (budgetTzs - priceTzs) / budgetTzs;
      return Math.round(80 + savingsRatio * 20);
    }
    // Items exceeding budget receive steep penalty
    const overRatio = (priceTzs - budgetTzs) / budgetTzs;
    return Math.max(0, Math.round(70 - overRatio * 150));
  }

  // Without explicit budget, normalize around standard Dar dining benchmarks (5,000–25,000 TZS)
  if (priceTzs <= 8000) return 90;
  if (priceTzs <= 15000) return 80;
  if (priceTzs <= 25000) return 70;
  return 60;
}

/**
 * Calculates rating score (0–100).
 */
export function calculateRatingScore(rating: number, reviewCount: number = 0): number {
  if (!rating || rating <= 0) return 60;
  const base = (Math.min(5, Math.max(1, rating)) / 5.0) * 90;
  // Small credibility boost for items/restaurants with established review volume
  const volumeBonus = Math.min(10, Math.log10(reviewCount + 1) * 4);
  return Math.min(100, Math.round(base + volumeBonus));
}

/**
 * Calculates menu & price verification freshness score (0–100).
 */
export function calculateFreshnessFromTier(tier: FreshnessTier): number {
  switch (tier) {
    case 'FRESH':
      return 100;
    case 'RECENT':
      return 80;
    case 'AGING':
      return 55;
    case 'STALE':
      return 25;
    case 'UNKNOWN':
    default:
      return 20;
  }
}

/**
 * Calculates availability confidence score (0–100).
 */
export function calculateAvailabilityScore(params: {
  isAvailable: boolean;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  isOpenNow?: boolean | 'UNKNOWN';
}): number {
  const { isAvailable, stockStatus, isOpenNow } = params;

  if (!isAvailable || stockStatus === 'OUT_OF_STOCK') {
    return 0;
  }

  let score = stockStatus === 'LOW_STOCK' ? 70 : 95;

  if (isOpenNow === false) {
    score -= 20;
  }

  return Math.max(0, score);
}

/**
 * Combines all dimensional scores into a single weighted overall score (0–100).
 */
export function computeCompositeScore(
  breakdown: Omit<ScoreBreakdown, 'overallScore'>,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): ScoreBreakdown {
  const overall =
    breakdown.relevanceScore * weights.relevance +
    breakdown.distanceScore * weights.distance +
    breakdown.priceScore * weights.priceFit +
    breakdown.ratingScore * weights.rating +
    breakdown.freshnessScore * weights.freshness +
    breakdown.availabilityScore * weights.availability;

  return {
    ...breakdown,
    overallScore: Math.round(overall * 10) / 10,
  };
}
