import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  ReviewReport,
  ReviewModerationCase,
  ReviewModerationEvent,
  ReviewIntegrityFlag,
  ReviewReportReason,
  ReviewModerationOutcome,
} from '../types/domain';

export class ReviewModerationRepository {
  /**
   * Vote review as helpful or not helpful. Idempotent per user.
   */
  public static async voteHelpful(reviewId: string, isHelpful: boolean): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('vote_review_helpfulness_secure', {
      p_review_id: reviewId,
      p_is_helpful: isHelpful,
    });

    if (error) {
      console.error('ReviewModerationRepository.voteHelpful error:', error.message);
      throw new Error(`Failed to vote helpfulness: ${error.message}`);
    }

    return data;
  }

  /**
   * Report review for policy violation (creates moderation work item).
   */
  public static async reportReview(
    reviewId: string,
    reasonCode: ReviewReportReason,
    details?: string
  ): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('report_review_secure', {
      p_review_id: reviewId,
      p_reason_code: reasonCode,
      p_details: details || null,
    });

    if (error) {
      console.error('ReviewModerationRepository.reportReview error:', error.message);
      throw new Error(`Failed to report review: ${error.message}`);
    }

    return data;
  }

  /**
   * Moderate review (Platform Admin only).
   */
  public static async moderateReview(
    reviewId: string,
    outcome: ReviewModerationOutcome,
    notes?: string
  ): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('moderate_review_secure', {
      p_review_id: reviewId,
      p_outcome: outcome,
      p_notes: notes || null,
    });

    if (error) {
      console.error('ReviewModerationRepository.moderateReview error:', error.message);
      throw new Error(`Failed to moderate review: ${error.message}`);
    }

    return data;
  }

  /**
   * List open moderation cases for Admin Trust & Safety portal.
   */
  public static async listModerationCases(status: string = 'OPEN'): Promise<ReviewModerationCase[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('review_moderation_cases')
      .select('*')
      .eq('status', status)
      .order('opened_at', { ascending: false });

    if (error) {
      console.error('ReviewModerationRepository.listModerationCases error:', error.message);
      throw new Error(`Failed to list moderation cases: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      status: row.status,
      priority: row.priority,
      openedReason: row.opened_reason,
      openedAt: row.opened_at,
      assignedAdmin: row.assigned_admin,
      resolvedAt: row.resolved_at,
      resolutionCode: row.resolution_code,
      resolutionNotes: row.resolution_notes,
    }));
  }

  /**
   * List reports for a review.
   */
  public static async listReportsForReview(reviewId: string): Promise<ReviewReport[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('review_reports')
      .select('*')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReviewModerationRepository.listReportsForReview error:', error.message);
      throw new Error(`Failed to list review reports: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      reporterUserId: row.reporter_user_id,
      reasonCode: row.reason_code,
      details: row.details,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
    }));
  }

  /**
   * List audit events for a moderation case.
   */
  public static async listCaseEvents(caseId: string): Promise<ReviewModerationEvent[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('review_moderation_events')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('ReviewModerationRepository.listCaseEvents error:', error.message);
      throw new Error(`Failed to load moderation events: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      caseId: row.case_id,
      reviewId: row.review_id,
      actorUserId: row.actor_user_id,
      actorType: row.actor_type,
      action: row.action,
      reasonCode: row.reason_code,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));
  }

  /**
   * List internal integrity flags (Admin only).
   */
  public static async listIntegrityFlags(reviewId: string): Promise<ReviewIntegrityFlag[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('review_integrity_flags')
      .select('*')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReviewModerationRepository.listIntegrityFlags error:', error.message);
      throw new Error(`Failed to list integrity flags: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      signalType: row.signal_type,
      severity: row.severity,
      metadata: row.metadata,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    }));
  }
}
