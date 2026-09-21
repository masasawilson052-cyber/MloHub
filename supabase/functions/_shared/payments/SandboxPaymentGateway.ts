/**
 * Deterministic Sandbox Payment Gateway
 * Provides predictable mobile money testing for investor demos, unit tests, and local dev.
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
import { ClickPesaGateway } from './ClickPesaGateway.ts';

export class SandboxPaymentGateway implements PaymentGateway {
  public readonly provider: PaymentProvider = 'sandbox';
  public static readonly SANDBOX_WEBHOOK_SECRET = 'mlohub_sandbox_hmac_secret_2026';

  private static store: Map<string, {
    status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
    amount: number;
    phone: string;
    orderReference: string;
    createdAt: string;
  }> = new Map();

  public async initiateUssdPush(request: InitiateUssdPushRequest): Promise<InitiateUssdPushResponse> {
    const carrier = getCarrierDetails(request.methodCode);
    const gatewayRef = `CP-SB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Deterministic simulation rules based on phone number suffix
    const phone = request.phoneNumber.replace(/[^0-9]/g, '');
    const isInstantFail = phone.endsWith('00');

    const status = isInstantFail ? 'FAILED' : 'PENDING';
    SandboxPaymentGateway.store.set(gatewayRef, {
      status,
      amount: request.amount,
      phone: request.phoneNumber,
      orderReference: request.orderReference,
      createdAt: new Date().toISOString(),
    });

    if (isInstantFail) {
      return {
        success: false,
        provider: this.provider,
        gatewayReference: gatewayRef,
        merchantReference: request.orderReference,
        status: 'FAILED',
        amountTzs: request.amount,
        carrierName: carrier.name,
        ussdCode: carrier.ussd,
        carrierPromptText: 'Salio halitoshi kwenye simu yako (Sandbox Insufficient Funds)',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
        error: 'Insufficient funds on test account',
      };
    }

    const expiresAt = new Date(Date.now() + 120000).toISOString();
    const promptMessage = `[SANDBOX] Ombi la malipo TZS ${request.amount.toLocaleString()} kwa ${carrier.name}. Bonyeza thibitisha kwenye dashibodi ya majaribio.`;

    return {
      success: true,
      provider: this.provider,
      gatewayReference: gatewayRef,
      merchantReference: request.orderReference,
      status: 'PENDING',
      amountTzs: request.amount,
      carrierName: carrier.name,
      ussdCode: carrier.ussd,
      carrierPromptText: promptMessage,
      expiresAt,
    };
  }

  public async verifyWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>
  ): Promise<WebhookVerificationResult> {
    const signature = headers['x-clickpesa-signature'] || headers['clickpesa-signature'] || '';
    const expected = await ClickPesaGateway.computeHmacSha256(SandboxPaymentGateway.SANDBOX_WEBHOOK_SECRET, rawBody);
    const isValid = Boolean(signature) && signature.toLowerCase() === expected.toLowerCase();

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return {
        isValid: false,
        provider: this.provider,
        eventId: `err_${Date.now()}`,
        merchantReference: '',
        gatewayReference: '',
        status: 'FAILED',
        amountTzs: 0,
        currency: 'TZS',
        timestamp: new Date().toISOString(),
        payerPhone: '',
        rawPayload: null,
        error: 'JSON parse error',
      };
    }

    const rawStatus = (parsed.status || parsed.eventType || '').toUpperCase();
    let status: any = 'FAILED';
    if (rawStatus === 'SUCCESS' || rawStatus === 'PAID' || rawStatus === 'PAYMENT.SUCCESS') {
      status = 'PAID';
    } else if (rawStatus === 'CANCELLED') {
      status = 'CANCELLED';
    }

    const gatewayRef = parsed.paymentId || parsed.providerReference || parsed.transactionId || '';
    const merchantRef = parsed.orderReference || parsed.merchantReference || '';
    if (gatewayRef && SandboxPaymentGateway.store.has(gatewayRef) && isValid) {
      const record = SandboxPaymentGateway.store.get(gatewayRef)!;
      record.status = status;
    }

    return {
      isValid,
      provider: this.provider,
      eventId: parsed.eventId || `sb_evt_${Date.now()}`,
      merchantReference: parsed.orderReference || '',
      gatewayReference: gatewayRef,
      status,
      amountTzs: Number(parsed.amount || 0),
      currency: parsed.currency || 'TZS',
      timestamp: parsed.timestamp || new Date().toISOString(),
      payerPhone: parsed.phoneNumber || parsed.payerPhone || '',
      rawPayload: parsed,
      error: !isValid ? 'Invalid Sandbox HMAC signature' : undefined,
    };
  }

  public async queryStatus(gatewayReference: string, merchantReference?: string): Promise<StatusQueryResponse> {
    const record = SandboxPaymentGateway.store.get(gatewayReference);
    if (!record) {
      return {
        success: true,
        status: 'PENDING',
        amountTzs: 0,
        gatewayReference,
        merchantReference: merchantReference || '',
      };
    }

    return {
      success: true,
      status: record.status,
      amountTzs: record.amount,
      gatewayReference,
      merchantReference: record.orderReference,
      paidAt: record.status === 'PAID' ? new Date().toISOString() : undefined,
    };
  }

  public async refund(request: RefundGatewayRequest): Promise<RefundGatewayResponse> {
    const record = SandboxPaymentGateway.store.get(request.gatewayReference);
    if (record) {
      record.status = 'REFUNDED';
    }

    return {
      success: true,
      refundReference: `SB-REF-${Date.now()}`,
      amountTzs: request.amountTzs,
      status: 'REFUNDED',
      message: 'Sandbox refund processed successfully',
    };
  }

  /**
   * Helper to construct a valid signed webhook payload for testing & sandboxing
   */
  public static async createSignedWebhookPayload(params: {
    merchantReference: string;
    gatewayReference: string;
    amountTzs: number;
    payerPhone: string;
    status?: 'SUCCESS' | 'FAILED';
  }): Promise<{ body: string; signature: string }> {
    const payload = {
      eventId: `sb_evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      paymentId: params.gatewayReference,
      orderReference: params.merchantReference,
      amount: params.amountTzs,
      currency: 'TZS',
      status: params.status || 'SUCCESS',
      phoneNumber: params.payerPhone,
      timestamp: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);
    const signature = await ClickPesaGateway.computeHmacSha256(SandboxPaymentGateway.SANDBOX_WEBHOOK_SECRET, body);
    return { body, signature };
  }
}
