/**
 * MloHub Unified Semantic Theme Palettes
 *
 * Implements the final MloHub visual system across:
 * 1. Customer Marketplace
 * 2. Restaurant Operations Workbench
 * 3. Admin & Governance Command Center
 *
 * - Dark Mode: Near-black / graphite shell (#101112), matte dark sidebar (#0B0C0D),
 *   softly elevated charcoal cards (#1C1E20 / #232527), restrained borders (#303236),
 *   high-contrast typography (#F7F7F5), and MloHub orange emphasis (#FF541F).
 * - Light Mode: Warm ivory shell (#F7F7F5), crisp white surfaces (#FFFFFF),
 *   deep ink typography (#172033), subtle borders (#E5E7E4), and MloHub orange (#FF541F).
 */

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface ThemeColors {
  // Application shell
  appBackground: string;
  sidebarBackground: string;
  topbarBackground: string;

  // Surfaces
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  surfaceInteractive: string;
  surfaceHover: string;

  // Cards
  card: string;
  cardElevated: string;

  // Borders
  border: string;
  borderStrong: string;
  divider: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Inputs
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;

  // Brand
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  primaryCta: string;
  primarySoft: string;

  // Semantic
  success: string;
  successSoft: string;

  warning: string;
  warningSoft: string;

  danger: string;
  dangerSoft: string;

  info: string;
  infoSoft: string;

  // Focus
  focusRing: string;

  // Overlays
  overlay: string;
  modalBackdrop: string;

  // Navigation
  navActiveBackground: string;
  navActiveText: string;
  navText: string;
  navHover: string;

  // Charts / analytics
  chartGrid: string;

  // Brand gradient
  primaryGradientStart: string;
  primaryGradientEnd: string;
  onPrimary: string;

  // Compatibility & domain aliases for seamless portal theming
  background: string;
  surfaceElevated: string;
  surfaceSecondary: string;
  creamSurface: string;
  warmIvory: string;
  sidebar: string;
  borderLight: string;
  borderFocus: string;
  text: string;
  textTertiary: string;
  muted: string;
  subtle: string;
  textOnPrimary: string;
  primaryDark: string;
  primaryLight: string;
  primaryMuted: string;
  primaryOrange: string;
  primaryOrangeDark: string;
  primaryOrangeLight: string;
  brandInk: string;
  brandInkLight: string;
  brandInkDark: string;
  saffron: string;
  saffronLight: string;
  saffronDark: string;
  coralAccent: string;
  foodAction: string;
  coralLight: string;
  coralDark: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  mutedViolet: string;
  violetLight: string;
  violetDark: string;
  botanicalGreen: string;
  botanicalGreenLight: string;
  successLight: string;
  warningLight: string;
  warningDark: string;
  error: string;
  errorLight: string;
  errorDark: string;
  infoLight: string;
  infoDark: string;
  lime: string;
  disabled: string;
  disabledSurface: string;
  disabledText: string;
  inputBg: string;
  badgeBg: string;
  white: string;
  black: string;
  transparent: string;
}

