import { NotificationTemplate, NotificationChannel } from '../../types/domain';
import { NotificationTemplatesRepository } from '../../repositories/notificationTemplates.repository';

export interface RenderedContent {
  title: string;
  body: string;
  templateId?: string;
  templateVersion?: number;
}

export class TemplateRenderer {
  private static sanitize(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  public static renderString(
    templateStr: string,
    variables: Record<string, any>,
    allowlistedKeys?: string[]
  ): string {
    let result = templateStr;
    const allowed = allowlistedKeys ? new Set(allowlistedKeys) : null;

    for (const [key, value] of Object.entries(variables)) {
      if (!allowed || allowed.has(key)) {
        const safeVal = this.sanitize(value);
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        result = result.replace(regex, safeVal);
      }
    }
    return result;
  }

  public static async render(params: {
    eventType: string;
    channel: NotificationChannel;
    locale?: 'en' | 'sw';
    payload: Record<string, any>;
  }): Promise<RenderedContent> {
    const locale = params.locale || 'sw';
    const template = await NotificationTemplatesRepository.getTemplate(
      params.eventType,
      params.channel,
      locale
    );

    if (template) {
      const rendered = NotificationTemplatesRepository.render(template, params.payload);
      return {
        ...rendered,
        templateId: template.id,
        templateVersion: template.version,
      };
    }

    // Default bilingual fallbacks if template not found in DB
    return this.getFallback(params.eventType, params.channel, locale, params.payload);
  }

  private static getFallback(
    eventType: string,
    channel: NotificationChannel,
    locale: 'en' | 'sw',
    payload: Record<string, any>
  ): RenderedContent {
    const orderNum = payload.order_number || payload.orderNumber || payload.order_id || '';
    const partySize = payload.party_size || payload.partySize || '1';
    const dishName = payload.dish_name || payload.dishName || 'mlo';

    if (eventType.startsWith('ORDER_')) {
      if (locale === 'sw') {
        return {
          title: `Taarifa ya Oda: #${orderNum}`,
          body: `Hali ya oda yako #${orderNum} imesasishwa kwenye mfumo.`,
          templateVersion: 1,
        };
      }
      return {
        title: `Order Update: #${orderNum}`,
        body: `Your order #${orderNum} status has been updated.`,
        templateVersion: 1,
      };
    }

    if (eventType.startsWith('RESERVATION_')) {
      if (locale === 'sw') {
        return {
          title: 'Taarifa ya Meza',
          body: `Taarifa kuhusu nafasi yako ya meza kwa watu ${partySize}.`,
          templateVersion: 1,
        };
      }
      return {
        title: 'Table Reservation Update',
        body: `Update regarding your reservation for ${partySize} guests.`,
        templateVersion: 1,
      };
    }

    if (eventType.startsWith('CUSTOM_MEAL_')) {
      if (locale === 'sw') {
        return {
          title: 'Ombi la Mlo Maalum',
          body: `Taarifa mpya kuhusu ombi lako la ${dishName}.`,
          templateVersion: 1,
        };
      }
      return {
        title: 'Custom Meal Request Update',
        body: `Update regarding your custom dish request for ${dishName}.`,
        templateVersion: 1,
      };
    }

    return {
      title: 'Taarifa ya MloHub',
      body: 'Una ujumbe mpya kutoka MloHub.',
      templateVersion: 1,
    };
  }
}
