/**
 * ============================================================================
 * MLOHUB RUNTIME CONFIGURATION & STRICT ENVIRONMENT BOUNDARY
 * ============================================================================
 * Enforces explicit runtime modes and prevents production / staging from
 * silently falling back to mock storage, seeded users, or placeholder databases.
 *
 * Supported Modes:
 *   - development : Real local or remote Supabase required; NO fake fallback.
 *   - test        : Automated test runners (runAllSuites, security-smoke-test).
 *   - demo        : Explicit interactive customer / sandbox showcase.
 *   - staging     : Hosted staging Supabase required; NO fake fallback.
 *   - production  : Hosted production Supabase required; strict fail-closed.
 * ============================================================================
 */

export type RuntimeMode = 'development' | 'test' | 'demo' | 'staging' | 'production';

export interface RuntimeConfig {
  readonly mode: RuntimeMode;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly isDemo: boolean;
  readonly isStaging: boolean;
  readonly isProduction: boolean;
  readonly allowLocalDataFallbacks: boolean;
  readonly requiresRealSupabase: boolean;
  readonly environmentLabel: 'LOCAL DEVELOPMENT' | 'DEMO' | 'STAGING' | 'PRODUCTION' | 'TEST';
}

const VALID_MODES: readonly RuntimeMode[] = ['development', 'test', 'demo', 'staging', 'production'];

function detectRuntimeMode(): RuntimeMode {
  // 1. Prioritize automated test runner execution
  const rawNodeEnv =
    typeof process !== 'undefined' && process.env?.NODE_ENV
      ? String(process.env.NODE_ENV).trim().toLowerCase()
      : undefined;

  if (rawNodeEnv === 'test') {
    return 'test';
  }

  if (typeof process !== 'undefined' && Array.isArray(process.argv)) {
    const isRunningTestSuite = process.argv.some((arg) => {
      const lower = String(arg).toLowerCase();
      return (
        lower.includes('test') ||
        lower.includes('spec') ||
        lower.includes('runallsuites') ||
        lower.includes('security-smoke-test')
      );
    });
    if (isRunningTestSuite) {
      return 'test';
    }
  }

  // 2. Explicit EXPO_PUBLIC_APP_ENV if valid
  const rawExpoEnv =
    typeof process !== 'undefined' && process.env.EXPO_PUBLIC_APP_ENV
      ? String(process.env.EXPO_PUBLIC_APP_ENV).trim().toLowerCase()
      : undefined;

  if (rawExpoEnv) {
    if (VALID_MODES.includes(rawExpoEnv as RuntimeMode)) {
      return rawExpoEnv as RuntimeMode;
    }
    if (rawExpoEnv === 'dev') return 'development';
    if (rawExpoEnv === 'prod') return 'production';
  }

  // 3. NODE_ENV=production
  if (rawNodeEnv === 'production') {
    return 'production';
  }

  // 4. Otherwise development
  return 'development';
}

function resolveEnvironmentLabel(
  mode: RuntimeMode
): 'LOCAL DEVELOPMENT' | 'DEMO' | 'STAGING' | 'PRODUCTION' | 'TEST' {
  switch (mode) {
    case 'development':
      return 'LOCAL DEVELOPMENT';
    case 'demo':
      return 'DEMO';
    case 'staging':
      return 'STAGING';
    case 'production':
      return 'PRODUCTION';
    case 'test':
      return 'TEST';
  }
}

const activeMode = detectRuntimeMode();

/**
 * allowLocalDataFallbacks:
 * MUST be true ONLY for 'test' and 'demo'.
 * MUST be false for 'development', 'staging', and 'production'.
 */
const allowLocalDataFallbacks = activeMode === 'test' || activeMode === 'demo';

/**
 * requiresRealSupabase:
 * MUST be true for 'development', 'staging', and 'production'.
 * May be false for 'test' and 'demo'.
 */
const requiresRealSupabase =
  activeMode === 'development' || activeMode === 'staging' || activeMode === 'production';

let testingOverrides: Partial<RuntimeConfig> | null = null;

export function setRuntimeConfigForTesting(overrides: Partial<RuntimeConfig> | null): void {
  testingOverrides = overrides;
}

export function resetRuntimeConfigForTesting(): void {
  testingOverrides = null;
}

const baseConfig: RuntimeConfig = Object.freeze({
  mode: activeMode,
  isDevelopment: activeMode === 'development',
  isTest: activeMode === 'test',
  isDemo: activeMode === 'demo',
  isStaging: activeMode === 'staging',
  isProduction: activeMode === 'production',
  allowLocalDataFallbacks,
  requiresRealSupabase,
  environmentLabel: resolveEnvironmentLabel(activeMode),
});

export const runtimeConfig: RuntimeConfig = {
  get mode() {
    return testingOverrides?.mode ?? baseConfig.mode;
  },
  get isDevelopment() {
    return testingOverrides?.isDevelopment ?? (this.mode === 'development');
  },
  get isTest() {
    return testingOverrides?.isTest ?? (this.mode === 'test');
  },
  get isDemo() {
    return testingOverrides?.isDemo ?? (this.mode === 'demo');
  },
  get isStaging() {
    return testingOverrides?.isStaging ?? (this.mode === 'staging');
  },
  get isProduction() {
    return testingOverrides?.isProduction ?? (this.mode === 'production');
  },
  get allowLocalDataFallbacks() {
    return testingOverrides?.allowLocalDataFallbacks ?? (this.mode === 'test' || this.mode === 'demo');
  },
  get requiresRealSupabase() {
    return (
      testingOverrides?.requiresRealSupabase ??
      (this.mode === 'development' || this.mode === 'staging' || this.mode === 'production')
    );
  },
  get environmentLabel() {
    return testingOverrides?.environmentLabel ?? resolveEnvironmentLabel(this.mode);
  },
};
