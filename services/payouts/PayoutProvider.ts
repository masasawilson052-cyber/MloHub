/**
 * MloHub Payout Provider Interface & Tanzanian Gateway Adapters
 * Strict fail-closed semantics: Sandbox in dev/test, ClickPesa in production.
 */

import { PayoutDestinationType } from '../../types/domain';

export interface ProviderCapabilities {
  supportsCollections: boolean;
  supportsPaymentStatusQuery: boolean;
  supportsAutomatedRefunds: boolean;
  supportsMobileMoneyPayouts: boolean;
  supportsBankPayouts: boolean;
  supportsPayoutStatusQuery: boolean;
  supportsBalanceQuery: boolean;
  supportsWebhooks: boolean;
}

export interface PayoutDestinationVerificationRequest {
  destinationType: PayoutDestinationType;
  accountIdentifier: string; // e.g. phone or bank account
  provider: string; // 'M_PESA', 'AIRTEL_MONEY', 'CRDB', etc.
}

export interface PayoutDestinationVerificationResponse {
  isValid: boolean;
  accountName?: string;
  error?: string;
}

export interface PayoutDisbursementRequest {
  payoutId: string;
  settlementId: string;
  restaurantId: string;
  amountTzs: bigint;
  destinationType: PayoutDestinationType;
  accountIdentifier: string;
  accountName: string;
  idempotencyKey: string;
}

export interface PayoutDisbursementResponse {
  success: boolean;
  providerReference: string;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED';
  rawResponse?: any;
  error?: string;
}

export interface PayoutStatusQueryResponse {
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  providerReference: string;
  amountTzs?: bigint;
  failureReason?: string;
  rawResponse?: any;
}

export interface PayoutProvider {
  name: string;
  getCapabilities(): ProviderCapabilities;
  validateDestination(req: PayoutDestinationVerificationRequest): Promise<PayoutDestinationVerificationResponse>;
  disbursePayout(req: PayoutDisbursementRequest): Promise<PayoutDisbursementResponse>;
  queryPayoutStatus(providerReference: string): Promise<PayoutStatusQueryResponse>;
}

/**
 * 1. Deterministic Sandbox Payout Provider for Testing & Development
 */
