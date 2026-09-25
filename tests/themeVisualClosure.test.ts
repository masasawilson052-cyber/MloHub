/**
 * ============================================================================
 * MLOHUB — FINAL APPEARANCE, LIGHT/DARK THEME & PORTAL DESIGN CLOSURE SUITE
 * ============================================================================
 * Validates:
 * 1. Semantic ThemeColors completeness & Light/Dark/System palettes
 * 2. Global preference persistence (`mlohub_theme_mode`) & legacy migration
 *    from `mlohub_admin_theme_mode`
 * 3. Top-right `ThemeQuickSwitcher` presence across Customer, Restaurant, and
 *    Admin portals
 * 4. Removal of Appearance controls from Customer Profile, Admin Settings,
 *    and Restaurant Settings
 * 5. `useTheme()` integration and zero unallowed structural hardcoded colors
 *    across Customer, Restaurant, and Admin portal surfaces
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import {
  ThemeMode,
  ThemeColors,
  lightColors,
  darkColors,
  THEME_STORAGE_KEY,
  LEGACY_ADMIN_THEME_KEY,
  isValidThemeMode,
  resolveThemeMode,
  resolveThemeColors,
  computeNextToggledMode,
  migrateAndLoadThemePreference,
  StorageLike,
} from '../theme/palettes';

export async function runThemeVisualClosureTests(): Promise<{
  passed: number;
  failed: number;
}> {
  console.log('\n================================================================');
  console.log('🎨 MLOHUB FINAL APPEARANCE, LIGHT/DARK THEME & PORTAL CLOSURE SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: unknown, message: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${message}`);
    } else {
      failed++;
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Theme Closure Assertion Failed: ${message}`);
    }
  }

  const rootDir = path.resolve(__dirname, '..');

  // --------------------------------------------------------------------------
  // Section 1: Semantic Theme Model & Palettes (Phases 3, 4, 5, 83)
  // --------------------------------------------------------------------------
  console.log('\n--- Section 1: Semantic Theme Model & Palettes ---');

  const requiredTokens: (keyof ThemeColors)[] = [
    'appBackground',
    'sidebarBackground',
    'topbarBackground',
    'surface',
    'surfaceRaised',
    'surfaceMuted',
    'surfaceInteractive',
    'surfaceHover',
    'card',
    'cardElevated',
    'border',
    'borderStrong',
    'divider',
    'textPrimary',
    'textSecondary',
    'textMuted',
    'textInverse',
    'inputBackground',
    'inputBorder',
    'inputPlaceholder',
    'primary',
    'primaryHover',
    'primaryPressed',
    'primarySoft',
    'success',
    'successSoft',
    'warning',
    'warningSoft',
    'danger',
    'dangerSoft',
    'info',
    'infoSoft',
    'focusRing',
    'overlay',
    'modalBackdrop',
    'navActiveBackground',
    'navActiveText',
    'navText',
    'navHover',
    'chartGrid',
    'primaryGradientStart',
    'primaryGradientEnd',
  ];

  for (const token of requiredTokens) {
    assert(
      typeof lightColors[token] === 'string' && lightColors[token].length > 0,
      `lightColors.${token} is defined (${lightColors[token]})`
    );
    assert(
      typeof darkColors[token] === 'string' && darkColors[token].length > 0,
      `darkColors.${token} is defined (${darkColors[token]})`
    );
  }

  assert(
    darkColors.appBackground === '#101112' &&
      darkColors.sidebarBackground === '#0B0C0D' &&
      darkColors.card === '#1C1E20',
    'Dark palette matches MloHub graphite shell (#101112 / #0B0C0D / #1C1E20)'
  );
  assert(
    lightColors.appBackground === '#F7F7F5' &&
      lightColors.card === '#FFFFFF' &&
      lightColors.textPrimary === '#172033',
    'Light palette matches MloHub warm ivory hierarchy (#F7F7F5 / #FFFFFF / #172033)'
  );
  assert(
    lightColors.primary === '#FF541F' && darkColors.primary === '#FF541F',
    'Primary MloHub brand orange (#FF541F) is unified across Light and Dark modes'
  );

  // --------------------------------------------------------------------------
  // Section 2: Theme Resolution, System Mode & Legacy Migration (Phases 2A, 6, 63, 75, 83)
  // --------------------------------------------------------------------------
  console.log('\n--- Section 2: Theme Resolution, System Mode & Legacy Migration ---');

  assert(
    THEME_STORAGE_KEY === 'mlohub_theme_mode',
    'Global theme storage key is mlohub_theme_mode'
  );
  assert(
    LEGACY_ADMIN_THEME_KEY === 'mlohub_admin_theme_mode',
    'Legacy admin storage key is mlohub_admin_theme_mode'
  );
  assert(
    isValidThemeMode('LIGHT') && isValidThemeMode('DARK') && isValidThemeMode('SYSTEM') && !isValidThemeMode('INVALID'),
    'isValidThemeMode validates LIGHT, DARK, and SYSTEM accurately'
  );
  assert(
    resolveThemeMode('LIGHT', 'dark') === 'LIGHT' &&
      resolveThemeColors('LIGHT', 'dark') === lightColors,
    'LIGHT mode resolves to lightColors regardless of OS scheme'
  );
  assert(
    resolveThemeMode('DARK', 'light') === 'DARK' &&
      resolveThemeColors('DARK', 'light') === darkColors,
    'DARK mode resolves to darkColors regardless of OS scheme'
  );
  assert(
    resolveThemeMode('SYSTEM', 'dark') === 'DARK' &&
      resolveThemeColors('SYSTEM', 'dark') === darkColors &&
      resolveThemeMode('SYSTEM', 'light') === 'LIGHT' &&
      resolveThemeColors('SYSTEM', 'light') === lightColors,
    'SYSTEM mode dynamically follows OS color scheme without overwriting preference'
  );
  assert(
    computeNextToggledMode('LIGHT') === 'DARK' &&
      computeNextToggledMode('DARK') === 'LIGHT' &&
      computeNextToggledMode('SYSTEM', 'dark') === 'LIGHT' &&
      computeNextToggledMode('SYSTEM', 'light') === 'DARK',
    'toggleMode transitions LIGHT <-> DARK and SYSTEM -> opposite concrete mode'
  );

  // Test storage migration with in-memory mock StorageLike
  function createMockStorage(initial: Record<string, string> = {}): StorageLike & { store: Record<string, string> } {
    const store: Record<string, string> = { ...initial };
    return {
      store,
      async getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      async setItem(key: string, value: string) {
        store[key] = value;
      },
      async removeItem(key: string) {
        delete store[key];
      },
    };
  }

  const legacyStorage = createMockStorage({ [LEGACY_ADMIN_THEME_KEY]: 'DARK' });
  const migratedMode: ThemeMode = await migrateAndLoadThemePreference(legacyStorage);
  assert(
    migratedMode === 'DARK' &&
      legacyStorage.store[THEME_STORAGE_KEY] === 'DARK' &&
      !(LEGACY_ADMIN_THEME_KEY in legacyStorage.store),
    'migrateAndLoadThemePreference migrates legacy mlohub_admin_theme_mode to mlohub_theme_mode and cleans up legacy key'
  );

  const existingStorage = createMockStorage({
    [THEME_STORAGE_KEY]: 'LIGHT',
    [LEGACY_ADMIN_THEME_KEY]: 'DARK',
  });
  const preservedMode = await migrateAndLoadThemePreference(existingStorage);
  assert(
    preservedMode === 'LIGHT' && existingStorage.store[THEME_STORAGE_KEY] === 'LIGHT',
    'migrateAndLoadThemePreference preserves existing mlohub_theme_mode over legacy key'
  );

  const emptyStorage = createMockStorage({});
  const defaultMode = await migrateAndLoadThemePreference(emptyStorage);
  assert(
    defaultMode === 'SYSTEM',
    'migrateAndLoadThemePreference defaults to SYSTEM when no stored preference exists'
  );

  // --------------------------------------------------------------------------
  // Section 3: Global Top-Right ThemeQuickSwitcher & Settings Removal (Phases 8-12, 58, 81, 82)
  // --------------------------------------------------------------------------
  console.log('\n--- Section 3: Top-Right ThemeQuickSwitcher & Settings Cleanup ---');

  const switcherPath = path.join(rootDir, 'components/theme/ThemeQuickSwitcher.tsx');
  assert(fs.existsSync(switcherPath), 'components/theme/ThemeQuickSwitcher.tsx exists');
  const switcherContent = fs.readFileSync(switcherPath, 'utf8');
  assert(
    switcherContent.includes('accessibilityLabel="Change appearance"') &&
      switcherContent.includes("mode: 'LIGHT'") &&
      switcherContent.includes("mode: 'DARK'") &&
      switcherContent.includes("mode: 'SYSTEM'") &&
      switcherContent.includes("e.key === 'Escape'"),
    'ThemeQuickSwitcher provides accessible Light/Dark/System popover with Escape key support'
  );

  const headerFiles = [
    { rel: 'components/Header.tsx', label: 'Customer Mobile Header' },
    { rel: 'components/navigation/CustomerDesktopNav.tsx', label: 'Customer Desktop Top Nav' },
    { rel: 'components/admin/AdminHeader.tsx', label: 'Admin Top Header' },
    { rel: 'components/restaurant/RestaurantPortalHeader.tsx', label: 'Restaurant Portal Top Header' },
  ];

  for (const h of headerFiles) {
    const content = fs.readFileSync(path.join(rootDir, h.rel), 'utf8');
    assert(
      content.includes('ThemeQuickSwitcher') && content.includes('<ThemeQuickSwitcher'),
      `${h.label} (${h.rel}) mounts <ThemeQuickSwitcher /> in top-right controls`
    );
  }

  const profileContent = fs.readFileSync(path.join(rootDir, 'app/(tabs)/profile.tsx'), 'utf8');
  assert(
    !profileContent.includes('Appearance') &&
      !profileContent.includes('Mwonekano') &&
      !profileContent.includes('setMode('),
    'app/(tabs)/profile.tsx has no Appearance / Mwonekano row or theme selector'
  );

  const adminSettingsContent = fs.readFileSync(
    path.join(rootDir, 'components/admin/AdminSettings.tsx'),
    'utf8'
  );
  assert(
    !adminSettingsContent.includes('APPEARANCE') &&
      !adminSettingsContent.includes('Appearance') &&
      !adminSettingsContent.includes('setMode('),
    'components/admin/AdminSettings.tsx has no Appearance tab or theme preview section'
  );

  const restaurantSettingsContent = fs.readFileSync(
    path.join(rootDir, 'components/restaurant/RestaurantSettings.tsx'),
    'utf8'
  );
  assert(
    !restaurantSettingsContent.includes('Appearance') &&
      !restaurantSettingsContent.includes('Mwonekano') &&
      !restaurantSettingsContent.includes('setMode('),
    'components/restaurant/RestaurantSettings.tsx has no Appearance control'
  );

  // --------------------------------------------------------------------------
  // Section 4: Portal Theme Coverage & Structural Static Color Audit (Phases 59-61, 82, 88)
  // --------------------------------------------------------------------------
  console.log('\n--- Section 4: Portal Theme Coverage & Structural Static Color Audit ---');

  const majorPortalFiles = [
    // Customer
    'app/(tabs)/_layout.tsx',
    'app/(tabs)/index.tsx',
    'app/(tabs)/explore.tsx',
    'app/(tabs)/orders.tsx',
    'app/(tabs)/custom.tsx',
    'app/(tabs)/bookings.tsx',
    'app/(tabs)/profile.tsx',
    'app/payments.tsx',
    'app/restaurant/[id].tsx',
    'app/compare.tsx',
    'app/notifications/index.tsx',
    'app/notifications/settings.tsx',
    'components/RestaurantCard.tsx',
    'components/LocationModal.tsx',
    'components/ReservationModal.tsx',
    'components/PaymentCheckoutModal.tsx',
    // Restaurant
    'app/restaurant-portal/index.tsx',
    'components/restaurant/RestaurantPortalHeader.tsx',
    'components/restaurant/RestaurantSidebar.tsx',
    'components/restaurant/RestaurantMobileNav.tsx',
    'components/restaurant/DashboardOverview.tsx',
    'components/restaurant/IncomingOrdersPanel.tsx',
    'components/restaurant/KitchenBoard.tsx',
    'components/restaurant/CustomMealQuotesPanel.tsx',
    'components/restaurant/MenuManager.tsx',
    'components/restaurant/MenuItemEditor.tsx',
    'components/restaurant/ReservationManager.tsx',
    'components/restaurant/ReviewsPanel.tsx',
    'components/restaurant/EarningsOverview.tsx',
    'components/restaurant/AnalyticsPanel.tsx',
    'components/restaurant/StaffManager.tsx',
    'components/restaurant/RestaurantSettings.tsx',
    // Admin
    'app/admin/index.tsx',
    'components/admin/AdminHeader.tsx',
    'components/admin/AdminSidebar.tsx',
    'components/admin/AdminMobileNav.tsx',
    'components/admin/AdminOverview.tsx',
    'components/admin/OrdersMonitor.tsx',
    'components/admin/ApplicationsQueue.tsx',
    'components/admin/ApplicationDetail.tsx',
    'components/admin/RestaurantsManager.tsx',
    'components/admin/RestaurantDetailAdmin.tsx',
    'components/admin/VerificationCenter.tsx',
    'components/admin/CustomerReportsAdmin.tsx',
    'components/admin/PaymentsMonitor.tsx',
    'components/admin/RefundsDisputesCenter.tsx',
    'components/admin/SettlementsPayoutsCenter.tsx',
    'components/admin/PlatformAnalytics.tsx',
    'components/admin/NotificationsCenter.tsx',
    'components/admin/AuditLogViewer.tsx',
    'components/admin/SystemHealth.tsx',
    'components/admin/AdminSettings.tsx',
    'components/admin/UsersManager.tsx',
    'components/admin/AdminUsersManager.tsx',
  ];

  const bannedStructuralHexRx =
    /#(ffffff|f8fafc|f1f5f9|e2e8f0|cbd5e1|94a3b8|64748b|475569|334155|1e293b|0f172a|faf8f3|f5f3ed|142033|0d1522)\b/gi;
  const bannedStaticColorsObjRx =
    /\bColors\.(background|surface|warmIvory|creamSurface|brandInk|textSecondary|textMuted|border|borderLight|textPrimary)\b/g;

  for (const rel of majorPortalFiles) {
    const fullPath = path.join(rootDir, rel);
    assert(fs.existsSync(fullPath), `${rel} exists`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(
      content.includes('useTheme'),
      `${rel} integrates useTheme() for dynamic Light/Dark rendering`
    );

    const hexViolations = content.match(bannedStructuralHexRx) || [];
    const colorObjViolations = content.match(bannedStaticColorsObjRx) || [];
    assert(
      hexViolations.length === 0 && colorObjViolations.length === 0,
      `${rel} contains 0 unallowed structural hardcoded colors (found ${hexViolations.length} hex, ${colorObjViolations.length} Colors.*)`
    );
  }

  console.log('\n================================================================');
  console.log(
    `🏁 THEME & PORTAL VISUAL CLOSURE RESULTS: ${passed} Passed | ${failed} Failed`
  );
  console.log('================================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runThemeVisualClosureTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
