/**
 * Official Selcom Provider Contract Interface
 *
 * Defines the strict schema and behavioral contract for interacting with Selcom Pay.
 * If the official contract has not been verified against MloHub's official merchant
 * agreement, production initiation must fail closed with SELCOM_CONTRACT_NOT_VERIFIED.
 */

import {
  InitiateUssdPushResponse,
  StatusQueryResponse,
  WebhookVerificationResult,
} from '../paymentTypes.ts';

export interface SelcomProviderContract {
  collectionPath: string;
  statusPath: string;
  refundPath?: string;

  buildAuthHeaders(request: {
    method: string;
    path: string;
    body: string;
  }): Promise<Record<string, string>>;

  mapCollectionResponse(payload: unknown): InitiateUssdPushResponse;

  mapStatusResponse(payload: unknown): StatusQueryResponse;

  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>
  ): Promise<WebhookVerificationResult>;
}

export class SelcomContractNotVerifiedError extends Error {
  constructor(message = 'SELCOM_PRODUCTION_ACTIVATION_BLOCKED: Official merchant API contract/credentials required.') {
    super(message);
    this.name = 'SelcomContractNotVerifiedError';
    Object.setPrototypeOf(this, SelcomContractNotVerifiedError.prototype);
  }
}
