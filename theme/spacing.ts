/**
 * MloHub Standardized Spacing Scale - Design System V2
 */

export const Spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export type SpacingToken = keyof typeof Spacing;