export class SandboxPayoutProvider implements PayoutProvider {
  name = 'SANDBOX_PAYOUT_PROVIDER';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsCollections: true,
      supportsPaymentStatusQuery: true,
      supportsAutomatedRefunds: true,
      supportsMobileMoneyPayouts: true,
      supportsBankPayouts: true,
      supportsPayoutStatusQuery: true,
      supportsBalanceQuery: true,
      supportsWebhooks: true,
    };
  }

  async validateDestination(req: PayoutDestinationVerificationRequest): Promise<PayoutDestinationVerificationResponse> {
    const cleanId = req.accountIdentifier.replace(/[^0-9]/g, '');
    if (req.destinationType === 'MOBILE_MONEY' && cleanId.length < 9) {
      return { isValid: false, error: 'INVALID_PHONE_NUMBER' };
    }
    return {
      isValid: true,
      accountName: `Verified Vendor (${req.provider})`,
    };
  }

  async disbursePayout(req: PayoutDisbursementRequest): Promise<PayoutDisbursementResponse> {
    if (req.amountTzs <= 0n) {
      return {
        success: false,
        providerReference: '',
        status: 'FAILED',
        error: 'INVALID_AMOUNT',
      };
    }

    const providerRef = `cp_payout_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      success: true,
      providerReference: providerRef,
      status: 'SUCCESS',
      rawResponse: { provider: 'SANDBOX', reference: providerRef },
    };
  }

  async queryPayoutStatus(providerReference: string): Promise<PayoutStatusQueryResponse> {
    return {
      status: 'SUCCESS',
      providerReference,
      rawResponse: { status: 'SETTLED' },
    };
  }
}

/**
 * 2. ClickPesa Tanzania Production Disbursement Adapter (Fail-Closed)
 */
export class ClickPesaPayoutProvider implements PayoutProvider {
  name = 'CLICKPESA_TANZANIA_PAYOUT';
  private clientId = process.env.CLICKPESA_CLIENT_ID || '';
  private apiKey = process.env.CLICKPESA_API_KEY || '';
  private baseUrl = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com/v1';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsCollections: true,
      supportsPaymentStatusQuery: true,
      supportsAutomatedRefunds: false, // ClickPesa V1 requires manual refund support or dedicated endpoint
      supportsMobileMoneyPayouts: true,
      supportsBankPayouts: true,
      supportsPayoutStatusQuery: true,
      supportsBalanceQuery: false,
      supportsWebhooks: true,
    };
  }

  async validateDestination(req: PayoutDestinationVerificationRequest): Promise<PayoutDestinationVerificationResponse> {
    if (!this.clientId || !this.apiKey) {
      throw new Error('[ClickPesaPayoutProvider] Missing ClickPesa production credentials. Fail-closed.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/disbursements/validate-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client-Id': this.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_type: req.destinationType,
          account_identifier: req.accountIdentifier,
          provider: req.provider,
        }),
      });

      const data: any = await response.json();
      if (response.ok && data?.valid) {
        return {
          isValid: true,
          accountName: data.account_name || 'Verified Vendor',
        };
      }

      return {
        isValid: false,
        error: data?.message || 'Account validation rejected by provider',
      };
    } catch (e: any) {
      return {
        isValid: false,
        error: e.message || 'Network error connecting to ClickPesa',
      };
    }
  }

  async disbursePayout(req: PayoutDisbursementRequest): Promise<PayoutDisbursementResponse> {
    if (!this.clientId || !this.apiKey) {
      throw new Error('[ClickPesaPayoutProvider] Missing ClickPesa production credentials. Fail-closed.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/disbursements/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client-Id': this.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: req.amountTzs.toString(),
          currency: 'TZS',
          recipient_type: req.destinationType,
          recipient_identifier: req.accountIdentifier,
          reference: req.idempotencyKey,
        }),
      });

      const data: any = await response.json();
      if (response.ok && data?.reference) {
        return {
          success: true,
          providerReference: data.reference,
          status: data.status === 'SUCCESS' ? 'SUCCESS' : 'PROCESSING',
          rawResponse: data,
        };
      }

      return {
        success: false,
        providerReference: req.idempotencyKey,
        status: 'FAILED',
        error: data?.message || 'Payout transfer failed',
        rawResponse: data,
      };
    } catch (e: any) {
      return {
        success: false,
        providerReference: req.idempotencyKey,
        status: 'FAILED',
        error: e.message || 'ClickPesa disbursement network error',
      };
    }
  }

  async queryPayoutStatus(providerReference: string): Promise<PayoutStatusQueryResponse> {
    if (!this.clientId || !this.apiKey) {
      throw new Error('[ClickPesaPayoutProvider] Missing ClickPesa production credentials. Fail-closed.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/disbursements/status/${providerReference}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client-Id': this.clientId,
        },
      });

      const data: any = await response.json();
      let status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERSED' = 'PROCESSING';
      if (data?.status === 'SUCCESS' || data?.status === 'SETTLED') status = 'SUCCESS';
      if (data?.status === 'FAILED') status = 'FAILED';
      if (data?.status === 'REVERSED') status = 'REVERSED';

      return {
        status,
        providerReference,
        rawResponse: data,
      };
    } catch (e: any) {
      return {
        status: 'PROCESSING',
        providerReference,
        failureReason: e.message,
      };
    }
  }
}

/**
 * Factory for Payout Provider based on strict environment configuration
 */
export function getPayoutProvider(): PayoutProvider {
  const env = (process.env.EXPO_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  const providerConfig = (process.env.PAYOUT_PROVIDER || '').toLowerCase();

  if (env === 'production') {
    return new ClickPesaPayoutProvider();
  }

  if (providerConfig === 'clickpesa') {
    return new ClickPesaPayoutProvider();
  }

  return new SandboxPayoutProvider();
}
