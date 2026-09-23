import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PlatformAnnouncement {
  id: string;
  titleEn: string;
  titleSw?: string;
  bodyEn: string;
  bodySw?: string;
  targetAudience: 'ALL' | 'CUSTOMERS' | 'RESTAURANTS' | 'ADMINS';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  startsAt: string;
  expiresAt?: string;
  sentAt?: string;
  isActive: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  readCount?: number;
  dismissedCount?: number;
  acknowledgedCount?: number;
  calculatedStatus?: 'SCHEDULED' | 'LIVE' | 'EXPIRED' | 'DISABLED';
}

export class PlatformAnnouncementsRepository {
  public static async listAllForAdmin(): Promise<PlatformAnnouncement[]> {
    return this.listAdminHistory();
  }

  public static async publishAnnouncement(input: {
    titleEn: string;
    titleSw?: string;
    bodyEn: string;
    bodySw?: string;
    targetAudience: 'ALL' | 'CUSTOMERS' | 'RESTAURANTS' | 'ADMINS';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    startsAt?: string;
    expiresAt?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }): Promise<{ success: boolean; announcementId?: string; error?: string }> {
    return this.publish(input);
  }

  public static async deactivateAnnouncement(
    announcementId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.deactivate(announcementId, reason);
  }

  /**
   * List active announcements visible to a specific audience, excluding dismissed ones.
   */
  public static async listActiveForAudience(
    audience: 'CUSTOMERS' | 'RESTAURANTS'
  ): Promise<PlatformAnnouncement[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      const now = new Date().toISOString();
      const { data: userSession } = await supabase.auth.getSession();
      const currentUserId = userSession?.session?.user?.id;

      // 1. Fetch live announcements for target audience + ALL
      const { data: announcements, error } = await supabase
        .from('platform_announcements')
        .select('*')
        .eq('is_active', true)
        .not('sent_at', 'is', null)
        .lte('starts_at', now)
        .in('target_audience', ['ALL', audience])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error || !announcements) return [];

      // Filter out expired items
      const nonExpired = announcements.filter((a: any) => {
        if (!a.expires_at) return true;
        return new Date(a.expires_at) > new Date();
      });

      if (!currentUserId || nonExpired.length === 0) {
        return nonExpired.map(this.mapRowToModel);
      }

      // 2. Fetch receipts to filter out dismissed announcements
      const announcementIds = nonExpired.map((a: any) => a.id);
      const { data: receipts } = await supabase
        .from('platform_announcement_receipts')
        .select('announcement_id, dismissed_at')
        .eq('user_id', currentUserId)
        .in('announcement_id', announcementIds);

      const dismissedSet = new Set(
        (receipts || [])
          .filter((r: any) => r.dismissed_at != null)
          .map((r: any) => r.announcement_id)
      );

      return nonExpired
        .filter((a: any) => !dismissedSet.has(a.id))
        .map(this.mapRowToModel);
    } catch (e) {
      console.error('PlatformAnnouncementsRepository.listActiveForAudience error:', e);
      return [];
    }
  }

  /**
   * Mark an announcement dismissed by the current user.
   */
  public static async dismiss(announcementId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    try {
      await supabase.from('platform_announcement_receipts').upsert({
        announcement_id: announcementId,
        user_id: userId,
        dismissed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to record announcement dismiss receipt:', e);
    }
  }

  /**
   * Mark an announcement read by the current user.
   */
  public static async markRead(announcementId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    try {
      await supabase.from('platform_announcement_receipts').upsert({
        announcement_id: announcementId,
        user_id: userId,
        read_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to record announcement read receipt:', e);
    }
  }

  /**
   * Publish an announcement securely via authoritative server RPC.
   */
  public static async publish(input: {
    titleEn: string;
    titleSw?: string;
    bodyEn: string;
    bodySw?: string;
    targetAudience: 'ALL' | 'CUSTOMERS' | 'RESTAURANTS' | 'ADMINS';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    startsAt?: string;
    expiresAt?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }): Promise<{ success: boolean; announcementId?: string; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('publish_platform_announcement_secure', {
      p_title_en: input.titleEn,
      p_title_sw: input.titleSw || null,
      p_body_en: input.bodyEn,
      p_body_sw: input.bodySw || null,
      p_target_audience: input.targetAudience,
      p_priority: input.priority || 'NORMAL',
      p_starts_at: input.startsAt || new Date().toISOString(),
      p_expires_at: input.expiresAt || null,
      p_cta_label: input.ctaLabel || null,
      p_cta_url: input.ctaUrl || null,
    });

    if (error) {
      console.error('PlatformAnnouncementsRepository.publish error:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success ?? true,
      announcementId: data?.announcement_id,
    };
  }

  /**
   * Deactivate an announcement securely via server RPC.
   */
  public static async deactivate(announcementId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('deactivate_platform_announcement_secure', {
      p_announcement_id: announcementId,
      p_reason: reason || 'Administrative deactivation',
    });

    if (error) {
      console.error('PlatformAnnouncementsRepository.deactivate error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  }

  /**
   * Retrieve authoritative announcement history with truthful telemetry from server.
   */
  public static async listAdminHistory(): Promise<PlatformAnnouncement[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase.rpc('get_admin_announcements_history');
    if (error) {
      console.error('PlatformAnnouncementsRepository.listAdminHistory error:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      titleEn: row.title_en,
      titleSw: row.title_sw,
      bodyEn: row.body_en,
      bodySw: row.body_sw,
      targetAudience: row.target_audience,
      priority: row.priority,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      sentAt: row.sent_at,
      isActive: row.is_active,
      ctaLabel: row.cta_label,
      ctaUrl: row.cta_url,
      createdBy: row.created_by,
      createdByName: row.created_by_name || 'Admin',
      createdAt: row.created_at,
      readCount: Number(row.read_count || 0),
      dismissedCount: Number(row.dismissed_count || 0),
      acknowledgedCount: Number(row.dismissed_count || 0),
      calculatedStatus: row.calculated_status,
    }));
  }

  private static mapRowToModel(row: any): PlatformAnnouncement {
    return {
      id: row.id,
      titleEn: row.title_en,
      titleSw: row.title_sw,
      bodyEn: row.body_en,
      bodySw: row.body_sw,
      targetAudience: row.target_audience,
      priority: row.priority || 'NORMAL',
      startsAt: row.starts_at || row.created_at,
      expiresAt: row.expires_at,
      sentAt: row.sent_at,
      isActive: row.is_active ?? true,
      ctaLabel: row.cta_label,
      ctaUrl: row.cta_url,
      createdBy: row.created_by,
      createdAt: row.created_at || new Date().toISOString(),
    };
  }
}
