/**
 * MloHub Motion System Tokens - Design System V2
 * Communication-oriented, restrained durations (120-350ms).
 */

export const Motion = {
  durations: {
    instant: 0,
    fast: 150,     // button press, quick toggle, tooltip
    normal: 250,   // card expand, tab switch, sheet transition
    slow: 350,     // modal entrance, screen transition
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    spring: {
      damping: 15,
      stiffness: 150,
      mass: 0.8,
    },
    buttonPress: {
      scale: 0.97,
      opacity: 0.88,
    },
  },
} as const;

export type MotionToken = typeof Motion;
