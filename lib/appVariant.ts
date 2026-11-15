import { NativeModules, Platform } from 'react-native';

export type AppPlatformVariant = 'unified' | 'customer' | 'partner' | 'admin';

let cachedVariant: AppPlatformVariant | null = null;

export function getAppPlatformVariant(): AppPlatformVariant {
  if (cachedVariant) return cachedVariant;

  const envVariant =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_APP_VARIANT
      ? String(process.env.EXPO_PUBLIC_APP_VARIANT).trim().toLowerCase()
      : undefined;

  if (envVariant === 'customer' || envVariant === 'partner' || envVariant === 'admin') {
    const resolved: AppPlatformVariant = envVariant;
    cachedVariant = resolved;
    return resolved;
  }

  if (Platform.OS === 'android') {
    try {
      const mod = NativeModules?.MloHubVariant;
      const nativePlatform: unknown =
        (typeof mod?.getPlatform === 'function' ? mod.getPlatform() : undefined) ||
        mod?.getConstants?.()?.platform ||
        mod?.platform;
      if (
        nativePlatform === 'customer' ||
        nativePlatform === 'partner' ||
        nativePlatform === 'admin'
      ) {
        const resolved: AppPlatformVariant = nativePlatform;
        cachedVariant = resolved;
        return resolved;
      }
    } catch {
      // Ignore native lookup issues in tests or headless runners
    }
  }

  return 'unified';
}

export function isCustomerOnlyApp(): boolean {
  return getAppPlatformVariant() === 'customer';
}

export function isPartnerOnlyApp(): boolean {
  return getAppPlatformVariant() === 'partner';
}

export function isAdminOnlyApp(): boolean {
  return getAppPlatformVariant() === 'admin';
}
