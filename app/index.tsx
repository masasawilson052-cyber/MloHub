import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../db/types';
import AuthLandingScreen from './auth/index';

export default function RootIndex() {
  const { isAuthenticated, currentRole, activeWorkspace, user } = useAuth();

  // Customer-First Architecture: Unauthenticated users land directly on Discovery ((tabs))
  if (!isAuthenticated) {
    return <Redirect href="/(tabs)" />;
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

  return <Redirect href="/(tabs)" />;
}
