/**
 * PaymentGateway Interface
 * Defines standard operations required for all Tanzanian mobile money gateways.
 */

import {
  InitiateUssdPushRequest,
  InitiateUssdPushResponse,
  WebhookVerificationResult,
  StatusQueryResponse,
  RefundGatewayRequest,
  RefundGatewayResponse,
  PaymentProvider,
} from './paymentTypes';

export interface PaymentGateway {
  /**
   * Gateway provider identifier
   */
  readonly provider: PaymentProvider;

  /**
   * Initiate USSD Push collection to customer handset
   */
  initiateUssdPush(request: InitiateUssdPushRequest): Promise<InitiateUssdPushResponse>;

  /**
   * Verify cryptographic signature and parse incoming webhook payload
   */
  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>
  ): Promise<WebhookVerificationResult>;

  /**
   * Query gateway for latest authoritative status of a transaction
   */
  queryStatus(gatewayReference: string, merchantReference?: string): Promise<StatusQueryResponse>;

  /**
   * Process a refund to customer's mobile money account
   */
  refund(request: RefundGatewayRequest): Promise<RefundGatewayResponse>;
}
