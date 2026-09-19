import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLog } from '../types/domain';

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
}
