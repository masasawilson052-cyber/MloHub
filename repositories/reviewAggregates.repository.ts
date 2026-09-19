import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  RestaurantRatingAggregate,
  BranchRatingAggregate,
  DishRatingAggregate,
} from '../types/domain';

export class ReviewAggregatesRepository {
  /**
   * Get authoritative rating summary for a restaurant.
   */
  public static async getRestaurantSummary(restaurantId: string): Promise<RestaurantRatingAggregate | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('restaurant_rating_aggregates')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      console.error('ReviewAggregatesRepository.getRestaurantSummary error:', error.message);
      throw new Error(`Failed to load restaurant rating aggregate: ${error.message}`);
    }

    if (!data) return null;

    return {
      restaurantId: data.restaurant_id,
      verifiedReviewCount: data.verified_review_count,
      averageRating: Number(data.average_rating),
      recent90dAverage: Number(data.recent_90d_average),
      rating1Count: data.rating_1_count,
      rating2Count: data.rating_2_count,
      rating3Count: data.rating_3_count,
      rating4Count: data.rating_4_count,
      rating5Count: data.rating_5_count,
      bayesianRating: Number(data.bayesian_rating),
      lastReviewAt: data.last_review_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Get authoritative rating summary for a branch.
   */
  public static async getBranchSummary(branchId: string): Promise<BranchRatingAggregate | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('branch_rating_aggregates')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) {
      console.error('ReviewAggregatesRepository.getBranchSummary error:', error.message);
      throw new Error(`Failed to load branch rating aggregate: ${error.message}`);
    }

    if (!data) return null;

    return {
      branchId: data.branch_id,
      restaurantId: data.restaurant_id,
      verifiedReviewCount: data.verified_review_count,
      averageRating: Number(data.average_rating),
      recent90dAverage: Number(data.recent_90d_average),
      rating1Count: data.rating_1_count,
      rating2Count: data.rating_2_count,
      rating3Count: data.rating_3_count,
      rating4Count: data.rating_4_count,
      rating5Count: data.rating_5_count,
      bayesianRating: Number(data.bayesian_rating),
      lastReviewAt: data.last_review_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Get authoritative rating summary for a dish / menu item.
   */
  public static async getDishSummary(menuItemId: string): Promise<DishRatingAggregate | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('dish_rating_aggregates')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .maybeSingle();

    if (error) {
      console.error('ReviewAggregatesRepository.getDishSummary error:', error.message);
      throw new Error(`Failed to load dish rating aggregate: ${error.message}`);
    }

    if (!data) return null;

    return {
      menuItemId: data.menu_item_id,
      restaurantId: data.restaurant_id,
      branchId: data.branch_id,
      verifiedRatingCount: data.verified_rating_count,
      averageRating: Number(data.average_rating),
      recent90dAverage: Number(data.recent_90d_average),
      rating1Count: data.rating_1_count,
      rating2Count: data.rating_2_count,
      rating3Count: data.rating_3_count,
      rating4Count: data.rating_4_count,
      rating5Count: data.rating_5_count,
      bayesianRating: Number(data.bayesian_rating),
      lastRatingAt: data.last_rating_at,
      updatedAt: data.updated_at,
    };
  }
}
