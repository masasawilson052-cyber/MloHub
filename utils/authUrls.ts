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

export interface ResetPasswordParamInput {
  code?: string | string[];
  error?: string | string[];
  error_description?: string | string[];
  access_token?: string | string[];
  refresh_token?: string | string[];
}

function firstNonEmptyString(val?: string | string[] | null): string | undefined {
  if (Array.isArray(val)) {
    for (const item of val) {
      if (typeof item === 'string' && item.trim()) {
        return item.trim();
      }
    }
    return undefined;
  }
  if (typeof val === 'string' && val.trim()) {
    return val.trim();
  }
  return undefined;
}

/**
 * Extracts a PKCE authorization `code` or error flag from Expo Router params,
 * browser URLs, or native `mlohub://auth/reset-password?code=...` deep links.
 * Strictly ignores implicit-grant `access_token` / `refresh_token` parameters.
 */
export function extractPkceCodeFromResetInput(
  params?: ResetPasswordParamInput,
  url?: string | null
): { code?: string; hasError: boolean } {
  const paramError =
    firstNonEmptyString(params?.error) ||
    firstNonEmptyString(params?.error_description);
  if (paramError) {
    return { hasError: true };
  }

  const paramCode = firstNonEmptyString(params?.code);
  if (paramCode) {
    return { code: paramCode, hasError: false };
  }

  const rawUrl =
    url !== undefined
      ? url
      : typeof window !== 'undefined' && window.location?.href
      ? window.location.href
      : null;

  if (typeof rawUrl === 'string' && rawUrl.trim()) {
    const qIndex = rawUrl.indexOf('?');
    if (qIndex !== -1) {
      const hashIndex = rawUrl.indexOf('#', qIndex);
      const queryPart =
        hashIndex !== -1
          ? rawUrl.slice(qIndex + 1, hashIndex)
          : rawUrl.slice(qIndex + 1);
      const searchParams = new URLSearchParams(queryPart);
      const urlErr =
        searchParams.get('error') || searchParams.get('error_description');
      if (urlErr && urlErr.trim()) {
        return { hasError: true };
      }
      const urlCode = searchParams.get('code');
      if (urlCode && urlCode.trim()) {
        return { code: urlCode.trim(), hasError: false };
      }
    }
  }

  return { hasError: false };
}
