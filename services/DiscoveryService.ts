/**
 * ============================================================================
 * MLOHUB DISCOVERY SERVICE
 * ============================================================================
 * Orchestrates food discovery, bilingual synonym expansions, ranking adjustments,
 * autocomplete suggestions, and similar dish fallbacks.
 */

import { DiscoveryRepository } from '../repositories/discovery.repository';
import { DiscoveryQuery, DishDiscoveryResult, SearchAutocompleteSuggestion } from '../types/discovery';
import { expandSearchTerms } from '../config/foodSynonyms';
import { SupplyGapService } from './SupplyGapService';

const POPULAR_SEARCH_KEYWORDS = [
  'Chicken Biryani',
  'Chipsi Kuku',
  'Zanzibar Pilau',
  'Nyama Choma',
  'Kuku wa Kienyeji Mchemsho',
  'Samaki wa Kupika',
  'Ndizi Machoma',
  'Mishkaki ya Ngombe',
  'Ugali Samaki',
  'Beef Biryani',
];

export class DiscoveryService {
  /**
   * Executes food discovery search with synonym expansion, ranking,
   * and privacy-preserving market intelligence telemetry.
   */
  public static async searchDishes(query: DiscoveryQuery): Promise<{
    results: DishDiscoveryResult[];
    totalCount: number;
    query: DiscoveryQuery;
    expandedTerms?: string[];
  }> {
    const rawQ = query.query ? query.query.trim() : '';
    let expandedTerms: string[] = [];

    if (rawQ) {
      expandedTerms = expandSearchTerms(rawQ);
    }

    const searchParams: DiscoveryQuery = {
      ...query,
      query: rawQ,
      maxDistanceKm: query.maxDistanceKm || 10,
      sortBy: query.sortBy || 'RECOMMENDED',
      availableOnly: query.availableOnly ?? true,
      limit: query.limit || 20,
      offset: query.offset || 0,
    };

    const results = await DiscoveryRepository.searchDishes(searchParams);

    // Record privacy-coarsened search event if search query was provided
    if (rawQ) {
      try {
        SupplyGapService.recordSearch({
          query: rawQ,
          sessionId: 'session_active',
          rawLatitude: query.latitude,
          rawLongitude: query.longitude,
          cuisineCategory: query.cuisineTypes?.[0],
          resultsCount: results.length,
        });
      } catch (err) {
        // Telemetry failure should never break user search
        console.warn('[DiscoveryService] Telemetry recording error:', err);
      }
    }

    return {
      results,
      totalCount: results.length,
      query: searchParams,
      expandedTerms,
    };
  }

  /**
   * Returns popular dishes near the customer's current coordinates or neighborhood.
   */
  public static async getPopularDishes(location?: {
    latitude?: number;
    longitude?: number;
    neighborhood?: string;
  }): Promise<DishDiscoveryResult[]> {
    const res = await DiscoveryRepository.searchDishes({
      latitude: location?.latitude,
      longitude: location?.longitude,
      neighborhood: location?.neighborhood || undefined,
      sortBy: 'RECOMMENDED',
      availableOnly: true,
      limit: 6,
    });
    return res;
  }

  /**
   * Returns recommended dishes for the customer.
   */
  public static async getRecommendedDishes(location?: {
    latitude?: number;
    longitude?: number;
    neighborhood?: string;
  }): Promise<DishDiscoveryResult[]> {
    const res = await DiscoveryRepository.searchDishes({
      latitude: location?.latitude,
      longitude: location?.longitude,
      neighborhood: location?.neighborhood || undefined,
      sortBy: 'HIGHEST_RATED',
      availableOnly: true,
      limit: 6,
    });
    return res;
  }

  /**
   * Returns lightweight autocomplete suggestions based on user input.
   */
  public static getAutocompleteSuggestions(input: string): SearchAutocompleteSuggestion[] {
    const q = (input || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      return POPULAR_SEARCH_KEYWORDS.slice(0, 5).map((text) => ({
        text,
        type: 'popular',
        subtext: 'Popular in Dar es Salaam',
      }));
    }

    const suggestions: SearchAutocompleteSuggestion[] = [];

    // Check popular searches
    for (const keyword of POPULAR_SEARCH_KEYWORDS) {
      if (keyword.toLowerCase().includes(q)) {
        suggestions.push({
          text: keyword,
          type: 'popular',
          subtext: 'Popular dish',
        });
      }
    }

    // Synonym matches
    const expanded = expandSearchTerms(q);
    for (const term of expanded) {
      if (term.toLowerCase() !== q && !suggestions.some((s) => s.text.toLowerCase() === term.toLowerCase())) {
        suggestions.push({
          text: term.charAt(0).toUpperCase() + term.slice(1),
          type: 'dish',
          subtext: 'Related culinary term',
        });
      }
    }

    return suggestions.slice(0, 6);
  }

  /**
   * Suggests alternative / similar dishes when exact query yields no results.
   */
  public static async getSimilarDishes(dishName: string, budget?: number): Promise<DishDiscoveryResult[]> {
    const lower = dishName.toLowerCase();
    let alternativeQuery = '';

    if (lower.includes('biryani') || lower.includes('biriani')) {
      alternativeQuery = 'Pilau';
    } else if (lower.includes('kuku') || lower.includes('chicken')) {
      alternativeQuery = 'Nyama';
    } else if (lower.includes('choma')) {
      alternativeQuery = 'Mishkaki';
    } else {
      alternativeQuery = '';
    }

    const results = await DiscoveryRepository.searchDishes({
      query: alternativeQuery,
      maxPriceTzs: budget ? budget * 1.25 : undefined,
      availableOnly: true,
      sortBy: 'RECOMMENDED',
      limit: 4,
    });

    return results;
  }
}