export const lightColors: ThemeColors = {
  // Application shell
  appBackground: '#F7F7F5',
  sidebarBackground: '#FFFFFF',
  topbarBackground: '#FFFFFF',

  // Surfaces
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#F3F4F2',
  surfaceInteractive: '#F7F7F5',
  surfaceHover: '#F0F1EF',

  // Cards
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',

  // Borders
  border: '#E5E7E4',
  borderStrong: '#D6D9D5',
  divider: '#ECEDEA',

  // Typography
  textPrimary: '#172033',
  textSecondary: '#566174',
  textMuted: '#647080',
  textInverse: '#FFFFFF',

  // Inputs
  inputBackground: '#F7F7F5',
  inputBorder: '#DDE0DC',
  inputPlaceholder: '#647080',

  // Brand
  primary: '#FF541F',
  primaryHover: '#EA4816',
  primaryPressed: '#D63D0F',
  primaryCta: '#D63D0F',
  primarySoft: '#FFF0E9',

  // Semantic
  success: '#16A34A',
  successSoft: '#EAF8EF',

  warning: '#D97706',
  warningSoft: '#FFF6DF',

  danger: '#DC2626',
  dangerSoft: '#FDECEC',

  info: '#2563EB',
  infoSoft: '#EBF2FF',

  // Focus
  focusRing: 'rgba(255,84,31,0.20)',

  // Overlays
  overlay: 'rgba(15,23,42,0.30)',
  modalBackdrop: 'rgba(15,23,42,0.45)',

  // Navigation
  navActiveBackground: '#FFF0E9',
  navActiveText: '#FF541F',
  navText: '#526071',
  navHover: '#F6F7F5',

  // Charts / analytics
  chartGrid: '#E7E9E6',

  // Brand gradient
  primaryGradientStart: '#FF4D19',
  primaryGradientEnd: '#FF7741',
  onPrimary: '#FFFFFF',

  // Compatibility & domain aliases
  background: '#F7F7F5',
  surfaceElevated: '#FFFFFF',
  surfaceSecondary: '#F3F4F2',
  creamSurface: '#F7F7F5',
  warmIvory: '#F7F7F5',
  sidebar: '#FFFFFF',
  borderLight: '#ECEDEA',
  borderFocus: '#FF541F',
  text: '#172033',
  textTertiary: '#647080',
  muted: '#566174',
  subtle: '#647080',
  textOnPrimary: '#FFFFFF',
  primaryDark: '#D63D0F',
  primaryLight: '#FF7741',
  primaryMuted: '#FFF0E9',
  primaryOrange: '#FF541F',
  primaryOrangeDark: '#EA4816',
  primaryOrangeLight: '#FFF0E9',
  brandInk: '#172033',
  brandInkLight: '#566174',
  brandInkDark: '#172033',
  saffron: '#D4A348',
  saffronLight: '#FFF6DF',
  saffronDark: '#B8872D',
  coralAccent: '#FF541F',
  foodAction: '#FF541F',
  coralLight: '#FFF0E9',
  coralDark: '#D63D0F',
  accent: '#FF541F',
  accentDark: '#D63D0F',
  accentLight: '#FFF0E9',
  mutedViolet: '#6C5CE7',
  violetLight: '#F3F0FC',
  violetDark: '#5646C7',
  botanicalGreen: '#16A34A',
  botanicalGreenLight: '#EAF8EF',
  successLight: '#EAF8EF',
  warningLight: '#FFF6DF',
  warningDark: '#B45309',
  error: '#DC2626',
  errorLight: '#FDECEC',
  errorDark: '#9B2C2C',
  infoLight: '#EBF2FF',
  infoDark: '#1E4E8C',
  lime: '#FFF6DF',
  disabled: '#D6D9D5',
  disabledSurface: '#F3F4F2',
  disabledText: '#6E7A89',
  inputBg: '#F7F7F5',
  badgeBg: '#F3F4F2',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const darkColors: ThemeColors = {
  // Application shell
  appBackground: '#101112',
  sidebarBackground: '#0B0C0D',
  topbarBackground: '#111213',

  // Surfaces
  surface: '#18191B',
  surfaceRaised: '#202224',
  surfaceMuted: '#151617',
  surfaceInteractive: '#242628',
  surfaceHover: '#2B2D30',

  // Cards
  card: '#1C1E20',
  cardElevated: '#232527',

  // Borders
  border: '#303236',
  borderStrong: '#3A3D42',
  divider: '#292B2E',

  // Typography
  textPrimary: '#F7F7F5',
  textSecondary: '#C0C4C9',
  textMuted: '#949BA4',
  textInverse: '#111213',

  // Inputs
  inputBackground: '#161719',
  inputBorder: '#34363A',
  inputPlaceholder: '#8C939D',

  // Brand
  primary: '#FF541F',
  primaryHover: '#FF6636',
  primaryPressed: '#D63D0F',
  primaryCta: '#D63D0F',
  primarySoft: 'rgba(255,84,31,0.14)',

  // Semantic
  success: '#22C55E',
  successSoft: 'rgba(34,197,94,0.14)',

  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.14)',

  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.14)',

  info: '#3B82F6',
  infoSoft: 'rgba(59,130,246,0.14)',

  // Focus
  focusRing: 'rgba(255,84,31,0.28)',

  // Overlays
  overlay: 'rgba(0,0,0,0.55)',
  modalBackdrop: 'rgba(0,0,0,0.72)',

  // Navigation
  navActiveBackground: '#242628',
  navActiveText: '#FFFFFF',
  navText: '#A9AFB7',
  navHover: '#1D1F21',

  // Charts / analytics
  chartGrid: '#2B2D30',

  // Brand gradient
  primaryGradientStart: '#FF4D19',
  primaryGradientEnd: '#FF7B43',
  onPrimary: '#FFFFFF',

  // Compatibility & domain aliases
  background: '#101112',
  surfaceElevated: '#202224',
  surfaceSecondary: '#151617',
  creamSurface: '#18191B',
  warmIvory: '#101112',
  sidebar: '#0B0C0D',
  borderLight: '#292B2E',
  borderFocus: '#FF541F',
  text: '#F7F7F5',
  textTertiary: '#949BA4',
  muted: '#C0C4C9',
  subtle: '#949BA4',
  textOnPrimary: '#FFFFFF',
  primaryDark: '#FF6636',
  primaryLight: '#FF7B43',
  primaryMuted: 'rgba(255,84,31,0.14)',
  primaryOrange: '#FF541F',
  primaryOrangeDark: '#FF6636',
  primaryOrangeLight: 'rgba(255,84,31,0.14)',
  brandInk: '#F7F7F5',
  brandInkLight: '#C0C4C9',
  brandInkDark: '#FFFFFF',
  saffron: '#F59E0B',
  saffronLight: 'rgba(245,158,11,0.14)',
  saffronDark: '#FBBF24',
  coralAccent: '#FF541F',
  foodAction: '#FF541F',
  coralLight: 'rgba(255,84,31,0.14)',
  coralDark: '#FF6636',
  accent: '#FF541F',
  accentDark: '#FF6636',
  accentLight: 'rgba(255,84,31,0.14)',
  mutedViolet: '#8B7CF6',
  violetLight: 'rgba(139,124,246,0.15)',
  violetDark: '#A78BFA',
  botanicalGreen: '#22C55E',
  botanicalGreenLight: 'rgba(34,197,94,0.14)',
  successLight: 'rgba(34,197,94,0.14)',
  warningLight: 'rgba(245,158,11,0.14)',
  warningDark: '#FBBF24',
  error: '#EF4444',
  errorLight: 'rgba(239,68,68,0.14)',
  errorDark: '#F87171',
  infoLight: 'rgba(59,130,246,0.14)',
  infoDark: '#60A5FA',
  lime: 'rgba(245,158,11,0.14)',
  disabled: '#34363A',
  disabledSurface: '#202224',
  disabledText: '#8C939D',
  inputBg: '#161719',
  badgeBg: '#242628',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const THEME_STORAGE_KEY = 'mlohub_theme_mode';
