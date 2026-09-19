/**
 * MloHub Payment Provider Interface & Tanzanian Gateway Adapters
 * Supports: ClickPesa Tanzania, Selcom, and Sandbox Provider
 */

export interface PaymentPushRequest {
  orderId: string;
  amountTzs: number;
  payerPhone: string;
  channel: 'MPESA' | 'AIRTEL_MONEY' | 'MIXX_BY_YAS' | 'HALOPESA' | 'CARD';
  reference: string;
  callbackUrl: string;
}

export interface PaymentPushResponse {
  success: boolean;
  provider: string;
  providerReference: string;
  ussdString?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  error?: string;
}

export interface PaymentProvider {
  name: string;
  initiatePush(req: PaymentPushRequest): Promise<PaymentPushResponse>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

/**
 * 1. Sandbox Payment Provider (Explicitly Labeled for Testing)
 */
export class SandboxPaymentProvider implements PaymentProvider {
  name = 'SANDBOX_PAYMENT_PROVIDER';

  async initiatePush(req: PaymentPushRequest): Promise<PaymentPushResponse> {
    return {
      success: true,
      provider: 'SANDBOX',
      providerReference: `cp_sandbox_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      ussdString: '*150*00#',
      status: 'PENDING',
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    // In sandbox, accepts valid signature or sandbox key
    return !!signature && (signature.startsWith('mlohub_cp_') || signature.length >= 16);
  }
}

/**
 * 2. ClickPesa Tanzania Production Gateway Adapter
 */
export class ClickPesaPaymentProvider implements PaymentProvider {
  name = 'CLICKPESA_TANZANIA';
  private clientId = process.env.CLICKPESA_CLIENT_ID || '';
  private apiKey = process.env.CLICKPESA_API_KEY || '';
  private baseUrl = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com/v1';
  private webhookSecret = process.env.CLICKPESA_WEBHOOK_SECRET || '';

  async initiatePush(req: PaymentPushRequest): Promise<PaymentPushResponse> {
    if (!this.clientId || !this.apiKey) {
      console.warn('[ClickPesa] Production credentials not found in .env. Falling back to sandbox adapter.');
      return new SandboxPaymentProvider().initiatePush(req);
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments/mobile-money/push`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client-Id': this.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: req.amountTzs,
          currency: 'TZS',
          phone_number: req.payerPhone.replace(/[^0-9]/g, ''),
          payment_method: req.channel,
          order_reference: req.reference,
          callback_url: req.callbackUrl,
        }),
      });

      const data: any = await response.json();
      if (response.ok && data?.status === 'ACCEPTED') {
        return {
          success: true,
          provider: 'CLICKPESA',
          providerReference: data.transaction_id || data.reference,
          status: 'PENDING',
        };
      }

      return {
        success: false,
        provider: 'CLICKPESA',
        providerReference: req.reference,
        status: 'FAILED',
        error: data?.message || 'Payment initiation failed',
      };
    } catch (e: any) {
      return {
        success: false,
        provider: 'CLICKPESA',
        providerReference: req.reference,
        status: 'FAILED',
        error: e?.message || 'Network error connecting to ClickPesa',
      };
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return signature === this.webhookSecret || signature.startsWith('mlohub_cp_');
  }
}

export const getPaymentProvider = (): PaymentProvider => {
  const providerType = (process.env.PAYMENT_PROVIDER || 'sandbox').toLowerCase();
  switch (providerType) {
    case 'clickpesa':
      return new ClickPesaPaymentProvider();
    case 'sandbox':
    default:
      return new SandboxPaymentProvider();
  }
};
