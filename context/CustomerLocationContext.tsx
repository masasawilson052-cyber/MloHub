import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { CustomerSavedAddress, ServiceCity, ServiceArea } from '../types/domain';
import { CustomerAddressesRepository } from '../repositories/customerAddresses.repository';
import { useAuth } from './AuthContext';

export interface CustomerLocationState {
  cityId?: string;
  cityName?: string;
  serviceAreaId?: string;
  serviceAreaName?: string;
  savedAddressId?: string;
  addressLine?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  source: 'DEVICE' | 'SAVED_ADDRESS' | 'MANUAL_AREA' | 'NONE';
}

interface CustomerLocationContextType {
  location: CustomerLocationState;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  openLocationSelector: () => void;
  selectSavedAddress: (address: CustomerSavedAddress) => void;
  selectServiceArea: (city: ServiceCity, area: ServiceArea) => void;
  useDeviceLocation: () => Promise<boolean>;
  clearLocation: () => void;
  refreshDefaultAddress: () => Promise<void>;
  isLoadingLocation: boolean;
  locationError: string | null;
}

const DEFAULT_DAR_LOCATION: CustomerLocationState = {
  cityName: 'Dar es Salaam',
  serviceAreaName: 'Mikocheni',
  source: 'MANUAL_AREA',
};

const CustomerLocationContext = createContext<CustomerLocationContextType | undefined>(undefined);

export const CustomerLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useState<CustomerLocationState>(DEFAULT_DAR_LOCATION);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Refresh default saved address for authenticated customer
  const refreshDefaultAddress = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const addresses = await CustomerAddressesRepository.list(user.id);
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
      if (defaultAddr) {
        setLocation({
          savedAddressId: defaultAddr.id,
          cityName: defaultAddr.city,
          serviceAreaName: defaultAddr.areaName || defaultAddr.city,
          addressLine: defaultAddr.streetAddress,
          landmark: defaultAddr.deliveryInstructions ?? undefined,
          latitude: defaultAddr.latitude ?? undefined,
          longitude: defaultAddr.longitude ?? undefined,
          source: 'SAVED_ADDRESS',
        });
      }
    } catch (err: any) {
      console.warn('[CustomerLocationContext] Could not load saved address:', err.message);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    refreshDefaultAddress();
  }, [refreshDefaultAddress]);

  const openLocationSelector = useCallback(() => {
    setIsLocationModalOpen(true);
  }, []);

  const selectSavedAddress = useCallback((address: CustomerSavedAddress) => {
    setLocation({
      savedAddressId: address.id,
      cityName: address.city,
      serviceAreaName: address.areaName || address.city,
      addressLine: address.streetAddress,
      landmark: address.deliveryInstructions ?? undefined,
      latitude: address.latitude ?? undefined,
      longitude: address.longitude ?? undefined,
      source: 'SAVED_ADDRESS',
    });
    setIsLocationModalOpen(false);
  }, []);

  const selectServiceArea = useCallback((city: ServiceCity, area: ServiceArea) => {
    setLocation({
      cityId: city.id,
      cityName: city.name,
      serviceAreaId: area.id,
      serviceAreaName: area.name,
      latitude: area.centerLatitude ?? undefined,
      longitude: area.centerLongitude ?? undefined,
      source: 'MANUAL_AREA',
    });
    setIsLocationModalOpen(false);
  }, []);

  const useDeviceLocation = useCallback(async (): Promise<boolean> => {
    setIsLoadingLocation(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied');
        setIsLoadingLocation(false);
        return false;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation((prev) => ({
        ...prev,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        source: 'DEVICE',
      }));

      setIsLoadingLocation(false);
      setIsLocationModalOpen(false);
      return true;
    } catch (err: any) {
      console.warn('[CustomerLocationContext] Device location error:', err.message);
      setLocationError(err.message || 'Could not determine device location');
      setIsLoadingLocation(false);
      return false;
    }
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(DEFAULT_DAR_LOCATION);
  }, []);

  return (
    <CustomerLocationContext.Provider
      value={{
        location,
        isLocationModalOpen,
        setIsLocationModalOpen,
        openLocationSelector,
        selectSavedAddress,
        selectServiceArea,
        useDeviceLocation,
        clearLocation,
        refreshDefaultAddress,
        isLoadingLocation,
        locationError,
      }}
    >
      {children}
    </CustomerLocationContext.Provider>
  );
};

export const useCustomerLocation = (): CustomerLocationContextType => {
  const ctx = useContext(CustomerLocationContext);
  if (!ctx) {
    throw new Error('useCustomerLocation must be used within a CustomerLocationProvider');
  }
  return ctx;
};
