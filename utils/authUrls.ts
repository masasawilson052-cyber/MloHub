export const PRODUCTION_APP_URL = 'https://mlohub.expo.app';
export const PRODUCTION_RESET_PASSWORD_URL = `${PRODUCTION_APP_URL}/auth/reset-password`;
export const NATIVE_RESET_PASSWORD_URL = 'mlohub://auth/reset-password';

export interface PasswordResetRedirectOptions {
  platformOs?: 'web' | 'ios' | 'android' | string;
  windowOrigin?: string | null;
  configuredAppUrl?: string;
  configuredResetUrl?: string;
  appEnv?: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function isLocalhostUrl(url: string): boolean {
  return /^(https?|exp):\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url.trim());
}

function detectPlatformOs(overrideOs?: string): string {
  if (overrideOs) {
    return overrideOs;
  }
  const testOs = (globalThis as any).__MLOHUB_PLATFORM_OS__;
  if (typeof testOs === 'string' && testOs) {
    return testOs;
  }
  if (
    typeof navigator !== 'undefined' &&
    (navigator as any).product === 'ReactNative' &&
    typeof document === 'undefined'
  ) {
    return 'native';
  }
  return 'web';
}

export function getPasswordResetRedirectUrl(
  options?: PasswordResetRedirectOptions
): string {
  const configuredAppUrl = (
    options?.configuredAppUrl ??
    process.env.EXPO_PUBLIC_APP_URL ??
    ''
  ).trim();

  const configuredResetUrl = (
    options?.configuredResetUrl ??
    process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL ??
    ''
  ).trim();

  const appEnv = (
    options?.appEnv ??
    process.env.EXPO_PUBLIC_APP_ENV ??
    ''
  )
    .trim()
    .toLowerCase();

  const platformOs = detectPlatformOs(options?.platformOs);

  /*
   * Native application:
   *
   * Use the MloHub app scheme rather than
   * browser localhost.
   */
  if (platformOs !== 'web') {
    if (configuredResetUrl && configuredResetUrl.startsWith('mlohub://')) {
      return configuredResetUrl;
    }

    return NATIVE_RESET_PASSWORD_URL;
  }

  /*
   * Browser:
   *
   * Current browser origin is safest
   * for hosted production and local development / preview.
   */
  const rawOrigin =
    options?.windowOrigin !== undefined
      ? options.windowOrigin
      : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : null;

  if (rawOrigin) {
    const origin = trimTrailingSlash(rawOrigin);

    /*
     * On production deployment,
     * always use current HTTPS origin.
     */
    if (origin.startsWith('https://')) {
      return origin + '/auth/reset-password';
    }

    /*
     * Local browser development.
     */
    if (
      origin.startsWith('http://127.0.0.1') ||
      origin.startsWith('http://localhost')
    ) {
      if (appEnv === 'production') {
        return PRODUCTION_RESET_PASSWORD_URL;
      }
      return origin + '/auth/reset-password';
    }
  }

  /*
   * Production fallback.
   * Never allow a stale localhost environment variable to produce a fallback URL.
   */
  if (
    configuredResetUrl &&
    configuredResetUrl.startsWith('https://') &&
    !isLocalhostUrl(configuredResetUrl)
  ) {
    return configuredResetUrl;
  }

  const appUrl =
    configuredAppUrl &&
    configuredAppUrl.startsWith('https://') &&
    !isLocalhostUrl(configuredAppUrl)
      ? trimTrailingSlash(configuredAppUrl)
      : PRODUCTION_APP_URL;

  return appUrl + '/auth/reset-password';
}
