import { useState, useEffect } from 'react';
import { BranchOperationsRepository } from '../repositories/branchOperations.repository';
import { BranchDeliveryZone } from '../types/domain';
import { FulfillmentType } from '../components/checkout/FulfillmentSelector';

export interface UseCheckoutDeliveryZonesParams {
  visible: boolean;
  fulfillment: FulfillmentType;
  effectiveBranchId?: string | null;
  serviceAreaName?: string;
}

export function useCheckoutDeliveryZones({
  visible,
  fulfillment,
  effectiveBranchId,
  serviceAreaName,
}: UseCheckoutDeliveryZonesParams) {
  const [deliveryZones, setDeliveryZones] = useState<BranchDeliveryZone[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<BranchDeliveryZone | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (visible && fulfillment === 'Delivery' && effectiveBranchId) {
      setIsLoadingZones(true);
      BranchOperationsRepository.getDeliveryZones(effectiveBranchId)
        .then((zones) => {
          if (!isMounted) return;
          setDeliveryZones(zones);
          if (zones.length > 0) {
            setSelectedDeliveryZone((prev) => {
              if (prev && zones.some((z) => z.id === prev.id)) {
                return zones.find((z) => z.id === prev.id) || zones[0];
              }
              if (serviceAreaName) {
                const match = zones.find(
                  (z) => z.zoneName.toLowerCase() === serviceAreaName.toLowerCase()
                );
                if (match) return match;
              }
              return zones[0];
            });
          } else {
            setSelectedDeliveryZone(null);
          }
        })
        .catch(() => {
          if (!isMounted) return;
          setDeliveryZones([]);
          setSelectedDeliveryZone(null);
        })
        .finally(() => {
          if (isMounted) setIsLoadingZones(false);
        });
    } else if (fulfillment !== 'Delivery') {
      setSelectedDeliveryZone(null);
    }
    return () => {
      isMounted = false;
    };
  }, [visible, fulfillment, effectiveBranchId, serviceAreaName]);

  return { deliveryZones, isLoadingZones, selectedDeliveryZone, setSelectedDeliveryZone };
}
