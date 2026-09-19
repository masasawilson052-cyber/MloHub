import { CommunicationSuppressionsRepository } from '../../../repositories/communicationSuppressions.repository';

export interface EmailDeliveryResult {
  success: boolean;
  provider: 'SENDGRID' | 'SANDBOX';
  providerMessageId?: string;
  statusCode?: number;
  error?: string;
  isSuppressed?: boolean;
}

export class EmailProvider {
  public static async sendEmail(params: {
    to: string;
    subject: string;
    textBody: string;
    htmlBody?: string;
    from?: string;
  }): Promise<EmailDeliveryResult> {
    const { to, subject, textBody, htmlBody, from = 'noreply@mlohub.co.tz' } = params;

    // 1. Check suppression list
    const suppressed = await CommunicationSuppressionsRepository.isSuppressed('EMAIL', to);
    if (suppressed) {
      return {
        success: false,
        provider: 'SANDBOX',
        error: 'EMAIL_ADDRESS_SUPPRESSED',
        isSuppressed: true,
      };
    }

    const sendgridApiKey = process.env.SENDGRID_API_KEY;

    // 2. Sandbox / Test Mode
    if (process.env.NODE_ENV === 'test' || !sendgridApiKey) {
      return {
        success: true,
        provider: 'SANDBOX',
        providerMessageId: `email_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        statusCode: 202,
      };
    }

    // 3. Live SendGrid API Dispatch
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from, name: 'MloHub Tanzania' },
          subject,
          content: [
            { type: 'text/plain', value: textBody },
            ...(htmlBody ? [{ type: 'text/html', value: htmlBody }] : []),
          ],
        }),
      });

      const statusCode = response.status;
      const messageId = response.headers.get('x-message-id') || undefined;

      if (statusCode >= 200 && statusCode < 300) {
        return {
          success: true,
          provider: 'SENDGRID',
          providerMessageId: messageId,
          statusCode,
        };
      }

      const errText = await response.text();
      return {
        success: false,
        provider: 'SENDGRID',
        error: `SendGrid error (${statusCode}): ${errText}`,
        statusCode,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'SENDGRID',
        error: err.message,
        statusCode: 500,
      };
    }
  }
}
