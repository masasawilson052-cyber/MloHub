/**
 * MloHub Responsive Breakpoint Tokens - Design System V2
 */

export const Breakpoints = {
  phone: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

export const ContentMaxWidth = {
  phone: '100%',
  tablet: 720,
  desktop: 980,
  wide: 1200,
} as const;

export type BreakpointKey = keyof typeof Breakpoints;
