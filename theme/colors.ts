/**
 * MloHub Centralized Color Tokens - Design System V2
 * 
 * Visual Personality: "MLOHUB — LOCAL PREMIUM"
 * Warm, premium, approachable, food-forward, locally relevant, modern.
 * 
 * Color Usage Rule:
 * 80-90% of screens remain neutral (ivory, white, ink, warm grays).
 * Accent colors (saffron, coral, botanical green, violet) are reserved for
 * CTAs, status, badges, progress, and highlights. Food imagery provides the color.
 */

export const Colors = {
  // --- Primary Brand Interaction Accent (Radiant Food Orange / Coral) ---
  primary: '#FA541C',           // Warm food orange for primary CTAs and active tabs
  primaryDark: '#D4380D',
  primaryLight: '#FF7A45',
  primaryMuted: '#FFF2E8',
  primaryOrange: '#FA541C',
  primaryOrangeDark: '#E0441B',
  primaryOrangeLight: '#FFF2E8',

  // --- Brand Ink & Dark Accents (Deep midnight ink for text & high-contrast elements) ---
  brandInk: '#142033',
  brandInkLight: '#1E2D44',
  brandInkDark: '#0D1522',

  // --- Backgrounds & Surfaces (Warm Ivory & Pure White) ---
  warmIvory: '#FAF8F3',
  background: '#FAF8F3',         // Primary app screen background
  surface: '#FFFFFF',            // Elevated surface, card background
  card: '#FFFFFF',
  surfaceSecondary: '#F5F3ED',   // Secondary surface, inset background
  surfaceElevated: '#FFFFFF',

  // --- Highlights & Accents ---
  // Highlight: Saffron / Muted Gold
  saffron: '#D4A348',
  saffronLight: '#FDF7ED',
  saffronDark: '#B8872D',

  // Food Action Accent: Restrained Coral / Paprika
  coralAccent: '#C8482A',
  foodAction: '#C8482A',
  coralLight: '#FDF0ED',
  coralDark: '#A8371C',
  accent: '#C8482A',             // Mapped to food action accent
  accentDark: '#A8371C',
  accentLight: '#FDF0ED',

  // Custom Meals Domain Accent: Subtle Muted Violet
  mutedViolet: '#6C5CE7',
  violetLight: '#F3F0FC',
  violetDark: '#5646C7',

  // --- Status & Semantics ---
  // Success / Open / Verified: Botanical Green
  botanicalGreen: '#246B39',
  botanicalGreenLight: '#EAF4EE',
  success: '#246B39',
  successLight: '#EAF4EE',

  // Warning / Busy: Amber
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningDark: '#B45309',

  // Error: Warm accessible red
  error: '#C53030',
  errorLight: '#FDEEEE',
  errorDark: '#9B2C2C',

  // Info: Controlled muted blue
  info: '#2B6CB0',
  infoLight: '#EFF6FF',
  infoDark: '#1E4E8C',

  // --- Text Hierarchy ---
  text: '#142033',               // Primary brand ink text (>14:1 contrast on ivory)
  textPrimary: '#142033',
  textSecondary: '#4A5568',      // Accessible neutral secondary (>5.5:1 contrast)
  textTertiary: '#718096',
  muted: '#5A6B7C',
  textMuted: '#718096',
  subtle: '#A0AEC0',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',

  // Backward compatibility alias for lime
  lime: '#FDF7ED',

  // --- Borders & Dividers ---
  border: '#E2DFD7',             // Warm subtle border
  borderLight: '#ECE9E2',        // Very light warm border
  borderFocus: '#142033',

  // --- Interactive State Overlays ---
  disabled: '#CBD5E0',
  disabledSurface: '#E2E8F0',
  disabledText: '#A0AEC0',
  overlay: 'rgba(20, 32, 51, 0.55)',

  // --- Pure Constants ---
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof Colors;
