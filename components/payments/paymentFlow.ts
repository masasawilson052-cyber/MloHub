export type PaymentFlowStep =
  | 'METHOD'
  | 'PHONE'
  | 'REQUESTING'
  | 'AWAITING_APPROVAL'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED';

export type PaymentFailureCode =
  | 'INSUFFICIENT_FUNDS'
  | 'CUSTOMER_CANCELLED'
  | 'EXPIRED'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN';

export interface ClassifiedPaymentFailure {
  code: PaymentFailureCode;
  messageEn: string;
  messageSw: string;
  canRetry: boolean;
  suggestedActionEn: string;
  suggestedActionSw: string;
}

/**
 * Classifies a raw gateway or polling error into human-friendly bilingual feedback
 */
export function classifyPaymentFailure(
  errorMessage?: string | null,
  status?: string | null
): ClassifiedPaymentFailure {
  const text = `${errorMessage || ''} ${status || ''}`.toLowerCase();

  if (text.includes('insufficient') || text.includes('salio') || text.includes('not enough')) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      messageEn: 'Your mobile-money account has insufficient balance to complete this payment.',
      messageSw: 'Akaunti yako ya simu haina salio la kutosha kukamilisha malipo haya.',
      canRetry: true,
      suggestedActionEn: 'Top up your mobile-money account or choose another payment method.',
      suggestedActionSw: 'Weka salio kwenye akaunti yako au chagua njia nyingine ya malipo.',
    };
  }

  if (text.includes('cancel') || text.includes('rejected') || text.includes('user_declined') || text.includes('imekataliwa')) {
    return {
      code: 'CUSTOMER_CANCELLED',
      messageEn: 'The payment request was cancelled or declined on the mobile device.',
      messageSw: 'Ombi la malipo lilighairiwa au kukataliwa kwenye simu yako.',
      canRetry: true,
      suggestedActionEn: 'You can retry the request or choose a different payment method.',
      suggestedActionSw: 'Unaweza kujaribu tena ombi hili au kuchagua mtandao mwingine.',
    };
  }

  if (text.includes('expired') || text.includes('timeout') || text.includes('muda umekwisha')) {
    return {
      code: 'EXPIRED',
      messageEn: 'The payment request timed out before approval was received.',
      messageSw: 'Muda wa ombi la malipo umekwisha kabla ya uthibitisho kupokelewa.',
      canRetry: true,
      suggestedActionEn: 'Please retry and make sure to approve the prompt promptly.',
      suggestedActionSw: 'Tafadhali jaribu tena na uhakikishe unathibitisha haraka ujumbe unapotokea.',
    };
  }

  if (text.includes('network') || text.includes('connection') || text.includes('offline') || text.includes('mtandao')) {
    return {
      code: 'NETWORK_ERROR',
      messageEn: 'A network communication error occurred while connecting to the payment network.',
      messageSw: 'Hitilafu ya mawasiliano ya mtandao imetokea wakati wa kuunganisha na benki/mtandao.',
      canRetry: true,
      suggestedActionEn: 'Check your internet connection and try again.',
      suggestedActionSw: 'Angalia muunganisho wako wa intaneti kisha ujaribu tena.',
    };
  }

  if (text.includes('provider') || text.includes('gateway') || text.includes('service_unavailable')) {
    return {
      code: 'PROVIDER_ERROR',
      messageEn: 'The mobile carrier network is temporarily experiencing delays or maintenance.',
      messageSw: 'Mtandao wa simu una matatizo ya muda mfupi au marekebisho ya kiufundi.',
      canRetry: true,
      suggestedActionEn: 'Please try another mobile money provider or retry in a moment.',
      suggestedActionSw: 'Tafadhali jaribu mtandao mwingine wa simu au jaribu tena baada ya muda mfupi.',
    };
  }

  return {
    code: 'UNKNOWN',
    messageEn: errorMessage || 'An unexpected issue prevented this payment from completing.',
    messageSw: errorMessage || 'Hitilafu isiyotarajiwa imezuia malipo haya kukamilika.',
    canRetry: true,
    suggestedActionEn: 'You can retry or select another payment method.',
    suggestedActionSw: 'Unaweza kujaribu tena au kuchagua njia nyingine ya malipo.',
  };
}

/**
 * Generates an isolated attempt ID for a payment attempt
 */
export function generatePaymentAttemptId(): string {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.randomUUID) {
      return (globalThis as any).crypto.randomUUID();
    }
  } catch {}
  return `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Builds an isolated idempotency key scoped to user, target entity, and attempt ID
 */
export function generatePaymentIdempotencyKey(
  userId: string,
  targetId: string,
  attemptId: string
): string {
  return `pay_${userId}_${targetId}_${attemptId}`;
}
