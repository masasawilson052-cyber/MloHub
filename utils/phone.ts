/**
 * Shared Tanzania Phone Normalization Utility
 * Supports format: +255XXXXXXXXX (9 digits following +255, starting with 6 or 7)
 */

export function normalizeTanzaniaPhone(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');

  // 07XXXXXXXX or 06XXXXXXXX (10 digits)
  if (/^0[67]\d{8}$/.test(digits)) {
    return `+255${digits.slice(1)}`;
  }

  // 7XXXXXXXX or 6XXXXXXXX (9 digits)
  if (/^[67]\d{8}$/.test(digits)) {
    return `+255${digits}`;
  }

  // 2557XXXXXXXX or 2556XXXXXXXX (12 digits)
  if (/^255[67]\d{8}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

export function isValidTanzaniaPhone(input: string): boolean {
  return normalizeTanzaniaPhone(input) !== null;
}

export function formatTanzaniaPhoneDisplay(input: string): string {
  const normalized = normalizeTanzaniaPhone(input);
  if (!normalized) return input;
  // +255 754 000 111
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 10)} ${normalized.slice(10)}`;
}
