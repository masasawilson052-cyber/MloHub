import { RestaurantRepository, BranchRepository, MenuRepository } from '../repositories';
import { Restaurant, RestaurantBranch, MenuItem } from '../types/domain';
import { isSupabaseConfigured } from '../lib/supabase';
import { runtimeConfig } from '../lib/runtimeConfig';

export class RestaurantService {
  /**
   * Fetch discoverable restaurants.
   * If online & Supabase configured: loads from PostgreSQL.
   * If mock data explicitly enabled or running offline tests: falls back to test fixtures.
   */
  public static async getRestaurants(options?: {
    cuisine?: string;
    neighborhood?: string;
    search?: string;
    verifiedOnly?: boolean;
    sortBy?: 'rating' | 'distance' | 'price';
  }): Promise<Restaurant[]> {
    if (isSupabaseConfigured()) {
      try {
        let list = await RestaurantRepository.list({
          cuisine: options?.cuisine,
          neighborhood: options?.neighborhood,
          search: options?.search,
          verifiedOnly: options?.verifiedOnly,
        });

        if (options?.sortBy === 'distance') {
          list = list.sort((a, b) => a.distanceKm - b.distanceKm);
        } else if (options?.sortBy === 'price') {
          list = list.sort((a, b) => a.minPriceTzs - b.minPriceTzs);
        } else {
          list = list.sort((a, b) => b.rating - a.rating);
        }

        return list;
      } catch (err) {
        console.warn('RestaurantService: Supabase query failed:', err);
        if (!runtimeConfig.allowLocalDataFallbacks) {
          throw err;
        }
      }
    }

    // Explicit mock mode or offline test fallback strictly gated
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DEMO_RESTAURANTS } = require('../demo/fixtures/restaurants');
      return (DEMO_RESTAURANTS as any[]).map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.id,
        cuisine: r.cuisine,
        description: r.specialty,
        sellerTier: (r.budgetTier === 'premium' ? 'VERIFIED_SELLER' : 'BASIC_SELLER') as any,
        rating: r.rating || 4.8,
        reviewsCount: r.reviews || 50,
        minPriceTzs: r.minPrice || 5000,
        maxPriceTzs: r.maxPrice || 25000,
        address: r.address || 'Dar es Salaam',
        neighborhood: r.neighborhood || 'Mikocheni',
        regionCity: 'Dar es Salaam',
        distanceKm: r.distanceKm || 1.0,
        estimatedPrepTimeMinutes: 25,
        isOpen: r.isOpen ?? true,
        isVerified: true,
        verificationStatus: 'VERIFIED' as any,
        specialty: r.specialty,
        specialistBadge: r.specialistBadge,
        specialistCategory: r.specialistCategory,
        emoji: r.emoji || '🍲',
        tags: r.tags || [],
        lat: r.lat,
        lng: r.lng,
        supportsOrderAhead: r.supportsOrderAhead ?? true,
        menu: r.menu || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }

    if (runtimeConfig.requiresRealSupabase && !isSupabaseConfigured()) {
      throw new Error(`Supabase is required in ${runtimeConfig.environmentLabel}. Local fallback is forbidden.`);
    }

    return [];
  }

  /**
   * Get restaurant details with its full menu and active branches
   */
  public static async getRestaurantDetail(id: string): Promise<{
    restaurant: Restaurant | null;
    menu: MenuItem[];
    branches: RestaurantBranch[];
  }> {
    if (isSupabaseConfigured()) {
      const restaurant = await RestaurantRepository.getById(id);
      if (restaurant) {
        const [menu, branches] = await Promise.all([
          MenuRepository.listItems(id),
          BranchRepository.listByRestaurant(id),
        ]);
        return {
          restaurant: { ...restaurant, menu, branches },
          menu,
          branches,
        };
      }

      // If Supabase returned null and fallbacks are forbidden, return honest null
      if (!runtimeConfig.allowLocalDataFallbacks) {
        return {
          restaurant: null,
          menu: [],
          branches: [],
        };
      }
    }

    // Fallback for mock mode / tests strictly gated
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DEMO_RESTAURANTS } = require('../demo/fixtures/restaurants');
      const mock = (DEMO_RESTAURANTS as any[]).find((r) => r.id === id);
      if (mock) {
        const rest: Restaurant = {
          id: mock.id,
          name: mock.name,
          slug: mock.id,
          cuisine: mock.cuisine,
          description: mock.specialty,
          sellerTier: 'VERIFIED_SELLER',
          rating: mock.rating || 4.9,
          reviewsCount: mock.reviews || 100,
          minPriceTzs: mock.minPrice || 5000,
          maxPriceTzs: mock.maxPrice || 25000,
          address: mock.address || 'Dar es Salaam',
          neighborhood: mock.neighborhood || 'Mikocheni',
          regionCity: 'Dar es Salaam',
          distanceKm: mock.distanceKm || 1.0,
          estimatedPrepTimeMinutes: 25,
          isOpen: mock.isOpen ?? true,
          isVerified: true,
          verificationStatus: 'VERIFIED',
          specialty: mock.specialty,
          specialistBadge: mock.specialistBadge,
          specialistCategory: mock.specialistCategory,
          emoji: mock.emoji || '🍲',
          tags: mock.tags || [],
          lat: mock.lat,
          lng: mock.lng,
          supportsOrderAhead: mock.supportsOrderAhead ?? true,
          menu: mock.menu || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return {
          restaurant: rest,
          menu: (mock.menu || []).map((m: any) => ({
            id: m.id,
            restaurantId: mock.id,
            name: m.name,
            nameEn: m.name,
            nameSw: m.name,
            description: m.desc,
            basePrice: m.priceNum || 5000,
            priceTzs: m.priceNum || 5000,
            currency: 'TZS',
            isAvailable: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          branches: [],
        };
      }
    }

    return { restaurant: null, menu: [], branches: [] };
  }
}
