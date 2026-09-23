/**
 * MloHub Admin & Platform Semantic Theme Palettes
 *
 * Implements "MLOHUB — LOCAL PREMIUM" visual identity:
 * - Light Mode: Warm ivory/pure white surfaces, deep slate/ink typography, radiant food orange.
 * - Dark Mode: Deep midnight slate surfaces, high-contrast light slate text, focused warm coral accents.
 */

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  sidebar: string;
  border: string;
  borderLight: string;

  text: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  primary: string;
  primarySoft: string;
  primaryDark: string;

  success: string;
  successSoft: string;

  warning: string;
  warningSoft: string;

  danger: string;
  dangerSoft: string;

  info: string;
  infoSoft: string;

  card: string;
  inputBg: string;
  badgeBg: string;
}

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  sidebar: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  text: '#0F172A',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  primary: '#FA541C',
  primarySoft: '#FFF2E8',
  primaryDark: '#D4380D',

  success: '#10B981',
  successSoft: '#ECFDF5',

  warning: '#F59E0B',
  warningSoft: '#FFFBEB',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',

  info: '#0284C7',
  infoSoft: '#EFF6FF',

  card: '#FFFFFF',
  inputBg: '#FFFFFF',
  badgeBg: '#F1F5F9',
};

export const darkColors: ThemeColors = {
  background: '#0B1220',
  surface: '#0F172A',
  surfaceElevated: '#162238',
  sidebar: '#0F172A',
  border: '#25344D',
  borderLight: '#1B273A',

  text: '#F8FAFC',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',

  primary: '#FA541C',
  primarySoft: '#3A1C12',
  primaryDark: '#FF7A45',

  success: '#34D399',
  successSoft: '#0C2C24',

  warning: '#FBBF24',
  warningSoft: '#332713',

  danger: '#F87171',
  dangerSoft: '#341819',

  info: '#38BDF8',
  infoSoft: '#102A3C',

  card: '#0F172A',
  inputBg: '#162238',
  badgeBg: '#1E2D44',
};
