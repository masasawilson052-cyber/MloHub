/**
 * Tanzania Mobile Network Prefixes & Wallet Configuration
 *
 * Source: TCRA (Tanzania Communications Regulatory Authority) National Numbering Plan.
 * Note: Mobile Number Portability (MNP) is live across Tanzania, so prefix detection
 * is strictly an intelligent recommendation. Customers can freely override the suggestion.
 */

import { MobileMoneyMethodCode } from '../constants/paymentMethods';

export interface WalletConfig {
  methodCode: MobileMoneyMethodCode;
  walletName: string;
  carrierName: string;
  shortName: string;
  prefixes: string[]; // 3-digit local prefixes
  ussdFallbackCode?: string;
  isUssdConfirmed: boolean;
  notes?: string;
}

export const TCRA_WALLET_CONFIGS: Record<MobileMoneyMethodCode, WalletConfig> = {
  MPESA: {
    methodCode: 'MPESA',
    walletName: 'M-Pesa',
    carrierName: 'Vodacom Tanzania',
    shortName: 'M-Pesa',
    prefixes: ['074', '075', '076', '079'],
    ussdFallbackCode: '*150*00#',
    isUssdConfirmed: true,
  },
  MIXX_BY_YAS: {
    methodCode: 'MIXX_BY_YAS',
    walletName: 'Mixx by Yas',
    carrierName: 'MIC Tanzania (Yas/Tigo)',
    shortName: 'Mixx',
    prefixes: ['065', '067', '071', '077'], // 077 formerly Zantel
    ussdFallbackCode: '*150*01#',
    isUssdConfirmed: true,
  },
  AIRTEL_MONEY: {
    methodCode: 'AIRTEL_MONEY',
    walletName: 'Airtel Money',
    carrierName: 'Airtel Tanzania',
    shortName: 'Airtel',
    prefixes: ['068', '069', '078'],
    ussdFallbackCode: '*150*60#',
    isUssdConfirmed: true,
  },
  HALOPESA: {
    methodCode: 'HALOPESA',
    walletName: 'HaloPesa',
    carrierName: 'Viettel Tanzania (Halotel)',
    shortName: 'HaloPesa',
    prefixes: ['061', '062'],
    ussdFallbackCode: '*150*88#',
    // HaloPesa USSD code is flagged as unconfirmed: verify with gateway/Halotel before launch
    isUssdConfirmed: false,
    notes: 'Verify with gateway/Halotel before launch',
  },
  CRDB: {
    methodCode: 'CRDB',
    walletName: 'CRDB SimBanking',
    carrierName: 'CRDB Bank',
    shortName: 'CRDB',
    prefixes: [],
    ussdFallbackCode: '*150*03#',
    isUssdConfirmed: false,
    notes: 'Verify with bank/gateway before launch',
  },
  NMB: {
    methodCode: 'NMB',
    walletName: 'NMB Mkononi',
    carrierName: 'NMB Bank',
    shortName: 'NMB',
    prefixes: [],
    ussdFallbackCode: '*150*66#',
    isUssdConfirmed: false,
    notes: 'Verify with bank/gateway before launch',
  },
};

/**
 * Detect carrier wallet suggestion from input phone number
 * Returns undefined for non-mobile or unmapped prefixes (e.g. 073 TTCL, 066 Smile, 064, 072)
 */
export function detectWalletFromPhone(phone: string | undefined | null): MobileMoneyMethodCode | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');

  let local = digits;
  if (local.startsWith('255')) {
    local = '0' + local.slice(3);
  } else if (!local.startsWith('0') && (local.startsWith('6') || local.startsWith('7'))) {
    local = '0' + local;
  }

  if (local.length < 3) return undefined;
  const prefix3 = local.slice(0, 3);

  // Excluded or unmapped explicitly
  if (['073', '066', '064', '072'].includes(prefix3)) {
    return undefined;
  }

  for (const config of Object.values(TCRA_WALLET_CONFIGS)) {
    if (config.prefixes.includes(prefix3)) {
      return config.methodCode;
    }
  }

  return undefined;
}

/**
 * Get confirmed USSD fallback code for wallet.
 * Returns undefined if unconfirmed (e.g. HaloPesa pending verification).
 */
export function getUssdFallbackCode(methodCode: MobileMoneyMethodCode): string | undefined {
  const config = TCRA_WALLET_CONFIGS[methodCode];
  if (!config || !config.isUssdConfirmed) {
    return undefined;
  }
  return config.ussdFallbackCode;
}
