import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Review,
  ReviewEligibilityResult,
  ReviewSortMode,
  ReviewAspectRating,
  ReviewItemRating,
  ReviewTagCode,
  ReviewSourceType,
} from '../types/domain';

export interface SubmitReviewInput {
  sourceType: ReviewSourceType;
  sourceId: string;
  overallRating: number;
  title?: string;
  comment?: string;
  aspectRatings?: Array<{ aspect_type: string; rating_value: number }>;
  itemRatings?: Array<{ order_item_id: string; menu_item_id: string; rating: number }>;
  tags?: ReviewTagCode[];
}

export interface EditReviewInput {
  reviewId: string;
  overallRating: number;
  title?: string;
  comment?: string;
  aspectRatings?: Array<{ aspect_type: string; rating_value: number }>;
  tags?: ReviewTagCode[];
}

export class ReviewRepository {
  public static mapRowToReview(row: any): Review {
    return {
      id: row.id,
      customerId: row.user_id,
      restaurantId: row.restaurant_id,
      branchId: row.branch_id,
      sourceType: row.source_type,
      orderId: row.order_id,
      customMealRequestId: row.custom_meal_request_id,
      reservationId: row.reservation_id,
      verifiedExperience: row.verified_experience,
      overallRating: row.rating ?? 5,
      title: row.title,
      comment: row.comment,
      languageCode: row.language_code,
      visibilityStatus: row.visibility_status ?? 'PUBLISHED',
      moderationStatus: row.moderation_status ?? 'NOT_REVIEWED',
      helpfulCount: row.helpful_count ?? 0,
      notHelpfulCount: row.not_helpful_count ?? 0,
      submittedAt: row.submitted_at || row.created_at,
      publishedAt: row.published_at,
      editedAt: row.edited_at,
      deletedAt: row.deleted_at,
      status: row.visibility_status ?? 'PUBLISHED',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at,
    };
  }

  /**
   * Authoritative check if customer is eligible to review an order or reservation.
   */
  public static async getEligibility(
    sourceType: ReviewSourceType,
    sourceId: string
  ): Promise<ReviewEligibilityResult> {
    if (!isSupabaseConfigured()) {
      return { eligible: false, reason: 'Supabase client is not configured.' };
    }

    const { data, error } = await supabase.rpc('get_review_eligibility', {
      p_source_type: sourceType,
      p_source_id: sourceId,
    });

    if (error) {
      console.error('ReviewRepository.getEligibility error:', error.message);
      throw new Error(`Failed to check review eligibility: ${error.message}`);
    }

    return {
      eligible: Boolean(data?.eligible),
      reason: data?.reason,
      sourceType: data?.source_type,
      orderId: data?.order_id,
      reservationId: data?.reservation_id,
      restaurantId: data?.restaurant_id,
      restaurantName: data?.restaurant_name,
      branchId: data?.branch_id,
      items: data?.items || [],
      allowedAspects: data?.allowed_aspects || [],
      existingReviewId: data?.existing_review_id,
    };
  }

  /**
   * Submit verified review via authoritative server RPC.
   */
  public static async submitVerifiedReview(input: SubmitReviewInput): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('submit_verified_review_secure', {
      p_source_type: input.sourceType,
      p_source_id: input.sourceId,
      p_overall_rating: input.overallRating,
      p_title: input.title || null,
      p_comment: input.comment || null,
      p_aspect_ratings: input.aspectRatings || [],
      p_item_ratings: input.itemRatings || [],
      p_tags: input.tags || [],
    });

    if (error) {
      console.error('ReviewRepository.submitVerifiedReview error:', error.message);
      throw new Error(`Failed to submit verified review: ${error.message}`);
    }

