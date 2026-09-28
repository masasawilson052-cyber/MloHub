/**
 * Selcom Mobile Money Gateway Implementation
 *
 * Implements the PaymentGateway interface for Selcom Pay (Tanzania).
 * Built with strict fail-closed security:
 * - Requires explicit credentials via requireSelcomConfig()
 * - Never guesses or defaults production URLs
 * - Uses decoupled Web Crypto primitives (hmacSha256Hex, timingSafeEqualText)
 * - Fails closed if official merchant contract is unverified in production
 */

import { PaymentGateway } from './PaymentGateway.ts';
import {
  InitiateUssdPushRequest,
  InitiateUssdPushResponse,
  WebhookVerificationResult,
  StatusQueryResponse,
  RefundGatewayRequest,
  RefundGatewayResponse,
  PaymentProvider,
  getCarrierDetails,
} from './paymentTypes.ts';
import { readPaymentEnvironment } from './environment.ts';
import { hmacSha256Hex, timingSafeEqualText } from '../security/crypto.ts';
import { SelcomMapper } from './selcom/SelcomMapper.ts';
import { SelcomContractNotVerifiedError } from './selcom/SelcomContract.ts';

export interface SelcomConfig {
  baseUrl: string;
  vendorId: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Validates and requires complete Selcom configuration.
 * Never defaults to sandbox or guessed URLs in production.
 */
export function requireSelcomConfig(overrideConfig?: Partial<SelcomConfig>): SelcomConfig {
  const baseUrl = overrideConfig?.baseUrl || readPaymentEnvironment('SELCOM_BASE_URL');
  const vendorId = overrideConfig?.vendorId || readPaymentEnvironment('SELCOM_VENDOR_ID');
  const apiKey = overrideConfig?.apiKey || readPaymentEnvironment('SELCOM_API_KEY');
  const apiSecret = overrideConfig?.apiSecret || readPaymentEnvironment('SELCOM_API_SECRET');

  if (!baseUrl || !vendorId || !apiKey || !apiSecret) {
    throw new Error('SELCOM_CONFIGURATION_INCOMPLETE: SELCOM_BASE_URL, SELCOM_VENDOR_ID, SELCOM_API_KEY, and SELCOM_API_SECRET must all be set.');
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    vendorId,
    apiKey,
    apiSecret,
  };
}

export class SelcomGateway implements PaymentGateway {
  public readonly provider: PaymentProvider = 'selcom';

  private readonly config: SelcomConfig;
  private readonly isContractVerified: boolean;

  constructor(overrideConfig?: Partial<SelcomConfig>, isContractVerifiedOverride?: boolean) {
    this.config = requireSelcomConfig(overrideConfig);
    this.isContractVerified =
      isContractVerifiedOverride !== undefined
        ? isContractVerifiedOverride
        : readPaymentEnvironment('SELCOM_CONTRACT_VERIFIED') === 'true';
  }

  /**
   * Asserts contract verification before live network operations
   */
  private assertContractVerified(): void {
    if (!this.isContractVerified) {
      throw new SelcomContractNotVerifiedError();
    }
  }

  /**
   * Generates official Selcom Authorization Headers (Digest & HMAC-SHA256)
   */
  public async generateAuthHeaders(path: string, body: string): Promise<Record<string, string>> {
    const timestamp = new Date().toISOString();
    const message = `timestamp=${timestamp}&path=${path}&body=${body}`;
    const signature = await hmacSha256Hex(this.config.apiSecret, message);

    return {
      'Content-Type': 'application/json',
      Authorization: `SELCOM ${this.config.apiKey}`,
      'Digest-Method': 'HS256',
      Digest: signature,
      Timestamp: timestamp,
    };
  }

  public async initiateUssdPush(request: InitiateUssdPushRequest): Promise<InitiateUssdPushResponse> {
    this.assertContractVerified();

    const carrier = getCarrierDetails(request.methodCode);
    const orderId = request.orderReference.substring(0, 20);

    const payload = {
      vendor: this.config.vendorId,
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
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: bodyStr,
      });

      const data = await response.json().catch(() => ({}));

      return SelcomMapper.mapCollectionResponse(
        data,
        request.orderReference,
        request.amount,
        carrier.name,
        carrier.ussd
      );
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
        error: err.message || 'Network error connecting to payment gateway.',
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
    if (this.config.apiSecret && signature) {
      const expected = await hmacSha256Hex(this.config.apiSecret, rawBody);
      isSignatureValid = timingSafeEqualText(signature.toLowerCase(), expected.toLowerCase());
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

    return SelcomMapper.mapWebhookPayload(parsed, isSignatureValid, timestamp);
  }

  public async queryStatus(gatewayReference: string, merchantReference?: string): Promise<StatusQueryResponse> {
    this.assertContractVerified();

    const path = `/checkout/order-status?order_id=${merchantReference || gatewayReference}`;
    const headers = await this.generateAuthHeaders(path, '');

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json().catch(() => ({}));

    return SelcomMapper.mapStatusResponse(data, gatewayReference, merchantReference || '');
  }

  public async refund(request: RefundGatewayRequest): Promise<RefundGatewayResponse> {
    return {
      success: false,
      refundReference: '',
      amountTzs: request.amountTzs,
      status: 'FAILED',
      message: 'SELCOM_REFUND_MANUAL_REQUIRED: Automated Selcom refunds are not implemented. Manual refund workflow required.',
    };
  }
}
