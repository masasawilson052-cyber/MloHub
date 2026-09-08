import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { DbProvider, useMloHubDB } from '../context/DbContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { NotificationProvider } from '../context/NotificationContext';
import { UserRole } from '../db/types';

function RootNavigationLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isReady, hasCompletedOnboarding } = useMloHubDB();
  const { isAuthLoading, isAuthenticated, currentRole, user } = useAuth();

  useEffect(() => {
    if (!isReady || isAuthLoading) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inAuth = segments[0] === 'auth';
    const inRestaurantPortal = segments[0] === 'restaurant-portal';
    const inTabs = segments[0] === '(tabs)';

    if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }

    if (isAuthenticated) {
      const isRestaurantAccount =
        currentRole === UserRole.RESTAURANT_OWNER ||
        currentRole === UserRole.RESTAURANT_STAFF ||
        user?.role === UserRole.RESTAURANT_OWNER ||
        user?.activeRole === UserRole.RESTAURANT_OWNER;

      // Restaurant Owner should access the Restaurant Portal and not the customer app
      if (isRestaurantAccount && (inTabs || inAuth)) {
        router.replace('/restaurant-portal');
        return;
      }
    } else {
      // Unauthenticated users attempting to access restaurant portal
      if (inRestaurantPortal) {
        router.replace('/auth/login?type=restaurant' as any);
        return;
      }
    }
  }, [isReady, isAuthLoading, hasCompletedOnboarding, isAuthenticated, currentRole, user, segments]);

  return (
    <>
      <StatusBar style="dark" backgroundColor={Colors.background} />
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
          name="restaurant-portal"
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
              <RootNavigationLayout />
            </NotificationProvider>
          </LanguageProvider>
        </AuthProvider>
      </DbProvider>
    </SafeAreaProvider>
  );
}
