import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { UserRole, hasAdminAccess } from '../db/types';
import { getAppPlatformVariant } from '../lib/appVariant';
import AuthLandingScreen from './auth/index';

export default function RootIndex() {
  const { isAuthenticated, currentRole, activeWorkspace, user } = useAuth();
  const variant = getAppPlatformVariant();
  const searchParams = useLocalSearchParams();

  const hasParams = Object.keys(searchParams).length > 0;

  if (variant === 'partner') {
    if (!isAuthenticated) {
      return <Redirect href={`/auth/login?type=restaurant`} />;
    }
    return <Redirect href="/partner" />;
  }

  if (variant === 'admin') {
    if (!isAuthenticated) {
      return <Redirect href={`/auth/login?type=admin`} />;
    }
    return <Redirect href="/admin" />;
  }

  if (variant === 'customer') {
    if (hasParams) {
      return (
        <Redirect
          href={{
            pathname: '/(tabs)',
            params: searchParams as any,
          }}
        />
      );
    }
    return <Redirect href="/(tabs)" />;
  }

  // Customer-First Architecture: Unauthenticated users land directly on Discovery ((tabs))
  if (!isAuthenticated) {
    if (hasParams) {
      return (
        <Redirect
          href={{
            pathname: '/(tabs)',
            params: searchParams as any,
          }}
        />
      );
    }
    return <Redirect href="/(tabs)" />;
  }

  if (hasAdminAccess(user) && activeWorkspace === 'MLOHUB_ADMIN') {
    return <Redirect href="/admin" />;
  }

  const isRestaurant =
    activeWorkspace === 'RESTAURANT_OWNER' ||
    currentRole === UserRole.RESTAURANT_OWNER ||
    currentRole === UserRole.RESTAURANT_STAFF ||
    user?.role === UserRole.RESTAURANT_OWNER ||
    user?.activeRole === UserRole.RESTAURANT_OWNER;

  if (isRestaurant && activeWorkspace !== 'CUSTOMER') {
    return <Redirect href="/restaurant-portal" />;
  }

  if (hasParams) {
    return (
      <Redirect
        href={{
          pathname: '/(tabs)',
          params: searchParams as any,
        }}
      />
    );
  }

  return <Redirect href="/(tabs)" />;
}
