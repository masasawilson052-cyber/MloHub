import { SmsGateway, SmsSendResult, SmsGatewayHealth } from './SmsGateway';
import { normalizeTanzanianPhone } from '../../utils/phoneNormalization';

export interface SandboxSentRecord {
  phone: string;
  carrierDigits: string;
  carrier: string;
  text: string;
  timestamp: string;
  messageId: string;
  purpose?: string;
}

export class SandboxSmsGateway implements SmsGateway {
  public readonly name = 'SANDBOX';
  private sentHistory: SandboxSentRecord[] = [];

  public async checkHealth(): Promise<SmsGatewayHealth> {
    return {
      provider: 'SANDBOX',
      isConfigured: true,
      mode: 'SANDBOX',
      senderId: 'MLOHUB-DEV',
      details: 'Deterministic Sandbox SMS gateway active. Ideal for unit tests, CI/CD, and local offline development.',
    };
  }

  public async sendOtp(
    phone: string,
    otp: string,
    purpose: string = 'Verification',
    language: 'en' | 'sw' = 'sw'
  ): Promise<SmsSendResult> {
    const norm = normalizeTanzanianPhone(phone);
    if (!norm.valid) {
      return {
        success: false,
        provider: 'SANDBOX',
        error: norm.error || 'Invalid phone number',
        deliveryStatus: 'FAILED',
      };
    }

    const messageId = `msg_sandbox_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const text =
      language === 'sw'
        ? `Habari! Namba yako ya uthibitisho ya MloHub (${purpose}) ni [ ${otp} ]. Inatumika kwa dakika 5 tu.`
        : `Hello! Your MloHub verification code (${purpose}) is [ ${otp} ]. Valid for 5 minutes.`;

    const record: SandboxSentRecord = {
      phone: norm.e164,
      carrierDigits: norm.carrierApiDigits,
      carrier: norm.carrier,
      text,
      timestamp: new Date().toISOString(),
      messageId,
      purpose,
    };

    this.sentHistory.push(record);

    if (process.env.NODE_ENV !== 'production') {
      // In development/test, log masked delivery
      console.log(`[SANDBOX SMS GATEWAY] [${record.timestamp}] Dispatched to ${norm.masked} (${norm.carrier}) | ID: ${messageId}`);
    }

    return {
      success: true,
      provider: 'SANDBOX',
      messageId,
      deliveryStatus: 'SENT',
    };
  }

  public async sendNotification(phone: string, message: string): Promise<SmsSendResult> {
    const norm = normalizeTanzanianPhone(phone);
    if (!norm.valid) {
      return {
        success: false,
        provider: 'SANDBOX',
        error: norm.error || 'Invalid phone format',
        deliveryStatus: 'FAILED',
      };
    }

    const messageId = `notif_sandbox_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const record: SandboxSentRecord = {
      phone: norm.e164,
      carrierDigits: norm.carrierApiDigits,
      carrier: norm.carrier,
      text: message,
      timestamp: new Date().toISOString(),
      messageId,
    };

    this.sentHistory.push(record);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SANDBOX SMS NOTIFICATION] Dispatched to ${norm.masked} (${norm.carrier}) | ID: ${messageId}`);
    }

    return {
      success: true,
      provider: 'SANDBOX',
      messageId,
      deliveryStatus: 'SENT',
    };
  }

  public getSentHistory(): SandboxSentRecord[] {
    return [...this.sentHistory];
  }

  public clearHistory(): void {
    this.sentHistory = [];
  }
}
