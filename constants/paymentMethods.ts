/**
 * Canonical Tanzanian Mobile-Money Payment Methods for MloHub
 *
 * Exclusively defines the 4 primary mobile-money carriers in Tanzania:
 * - Vodacom M-Pesa
 * - Airtel Money
 * - Mixx by Yas (Tigo Pesa / Yas)
 * - Halotel HaloPesa
 *
 * Note: CARD, CASH_ON_DELIVERY, and EZYPESA are excluded from primary checkout.
 */

export type MobileMoneyMethodCode =
  | 'MPESA'
  | 'AIRTEL_MONEY'
  | 'MIXX_BY_YAS'
  | 'HALOPESA';

export interface MobileMoneyMethodConfig {
  id: MobileMoneyMethodCode;
  displayName: string;
  carrierName: string;
  shortName: string;
  ussdCode: string;
  ussdGuidanceEn: string;
  ussdGuidanceSw: string;
  phonePrefixes: string[];
  accentColor: string;
  logoFilename: string;
}

export const PAYMENT_SECURITY_PIN_NOTICE_EN =
  'Security Notice: MloHub will never ask for or store your mobile-money PIN. Enter your PIN exclusively on your telecom pop-up or official USSD prompt.';

export const PAYMENT_SECURITY_PIN_NOTICE_SW =
  'Usalama wa Mteja: MloHub haitawahi kukuomba au kuhifadhi PIN yako ya simu. Weka PIN yako pekee kwenye ujumbe rasmi wa mtandao wako wa simu.';

export const MOBILE_MONEY_METHODS: MobileMoneyMethodConfig[] = [
  {
    id: 'MPESA',
    displayName: 'M-Pesa',
    carrierName: 'Vodacom M-Pesa',
    shortName: 'M-Pesa',
    ussdCode: '*150*00#',
    ussdGuidanceEn: 'Look for the Vodacom M-Pesa prompt on your phone and enter your PIN to approve.',
    ussdGuidanceSw: 'Angalia ujumbe wa Vodacom M-Pesa kwenye simu yako kisha weka PIN kukamilisha.',
    phonePrefixes: ['074', '075', '076', '25574', '25575', '25576'],
    accentColor: '#E60000',
    logoFilename: 'mpesa.png',
  },
  {
    id: 'AIRTEL_MONEY',
    displayName: 'Airtel Money',
    carrierName: 'Airtel Money',
    shortName: 'Airtel',
    ussdCode: '*150*60#',
    ussdGuidanceEn: 'Look for the Airtel Money prompt on your phone and enter your PIN to approve.',
    ussdGuidanceSw: 'Angalia ujumbe wa Airtel Money kwenye simu yako kisha weka PIN kukamilisha.',
    phonePrefixes: ['068', '069', '078', '25568', '25569', '25578'],
    accentColor: '#ED1B24',
    logoFilename: 'airtel-money.png',
  },
  {
    id: 'MIXX_BY_YAS',
    displayName: 'Mixx by Yas',
    carrierName: 'Mixx by Yas (Tigo)',
    shortName: 'Mixx',
    ussdCode: '*150*01#',
    ussdGuidanceEn: 'Look for the Mixx by Yas prompt on your phone and enter your PIN to approve.',
    ussdGuidanceSw: 'Angalia ujumbe wa Mixx by Yas kwenye simu yako kisha weka PIN kukamilisha.',
    phonePrefixes: ['065', '067', '071', '077', '25565', '25567', '25571', '25577'],
    accentColor: '#007A87',
    logoFilename: 'mixx-by-yas.png',
  },
  {
    id: 'HALOPESA',
    displayName: 'HaloPesa',
    carrierName: 'Halotel HaloPesa',
    shortName: 'HaloPesa',
    ussdCode: '*150*88#',
    ussdGuidanceEn: 'Look for the HaloPesa prompt on your phone and enter your PIN to approve.',
    ussdGuidanceSw: 'Angalia ujumbe wa HaloPesa kwenye simu yako kisha weka PIN kukamilisha.',
    phonePrefixes: ['062', '25562'],
    accentColor: '#FF6600',
    logoFilename: 'halopesa.png',
  },
];

/**
 * Find mobile money configuration by method code
 */
export function getMobileMoneyMethodConfig(
  code: string | undefined | null
): MobileMoneyMethodConfig | undefined {
  if (!code) return undefined;
  const normalized = code.toUpperCase().trim();
  return MOBILE_MONEY_METHODS.find(
    (m) => m.id === normalized || m.displayName.toUpperCase() === normalized
  );
}

/**
 * Detect carrier recommendation from Tanzanian phone number
 */
export function detectCarrierFromPhone(
  phone: string | undefined | null
): MobileMoneyMethodCode | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^0-9]/g, '');
  for (const method of MOBILE_MONEY_METHODS) {
    if (method.phonePrefixes.some((pfx) => digits.startsWith(pfx) || digits.startsWith(`+${pfx}`))) {
      return method.id;
    }
  }
  return undefined;
}
