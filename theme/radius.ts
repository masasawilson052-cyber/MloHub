/**
 * MloHub Border Radii - Design System V2
 */

export const Radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
  pill: 9999,
} as const;

export type RadiiToken = keyof typeof Radii;
