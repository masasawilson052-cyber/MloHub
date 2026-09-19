/**
 * Tanzanian Mobile Telecom Phone Normalization & Carrier Detection
 * Strict E.164 standardization (+255) for NextSMS, Beem Africa, ClickPesa, Selcom, and Supabase.
 *
 * Tanzanian Telecom Prefixes (9-digit subscriber):
 * - Vodacom: 74, 75, 76
 * - Airtel: 68, 69, 78, 79
 * - Tigo / Mixx by Yas: 65, 67, 71
 * - Halotel: 61, 62
 * - TTCL: 73
 * - Zantel: 77
 *
 * SECURITY & ARCHITECTURAL NOTE:
 * Prefix detection is strictly for client UI hinting, badge display, and gateway routing
 * heuristics. It does NOT constitute a security boundary. Authoritative payment verification
 * and carrier resolution are performed exclusively server-side via payment gateway webhooks.
 */

export interface PhoneNormalizationResult {
  valid: boolean;
  e164: string; // e.g. "+255754357613"
  national: string; // e.g. "0754357613"
  display: string; // e.g. "+255 754 357 613"
  carrierApiDigits: string; // e.g. "255754357613" (Used by NextSMS / Beem)
  carrier: string; // e.g. "Vodacom M-Pesa"
  masked: string; // e.g. "+255 754 ••• 613"
  error?: string;
}

export type TanzanianCarrier =
  | 'Vodacom M-Pesa'
  | 'Airtel Money'
  | 'Mixx by Yas (Tigo)'
  | 'HaloPesa (Halotel)'
  | 'TTCL'
  | 'Zantel'
  | 'Unknown';

/**
 * Detect Tanzanian telecom carrier from 2-digit network prefix (e.g. 74, 75, 76)
 */
export function detectTanzanianCarrierFromPrefix(twoDigitPrefix: string): TanzanianCarrier {
  switch (twoDigitPrefix) {
    case '74':
    case '75':
    case '76':
      return 'Vodacom M-Pesa';
    case '68':
    case '69':
    case '78':
    case '79':
      return 'Airtel Money';
    case '65':
    case '67':
    case '71':
      return 'Mixx by Yas (Tigo)';
    case '61':
    case '62':
      return 'HaloPesa (Halotel)';
    case '73':
      return 'TTCL';
    case '77':
      return 'Zantel';
    default:
      return 'Unknown';
  }
}

/**
 * Normalize any input phone string to canonical Tanzanian telecom formats.
 * Accepts: "0754 357 613", "+255754357613", "255 754 357 613", "754357613", etc.
 */
export function normalizeTanzanianPhone(rawInput: string | null | undefined): PhoneNormalizationResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      valid: false,
      e164: '',
      national: '',
      display: '',
      carrierApiDigits: '',
      carrier: 'Unknown',
      masked: '',
      error: 'Phone number is required.',
    };
  }

  // Strip all non-digit characters except leading plus if any
  const hasLeadingPlus = rawInput.trim().startsWith('+');
  const digits = rawInput.replace(/[^0-9]/g, '');

  if (!digits) {
    return {
      valid: false,
      e164: '',
      national: '',
      display: '',
      carrierApiDigits: '',
      carrier: 'Unknown',
      masked: '',
      error: 'Phone number contains no valid digits.',
    };
  }

  let subscriber9: string = '';

  if (digits.startsWith('255') && digits.length === 12) {
    // 255754357613
    subscriber9 = digits.substring(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    // 0754357613
    subscriber9 = digits.substring(1);
  } else if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7'))) {
    // 754357613
    subscriber9 = digits;
  } else {
    return {
      valid: false,
      e164: hasLeadingPlus ? `+${digits}` : digits,
      national: digits,
      display: digits,
      carrierApiDigits: digits,
      carrier: 'Unknown',
      masked: digits,
      error: 'Invalid phone number length. Tanzanian numbers require 9 digits (e.g. 0754 357 613 or +255 754 357 613).',
    };
  }

  const prefix = subscriber9.substring(0, 2);
  const carrier = detectTanzanianCarrierFromPrefix(prefix);

  if (carrier === 'Unknown') {
    return {
      valid: false,
      e164: `+255${subscriber9}`,
      national: `0${subscriber9}`,
      display: `+255 ${prefix} ${subscriber9.substring(2, 5)} ${subscriber9.substring(5)}`,
      carrierApiDigits: `255${subscriber9}`,
      carrier: 'Unknown',
      masked: `+255 ${prefix} ••• ${subscriber9.substring(5)}`,
      error: `Unrecognized Tanzanian carrier prefix (0${prefix}). Supported prefixes start with 061-069 or 071-079.`,
    };
  }

  const e164 = `+255${subscriber9}`;
  const national = `0${subscriber9}`;
  const display = `+255 ${prefix} ${subscriber9.substring(2, 5)} ${subscriber9.substring(5)}`;
  const carrierApiDigits = `255${subscriber9}`;
  const masked = `+255 ${prefix} ••• ${subscriber9.substring(5)}`;

  return {
    valid: true,
    e164,
    national,
    display,
    carrierApiDigits,
    carrier,
    masked,
  };
}

/**
 * Convenience helper to check if a phone string is a valid Tanzanian number
 */
export function isValidTanzanianPhone(phone: string | null | undefined): boolean {
  return normalizeTanzanianPhone(phone).valid;
}

/**
 * Convenience helper to format a phone for display
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const norm = normalizeTanzanianPhone(phone);
  return norm.valid ? norm.display : (phone || '');
}

/**
 * Convenience helper to detect carrier name
 */
export function detectTanzanianCarrier(phone: string | null | undefined): string {
  return normalizeTanzanianPhone(phone).carrier;
}
