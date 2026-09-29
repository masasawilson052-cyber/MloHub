/**
 * PayoutGateway Interface and Tanzanian Gateway Implementations
 * Strict fail-closed semantics. Selcom requires verified contract. ClickPesa requires ALLOW_LEGACY_CLICKPESA_PAYOUT=true.
 */

export type PayoutDestinationType = 'MOBILE_MONEY' | 'BANK_ACCOUNT';

export interface PayoutDestinationVerificationRequest {
  destinationType: PayoutDestinationType;
  accountIdentifier: string;
  provider: string;
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
  amountTzs: bigint | number;
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
  amountTzs?: bigint | number;
  failureReason?: string;
  rawResponse?: any;
}

export interface PayoutGateway {
  name: string;

  validateDestination(
    request: PayoutDestinationVerificationRequest
  ): Promise<PayoutDestinationVerificationResponse>;

  disburse(
    request: PayoutDisbursementRequest
  ): Promise<PayoutDisbursementResponse>;

  getStatus(
    providerReference: string
  ): Promise<PayoutStatusQueryResponse>;
}

function getEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && (Deno as any)?.env?.get) {
    return (Deno as any).env.get(key);
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * 1. Selcom Payout Gateway (Contract Required)
 * PRODUCTION RULE: DO NOT invent a Selcom payout endpoint, signature, header, or request body.
 * If official Selcom payout contract has NOT been configured:
 * throw PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED.
 */
export class SelcomPayoutGateway implements PayoutGateway {
  name = 'SELCOM_PAYOUT_GATEWAY';

  constructor() {
    const isContractConfigured =
      getEnv('SELCOM_PAYOUT_CONTRACT_CONFIGURED') === 'true' &&
      !!getEnv('SELCOM_API_KEY') &&
      !!getEnv('SELCOM_API_SECRET');

    if (!isContractConfigured) {
      throw new Error('PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED');
    }
  }

  async validateDestination(_request: PayoutDestinationVerificationRequest): Promise<PayoutDestinationVerificationResponse> {
    throw new Error('PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED');
  }

  async disburse(_request: PayoutDisbursementRequest): Promise<PayoutDisbursementResponse> {
    throw new Error('PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED');
  }

  async getStatus(_providerReference: string): Promise<PayoutStatusQueryResponse> {
    throw new Error('PAYOUT_PROVIDER_CONTRACT_NOT_VERIFIED');
  }
}

/**
 * 2. ClickPesa Tanzanian Disbursement Gateway (Legacy Rollback Only)
 * Legacy ClickPesa payout support may only run when:
 * ALLOW_LEGACY_CLICKPESA_PAYOUT=true explicitly exists server-side.
 */
export class ClickPesaPayoutGateway implements PayoutGateway {
  name = 'CLICKPESA_PAYOUT_GATEWAY';
  private clientId: string;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    if (getEnv('ALLOW_LEGACY_CLICKPESA_PAYOUT') !== 'true') {
      throw new Error('CLICKPESA_LEGACY_PAYOUT_DISABLED: Legacy ClickPesa payout support requires ALLOW_LEGACY_CLICKPESA_PAYOUT=true.');
    }
    this.clientId = getEnv('CLICKPESA_CLIENT_ID') || '';
    this.apiKey = getEnv('CLICKPESA_API_KEY') || '';
    this.baseUrl = getEnv('CLICKPESA_BASE_URL') || 'https://api.clickpesa.com/v1';

    if (!this.clientId || !this.apiKey) {
      throw new Error('CLICKPESA_CREDENTIALS_MISSING: Missing ClickPesa credentials in environment.');
    }
  }

  async validateDestination(request: PayoutDestinationVerificationRequest): Promise<PayoutDestinationVerificationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/disbursements/validate-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client-Id': this.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_type: request.destinationType,
          account_identifier: request.accountIdentifier,
          provider: request.provider,
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

  async disburse(request: PayoutDisbursementRequest): Promise<PayoutDisbursementResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/disbursements/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client-Id': this.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: request.amountTzs.toString(),
          currency: 'TZS',
          recipient_type: request.destinationType,
          recipient_identifier: request.accountIdentifier,
          reference: request.idempotencyKey,
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
        providerReference: request.idempotencyKey,
        status: 'FAILED',
        error: data?.message || 'Payout transfer failed',
        rawResponse: data,
      };
    } catch (e: any) {
      return {
        success: false,
        providerReference: request.idempotencyKey,
        status: 'FAILED',
        error: e.message || 'ClickPesa disbursement network error',
      };
    }
  }

  async getStatus(providerReference: string): Promise<PayoutStatusQueryResponse> {
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
 * 3. Deterministic Sandbox Gateway (Test & Local Dev Only)
 */
export class SandboxPayoutGateway implements PayoutGateway {
  name = 'SANDBOX_PAYOUT_GATEWAY';

  async validateDestination(request: PayoutDestinationVerificationRequest): Promise<PayoutDestinationVerificationResponse> {
    const cleanId = request.accountIdentifier.replace(/[^0-9]/g, '');
    if (request.destinationType === 'MOBILE_MONEY' && cleanId.length < 9) {
      return { isValid: false, error: 'INVALID_PHONE_NUMBER' };
    }
    return {
      isValid: true,
      accountName: `Verified Vendor (${request.provider})`,
    };
  }

  async disburse(request: PayoutDisbursementRequest): Promise<PayoutDisbursementResponse> {
    if (BigInt(request.amountTzs) <= 0n) {
      return {
        success: false,
        providerReference: '',
        status: 'FAILED',
        error: 'INVALID_AMOUNT',
      };
    }

    const providerRef = `sbx_payout_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      success: true,
      providerReference: providerRef,
      status: 'SUCCESS',
      rawResponse: { provider: 'SANDBOX', reference: providerRef },
    };
  }

  async getStatus(providerReference: string): Promise<PayoutStatusQueryResponse> {
    return {
      status: 'SUCCESS',
      providerReference,
      rawResponse: { status: 'SETTLED' },
    };
  }
}

/**
 * Payout Gateway Factory
 * Resolves active server payout gateway.
 * Rule: Never silently default to ClickPesa in production.
 */
export function getPayoutGateway(overrideProvider?: string): PayoutGateway {
  const env = (
    getEnv('EXPO_PUBLIC_APP_ENV') ||
    getEnv('APP_ENV') ||
    getEnv('NODE_ENV') ||
    'development'
  ).toLowerCase();

  const explicitProvider = (
    overrideProvider ||
    getEnv('PAYOUT_PROVIDER') ||
    ''
  ).toLowerCase();

  // In test / sandbox environments
  if (explicitProvider === 'sandbox' || (env === 'test' && !explicitProvider)) {
    if (env === 'production') {
      throw new Error('SANDBOX_PAYOUT_NOT_ALLOWED_IN_PRODUCTION: Sandbox payouts are forbidden in production.');
    }
    return new SandboxPayoutGateway();
  }

  // ClickPesa explicitly requested
  if (explicitProvider === 'clickpesa') {
    if (getEnv('ALLOW_LEGACY_CLICKPESA_PAYOUT') !== 'true') {
      throw new Error('CLICKPESA_LEGACY_PAYOUT_DISABLED: Legacy ClickPesa payouts require ALLOW_LEGACY_CLICKPESA_PAYOUT=true.');
    }
    return new ClickPesaPayoutGateway();
  }

  // Default target is Selcom. Must verify contract or throw.
  if (explicitProvider === 'selcom' || !explicitProvider) {
    return new SelcomPayoutGateway();
  }

  throw new Error(`UNKNOWN_PAYOUT_PROVIDER: Unsupported provider ${explicitProvider}`);
}
