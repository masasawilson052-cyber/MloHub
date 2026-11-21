import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PublicFeeRules, DEFAULT_FEE_RULES } from '../config/platformFees';

let cachedFeeRules: PublicFeeRules | null = null;
let inFlightPromise: Promise<PublicFeeRules> | null = null;

/**
 * Authoritative load of public platform fee rules from PostgreSQL RPC `get_public_fee_rules`.
 * Caches once per app start and safely falls back to DEFAULT_FEE_RULES.
 */
export async function fetchPublicFeeRules(forceRefresh: boolean = false): Promise<PublicFeeRules> {
  if (!forceRefresh && cachedFeeRules) {
    return cachedFeeRules;
  }

  if (inFlightPromise && !forceRefresh) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    if (!isSupabaseConfigured()) {
      cachedFeeRules = DEFAULT_FEE_RULES;
      return DEFAULT_FEE_RULES;
    }

    try {
      const { data, error } = await supabase.rpc('get_public_fee_rules');
      if (error || !data) {
        console.warn('Failed to load get_public_fee_rules, using DEFAULT_FEE_RULES:', error?.message);
        cachedFeeRules = DEFAULT_FEE_RULES;
        return DEFAULT_FEE_RULES;
      }

      const rules: PublicFeeRules = {
        serviceFeeBps: Number(data.service_fee_bps ?? DEFAULT_FEE_RULES.serviceFeeBps),
        serviceFeeMinTzs: Number(data.service_fee_min_tzs ?? DEFAULT_FEE_RULES.serviceFeeMinTzs),
        serviceFeeMaxTzs: Number(data.service_fee_max_tzs ?? DEFAULT_FEE_RULES.serviceFeeMaxTzs),
        deliveryMinOrderTzs: Number(data.delivery_min_order_tzs ?? DEFAULT_FEE_RULES.deliveryMinOrderTzs),
        minimumOrderValueTzs: Number(data.minimum_order_value_tzs ?? DEFAULT_FEE_RULES.minimumOrderValueTzs),
        currency: String(data.currency || DEFAULT_FEE_RULES.currency),
      };

      cachedFeeRules = rules;
      return rules;
    } catch (err: any) {
      console.warn('Exception in fetchPublicFeeRules, using DEFAULT_FEE_RULES:', err?.message);
      cachedFeeRules = DEFAULT_FEE_RULES;
      return DEFAULT_FEE_RULES;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Returns cached rules synchronously, or DEFAULT_FEE_RULES if not yet loaded.
 */
export function getFeeRulesSync(): PublicFeeRules {
  return cachedFeeRules || DEFAULT_FEE_RULES;
}

/**
 * React hook to access public fee rules.
 */
export function useFeeRules(): {
  feeRules: PublicFeeRules;
  loading: boolean;
  refreshFeeRules: () => Promise<void>;
} {
  const [feeRules, setFeeRules] = useState<PublicFeeRules>(cachedFeeRules || DEFAULT_FEE_RULES);
  const [loading, setLoading] = useState<boolean>(!cachedFeeRules);

  const refreshFeeRules = useCallback(async () => {
    setLoading(true);
    try {
      const updated = await fetchPublicFeeRules(true);
      setFeeRules(updated);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchPublicFeeRules().then((rules) => {
      if (isMounted) {
        setFeeRules(rules);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return { feeRules, loading, refreshFeeRules };
}