export const LEGACY_ADMIN_THEME_KEY = 'mlohub_admin_theme_mode';

export function isValidThemeMode(val: unknown): val is ThemeMode {
  return val === 'LIGHT' || val === 'DARK' || val === 'SYSTEM';
}

export function resolveThemeMode(
  mode: ThemeMode,
  systemScheme?: 'light' | 'dark' | null
): 'LIGHT' | 'DARK' {
  if (mode === 'LIGHT') return 'LIGHT';
  if (mode === 'DARK') return 'DARK';
  return systemScheme === 'dark' ? 'DARK' : 'LIGHT';
}

export function resolveThemeColors(
  mode: ThemeMode,
  systemScheme?: 'light' | 'dark' | null
): ThemeColors {
  return resolveThemeMode(mode, systemScheme) === 'DARK' ? darkColors : lightColors;
}

export function computeNextToggledMode(
  mode: ThemeMode,
  systemScheme?: 'light' | 'dark' | null
): 'LIGHT' | 'DARK' {
  const currentResolved = resolveThemeMode(mode, systemScheme);
  return currentResolved === 'DARK' ? 'LIGHT' : 'DARK';
}

export interface StorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export async function migrateAndLoadThemePreference(
  storage: StorageLike
): Promise<ThemeMode> {
  try {
    const saved = await storage.getItem(THEME_STORAGE_KEY);
    if (isValidThemeMode(saved)) {
      return saved;
    }

    const legacy = await storage.getItem(LEGACY_ADMIN_THEME_KEY);
    if (isValidThemeMode(legacy)) {
      await storage.setItem(THEME_STORAGE_KEY, legacy);
      try {
        await storage.removeItem(LEGACY_ADMIN_THEME_KEY);
      } catch {
        // Non-fatal cleanup
      }
      return legacy;
    }
  } catch (e) {
    console.warn('Failed to load or migrate theme preference:', e);
  }
  return 'LIGHT';
}

