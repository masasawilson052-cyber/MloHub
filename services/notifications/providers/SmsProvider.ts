import { SmsFactory } from '../../sms/SmsFactory';
import { CommunicationSuppressionsRepository } from '../../../repositories/communicationSuppressions.repository';

export interface SmsDeliveryResult {
  success: boolean;
  provider: 'NEXTSMS' | 'BEEM_AFRICA' | 'SANDBOX';
  providerMessageId?: string;
  statusCode?: number;
  error?: string;
  isSuppressed?: boolean;
}

export class SmsNotificationProvider {
  public static async sendSms(params: {
    phone: string;
    message: string;
    templateId?: string;
  }): Promise<SmsDeliveryResult> {
    const { phone, message, templateId } = params;

    // 1. Check suppression list
    const suppressed = await CommunicationSuppressionsRepository.isSuppressed('SMS', phone);
    if (suppressed) {
      return {
        success: false,
        provider: 'SANDBOX',
        error: 'PHONE_NUMBER_SUPPRESSED',
        isSuppressed: true,
      };
    }

    // 2. Resolve SMS gateway
    const gateway = SmsFactory.getGateway();

    try {
      const result = await gateway.sendNotification(phone, message, templateId);
      return {
        success: result.success,
        provider: result.provider,
        providerMessageId: result.messageId,
        statusCode: result.statusCode,
        error: result.error,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: gateway.name,
        error: err.message,
        statusCode: 500,
      };
    }
  }
}
