/**
 * MloHub Centralized Financial Authority & Fee Configuration
 *
 * Single source of truth for platform commission rates, service fees, and
 * delivery pricing. Client and server services must reference this module
 * rather than hardcoding inline percentages or fees.
 */

export const FINANCIAL_CONFIG = {
  // Standard platform commission charged to restaurants on food subtotal (10%)
  DEFAULT_PLATFORM_COMMISSION_RATE: 0.10,

  // Fixed customer service fee per order (TZS)
  SERVICE_FEE_TZS: 1500,

  // Standard intra-city base delivery fee (TZS)
  STANDARD_DELIVERY_FEE_TZS: 2500,

  // Minimum order subtotal required for checkout (TZS)
  MIN_ORDER_SUBTOTAL_TZS: 2000,

  // Currency code
  CURRENCY: 'TZS',
} as const;

export interface OrderFinancialBreakdown {
  subtotalTzs: number;
  serviceFeeTzs: number;
  deliveryFeeTzs: number;
  totalTzs: number;
  platformCommissionRate: number;
  platformCommissionTzs: number;
  netRestaurantPayoutTzs: number;
}

/**
 * Authoritative financial breakdown calculation.
 *
 * Total Paid by Customer = Subtotal + Service Fee + Delivery Fee
 * Platform Commission = Subtotal * Commission Rate
 * Net Restaurant Payout = Subtotal - Platform Commission
 */
export function calculateOrderFinancials(
  subtotalTzs: number,
  options?: {
    commissionRate?: number;
    deliveryFeeTzs?: number;
    serviceFeeTzs?: number;
    isDineInOrTakeaway?: boolean;
  }
): OrderFinancialBreakdown {
  const safeSubtotal = Math.max(0, Math.round(subtotalTzs));
  const rate = options?.commissionRate !== undefined
    ? Math.max(0, Math.min(1, options.commissionRate))
    : FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE;

  const serviceFee = options?.serviceFeeTzs !== undefined
    ? Math.max(0, Math.round(options.serviceFeeTzs))
    : FINANCIAL_CONFIG.SERVICE_FEE_TZS;

  const deliveryFee = options?.isDineInOrTakeaway
    ? 0
    : options?.deliveryFeeTzs !== undefined
    ? Math.max(0, Math.round(options.deliveryFeeTzs))
    : FINANCIAL_CONFIG.STANDARD_DELIVERY_FEE_TZS;

  const totalTzs = safeSubtotal + serviceFee + deliveryFee;
  const platformCommissionTzs = Math.round(safeSubtotal * rate);
  const netRestaurantPayoutTzs = Math.max(0, safeSubtotal - platformCommissionTzs);

  return {
    subtotalTzs: safeSubtotal,
    serviceFeeTzs: serviceFee,
    deliveryFeeTzs: deliveryFee,
    totalTzs,
    platformCommissionRate: rate,
    platformCommissionTzs,
    netRestaurantPayoutTzs,
  };
}

/**
 * Exact canonical half-up integer commission calculation using basis points (no floating-point)
 * (grossTzs * basisPoints + 5000n) / 10000n
 */
export function calculateCommissionTzs(grossTzs: bigint, basisPoints: bigint): bigint {
  return (grossTzs * basisPoints + 5000n) / 10000n;
}

/**
 * Format currency in Tanzanian Shillings safely from string, bigint, or safe number
 */
export function formatTzs(amount: string | bigint | number): string {
  let bi: bigint;
  if (typeof amount === 'bigint') {
    bi = amount;
  } else if (typeof amount === 'string') {
    bi = BigInt(amount.replace(/[^0-9-]/g, '') || '0');
  } else {
    if (!Number.isSafeInteger(amount)) {
      throw new Error(`[formatTzs] Unsafe integer number provided: ${amount}`);
    }
    bi = BigInt(Math.round(amount));
  }
  return `${bi.toLocaleString()} TZS`;
}
