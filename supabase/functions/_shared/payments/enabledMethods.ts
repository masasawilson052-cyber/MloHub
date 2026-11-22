import { readPaymentEnvironment } from './environment.ts';
import type { PaymentMethodCode } from './paymentTypes.ts';

/**
 * Returns canonical list of enabled payment method codes in strict priority order:
 * 1. MPESA (Vodacom M-Pesa)
 * 2. MIXX_BY_YAS (Mixx by Yas)
 * 3. AIRTEL_MONEY (Airtel Money)
 * 4. HALOPESA (HaloPesa)
 * 5. Banks (NMB, CRDB) - included strictly when ALLOW_BANK_PAYMENTS=true
 */
export function getEnabledPaymentMethodCodes(): PaymentMethodCode[] {
  const allowBanks = readPaymentEnvironment('ALLOW_BANK_PAYMENTS') === 'true';

  const methods: PaymentMethodCode[] = [
    'MPESA',
    'MIXX_BY_YAS',
    'AIRTEL_MONEY',
    'HALOPESA',
  ];

  if (allowBanks) {
    methods.push('NMB', 'CRDB');
  }

  return methods;
}

/**
 * Returns true if the specified method code is enabled in this environment.
 */
export function isPaymentMethodEnabled(code: string | undefined | null): boolean {
  if (!code) return false;
  const normalized = code.toUpperCase().trim() as PaymentMethodCode;
  return getEnabledPaymentMethodCodes().includes(normalized);
}
