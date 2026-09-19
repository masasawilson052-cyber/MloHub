/**
 * Selcom Mobile Money Gateway Implementation (Secondary / Future Architecture)
 * Tanzanian secondary gateway provider for mobile money and card collections.
 */

import { PaymentGateway } from './PaymentGateway';
import {
  InitiateUssdPushRequest,
  InitiateUssdPushResponse,
  WebhookVerificationResult,
  StatusQueryResponse,
  RefundGatewayRequest,
  RefundGatewayResponse,
  PaymentProvider,
  getCarrierDetails,
} from './paymentTypes';
import { ClickPesaGateway } from './ClickPesaGateway';

export interface SelcomConfig {
  baseUrl?: string;
  vendorId?: string;
  apiKey?: string;
  apiSecret?: string;
}

export class SelcomGateway implements PaymentGateway {
  public readonly provider: PaymentProvider = 'selcom';

  private readonly baseUrl: string;
  private readonly vendorId: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(config?: SelcomConfig) {
    this.baseUrl = (config?.baseUrl || process.env.SELCOM_BASE_URL || 'https://sandbox.selcom.net/v1').replace(/\/$/, '');
    this.vendorId = config?.vendorId || process.env.SELCOM_VENDOR_ID || '';
    this.apiKey = config?.apiKey || process.env.SELCOM_API_KEY || '';
    this.apiSecret = config?.apiSecret || process.env.SELCOM_API_SECRET || '';
  }

  /**
   * Generate Selcom Authorization Header (Digest & HMAC-SHA256)
   */
  private async generateAuthHeaders(path: string, body: string): Promise<Record<string, string>> {
    const timestamp = new Date().toISOString();
    const message = `timestamp=${timestamp}&path=${path}&body=${body}`;
    const signature = await ClickPesaGateway.computeHmacSha256(this.apiSecret, message);

    return {
      'Content-Type': 'application/json',
      Authorization: `SELCOM ${this.apiKey}`,
      'Digest-Method': 'HS256',
      Digest: signature,
      Timestamp: timestamp,
    };
  }

  public async initiateUssdPush(request: InitiateUssdPushRequest): Promise<InitiateUssdPushResponse> {
    const carrier = getCarrierDetails(request.methodCode);
    const orderId = request.orderReference.substring(0, 20);

    const payload = {
      vendor: this.vendorId,
      order_id: orderId,
      buyer_phone: request.phoneNumber.replace(/[^0-9]/g, ''),
      amount: request.amount,
      currency: 'TZS',
      buyer_name: request.payerName || 'MloHub Customer',
      gateway_buyer_uuid: '',
      no_of_items: 1,
    };

    const bodyStr = JSON.stringify(payload);
    const path = '/checkout/create-order-minimal';
    const headers = await this.generateAuthHeaders(path, bodyStr);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: bodyStr,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.result !== 'SUCCESS') {
        return {
          success: false,
          provider: this.provider,
          gatewayReference: '',
          merchantReference: request.orderReference,
          status: 'FAILED',
          amountTzs: request.amount,
          carrierName: carrier.name,
          ussdCode: carrier.ussd,
          carrierPromptText: '',
          expiresAt: new Date(Date.now() + 120000).toISOString(),
          rawResponse: data,
          error: data.message || `Selcom error [${response.status}]`,
        };
      }

      const gatewayReference = data.data?.[0]?.transid || `SEL-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 120000).toISOString();
      const promptMessage = `Ombi la Selcom TZS ${request.amount.toLocaleString()} limetumwa. Thibitisha kwa PIN yako ya ${carrier.name}.`;

      return {
        success: true,
        provider: this.provider,
        gatewayReference,
        merchantReference: request.orderReference,
        status: 'PENDING',
        amountTzs: request.amount,
        carrierName: carrier.name,
        ussdCode: carrier.ussd,
        carrierPromptText: promptMessage,
        expiresAt,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.provider,
        gatewayReference: '',
        merchantReference: request.orderReference,
        status: 'FAILED',
        amountTzs: request.amount,
        carrierName: carrier.name,
        ussdCode: carrier.ussd,
        carrierPromptText: '',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
        error: err.message,
      };
    }
  }

  public async verifyWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>
  ): Promise<WebhookVerificationResult> {
    const signature = headers['digest'] || headers['x-selcom-signature'] || '';
    const timestamp = headers['timestamp'] || '';

    let isSignatureValid = false;
    if (this.apiSecret && signature) {
      const expected = await ClickPesaGateway.computeHmacSha256(this.apiSecret, rawBody);
      isSignatureValid = signature.toLowerCase() === expected.toLowerCase();
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch (e: any) {
      return {
        isValid: false,
        provider: this.provider,
        eventId: `sel_err_${Date.now()}`,
        merchantReference: '',
        gatewayReference: '',
        status: 'FAILED',
        amountTzs: 0,
        currency: 'TZS',
        timestamp: new Date().toISOString(),
        payerPhone: '',
        rawPayload: null,
        error: `JSON parse error: ${e.message}`,
      };
    }

    const eventId = parsed.transid || parsed.reference || `sel_evt_${Date.now()}`;
    const merchantReference = parsed.order_id || parsed.orderReference || '';
    const gatewayReference = parsed.transid || '';
    const amountTzs = Number(parsed.amount || 0);
    const currency = parsed.currency || 'TZS';
    const payerPhone = parsed.phone || parsed.buyer_phone || '';
    const paymentStatus = (parsed.payment_status || parsed.result || '').toUpperCase();

    let status: any = 'FAILED';
    if (paymentStatus === 'COMPLETED' || paymentStatus === 'SUCCESS') {
      status = 'PAID';
    } else if (paymentStatus === 'PENDING') {
      status = 'PROCESSING';
    } else if (paymentStatus === 'CANCELLED') {
      status = 'CANCELLED';
    }

    return {
      isValid: isSignatureValid,
      provider: this.provider,
      eventId,
      merchantReference,
      gatewayReference,
      status,
      amountTzs,
      currency,
      timestamp: timestamp || new Date().toISOString(),
      payerPhone,
      rawPayload: parsed,
      error: !isSignatureValid ? 'Invalid Selcom HMAC signature' : undefined,
    };
  }

  public async queryStatus(gatewayReference: string, merchantReference?: string): Promise<StatusQueryResponse> {
    const path = `/checkout/order-status?order_id=${merchantReference || gatewayReference}`;
    const headers = await this.generateAuthHeaders(path, '');

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json().catch(() => ({}));
    const rawStatus = (data.data?.[0]?.payment_status || data.result || '').toUpperCase();
    let status: any = 'PENDING';
    if (rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS') {
      status = 'PAID';
    } else if (rawStatus === 'FAILED') {
      status = 'FAILED';
    }

    return {
      success: response.ok,
      status,
      amountTzs: Number(data.data?.[0]?.amount || 0),
      gatewayReference,
      merchantReference: merchantReference || '',
      paidAt: data.data?.[0]?.payment_date,
      rawResponse: data,
    };
  }

  public async refund(request: RefundGatewayRequest): Promise<RefundGatewayResponse> {
    return {
      success: true,
      refundReference: `SEL-REF-${Date.now()}`,
      amountTzs: request.amountTzs,
      status: 'REFUNDED',
      message: 'Selcom simulated refund completed',
    };
  }
}
