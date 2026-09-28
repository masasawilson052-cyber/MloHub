import {
  getPasswordResetRedirectUrl,
  PRODUCTION_RESET_PASSWORD_URL,
  NATIVE_RESET_PASSWORD_URL,
  isLocalhostUrl,
  extractPkceCodeFromResetInput,
} from './authUrls';

export function runAuthUrlsAndRecoveryTestSuite(): {
  passedCount: number;
  failedCount: number;
} {
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedCount++;
    }
  }

  console.log('\nTest Group 21: Branded Password Recovery & Redirect URL Authority');

  const origTestOs = (globalThis as any).__MLOHUB_PLATFORM_OS__;
  const origWindow = (globalThis as any).window;
  const origAppUrl = process.env.EXPO_PUBLIC_APP_URL;
  const origResetUrl = process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL;
  const origAppEnv = process.env.EXPO_PUBLIC_APP_ENV;

  try {
    // 1. Production browser origin
    (globalThis as any).__MLOHUB_PLATFORM_OS__ = 'web';
    (globalThis as any).window = {
      location: { origin: 'https://mlohub.expo.app' },
    };
    delete process.env.EXPO_PUBLIC_APP_URL;
    delete process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL;
    process.env.EXPO_PUBLIC_APP_ENV = 'production';

    const prodUrl = getPasswordResetRedirectUrl();
    assert(
      prodUrl === 'https://mlohub.expo.app/auth/reset-password',
      `Production origin https://mlohub.expo.app returns ${prodUrl}`
    );

    // 2. Local browser origin in development
    (globalThis as any).__MLOHUB_PLATFORM_OS__ = 'web';
    (globalThis as any).window = {
      location: { origin: 'http://127.0.0.1:5512' },
    };
    process.env.EXPO_PUBLIC_APP_ENV = 'development';

    const localUrl = getPasswordResetRedirectUrl();
    assert(
      localUrl === 'http://127.0.0.1:5512/auth/reset-password',
      `Local origin http://127.0.0.1:5512 returns ${localUrl}`
    );

    // 3. Critical test: Stale localhost env on production origin MUST NOT override HTTPS origin
    (globalThis as any).__MLOHUB_PLATFORM_OS__ = 'web';
    (globalThis as any).window = {
      location: { origin: 'https://mlohub.expo.app' },
    };
    process.env.EXPO_PUBLIC_APP_URL = 'http://127.0.0.1:5512';
    process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL =
      'http://127.0.0.1:5512/auth/reset-password';
    process.env.EXPO_PUBLIC_APP_ENV = 'development';

    const staleEnvProdOriginUrl = getPasswordResetRedirectUrl();
    assert(
      staleEnvProdOriginUrl === 'https://mlohub.expo.app/auth/reset-password',
      'Stale 127.0.0.1 env variable cannot override https://mlohub.expo.app browser origin'
    );

    // 4. Fallback when window is undefined and stale localhost env is set
    (globalThis as any).__MLOHUB_PLATFORM_OS__ = 'web';
    delete (globalThis as any).window;
    process.env.EXPO_PUBLIC_APP_URL = 'http://127.0.0.1:5512';
    process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL =
      'http://127.0.0.1:5512/auth/reset-password';

    const fallbackUrl = getPasswordResetRedirectUrl();
    assert(
      fallbackUrl === PRODUCTION_RESET_PASSWORD_URL,
      'Fallback without window rejects stale localhost env and returns https://mlohub.expo.app/auth/reset-password'
    );

    // 5. Native platform (iOS / Android) returns mlohub:// scheme
    (globalThis as any).__MLOHUB_PLATFORM_OS__ = 'android';
    delete process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL;
    const nativeUrl = getPasswordResetRedirectUrl();
    assert(
      nativeUrl === NATIVE_RESET_PASSWORD_URL && !isLocalhostUrl(nativeUrl),
      `Native platform returns app scheme URL (${nativeUrl}) without localhost`
    );

    // 6. PKCE code extraction across router params, web URL, and native deep link URL
    const fromRouterParams = extractPkceCodeFromResetInput({ code: 'pkce-router-code-123' }, null);
    assert(
      fromRouterParams.code === 'pkce-router-code-123' && !fromRouterParams.hasError,
      'extractPkceCodeFromResetInput extracts PKCE code from Expo Router search params'
    );

    const fromWebUrl = extractPkceCodeFromResetInput(
      {},
      'https://mlohub.expo.app/auth/reset-password?code=pkce-web-code-456'
    );
    assert(
      fromWebUrl.code === 'pkce-web-code-456' && !fromWebUrl.hasError,
      'extractPkceCodeFromResetInput extracts PKCE code from web HTTPS reset URL'
    );

    const fromNativeUrl = extractPkceCodeFromResetInput(
      {},
      'mlohub://auth/reset-password?code=pkce-native-code-789'
    );
    assert(
      fromNativeUrl.code === 'pkce-native-code-789' && !fromNativeUrl.hasError,
      'extractPkceCodeFromResetInput extracts PKCE code from native mlohub://auth/reset-password?code=... URL'
    );

    const fromExpiredLink = extractPkceCodeFromResetInput(
      {},
      'mlohub://auth/reset-password?error=access_denied&error_description=Email+link+is+invalid+or+has+expired'
    );
    assert(
      fromExpiredLink.hasError && fromExpiredLink.code === undefined,
      'extractPkceCodeFromResetInput flags invalid/expired reset links with hasError=true'
    );

    const fromImplicitTokensOnly = extractPkceCodeFromResetInput(
      { access_token: 'implicit-token', refresh_token: 'implicit-refresh' },
      'https://mlohub.expo.app/auth/reset-password?access_token=implicit-token&refresh_token=implicit-refresh'
    );
    assert(
      fromImplicitTokensOnly.code === undefined && !fromImplicitTokensOnly.hasError,
      'extractPkceCodeFromResetInput ignores access_token / refresh_token query parameters'
    );

    // 7. Verify Supabase client, AuthContext, ForgotPasswordScreen, ResetPasswordScreen, and Templates
    const nodeRequire = (globalThis as any).require || eval('require');
    const fs = nodeRequire('fs');
    const path = nodeRequire('path');
    const rootDir = (globalThis as any).process?.cwd?.() || '.';

    const supabaseClientSrc = fs.readFileSync(
      path.join(rootDir, 'lib/supabase.ts'),
      'utf8'
    );
    const authContextSrc = fs.readFileSync(
      path.join(rootDir, 'context/AuthContext.tsx'),
      'utf8'
    );
    const forgotSrc = fs.readFileSync(
      path.join(rootDir, 'app/auth/forgot-password.tsx'),
      'utf8'
    );
    const resetSrc = fs.readFileSync(
      path.join(rootDir, 'app/auth/reset-password.tsx'),
      'utf8'
    );
    const recoveryHtml = fs.readFileSync(
      path.join(rootDir, 'supabase/templates/recovery.html'),
      'utf8'
    );
    const configToml = fs.readFileSync(
      path.join(rootDir, 'supabase/config.toml'),
      'utf8'
    );

    assert(
      supabaseClientSrc.includes("flowType: 'pkce'"),
      "lib/supabase.ts explicitly configures flowType: 'pkce'"
    );
    assert(
      authContextSrc.includes('getPasswordResetRedirectUrl()'),
      'AuthContext.tsx uses getPasswordResetRedirectUrl() for password recovery'
    );
    assert(
      authContextSrc.includes(
        'Please wait a moment before requesting another reset email.'
      ),
      'AuthContext.tsx maps rate limits to a clean user-facing message'
    );
    assert(
      forgotSrc.includes(
        'If an MloHub account exists for this email address, password reset instructions have been sent.'
      ) && !forgotSrc.toLowerCase().includes('no user exists'),
      'forgot-password.tsx uses privacy-safe generic response without account enumeration'
    );
    assert(
      forgotSrc.includes('RESEND_COOLDOWN_SECONDS = 60') &&
        forgotSrc.includes('Send Again') &&
        forgotSrc.includes('Back to Sign In'),
      'forgot-password.tsx enforces 60s resend cooldown and renders Back to Sign In + Send Again actions'
    );
    assert(
      resetSrc.includes('exchangeCodeForSession') &&
        resetSrc.includes('extractPkceCodeFromResetInput') &&
        resetSrc.includes('Linking.getInitialURL') &&
        resetSrc.includes('hasExchangedRef') &&
        resetSrc.includes("window.history.replaceState({}, docTitle, '/auth/reset-password')"),
      'reset-password.tsx exchanges PKCE code once across web and native deep links and cleans ?code= from browser history'
    );
    assert(
      resetSrc.includes("event === 'PASSWORD_RECOVERY'") &&
        !resetSrc.includes("event === 'SIGNED_IN'") &&
        !resetSrc.includes('supabase.auth.getSession()'),
      'reset-password.tsx strictly requires PASSWORD_RECOVERY or PKCE code exchange (normal SIGNED_IN / getSession() cannot unlock recovery)'
    );
    assert(
      resetSrc.includes('Create New Password') &&
        resetSrc.includes('Update Password') &&
        resetSrc.includes('supabase.auth.updateUser') &&
        resetSrc.includes('await supabase.auth.signOut()'),
      'reset-password.tsx renders Create New Password directly, updates password, and signs out recovery session'
    );
    assert(
      resetSrc.includes('Reset Link Expired') &&
        resetSrc.includes('Request a New Reset Link') &&
        !resetSrc.includes('AuthApiError') &&
        !resetSrc.includes('invalid_grant'),
      'reset-password.tsx renders clean Reset Link Expired state without raw GoTrue/PKCE errors'
    );
    assert(
      recoveryHtml.includes('MloHub') &&
        recoveryHtml.includes('Reset My Password') &&
        recoveryHtml.includes('{{ .ConfirmationURL }}') &&
        !recoveryHtml.includes('Supabase Auth'),
      'supabase/templates/recovery.html is MloHub branded and uses {{ .ConfirmationURL }}'
    );

    const uncommentedConfigLines = configToml
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith('#'));

    assert(
      uncommentedConfigLines.includes('minimum_password_length = 10'),
      'supabase/config.toml sets active (uncommented) minimum_password_length = 10'
    );
    assert(
      uncommentedConfigLines.includes('subject = "Reset your MloHub password"') &&
        uncommentedConfigLines.includes('sender_name = "MloHub"'),
      'supabase/config.toml sets active (uncommented) recovery subject = "Reset your MloHub password" and [local_smtp] sender_name = "MloHub"'
    );
    assert(
      !uncommentedConfigLines.includes('[auth.email.smtp]'),
      'supabase/config.toml keeps [auth.email.smtp] commented so local config is never falsely reported as hosted production SMTP'
    );
  } finally {
    if (origTestOs === undefined) {
      delete (globalThis as any).__MLOHUB_PLATFORM_OS__;
    } else {
      (globalThis as any).__MLOHUB_PLATFORM_OS__ = origTestOs;
    }
    if (origWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = origWindow;
    }
    if (origAppUrl === undefined) delete process.env.EXPO_PUBLIC_APP_URL;
    else process.env.EXPO_PUBLIC_APP_URL = origAppUrl;
    if (origResetUrl === undefined)
      delete process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL;
    else process.env.EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL = origResetUrl;
    if (origAppEnv === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = origAppEnv;
  }

  console.log(
    `\n🏁 AUTH URLS & RECOVERY SUITE RESULTS: ${passedCount} Passed | ${failedCount} Failed\n`
  );

  return { passedCount, failedCount };
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const res = runAuthUrlsAndRecoveryTestSuite();
  if (res.failedCount > 0) {
    process.exit(1);
  }
}
