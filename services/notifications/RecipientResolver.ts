import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { NotificationEventType } from '../../types/domain';

export interface ResolvedRecipient {
  userId: string;
  roleContext: string;
  preferredLocale: 'en' | 'sw';
}

export class RecipientResolver {
  public static async resolve(params: {
    eventType: NotificationEventType;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, any>;
  }): Promise<ResolvedRecipient[]> {
    if (!isSupabaseConfigured()) {
      const fallbackUserId = params.payload.user_id || params.payload.userId || 'mock-user-1';
      return [
        {
          userId: fallbackUserId,
          roleContext: 'CUSTOMER',
          preferredLocale: 'sw',
        },
      ];
    }

    try {
      const { data, error } = await supabase.rpc('resolve_event_recipients', {
        p_event_type: params.eventType,
        p_aggregate_type: params.aggregateType,
        p_aggregate_id: params.aggregateId,
        p_payload: params.payload || {},
      });

      if (error) {
        console.error('RecipientResolver.resolve rpc error:', error.message);
        // Fallback to payload user_id if RPC fails
        if (params.payload.user_id || params.payload.userId) {
          return [
            {
              userId: params.payload.user_id || params.payload.userId,
              roleContext: 'CUSTOMER',
              preferredLocale: 'sw',
            },
          ];
        }
        return [];
      }

      return (data || []).map((r: any) => ({
        userId: r.recipient_user_id,
        roleContext: r.role_context,
        preferredLocale: (r.preferred_locale === 'en' ? 'en' : 'sw') as 'en' | 'sw',
      }));
    } catch (err: any) {
      console.error('RecipientResolver.resolve exception:', err.message);
      return [];
    }
  }
}
