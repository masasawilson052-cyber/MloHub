/**
 * ============================================================================
 * MLOHUB CATEGORY SEARCH SERVICE
 * ============================================================================
 * Implements multi-channel category discovery:
 * Runs in parallel:
 *   1. Search by category.cuisineTypes (if any)
 *   2. Search by each of the category's top 3 keywords
 * Merges and de-duplicates by dish ID (menuItemId), keeps the best score,
 * and applies the active sort while honoring all other discovery filters.
 */

import { DiscoveryService } from './DiscoveryService';
import { FoodCategory } from '../config/foodCategories';
import { DiscoveryQuery, DishDiscoveryResult, DiscoverySort } from '../types/discovery';

export function sortDishes(dishes: DishDiscoveryResult[], sortBy?: DiscoverySort): DishDiscoveryResult[] {
  const sorted = [...dishes];
  switch (sortBy) {
    case 'NEAREST':
      return sorted.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    case 'CHEAPEST':
      return sorted.sort((a, b) => a.priceTzs - b.priceTzs);
    case 'HIGHEST_RATED':
      return sorted.sort((a, b) => (b.restaurantRating ?? 0) - (a.restaurantRating ?? 0));
    case 'FRESHEST':
      return sorted.sort((a, b) => (b.freshnessScore ?? 0) - (a.freshnessScore ?? 0));
    case 'MOST_POPULAR':
      return sorted.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case 'RECOMMENDED':
    default:
      return sorted.sort((a, b) => (b.scores?.overallScore ?? 0) - (a.scores?.overallScore ?? 0));
  }
}

export async function searchByCategory(
  category: FoodCategory,
  baseFilters: Omit<DiscoveryQuery, 'query' | 'cuisineTypes'>,
  sortBy: DiscoverySort = 'RECOMMENDED'
): Promise<{
  results: DishDiscoveryResult[];
  totalCount: number;
}> {
  const promises: Promise<{ results: DishDiscoveryResult[] }>[] = [];

  // 1. Search by cuisineTypes (if any specified)
  if (category.cuisineTypes && category.cuisineTypes.length > 0) {
    promises.push(
      DiscoveryService.searchDishes({
        ...baseFilters,
        query: '',
        cuisineTypes: category.cuisineTypes,
        sortBy,
        limit: 30,
      })
    );
  }

  // 2. Search by each top keyword individually
  for (const keyword of category.searchKeywords) {
    if (keyword && keyword.trim()) {
      promises.push(
        DiscoveryService.searchDishes({
          ...baseFilters,
          query: keyword.trim(),
          cuisineTypes: undefined,
          sortBy,
          limit: 30,
        })
      );
    }
  }

  const searchResponses = await Promise.all(promises);

  // 3. Merge and de-duplicate by dish id (menuItemId), keeping best score
  const dishMap = new Map<string, DishDiscoveryResult>();

  for (const res of searchResponses) {
    for (const dish of res.results) {
      const existing = dishMap.get(dish.menuItemId);
      if (!existing) {
        dishMap.set(dish.menuItemId, dish);
      } else {
        const existingScore = existing.scores?.overallScore ?? 0;
        const currentScore = dish.scores?.overallScore ?? 0;
        if (currentScore > existingScore) {
          dishMap.set(dish.menuItemId, dish);
        }
      }
    }
  }

  const merged = Array.from(dishMap.values());
  const sorted = sortDishes(merged, sortBy);

  return {
    results: sorted,
    totalCount: sorted.length,
  };
}
