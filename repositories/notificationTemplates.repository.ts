import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { NotificationTemplate, NotificationChannel } from '../types/domain';

export class NotificationTemplatesRepository {
  private static mapRowToTemplate(row: any): NotificationTemplate {
    return {
      id: row.id,
      eventType: row.event_type,
      channel: row.channel,
      locale: row.locale,
      titleTemplate: row.title_template,
      bodyTemplate: row.body_template,
      allowlistedKeys: row.allowlisted_keys || [],
      isActive: row.is_active,
      version: row.version,
      createdAt: row.created_at,
    };
  }

  public static async getTemplate(
    eventType: string,
    channel: NotificationChannel,
    locale: 'en' | 'sw' = 'sw'
  ): Promise<NotificationTemplate | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('event_type', eventType)
      .eq('channel', channel)
      .eq('locale', locale)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`NotificationTemplatesRepository.getTemplate error:`, error.message);
      return null;
    }

    return data ? this.mapRowToTemplate(data) : null;
  }

  /**
   * Safely render title & body templates replacing allowed placeholders with sanitized values.
   * Strips HTML tags and raw code injection from values.
   */
  public static render(
    template: NotificationTemplate,
    variables: Record<string, any>
  ): { title: string; body: string } {
    let renderedTitle = template.titleTemplate;
    let renderedBody = template.bodyTemplate;

    const sanitize = (val: any): string => {
      if (val === null || val === undefined) return '';
      return String(val)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const allowedSet = new Set(template.allowlistedKeys);

    for (const [key, value] of Object.entries(variables)) {
      if (allowedSet.has(key)) {
        const safeValue = sanitize(value);
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        renderedTitle = renderedTitle.replace(regex, safeValue);
        renderedBody = renderedBody.replace(regex, safeValue);
      }
    }

    return {
      title: renderedTitle,
      body: renderedBody,
    };
  }
}
