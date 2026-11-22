/**
 * Shared Tanzania Phone Normalization & Formatting Utility
 *
 * Requirements:
 * - Accept 07XXXXXXXX, 7XXXXXXXX, 2557XXXXXXXX, and +2557XXXXXXXX (and 06 numbers).
 * - Format input as 07XX XXX XXX as user types.
 * - Validate exactly 10 local digits.
 * - Format for payment gateways as 255XXXXXXXXX (12 digits).
 */

/**
 * Normalizes input phone to 10 local digits starting with 06 or 07 (e.g. 0754123456).
 */
export function normalizeLocalTanzaniaDigits(input: string | undefined | null): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('255')) {
    digits = '0' + digits.slice(3);
  } else if (!digits.startsWith('0') && (digits.startsWith('6') || digits.startsWith('7'))) {
    digits = '0' + digits;
  }

  return digits;
}

/**
 * Validates that input represents exactly 10 Tanzanian mobile digits starting with 06 or 07.
 */
export function isValidLocalTanzaniaPhone(input: string | undefined | null): boolean {
  if (!input) return false;
  const digits = normalizeLocalTanzaniaDigits(input);
  return /^0[67]\d{8}$/.test(digits);
}

/**
 * Formats phone input as user types in 07XX XXX XXX pattern.
 */
export function formatAsYouTypeTanzaniaPhone(input: string): string {
  if (!input) return '';
  const digits = normalizeLocalTanzaniaDigits(input).slice(0, 10);

  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
}

/**
 * Formats phone for payment gateways: 255XXXXXXXXX (12 digits, no leading +).
 */
export function toGatewayTanzaniaPhone(input: string | undefined | null): string | null {
  if (!isValidLocalTanzaniaPhone(input)) return null;
  const local = normalizeLocalTanzaniaDigits(input);
  return `255${local.slice(1)}`;
}

/**
 * Legacy compatibility: formats to +255XXXXXXXXX (E.164)
 */
export function normalizeTanzaniaPhone(input: string): string | null {
  const gateway = toGatewayTanzaniaPhone(input);
  return gateway ? `+${gateway}` : null;
}

export function isValidTanzaniaPhone(input: string): boolean {
  return isValidLocalTanzaniaPhone(input);
}

export function formatTanzaniaPhoneDisplay(input: string): string {
  const normalized = normalizeTanzaniaPhone(input);
  if (!normalized) return input;
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 10)} ${normalized.slice(10)}`;
}
