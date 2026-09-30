import '../lib/alertPolyfill';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DbProvider, useMloHubDB } from '../context/DbContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { NotificationProvider } from '../context/NotificationContext';
import { CartProvider } from '../context/CartContext';
import { CartInteractionProvider } from '../context/CartInteractionContext';
import { ConnectionNotice } from '../components/ConnectionNotice';

import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AdminPreviewProvider } from '../context/AdminPreviewContext';
import { CustomerLocationProvider } from '../context/CustomerLocationContext';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore if splash screen was already prevented or unavailable
  });
}

function RootNavigationLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isReady, hasCompletedOnboarding } = useMloHubDB();
  const { isAuthLoading, isAuthenticated, currentRole, activeWorkspace, user } = useAuth();
  const { isDark, resolvedMode, isThemeHydrated, colors } = useTheme();
  const [splashFallbackReady, setSplashFallbackReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (isThemeHydrated) {
      setSplashFallbackReady(true);
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const timer = setTimeout(() => {
      setSplashFallbackReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [isThemeHydrated]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const root = document.documentElement;
      root.dataset.theme = resolvedMode === 'DARK' ? 'dark' : 'light';
      root.style.colorScheme = resolvedMode === 'DARK' ? 'dark' : 'light';
      root.style.backgroundColor = colors.appBackground;
      if (document.body) {
        document.body.style.backgroundColor = colors.appBackground;
        document.body.style.color = colors.textPrimary;
      }
    }
  }, [resolvedMode, colors]);

  useEffect(() => {
    if (!isReady || isAuthLoading || (!isThemeHydrated && !splashFallbackReady)) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inAuth = segments[0] === 'auth';
    // Recovery and activation links must survive onboarding and signed-in redirects.
    if (inAuth && ((segments as readonly string[])[1] === 'reset-password' || (segments as readonly string[])[1] === 'activate-restaurant')) return;
    // These screens manage their own success/error navigation; do not interrupt
    // admin login or a restaurant application when auth state changes.
    if (inAuth && ['login', 'register-restaurant'].includes((segments as readonly string[])[1])) return;
    const inRestaurantPortal = segments[0] === 'restaurant-portal';

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
  }, [isReady, isAuthLoading, isThemeHydrated, splashFallbackReady, hasCompletedOnboarding, isAuthenticated, currentRole, activeWorkspace, user, segments]);

  if (Platform.OS !== 'web' && !isThemeHydrated && !splashFallbackReady) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ConnectionNotice />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.appBackground },
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
      {Platform.OS === 'web' && (
        <style
          // @ts-ignore
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
              }
              html[data-theme="dark"] {
                color-scheme: dark;
                background-color: #101112;
                scrollbar-color: #303236 #101112;
              }
              html[data-theme="light"] {
                color-scheme: light;
                background-color: #F7F7F5;
                scrollbar-color: #D6D9D5 #F7F7F5;
              }
              input::-ms-reveal,
              input::-ms-clear {
                display: none !important;
              }
              input:focus-visible, textarea:focus-visible, button:focus-visible, [tabindex]:focus-visible {
                outline: 2px solid #FF541F !important;
                outline-offset: 1px !important;
              }
            `,
          }}
        />
      )}
      <ThemeProvider>
        <DbProvider>
          <AuthProvider>
            <AdminPreviewProvider>
              <LanguageProvider>
                <NotificationProvider>
                  <CustomerLocationProvider>
                    <CartProvider>
                      <CartInteractionProvider>
                        <RootNavigationLayout />
                      </CartInteractionProvider>
                    </CartProvider>
                  </CustomerLocationProvider>
                </NotificationProvider>
              </LanguageProvider>
            </AdminPreviewProvider>
          </AuthProvider>
        </DbProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
