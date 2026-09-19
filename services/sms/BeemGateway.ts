import { SmsGateway, SmsSendResult, SmsGatewayHealth } from './SmsGateway';
import { normalizeTanzanianPhone } from '../../utils/phoneNormalization';

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

export class BeemGateway implements SmsGateway {
  public readonly name = 'BEEM_AFRICA';
  private apiKey: string;
  private secretKey: string;
  private senderId: string;

  constructor(apiKey?: string, secretKey?: string, senderId?: string) {
    // Strictly read backend environment variables without EXPO_PUBLIC_ fallback
    this.apiKey = apiKey || process.env.BEEM_API_KEY || '';
    this.secretKey = secretKey || process.env.BEEM_SECRET_KEY || '';
    this.senderId = senderId || process.env.BEEM_SENDER_ID || 'INFO';
  }

  public isConfigured(): boolean {
    return !!(this.apiKey && this.secretKey);
  }

  public async checkHealth(): Promise<SmsGatewayHealth> {
    const configured = this.isConfigured();
    return {
      provider: 'BEEM_AFRICA',
      isConfigured: configured,
      mode: configured ? 'CONFIGURED_UNTESTED' : 'SANDBOX',
      senderId: this.senderId,
      details: configured
        ? `Beem Africa Gateway configured with Sender ID "${this.senderId}". Live carrier testing pending.`
        : 'Beem Africa credentials missing (BEEM_API_KEY / BEEM_SECRET_KEY). Operating in sandbox mode.',
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
        provider: 'BEEM_AFRICA',
        error: norm.error || 'Invalid Tanzanian phone number format',
        deliveryStatus: 'FAILED',
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'BEEM_AFRICA',
        error: 'Beem Africa credentials not configured in backend environment',
        deliveryStatus: 'FAILED',
      };
    }

    const message =
      language === 'sw'
        ? `Habari! Namba yako ya siri ya MloHub (${purpose}) ni [ ${otp} ]. Inatumika kwa dakika 5 tu. Usitoe kwa mtu yeyote.`
        : `Hello! Your MloHub verification code (${purpose}) is [ ${otp} ]. Valid for 5 minutes only. Do not share with anyone.`;

    return this.dispatchMessage(norm.carrierApiDigits, message);
  }

  public async sendNotification(phone: string, message: string): Promise<SmsSendResult> {
    const norm = normalizeTanzanianPhone(phone);
    if (!norm.valid) {
      return {
        success: false,
        provider: 'BEEM_AFRICA',
        error: norm.error || 'Invalid phone format',
        deliveryStatus: 'FAILED',
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'BEEM_AFRICA',
        error: 'Beem credentials not configured',
        deliveryStatus: 'FAILED',
      };
    }

    return this.dispatchMessage(norm.carrierApiDigits, message);
  }

  private async dispatchMessage(carrierDigits: string, message: string): Promise<SmsSendResult> {
    try {
      const authHeader = `Basic ${encodeBase64(`${this.apiKey}:${this.secretKey}`)}`;
      const response = await fetch('https://apisms.beem.africa/v1/send', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          source_addr: this.senderId,
          schedule_time: '',
          encoding: 0,
          message,
          recipients: [
            {
              recipient_id: `rec_${Date.now()}`,
              dest_addr: carrierDigits,
            },
          ],
        }),
      });

      const data: any = await response.json().catch(() => ({}));
      if (response.ok && (data?.code === 100 || data?.successful || data?.data?.valid > 0)) {
        return {
          success: true,
          provider: 'BEEM_AFRICA',
          messageId: data?.request_id || data?.message_id || `beem_${Date.now()}`,
          statusCode: response.status,
          deliveryStatus: 'SENT',
        };
      }

      const errMsg =
        data?.message ||
        data?.description ||
        `Beem API returned HTTP ${response.status}`;

      return {
        success: false,
        provider: 'BEEM_AFRICA',
        statusCode: response.status,
        error: errMsg,
        deliveryStatus: 'FAILED',
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'BEEM_AFRICA',
        error: err?.message || 'Network error connecting to Beem SMS gateway',
        deliveryStatus: 'FAILED',
      };
    }
  }
}
