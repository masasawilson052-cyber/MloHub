/**
 * ============================================================================
 * MLOHUB DISCOVERY REPOSITORY
 * ============================================================================
 * Dispatches food discovery queries to PostgreSQL RPC search_food_discovery.
 * Real Supabase backend authoritative; zero local fixtures bundled.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DiscoveryQuery, DishDiscoveryResult, FreshnessTier } from '../types/discovery';
import { calculateFreshnessScore } from '../utils/formatters';
import { runtimeConfig } from '../lib/runtimeConfig';

export class DiscoveryRepository {
  /**
   * Maps a raw SQL RPC row from search_food_discovery into a typed DishDiscoveryResult.
   */
  private static mapRpcRowToResult(row: any): DishDiscoveryResult {
    const freshness = calculateFreshnessScore(
      row.last_price_verified_at || row.last_availability_verified_at || row.last_menu_verified_at
    );

    return {
      menuItemId: row.menu_item_id,
      dishName: row.dish_name,
      dishNameSw: row.dish_name_sw,
      description: row.description,
      descriptionSw: row.description_sw,
      imageUrl: row.image_url,

      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      restaurantLogo: row.restaurant_logo,
      cuisineType: row.cuisine_type,
      branchId: row.branch_id,
      branchName: row.branch_name || row.restaurant_name,
      neighborhood: row.neighborhood || '',
      address: row.address,

      priceTzs: Number(row.price_tzs) || 0,
      basePriceTzs: Number(row.base_price_tzs) || Number(row.price_tzs) || 0,
      currency: 'TZS',
      distanceKm: row.distance_km != null ? Number(row.distance_km) : undefined,

      restaurantRating: Number(row.restaurant_rating) || 0,
      reviewCount: Number(row.review_count) || 0,
      isAvailable: row.is_available === true,
      stockStatus: row.stock_status || 'IN_STOCK',
      isOpenNow: row.is_open_now ?? false,
      openingHoursSummary: row.opening_hours_summary || '',

      lastMenuVerifiedAt: row.last_menu_verified_at,
      lastPriceVerifiedAt: row.last_price_verified_at,
      lastAvailabilityVerifiedAt: row.last_availability_verified_at,
      freshnessScore: freshness.score,
      freshnessTier: (row.freshness_tier as FreshnessTier) || freshness.tier,
      freshnessLabel: row.freshness_label || freshness.label,

      scores: {
        relevanceScore: Number(row.relevance_rank) || 0,
        distanceScore: row.distance_km != null ? Math.max(10, Math.round(100 - (Number(row.distance_km) / 5.0) * 45)) : 50,
        priceScore: 80,
        ratingScore: Number(row.restaurant_rating) > 0 ? Math.round((Number(row.restaurant_rating) / 5) * 100) : 50,
        freshnessScore: freshness.score,
        availabilityScore: row.is_available === true ? 100 : 0,
        overallScore: Number(row.relevance_rank) || 0,
      },
    };
  }

  /**
   * Executes food discovery search.
   */
  public static async searchDishes(query: DiscoveryQuery): Promise<DishDiscoveryResult[]> {
    // 1. Live Supabase PostgreSQL RPC Execution
    if (isSupabaseConfigured()) {
      try {
        const payload = {
          p_query: query.query || null,
          p_lat: query.latitude || null,
          p_lng: query.longitude || null,
          p_neighborhood: query.neighborhood || null,
          p_max_distance_km: query.maxDistanceKm || 10.0,
          p_min_price: query.minPriceTzs || null,
          p_max_price: query.maxPriceTzs || null,
          p_min_rating: query.minRating || null,
          p_open_now: query.openNow || null,
          p_available_only: query.availableOnly ?? true,
          p_cuisine_types: query.cuisineTypes && query.cuisineTypes.length > 0 ? query.cuisineTypes : null,
          p_dietary_tags: query.dietaryTags && query.dietaryTags.length > 0 ? query.dietaryTags : null,
          p_sort: query.sortBy || 'RECOMMENDED',
          p_limit: query.limit || 20,
          p_offset: query.offset || 0,
        };

        const { data, error } = await supabase.rpc('search_food_discovery', payload);
        if (!error && Array.isArray(data)) {
          return data.map(this.mapRpcRowToResult);
        }
        if (error) {
          console.warn('DiscoveryRepository: Supabase RPC returned error:', error.message);
          if (!runtimeConfig.allowLocalDataFallbacks) {
            throw error;
          }
        }
      } catch (err) {
        console.warn('DiscoveryRepository: Supabase RPC exception:', err);
        if (!runtimeConfig.allowLocalDataFallbacks) {
          throw err;
        }
      }
    }

    // 2. High-Fidelity Local / Mock Fallback Execution (TEST / DEMO ONLY)
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoDiscoveryAdapter } = require('../services/demo/DemoDiscoveryAdapter');
      return DemoDiscoveryAdapter.searchDishes(query);
    }

    if (runtimeConfig.requiresRealSupabase && !isSupabaseConfigured()) {
      throw new Error(`Supabase is required in ${runtimeConfig.environmentLabel}. Local fallback is forbidden.`);
    }

    return [];
  }

  /**
   * Deterministic local fallback strictly restricted to test and demo environments.
   */
  public static searchDishesLocalFallback(query: DiscoveryQuery): DishDiscoveryResult[] {
    if (!runtimeConfig.allowLocalDataFallbacks) {
      throw new Error(`Local fallback is strictly forbidden in ${runtimeConfig.environmentLabel}.`);
    }
    const { DemoDiscoveryAdapter } = require('../services/demo/DemoDiscoveryAdapter');
    return DemoDiscoveryAdapter.searchDishes(query);
  }
}
