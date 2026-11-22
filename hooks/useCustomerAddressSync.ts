import { useState, useEffect, useMemo } from 'react';
import { CustomerAddressesRepository } from '../repositories/customerAddresses.repository';
import { CustomerSavedAddress } from '../types/domain';

export interface UseCustomerAddressSyncParams {
  visible: boolean;
  userId?: string;
  initialLocation: string;
  customerLocation: {
    savedAddressId?: string;
    addressLine?: string;
    landmark?: string;
    serviceAreaName?: string;
    latitude?: number;
    longitude?: number;
  };
}

export function useCustomerAddressSync({
  visible,
  userId,
  initialLocation,
  customerLocation,
}: UseCustomerAddressSyncParams) {
  const [savedAddresses, setSavedAddresses] = useState<CustomerSavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(customerLocation.savedAddressId || null);
  const [deliveryAddress, setDeliveryAddress] = useState(
    customerLocation.addressLine
      ? `${customerLocation.addressLine}${customerLocation.landmark ? ` (${customerLocation.landmark})` : ''}${customerLocation.serviceAreaName ? `, ${customerLocation.serviceAreaName}` : ''}`
      : initialLocation
  );

  useEffect(() => {
    let isMounted = true;
    if (visible && userId) {
      CustomerAddressesRepository.list(userId)
        .then((addrs) => {
          if (!isMounted) return;
          setSavedAddresses(addrs);
          if (!deliveryAddress && addrs.length > 0) {
            const def = addrs.find((a) => a.isDefault) || addrs[0];
            setSelectedAddressId(def.id);
            setDeliveryAddress(
              `${def.streetAddress}${def.deliveryInstructions ? ` (${def.deliveryInstructions})` : ''}${def.areaName ? `, ${def.areaName}` : ''}`
            );
          }
        })
        .catch((err) => console.warn('useCustomerAddressSync: Failed to load saved addresses', err));
    }
    return () => {
      isMounted = false;
    };
  }, [visible, userId]);

  useEffect(() => {
    if (!deliveryAddress && customerLocation.addressLine) {
      setDeliveryAddress(
        `${customerLocation.addressLine}${customerLocation.landmark ? ` (${customerLocation.landmark})` : ''}${customerLocation.serviceAreaName ? `, ${customerLocation.serviceAreaName}` : ''}`
      );
    }
  }, [customerLocation]);

  const destinationCoords = useMemo(() => {
    if (selectedAddressId) {
      const selected = savedAddresses.find((a) => a.id === selectedAddressId);
      if (selected?.latitude != null && selected?.longitude != null) {
        return { latitude: selected.latitude, longitude: selected.longitude };
      }
    }
    if (customerLocation.latitude != null && customerLocation.longitude != null) {
      return { latitude: customerLocation.latitude, longitude: customerLocation.longitude };
    }
    return null;
  }, [selectedAddressId, savedAddresses, customerLocation.latitude, customerLocation.longitude]);

  return {
    savedAddresses,
    selectedAddressId,
    setSelectedAddressId,
    deliveryAddress,
    setDeliveryAddress,
    destinationCoords,
  };
}
