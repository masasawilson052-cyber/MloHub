import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLog } from '../types/domain';
import { AdminPage, AdminPageQuery } from '../types/admin';

export class AuditLogRepository {
  private static mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      actorUserId: row.admin_user_id,
      adminName: row.admin_name,
      action: row.action,
      entityType: row.target_type,
      entityId: row.target_id,
      metadata: row.details || {},
      ipAddress: row.ip_address,
      createdAt: row.created_at || new Date().toISOString(),
    };
  }

  /**
   * @deprecated Privileged mutations (financial approvals, suspensions, settings changes)
   * are authoritatively logged by PostgreSQL SECURITY DEFINER RPCs within the same transaction.
   * Client-side logAction should only be used for benign, non-security-critical telemetry.
   */
  public static async logAction(log: {
    actorUserId: string;
    adminName?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
  }): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const row = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      admin_user_id: log.actorUserId,
      admin_name: log.adminName || 'Admin',
      action: log.action,
      target_type: log.entityType,
      target_id: log.entityId,
      details: log.metadata || {},
      ip_address: log.ipAddress,
    };

    const { error } = await supabase.from('audit_logs').insert(row);
    if (error) {
      console.error('AuditLogRepository.logAction error:', error.message);
    }
  }

  public static async listRecent(limit: number = 50): Promise<AuditLog[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('AuditLogRepository.listRecent error:', error.message);
      throw new Error(`Failed to load audit logs: ${error.message}`);
    }

    return (data || []).map(this.mapRowToAuditLog);
  }

  public static async listAll(limit: number = 100): Promise<AuditLog[]> {
    return this.listRecent(limit);
  }

  public static async listAdminPage(query: AdminPageQuery = {}): Promise<AdminPage<AuditLog>> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const pageSize = Math.min(100, Math.max(10, query.pageSize || 50));
    const page = Math.max(1, query.page || 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let qb = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (query.status && query.status !== 'ALL') {
      qb = qb.eq('action', query.status);
    }
    if (query.from) {
      qb = qb.gte('created_at', query.from);
    }
    if (query.to) {
      qb = qb.lte('created_at', query.to);
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      qb = qb.or(`id.ilike.%${term}%,action.ilike.%${term}%,target_type.ilike.%${term}%,target_id.ilike.%${term}%,admin_name.ilike.%${term}%`);
    }

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[AuditLogRepository.listAdminPage] Error:', error.message);
      throw new Error(`Unable to load audit logs: ${error.message}`);
    }

    return {
      items: (data || []).map(this.mapRowToAuditLog),
      page,
      pageSize,
      total: count || 0,
      hasNext: from + (data?.length || 0) < (count || 0),
    };
  }
}

export const AuditLogsRepository = AuditLogRepository;
