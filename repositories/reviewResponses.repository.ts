import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ReviewResponse, ReviewResponseVersion } from '../types/domain';

export class ReviewResponsesRepository {
  /**
   * Submit or update merchant public response to a customer review.
   */
  public static async respond(reviewId: string, body: string): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('respond_to_review_secure', {
      p_review_id: reviewId,
      p_body: body,
    });

    if (error) {
      console.error('ReviewResponsesRepository.respond error:', error.message);
      throw new Error(`Failed to submit merchant response: ${error.message}`);
    }

    return data;
  }

  /**
   * Edit existing merchant response (archives previous version).
   */
  public static async editResponse(responseId: string, body: string): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('edit_review_response_secure', {
      p_response_id: responseId,
      p_body: body,
    });

    if (error) {
      console.error('ReviewResponsesRepository.editResponse error:', error.message);
      throw new Error(`Failed to edit merchant response: ${error.message}`);
    }

    return data;
  }

  /**
   * Get response by review ID.
   */
  public static async getByReviewId(reviewId: string): Promise<ReviewResponse | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('review_responses')
      .select('*')
      .eq('review_id', reviewId)
      .maybeSingle();

    if (error) {
      console.error('ReviewResponsesRepository.getByReviewId error:', error.message);
      throw new Error(`Failed to load review response: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      reviewId: data.review_id,
      restaurantId: data.restaurant_id,
      responderUserId: data.responder_user_id,
      body: data.body,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Get edit versions for a response.
   */
  public static async getVersions(responseId: string): Promise<ReviewResponseVersion[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('review_response_versions')
      .select('*')
      .eq('response_id', responseId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('ReviewResponsesRepository.getVersions error:', error.message);
      throw new Error(`Failed to load response versions: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      responseId: row.response_id,
      versionNumber: row.version_number,
      body: row.body,
      editorUserId: row.editor_user_id,
      editedAt: row.edited_at,
    }));
  }
}
