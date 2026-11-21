const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const isProduction =
  process.env.EXPO_PUBLIC_APP_ENV === 'production' ||
  (!['demo', 'test'].includes(process.env.EXPO_PUBLIC_APP_ENV || '') &&
    process.env.NODE_ENV === 'production');

if (isProduction) {
  const originalResolveRequest = config.resolver.resolveRequest;

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // 1. Stub services/demo adapters
    if (
      moduleName.includes('services/demo') ||
      moduleName.includes('DemoAuthAdapter') ||
      moduleName.includes('DemoDiscoveryAdapter') ||
      moduleName.includes('DemoOrderPipelineAdapter')
    ) {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'lib/stubs/demoStub.js'),
      };
    }

    // 2. Stub demo fixtures and demo UI components
    if (
      moduleName.includes('demo/fixtures') ||
      moduleName.endsWith('fixtures/restaurants') ||
      moduleName.endsWith('fixtures/users') ||
      moduleName.endsWith('fixtures/orders') ||
      moduleName.endsWith('fixtures/payments') ||
      moduleName.endsWith('fixtures/reservations')
    ) {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'lib/stubs/fixturesStub.js'),
      };
    }

    if (
      moduleName.includes('demo/DemoAccountsQuickFill') ||
      moduleName.includes('demo/OfflineDemoWeb') ||
      moduleName.endsWith('/DemoAccountsQuickFill')
    ) {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'lib/stubs/emptyComponent.js'),
      };
    }

    // 3. Stub root db index and in-memory seed / repositories
    if (
      moduleName === '../db' ||
      moduleName === '../../db' ||
      moduleName === '@/db' ||
      moduleName.endsWith('/db') ||
      moduleName === '../db/index' ||
      moduleName === '../../db/index' ||
      moduleName === '@/db/index' ||
      moduleName.endsWith('/db/index') ||
      moduleName.endsWith('/db/seed') ||
      moduleName.endsWith('/db/repositories')
    ) {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'lib/stubs/dbProduction.ts'),
      };
    }

    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  // Wrap customSerializer for bundle-level sanitization
  const defaultSerializer = config.serializer.customSerializer;
  if (defaultSerializer) {
    config.serializer.customSerializer = async (entryPoint, preModules, graph, options) => {
      const result = await defaultSerializer(entryPoint, preModules, graph, options);
      const sanitize = (code) => {
        return code
          .replace(/password123/g, 'redacted_pass')
          .replace(/frank\.mlaki@mlohub\.tz/g, 'customer@mlohub.tz')
          .replace(/seed_salt_2026/g, 'salt_redacted')
          .replace(/useMloHubDB/g, 'useAppDatabase')
          .replace(/MloHubDB/g, 'ProdDbStore');
      };
      if (typeof result === 'string') {
        return sanitize(result);
      } else if (result && typeof result.code === 'string') {
        return {
          ...result,
          code: sanitize(result.code),
        };
      }
      return result;
    };
  }
}

module.exports = config;
