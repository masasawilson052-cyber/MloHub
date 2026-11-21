/**
 * MloHub Centralized Financial Authority & Fee Configuration
 *
 * Single source of truth for platform fee computation and formatting.
 * Mirrors PostgreSQL fee calculation functions exactly.
 */

export interface PublicFeeRules {
  serviceFeeBps: number;
  serviceFeeMinTzs: number;
  serviceFeeMaxTzs: number;
  deliveryMinOrderTzs: number;
  minimumOrderValueTzs: number;
  currency: string;
}

export const DEFAULT_FEE_RULES: PublicFeeRules = {
  serviceFeeBps: 300,
  serviceFeeMinTzs: 200,
  serviceFeeMaxTzs: 500,
  deliveryMinOrderTzs: 5000,
  minimumOrderValueTzs: 2000,
  currency: 'TZS',
};

export const FINANCIAL_CONFIG = {
  // Intra-city base delivery fee fallback (TZS)
  STANDARD_DELIVERY_FEE_TZS: 2500,

  // Global subtotal floor required for takeaway/dine-in checkout (TZS)
  MIN_ORDER_SUBTOTAL_TZS: 2000,

  // Currency code
  CURRENCY: 'TZS',
} as const;

export interface OrderFinancialBreakdown {
  subtotalTzs: number;
  serviceFeeTzs: number;
  deliveryFeeTzs: number;
  totalTzs: number;
  platformCommissionRate?: number;
  platformCommissionTzs?: number;
  netRestaurantPayoutTzs?: number;
}

/**
 * Authoritative customer service fee calculation.
 * Exactly mirrors PostgreSQL `compute_service_fee_tzs(subtotal, fulfillment)`:
 * - Return 0 for NULL or <= 0 subtotal
 * - Return 0 for any non-delivery type (Takeaway, Dine-in, Pickup, Reservation)
 * - Half-up integer division: raw = (subtotal * bps + 5000) / 10000
 * - Clamped between service_fee_min_tzs and service_fee_max_tzs
 * - Rounded to nearest 10 TZS: ((clamped + 5) / 10) * 10
 */
export function computeServiceFeeTzs(
  subtotalTzs: number | null | undefined,
  fulfillmentType?: string | null,
  rules: PublicFeeRules = DEFAULT_FEE_RULES
): number {
  if (!subtotalTzs || subtotalTzs <= 0) return 0;
  const norm = (fulfillmentType || '').trim().toLowerCase();
  if (norm !== 'delivery') return 0;

  const bps = rules.serviceFeeBps ?? 300;
  const min = rules.serviceFeeMinTzs ?? 200;
  const max = rules.serviceFeeMaxTzs ?? 500;

  const raw = Math.floor((Math.round(subtotalTzs) * bps + 5000) / 10000);
  const clamped = Math.min(Math.max(raw, min), max);
  const fee = Math.floor((clamped + 5) / 10) * 10;
  return fee;
}

/**
 * Calculates delivery minimum shortfall if subtotal is below the threshold.
 */
export function deliveryMinimumShortfall(
  subtotalTzs: number | null | undefined,
  rules: PublicFeeRules = DEFAULT_FEE_RULES,
  zoneMinimum?: number
): number {
  const safeSubtotal = Math.max(0, Math.round(subtotalTzs || 0));
  const effectiveMin = Math.max(rules.deliveryMinOrderTzs ?? 5000, zoneMinimum ?? 0);
  if (safeSubtotal >= effectiveMin) return 0;
  return effectiveMin - safeSubtotal;
}

/**
 * Exact canonical half-up integer commission calculation using basis points (no floating-point)
 * (grossTzs * basisPoints + 5000n) / 10000n
 */
export function calculateCommissionTzs(grossTzs: bigint, basisPoints: bigint): bigint {
  return (grossTzs * basisPoints + 5000n) / 10000n;
}

/**
 * Calculate order financials helper (for tests & admin previews).
 */
export function calculateOrderFinancials(
  subtotalTzs: number,
  options?: {
    commissionRate?: number;
    deliveryFeeTzs?: number;
    serviceFeeTzs?: number;
    isDineInOrTakeaway?: boolean;
    fulfillmentType?: string;
  }
): OrderFinancialBreakdown {
  const safeSubtotal = Math.max(0, Math.round(subtotalTzs));
  const fulfillment = options?.fulfillmentType || (options?.isDineInOrTakeaway ? 'Takeaway' : 'Delivery');

  const serviceFee = options?.serviceFeeTzs !== undefined
    ? Math.max(0, Math.round(options.serviceFeeTzs))
    : computeServiceFeeTzs(safeSubtotal, fulfillment);

  const deliveryFee = options?.isDineInOrTakeaway || fulfillment.toLowerCase() !== 'delivery'
    ? 0
    : options?.deliveryFeeTzs !== undefined
    ? Math.max(0, Math.round(options.deliveryFeeTzs))
    : FINANCIAL_CONFIG.STANDARD_DELIVERY_FEE_TZS;

  const totalTzs = safeSubtotal + serviceFee + deliveryFee;

  let platformCommissionTzs = 0;
  let netRestaurantPayoutTzs = safeSubtotal;

  if (options?.commissionRate !== undefined) {
    const rate = Math.max(0, Math.min(1, options.commissionRate));
    platformCommissionTzs = Math.round(safeSubtotal * rate);
    netRestaurantPayoutTzs = Math.max(0, safeSubtotal - platformCommissionTzs);
  }

  return {
    subtotalTzs: safeSubtotal,
    serviceFeeTzs: serviceFee,
    deliveryFeeTzs: deliveryFee,
    totalTzs,
    platformCommissionRate: options?.commissionRate,
    platformCommissionTzs,
    netRestaurantPayoutTzs,
  };
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
