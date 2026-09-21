/**
 * ============================================================================
 * MLOHUB DEMO & TEST DISCOVERY ADAPTER
 * Strictly isolated for test suites and explicit demo mode.
 * Production food discovery queries Supabase RPC 'search_food_discovery' only.
 * ============================================================================
 */

import { DiscoveryQuery, DishDiscoveryResult } from '../../types/discovery';
import { calculateFreshnessScore } from '../../utils/formatters';
import {
  computeCompositeScore,
  calculateRelevanceScore,
  calculateDistanceScore,
  calculatePriceScore,
  calculateRatingScore,
  calculateFreshnessFromTier,
  calculateAvailabilityScore,
} from '../../config/discoveryRanking';
import { DEMO_RESTAURANTS } from '../../demo/fixtures/restaurants';
import { MloHubDB } from '../../db';

export class DemoDiscoveryAdapter {
  /**
   * Deterministic local fallback providing identical business logic for tests and offline usage.
   */
  public static searchDishes(query: DiscoveryQuery): DishDiscoveryResult[] {
    const db = MloHubDB.getSnapshot();
    const restaurantsSource =
      db.restaurants && db.restaurants.length > 0 ? db.restaurants : (DEMO_RESTAURANTS as any[]);
    const q = (query.query || '').trim().toLowerCase();

    const allDishes: DishDiscoveryResult[] = [];

    // Reference location (Default: Mikocheni B coordinates)
    const refLat = query.latitude || -6.7645;
    const refLng = query.longitude || 39.2450;

    for (const rest of restaurantsSource) {
      if (rest.is_active === false || rest.verificationStatus === 'SUSPENDED') continue;

      const restLat = rest.lat || -6.7645;
      const restLng = rest.lng || 39.2450;

      // Haversine calculation
      const dLat = ((restLat - refLat) * Math.PI) / 180;
      const dLng = ((restLng - refLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((refLat * Math.PI) / 180) *
          Math.cos((restLat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const calcDistance = Math.round(6371 * c * 10) / 10;

      const menuList = rest.menu || [];

      for (const item of menuList) {
        const dishNameEn = item.name || item.nameEn || 'Special Dish';
        const dishNameSw = item.nameSw || dishNameEn;
        const descEn = item.desc || item.description || '';
        const price =
          item.priceNum ||
          item.priceTzs ||
          parseInt(String(item.price || '0').replace(/[^0-9]/g, '')) ||
          10000;
        const isAvailable = item.isAvailable ?? true;

        // Freshness verification timestamps
        let verifiedDate = rest.last_menu_verified_at || item.last_price_verified_at;
        if (!verifiedDate) {
          if (item.id === 'mab-1' || item.id === 'mab-2') {
            verifiedDate = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
          } else if (item.id.includes('bh-') || item.id.includes('km-1')) {
            verifiedDate = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
          } else {
            verifiedDate = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
          }
        }

        const freshness = calculateFreshnessScore(verifiedDate);

        const relevance = calculateRelevanceScore({
          query: q,
          dishName: dishNameEn,
          dishNameSw,
          description: descEn,
          restaurantName: rest.name,
          cuisineType: rest.cuisine,
        });

        const distScore = calculateDistanceScore(calcDistance, query.maxDistanceKm || 5);
        const priceScore = calculatePriceScore({ priceTzs: price, budgetTzs: query.maxPriceTzs });
        const ratingScore = calculateRatingScore(rest.rating || 4.8, rest.reviews || 40);
        const freshScore = calculateFreshnessFromTier(freshness.tier);
        const availScore = calculateAvailabilityScore({
          isAvailable,
          stockStatus: 'IN_STOCK',
          isOpenNow: rest.isOpen ?? true,
        });

        const composite = computeCompositeScore({
          relevanceScore: relevance,
          distanceScore: distScore,
          priceScore,
          ratingScore,
          freshnessScore: freshScore,
          availabilityScore: availScore,
        });

        allDishes.push({
          menuItemId: item.id,
          dishName: dishNameEn,
          dishNameSw,
          description: descEn,
          imageUrl: item.photoUrl || (rest as any).foodSpotPhotos?.[0] || '',
          restaurantId: rest.id,
          restaurantName: rest.name,
          restaurantLogo: (rest as any).logoUrl,
          cuisineType: rest.cuisine,
          branchId: `branch-${rest.id}-main`,
          branchName: `${rest.name} - ${rest.neighborhood || 'Main Branch'}`,
          neighborhood: rest.neighborhood || 'Mikocheni',
          address: rest.address,
          priceTzs: price,
          basePriceTzs: price,
          currency: 'TZS',
          distanceKm: calcDistance,
          restaurantRating: rest.rating || 4.8,
          reviewCount: rest.reviews || 50,
          isAvailable,
          stockStatus: 'IN_STOCK',
          isOpenNow: rest.isOpen ?? true,
          openingHoursSummary: '08:00 AM - 10:00 PM',
          lastMenuVerifiedAt: verifiedDate,
          lastPriceVerifiedAt: verifiedDate,
          freshnessScore: freshness.score,
          freshnessTier: freshness.tier,
          freshnessLabel: freshness.label,
          scores: composite,
        });
      }
    }

    // Apply filters
    let results = allDishes.filter((d) => {
      if (query.availableOnly && !d.isAvailable) return false;
      if (query.minPriceTzs && d.priceTzs < query.minPriceTzs) return false;
      if (query.maxPriceTzs && d.priceTzs > query.maxPriceTzs) return false;
      if (query.minRating && d.restaurantRating < query.minRating) return false;
      if (query.openNow && d.isOpenNow !== true) return false;
      if (query.maxDistanceKm && (d.distanceKm == null || d.distanceKm > query.maxDistanceKm)) return false;

      if (query.neighborhood && query.neighborhood !== 'All') {
        const target = query.neighborhood.toLowerCase();
        const matchesNeighborhood =
          d.neighborhood.toLowerCase().includes(target) ||
          (d.address && d.address.toLowerCase().includes(target));
        if (!matchesNeighborhood) return false;
      }

      if (q) {
        return (d.scores?.relevanceScore || 0) >= 30;
      }

      return true;
    });

    // Apply sorting
    const sortBy = query.sortBy || 'RECOMMENDED';
    results.sort((a, b) => {
      if (sortBy === 'NEAREST') return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
      if (sortBy === 'CHEAPEST') return a.priceTzs - b.priceTzs;
      if (sortBy === 'HIGHEST_RATED') return b.restaurantRating - a.restaurantRating;
      if (sortBy === 'FRESHEST') return b.freshnessScore - a.freshnessScore;
      if (sortBy === 'MOST_POPULAR') return b.reviewCount - a.reviewCount;
      return (b.scores?.overallScore || 0) - (a.scores?.overallScore || 0);
    });

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    return results.slice(offset, offset + limit);
  }
}
