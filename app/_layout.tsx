import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { DbProvider, useMloHubDB } from '../context/DbContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { NotificationProvider } from '../context/NotificationContext';
import { CartProvider } from '../context/CartContext';
import { UserRole } from '../db/types';
import { ConnectionNotice } from '../components/ConnectionNotice';

function RootNavigationLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isReady, hasCompletedOnboarding } = useMloHubDB();
  const { isAuthLoading, isAuthenticated, currentRole, activeWorkspace, user } = useAuth();

  useEffect(() => {
    if (!isReady || isAuthLoading) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inAuth = segments[0] === 'auth';
    // Recovery and activation links must survive onboarding and signed-in redirects.
    if (inAuth && ((segments as readonly string[])[1] === 'reset-password' || (segments as readonly string[])[1] === 'activate-restaurant')) return;
    // These screens manage their own success/error navigation; do not interrupt
    // admin login or a restaurant application when auth state changes.
    if (inAuth && ['login', 'register-restaurant'].includes((segments as readonly string[])[1])) return;
    const inRestaurantPortal = segments[0] === 'restaurant-portal';
    const inTabs = segments[0] === '(tabs)';

    if (!hasCompletedOnboarding && !inOnboarding && !isAuthenticated && !inRestaurantPortal && segments[0] !== 'admin') {
      router.replace('/onboarding');
      return;
    }

    if (isAuthenticated) {
      // Respect active workspace: if owner switched to customer workspace, allow customer tabs
      if (activeWorkspace === 'RESTAURANT_OWNER' && inAuth) {
        router.replace('/restaurant-portal');
        return;
      }

      if ((activeWorkspace === 'CUSTOMER' || !activeWorkspace) && inAuth) {
        router.replace('/(tabs)');
        return;
      }
    } else {
      // Unauthenticated users can freely browse Customer Discovery and public tabs
      // Protect partner portals and admin consoles
      const inAdmin = segments[0] === 'admin';
      if (inRestaurantPortal) {
        router.replace('/auth/login?type=restaurant');
        return;
      }
      if (inAdmin) {
        router.replace('/auth/login?type=admin');
        return;
      }
    }
  }, [isReady, isAuthLoading, hasCompletedOnboarding, isAuthenticated, currentRole, activeWorkspace, user, segments]);

  return (
    <>
      <StatusBar style="dark" />
      <ConnectionNotice />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="restaurant-portal/index"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="admin/index"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="notifications/index"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="notifications/settings"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="restaurant/[id]"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DbProvider>
        <AuthProvider>
          <LanguageProvider>
            <NotificationProvider>
              <CartProvider>
                <RootNavigationLayout />
              </CartProvider>
            </NotificationProvider>
          </LanguageProvider>
        </AuthProvider>
      </DbProvider>
    </SafeAreaProvider>
  );
}