    return data;
  }

  /**
   * Edit existing review via authoritative server RPC with version history.
   */
  public static async editReview(input: EditReviewInput): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('edit_review_secure', {
      p_review_id: input.reviewId,
      p_overall_rating: input.overallRating,
      p_title: input.title || null,
      p_comment: input.comment || null,
      p_aspect_ratings: input.aspectRatings || null,
      p_tags: input.tags || null,
    });

    if (error) {
      console.error('ReviewRepository.editReview error:', error.message);
      throw new Error(`Failed to edit review: ${error.message}`);
    }

    return data;
  }

  /**
   * Soft-delete review by author.
   */
  public static async deleteReview(reviewId: string): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('delete_review_secure', {
      p_review_id: reviewId,
    });

    if (error) {
      console.error('ReviewRepository.deleteReview error:', error.message);
      throw new Error(`Failed to delete review: ${error.message}`);
    }

    return data;
  }

  /**
   * List reviews for restaurant with optional sorting.
   */
  public static async listForRestaurant(
    restaurantId: string,
    options: {
      sortBy?: ReviewSortMode;
      branchId?: string;
      rating?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Review[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('reviews')
      .select(`
        *,
        aspects:review_aspect_ratings(*),
        item_ratings:review_item_ratings(*),
        tags:review_tags(*),
        response:review_responses(*),
        media:review_media(*)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('visibility_status', 'PUBLISHED');

    if (options.branchId) {
      query = query.eq('branch_id', options.branchId);
    }
    if (options.rating) {
      query = query.eq('rating', options.rating);
    }

    switch (options.sortBy) {
      case 'HIGHEST':
        query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
        break;
      case 'LOWEST':
        query = query.order('rating', { ascending: true }).order('created_at', { ascending: false });
        break;
      case 'MOST_HELPFUL':
        query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false });
        break;
      case 'NEWEST':
      case 'MOST_RELEVANT':
      default:
        query = query.order('submitted_at', { ascending: false });
        break;
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`ReviewRepository.listForRestaurant error:`, error.message);
      throw new Error(`Failed to load reviews: ${error.message}`);
    }

    return (data || []).map((row) => {
      const review = this.mapRowToReview(row);
      if (row.aspects) review.aspects = row.aspects;
      if (row.item_ratings) review.itemRatings = row.item_ratings;
      if (row.tags) review.tags = row.tags.map((t: any) => t.tag_code);
      if (row.response && row.response[0]) review.response = row.response[0];
      if (row.media) review.media = row.media;
      return review;
    });
  }

  /**
   * List reviews for a specific menu item / dish.
   */
  public static async listForDish(menuItemId: string, limit: number = 20): Promise<ReviewItemRating[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('review_item_ratings')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('ReviewRepository.listForDish error:', error.message);
      throw new Error(`Failed to load dish reviews: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      orderId: row.order_id,
      orderItemId: row.order_item_id,
      menuItemId: row.menu_item_id,
      restaurantId: row.restaurant_id,
      branchId: row.branch_id,
      rating: row.rating,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get single review with full details.
   */
  public static async getById(reviewId: string): Promise<Review | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        aspects:review_aspect_ratings(*),
        item_ratings:review_item_ratings(*),
        tags:review_tags(*),
        response:review_responses(*),
        media:review_media(*)
      `)
      .eq('id', reviewId)
      .maybeSingle();

    if (error) {
      console.error('ReviewRepository.getById error:', error.message);
      throw new Error(`Failed to load review: ${error.message}`);
    }

    if (!data) return null;

    const review = this.mapRowToReview(data);
    if (data.aspects) review.aspects = data.aspects;
    if (data.item_ratings) review.itemRatings = data.item_ratings;
    if (data.tags) review.tags = data.tags.map((t: any) => t.tag_code);
    if (data.response && data.response[0]) review.response = data.response[0];
    if (data.media) review.media = data.media;
    return review;
  }

  /**
   * Backwards compatible create method (routes through canonical table).
   */
  public static async create(review: Partial<Review>): Promise<Review> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      id: review.id || `rev_${Date.now()}`,
      user_id: review.customerId,
      restaurant_id: review.restaurantId,
      order_id: review.orderId,
      rating: review.overallRating || 5,
      comment: review.comment,
    };

    const { data, error } = await supabase
      .from('reviews')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('ReviewRepository.create error:', error.message);
      throw new Error(`Failed to submit review: ${error.message}`);
    }

    return this.mapRowToReview(data);
  }
}
