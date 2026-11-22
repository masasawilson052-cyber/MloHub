import { useState, useEffect } from 'react';
import { BranchOperationsRepository } from '../repositories/branchOperations.repository';
import { CartItem } from '../services/cart/cartCore';

export interface BranchDeliveryCapability {
  deliveryPricingMode: 'ROUTE_DISTANCE' | 'FIXED_ZONE';
  lowestDeliveryFeeTzs: number | null;
  supportsDelivery: boolean;
}

export function useBranchDeliveryCapability(
  branchId: string | null,
  items: CartItem[]
): BranchDeliveryCapability {
  const [deliveryPricingMode, setDeliveryPricingMode] = useState<'ROUTE_DISTANCE' | 'FIXED_ZONE'>('ROUTE_DISTANCE');
  const [lowestDeliveryFeeTzs, setLowestDeliveryFeeTzs] = useState<number | null>(null);
  const [supportsDelivery, setSupportsDelivery] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const targetBranchId = branchId || (items.length > 0 ? items[0].branchId : null);
    if (!targetBranchId) {
      setLowestDeliveryFeeTzs(null);
      setSupportsDelivery(true);
      setDeliveryPricingMode('ROUTE_DISTANCE');
      return;
    }

    Promise.all([
      BranchOperationsRepository.getBranchDeliveryPricing(targetBranchId).catch(() => ({
        pricingMode: 'ROUTE_DISTANCE' as const,
        baseFeeTzs: 2000,
        minimumFeeTzs: 2000,
      })),
      BranchOperationsRepository.getDeliveryZones(targetBranchId).catch(() => []),
    ]).then(([pricing, zones]) => {
      if (!isMounted) return;
      const mode = pricing.pricingMode || 'ROUTE_DISTANCE';
      setDeliveryPricingMode(mode);

      const activeZones = (zones || []).filter((z) => z.isActive !== false);
      const branchSupportsDel = mode === 'ROUTE_DISTANCE' || activeZones.length > 0;
      setSupportsDelivery(branchSupportsDel);

      if (mode === 'FIXED_ZONE') {
        if (activeZones.length > 0) {
          const minZone = Math.min(...activeZones.map((z) => z.feeTzs));
          setLowestDeliveryFeeTzs(minZone);
        } else {
          setLowestDeliveryFeeTzs(null);
        }
      } else {
        const base = pricing.baseFeeTzs;
        setLowestDeliveryFeeTzs(typeof base === 'number' && base > 0 ? base : null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [branchId, items]);

  return { deliveryPricingMode, lowestDeliveryFeeTzs, supportsDelivery };
}
