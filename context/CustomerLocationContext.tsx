import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { CustomerSavedAddress, ServiceCity, ServiceArea } from '../types/domain';
import { CustomerAddressesRepository } from '../repositories/customerAddresses.repository';
import { useAuth } from './AuthContext';
import {
  CustomerLocationState,
  ACTIVE_LOCATION_STORAGE_KEY,
  DEFAULT_DAR_LOCATION,
  resolvePreciseNeighborhood,
  computeDistanceKm,
  KNOWN_TANZANIA_AREAS,
  GeoAreaCandidate,
} from '../utils/customerLocationResolver';

export {
  CustomerLocationState,
  ACTIVE_LOCATION_STORAGE_KEY,
  DEFAULT_DAR_LOCATION,
  resolvePreciseNeighborhood,
  computeDistanceKm,
  KNOWN_TANZANIA_AREAS,
  GeoAreaCandidate,
};

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

const CustomerLocationContext = createContext<CustomerLocationContextType | undefined>(undefined);

export const CustomerLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useState<CustomerLocationState>(DEFAULT_DAR_LOCATION);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const saveLocationToStorage = useCallback(async (loc: CustomerLocationState) => {
    try {
      await AsyncStorage.setItem(ACTIVE_LOCATION_STORAGE_KEY, JSON.stringify(loc));
    } catch (err: any) {
      console.warn('[CustomerLocationContext] Failed to persist location:', err?.message);
    }
  }, []);

  // Hydrate cached active location on initial mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored) as CustomerLocationState;
          if (parsed && parsed.serviceAreaName) {
            setLocation(parsed);
          }
        }
      } catch (err: any) {
        console.warn('[CustomerLocationContext] Error loading cached location:', err?.message);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Refresh default saved address for authenticated customer
  // CRITICAL: NEVER overwrite device-detected location (source === 'DEVICE')
  const refreshDefaultAddress = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const addresses = await CustomerAddressesRepository.list(user.id);
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
      if (defaultAddr) {
        setLocation((current) => {
          // If the user has already activated device GPS, preserve it
          if (current.source === 'DEVICE') {
            return current;
          }
          const nextState: CustomerLocationState = {
            savedAddressId: defaultAddr.id,
            cityName: defaultAddr.city,
            serviceAreaName: defaultAddr.areaName || defaultAddr.city,
            addressLine: defaultAddr.streetAddress,
            landmark: defaultAddr.deliveryInstructions ?? undefined,
            latitude: defaultAddr.latitude ?? undefined,
            longitude: defaultAddr.longitude ?? undefined,
            source: 'SAVED_ADDRESS',
          };
          saveLocationToStorage(nextState);
          return nextState;
        });
      }
    } catch (err: any) {
      console.warn('[CustomerLocationContext] Could not load saved address:', err.message);
    }
  }, [isAuthenticated, user?.id, saveLocationToStorage]);

  useEffect(() => {
    refreshDefaultAddress();
  }, [refreshDefaultAddress]);

  const openLocationSelector = useCallback(() => {
    setIsLocationModalOpen(true);
  }, []);

  const selectSavedAddress = useCallback((address: CustomerSavedAddress) => {
    const next: CustomerLocationState = {
      savedAddressId: address.id,
      cityName: address.city,
      serviceAreaName: address.areaName || address.city,
      addressLine: address.streetAddress,
      landmark: address.deliveryInstructions ?? undefined,
      latitude: address.latitude ?? undefined,
      longitude: address.longitude ?? undefined,
      source: 'SAVED_ADDRESS',
    };
    setLocation(next);
    saveLocationToStorage(next);
    setIsLocationModalOpen(false);
  }, [saveLocationToStorage]);

  const selectServiceArea = useCallback((city: ServiceCity, area: ServiceArea) => {
    const next: CustomerLocationState = {
      cityId: city.id,
      cityName: city.name,
      serviceAreaId: area.id,
      serviceAreaName: area.name,
      latitude: area.centerLatitude ?? undefined,
      longitude: area.centerLongitude ?? undefined,
      source: 'MANUAL_AREA',
    };
    setLocation(next);
    saveLocationToStorage(next);
    setIsLocationModalOpen(false);
  }, [saveLocationToStorage]);

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
        accuracy: Location.Accuracy.High,
      });

      let geoResult: Location.LocationGeocodedAddress | null = null;
      let detectedStreet: string | undefined = undefined;

      try {
        const results = await Location.reverseGeocodeAsync(position.coords);
        if (results && results.length > 0) {
          geoResult = results[0];
          detectedStreet = [geoResult.streetNumber, geoResult.street].filter(Boolean).join(' ') || geoResult.name || undefined;
        }
      } catch (geoErr: any) {
        console.warn('[CustomerLocationContext] Reverse geocode notice:', geoErr?.message);
      }

      // Query dynamic service areas from Supabase if available
      let dynamicAreas: ServiceArea[] = [];
      try {
        dynamicAreas = await CustomerAddressesRepository.listServiceAreas();
      } catch (_) {}

      // Resolve the true exact neighborhood using coordinates and centroids
      const resolved = resolvePreciseNeighborhood(
        position.coords.latitude,
        position.coords.longitude,
        geoResult ? {
          district: geoResult.district,
          subregion: geoResult.subregion,
          name: geoResult.name,
          city: geoResult.city,
          region: geoResult.region,
        } : null,
        dynamicAreas
      );

      const nextLocation: CustomerLocationState = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        serviceAreaName: resolved.serviceAreaName,
        cityName: resolved.cityName,
        addressLine: detectedStreet,
        source: 'DEVICE',
      };

      setLocation(nextLocation);
      await saveLocationToStorage(nextLocation);

      setIsLoadingLocation(false);
      setIsLocationModalOpen(false);
      return true;
    } catch (err: any) {
      console.warn('[CustomerLocationContext] Device location error:', err.message);
      setLocationError(err.message || 'Could not determine device location');
      setIsLoadingLocation(false);
      return false;
    }
  }, [saveLocationToStorage]);

  const clearLocation = useCallback(() => {
    setLocation(DEFAULT_DAR_LOCATION);
    saveLocationToStorage(DEFAULT_DAR_LOCATION);
  }, [saveLocationToStorage]);

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
