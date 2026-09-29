import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AdminActionInboxItem } from '../types/admin';

export { AdminActionInboxItem };

export class AdminActionInboxRepository {
  static async list(limit = 50): Promise<AdminActionInboxItem[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Administrator action inbox unavailable');
    }

    const { data, error } = await supabase.rpc('get_admin_action_inbox', {
      p_limit: limit,
    });

    if (error) {
      console.error('[AdminActionInboxRepository.list] RPC error:', error.message);
      throw new Error(`Unable to load administrator action inbox: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      kind: row.kind,
      severity: row.severity,
      title: row.title,
      detail: row.detail,
      targetTab: row.target_tab,
      entityId: row.entity_id,
      createdAt: row.created_at,
    }));
  }
}
