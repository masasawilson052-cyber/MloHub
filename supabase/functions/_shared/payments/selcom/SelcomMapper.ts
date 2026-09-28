/**
 * Selcom Response & Webhook Mapper
 *
 * Transforms verified Selcom responses into MloHub canonical payment responses.
 * Ensures zero leakage of raw provider payloads to customer-facing layers.
 */

import {
  InitiateUssdPushResponse,
  StatusQueryResponse,
  WebhookVerificationResult,
} from '../paymentTypes.ts';

export class SelcomMapper {
  /**
   * Maps an initiate collection response
   */
  public static mapCollectionResponse(
    data: any,
    merchantReference: string,
    amountTzs: number,
    carrierName: string,
    ussdCode: string
  ): InitiateUssdPushResponse {
    const isSuccess = data?.result === 'SUCCESS';
    const gatewayReference = data?.data?.[0]?.transid || (isSuccess ? `SEL-${Date.now()}` : '');

    if (!isSuccess) {
      return {
        success: false,
        provider: 'selcom',
        gatewayReference: '',
        merchantReference,
        status: 'FAILED',
        amountTzs,
        carrierName,
        ussdCode,
        carrierPromptText: '',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
        error: data?.message || 'Payment initiation declined by payment network.',
      };
    }

    return {
      success: true,
      provider: 'selcom',
      gatewayReference,
      merchantReference,
      status: 'PENDING',
      amountTzs,
      carrierName,
      ussdCode,
      carrierPromptText: `Ombi la Selcom TZS ${amountTzs.toLocaleString()} limetumwa. Thibitisha kwa PIN yako ya ${carrierName}.`,
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };
  }

  /**
   * Maps a query status response
   */
  public static mapStatusResponse(
    data: any,
    gatewayReference: string,
    merchantReference: string
  ): StatusQueryResponse {
    const rawStatus = (data?.data?.[0]?.payment_status || data?.result || '').toUpperCase();
    let status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' = 'PENDING';

    if (rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS') {
      status = 'PAID';
    } else if (rawStatus === 'FAILED') {
      status = 'FAILED';
    } else if (rawStatus === 'PENDING' || rawStatus === 'PROCESSING') {
      status = 'PROCESSING';
    }

    return {
      success: true,
      status,
      amountTzs: Number(data?.data?.[0]?.amount || 0),
      gatewayReference,
      merchantReference,
      paidAt: data?.data?.[0]?.payment_date || (status === 'PAID' ? new Date().toISOString() : undefined),
    };
  }

  /**
   * Maps a verified webhook payload
   */
  public static mapWebhookPayload(
    parsed: any,
    isSignatureValid: boolean,
    timestampHeader?: string
  ): WebhookVerificationResult {
    const eventId = String(parsed?.transid || parsed?.reference || `sel_evt_${Date.now()}`);
    const merchantReference = String(parsed?.order_id || parsed?.orderReference || '');
    const gatewayReference = String(parsed?.transid || '');
    const amountTzs = Number(parsed?.amount || 0);
    const currency = String(parsed?.currency || 'TZS');
    const payerPhone = String(parsed?.phone || parsed?.buyer_phone || '');
    const paymentStatus = String(parsed?.payment_status || parsed?.result || '').toUpperCase();

    let status: 'PAID' | 'PROCESSING' | 'FAILED' | 'CANCELLED' = 'FAILED';
    if (paymentStatus === 'COMPLETED' || paymentStatus === 'SUCCESS') {
      status = 'PAID';
    } else if (paymentStatus === 'PENDING') {
      status = 'PROCESSING';
    } else if (paymentStatus === 'CANCELLED') {
      status = 'CANCELLED';
    }

    return {
      isValid: isSignatureValid,
      provider: 'selcom',
      eventId,
      merchantReference,
      gatewayReference,
      status,
      amountTzs,
      currency,
      timestamp: timestampHeader || new Date().toISOString(),
      payerPhone,
      rawPayload: parsed,
      error: !isSignatureValid ? 'Invalid Selcom webhook signature' : undefined,
    };
  }
}
