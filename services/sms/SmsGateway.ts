/**
 * MloHub SMS Gateway Interface & Types (Stage 8 Production Architecture)
 * Unified contract for carrier-grade SMS delivery in Tanzania.
 */

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  provider: 'NEXTSMS' | 'BEEM_AFRICA' | 'SANDBOX';
  error?: string;
  statusCode?: number;
  costTzs?: number;
  deliveryStatus?: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
}

export interface SmsGatewayHealth {
  provider: 'NEXTSMS' | 'BEEM_AFRICA' | 'SANDBOX';
  mode: 'SANDBOX' | 'CONFIGURED_UNTESTED' | 'LIVE_TESTED';
  isConfigured: boolean;
  senderId: string;
  details: string;
}

export interface SmsGateway {
  name: 'NEXTSMS' | 'BEEM_AFRICA' | 'SANDBOX';
  sendOtp(phone: string, otp: string, purpose?: string, language?: 'en' | 'sw'): Promise<SmsSendResult>;
  sendNotification(phone: string, message: string, templateId?: string): Promise<SmsSendResult>;
  checkHealth(): Promise<SmsGatewayHealth>;
}
