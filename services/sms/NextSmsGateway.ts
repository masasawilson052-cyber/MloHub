import { SmsGateway, SmsSendResult, SmsGatewayHealth } from './SmsGateway';
import { normalizeTanzanianPhone } from '../../utils/phoneNormalization';

declare const Buffer: any;

function encodeBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64');
  }
  if (typeof btoa !== 'undefined') {
    return btoa(str);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let block = 0, charCode, idx = 0, map = chars;
    str.charAt(idx | 0) || (map = '=', idx % 1);
    output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {
    charCode = str.charCodeAt(idx += 3/4);
    if (charCode > 0xFF) {
      throw new Error("'btoa' failed: string contains characters outside Latin1 range.");
    }
    block = block << 8 | charCode;
  }
  return output;
}

export class NextSmsGateway implements SmsGateway {
  public readonly name = 'NEXTSMS';
  private username: string;
  private password: string;
  private senderId: string;

  constructor(username?: string, password?: string, senderId?: string) {
    // Strictly read backend environment variables without EXPO_PUBLIC_ fallback
    this.username = username || process.env.NEXTSMS_USERNAME || '';
    this.password = password || process.env.NEXTSMS_PASSWORD || '';
    this.senderId = senderId || process.env.NEXTSMS_SENDER_ID || 'MLOHUB';
  }

  public isConfigured(): boolean {
    return !!(this.username && this.password);
  }

  public async checkHealth(): Promise<SmsGatewayHealth> {
    const configured = this.isConfigured();
    return {
      provider: 'NEXTSMS',
      isConfigured: configured,
      mode: configured ? 'CONFIGURED_UNTESTED' : 'SANDBOX',
      senderId: this.senderId,
      details: configured
        ? `NextSMS Gateway configured with Sender ID "${this.senderId}". Live carrier testing pending.`
        : 'NextSMS credentials missing (NEXTSMS_USERNAME / NEXTSMS_PASSWORD). Operating in sandbox mode.',
    };
  }

  public async sendOtp(
    phone: string,
    otp: string,
    purpose: string = 'Uthibitisho',
    language: 'en' | 'sw' = 'sw'
  ): Promise<SmsSendResult> {
    const norm = normalizeTanzanianPhone(phone);
    if (!norm.valid) {
      return {
        success: false,
        provider: 'NEXTSMS',
        error: norm.error || 'Invalid Tanzanian phone number format',
        deliveryStatus: 'FAILED',
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'NEXTSMS',
        error: 'NextSMS credentials not configured in backend environment',
        deliveryStatus: 'FAILED',
      };
    }

    const text =
      language === 'sw'
        ? `Habari! Namba yako ya uthibitisho ya MloHub (${purpose}) ni [ ${otp} ]. Inatumika kwa dakika 5 tu. Usitoe kwa mtu yeyote.`
        : `Hello! Your MloHub verification code (${purpose}) is [ ${otp} ]. Valid for 5 minutes only. Do not share with anyone.`;

    return this.dispatchText(norm.carrierApiDigits, text);
  }

  public async sendNotification(phone: string, message: string): Promise<SmsSendResult> {
    const norm = normalizeTanzanianPhone(phone);
    if (!norm.valid) {
      return {
        success: false,
        provider: 'NEXTSMS',
        error: norm.error || 'Invalid phone format',
        deliveryStatus: 'FAILED',
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'NEXTSMS',
        error: 'NextSMS credentials not configured',
        deliveryStatus: 'FAILED',
      };
    }

    return this.dispatchText(norm.carrierApiDigits, message);
  }

  private async dispatchText(carrierDigits: string, text: string): Promise<SmsSendResult> {
    try {
      const authHeader = `Basic ${encodeBase64(`${this.username}:${this.password}`)}`;
      const response = await fetch('https://messaging-service.co.tz/api/sms/v1/text/single', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          from: this.senderId,
          to: carrierDigits,
          text,
        }),
      });

      const data: any = await response.json().catch(() => ({}));
      if (response.ok && data?.messages?.[0]?.status?.groupId === 1) {
        return {
          success: true,
          provider: 'NEXTSMS',
          messageId: data.messages[0].messageId || `nxt_${Date.now()}`,
          statusCode: response.status,
          deliveryStatus: 'SENT',
        };
      }

      const errMsg =
        data?.messages?.[0]?.status?.description ||
        data?.message ||
        `NextSMS API returned HTTP ${response.status}`;

      return {
        success: false,
        provider: 'NEXTSMS',
        statusCode: response.status,
        error: errMsg,
        deliveryStatus: 'FAILED',
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'NEXTSMS',
        error: err?.message || 'Network error connecting to NextSMS gateway',
        deliveryStatus: 'FAILED',
      };
    }
  }
}
